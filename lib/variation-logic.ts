// Pure (React-free) helpers for picking accessory variations (sub-products): which types are
// available for a model, how they split into paired groups vs independents, and which items must
// be greyed out because they're mutually exclusive with another active pick. Shared by the inline
// 4th-column panel and the add-to-quote modal.

import type { VariationType } from "@/lib/db";

/** Trim each variation type to the items actually assigned to this model; drop empty types. */
export function availableTypes(variations: VariationType[], availableItemIds: string[]): VariationType[] {
  const ok = new Set(availableItemIds);
  return variations
    .map((t) => ({ ...t, items: t.items.filter((i) => ok.has(i.id)) }))
    .filter((t) => t.items.length > 0);
}

/**
 * item id → set of item ids it's mutually exclusive with. Built from this model's exclusion groups
 * (migration 0038): within a group, every member blocks every other member (at most one may be
 * selected). Symmetric. `groups` is the model's list of groups, each an array of item ids.
 */
export function buildBlockedFromGroups(groups: string[][]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (a: string, b: string) => (m.get(a) ?? m.set(a, new Set()).get(a)!).add(b);
  for (const g of groups) {
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++) {
        add(g[i], g[j]);
        add(g[j], g[i]);
      }
  }
  return m;
}

/** item id → its display name, across all available types. */
export function buildItemNames(avail: VariationType[]): Record<string, string> {
  const n: Record<string, string> = {};
  for (const t of avail) for (const i of t.items) n[i.id] = i.name;
  return n;
}

/**
 * Items of `type` that conflict with the current multi-select → greyed out, with the conflicting
 * option's name for the tooltip. `selectedIds` is every currently-picked item id (across all
 * types). An already-selected item is never disabled (it renders as "on"); any other item that
 * shares an exclusion group with a selected item is.
 */
export function disabledFor(
  type: VariationType,
  selectedIds: Set<string>,
  blocked: Map<string, Set<string>>,
  itemName: Record<string, string>
): { ids: Set<string>; reason: Record<string, string> } {
  const ids = new Set<string>();
  const reason: Record<string, string> = {};
  for (const it of type.items) {
    if (selectedIds.has(it.id)) continue;
    const conflicts = blocked.get(it.id);
    if (!conflicts) continue;
    for (const sel of selectedIds) {
      if (sel !== it.id && conflicts.has(sel)) {
        ids.add(it.id);
        reason[it.id] = itemName[sel] ?? "your current selection";
        break;
      }
    }
  }
  return { ids, reason };
}
