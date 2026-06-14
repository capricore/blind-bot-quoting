# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm install          # required before anything (also installs node_modules/next/dist/docs/, see AGENTS.md)
npm run dev          # dev server at http://localhost:3000
npm run build        # production build
npm run lint         # eslint
```

There is no test suite. The SQLite database is created and seeded automatically at `data/app.db` on first request; delete the `data/` folder to reset to a fresh demo state.

## What this is

A working prototype of a B2B quoting & pre-order portal for window treatments (Linear ticket THE-772): catalog → configure → SVG render → auto-quote → pre-order → supplier Excel → status tracking to delivery. Auth, billing, and real supplier/logistics integrations are intentionally out of scope — the Supplier Console page (`app/supplier`) simulates the supplier side.

## Architecture

Next.js 16 App Router (no `src/` dir — `app/`, `components/`, `lib/` at the root, imported via `@/`). React 19, TypeScript, Tailwind v4 (design tokens in `app/globals.css`, shared primitives in `components/ui.tsx`).

**Data flow:** Server components import query helpers from `lib/db.ts` directly. Client components (`Configurator`, `QuoteActions`, `SupplierActions`) mutate through the API routes under `app/api/`. The client is never trusted with prices — `POST /api/quote-items` re-prices server-side before storing.

- `lib/db.ts` — the single DB access layer: lazy singleton (`db()`) that opens SQLite via better-sqlite3, runs schema migration and demo seed on first call, and exports all query helpers. No ORM; raw prepared statements.
- `lib/catalog-data.ts` — the catalog (product lines, products, colors, pricing configs) is **static TypeScript data, not DB rows**. Only pricing versions, quotes, orders, and order events live in SQLite.
- `lib/pricing.ts` — pure, isomorphic quote engine. Two pricing kinds: `roller-grid` (size-band price grid) and `drapery-formula` (cut-and-make from fabric math). Pricing configs are versioned rows in `pricing_versions`; each quote line snapshots its full `config` + computed `computation` + pricing version, so old quotes are immune to pricing changes.
- Producibility is data, not code: each product's `validOpacities` constrains the configurator, and `validateConfig` enforces it server-side (`POST /api/price` returns 422 on non-producible combos).
- **Order state machine:** `submitted → acknowledged → in_production → shipped → in_transit → delivered`. Transitions go through `POST /api/orders/:id/advance`, which guards preconditions (409 on out-of-order actions) and writes an `order_events` row for every transition — events are the retailer-facing update channel (timeline, dashboard feed).
- `lib/excel.ts` — bilingual (中文/EN) supplier order workbook via exceljs, served by `GET /api/orders/:id/excel`.
- `components/renders.tsx` — parameterized SVG product renders (roller / drapery / swatch); the stand-in for a real visualization engine.

`next.config.ts` marks `better-sqlite3` and `exceljs` as `serverExternalPackages` — keep them out of client bundles.

## Conventions

- Route handler and page props are async in this Next.js version: `params` and `searchParams` are `Promise`s that must be awaited.
- Domain types are centralized in `lib/types.ts`; DB rows with JSON columns (`config`, `computation`, pricing `config`) are parsed at the `lib/db.ts` boundary so everything above it works with typed objects.
