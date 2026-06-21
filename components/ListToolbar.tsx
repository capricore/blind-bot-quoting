import Link from "next/link";

export type StatusOption = { value: string; label: string };

const INPUT = "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-ink";

/**
 * Server-rendered list toolbar: a GET search form (+ optional status select) and a pager.
 * No client JS — searching/filtering navigates with query params; the page re-renders.
 */
export function ListToolbar({
  basePath,
  q,
  status,
  statuses,
  total,
  page,
  pageSize,
}: {
  basePath: string;
  q: string;
  status: string;
  statuses?: StatusOption[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const href = (next: { page?: number }) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    const p = next.page ?? 1;
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <form action={basePath} method="get" className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Search…" className={INPUT} aria-label="Search" />
        {statuses && statuses.length > 0 && (
          <select name="status" defaultValue={status} className={INPUT} aria-label="Filter by status">
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-[#faf9f5]">
          Search
        </button>
        {(q || status) && (
          <Link href={basePath} className="text-[12px] text-muted hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="ml-auto flex items-center gap-3 text-[12px] text-muted">
        <span>
          {total} result{total === 1 ? "" : "s"}
        </span>
        {totalPages > 1 && (
          <span className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={href({ page: page - 1 })} className="font-medium text-brass hover:underline">
                ‹ Prev
              </Link>
            ) : (
              <span className="opacity-30">‹ Prev</span>
            )}
            <span>
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={href({ page: page + 1 })} className="font-medium text-brass hover:underline">
                Next ›
              </Link>
            ) : (
              <span className="opacity-30">Next ›</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
