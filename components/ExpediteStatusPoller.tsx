"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While a quote is awaiting an expedite price ('requested'), poll the server so the customer's page
 * picks up the admin's quoted fee on its own (total updates, pay button re-enables). Stops as soon as
 * the server re-renders with a non-'requested' status (the `active` prop flips false). Renders nothing.
 */
export function ExpediteStatusPoller({ active, intervalMs = 8000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs, router]);
  return null;
}
