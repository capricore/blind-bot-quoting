// Shared helpers for server-rendered list pages (search + status filter + pagination).

export const PAGE_SIZE = 20;

export function parseListParams(sp: Record<string, string | string[] | undefined>): {
  q: string;
  status: string;
  page: number;
} {
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, Math.floor(Number(typeof sp.page === "string" ? sp.page : "1")) || 1);
  return { q, status, page };
}

export function pageSlice<T>(rows: T[], page: number, size = PAGE_SIZE): T[] {
  return rows.slice((page - 1) * size, page * size);
}
