"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { QuoteDetails } from "@/lib/types";
import { Button } from "./ui";

type Props =
  | { mode: "create" }
  | { mode: "edit"; quoteId: number; initial: QuoteDetails };

/**
 * Create / edit a quote's header details — the order-critical fields distilled from the
 * HD Brite create-quote flow: customer, project, ship-to address, PO, Sidemark.
 */
export function QuoteDetailsDrawer(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<QuoteDetails>(props.mode === "edit" ? props.initial : {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof QuoteDetails) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setD((p) => ({ ...p, [k]: e.target.value }));
  const v = (k: keyof QuoteDetails) => (d[k] as string | null | undefined) ?? "";

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (props.mode === "create") {
        const r = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(d),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Could not create quote");
        router.push(`/quotes/${data.quote.id}`);
        router.refresh();
      } else {
        const r = await fetch(`/api/quotes/${props.quoteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(d),
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error ?? "Could not save");
        }
        setOpen(false);
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      {props.mode === "create" ? (
        <Button variant="primary" onClick={() => setOpen(true)} className="py-2.5">
          Create New Quote
        </Button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="text-[12.5px] font-medium text-brass transition-colors hover:underline"
        >
          Edit details
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => !busy && setOpen(false)}
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                {props.mode === "create" ? "Create new quote" : "Edit quote details"}
              </h2>
              <button
                onClick={() => !busy && setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1 text-muted transition-colors hover:bg-[#f1efe9] hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <Section title="References">
                <Field label="Sidemark" hint="Job/room label printed on the supplier order">
                  <input className={INPUT} value={v("sidemark")} onChange={set("sidemark")} placeholder="e.g. Master Bedroom" />
                </Field>
                <Field label="PO reference">
                  <input className={INPUT} value={v("po")} onChange={set("po")} placeholder="Your purchase-order #" />
                </Field>
              </Section>

              <Section title="Customer">
                <Field label="Name">
                  <input className={INPUT} value={v("customerName")} onChange={set("customerName")} placeholder="Customer name" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone">
                    <input className={INPUT} value={v("customerPhone")} onChange={set("customerPhone")} placeholder="+1 000 000 0000" />
                  </Field>
                  <Field label="Email">
                    <input className={INPUT} value={v("customerEmail")} onChange={set("customerEmail")} placeholder="name@email.com" />
                  </Field>
                </div>
                <Field label="Project name">
                  <input className={INPUT} value={v("projectName")} onChange={set("projectName")} placeholder="e.g. Maple St. — Unit 4B" />
                </Field>
              </Section>

              <Section title="Ship to">
                <Field label="Address line 1">
                  <input className={INPUT} value={v("shipAddress1")} onChange={set("shipAddress1")} placeholder="Street address" />
                </Field>
                <Field label="Address line 2">
                  <input className={INPUT} value={v("shipAddress2")} onChange={set("shipAddress2")} placeholder="Apartment, suite, building… (optional)" />
                </Field>
                <div className="grid grid-cols-[1fr_90px_110px] gap-3">
                  <Field label="City">
                    <input className={INPUT} value={v("shipCity")} onChange={set("shipCity")} placeholder="City" />
                  </Field>
                  <Field label="State">
                    <input className={INPUT} value={v("shipState")} onChange={set("shipState")} placeholder="State" />
                  </Field>
                  <Field label="ZIP">
                    <input className={INPUT} value={v("shipZip")} onChange={set("shipZip")} placeholder="ZIP" />
                  </Field>
                </div>
              </Section>
            </div>

            <div className="border-t border-line px-6 py-4">
              {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
              <Button variant="primary" onClick={save} busy={busy} className="w-full py-2.5">
                {props.mode === "create" ? "Create quote" : "Save changes"}
              </Button>
              {props.mode === "create" && (
                <p className="mt-2 text-center text-[11px] text-muted">
                  All fields optional — you can add them later. Add products from the catalog next.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-ink";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}
