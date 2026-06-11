"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrderStatus } from "@/lib/types";
import { cx } from "./ui";

const NEXT_ACTION: Partial<Record<OrderStatus, { action: string; label: string }>> = {
  submitted: { action: "acknowledge", label: "Acknowledge + issue order №" },
  acknowledged: { action: "start_production", label: "Start production" },
  in_production: { action: "ship", label: "Ship + issue tracking №" },
  shipped: { action: "in_transit", label: "Mark in transit" },
  in_transit: { action: "deliver", label: "Mark delivered" },
};

export default function SupplierAdvanceButton({
  orderId,
  status,
}: {
  orderId: number;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = NEXT_ACTION[status];

  if (!next) {
    return <span className="text-xs font-medium text-emerald-600">Complete ✓</span>;
  }

  return (
    <button
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/orders/${orderId}/advance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: next.action }),
        });
        router.refresh();
        setBusy(false);
      }}
      disabled={busy}
      className={cx(
        "rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink shadow-sm transition-all",
        busy ? "opacity-50" : "hover:border-brass hover:text-brass"
      )}
    >
      {busy ? "Syncing…" : next.label + " →"}
    </button>
  );
}
