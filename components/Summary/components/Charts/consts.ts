// The name of a chart for assistive technology: what it shows and in which currency.
export const chartAriaLabel = (title: string, currency: string): string =>
  `${title}, en ${currency}`;
