"use client";

import { createContext, useContext, useState } from "react";

/**
 * Shares a "shipping is recalculating" flag between the expedite toggle (ShippingSummaryRow) and the
 * pay button (SubmitPreOrderButton), so the customer can't pay mid-recalculation. The provider adds
 * no DOM node, so it's transparent to the summary's layout.
 */
const Ctx = createContext<{ pending: boolean; setPending: (v: boolean) => void }>({
  pending: false,
  setPending: () => {},
});

export function ShippingRecalcProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  return <Ctx.Provider value={{ pending, setPending }}>{children}</Ctx.Provider>;
}

export function useShippingRecalc() {
  return useContext(Ctx);
}
