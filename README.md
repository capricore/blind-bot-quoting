# BlindBots Trade Portal — B2B Quoting System (THE-772 prototype)

Working prototype for the Linear ticket **[THE-772] B2B Quoting System — Roller Shade + Drapery v1**:
a retailer-facing quoting and pre-order portal layered on the supply chain, covering the full loop —
**catalog → configure → render → auto-quote → pre-order → supplier Excel → order/tracking numbers → live status to delivery.**

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

The SQLite database is created and seeded automatically at `data/app.db` on first request
(2 historical orders + demo catalog). Delete the `data/` folder to reset to a fresh demo state.

## Demo walkthrough (5 minutes)

1. **Dashboard** — account stats, fulfillment pipeline, live activity feed.
2. **Catalog** — curated, supply-chain-producible patterns for Roller Shade + Drapery.
   Note the valid-opacity chips per pattern: variation constraints are data, not code.
3. **Configure** (e.g. *Botanica* or *Velluto Velvet*) —
   - color / opacity / options selection; non-producible opacities are disabled (try *Solar Screen 3%* — sheer only),
   - per-line dimension inputs with range validation,
   - **in-context render** updates live with every change (programmatic SVG standing in for the production render engine),
   - **auto-quote** recomputed by the backend formula engine (`POST /api/price`), with full price breakdown
     and manufacturing facts (fabric meters, panel counts).
4. **Add to quote → Quotes** — draft accumulates lines; submit converts it to a pre-order.
5. **Pre-Orders → order detail** — status stepper, fulfillment facts, event timeline, and
   **⬇ Supplier order file (.xlsx)**: the bilingual (中文/EN) Excel generated in the format the China supplier ingests.
6. **Supplier Console** — simulates the supplier system + logistics layer: acknowledge (issues supplier
   order №), start production, ship (issues tracking №), transit, deliver. Each push appears on the
   retailer's order timeline and dashboard feed.
7. **Pricing Versions** — the versioned quote formula engine: price-grid pricing for roller shades,
   cut-and-make formula for drapery. Quotes pin the version they were priced with.

## Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS v4, custom design tokens |
| Data | SQLite via better-sqlite3 (`lib/db.ts` — schema, seed, access helpers) |
| Quote engine | `lib/pricing.ts` — pure, isomorphic, versioned configs from DB |
| Excel | exceljs (`lib/excel.ts`) — bilingual supplier order workbook |
| Renders | `components/renders.tsx` — parameterized SVG scenes (roller / drapery / swatch) |

### Domain model

- **Catalog**: product lines (dimension schema + option groups) → products (patterns) → colors + `validOpacities`
  (the producibility constraint surfaced in the configurator).
- **Quote**: `draft → converted`; line items store the full config **and** the computed breakdown + pricing version.
- **Pre-order state machine**: `submitted → acknowledged → in_production → shipped → in_transit → delivered`,
  transitions guarded server-side; every transition writes an `order_events` row (the retailer update channel).

### API surface

```
POST   /api/price                 auto-quote a configuration (422 on non-producible combos)
POST   /api/quote-items           add configured item to the draft quote (server re-prices; client never trusted)
DELETE /api/quote-items           remove a line
POST   /api/quotes/:id/submit     convert draft quote → pre-order
POST   /api/orders/:id/advance    supplier/logistics event ingestion (simulated by the console)
GET    /api/orders/:id/excel      download the supplier order workbook
```

## Prototype boundaries (per ticket scope)

- Auth / retailer onboarding / billing — out of scope (single demo retailer account).
- In-context render is programmatic SVG — the integration point for the real visualization engine.
- Excel handoff is download/simulated delivery; production would deliver via email/SFTP/API adapter.
- Supplier Console stands in for the supplier-system + logistics integrations.
