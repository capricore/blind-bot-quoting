import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  DRAPERY_PRICING_V1,
  PRODUCTS,
  PRODUCT_LINES,
  ROLLER_PRICING_V1,
  ROLLER_PRICING_V2,
} from "./catalog-data";
import { computeQuote } from "./pricing";
import type {
  ItemConfig,
  OrderEventRow,
  OrderRow,
  OrderStatus,
  PricingVersionRow,
  Product,
  ProductLine,
  QuoteComputation,
  QuoteItemRow,
  QuoteRow,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new Database(path.join(DATA_DIR, "app.db"));
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  seed(_db);
  return _db;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS pricing_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lineId TEXT NOT NULL,
      version TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      config TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(lineId, version)
    );
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref TEXT NOT NULL UNIQUE,
      retailer TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      projectName TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS quote_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quoteId INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      productId TEXT NOT NULL,
      lineId TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      config TEXT NOT NULL,
      computation TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref TEXT NOT NULL UNIQUE,
      quoteId INTEGER NOT NULL REFERENCES quotes(id),
      status TEXT NOT NULL DEFAULT 'submitted',
      supplierOrderNo TEXT,
      trackingNo TEXT,
      carrier TEXT,
      etaDate TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      actor TEXT NOT NULL DEFAULT 'system',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ---------------- catalog (static, versioned pricing lives in DB) ----------------

export function getLines(): ProductLine[] {
  return PRODUCT_LINES;
}

export function getLine(lineId: string): ProductLine | undefined {
  return PRODUCT_LINES.find((l) => l.id === lineId);
}

export function getProducts(lineId?: string): Product[] {
  return lineId ? PRODUCTS.filter((p) => p.lineId === lineId) : PRODUCTS;
}

export function getProduct(productId: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === productId);
}

export function getActivePricing(lineId: string): PricingVersionRow {
  const row = db()
    .prepare("SELECT * FROM pricing_versions WHERE lineId = ? AND active = 1")
    .get(lineId) as (Omit<PricingVersionRow, "config"> & { config: string }) | undefined;
  if (!row) throw new Error(`No active pricing version for ${lineId}`);
  return { ...row, config: JSON.parse(row.config) };
}

export function getAllPricingVersions(): PricingVersionRow[] {
  const rows = db()
    .prepare("SELECT * FROM pricing_versions ORDER BY lineId, createdAt DESC")
    .all() as (Omit<PricingVersionRow, "config"> & { config: string })[];
  return rows.map((r) => ({ ...r, config: JSON.parse(r.config) }));
}

// ---------------- quotes ----------------

const parseQuoteItem = (r: Record<string, unknown>): QuoteItemRow =>
  ({
    ...(r as object),
    config: JSON.parse(r.config as string),
    computation: JSON.parse(r.computation as string),
  }) as QuoteItemRow;

function nextRef(d: Database.Database, table: "quotes" | "orders", prefix: string): string {
  const year = new Date().getFullYear();
  const row = d.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  return `${prefix}-${year}-${String(row.n + 1).padStart(4, "0")}`;
}

export const DEMO_RETAILER = "Harbor & Lane Interiors";

export function getDraftQuote(): QuoteRow | undefined {
  return db()
    .prepare("SELECT * FROM quotes WHERE status = 'draft' ORDER BY id DESC LIMIT 1")
    .get() as QuoteRow | undefined;
}

export function getOrCreateDraftQuote(projectName?: string): QuoteRow {
  const existing = getDraftQuote();
  if (existing) return existing;
  const d = db();
  const ref = nextRef(d, "quotes", "Q");
  d.prepare(
    "INSERT INTO quotes (ref, retailer, status, projectName) VALUES (?, ?, 'draft', ?)"
  ).run(ref, DEMO_RETAILER, projectName ?? null);
  return getDraftQuote()!;
}

export function addQuoteItem(
  quoteId: number,
  product: Product,
  config: ItemConfig,
  qty: number,
  computation: QuoteComputation
): QuoteItemRow {
  const d = db();
  const info = d
    .prepare(
      "INSERT INTO quote_items (quoteId, productId, lineId, qty, config, computation) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(quoteId, product.id, product.lineId, qty, JSON.stringify(config), JSON.stringify(computation));
  d.prepare("UPDATE quotes SET updatedAt = datetime('now') WHERE id = ?").run(quoteId);
  return parseQuoteItem(
    d.prepare("SELECT * FROM quote_items WHERE id = ?").get(info.lastInsertRowid) as Record<string, unknown>
  );
}

export function removeQuoteItem(itemId: number) {
  db().prepare("DELETE FROM quote_items WHERE id = ?").run(itemId);
}

export function getQuotes(): (QuoteRow & { itemCount: number; total: number })[] {
  const rows = db()
    .prepare(
      `SELECT q.*, COUNT(i.id) AS itemCount,
              COALESCE(SUM(json_extract(i.computation,'$.unitPrice') * i.qty), 0) AS total
       FROM quotes q LEFT JOIN quote_items i ON i.quoteId = q.id
       GROUP BY q.id ORDER BY q.id DESC`
    )
    .all() as (QuoteRow & { itemCount: number; total: number })[];
  return rows;
}

export function getQuote(id: number): (QuoteRow & { items: QuoteItemRow[]; total: number }) | undefined {
  const q = db().prepare("SELECT * FROM quotes WHERE id = ?").get(id) as QuoteRow | undefined;
  if (!q) return undefined;
  const items = (
    db().prepare("SELECT * FROM quote_items WHERE quoteId = ? ORDER BY id").all(id) as Record<string, unknown>[]
  ).map(parseQuoteItem);
  const total = items.reduce((s, i) => s + i.computation.unitPrice * i.qty, 0);
  return { ...q, items, total: Math.round(total * 100) / 100 };
}

// ---------------- orders ----------------

export function submitPreOrder(quoteId: number): OrderRow {
  const d = db();
  const quote = getQuote(quoteId);
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "draft") throw new Error("Quote already converted");
  if (quote.items.length === 0) throw new Error("Quote has no items");

  const ref = nextRef(d, "orders", "PO");
  const tx = d.transaction(() => {
    d.prepare("UPDATE quotes SET status = 'converted', updatedAt = datetime('now') WHERE id = ?").run(quoteId);
    const info = d
      .prepare("INSERT INTO orders (ref, quoteId, status) VALUES (?, ?, 'submitted')")
      .run(ref, quoteId);
    d.prepare(
      "INSERT INTO order_events (orderId, status, note, actor) VALUES (?, 'submitted', ?, 'retailer')"
    ).run(
      info.lastInsertRowid,
      `Pre-order ${ref} submitted by ${quote.retailer}. Supplier order file generated and queued for delivery.`
    );
    return info.lastInsertRowid as number;
  });
  const orderId = tx();
  return d.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow;
}

export type OrderListRow = OrderRow & {
  quoteRef: string;
  retailer: string;
  projectName: string | null;
  itemCount: number;
  total: number;
};

export function getOrders(): OrderListRow[] {
  return db()
    .prepare(
      `SELECT o.*, q.ref AS quoteRef, q.retailer, q.projectName,
              COUNT(i.id) AS itemCount,
              COALESCE(SUM(json_extract(i.computation,'$.unitPrice') * i.qty), 0) AS total
       FROM orders o
       JOIN quotes q ON q.id = o.quoteId
       LEFT JOIN quote_items i ON i.quoteId = q.id
       GROUP BY o.id ORDER BY o.id DESC`
    )
    .all() as OrderListRow[];
}

export function getOrder(id: number):
  | (OrderRow & {
      quote: NonNullable<ReturnType<typeof getQuote>>;
      events: OrderEventRow[];
    })
  | undefined {
  const o = db().prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  if (!o) return undefined;
  const quote = getQuote(o.quoteId)!;
  const events = db()
    .prepare("SELECT * FROM order_events WHERE orderId = ? ORDER BY id DESC")
    .all(id) as OrderEventRow[];
  return { ...o, quote, events };
}

export function updateOrder(
  id: number,
  patch: Partial<Pick<OrderRow, "status" | "supplierOrderNo" | "trackingNo" | "carrier" | "etaDate">>,
  event: { status: OrderStatus | "note"; note: string; actor: OrderEventRow["actor"] }
): OrderRow {
  const d = db();
  const sets = Object.keys(patch)
    .map((k) => `${k} = @${k}`)
    .join(", ");
  d.prepare(`UPDATE orders SET ${sets}, updatedAt = datetime('now') WHERE id = @id`).run({ ...patch, id });
  d.prepare("INSERT INTO order_events (orderId, status, note, actor) VALUES (?, ?, ?, ?)").run(
    id,
    event.status,
    event.note,
    event.actor
  );
  return d.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow;
}

export function getRecentEvents(limit = 10): (OrderEventRow & { orderRef: string })[] {
  return db()
    .prepare(
      `SELECT e.*, o.ref AS orderRef FROM order_events e
       JOIN orders o ON o.id = e.orderId
       ORDER BY e.id DESC LIMIT ?`
    )
    .all(limit) as (OrderEventRow & { orderRef: string })[];
}

// ---------------- seed ----------------

function seed(d: Database.Database) {
  const hasPricing = (d.prepare("SELECT COUNT(*) AS n FROM pricing_versions").get() as { n: number }).n > 0;
  if (!hasPricing) {
    const ins = d.prepare(
      "INSERT INTO pricing_versions (lineId, version, active, note, config) VALUES (?, ?, ?, ?, ?)"
    );
    ins.run("roller-shade", "2026.1", 0, "Initial FOB grid", JSON.stringify(ROLLER_PRICING_V1));
    ins.run(
      "roller-shade",
      "2026.2",
      1,
      "Q2 freight adjustment: motorized +$5, blackout multiplier 1.28→1.30",
      JSON.stringify(ROLLER_PRICING_V2)
    );
    ins.run("drapery", "2026.1", 1, "Initial cut-and-make formula", JSON.stringify(DRAPERY_PRICING_V1));
  }

  const hasQuotes = (d.prepare("SELECT COUNT(*) AS n FROM quotes").get() as { n: number }).n > 0;
  if (hasQuotes) return;

  // Demo history so the dashboard and pipeline read as a living account.
  const mkQuote = (
    ref: string,
    projectName: string,
    createdAt: string,
    status: "draft" | "converted",
    items: { productId: string; qty: number; config: ItemConfig }[]
  ) => {
    const info = d
      .prepare(
        "INSERT INTO quotes (ref, retailer, status, projectName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(ref, DEMO_RETAILER, status, projectName, createdAt, createdAt);
    const quoteId = info.lastInsertRowid as number;
    for (const it of items) {
      const product = getProduct(it.productId)!;
      const line = getLine(product.lineId)!;
      const pricingCfg = product.lineId === "roller-shade" ? ROLLER_PRICING_V2 : DRAPERY_PRICING_V1;
      const version = product.lineId === "roller-shade" ? "2026.2" : "2026.1";
      const comp = computeQuote(line, product, it.config, pricingCfg, version);
      d.prepare(
        "INSERT INTO quote_items (quoteId, productId, lineId, qty, config, computation, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(quoteId, product.id, product.lineId, it.qty, JSON.stringify(it.config), JSON.stringify(comp), createdAt);
    }
    return quoteId;
  };

  const q1 = mkQuote("Q-2026-0001", "Maple St. Townhomes — Unit 4B", "2026-05-12 09:14:00", "converted", [
    {
      productId: "rs-aria",
      qty: 6,
      config: {
        colorId: "chalk",
        opacityId: "room-darkening",
        options: { mount: "inside", headrail: "cassette", control: "chain-metal" },
        dimensions: { width: 120, height: 160 },
      },
    },
    {
      productId: "rs-midnight",
      qty: 2,
      config: {
        colorId: "graphite",
        opacityId: "blackout",
        options: { mount: "outside", headrail: "cassette", control: "motorized" },
        dimensions: { width: 180, height: 210 },
      },
    },
  ]);

  const q2 = mkQuote("Q-2026-0002", "Hotel Meridian — Floor 7 refresh", "2026-05-26 14:40:00", "converted", [
    {
      productId: "dp-eclipse",
      qty: 12,
      config: {
        colorId: "flint",
        opacityId: "blackout",
        options: { panels: "pair", fullness: "2.5", header: "ripple-fold", lining: "blackout", control: "cord-drawn" },
        dimensions: { rodWidth: 320, height: 260 },
      },
    },
    {
      productId: "dp-voile",
      qty: 12,
      config: {
        colorId: "white",
        opacityId: "sheer",
        options: { panels: "pair", fullness: "3.0", header: "ripple-fold", lining: "none", control: "hand-drawn" },
        dimensions: { rodWidth: 320, height: 258 },
      },
    },
  ]);

  // order 1: delivered
  const o1 = d
    .prepare(
      "INSERT INTO orders (ref, quoteId, status, supplierOrderNo, trackingNo, carrier, etaDate, createdAt, updatedAt) VALUES (?, ?, 'delivered', 'SZF-88217', 'SF1029384756021', 'SF Express Intl', '2026-06-02', '2026-05-12 10:02:00', '2026-06-02 16:21:00')"
    )
    .run("PO-2026-0001", q1).lastInsertRowid as number;
  const ev = d.prepare(
    "INSERT INTO order_events (orderId, status, note, actor, createdAt) VALUES (?, ?, ?, ?, ?)"
  );
  ev.run(o1, "submitted", "Pre-order PO-2026-0001 submitted. Supplier order file generated and queued for delivery.", "retailer", "2026-05-12 10:02:00");
  ev.run(o1, "acknowledged", "Supplier confirmed order — supplier order no. SZF-88217.", "supplier", "2026-05-13 03:12:00");
  ev.run(o1, "in_production", "Fabric cut and rolling started at Shenzhen facility.", "supplier", "2026-05-15 08:30:00");
  ev.run(o1, "shipped", "Shipment handed to SF Express Intl — tracking SF1029384756021.", "supplier", "2026-05-24 11:05:00");
  ev.run(o1, "in_transit", "Cleared export customs, in linehaul to destination.", "logistics", "2026-05-27 19:44:00");
  ev.run(o1, "delivered", "Delivered and signed for at receiving dock.", "logistics", "2026-06-02 16:21:00");

  // order 2: in production
  const o2 = d
    .prepare(
      "INSERT INTO orders (ref, quoteId, status, supplierOrderNo, trackingNo, carrier, etaDate, createdAt, updatedAt) VALUES (?, ?, 'in_production', 'SZF-88341', NULL, NULL, '2026-06-24', '2026-05-26 15:10:00', '2026-06-01 07:55:00')"
    )
    .run("PO-2026-0002", q2).lastInsertRowid as number;
  ev.run(o2, "submitted", "Pre-order PO-2026-0002 submitted. Supplier order file generated and queued for delivery.", "retailer", "2026-05-26 15:10:00");
  ev.run(o2, "acknowledged", "Supplier confirmed order — supplier order no. SZF-88341. ETA 2026-06-24.", "supplier", "2026-05-27 02:48:00");
  ev.run(o2, "in_production", "Cut-and-sew in progress — 12 of 24 panels complete.", "supplier", "2026-06-01 07:55:00");
}
