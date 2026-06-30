export interface PaginationResult<T> {
  data: T[];
  meta: {
    totalItems: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextPage: number | null;
    prevPage: number | null;
  };
  message?: string;
}

export function createPaginationResult<T>(
  data: T[],
  totalItems: number,
  page: number,
  perPage: number,
  message = 'Datos obtenidos exitosamente',
): PaginationResult<T> {
  const totalPages = Math.ceil(totalItems / perPage);
  const currentPage = page;

  return {
    data,
    meta: {
      totalItems,
      itemsPerPage: perPage,
      totalPages,
      currentPage,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
    },
    message,
  };
}
