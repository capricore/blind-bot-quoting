"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useShippingRecalc } from "./ShippingRecalcContext";
import { Button, cx, LinkButton, Spinner } from "./ui";
import { usd } from "@/lib/format";

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

/**
 * Compact delete for the quotes list/card. Opens a confirmation dialog first. When the quote has
 * been converted to an order, the dialog warns that the order + its status history go too (the API
 * cascades the delete), so the user knows exactly what they're removing.
 */
export function DeleteQuoteListButton({
  quoteId,
  quoteRef,
  converted,
  className,
}: {
  quoteId: number;
  quoteRef: string;
  converted: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={cx("text-xs font-semibold text-muted transition-colors hover:text-red-600", className)}
        title="Delete quote"
      >
        Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 text-left">
          <div className="absolute inset-0 bg-black/30" onClick={() => !busy && setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal className="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
            <h2 className="text-base font-semibold tracking-tight text-ink">Delete quote {quoteRef}?</h2>
            {converted ? (
              <div className="mt-2 space-y-2 text-[13px] text-ink-soft">
                <p>
                  This quote has been <span className="font-semibold">converted to an order</span>. Deleting it will
                  also <span className="font-semibold text-red-600">permanently delete that order and its full
                  status history</span>.
                </p>
                <p>The order will no longer appear on the Orders page. This cannot be undone.</p>
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-ink-soft">
                This permanently deletes the quote and all of its line items. This cannot be undone.
              </p>
            )}
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy} className="py-2">
                Cancel
              </Button>
              <Button variant="danger" onClick={del} busy={busy} className="py-2">
                {busy ? "Deleting…" : converted ? "Delete quote & order" : "Delete quote"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type PayMethod = "bank_transfer" | "stripe" | "paypal";
const PAY_METHODS: { id: PayMethod; label: string; note: string; enabled: boolean }[] = [
  { id: "stripe", label: "Credit / debit card", note: "Secure checkout via Stripe", enabled: true },
  { id: "paypal", label: "PayPal", note: "Pay with your PayPal account", enabled: true },
  { id: "bank_transfer", label: "Bank transfer", note: "We confirm once received", enabled: true },
];

export function SubmitPreOrderButton({
  quoteId,
  total,
  token,
  blockedReason,
}: {
  quoteId: number;
  total: string;
  /** Pay-by-link token — when set, this is the public invoice (no portal session), so we authorize
   *  the submit with the token and stay on the invoice page afterwards instead of the portal order. */
  token?: string;
  /** When set, paying is disabled and this reason is shown (e.g. expedite price still pending). */
  blockedReason?: string;
}) {
  const router = useRouter();
  // Shipping recalculation (e.g. toggling expedite) must finish before paying — otherwise the
  // customer could pay against a stale total.
  const { pending: shippingBusy } = useShippingRecalc();
  const blocked = shippingBusy || !!blockedReason;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PayMethod>("stripe");

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/quotes/${quoteId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "x-invoice-token": token } : {}) },
        body: JSON.stringify({ method }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Submission failed");
      if (data.redirect) {
        window.location.href = data.redirect; // gateway hand-off (Stripe/PayPal)
        return;
      }
      // Bank transfer: no gateway. A public payer can't open the portal order page, so just refresh
      // the invoice (now converted → shows bank details + awaiting status); the owner goes to the
      // full order page as before.
      if (token) router.refresh();
      else router.push(`/orders/${data.order.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div>
        <Button
          variant="primary"
          onClick={() => setOpen(true)}
          disabled={blocked}
          className="w-full py-3"
        >
          {blockedReason ? (
            blockedReason
          ) : shippingBusy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Updating…
            </span>
          ) : (
            "Confirm & pay →"
          )}
        </Button>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brass/40 bg-brass-soft/60 p-4">
      <p className="text-[13px] font-medium text-ink">Pay {total} to place this order</p>
      <div className="mt-3 space-y-2">
        {PAY_METHODS.map((m) => (
          <label
            key={m.id}
            className={cx(
              "flex items-center gap-2 rounded-xl border bg-surface px-3 py-2.5 text-sm",
              method === m.id && m.enabled ? "border-ink" : "border-line",
              m.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"
            )}
          >
            <input type="radio" disabled={!m.enabled} checked={method === m.id} onChange={() => setMethod(m.id)} />
            <span className="flex-1 font-medium text-ink">{m.label}</span>
            <span className="text-[11px] text-muted">{m.note}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={submit} busy={busy} disabled={shippingBusy} className="py-2">
          {busy ? "Placing…" : shippingBusy ? "Updating…" : "Place order"}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy} className="py-2">
          Cancel
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

/**
 * Shown on a draft quote that already has an unpaid pre-order (awaiting_payment). The quote stays a
 * draft until payment lands, so this card replaces "Confirm & pay": go pay the reserved order, or
 * cancel it (releasing stock) to reopen the draft for editing.
 */
export function PendingPaymentCard({ orderId, orderRef }: { orderId: number; orderRef: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not cancel");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-brass/40 bg-brass-soft/60 p-4">
      <p className="text-[13px] font-semibold text-ink">Awaiting payment</p>
      <p className="mt-1 text-[12px] leading-snug text-ink-soft">
        Pre-order <span className="font-mono">{orderRef}</span> is reserved and waiting for payment.
        It stays a draft until payment is received.
      </p>
      <LinkButton href={`/orders/${orderId}`} className="mt-3 w-full justify-center">
        Go to payment →
      </LinkButton>
      {confirming ? (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50/60 p-3">
          <p className="text-[13px] font-medium text-ink">Cancel this pre-order and reopen the draft?</p>
          <p className="mt-1 text-[12px] text-ink-soft">Reserved stock is released and you can edit the quote again.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" onClick={cancel} busy={busy} className="py-2">
              {busy ? "Cancelling…" : "Cancel pre-order"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy} className="py-2">
              Keep
            </Button>
          </div>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="mt-2 w-full rounded-xl border border-line py-2.5 text-sm font-medium text-muted transition-colors hover:border-red-300 hover:text-red-600"
        >
          Cancel &amp; return to draft
        </button>
      )}
      {error && !confirming && <p className="mt-2 text-xs text-red-500">{error}</p>}
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

/**
 * Admin-only per-quote price override link, shown top-right of a line (THE-772). Two targets:
 *  - "line" (full products): sets a flat unit price for the whole line; `standard` (non-null) is the
 *    price it replaced (shown struck) and marks it overridden.
 *  - "motor" (accessories): sets the motor's own BASE unit price; sub-parts are priced per row, the
 *    line total stays auto-computed. `overridden` marks it active (no struck "was" price here).
 * Posts `unitPriceOverride` (line) or `componentPrices.motor` (motor) — number to set, null to clear.
 */
export function LinePriceEditor({
  itemId,
  unitPrice,
  standard = null,
  overridden: overriddenProp = false,
  target = "line",
}: {
  itemId: number;
  unitPrice: number;
  standard?: number | null;
  overridden?: boolean;
  target?: "line" | "motor";
}) {
  const router = useRouter();
  const { setPending } = useShippingRecalc();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(unitPrice));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overridden = target === "motor" ? overriddenProp : standard !== null;

  const save = async (override: number | null) => {
    setBusy(true);
    setPending(true);
    setError(null);
    try {
      const r = await fetch("/api/quote-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          target === "motor" ? { itemId, componentPrices: { motor: override } } : { itemId, unitPriceOverride: override }
        ),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not update price");
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setPending(false);
    }
  };

  if (open) {
    return (
      <div className="mt-1.5 flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-20 rounded-md border border-line bg-surface px-2 py-1 text-right text-sm tabular-nums text-ink outline-none focus:border-ink"
          />
          <button
            onClick={() => save(value.trim() === "" ? null : Number(value))}
            disabled={busy}
            className="rounded-md bg-ink px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : "Save"}
          </button>
          <button onClick={() => { setOpen(false); setError(null); }} disabled={busy} className="px-1 text-xs text-muted hover:underline">
            Cancel
          </button>
        </div>
        {error && <span className="text-[11px] text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center justify-end gap-2 text-[11px]">
      {standard !== null && (
        <span className="text-muted">
          standard <span className="line-through">{usd(standard)}</span>
        </span>
      )}
      <button
        onClick={() => { setValue(String(unitPrice)); setOpen(true); }}
        className="font-medium text-brass hover:underline"
      >
        {overridden ? "Edit price" : "Custom price"}
      </button>
      {overridden && (
        <button onClick={() => save(null)} disabled={busy} className="font-medium text-muted hover:text-red-500">
          Reset
        </button>
      )}
    </div>
  );
}

/**
 * Admin-only "+ Add charge / discount" — adds an ad-hoc money line to a quote. Positive amount = a
 * surcharge, negative = a discount. Not a catalog product (no stock / no manufacturing).
 */
export function AddAdjustmentButton({ quoteId }: { quoteId: number }) {
  const router = useRouter();
  const { setPending } = useShippingRecalc();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setLabel(""); setAmount(""); setError(null); };

  const save = async () => {
    setBusy(true);
    setPending(true);
    setError(null);
    try {
      const r = await fetch("/api/quote-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, adjustment: { label: label.trim(), amount: Number(amount) } }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not add line");
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setPending(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-[#faf9f5]"
      >
        + Add charge / discount
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Rush handling)"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-ink"
        />
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">$</span>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-28 rounded-md border border-line bg-surface px-2.5 py-1.5 text-right text-sm tabular-nums text-ink outline-none focus:border-ink"
          />
        </div>
        <button onClick={save} disabled={busy} className="rounded-md bg-ink px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "…" : "Add"}
        </button>
        <button onClick={() => { setOpen(false); reset(); }} disabled={busy} className="px-1 text-sm text-muted hover:underline">
          Cancel
        </button>
      </div>
      <p className="text-[11px] text-muted">Use a negative amount for a discount (e.g. −50).</p>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  );
}
