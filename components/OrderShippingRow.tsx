"use client";

import { useState } from "react";
import { usd } from "@/lib/format";
import { cx } from "./ui";

export type ShipRow = { name: string; qty: number; unit: number; total: number };

/**
 * The "Shipping" line in an order footer, with a click-to-expand per-item breakdown (default
 * collapsed). Read-only — the order is already placed; this just discloses how the snapshot
 * shipping was made up. `valueText` is the right-hand amount (pre-formatted on the server).
 */
export function OrderShippingRow({
  ground,
  expedite,
  valueText,
  lines,
}: {
  ground: boolean;
  expedite: boolean;
  valueText: string;
  lines: ShipRow[];
}) {
  const [open, setOpen] = useState(false);
  const canExpand = lines.length > 0;

  return (
    <>
      <div className="flex justify-between text-muted">
        <button
          type="button"
          disabled={!canExpand}
          onClick={() => setOpen((v) => !v)}
          className={cx("inline-flex items-center gap-1", canExpand && "hover:text-ink")}
        >
          Shipping
          {ground && <span className="ml-1 text-muted/80">· {expedite ? "Expedite" : "Ground"}</span>}
          {canExpand && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cx("size-4 transition-transform", open && "rotate-180")}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </button>
        <span className="tabular-nums">{valueText}</span>
      </div>

      {open && canExpand && (
        <div className="space-y-1 rounded-md bg-[#f2f0e8] px-2.5 py-2 text-[11.5px] text-muted">
          {lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span className="min-w-0 break-words">
                {l.name} <span className="text-muted/70">· {l.qty} × {usd(l.unit)}</span>
              </span>
              <span className="shrink-0 tabular-nums">{usd(l.total)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
