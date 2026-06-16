"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui";

/**
 * First-time handoff consent: records consent on the user (user_metadata) so future
 * handoffs from blind-bot pass through silently, then continues to the destination.
 */
export function ConsentContinueButton({ next, brand }: { next: string; brand: string }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const sb = createClient();
      if (sb) await sb.auth.updateUser({ data: { bb_handoff_consented: true } });
    } catch {
      // even if recording fails, don't block the user
    }
    window.location.assign(next);
  };
  return (
    <Button variant="primary" onClick={go} busy={busy} className="w-full py-3">
      {busy ? "Continuing…" : `Continue to ${brand}`}
    </Button>
  );
}
