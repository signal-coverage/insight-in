// "US$ 85,00 de US$ 100,00": what a card used against its cap.
export const usedOfLimit = (used: string, limit: string): string =>
  `${used} de ${limit}`;

// "y 2 más": the lines of a group that do not fit.
export const moreLabel = (count: number): string => `y ${count} más`;

// The id of a group's title, which names the group.
export const groupHeadingId = (kind: string): string => `attention-${kind}`;

// What a group's link is called for assistive technology: its visible text plus the group it belongs
// to, so two links that both say "Ver gastos" can be told apart.
export const linkAriaLabel = (linkLabel: string, title: string): string =>
  `${linkLabel}: ${title}`;
