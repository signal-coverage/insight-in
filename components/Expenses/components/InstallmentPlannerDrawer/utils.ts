import {
  CATEGORY_LINE,
  COUNT_LINE,
  FIRST_LINE,
  LAST_LINE,
  MEDIUM_LINE,
  PER_INSTALLMENT_LINE,
  TOTAL_LINE,
} from "@/components/Entries/components/InstallmentTicket/consts";
import { MEDIUM_OPTIONS } from "@/components/Entries/components/MediumField/consts";
import type { TicketLine } from "@/components/Entries/types";
import {
  installmentAmountLabel,
  installmentPreviewText,
  splitSummary,
} from "@/components/Entries/utils";
import { firstInstallmentDate } from "@/core/cards/cycle";
import { recommendCards } from "@/core/cards/recommend";
import type { CardRecommendation } from "@/core/cards/types";
import { DEFAULT_PAYMENT_MEDIUM } from "@/core/entries/medium";
import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";
import { formatIncomeDate, isValidIsoDate } from "@/core/incomes/dates";
import { formatMoney } from "@/core/incomes/money";
import {
  DEFAULT_TOTAL_CUOTAS,
  MAX_INSTALLMENTS,
  MIN_INSTALLMENTS,
} from "@/core/installments/consts";
import { lastInstallmentMonth, planTotal } from "@/core/installments/plan";
import { installmentPlanSchema } from "@/core/installments/schema";
import type { InstallmentPlanPayload } from "@/core/installments/types";
import { formatMonth, monthOf, shiftMonth } from "@/core/summary/month";

import type { CardOption } from "../../types";
import {
  BORROWED_CARD_VALUE,
  CARD_LINE,
  PRODUCT_LINE,
  NEAR_LIMIT_VERDICT,
  confirmationMessage,
  exceededVerdict,
  firstInstallmentLaterNote,
  firstInstallmentLine,
  firstInstallmentNextMonthNote,
  fitsVerdict,
  ownCardValue,
} from "./consts";
import type {
  CardRecommendationItem,
  PurchaseSummary,
  PurchaseValues,
} from "./types";

// What the first step starts with: nothing typed, pesos, digital, a year of installments, an own card
// when the user has any (otherwise a borrowed one) with none chosen yet, and both the first
// installment and the purchase today.
export const initialValues = (
  defaultDate: string,
  cards: readonly CardOption[],
): PurchaseValues => ({
  description: "",
  categoryId: null,
  currency: DEFAULT_CURRENCY_CODE,
  medium: DEFAULT_PAYMENT_MEDIUM,
  amountMode: "total",
  amount: "",
  totalCuotas: DEFAULT_TOTAL_CUOTAS,
  firstDate: defaultDate,
  cardOwnership: cards.length > 0 ? "own" : "borrowed",
  cardId: null,
  purchaseDate: defaultDate,
  notes: "",
});

// The card chosen, if it still exists and is in the currency of the purchase. A card in another
// currency never pays a purchase.
const chosenCard = (
  values: PurchaseValues,
  cards: readonly CardOption[],
): CardOption | null =>
  cards.find(
    ({ id, currency }) => id === values.cardId && currency === values.currency,
  ) ?? null;

// The own card that pays the purchase. A borrowed card has no record, so there is none, even if an
// own card was chosen before switching.
export const cardOf = (
  values: PurchaseValues,
  cards: readonly CardOption[],
): CardOption | null =>
  values.cardOwnership === "own" ? chosenCard(values, cards) : null;

// Changing the currency leaves a card of the old one behind: the choice goes back to no card. It
// goes by the choice itself, not by whose card pays, so going back and forth between own and
// borrowed keeps it.
export const dropMismatchedCard = (
  values: PurchaseValues,
  cards: readonly CardOption[],
): PurchaseValues =>
  values.cardId !== null && chosenCard(values, cards) === null
    ? { ...values, cardId: null }
    : values;

// When the first installment is charged: with a borrowed card, the date the user typed; with an own
// card, the date its cycle gives for the day of the purchase. Null while there is none.
const firstDateOf = (
  values: PurchaseValues,
  card: CardOption | null,
): string | null => {
  if (values.cardOwnership === "borrowed") {
    return values.firstDate;
  }

  if (!card) {
    return null;
  }

  return values.purchaseDate && isValidIsoDate(values.purchaseDate)
    ? firstInstallmentDate(values.purchaseDate, card.closingDay, card.dueDay)
    : null;
};

// "Primera cuota: 5 nov 2026", live under the purchase date once an own card is chosen.
export const firstInstallmentText = (
  values: PurchaseValues,
  cards: readonly CardOption[],
): string | null => {
  const card = cardOf(values, cards);
  const firstDate = card ? firstDateOf(values, card) : null;

  return firstDate ? firstInstallmentLine(formatIncomeDate(firstDate)) : null;
};

// What the server receives. A piece with no value yet goes as a value the server's rules refuse.
// With an own card the medium is digital (a credit card is never cash), the first date is the one
// its cycle gives (the server works it out again), and the card and the day of the purchase travel
// with it. A borrowed card sends nothing about cards: the typed date and the chosen medium count.
export const toPayload = (
  values: PurchaseValues,
  cards: readonly CardOption[] = [],
): InstallmentPlanPayload => {
  const card = cardOf(values, cards);

  return {
    description: values.description,
    categoryId: values.categoryId ?? "",
    currency: values.currency,
    medium:
      values.cardOwnership === "own" ? DEFAULT_PAYMENT_MEDIUM : values.medium,
    notes: values.notes,
    amount: values.amount,
    amountMode: values.amountMode,
    totalCuotas: values.totalCuotas ?? Number.NaN,
    firstDate: firstDateOf(values, card) ?? "",
    cardOwnership: values.cardOwnership,
    ...(card
      ? { cardId: card.id, purchaseDate: values.purchaseDate ?? "" }
      : {}),
  };
};

// The purchase as the server will read it, or null while it is not valid. It is the server's own
// schema, so the button and the live preview agree with what the save will accept.
export const parsePurchase = (
  values: PurchaseValues,
  cards: readonly CardOption[] = [],
): PurchaseSummary | null => {
  const parsed = installmentPlanSchema.safeParse(toPayload(values, cards));

  if (!parsed.success) {
    return null;
  }

  const input = parsed.data;

  return {
    input,
    card: cardOf(values, cards),
    ownership: values.cardOwnership,
    // What the bank charges for each one is up to it, so the amount shown is an approximation when
    // the total does not divide evenly.
    ...splitSummary(input.totalAmount, input.totalCuotas),
    lastMonth: lastInstallmentMonth(input.firstDate, input.totalCuotas),
  };
};

// "$ 100.000,00", or "≈ $ 33.333,34" when the total does not divide evenly and the real charge of
// each installment depends on the bank.
const installmentAmountText = ({
  input,
  installmentAmount,
  isApproximate,
}: PurchaseSummary): string =>
  installmentAmountLabel(installmentAmount, input.currency, isApproximate);

// "12 cuotas de $ 100.000,00 · total $ 1.200.000,00", with "≈" before the installment's amount when
// the total does not divide evenly.
export const previewText = ({
  input,
  installmentAmount,
  isApproximate,
}: PurchaseSummary): string =>
  installmentPreviewText({
    totalCuotas: input.totalCuotas,
    installmentAmount,
    isApproximate,
    totalAmount: input.totalAmount,
    currency: input.currency,
  });

// What a verdict says in words, with the amounts in the currency of the card.
const verdictLabelFor = (
  { verdict, margin, excess }: CardRecommendation,
  currency: string,
): string => {
  if (verdict === "fits") {
    return fitsVerdict(formatMoney(margin ?? 0, currency));
  }

  return verdict === "near"
    ? NEAR_LIMIT_VERDICT
    : exceededVerdict(formatMoney(excess ?? 0, currency));
};

// How each card of the purchase's currency suits it, the best first. Needs only the amount, the
// number of installments, the currency and a date: the product and the category are not part of
// whether a card has room. Null while any of those is not valid; the day of the purchase is the one
// in the form (today until the user picks a card and moves it), whatever card is chosen.
export const recommendationItems = (
  values: PurchaseValues,
  cards: readonly CardOption[],
): CardRecommendationItem[] | null => {
  const { totalCuotas, purchaseDate } = values;

  if (
    totalCuotas === null ||
    !Number.isInteger(totalCuotas) ||
    totalCuotas < MIN_INSTALLMENTS ||
    totalCuotas > MAX_INSTALLMENTS ||
    purchaseDate === null ||
    !isValidIsoDate(purchaseDate)
  ) {
    return null;
  }

  const totalAmount = planTotal(
    values.amount,
    values.amountMode,
    totalCuotas,
    values.currency,
  );

  if (totalAmount === null) {
    return null;
  }

  const titles = new Map(cards.map(({ id, title }) => [id, title]));

  return recommendCards(cards, {
    currency: values.currency,
    totalAmount,
    totalCuotas,
    purchaseDate,
  }).map((recommendation) => ({
    cardId: recommendation.cardId,
    title: titles.get(recommendation.cardId) ?? "",
    verdict: recommendation.verdict,
    verdictLabel: verdictLabelFor(recommendation, values.currency),
    recommended: recommendation.recommended,
  }));
};

// Said under the first installment of a purchase paid with an own card whose first installment is
// not in the current month: the next one is "el mes que viene", a later one is named. Nothing when
// the first installment is this month (the pop-up says it) or already went by.
const firstInstallmentNote = (
  summary: PurchaseSummary,
  currentMonth: string,
): string | undefined => {
  if (!summary.card) {
    return undefined;
  }

  const month = monthOf(summary.input.firstDate);
  const date = formatIncomeDate(summary.input.firstDate);

  if (month === shiftMonth(currentMonth, 1)) {
    return firstInstallmentNextMonthNote(date);
  }

  return month > currentMonth
    ? firstInstallmentLaterNote(monthName(month), date)
    : undefined;
};

// "noviembre": the name of the month, for a sentence.
const monthName = (month: string): string => {
  const [name] = formatMonth(month).split(" de ");

  return name.toLowerCase();
};

// The card of the purchase on the ticket. An own card is always digital money, so it has no medium
// line; a borrowed one shows the medium it will be repaid with.
const cardLines = ({ input, card }: PurchaseSummary): TicketLine[] => {
  if (card) {
    return [{ label: CARD_LINE, value: ownCardValue(card.title) }];
  }

  const medium = MEDIUM_OPTIONS.find(({ value }) => value === input.medium);

  return [
    { label: CARD_LINE, value: BORROWED_CARD_VALUE },
    { label: MEDIUM_LINE, value: medium?.label ?? input.medium },
  ];
};

// The lines of the ticket, in the order a receipt would list them. `currentMonth` ("YYYY-MM") is
// where "this month" is, to tell when an own card's first installment comes.
export const toTicketLines = (
  summary: PurchaseSummary,
  categoryName: string,
  currentMonth: string,
): TicketLine[] => {
  const { input, lastMonth } = summary;
  const note = firstInstallmentNote(summary, currentMonth);

  return [
    { label: PRODUCT_LINE, value: input.description },
    { label: CATEGORY_LINE, value: categoryName },
    { label: COUNT_LINE, value: String(input.totalCuotas) },
    { label: PER_INSTALLMENT_LINE, value: installmentAmountText(summary) },
    {
      label: TOTAL_LINE,
      value: formatMoney(input.totalAmount, input.currency),
    },
    {
      label: FIRST_LINE,
      value: formatIncomeDate(input.firstDate),
      ...(note ? { note } : {}),
    },
    { label: LAST_LINE, value: formatMonth(lastMonth) },
    ...cardLines(summary),
  ];
};

// Whether the user has to confirm using the card before saving: an own card charges the first
// installment this very month, so the purchase lands in a summary that is already running.
export const needsConfirmation = (
  summary: PurchaseSummary,
  currentMonth: string,
): boolean =>
  summary.card !== null && monthOf(summary.input.firstDate) === currentMonth;

// What the confirmation says: the date of the first installment and the month's summary it enters.
export const confirmationText = ({ input }: PurchaseSummary): string => {
  const month = monthOf(input.firstDate);
  const [name, year] = formatMonth(month).split(" de ");

  return confirmationMessage(
    formatIncomeDate(input.firstDate),
    `${name.toLowerCase()} de ${year}`,
  );
};
