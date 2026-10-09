import { describe, expect, it } from "vitest";

import type { AccountChoice } from "@/core/accounts/types";

import type { CreditCardPatch } from "@/core/cards/testFixtures";
import type { CardCharge } from "@/core/cards/types";

import { creditOption } from "../../testCards";
import type { CreditCardOption } from "../../types";
import type { PurchaseValues } from "./types";
import {
  cardOf,
  confirmationText,
  dropMismatchedCard,
  firstInstallmentText,
  needsConfirmation,
  parsePurchase,
  previewText,
  recommendationItems,
  toPayload,
  toTicketLines,
  initialValues,
  withPurchaseChange,
} from "./utils";

const ACCOUNTS: AccountChoice[] = [
  {
    id: "acc_1",
    currency: "ARS",
    label: "Banco Galicia · Caja de ahorro",
    archived: false,
  },
  {
    id: "acc_usd",
    currency: "USD",
    label: "Banco Galicia · Cuenta en dólares",
    archived: false,
  },
];

const ARS_ONLY = ACCOUNTS.filter(({ currency }) => currency === "ARS");

// $ 2.000.000,00 of TOTAL cap, closing on the 25th and paid on the 5th.
const card = (
  patch: CreditCardPatch & { title?: string; charges?: CardCharge[] } = {},
): CreditCardOption =>
  creditOption({
    id: "visa",
    limitMode: "TOTAL",
    limitAmount: 200000000,
    ...patch,
  });

const values = (patch: Partial<PurchaseValues> = {}): PurchaseValues => ({
  description: "Heladera",
  categoryId: "cat_1",
  currency: "ARS",
  accountId: null,
  amountMode: "total",
  amount: "1200000",
  totalCuotas: 12,
  firstDate: "2026-10-15",
  cardOwnership: "borrowed",
  cardId: null,
  purchaseDate: "2026-10-10",
  notes: "",
  ...patch,
});

describe("initialValues", () => {
  it("starts empty, in pesos, with no account, twelve installments, the first one today", () => {
    expect(initialValues("2026-10-01", [])).toEqual({
      description: "",
      categoryId: null,
      currency: "ARS",
      accountId: null,
      amountMode: "total",
      amount: "",
      totalCuotas: 12,
      firstDate: "2026-10-01",
      cardOwnership: "borrowed",
      cardId: null,
      purchaseDate: "2026-10-01",
      notes: "",
    });
  });

  it("starts on an own card when the user has at least one card, and on a borrowed one otherwise", () => {
    expect(initialValues("2026-10-01", [card()]).cardOwnership).toBe("own");
    expect(
      initialValues("2026-10-01", [card({ currency: "USD" })]).cardOwnership,
    ).toBe("own");
    expect(initialValues("2026-10-01", []).cardOwnership).toBe("borrowed");
  });

  it("chooses no card on its own", () => {
    expect(initialValues("2026-10-01", [card()]).cardId).toBeNull();
  });
});

describe("toPayload", () => {
  it("sends what the form holds, with the missing pieces as empty text", () => {
    expect(toPayload(values())).toEqual({
      description: "Heladera",
      categoryId: "cat_1",
      currency: "ARS",
      accountId: "",
      notes: "",
      amount: "1200000",
      amountMode: "total",
      totalCuotas: 12,
      firstDate: "2026-10-15",
      cardOwnership: "borrowed",
    });
    expect(
      toPayload(
        values({ categoryId: null, firstDate: null, totalCuotas: null }),
      ),
    ).toMatchObject({ categoryId: "", firstDate: "", totalCuotas: Number.NaN });
  });
});

describe("parsePurchase", () => {
  it("summarises a valid purchase with an even split", () => {
    expect(parsePurchase(values(), [], ACCOUNTS)).toMatchObject({
      input: { totalCuotas: 12, totalAmount: 120000000 },
      installmentAmount: 10000000,
      isApproximate: false,
      lastMonth: "2027-09",
    });
  });

  it("reads the amount of one installment when that is what was typed", () => {
    expect(
      parsePurchase(
        values({ amountMode: "perInstallment", amount: "100000" }),
        [],
        ACCOUNTS,
      ),
    ).toMatchObject({
      input: { totalAmount: 120000000 },
      installmentAmount: 10000000,
      isApproximate: false,
    });
  });

  it("takes the first installment as the amount, and calls it approximate, when the total does not divide evenly", () => {
    expect(
      parsePurchase(
        values({ amount: "1000.01", totalCuotas: 3 }),
        [],
        ACCOUNTS,
      ),
    ).toMatchObject({ installmentAmount: 33334, isApproximate: true });
  });

  it.each([
    ["no product", { description: "  " }],
    ["no category", { categoryId: null }],
    ["an amount that is not a number", { amount: "abc" }],
    ["a zero amount", { amount: "0" }],
    ["no amount", { amount: "" }],
    ["a single installment", { totalCuotas: 1 }],
    ["too many installments", { totalCuotas: 61 }],
    ["no number of installments", { totalCuotas: null }],
    ["no first date", { firstDate: null }],
    ["a first date outside the supported years", { firstDate: "1999-01-01" }],
  ] as const)("is null for %s", (_name, patch) => {
    expect(parsePurchase(values(patch), [], ACCOUNTS)).toBeNull();
  });
});

describe("previewText", () => {
  it("says how many installments of how much, and the total", () => {
    const text = previewText(parsePurchase(values(), [], ACCOUNTS)!);

    expect(text).toMatch(
      /^12 cuotas de \$\s100\.000,00 · total \$\s1\.200\.000,00$/,
    );
  });

  it("shows the approximate amount of the first installment, with no note, when it does not divide evenly", () => {
    const text = previewText(
      parsePurchase(
        values({ amount: "1000.01", totalCuotas: 3 }),
        [],
        ACCOUNTS,
      )!,
    );

    expect(text).toMatch(/^3 cuotas de ≈ \$\s333,34 · total \$\s1\.000,01$/);
    expect(text).not.toMatch(/diferencia|primeras/);
  });

  it("formats in the currency of the purchase", () => {
    const text = previewText(
      parsePurchase(
        values({ currency: "USD", amount: "600", totalCuotas: 6 }),
        [],
        ACCOUNTS,
      )!,
    );

    expect(text).toMatch(/^6 cuotas de US\$\s100,00 · total US\$\s600,00$/);
  });
});

describe("toTicketLines", () => {
  const lines = (patch: Partial<PurchaseValues> = {}) =>
    toTicketLines(
      parsePurchase(values(patch), [], ARS_ONLY)!,
      "Hogar",
      "2026-10",
    );

  it("lists the data of the purchase in the order a receipt would, a borrowed card, then the account", () => {
    expect(lines().map(({ label }) => label)).toEqual([
      "Producto",
      "Categoría",
      "Cantidad de cuotas",
      "Monto por cuota",
      "Monto total",
      "Primera cuota",
      "Última cuota estimada",
      "Tarjeta",
      "Cuenta",
    ]);
  });

  it("says the card is borrowed", () => {
    expect(lines().find(({ label }) => label === "Tarjeta")?.value).toBe(
      "Prestada",
    );
  });

  it("fills each line", () => {
    const byLabel = Object.fromEntries(
      lines().map(({ label, value }) => [label, value]),
    );

    expect(byLabel).toMatchObject({
      Producto: "Heladera",
      Categoría: "Hogar",
      "Cantidad de cuotas": "12",
      "Primera cuota": "15 oct 2026",
      "Última cuota estimada": "Septiembre de 2027",
      Cuenta: "Banco Galicia · Caja de ahorro",
    });
    expect(byLabel["Monto por cuota"]).toMatch(/^\$\s100\.000,00$/);
    expect(byLabel["Monto total"]).toMatch(/^\$\s1\.200\.000,00$/);
  });

  it("adds no note when the installments are all equal", () => {
    expect(lines().every(({ note }) => note === undefined)).toBe(true);
  });

  describe("the amount per installment", () => {
    const perInstallment = (patch: Partial<PurchaseValues> = {}) =>
      lines(patch).find(({ label }) => label === "Monto por cuota")!;

    it("is the exact amount, with no sign, when the installments are all equal", () => {
      expect(perInstallment().value).toMatch(/^\$\s100\.000,00$/);
    });

    it("is the amount of the first installment, prefixed with ≈, when the total does not divide evenly", () => {
      expect(
        perInstallment({ amount: "1000.01", totalCuotas: 3 }).value,
      ).toMatch(/^≈ \$\s333,34$/);
      expect(
        perInstallment({ amount: "1000.01", totalCuotas: 5 }).value,
      ).toMatch(/^≈ \$\s200,01$/);
    });

    it("never carries a note about which installments are larger", () => {
      const uneven = lines({ amount: "1000.01", totalCuotas: 3 });

      expect(uneven.every(({ note }) => note === undefined)).toBe(true);
      expect(JSON.stringify(uneven)).not.toMatch(/Las primeras|el resto/);
    });

    it("leaves the total exact", () => {
      expect(
        lines({ amount: "1000.01", totalCuotas: 3 }).find(
          ({ label }) => label === "Monto total",
        )?.value,
      ).toMatch(/^\$\s1\.000,01$/);
    });
  });
});

describe("with an own card", () => {
  const CARDS = [card()];
  // Bought on October 10, before the closing day of the 25th: the October statement, paid on
  // November 5.
  const withCard = (patch: Partial<PurchaseValues> = {}) =>
    values({ cardOwnership: "own", cardId: "visa", ...patch });
  // An own card whose choice is still to be made.
  const withoutCardYet = (patch: Partial<PurchaseValues> = {}) =>
    values({ cardOwnership: "own", ...patch });

  describe("cardOf", () => {
    it("finds the card chosen", () => {
      expect(cardOf(withCard(), CARDS)).toBe(CARDS[0]);
    });

    it("is null with no card chosen, with a card that is gone, or in another currency", () => {
      expect(cardOf(withoutCardYet(), CARDS)).toBeNull();
      expect(cardOf(withCard({ cardId: "gone" }), CARDS)).toBeNull();
      expect(cardOf(withCard({ currency: "USD" }), CARDS)).toBeNull();
    });

    it("is null for a borrowed card, even if an own card was chosen before switching", () => {
      expect(cardOf(withCard({ cardOwnership: "borrowed" }), CARDS)).toBeNull();
    });
  });

  describe("dropMismatchedCard", () => {
    it("keeps a card that is in the currency of the purchase", () => {
      expect(dropMismatchedCard(withCard(), CARDS)).toEqual(withCard());
    });

    it("clears the card when the currency changed to another one", () => {
      expect(
        dropMismatchedCard(withCard({ currency: "USD" }), CARDS).cardId,
      ).toBeNull();
    });

    it("keeps the choice while the purchase is on a borrowed card, so going back finds it", () => {
      expect(
        dropMismatchedCard(withCard({ cardOwnership: "borrowed" }), CARDS)
          .cardId,
      ).toBe("visa");
    });
  });

  describe("toPayload", () => {
    it("sends the card and the purchase date, with the first date its cycle gives", () => {
      expect(toPayload(withCard(), CARDS)).toMatchObject({
        cardOwnership: "own",
        cardId: "visa",
        purchaseDate: "2026-10-10",
        firstDate: "2026-11-05",
      });
    });

    it("ignores the typed first date once a card is chosen", () => {
      expect(
        toPayload(withCard({ firstDate: "2030-01-01" }), CARDS).firstDate,
      ).toBe("2026-11-05");
    });

    it("sends no card keys, and no first date, while the card is still to be chosen", () => {
      const payload = toPayload(withoutCardYet(), CARDS);

      expect(payload).not.toHaveProperty("cardId");
      expect(payload.firstDate).toBe("");
    });

    it("sends no card keys for a borrowed card: the typed first date counts", () => {
      const payload = toPayload(withCard({ cardOwnership: "borrowed" }), CARDS);

      expect(payload).not.toHaveProperty("cardId");
      expect(payload).not.toHaveProperty("purchaseDate");
      expect(payload).toMatchObject({
        cardOwnership: "borrowed",
        firstDate: "2026-10-15",
      });
    });
  });

  describe("parsePurchase", () => {
    it("keeps the card and the first installment the cycle gives", () => {
      const summary = parsePurchase(withCard(), CARDS, ACCOUNTS)!;

      expect(summary.card).toBe(CARDS[0]);
      expect(summary.ownership).toBe("own");
      expect(summary.input).toMatchObject({
        cardId: "visa",
        firstDate: "2026-11-05",
        purchaseDate: "2026-10-10",
        accountId: "acc_1",
      });
      expect(summary.lastMonth).toBe("2027-10");
    });

    it("has no card for a borrowed purchase", () => {
      const summary = parsePurchase(values(), CARDS, ACCOUNTS)!;

      expect(summary.card).toBeNull();
      expect(summary.ownership).toBe("borrowed");
    });

    it("is null while an own card is not chosen: a purchase in installments needs a card", () => {
      expect(parsePurchase(withoutCardYet(), CARDS, ACCOUNTS)).toBeNull();
    });

    it("is null while the card is chosen but the purchase date is not", () => {
      expect(
        parsePurchase(withCard({ purchaseDate: null }), CARDS, ACCOUNTS),
      ).toBeNull();
    });
  });

  describe("firstInstallmentText", () => {
    it("tells when the first installment is charged", () => {
      expect(firstInstallmentText(withCard(), CARDS)).toBe(
        "Primera cuota: 5 nov 2026",
      );
    });

    it("is null without a card, with a borrowed one, or without a purchase date", () => {
      expect(
        firstInstallmentText(withCard({ cardOwnership: "borrowed" }), CARDS),
      ).toBeNull();
      expect(firstInstallmentText(values(), CARDS)).toBeNull();
      expect(
        firstInstallmentText(withCard({ purchaseDate: null }), CARDS),
      ).toBeNull();
    });
  });

  describe("recommendationItems", () => {
    const CANDIDATES = [
      card(),
      // Closes on the 10th: the purchase of the 10th is still in this statement.
      card({
        id: "master",
        title: "Mastercard •••• 9999",
        brand: "MASTERCARD",
        closingDay: 10,
        dueDay: 20,
        limitAmount: 130000000,
      }),
      card({ id: "small", title: "Visa •••• 5555", limitAmount: 100000000 }),
      card({ id: "usd", title: "Visa •••• 4321", currency: "USD" }),
    ];

    it("is null while the amount, the installments or the date are not valid", () => {
      expect(
        recommendationItems(values({ amount: "" }), CANDIDATES),
      ).toBeNull();
      expect(
        recommendationItems(values({ totalCuotas: null }), CANDIDATES),
      ).toBeNull();
      expect(
        recommendationItems(values({ totalCuotas: 1 }), CANDIDATES),
      ).toBeNull();
      expect(
        recommendationItems(values({ purchaseDate: null }), CANDIDATES),
      ).toBeNull();
    });

    it("does not need the product or the category to recommend", () => {
      expect(
        recommendationItems(
          values({ description: "", categoryId: null }),
          CANDIDATES,
        ),
      ).not.toBeNull();
    });

    it("lists the cards in the currency of the purchase, the best first and marked as recommended", () => {
      const items = recommendationItems(values(), CANDIDATES)!;

      expect(
        items.map(({ cardId, recommended }) => [cardId, recommended]),
      ).toEqual([
        ["visa", true],
        ["master", false],
        ["small", false],
      ]);
    });

    it("says how much is left when the purchase fits with room, in the currency of the card", () => {
      const [first] = recommendationItems(values(), CANDIDATES)!;

      expect(first.verdict).toBe("fits");
      expect(first.verdictLabel).toMatch(
        /^Entra en el tope \(te queda \$\s800\.000,00\)$/,
      );
    });

    it("says it is near the cap when it fits but leaves less than a fifth of it", () => {
      const items = recommendationItems(values(), CANDIDATES)!;

      expect(items[1]).toMatchObject({
        verdict: "near",
        verdictLabel: "Cerca del tope",
      });
    });

    it("says by how much the purchase goes over the cap", () => {
      const items = recommendationItems(values(), CANDIDATES)!;

      expect(items[2].verdict).toBe("exceeded");
      expect(items[2].verdictLabel).toMatch(
        /^Se pasa del tope por \$\s200\.000,00$/,
      );
    });

    it("projects each card with its own cycle from the purchase date, chosen card or not", () => {
      const monthly = card({
        id: "monthly",
        limitMode: "MONTHLY",
        limitAmount: 10000000,
        charges: [
          {
            amount: 1,
            date: "2026-11-05",
            currency: "ARS",
            status: "PLANNED",
          },
        ],
      });

      // The first installment lands in November, which already has 1 on this card.
      expect(recommendationItems(values(), [monthly])![0].verdict).toBe(
        "exceeded",
      );
    });

    it("is an empty list when no card is in that currency", () => {
      expect(
        recommendationItems(values(), [card({ currency: "USD" })]),
      ).toEqual([]);
    });
  });

  describe("the ticket", () => {
    const lines = (currentMonth: string, patch: Partial<PurchaseValues> = {}) =>
      toTicketLines(
        parsePurchase(withCard(patch), CARDS, ARS_ONLY)!,
        "Hogar",
        currentMonth,
      );

    it("ends with the card, as an own one, and then the account", () => {
      const result = lines("2026-10");

      expect(result.map(({ label }) => label).slice(-3)).toEqual([
        "Última cuota estimada",
        "Tarjeta",
        "Cuenta",
      ]);
      expect(result.find(({ label }) => label === "Tarjeta")?.value).toBe(
        "Propia · Visa •••• 1234",
      );
      expect(result[result.length - 1]).toEqual({
        label: "Cuenta",
        value: "Banco Galicia · Caja de ahorro",
      });
    });

    it("has no medium line: the account says where the money comes from", () => {
      const labels = lines("2026-10").map(({ label }) => label);

      expect(labels).toContain("Cuenta");
      expect(labels).not.toContain("Medio");
    });

    it("lists the first installment on the date the cycle gives", () => {
      expect(
        lines("2026-10").find(({ label }) => label === "Primera cuota")?.value,
      ).toBe("5 nov 2026");
    });

    it("says the first installment comes next month when it does", () => {
      expect(
        lines("2026-10").find(({ label }) => label === "Primera cuota")?.note,
      ).toBe("La primera cuota entra el mes que viene (5 nov 2026).");
    });

    it("names the month when the first installment is further away than next month", () => {
      expect(
        lines("2026-09").find(({ label }) => label === "Primera cuota")?.note,
      ).toBe("La primera cuota entra en noviembre (5 nov 2026).");
    });

    it("adds no such note when the first installment is charged this month", () => {
      expect(
        lines("2026-11").find(({ label }) => label === "Primera cuota")?.note,
      ).toBeUndefined();
    });

    it("adds no note to a borrowed card: its cycle is unknown", () => {
      const borrowed = toTicketLines(
        parsePurchase(values(), CARDS, ARS_ONLY)!,
        "Hogar",
        "2026-10",
      );

      expect(borrowed.every(({ note }) => note === undefined)).toBe(true);
    });
  });

  describe("the confirmation", () => {
    const summary = () => parsePurchase(withCard(), CARDS, ACCOUNTS)!;

    it("is needed when the card charges the first installment this month", () => {
      expect(needsConfirmation(summary(), "2026-11")).toBe(true);
    });

    it("is not needed when the first installment comes in a later month, or already went by", () => {
      expect(needsConfirmation(summary(), "2026-10")).toBe(false);
      expect(needsConfirmation(summary(), "2026-12")).toBe(false);
    });

    it("is not needed for a borrowed card", () => {
      expect(
        needsConfirmation(parsePurchase(values(), [], ACCOUNTS)!, "2026-10"),
      ).toBe(false);
    });

    it("tells the date and the month the first installment goes into", () => {
      expect(confirmationText(summary())).toBe(
        "La primera cuota se cobra este mes (5 nov 2026) y se va a registrar en tu resumen de noviembre de 2026.",
      );
    });
  });
});

describe("the account of the purchase", () => {
  it("sends the account chosen", () => {
    expect(
      toPayload({ ...values(), accountId: "acc_1" }, [], ACCOUNTS).accountId,
    ).toBe("acc_1");
  });

  it("sends the only account of the currency when none was chosen", () => {
    expect(
      toPayload({ ...values(), accountId: null }, [], ACCOUNTS).accountId,
    ).toBe("acc_1");
  });

  it("sends no account while there are several in the currency and none was chosen", () => {
    expect(
      toPayload(
        { ...values(), accountId: null },
        [],
        [
          ...ACCOUNTS,
          {
            id: "acc_2",
            currency: "ARS",
            label: "Efectivo · Efectivo",
            archived: false,
          },
        ],
      ).accountId,
    ).toBe("");
  });

  it("is not valid without an account", () => {
    expect(parsePurchase({ ...values(), accountId: null }, [], [])).toBeNull();
    // The twin: the same purchase is valid once its currency has an account.
    expect(
      parsePurchase({ ...values(), accountId: null }, [], ACCOUNTS),
    ).not.toBeNull();
  });

  it("is not valid when the accounts argument is missing altogether", () => {
    expect(parsePurchase({ ...values(), accountId: null })).toBeNull();
  });

  it("names the account on the ticket", () => {
    const summary = parsePurchase(
      { ...values(), accountId: "acc_1" },
      [],
      ACCOUNTS,
    );

    expect(summary?.accountLabel).toBe("Banco Galicia · Caja de ahorro");
  });
});

describe("withPurchaseChange", () => {
  it("drops the account when the currency changes", () => {
    expect(
      withPurchaseChange(
        { ...values(), accountId: "acc_1" },
        { currency: "USD" },
        [],
      ).accountId,
    ).toBeNull();
  });

  it("keeps the account when anything else changes", () => {
    expect(
      withPurchaseChange(
        { ...values(), accountId: "acc_1" },
        { notes: "x" },
        [],
      ).accountId,
    ).toBe("acc_1");
  });

  it("keeps the account when the currency is set to the one it already has", () => {
    expect(
      withPurchaseChange(
        { ...values(), accountId: "acc_1" },
        { currency: "ARS" },
        [],
      ).accountId,
    ).toBe("acc_1");
  });

  it("still drops a card of another currency", () => {
    expect(
      withPurchaseChange(
        { ...values(), cardOwnership: "own", cardId: "visa" },
        { currency: "USD" },
        [card()],
      ).cardId,
    ).toBeNull();
    // The twin: a card of the purchase's currency stays.
    expect(
      withPurchaseChange(
        { ...values(), cardOwnership: "own", cardId: "visa" },
        { notes: "x" },
        [card()],
      ).cardId,
    ).toBe("visa");
  });
});
