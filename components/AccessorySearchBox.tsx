"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BASE = "/catalog/accessories";

/**
 * Free-text name/SKU search for the accessory catalog, rendered in the models-column header.
 * Debounced so typing is snappy; preserves the other active params (category, filters, moq, quote).
 */
export function AccessorySearchBox({ q, baseParams }: { q: string; baseParams: Record<string, string> }) {
  const router = useRouter();
  const [text, setText] = useState(q);
  const [seenQ, setSeenQ] = useState(q);
  if (seenQ !== q) {
    setSeenQ(q);
    setText(q);
  }

  useEffect(() => {
    if (text.trim() === q) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams(baseParams);
      if (text.trim()) p.set("q", text.trim());
      const qs = p.toString();
      router.replace(qs ? `${BASE}?${qs}` : BASE);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <input
      type="search"
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="Search by name or SKU…"
      className="w-56 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] normal-case tracking-normal text-ink outline-none focus:border-ink"
    />
  );
}
