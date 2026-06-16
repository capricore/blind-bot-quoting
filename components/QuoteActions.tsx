"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, cx } from "./ui";

export function DeleteDraftButton({ quoteId }: { quoteId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const del = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/quotes/${quoteId}`, { method: "DELETE" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not delete");
      }
      router.push("/quotes");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (confirming) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
        <p className="text-[13px] font-medium text-ink">Delete this draft and all its items?</p>
        <div className="mt-3 flex gap-2">
          <Button variant="danger" onClick={del} busy={busy} className="py-2">
            {busy ? "Deleting…" : "Delete draft"}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy} className="py-2">
            Cancel
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full rounded-xl border border-line py-2.5 text-sm font-medium text-muted transition-colors hover:border-red-300 hover:text-red-600"
    >
      Delete draft
    </button>
  );
}

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
            <Button variant="primary" onClick={submit} busy={busy} className="py-2">
              {busy ? "Submitting…" : "Confirm pre-order"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy} className="py-2">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="primary" onClick={() => setConfirming(true)} className="w-full py-3">
          Submit pre-order →
        </Button>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function RemoveItemButton({ itemId, className }: { itemId: number; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/quote-items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!r.ok) throw new Error();
      router.refresh();
    } catch {
      // surface failure by re-enabling the button so the user can retry
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={remove}
      disabled={busy}
      className={cx("text-xs font-medium text-muted transition-colors hover:text-red-500", className)}
      title="Remove line"
    >
      {busy ? "…" : "Remove"}
    </button>
  );
}
