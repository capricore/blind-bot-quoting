"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActingAs } from "@/lib/auth/acting-as-actions";

export type RetailerOption = { id: string; email: string; company: string | null };

/**
 * Admin-only "act-on-behalf-of" switcher, rendered inside the sidebar nav. Picking a retailer
 * enters their context — quotes/pre-orders built afterwards are owned by that retailer. The
 * control turns amber while acting so the context stays unmistakable without cluttering the page.
 *
 * Custom dropdown (not a native <select>) so the menu can be height-capped + scrollable + searchable
 * — the retailer list is long and a native popup would fill the whole screen.
 */
export function ActingAsSwitcher({
  retailers,
  actingAsId,
}: {
  retailers: RetailerOption[];
  actingAsId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const acting = !!actingAsId && retailers.some((r) => r.id === actingAsId);
  const current = retailers.find((r) => r.id === actingAsId);
  const buttonLabel = current ? current.email : retailers.length ? "Order for myself" : "No retailers";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? retailers.filter((r) => r.email.toLowerCase().includes(q)) : retailers;
  }, [retailers, query]);

  const apply = (id: string | null) => {
    setOpen(false);
    setQuery("");
    startTransition(async () => {
      await setActingAs(id);
      router.refresh();
    });
  };

  return (
    <div className="relative px-3 py-3">
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        <span className={`size-1.5 rounded-full ${acting ? "bg-amber-400" : "bg-white/20"}`} />
        Acting as
      </div>

      <button
        type="button"
        disabled={pending || retailers.length === 0}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left text-[12.5px] transition-colors disabled:opacity-60 ${
          acting
            ? "border-amber-400/60 bg-amber-400/15 text-amber-100"
            : "border-white/10 bg-white/[0.04] text-white/80"
        }`}
      >
        <span className="truncate">{buttonLabel}</span>
        <span className="shrink-0 text-[10px] opacity-60">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          {/* click-away */}
          <button type="button" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <div className="absolute bottom-full left-3 right-3 z-50 mb-1 overflow-hidden rounded-lg border border-line bg-surface shadow-xl">
            <div className="border-b border-line p-1.5">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search email…"
                className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-ink"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto py-1 text-[12.5px] text-ink">
              {!query && (
                <li>
                  <Row selected={!actingAsId} onClick={() => apply(null)}>
                    Order for myself
                  </Row>
                </li>
              )}
              {filtered.map((r) => (
                <li key={r.id}>
                  <Row selected={r.id === actingAsId} onClick={() => apply(r.id)}>
                    {r.email}
                  </Row>
                </li>
              ))}
              {filtered.length === 0 && <li className="px-3 py-2 text-muted">No matches</li>}
            </ul>
          </div>
        </>
      )}

      {acting && (
        <button
          type="button"
          disabled={pending}
          onClick={() => apply(null)}
          className="mt-1.5 px-1 text-[11px] font-medium text-amber-300/90 transition-colors hover:text-amber-200 disabled:opacity-60"
        >
          Exit acting mode
        </button>
      )}
    </div>
  );
}

function Row({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left transition-colors hover:bg-[#faf9f5] ${
        selected ? "font-semibold text-ink" : "text-ink-soft"
      }`}
    >
      <span className="w-3 shrink-0 text-brass">{selected ? "✓" : ""}</span>
      <span className="truncate">{children}</span>
    </button>
  );
}
