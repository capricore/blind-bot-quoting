"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AttributeWithValues } from "@/lib/db";
import { Button, Card, cx } from "./ui";

export type TaggableModel = { id: string; name: string; sku: string; categoryName: string; moq: number };

/** Admin per-model tag assignment for orderable motor models. */
export function ModelTagEditor({
  models,
  attributes,
  tagMap,
}: {
  models: TaggableModel[];
  attributes: AttributeWithValues[];
  tagMap: Record<string, string[]>;
}) {
  if (attributes.length === 0) {
    return (
      <Card className="px-5 py-6 text-center text-sm text-muted">
        Define attributes above first, then assign their values to each motor here.
      </Card>
    );
  }
  // Version key over all current value ids — when attributes/values change (add/delete),
  // it changes, remounting every row so each re-seeds from fresh data (no stale value ids).
  const valuesKey = attributes.flatMap((a) => a.values.map((v) => v.id)).join(",");
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line/70">
        {models.map((model) => (
          <ModelRow
            key={`${model.id}|${valuesKey}`}
            model={model}
            attributes={attributes}
            initial={tagMap[model.id] ?? []}
          />
        ))}
      </ul>
    </Card>
  );
}

function ModelRow({
  model,
  attributes,
  initial,
}: {
  model: TaggableModel;
  attributes: AttributeWithValues[];
  initial: string[];
}) {
  const router = useRouter();
  // Baselines for dirty-tracking. Updated optimistically on a successful save so the button
  // settles straight into "Saved" without a flash of the enabled state while router.refresh()
  // round-trips.
  const [baseTags, setBaseTags] = useState<Set<string>>(() => new Set(initial));
  const [baseMoq, setBaseMoq] = useState(model.moq);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial));
  const [moqOn, setMoqOn] = useState(model.moq > 0);
  const [moqText, setMoqText] = useState(model.moq > 0 ? String(model.moq) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The MOQ to persist: 0 when the toggle is off, else the entered value (min 1).
  const moqValue = moqOn ? Math.max(1, Math.round(Number(moqText) || 1)) : 0;

  const tagsDirty = useMemo(() => {
    if (selected.size !== baseTags.size) return true;
    for (const id of selected) if (!baseTags.has(id)) return true;
    return false;
  }, [selected, baseTags]);
  const dirty = tagsDirty || moqValue !== baseMoq;

  const toggle = (attr: AttributeWithValues, valueId: string) => {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(valueId)) {
        next.delete(valueId);
      } else {
        if (!attr.multi) for (const v of attr.values) next.delete(v.id); // single → clear siblings
        next.add(valueId);
      }
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tags/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: model.id, valueIds: [...selected], moq: moqValue }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      // Re-baseline to what we just persisted → dirty flips false immediately (no enabled flash).
      setBaseTags(new Set(selected));
      setBaseMoq(moqValue);
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="px-5 py-4">
      <div className="flex items-center gap-2">
        <span className="text-[13.5px] font-semibold text-ink">{model.name}</span>
        <span className="rounded bg-[#f1efe9] px-1.5 py-0.5 font-mono text-[10.5px] text-ink-soft">{model.sku}</span>
        <span className="text-[11px] text-muted">{model.categoryName}</span>
        <div className="ml-auto flex items-center gap-2">
          {saved && !dirty && !busy && <span className="text-[11px] font-medium text-emerald-600">Saved ✓</span>}
          <Button variant="primary" onClick={save} disabled={busy || !dirty} className="py-1.5 text-[12px]">
            {busy ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Saving…
              </span>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {/* Minimum order quantity — toggle on to require a minimum, then set the count. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-40 shrink-0 text-[11.5px] font-medium uppercase tracking-wide text-muted">Min order qty</span>
          <button
            type="button"
            role="switch"
            aria-checked={moqOn}
            onClick={() => { setSaved(false); setMoqOn((v) => { if (!v && !moqText) setMoqText("1"); return !v; }); }}
            className={cx(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              moqOn ? "bg-ink" : "bg-line"
            )}
          >
            <span className={cx("absolute top-0.5 size-4 rounded-full bg-white transition-all", moqOn ? "left-[18px]" : "left-0.5")} />
          </button>
          {moqOn ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                step={1}
                value={moqText}
                onChange={(e) => { setSaved(false); setMoqText(e.target.value); }}
                className="w-20 rounded-lg border border-line bg-surface px-2.5 py-1 text-[12px] text-ink outline-none focus:border-ink"
              />
              <span className="text-[11.5px] text-muted">units minimum</span>
            </div>
          ) : (
            <span className="text-[11.5px] text-muted/70">No minimum</span>
          )}
        </div>
        {attributes.map((attr) => (
          <div key={attr.id} className="flex flex-wrap items-center gap-1.5">
            <span className="w-40 shrink-0 text-[11.5px] font-medium uppercase tracking-wide text-muted">
              {attr.name}
            </span>
            {attr.values.length === 0 && <span className="text-[11.5px] text-muted/70">— no values</span>}
            {attr.values.map((v) => {
              const on = selected.has(v.id);
              return (
                <button
                  key={v.id}
                  onClick={() => toggle(attr, v.id)}
                  className={cx(
                    "rounded-lg px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset transition-colors",
                    on
                      ? "bg-ink text-white ring-ink"
                      : "bg-surface text-ink-soft ring-line hover:bg-[#faf9f5]"
                  )}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </li>
  );
}
