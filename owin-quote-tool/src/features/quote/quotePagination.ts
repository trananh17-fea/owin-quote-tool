export type QuotePageSize = 25 | 50 | 100;

export function paginateItems<T>(items: T[], requestedPage: number, pageSize: QuotePageSize) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const normalizedPage = Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1;
  const page = Math.min(Math.max(1, normalizedPage), totalPages);
  const startIndex = (page - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page,
    totalItems,
    totalPages,
    firstItemNumber: totalItems === 0 ? 0 : startIndex + 1,
    lastItemNumber: Math.min(startIndex + pageSize, totalItems),
  };
}
