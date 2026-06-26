"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "./ui";

type Retailer = { id: string; email: string; company: string | null };

/** Searchable, two-up grid of retailers on the Pricing tab — picking one opens its overrides. */
export function RetailerPricingList({ retailers }: { retailers: Retailer[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return retailers;
    return retailers.filter(
      (r) => (r.company ?? "").toLowerCase().includes(s) || r.email.toLowerCase().includes(s)
    );
  }, [retailers, q]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Retailers</span>
        {retailers.length > 0 && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company or email…"
            className="w-56 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-ink"
          />
        )}
      </div>

      {retailers.length === 0 ? (
        <div className="px-1 pt-2 text-[13px] text-muted">No retailer accounts yet.</div>
      ) : filtered.length === 0 ? (
        <div className="px-1 pt-3 text-[13px] text-muted">No retailers match “{q}”.</div>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {filtered.map((r) => (
            <Link key={r.id} href={`/motors?tab=pricing&retailer=${r.id}`} className="block">
              <Card className="flex items-center justify-between gap-2 px-5 py-4 transition-colors hover:bg-[#faf9f5]">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-ink">{r.company ?? r.email}</div>
                  <div className="truncate text-[12px] text-muted">{r.email}</div>
                </div>
                <span className="shrink-0 text-brass">→</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
