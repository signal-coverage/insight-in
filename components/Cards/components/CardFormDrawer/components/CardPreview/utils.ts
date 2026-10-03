import {
  HIDDEN_DIGIT,
  HIDDEN_GROUP,
  LAST4_LENGTH,
  MISSING_DAY,
} from "./consts";

// "•••• •••• •••• 1234"; the digits not typed yet stay hidden ("12••").
export const maskedNumber = (last4: string): string =>
  [
    HIDDEN_GROUP,
    HIDDEN_GROUP,
    HIDDEN_GROUP,
    last4.padEnd(LAST4_LENGTH, HIDDEN_DIGIT),
  ].join(" ");

// "Cierra el día 1 · Vence el día 15".
export const cycleText = (closingDay: number, dueDay: number): string => {
  const day = (value: number) => (Number.isNaN(value) ? MISSING_DAY : value);

  return `Cierra el día ${day(closingDay)} · Vence el día ${day(dueDay)}`;
};
