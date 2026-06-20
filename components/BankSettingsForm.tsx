"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BankInfo } from "@/lib/db";
import { Button, Card, cx } from "./ui";

const INPUT = "rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink outline-none focus:border-ink";
const FIELDS: { key: keyof BankInfo; label: string; area?: boolean }[] = [
  { key: "bankName", label: "Bank name" },
  { key: "accountName", label: "Account holder" },
  { key: "accountNumber", label: "Account number" },
  { key: "routingNumber", label: "Routing / ABA" },
  { key: "swift", label: "SWIFT / BIC" },
  { key: "instructions", label: "Notes / instructions for the retailer", area: true },
];

export function BankSettingsForm({ initial }: { initial: BankInfo }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch("/api/settings/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Save failed");
      setMsg("Saved.");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-xl space-y-3 p-5">
      {FIELDS.map((f) => (
        <label key={f.key} className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{f.label}</span>
          {f.area ? (
            <textarea
              value={form[f.key]}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              rows={3}
              className={cx(INPUT, "w-full resize-none")}
            />
          ) : (
            <input
              value={form[f.key]}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              className={cx(INPUT, "w-full")}
            />
          )}
        </label>
      ))}
      <div className="flex items-center gap-3 pt-1">
        <Button variant="primary" busy={busy} onClick={save} className="py-2">
          Save bank details
        </Button>
        {msg && <span className="text-[12px] text-emerald-600">{msg}</span>}
        {err && <span className="text-[12px] text-red-500">{err}</span>}
      </div>
    </Card>
  );
}
