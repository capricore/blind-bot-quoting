// Regression test for the quote/order ref generator (no DB, pure logic).
//
// Bug: refs were minted as `${prefix}-${year}-${rowCount+1}`. Once any row is deleted, the count
// drops below the highest number still in use, so count+1 re-mints a LIVE ref → Postgres
// `duplicate key value violates unique constraint "quotes_ref_key"`.
//
// Fix: mint from the MAX in-use sequence number for that prefix+year (+1). This file mirrors the
// pure `nextRefFrom` in lib/db/internal.ts and the old count-based logic, and asserts the fix.
//
//   node scripts/test-next-ref.mjs

// --- old (buggy) count-based logic, kept here only to prove the regression ---
const oldCountBased = (existing, prefix, year) => `${prefix}-${year}-${String(existing.length + 1).padStart(4, "0")}`;

// --- mirror of lib/db/internal.ts `nextRefFrom` ---
function nextRefFrom(existing, prefix, year) {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let max = 0;
  for (const ref of existing) {
    const m = re.exec(ref);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

let failed = 0;
const eq = (label, got, want) => {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  got=${got} want=${want}`);
};

// 1. The reported bug: 0002 was deleted, so 3 rows remain whose max is 0003.
const afterDelete = ["Q-2026-0001", "Q-2026-0003"]; // count = 2
eq("old: collides with live 0003", oldCountBased(afterDelete, "Q", 2026), "Q-2026-0003"); // demonstrates the bug
eq("new: skips past the max",      nextRefFrom(afterDelete, "Q", 2026),   "Q-2026-0004");

// 2. Empty table → first ref of the year.
eq("new: empty → 0001", nextRefFrom([], "Q", 2026), "Q-2026-0001");

// 3. Fresh year ignores prior-year + other-prefix refs (each year/prefix is its own series).
const mixed = ["Q-2025-0009", "PO-2026-0005", "Q-2026-0002"];
eq("new: year-scoped",   nextRefFrom(mixed, "Q", 2026),  "Q-2026-0003");
eq("new: prefix-scoped", nextRefFrom(mixed, "PO", 2026), "PO-2026-0006");
eq("new: new year resets", nextRefFrom(["Q-2025-0009"], "Q", 2026), "Q-2026-0001");

// 4. Gaps anywhere never reuse a number (max wins, not count, not contiguity).
eq("new: ignores gaps", nextRefFrom(["Q-2026-0001", "Q-2026-0050"], "Q", 2026), "Q-2026-0051");

console.log(failed ? `\n${failed} FAILED` : "\nAll passed");
process.exit(failed ? 1 : 0);
