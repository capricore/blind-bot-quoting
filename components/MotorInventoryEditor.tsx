"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "./Toast";
import { Button, Card, Spinner } from "./ui";

export type InventoryRow = { modelId: string; name: string; sku: string; category: string; stock: number | null };

// Shared grid + the Save button's width, so the "Save all" header sits directly above the column.
const GRID = "grid grid-cols-[1fr_140px_120px] gap-3 px-5";
const W_SAVE = "w-20";

const post = async (body: unknown) => {
  const r = await fetch("/api/motors/inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed");
};

/** The stock a row's input currently means: trimmed-empty = untracked (null), else the number. */
const desired = (raw: string): number | null => {
  const t = raw.trim();
  return t === "" ? null : Number(t);
};

/** Admin: set/adjust each orderable motor's stock. No value = untracked (unlimited). */
export function MotorInventoryEditor({ rows }: { rows: InventoryRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // Edited values live here (not in each Row) so "Save all" can submit them together.
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.modelId, r.stock === null ? "" : String(r.stock)]))
  );
  const setValue = (modelId: string, v: string) => setValues((prev) => ({ ...prev, [modelId]: v }));

  // The stored stock each row is diffed against. Seeded from props, updated optimistically on save
  // so the button settles straight to "nothing to save" without a flash of the enabled state while
  // router.refresh() round-trips. Re-synced (during render) whenever the server sends fresh rows —
  // e.g. after a per-row save — so the header reflects the new stored values.
  const seed = () => Object.fromEntries(rows.map((r) => [r.modelId, r.stock]));
  const [baseline, setBaseline] = useState<Record<string, number | null>>(seed);
  const [seenRows, setSeenRows] = useState(rows);
  if (seenRows !== rows) {
    setSeenRows(rows);
    setBaseline(seed());
  }

  // A row is "changed" when its (valid) input differs from the stock currently stored.
  const changed = rows.filter((r) => {
    const d = desired(values[r.modelId] ?? "");
    if (d !== null && (!Number.isFinite(d) || d < 0)) return false; // invalid → not savable
    return d !== (baseline[r.modelId] ?? null);
  });
  const canSave = !busy && changed.length > 0;

  const saveAll = async () => {
    if (changed.length === 0) return;
    setBusy(true);
    try {
      await post({ entries: changed.map((r) => ({ modelId: r.modelId, stock: desired(values[r.modelId] ?? "") })) });
      // Re-baseline what we just persisted → changed drops to 0 immediately (no enabled flash).
      setBaseline((b) => {
        const next = { ...b };
        for (const r of changed) next[r.modelId] = desired(values[r.modelId] ?? "");
        return next;
      });
      toast(`Saved ${changed.length} item${changed.length === 1 ? "" : "s"}`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div
        className={`${GRID} items-center border-b border-line bg-[#fafaf7] py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted`}
      >
        <span>Motor</span>
        <span>Stock</span>
        <div className="flex justify-end">
          <button
            onClick={saveAll}
            disabled={!canSave}
            className={`${W_SAVE} text-center normal-case ${
              busy ? "text-brass" : canSave ? "text-brass hover:underline" : "cursor-default text-muted opacity-50"
            }`}
          >
            {busy ? (
              <span className="inline-flex items-center justify-center gap-1.5">
                <Spinner /> Saving…
              </span>
            ) : changed.length > 0 ? (
              `Save all (${changed.length})`
            ) : (
              "Save all"
            )}
          </button>
        </div>
      </div>
      <ul className="divide-y divide-line/70">
        {rows.map((r) => (
          <Row key={r.modelId} row={r} value={values[r.modelId] ?? ""} onChange={(v) => setValue(r.modelId, v)} />
        ))}
      </ul>
    </Card>
  );
}

function Row({ row, value, onChange }: { row: InventoryRow; value: string; onChange: (v: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await post(value.trim() === "" ? { modelId: row.modelId, clear: true } : { modelId: row.modelId, stock: Number(value) });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`${GRID} items-center py-3`}>
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold text-ink">{row.name}</div>
        <div className="truncate text-[11px] text-muted">
          {row.category} · <span className="font-mono">{row.sku}</span>
        </div>
      </div>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="untracked"
        className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-ink"
      />
      <div className="flex items-center justify-end">
        <Button variant="primary" busy={busy} className={`${W_SAVE} shrink-0 py-1.5 text-[12px]`} onClick={save}>
          Save
        </Button>
      </div>
      {error && <span className="col-span-3 text-[11px] text-red-500">{error}</span>}
    </li>
  );
}
