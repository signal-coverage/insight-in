export const countAriaLabel = (description: string): string =>
  `Cuotas este mes de ${description}`;

// Nothing can be asked below zero: zero is a month skipped.
export const MIN_COUNT = 0;
