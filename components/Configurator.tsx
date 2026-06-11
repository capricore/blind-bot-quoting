"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OPACITY_LABELS, TIER_LABELS } from "@/lib/catalog-data";
import { usd } from "@/lib/format";
import type {
  ItemConfig,
  OpacityId,
  Product,
  ProductLine,
  QuoteComputation,
} from "@/lib/types";
import { DraperyScene, RollerShadeScene } from "./renders";
import { Badge, Card, cx } from "./ui";

const DEFAULT_DIMS: Record<string, Record<string, number>> = {
  "roller-shade": { width: 150, height: 180 },
  drapery: { rodWidth: 280, height: 250 },
};

export default function Configurator({
  product,
  line,
  pricingVersion,
  leadTimeDays,
}: {
  product: Product;
  line: ProductLine;
  pricingVersion: string;
  leadTimeDays: number;
}) {
  const router = useRouter();

  const [colorId, setColorId] = useState(product.colors[0].id);
  const [opacityId, setOpacityId] = useState<OpacityId>(product.validOpacities[0]);
  const [options, setOptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(line.optionGroups.map((g) => [g.key, g.options[0].id]))
  );
  const [dims, setDims] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      line.dimensionFields.map((f) => [f.key, String(DEFAULT_DIMS[line.id]?.[f.key] ?? f.min)])
    )
  );
  const [qty, setQty] = useState(1);
  const [preview, setPreview] = useState(0.65);

  const [computation, setComputation] = useState<QuoteComputation | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [pricePending, setPricePending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<{ quoteRef: string } | null>(null);

  const color = product.colors.find((c) => c.id === colorId) ?? product.colors[0];

  const dimErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    for (const f of line.dimensionFields) {
      const v = parseFloat(dims[f.key]);
      if (Number.isNaN(v)) errs[f.key] = "Required";
      else if (v < f.min || v > f.max) errs[f.key] = `${f.min}–${f.max} ${f.unit}`;
    }
    return errs;
  }, [dims, line.dimensionFields]);

  const config: ItemConfig = useMemo(
    () => ({
      colorId,
      opacityId,
      options,
      dimensions: Object.fromEntries(
        Object.entries(dims).map(([k, v]) => [k, parseFloat(v)])
      ),
    }),
    [colorId, opacityId, options, dims]
  );

  // ---- backend auto-quote, debounced ----
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchPrice = useCallback(() => {
    if (Object.keys(dimErrors).length > 0) {
      setComputation(null);
      setPriceError(null);
      return;
    }
    setPricePending(true);
    fetch("/api/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, config }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Pricing failed");
        setComputation(data.computation);
        setPriceError(null);
      })
      .catch((e: Error) => {
        setComputation(null);
        setPriceError(e.message);
      })
      .finally(() => setPricePending(false));
  }, [config, dimErrors, product.id]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fetchPrice, 280);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fetchPrice]);

  // reset "added" confirmation whenever the configuration changes
  useEffect(() => setAdded(null), [config, qty]);

  const addToQuote = async () => {
    if (!computation) return;
    setAdding(true);
    try {
      const r = await fetch("/api/quote-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, config, qty }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Could not add to quote");
      setAdded({ quoteRef: data.quoteRef });
      router.refresh();
    } catch (e) {
      setPriceError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const dimsNum = config.dimensions;
  const isRoller = line.id === "roller-shade";

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ---------- left: render ---------- */}
      <div className="lg:col-span-3">
        <Card className="overflow-hidden">
          <div className="relative aspect-[4/3]">
            {isRoller ? (
              <RollerShadeScene
                color={color}
                patternStyle={product.patternStyle}
                opacityId={opacityId}
                widthCm={dimsNum.width || 150}
                heightCm={dimsNum.height || 180}
                mount={options.mount}
                headrail={options.headrail}
                control={options.control}
                drop={preview}
              />
            ) : (
              <DraperyScene
                color={color}
                patternStyle={product.patternStyle}
                opacityId={opacityId}
                rodWidthCm={dimsNum.rodWidth || 280}
                heightCm={dimsNum.height || 250}
                panels={options.panels}
                fullness={options.fullness}
                header={options.header}
                openAmount={1 - preview}
              />
            )}
            <div className="absolute left-4 top-4 rounded-lg bg-white/85 px-2.5 py-1 text-[11px] font-medium text-ink-soft shadow-sm backdrop-blur">
              In-context render · updates live
            </div>
          </div>
          <div className="flex items-center gap-4 border-t border-line px-5 py-3.5">
            <span className="text-xs font-medium text-muted">
              {isRoller ? "Preview: shade position" : "Preview: panels drawn"}
            </span>
            <input
              type="range"
              min="0.12"
              max="1"
              step="0.01"
              value={preview}
              onChange={(e) => setPreview(parseFloat(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-[#b08d57]"
            />
          </div>
        </Card>

        {/* breakdown */}
        <Card className="mt-5 px-5 py-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Quote breakdown</h3>
            <Badge tone="slate">pricing v{pricingVersion}</Badge>
          </div>
          {computation ? (
            <div className="mt-3">
              <table className="w-full text-[13px]">
                <tbody>
                  {computation.lines.map((l, i) => (
                    <tr key={i} className="border-b border-line/60 last:border-0">
                      <td className="py-2 pr-2 font-medium text-ink-soft">{l.label}</td>
                      <td className="py-2 pr-2 text-xs text-muted">{l.detail}</td>
                      <td className="py-2 text-right font-medium tabular-nums text-ink">{usd(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap gap-2">
                {computation.facts.map((f) => (
                  <span key={f.label} className="rounded-lg bg-[#f1efe9] px-2.5 py-1 text-[11.5px] text-ink-soft">
                    <span className="font-medium">{f.label}:</span> {f.value}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              {priceError ?? "Enter valid dimensions to price this configuration."}
            </p>
          )}
        </Card>
      </div>

      {/* ---------- right: configuration ---------- */}
      <div className="lg:col-span-2">
        <div className="sticky top-8 space-y-5">
          <Card className="px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-ink">{product.name}</h1>
                <div className="mt-0.5 text-xs text-muted">
                  {line.name} · {product.sku} · {TIER_LABELS[product.tier]} tier
                </div>
              </div>
              <Badge tone="brass">~{leadTimeDays}d lead</Badge>
            </div>

            {/* color */}
            <div className="mt-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Color — {color.name}
              </div>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setColorId(c.id)}
                    title={c.name}
                    className={cx(
                      "size-9 rounded-full border-2 transition-all",
                      c.id === colorId
                        ? "scale-110 border-ink shadow-md"
                        : "border-white shadow-sm hover:scale-105"
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            {/* opacity — the constrained variation */}
            <div className="mt-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Opacity</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(OPACITY_LABELS) as OpacityId[]).map((o) => {
                  const valid = product.validOpacities.includes(o);
                  return (
                    <button
                      key={o}
                      disabled={!valid}
                      onClick={() => setOpacityId(o)}
                      className={cx(
                        "rounded-xl border px-3 py-2 text-left text-[12.5px] font-medium transition-all",
                        o === opacityId && valid
                          ? "border-ink bg-ink text-white shadow-sm"
                          : valid
                            ? "border-line bg-surface text-ink-soft hover:border-[#cfcabd]"
                            : "cursor-not-allowed border-dashed border-line bg-transparent text-muted/50 line-through"
                      )}
                      title={valid ? undefined : `Not producible for ${product.name}`}
                    >
                      {OPACITY_LABELS[o]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                Greyed options aren&apos;t producible for this pattern — validated against the supply chain.
              </p>
            </div>

            {/* option groups */}
            {line.optionGroups.map((g) => (
              <div key={g.key} className="mt-5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {g.options.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setOptions((prev) => ({ ...prev, [g.key]: o.id }))}
                      title={o.hint}
                      className={cx(
                        "rounded-xl border px-3 py-1.5 text-[12.5px] font-medium transition-all",
                        options[g.key] === o.id
                          ? "border-ink bg-ink text-white shadow-sm"
                          : "border-line bg-surface text-ink-soft hover:border-[#cfcabd]"
                      )}
                    >
                      {o.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* dimensions */}
            <div className="mt-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Dimensions</div>
              <div className="grid grid-cols-2 gap-3">
                {line.dimensionFields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-[12px] font-medium text-ink-soft">{f.label}</span>
                    <div
                      className={cx(
                        "mt-1 flex items-center rounded-xl border bg-surface px-3 py-2 transition-colors focus-within:border-ink",
                        dimErrors[f.key] ? "border-red-300" : "border-line"
                      )}
                    >
                      <input
                        type="number"
                        value={dims[f.key]}
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        onChange={(e) => setDims((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        className="w-full bg-transparent text-sm font-medium text-ink outline-none"
                      />
                      <span className="ml-1 text-xs text-muted">{f.unit}</span>
                    </div>
                    <span className={cx("mt-0.5 block text-[10.5px]", dimErrors[f.key] ? "text-red-500" : "text-muted")}>
                      {dimErrors[f.key] ?? f.help ?? `${f.min}–${f.max} ${f.unit}`}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </Card>

          {/* price + add */}
          <Card className="px-5 py-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted">Unit price · FOB</div>
                <div className={cx("mt-1 text-3xl font-semibold tracking-tight text-ink", pricePending && "opacity-40")}>
                  {computation ? usd(computation.unitPrice) : "—"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted">Qty</span>
                <div className="flex items-center rounded-xl border border-line">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="px-3 py-1.5 text-ink-soft hover:text-ink"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(500, q + 1))}
                    className="px-3 py-1.5 text-ink-soft hover:text-ink"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            {computation && qty > 1 && (
              <div className="mt-1 text-xs text-muted">
                Line total <span className="font-semibold text-ink">{usd(computation.unitPrice * qty)}</span>
              </div>
            )}
            {priceError && computation === null && (
              <p className="mt-2 text-xs text-red-500">{priceError}</p>
            )}

            <button
              onClick={addToQuote}
              disabled={!computation || adding}
              className={cx(
                "mt-4 w-full rounded-xl py-3 text-sm font-semibold transition-all",
                computation && !adding
                  ? "bg-ink text-white shadow-sm hover:bg-[#2a3756] hover:shadow"
                  : "cursor-not-allowed bg-[#e9e6dd] text-muted"
              )}
            >
              {adding ? "Adding…" : added ? "✓ Added — add another" : "Add to quote"}
            </button>
            {added && (
              <a href="/quotes" className="mt-2 block text-center text-xs font-medium text-brass hover:underline">
                Added to {added.quoteRef} — review quote →
              </a>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
