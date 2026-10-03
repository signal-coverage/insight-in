export const PREVIOUS_LABEL = "Anterior";
export const NEXT_LABEL = "Siguiente";
export const PAGINATION_ARIA_LABEL = "Paginación";

export const summaryLabel = (
  first: number,
  last: number,
  total: number,
): string => `Mostrando ${first}-${last} de ${total}`;

export const pageLabel = (page: number, totalPages: number): string =>
  `Página ${page} de ${totalPages}`;
