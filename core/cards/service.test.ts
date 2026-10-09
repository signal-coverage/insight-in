import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are observed on
  // the same mocks.
  $transaction: vi.fn(),
  card: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  cardLimit: { deleteMany: vi.fn(), createMany: vi.fn() },
  bank: { findFirst: vi.fn() },
  expense: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { BankArchivedError, BankNotFoundError } from "@/core/banks/errors";

import {
  CardBankLockedError,
  CardHasPendingExpensesError,
  CardKindLockedError,
  CardNotFoundError,
  DuplicateCardError,
} from "./errors";
import {
  createCard,
  deleteCard,
  findOwnedCard,
  listCards,
  listCardsWithCharges,
  updateCard,
  WITH_CARD_DETAILS,
} from "./service";
import { creditCardRecord, debitCardRecord } from "./testFixtures";
import type { CreditCardInput, DebitCardInput } from "./types";

const { bank, card, cardLimit, expense } = db;

const USER_ID = "user_123";

const creditInput: CreditCardInput = {
  kind: "CREDIT",
  bankId: "bank_1",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  limitMode: "MONTHLY",
  limits: [
    { currency: "ARS", amount: 30000000 },
    { currency: "USD", amount: 100000 },
  ],
};

const debitInput: DebitCardInput = {
  kind: "DEBIT",
  bankId: "bank_1",
  last4: "9999",
  brand: "MASTERCARD",
};

const TWO_LIMITS = [
  { id: "lim_1", cardId: "card_1", currency: "ARS", amount: BigInt(30000000) },
  { id: "lim_2", cardId: "card_1", currency: "USD", amount: BigInt(100000) },
];

// An expense charged to a card: an installment of a plan or a purchase in one payment.
const installmentRow = (patch: Record<string, unknown> = {}) => ({
  amount: BigInt(1000000),
  date: new Date("2026-10-05T00:00:00.000Z"),
  currency: "ARS",
  status: "PLANNED",
  cardId: "card_1",
  ...patch,
});

const uniqueViolation = () =>
  Object.assign(new Error("unique"), { code: "P2002" });

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
});

describe("WITH_CARD_DETAILS", () => {
  it("brings the caps by currency, the bank's name and only its active accounts, oldest first then by id", () => {
    expect(WITH_CARD_DETAILS).toEqual({
      limits: { orderBy: { currency: "asc" } },
      bank: {
        select: {
          name: true,
          accounts: {
            where: { archivedAt: null },
            select: { id: true, name: true, currency: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
    });
  });
});

describe("listCards", () => {
  beforeEach(() => {
    card.findMany.mockResolvedValue([creditCardRecord()]);
    expense.findMany.mockResolvedValue([]);
  });

  it("reads only the user's cards, in the order they were added, with their details", async () => {
    await listCards(USER_ID, "2026-10");

    expect(card.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: WITH_CARD_DETAILS,
    });
  });

  it("reads the user's pending and paid expenses that have a card, in one query for every card", async () => {
    await listCards(USER_ID, "2026-10");

    expect(expense.findMany).toHaveBeenCalledTimes(1);
    expect(expense.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        cardId: { not: null },
        status: { in: ["PLANNED", "SETTLED"] },
      },
      select: {
        amount: true,
        date: true,
        currency: true,
        status: true,
        cardId: true,
      },
    });
  });

  it("returns a credit card as a plain card, its caps as numbers, with one usage per cap", async () => {
    card.findMany.mockResolvedValue([creditCardRecord({ limits: TWO_LIMITS })]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first).toMatchObject({
      kind: "CREDIT",
      id: "card_1",
      bankId: "bank_1",
      bankName: "Banco Galicia",
      last4: "1234",
      brand: "VISA",
      closingDay: 25,
      dueDay: 5,
      limitMode: "MONTHLY",
      limits: [
        { currency: "ARS", amount: 30000000 },
        { currency: "USD", amount: 100000 },
      ],
    });
    expect(
      first.usage.map(({ currency, amount }) => [currency, amount]),
    ).toEqual([
      ["ARS", 30000000],
      ["USD", 100000],
    ]);
    expect(first).not.toHaveProperty("userId");
  });

  it("measures each cap only with the charges in its own currency, never adding currencies", async () => {
    card.findMany.mockResolvedValue([creditCardRecord({ limits: TWO_LIMITS })]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(1000000) }),
      installmentRow({ amount: BigInt(5000), currency: "USD" }),
    ]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first.usage).toEqual([
      expect.objectContaining({
        currency: "ARS",
        used: 1000000,
        available: 29000000,
      }),
      expect.objectContaining({
        currency: "USD",
        used: 5000,
        available: 95000,
      }),
    ]);
  });

  it("measures a MONTHLY card by what falls in the month asked for", async () => {
    expense.findMany.mockResolvedValue([
      installmentRow({
        amount: BigInt(1000000),
        date: new Date("2026-10-05T00:00:00.000Z"),
      }),
      installmentRow({
        amount: BigInt(2500000),
        date: new Date("2026-10-28T00:00:00.000Z"),
      }),
      installmentRow({
        amount: BigInt(4000000),
        date: new Date("2026-11-05T00:00:00.000Z"),
      }),
    ]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first.usage[0]).toMatchObject({
      committedTotal: 7500000,
      monthUsed: 3500000,
      used: 3500000,
      available: 26500000,
      tier: "available",
    });
  });

  it("measures a TOTAL card by everything it has committed", async () => {
    card.findMany.mockResolvedValue([
      creditCardRecord({ limitMode: "TOTAL", limitAmount: 10000000 }),
    ]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(1000000) }),
      installmentRow({
        amount: BigInt(8500000),
        date: new Date("2027-02-05T00:00:00.000Z"),
      }),
    ]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first.usage[0]).toMatchObject({
      used: 9500000,
      available: 500000,
      tier: "near",
    });
  });

  it("gives each card only the expenses charged to it", async () => {
    card.findMany.mockResolvedValue([
      creditCardRecord(),
      creditCardRecord({ id: "card_2", last4: "9999", limitMode: "TOTAL" }),
    ]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(100) }),
      installmentRow({ amount: BigInt(200), cardId: "card_2" }),
      installmentRow({ amount: BigInt(400), cardId: "card_2" }),
      installmentRow({ amount: BigInt(800), cardId: "someone_elses" }),
    ]);

    const [first, second] = await listCards(USER_ID, "2026-10");

    expect(first.usage[0].committedTotal).toBe(100);
    expect(second.usage[0].committedTotal).toBe(600);
  });

  it("counts a MONTHLY card's paid expenses of the month, but not a TOTAL card's", async () => {
    card.findMany.mockResolvedValue([
      creditCardRecord(),
      creditCardRecord({ id: "card_2", last4: "9999", limitMode: "TOTAL" }),
    ]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(300), status: "SETTLED" }),
      installmentRow({ amount: BigInt(100) }),
      installmentRow({
        amount: BigInt(300),
        status: "SETTLED",
        cardId: "card_2",
      }),
      installmentRow({ amount: BigInt(100), cardId: "card_2" }),
    ]);

    const [monthly, total] = await listCards(USER_ID, "2026-10");

    expect(monthly.usage[0]).toMatchObject({ used: 400, committedTotal: 100 });
    expect(total.usage[0]).toMatchObject({ used: 100, committedTotal: 100 });
  });

  it("returns a debit card with one active account per currency of its bank (the oldest), and no usage", async () => {
    card.findMany.mockResolvedValue([
      debitCardRecord({
        bank: {
          name: "AstroPay",
          accounts: [
            { id: "acc_ars", name: "Pesos", currency: "ARS" },
            { id: "acc_usd", name: "Dólares", currency: "USD" },
            { id: "acc_ars_2", name: "Pesos 2", currency: "ARS" },
          ],
        },
      }),
    ]);

    await expect(listCards(USER_ID, "2026-10")).resolves.toEqual([
      {
        kind: "DEBIT",
        id: "card_9",
        bankId: "bank_1",
        bankName: "AstroPay",
        last4: "9999",
        brand: "VISA",
        accounts: [
          { id: "acc_ars", currency: "ARS", label: "AstroPay · Pesos" },
          { id: "acc_usd", currency: "USD", label: "AstroPay · Dólares" },
        ],
        usage: [],
      },
    ]);
  });

  it("counts an expense quoted in another currency by what really left the money: the reference price is never read", async () => {
    // A 20 USD purchase that cost 35.000 ARS on the card: only the 35.000 weighs on the cap.
    expense.findMany.mockResolvedValue([
      installmentRow({
        amount: BigInt(3500000),
        originCurrency: "USD",
        originAmount: BigInt(2000),
      }),
    ]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first.usage[0]).toMatchObject({
      monthUsed: 3500000,
      committedTotal: 3500000,
    });
    expect(
      Object.keys(expense.findMany.mock.calls[0][0].select).filter((key) =>
        key.startsWith("origin"),
      ),
    ).toEqual([]);
  });

  it("does not count charges in a currency the card has no cap in", async () => {
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(100), currency: "USD" }),
    ]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first.usage).toHaveLength(1);
    expect(first.usage[0]).toMatchObject({
      currency: "ARS",
      committedTotal: 0,
    });
  });

  it("returns no cards for a user who has none", async () => {
    card.findMany.mockResolvedValue([]);

    await expect(listCards(USER_ID, "2026-10")).resolves.toEqual([]);
  });

  it("defaults to the current month in Argentina", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(100) }),
    ]);

    try {
      const [first] = await listCards(USER_ID);

      expect(first.usage[0].monthUsed).toBe(100);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createCard", () => {
  beforeEach(() => {
    bank.findFirst.mockResolvedValue({ archivedAt: null });
    card.create.mockResolvedValue(creditCardRecord());
  });

  it("checks the bank is the user's before writing", async () => {
    await createCard(USER_ID, creditInput);

    expect(bank.findFirst).toHaveBeenCalledWith({
      where: { id: "bank_1", userId: USER_ID },
      select: { archivedAt: true },
    });
    expect(card.create).toHaveBeenCalledTimes(1);
  });

  it("writes nothing for a bank that is not the user's", async () => {
    bank.findFirst.mockResolvedValue(null);

    await expect(createCard(USER_ID, creditInput)).rejects.toBeInstanceOf(
      BankNotFoundError,
    );
    expect(card.create).not.toHaveBeenCalled();
  });

  it("writes nothing for an archived bank", async () => {
    bank.findFirst.mockResolvedValue({ archivedAt: new Date() });

    await expect(createCard(USER_ID, debitInput)).rejects.toBeInstanceOf(
      BankArchivedError,
    );
    expect(card.create).not.toHaveBeenCalled();
  });

  it("stores a credit card with its cycle, its mode and its caps as BigInt", async () => {
    await createCard(USER_ID, creditInput);

    expect(card.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        kind: "CREDIT",
        bankId: "bank_1",
        last4: "1234",
        brand: "VISA",
        closingDay: 25,
        dueDay: 5,
        limitMode: "MONTHLY",
        limits: {
          create: [
            { currency: "ARS", amount: BigInt(30000000) },
            { currency: "USD", amount: BigInt(100000) },
          ],
        },
      },
      include: WITH_CARD_DETAILS,
    });
  });

  it("stores a debit card with none of the credit fields and no caps", async () => {
    card.create.mockResolvedValue(debitCardRecord());

    await createCard(USER_ID, debitInput);

    expect(card.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        kind: "DEBIT",
        bankId: "bank_1",
        last4: "9999",
        brand: "MASTERCARD",
        closingDay: null,
        dueDay: null,
        limitMode: null,
        limits: { create: [] },
      },
      include: WITH_CARD_DETAILS,
    });
  });

  it("returns the card it stored", async () => {
    await expect(createCard(USER_ID, creditInput)).resolves.toMatchObject({
      id: "card_1",
      kind: "CREDIT",
      limits: [{ currency: "ARS", amount: 30000000 }],
    });
  });

  it("says so when the user already has that brand ending in those digits", async () => {
    card.create.mockRejectedValue(uniqueViolation());

    await expect(createCard(USER_ID, creditInput)).rejects.toEqual(
      new DuplicateCardError("VISA", "1234"),
    );
  });

  it("lets any other failure through", async () => {
    card.create.mockRejectedValue(new Error("db down"));

    await expect(createCard(USER_ID, creditInput)).rejects.toThrow("db down");
  });
});

describe("updateCard", () => {
  beforeEach(() => {
    card.findFirst.mockResolvedValue({ kind: "CREDIT", bankId: "bank_1" });
    card.updateMany.mockResolvedValue({ count: 1 });
    cardLimit.deleteMany.mockResolvedValue({ count: 1 });
    cardLimit.createMany.mockResolvedValue({ count: 2 });
  });

  it("reads the card among the user's own, inside the transaction", async () => {
    await updateCard(USER_ID, "card_1", creditInput);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(card.findFirst).toHaveBeenCalledWith({
      where: { id: "card_1", userId: USER_ID },
      select: { kind: true, bankId: true },
    });
  });

  it("changes the fields (never the kind, the bank or the owner) and replaces the caps", async () => {
    await updateCard(USER_ID, "card_1", creditInput);

    expect(card.updateMany).toHaveBeenCalledWith({
      where: { id: "card_1", userId: USER_ID },
      data: {
        last4: "1234",
        brand: "VISA",
        closingDay: 25,
        dueDay: 5,
        limitMode: "MONTHLY",
      },
    });
    expect(cardLimit.deleteMany).toHaveBeenCalledWith({
      where: { cardId: "card_1" },
    });
    expect(cardLimit.createMany).toHaveBeenCalledWith({
      data: [
        { cardId: "card_1", currency: "ARS", amount: BigInt(30000000) },
        { cardId: "card_1", currency: "USD", amount: BigInt(100000) },
      ],
    });
  });

  it("keeps a debit card without credit fields or caps", async () => {
    card.findFirst.mockResolvedValue({ kind: "DEBIT", bankId: "bank_1" });

    await updateCard(USER_ID, "card_9", debitInput);

    expect(card.updateMany).toHaveBeenCalledWith({
      where: { id: "card_9", userId: USER_ID },
      data: {
        last4: "9999",
        brand: "MASTERCARD",
        closingDay: null,
        dueDay: null,
        limitMode: null,
      },
    });
    expect(cardLimit.deleteMany).toHaveBeenCalledWith({
      where: { cardId: "card_9" },
    });
    expect(cardLimit.createMany).not.toHaveBeenCalled();
  });

  it("is not found, and writes nothing, when the card is not the user's", async () => {
    card.findFirst.mockResolvedValue(null);

    await expect(
      updateCard(USER_ID, "card_9", creditInput),
    ).rejects.toBeInstanceOf(CardNotFoundError);
    expect(card.updateMany).not.toHaveBeenCalled();
  });

  it("is not found when the card disappears before the write", async () => {
    card.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateCard(USER_ID, "card_1", creditInput),
    ).rejects.toBeInstanceOf(CardNotFoundError);
    expect(cardLimit.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses to change the kind, writing nothing", async () => {
    await expect(
      updateCard(USER_ID, "card_1", { ...debitInput }),
    ).rejects.toBeInstanceOf(CardKindLockedError);
    expect(card.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to move the card to another bank, writing nothing", async () => {
    await expect(
      updateCard(USER_ID, "card_1", { ...creditInput, bankId: "bank_2" }),
    ).rejects.toBeInstanceOf(CardBankLockedError);
    expect(card.updateMany).not.toHaveBeenCalled();
  });

  it("says so when it would clash with another card of the user", async () => {
    card.updateMany.mockRejectedValue(uniqueViolation());

    await expect(updateCard(USER_ID, "card_1", creditInput)).rejects.toEqual(
      new DuplicateCardError("VISA", "1234"),
    );
  });

  it("lets any other failure through", async () => {
    card.updateMany.mockRejectedValue(new Error("db down"));

    await expect(updateCard(USER_ID, "card_1", creditInput)).rejects.toThrow(
      "db down",
    );
  });
});

describe("deleteCard", () => {
  beforeEach(() => {
    card.findFirst.mockResolvedValue({ id: "card_1" });
    expense.count.mockResolvedValue(0);
    card.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("looks for the card among the user's own", async () => {
    await deleteCard(USER_ID, "card_1");

    expect(card.findFirst).toHaveBeenCalledWith({
      where: { id: "card_1", userId: USER_ID },
      select: { id: true },
    });
  });

  it("is not found, and deletes nothing, when the card is not the user's", async () => {
    card.findFirst.mockResolvedValue(null);

    await expect(deleteCard(USER_ID, "card_9")).rejects.toBeInstanceOf(
      CardNotFoundError,
    );
    expect(card.deleteMany).not.toHaveBeenCalled();
  });

  it("is blocked while an expense charged to the card is still pending", async () => {
    expense.count.mockResolvedValue(3);

    await expect(deleteCard(USER_ID, "card_1")).rejects.toBeInstanceOf(
      CardHasPendingExpensesError,
    );
    expect(card.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes the card once nothing is pending, for the user only", async () => {
    await deleteCard(USER_ID, "card_1");

    expect(expense.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, status: "PLANNED", cardId: "card_1" },
    });
    expect(card.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "card_1",
        userId: USER_ID,
        expenses: { none: { status: "PLANNED" } },
      },
    });
  });

  it("is blocked, not reported missing, when an expense became pending after the count", async () => {
    expense.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    card.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteCard(USER_ID, "card_1")).rejects.toBeInstanceOf(
      CardHasPendingExpensesError,
    );
  });
});

describe("deleteCard when the card vanishes", () => {
  it("is not found when the card disappears before it is deleted", async () => {
    card.findFirst.mockResolvedValue({ id: "card_1" });
    expense.count.mockResolvedValue(0);
    card.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteCard(USER_ID, "card_1")).rejects.toBeInstanceOf(
      CardNotFoundError,
    );
    expect(card.deleteMany).toHaveBeenCalledTimes(1);
  });
});

describe("findOwnedCard", () => {
  it("returns a credit card of the user, with its details", async () => {
    card.findFirst.mockResolvedValue(creditCardRecord());

    const found = await findOwnedCard(USER_ID, "card_1");

    expect(card.findFirst).toHaveBeenCalledWith({
      where: { id: "card_1", userId: USER_ID },
      include: WITH_CARD_DETAILS,
    });
    expect(found).toMatchObject({
      kind: "CREDIT",
      id: "card_1",
      closingDay: 25,
      dueDay: 5,
      limits: [{ currency: "ARS", amount: 30000000 }],
    });
    expect(found).not.toHaveProperty("userId");
  });

  it("returns a debit card of the user with its bank's active accounts", async () => {
    card.findFirst.mockResolvedValue(debitCardRecord());

    await expect(findOwnedCard(USER_ID, "card_9")).resolves.toEqual({
      kind: "DEBIT",
      id: "card_9",
      bankId: "bank_1",
      bankName: "Banco Galicia",
      last4: "9999",
      brand: "VISA",
      accounts: [
        {
          id: "acc_1",
          currency: "ARS",
          label: "Banco Galicia · Caja de ahorro",
        },
      ],
    });
  });

  it("throws for a card that is not the user's", async () => {
    card.findFirst.mockResolvedValue(null);

    await expect(findOwnedCard(USER_ID, "card_9")).rejects.toBeInstanceOf(
      CardNotFoundError,
    );
  });

  it("refuses a credit row that lost its cycle: the table's CHECK should make it impossible", async () => {
    card.findFirst.mockResolvedValue(creditCardRecord({ closingDay: null }));

    await expect(findOwnedCard(USER_ID, "card_1")).rejects.toEqual(
      new Error("The credit card card_1 has no cycle"),
    );
  });
});

describe("listCardsWithCharges", () => {
  it("gives each of the user's cards the charges made with it", async () => {
    card.findMany.mockResolvedValue([creditCardRecord(), debitCardRecord()]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(100) }),
      installmentRow({
        amount: BigInt(300),
        status: "SETTLED",
        date: new Date("2026-11-05T00:00:00.000Z"),
      }),
    ]);

    const [first, second] = await listCardsWithCharges(USER_ID);

    expect(first.charges).toEqual([
      { amount: 100, date: "2026-10-05", currency: "ARS", status: "PLANNED" },
      { amount: 300, date: "2026-11-05", currency: "ARS", status: "SETTLED" },
    ]);
    expect(second).toMatchObject({ kind: "DEBIT", charges: [] });
    expect(first).not.toHaveProperty("userId");
  });
});
