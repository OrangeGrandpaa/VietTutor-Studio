const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export function normalizePage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function normalizePageSize(value?: number) {
  if (!Number.isInteger(value) || !value || value <= 0) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(value, MAX_PAGE_SIZE);
}

export function getPagination(params: { page?: string; pageSize?: number; totalItems: number }) {
  const pageSize = normalizePageSize(params.pageSize);
  const totalPages = Math.max(1, Math.ceil(params.totalItems / pageSize));
  const page = Math.min(normalizePage(params.page), totalPages);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    totalItems: params.totalItems,
    totalPages
  };
}
