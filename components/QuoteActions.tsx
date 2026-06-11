"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cx } from "./ui";

export function SubmitPreOrderButton({ quoteId, total }: { quoteId: number; total: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/quotes/${quoteId}/submit`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Submission failed");
      router.push(`/orders/${data.order.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div>
      {confirming ? (
        <div className="rounded-xl border border-brass/40 bg-brass-soft/60 p-4">
          <p className="text-[13px] font-medium text-ink">
            Place pre-order for {total}? The supplier order file will be generated and the order enters the
            fulfillment pipeline.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={submit}
              disabled={busy}
              className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2a3756] disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Confirm pre-order"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft hover:bg-[#faf9f5]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2a3756] hover:shadow"
        >
          Submit pre-order →
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function RemoveItemButton({ itemId, className }: { itemId: number; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      onClick={async () => {
        setBusy(true);
        await fetch("/api/quote-items", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId }),
        });
        router.refresh();
      }}
      disabled={busy}
      className={cx("text-xs font-medium text-muted transition-colors hover:text-red-500", className)}
      title="Remove line"
    >
      {busy ? "…" : "Remove"}
    </button>
  );
}
