export type PaginationParams = {
  page: number;
  pageSize: number;
  offset: number;
};

export const getPaginationParams = (
  pageValue?: string | number,
  pageSizeValue?: string | number,
): PaginationParams => {
  const page = Math.max(1, Number(pageValue || 1));
  const pageSize = Math.min(100, Math.max(1, Number(pageSizeValue || 20)));
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
};
