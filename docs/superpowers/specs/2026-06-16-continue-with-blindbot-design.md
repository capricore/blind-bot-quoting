# Continue-with-BlindBot — verified handoff

**Ticket:** THE-772 (sub-project 8) · **Date:** 2026-06-16

## Problem

Phase-1 linking is a heuristic: the quote account links to a blind-bot account when
the **email matches**, but nothing proves the person signing in actually controls that
blind-bot account. The handoff itself carries no identity. We want a *verified* path:
when a retailer who is logged into blind-bot clicks "Get a quote", they arrive at the
quote service already authenticated as the same identity — no separate sign-in.

Both systems run on Supabase, but **different projects** (quote
`ylcuuamsenvnqfnbhdmk`, blind-bot `iashgsuvdedpdmytdbgw`), so sessions are not shared.

## Decisions (locked)

- **Mechanism — refined Option A:** blind-bot sends the retailer's blind-bot Supabase
  `access_token` with the handoff; quote validates it against **blind-bot's own
  Supabase** (`auth.getUser(token)`), then auto-provisions/links a quote account and
  mints a quote session. No shared secret; no new blind-bot endpoint.
- **Token transport — POST:** the token travels in a POST body, never the URL.
- **Scope:** this sub-project is the **verified POST handoff only**. A standalone
  "Continue with BlindBot" button on the quote *login* page (for visitors who land
  directly, needing a redirect to blind-bot to obtain a token) is **out of scope**
  (phase 2b).
- **Failure fallback:** an invalid/expired/missing token redirects to the normal quote
  `/login?next=<configure import URL>`, so manual login still completes the import.
- **Provisioning:** any valid blind-bot user is auto-provisioned a quote account
  (email-confirmed); no allowlist.

## Design

### Flow

1. Retailer is logged into blind-bot; clicks "Get a quote" (still behind the existing
   `NEXT_PUBLIC_QUOTE_HANDOFF_ENABLED` flag).
2. blind-bot **POSTs** a form (`target="_blank"`) to `{QUOTE}/api/handoff` with hidden
   fields `token` (blind-bot Supabase `access_token`), `line`, `img`, `cfg`.
3. Quote `POST /api/handoff`: validates the token → provisions/links → mints a quote
   session → **302-redirects** to `/configure/<product>?img&cfg&line` (the existing
   import path; the configurator already strips those params from the URL on load).

### blind-bot side (additive; no existing-logic change)

- **`blind-bot-shared-ui` `ResultStep`:** add an optional prop `quoteAuthToken?: string`.
  When the handoff flag is on **and** `quoteAuthToken` is present, render the action as a
  `<form method="POST" action={`${QUOTE_BASE_URL}/api/handoff`} target="_blank">` with
  hidden inputs `token={quoteAuthToken}`, `line`, `img`, `cfg`, and a submit button
  styled exactly like the current "Get a quote →" link. When the prop is absent, keep
  today's behaviour (no change).
- **`blind-bot-frontend`** (the `ResultStep` consumer): pass `quoteAuthToken` from its
  current Supabase session (`supabase.auth.getSession()` → `access_token`). This is the
  only consumer change; nothing else in blind-bot is touched.
- The `line → product` mapping moves to the quote side (quote owns its catalog), so the
  form sends only `line` (`roller` | `drape`).

### Quote `POST /api/handoff` — route handler

Reads form fields `token`, `line`, `img`, `cfg`. Builds the import destination
`dest = /configure/${QUOTE_DEFAULT_PRODUCT[line]}` with `img`/`cfg`/`line` as query
params (the existing import URL shape; `QUOTE_DEFAULT_PRODUCT = { roller: "rs-aria",
drape: "dp-velluto" }`).

1. **Validate** — a Supabase client built from blind-bot's public env
   (`BLINDBOT_SUPABASE_URL`, `BLINDBOT_SUPABASE_ANON_KEY`):
   `const { data, error } = await bbClient.auth.getUser(token)`. On error / no email →
   `302 → /login?next=<dest>`.
2. **Provision** — quote service_role admin: `admin.auth.admin.createUser({ email,
   email_confirm: true })`; ignore an "already registered" error (idempotent).
3. **Mint session** — quote SSR server client (the cookie-writing one):
   - `const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink",
     email })` → `link.properties.hashed_token`.
   - `await supabase.auth.verifyOtp({ type: "magiclink", token_hash:
     link.properties.hashed_token })` — this writes the quote session cookies (same
     mechanism as the existing OAuth callback's `exchangeCodeForSession`).
4. **Link profile** — `await ensureProfileLinked()` (creates the profile row + pulls the
   blind-bot company, exactly as the existing email/OAuth paths do).
5. **Redirect** — `302 → dest`. The user lands in the configurator, authenticated, with
   the design imported.

If any step after validation throws, redirect to `/login?next=<dest>` (degrade to manual
login rather than 500).

### Why a server-side helper

Steps 1–4 live in a small `lib/auth/blindbot-handoff.ts` (validate token, provision,
mint session, link) so the route handler stays thin and the bridge is testable in
isolation. `getUser`-based validation needs only blind-bot's public anon key; provisioning
and `generateLink` need quote's existing service_role admin; `verifyOtp` needs the SSR
cookie client.

## Environment (quote)

- `BLINDBOT_SUPABASE_URL` — blind-bot's Supabase project URL (public).
- `BLINDBOT_SUPABASE_ANON_KEY` — blind-bot's anon key (public).

Added to `.env.local` and `.env.example`. If either is unset, `/api/handoff` falls back
to `/login?next=` (verified handoff simply disabled), so the app still runs.

## Security

- The access token is in the POST body, not the URL — it never enters browser history,
  the address bar, server access logs, or `Referer`.
- The token is validated by **blind-bot's own Supabase** (the authority); quote shares no
  secret and cannot forge identities.
- Auto-provisioning creates an email-confirmed account only after the blind-bot token
  proves control of that email.
- `/api/handoff` trusts the validated token, not the caller's session, so cross-origin
  POST from blind-bot is expected and safe; no CSRF token is needed (there is no
  pre-existing quote session to abuse).

## Out of scope

- A "Continue with BlindBot" button on the quote login page for direct visitors
  (needs a reverse redirect to blind-bot to mint a token) — phase 2b.
- Replacing the phase-1 email heuristic for the *manual* email/Google logins; those keep
  working unchanged. This adds a verified path, it doesn't remove the existing ones.

## Verification

- With a real logged-in blind-bot session: clicking "Get a quote" lands authenticated in
  the configurator with the design imported, and a quote `profiles` row exists for that
  email with the blind-bot company populated — no manual sign-in.
- Tampered/expired token → redirected to `/login?next=<configure URL>`; signing in
  manually still lands on the same import.
- Unset `BLINDBOT_SUPABASE_*` env → handoff degrades to the login page (no crash).
- `npm run lint` and `npx tsc --noEmit` clean on the quote side; shared-ui + frontend
  changes build.
