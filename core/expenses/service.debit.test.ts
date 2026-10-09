import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The transaction gets its own client, so the tests can tell what ran inside it from what did not.
const tx = vi.hoisted(() => ({
  expense: { create: vi.fn(), updateMany: vi.fn() },
  recurringExpense: { create: vi.fn() },
  recurringExpenseDecision: { create: vi.fn() },
}));

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  expense: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  card: { findFirst: vi.fn() },
  expenseCategory: { findFirst: vi.fn() },
}));

const usable = vi.hoisted(() => ({ assertUsableAccount: vi.fn() }));
const locks = vi.hoisted(() => ({ lockAccount: vi.fn() }));
const balances = vi.hoisted(() => ({ readAccountBalances: vi.fn() }));
const reimbursements = vi.hoisted(() => ({
  countLinkedIncomes: vi.fn(),
  listReceivedTotals: vi.fn(),
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/accounts/usable", () => usable);
vi.mock("@/core/accounts/locks", () => locks);
vi.mock("@/core/balances/accountBalances", () => balances);
vi.mock("@/core/reimbursements/service", () => reimbursements);

import { CardBankWithoutAccountError } from "@/core/cards/errors";
import { creditCardRecord, debitCardRecord } from "@/core/cards/testFixtures";

import {
  ExpenseAccountRequiredError,
  ExpenseChangedError,
  ExpenseFutureDebitError,
  ExpenseInsufficientFundsError,
} from "./errors";
import { createExpense, setExpenseStatus, updateExpense } from "./service";
import type { ExpenseInput } from "./types";

const USER_ID = "user_123";
const AT = new Date("2026-10-06T10:00:00.000Z");

// A debit card of Banco Galicia, whose only active account is the ARS "Caja de ahorro" (acc_1).
const input: ExpenseInput = {
  description: "Supermercado",
  amount: 500000,
  currency: "ARS",
  date: "2026-10-05",
  categoryId: "cat_1",
  notes: null,
  status: "SETTLED",
  accountId: null,
  isRecurring: false,
  cardId: "card_9",
  originCurrency: null,
  originAmount: null,
  expectedReimbursement: null,
};

const ROW = {
  id: "exp_1",
  userId: USER_ID,
  description: "Supermercado",
  amount: BigInt(500000),
  currency: "ARS",
  date: new Date("2026-10-05T00:00:00.000Z"),
  categoryId: "cat_1",
  category: { name: "Comida" },
  notes: null,
  status: "SETTLED",
  accountId: "acc_1",
  account: { name: "Caja de ahorro", bank: { name: "Banco Galicia" } },
  isRecurring: false,
  originCurrency: null,
  originAmount: null,
  expectedReimbursement: null,
  recurringExpenseId: null,
  installmentPlanId: null,
  installmentNumber: null,
  cardId: "card_9",
  purchaseDate: null,
  createdAt: AT,
  updatedAt: AT,
};

const LOCKED = { id: "acc_1", currency: "ARS", archivedAt: null };

const balance = (amount: number, accountId = "acc_1") => [
  { accountId, currency: "ARS", balance: amount },
];

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (client: typeof tx) => unknown) =>
    run(tx),
  );
  db.expenseCategory.findFirst.mockResolvedValue({ id: "cat_1" });
  db.card.findFirst.mockResolvedValue(debitCardRecord());
  locks.lockAccount.mockResolvedValue(LOCKED);
  balances.readAccountBalances.mockResolvedValue(balance(1000000));
  reimbursements.countLinkedIncomes.mockResolvedValue(0);
  tx.expense.create.mockResolvedValue(ROW);
  db.expense.create.mockResolvedValue(ROW);
  tx.expense.updateMany.mockResolvedValue({ count: 1 });
  db.expense.updateMany.mockResolvedValue({ count: 1 });
});

describe("createExpense with a debit card", () => {
  it("takes the money from its bank's active account in the expense's currency, whatever account the form sent", async () => {
    await createExpense(USER_ID, { ...input, accountId: "acc_other" });

    expect(tx.expense.create.mock.calls[0][0].data).toMatchObject({
      accountId: "acc_1",
      cardId: "card_9",
      purchaseDate: null,
      date: new Date("2026-10-05T00:00:00.000Z"),
    });
  });

  it("checks the resolved account like any other: the user's, active and in the currency", async () => {
    await createExpense(USER_ID, input);

    expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
      accountId: "acc_1",
      currency: "ARS",
      keepAccountId: null,
    });
  });

  it("locks the account, then reads its balance on the expense's date and now, then writes, all in one transaction", async () => {
    const order: string[] = [];

    locks.lockAccount.mockImplementation(async () => {
      order.push("lock");

      return LOCKED;
    });
    balances.readAccountBalances.mockImplementation(async () => {
      order.push("read");

      return balance(1000000);
    });
    tx.expense.create.mockImplementation(async () => {
      order.push("write");

      return ROW;
    });

    await createExpense(USER_ID, input);

    expect(order).toEqual(["lock", "read", "read", "write"]);
    expect(locks.lockAccount).toHaveBeenCalledWith(tx, USER_ID, "acc_1");
    expect(balances.readAccountBalances.mock.calls).toEqual([
      [
        tx,
        USER_ID,
        ["acc_1"],
        { asOf: "2026-10-05", excludeExpenseId: undefined },
      ],
      [tx, USER_ID, ["acc_1"], { excludeExpenseId: undefined }],
    ]);
    expect(db.expense.create).not.toHaveBeenCalled();
  });

  it("refuses a paid expense the account cannot cover, naming the lower of the two balances, and writes nothing", async () => {
    balances.readAccountBalances
      .mockResolvedValueOnce(balance(800000))
      .mockResolvedValueOnce(balance(300000));

    await expect(createExpense(USER_ID, input)).rejects.toEqual(
      new ExpenseInsufficientFundsError(300000, "ARS"),
    );
    expect(tx.expense.create).not.toHaveBeenCalled();
  });

  it("takes an expense that leaves the account at exactly zero", async () => {
    balances.readAccountBalances.mockResolvedValue(balance(500000));

    await createExpense(USER_ID, input);

    expect(tx.expense.create).toHaveBeenCalledTimes(1);
  });

  it.each(["PLANNED", "COVERED"] as const)(
    "saves a %s one without locking or reading any balance: it moves no money yet",
    async (status) => {
      await createExpense(USER_ID, { ...input, status });

      expect(locks.lockAccount).not.toHaveBeenCalled();
      expect(balances.readAccountBalances).not.toHaveBeenCalled();
      expect(db.expense.create.mock.calls[0][0].data).toMatchObject({
        accountId: "acc_1",
        status,
      });
    },
  );

  it("refuses a currency its bank has no active account in, writing nothing", async () => {
    await expect(
      createExpense(USER_ID, { ...input, currency: "EUR" }),
    ).rejects.toEqual(new CardBankWithoutAccountError("EUR"));
    expect(tx.expense.create).not.toHaveBeenCalled();
    expect(db.expense.create).not.toHaveBeenCalled();
  });

  it("refuses when the account was archived between the read and the lock, reading no balance", async () => {
    locks.lockAccount.mockResolvedValue({ ...LOCKED, archivedAt: AT });

    await expect(createExpense(USER_ID, input)).rejects.toBeInstanceOf(
      CardBankWithoutAccountError,
    );
    expect(balances.readAccountBalances).not.toHaveBeenCalled();
  });

  it("saves a recurring one with its card-less template in the resolved account, in the transaction of the check", async () => {
    tx.recurringExpense.create.mockResolvedValue({ id: "tpl_1" });

    await createExpense(USER_ID, { ...input, isRecurring: true });

    expect(tx.recurringExpense.create.mock.calls[0][0].data).toMatchObject({
      accountId: "acc_1",
    });
    expect(tx.recurringExpense.create.mock.calls[0][0].data).not.toHaveProperty(
      "cardId",
    );
    expect(tx.expense.create.mock.calls[0][0].data).toMatchObject({
      recurringExpenseId: "tpl_1",
      isRecurring: true,
    });
  });
});

describe("createExpense with a credit card", () => {
  beforeEach(() => {
    db.card.findFirst.mockResolvedValue(creditCardRecord());
  });

  it("reads no balance: the account only pays the statement later", async () => {
    await createExpense(USER_ID, {
      ...input,
      cardId: "card_1",
      accountId: "acc_1",
    });

    expect(locks.lockAccount).not.toHaveBeenCalled();
    expect(db.expense.create).toHaveBeenCalledTimes(1);
  });

  it("still needs the account chosen in the form", async () => {
    await expect(
      createExpense(USER_ID, { ...input, cardId: "card_1", accountId: null }),
    ).rejects.toBeInstanceOf(ExpenseAccountRequiredError);
    expect(db.expense.create).not.toHaveBeenCalled();
  });
});

describe("updateExpense with a debit card", () => {
  const stored = (patch: Record<string, unknown> = {}) =>
    db.expense.findFirst.mockResolvedValue({
      recurringExpenseId: null,
      installmentPlanId: null,
      currency: "ARS",
      expectedReimbursement: null,
      accountId: "acc_1",
      cardId: "card_9",
      amount: BigInt(500000),
      date: new Date("2026-10-05T00:00:00.000Z"),
      status: "SETTLED",
      ...patch,
    });

  it("saves an edit of the notes alone without reading any balance, keeping the account even if the bank has none now", async () => {
    stored();
    db.card.findFirst.mockResolvedValue(
      debitCardRecord({ bank: { name: "Banco Galicia", accounts: [] } }),
    );

    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, notes: "Con descuento" }),
    ).resolves.toBe(true);
    expect(locks.lockAccount).not.toHaveBeenCalled();
    expect(balances.readAccountBalances).not.toHaveBeenCalled();
    expect(db.expense.updateMany.mock.calls[0][0].data).toMatchObject({
      accountId: "acc_1",
      notes: "Con descuento",
    });
  });

  it("checks a higher amount against the balance without the expense itself", async () => {
    stored();
    balances.readAccountBalances.mockResolvedValue(balance(600000));

    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, amount: 600000 }),
    ).resolves.toBe(true);
    expect(balances.readAccountBalances.mock.calls).toEqual([
      [
        tx,
        USER_ID,
        ["acc_1"],
        { asOf: "2026-10-05", excludeExpenseId: "exp_1" },
      ],
      [tx, USER_ID, ["acc_1"], { excludeExpenseId: "exp_1" }],
    ]);
    expect(tx.expense.updateMany).toHaveBeenCalledTimes(1);
  });

  it("refuses a higher amount the account cannot cover, writing nothing", async () => {
    stored();
    balances.readAccountBalances.mockResolvedValue(balance(550000));

    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, amount: 600000 }),
    ).rejects.toEqual(new ExpenseInsufficientFundsError(550000, "ARS"));
    expect(tx.expense.updateMany).not.toHaveBeenCalled();
    expect(db.expense.updateMany).not.toHaveBeenCalled();
  });

  it("checks a pending one that is saved as paid, letting the lock keep the account it already has even if archived", async () => {
    stored({ status: "PLANNED" });
    locks.lockAccount.mockResolvedValue({ ...LOCKED, archivedAt: AT });

    await expect(updateExpense(USER_ID, "exp_1", input)).resolves.toBe(true);
    expect(locks.lockAccount).toHaveBeenCalledWith(tx, USER_ID, "acc_1");
    expect(tx.expense.updateMany).toHaveBeenCalledTimes(1);
  });

  it("takes no check when the expense leaves the debit card: the account only gains", async () => {
    stored();

    await updateExpense(USER_ID, "exp_1", {
      ...input,
      cardId: null,
      accountId: "acc_1",
    });

    expect(locks.lockAccount).not.toHaveBeenCalled();
    expect(db.expense.updateMany.mock.calls[0][0].data).toMatchObject({
      cardId: null,
    });
  });

  it("resolves the account again when the currency changes, and checks the new one", async () => {
    stored();
    db.card.findFirst.mockResolvedValue(
      debitCardRecord({
        bank: {
          name: "Banco Galicia",
          accounts: [
            { id: "acc_1", name: "Caja de ahorro", currency: "ARS" },
            { id: "acc_usd", name: "Cuenta en dólares", currency: "USD" },
          ],
        },
      }),
    );
    locks.lockAccount.mockResolvedValue({
      id: "acc_usd",
      currency: "USD",
      archivedAt: null,
    });
    balances.readAccountBalances.mockResolvedValue([
      { accountId: "acc_usd", currency: "USD", balance: 100000 },
    ]);

    await updateExpense(USER_ID, "exp_1", {
      ...input,
      currency: "USD",
      amount: 1000,
    });

    expect(locks.lockAccount).toHaveBeenCalledWith(tx, USER_ID, "acc_usd");
    expect(tx.expense.updateMany.mock.calls[0][0].data).toMatchObject({
      accountId: "acc_usd",
      currency: "USD",
    });
  });
});

describe("setExpenseStatus on a debit expense", () => {
  const pending = (patch: Record<string, unknown> = {}) =>
    db.expense.findFirst.mockResolvedValue({
      status: "PLANNED",
      amount: BigInt(500000),
      currency: "ARS",
      date: new Date("2026-10-05T00:00:00.000Z"),
      accountId: "acc_1",
      cardId: "card_9",
      card: { kind: "DEBIT" },
      ...patch,
    });

  it("marks it paid only after checking its account, in one transaction", async () => {
    pending();

    await expect(setExpenseStatus(USER_ID, "exp_1", "SETTLED")).resolves.toBe(
      true,
    );
    expect(db.expense.findFirst).toHaveBeenCalledWith({
      where: { id: "exp_1", userId: USER_ID },
      select: {
        status: true,
        amount: true,
        currency: true,
        date: true,
        accountId: true,
        cardId: true,
        card: { select: { kind: true } },
      },
    });
    expect(locks.lockAccount).toHaveBeenCalledWith(tx, USER_ID, "acc_1");
    expect(balances.readAccountBalances.mock.calls[1]).toEqual([
      tx,
      USER_ID,
      ["acc_1"],
      { excludeExpenseId: "exp_1" },
    ]);
    expect(tx.expense.updateMany).toHaveBeenCalledWith({
      where: { ...SNAPSHOT_WHERE, status: "PLANNED" },
      data: { status: "SETTLED" },
    });
  });

  it("refuses to mark it paid when the account cannot cover it", async () => {
    pending();
    balances.readAccountBalances.mockResolvedValue(balance(100));

    await expect(
      setExpenseStatus(USER_ID, "exp_1", "SETTLED"),
    ).rejects.toBeInstanceOf(ExpenseInsufficientFundsError);
    expect(tx.expense.updateMany).not.toHaveBeenCalled();
  });

  it("marks a credit card's or a card-less expense paid without looking at any account", async () => {
    pending({ card: { kind: "CREDIT" } });
    await setExpenseStatus(USER_ID, "exp_1", "SETTLED");
    pending({ card: null });
    await setExpenseStatus(USER_ID, "exp_1", "SETTLED");

    expect(locks.lockAccount).not.toHaveBeenCalled();
    expect(db.expense.updateMany).toHaveBeenCalledTimes(2);
  });

  it("takes it back to pending with no look-up at all", async () => {
    await setExpenseStatus(USER_ID, "exp_1", "PLANNED");

    expect(db.expense.findFirst).not.toHaveBeenCalled();
    expect(db.expense.updateMany).toHaveBeenCalledWith({
      where: { id: "exp_1", userId: USER_ID },
      data: { status: "PLANNED" },
    });
  });

  it("is false for an expense that is not the user's", async () => {
    db.expense.findFirst.mockResolvedValue(null);

    await expect(setExpenseStatus(USER_ID, "exp_9", "SETTLED")).resolves.toBe(
      false,
    );
    expect(db.expense.updateMany).not.toHaveBeenCalled();
  });
});

// The clock is pinned to noon of TODAY in Argentina, so "today" and "tomorrow" never move under a test.
const TODAY = "2026-10-06";
const TOMORROW = "2026-10-07";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T15:00:00.000Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

const STORED_PAID = {
  recurringExpenseId: null,
  installmentPlanId: null,
  currency: "ARS",
  expectedReimbursement: null,
  accountId: "acc_1",
  cardId: "card_9",
  amount: BigInt(500000),
  date: new Date("2026-10-05T00:00:00.000Z"),
  status: "SETTLED",
};

const SNAPSHOT_WHERE = {
  id: "exp_1",
  userId: USER_ID,
  status: "SETTLED",
  amount: BigInt(500000),
  accountId: "acc_1",
  cardId: "card_9",
  currency: "ARS",
  date: new Date("2026-10-05T00:00:00.000Z"),
};

describe("an expense that changes between its read and its write", () => {
  it("writes an edit only onto the expense as it was read", async () => {
    db.expense.findFirst.mockResolvedValue(STORED_PAID);

    await expect(updateExpense(USER_ID, "exp_1", input)).resolves.toBe(true);
    expect(db.expense.updateMany.mock.calls[0][0].where).toEqual(
      SNAPSHOT_WHERE,
    );
  });

  it("refuses an edit that matches nothing any more, instead of reporting it as not found", async () => {
    db.expense.findFirst.mockResolvedValue(STORED_PAID);
    db.expense.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateExpense(USER_ID, "exp_1", input)).rejects.toBeInstanceOf(
      ExpenseChangedError,
    );
  });

  it("does the same for an edit that is checked in a transaction", async () => {
    db.expense.findFirst.mockResolvedValue({
      ...STORED_PAID,
      status: "PLANNED",
    });
    tx.recurringExpense.create.mockResolvedValue({ id: "tpl_1" });
    tx.recurringExpenseDecision.create.mockResolvedValue({});
    tx.expense.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, isRecurring: true }),
    ).rejects.toBeInstanceOf(ExpenseChangedError);
    expect(tx.expense.updateMany.mock.calls[0][0].where).toEqual({
      ...SNAPSHOT_WHERE,
      status: "PLANNED",
    });
  });

  it("still says false for an expense that does not exist at all", async () => {
    db.expense.findFirst.mockResolvedValue(null);

    await expect(updateExpense(USER_ID, "exp_9", input)).resolves.toBe(false);
  });

  it("marks a pending debit expense paid only if it is still as it was read", async () => {
    db.expense.findFirst.mockResolvedValue({
      status: "PLANNED",
      amount: BigInt(500000),
      currency: "ARS",
      date: new Date("2026-10-05T00:00:00.000Z"),
      accountId: "acc_1",
      cardId: "card_9",
      card: { kind: "DEBIT" },
    });

    await expect(setExpenseStatus(USER_ID, "exp_1", "SETTLED")).resolves.toBe(
      true,
    );
    expect(tx.expense.updateMany.mock.calls[0][0].where).toEqual({
      ...SNAPSHOT_WHERE,
      status: "PLANNED",
    });

    tx.expense.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      setExpenseStatus(USER_ID, "exp_1", "SETTLED"),
    ).rejects.toBeInstanceOf(ExpenseChangedError);
  });

  it("does the same when any other expense is marked paid", async () => {
    db.expense.findFirst.mockResolvedValue({
      status: "PLANNED",
      amount: BigInt(500000),
      currency: "ARS",
      date: new Date("2026-10-05T00:00:00.000Z"),
      accountId: "acc_1",
      cardId: null,
      card: null,
    });

    await expect(setExpenseStatus(USER_ID, "exp_1", "SETTLED")).resolves.toBe(
      true,
    );
    expect(db.expense.updateMany.mock.calls[0][0].where).toEqual({
      ...SNAPSHOT_WHERE,
      status: "PLANNED",
      cardId: null,
    });

    db.expense.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      setExpenseStatus(USER_ID, "exp_1", "SETTLED"),
    ).rejects.toBeInstanceOf(ExpenseChangedError);
  });
});

describe("a paid debit expense dated in the future", () => {
  it("is refused on create, before the account is locked, and today is allowed", async () => {
    await expect(
      createExpense(USER_ID, { ...input, date: TOMORROW }),
    ).rejects.toBeInstanceOf(ExpenseFutureDebitError);
    expect(locks.lockAccount).not.toHaveBeenCalled();
    expect(tx.expense.create).not.toHaveBeenCalled();

    await createExpense(USER_ID, { ...input, date: TODAY });

    expect(tx.expense.create).toHaveBeenCalledTimes(1);
  });

  it("is refused on an edit that moves it to tomorrow, and an edit to today is allowed", async () => {
    db.expense.findFirst.mockResolvedValue(STORED_PAID);

    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, date: TOMORROW }),
    ).rejects.toBeInstanceOf(ExpenseFutureDebitError);
    expect(tx.expense.updateMany).not.toHaveBeenCalled();

    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, date: TODAY }),
    ).resolves.toBe(true);
  });

  it("is refused when a pending one dated tomorrow is marked paid, and one dated today is not", async () => {
    const pending = (date: string) =>
      db.expense.findFirst.mockResolvedValue({
        status: "PLANNED",
        amount: BigInt(500000),
        currency: "ARS",
        date: new Date(`${date}T00:00:00.000Z`),
        accountId: "acc_1",
        cardId: "card_9",
        card: { kind: "DEBIT" },
      });

    pending(TOMORROW);
    await expect(
      setExpenseStatus(USER_ID, "exp_1", "SETTLED"),
    ).rejects.toBeInstanceOf(ExpenseFutureDebitError);
    expect(tx.expense.updateMany).not.toHaveBeenCalled();

    pending(TODAY);
    await expect(setExpenseStatus(USER_ID, "exp_1", "SETTLED")).resolves.toBe(
      true,
    );
  });

  it("is allowed while it is only planned or covered, which moves no money", async () => {
    await createExpense(USER_ID, {
      ...input,
      date: TOMORROW,
      status: "PLANNED",
    });
    await createExpense(USER_ID, {
      ...input,
      date: TOMORROW,
      status: "COVERED",
    });

    expect(db.expense.create).toHaveBeenCalledTimes(2);
  });

  it("is allowed for a credit card, whose charge is a later date by design", async () => {
    db.card.findFirst.mockResolvedValue(creditCardRecord());

    await createExpense(USER_ID, {
      ...input,
      cardId: "card_1",
      accountId: "acc_1",
      date: TOMORROW,
    });

    expect(db.expense.create).toHaveBeenCalledTimes(1);
  });
});

describe("the account at the moment of the lock", () => {
  it("refuses an account that is gone or not the user's, reading no balance", async () => {
    locks.lockAccount.mockResolvedValue(null);

    await expect(createExpense(USER_ID, input)).rejects.toBeInstanceOf(
      CardBankWithoutAccountError,
    );
    expect(balances.readAccountBalances).not.toHaveBeenCalled();
    expect(tx.expense.create).not.toHaveBeenCalled();
  });

  it("refuses an account whose currency is not the expense's, reading no balance", async () => {
    locks.lockAccount.mockResolvedValue({ ...LOCKED, currency: "USD" });

    await expect(createExpense(USER_ID, input)).rejects.toBeInstanceOf(
      CardBankWithoutAccountError,
    );
    expect(balances.readAccountBalances).not.toHaveBeenCalled();
  });

  it("on an edit refuses a re-resolved account that is archived, which is not the one the expense kept", async () => {
    // Stored in USD on acc_old; the edit is in ARS, so the bank's active ARS account (acc_1) is resolved
    // again, and it turns out archived at the lock.
    db.expense.findFirst.mockResolvedValue({
      ...STORED_PAID,
      currency: "USD",
      accountId: "acc_old",
    });
    locks.lockAccount.mockResolvedValue({ ...LOCKED, archivedAt: AT });

    await expect(updateExpense(USER_ID, "exp_1", input)).rejects.toBeInstanceOf(
      CardBankWithoutAccountError,
    );
    expect(locks.lockAccount).toHaveBeenCalledWith(tx, USER_ID, "acc_1");
    expect(tx.expense.updateMany).not.toHaveBeenCalled();
  });

  it("does not let a NEW template keep an archived account at the lock either", async () => {
    db.expense.findFirst.mockResolvedValue({
      ...STORED_PAID,
      status: "PLANNED",
    });
    locks.lockAccount.mockResolvedValue({ ...LOCKED, archivedAt: AT });

    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, isRecurring: true }),
    ).rejects.toBeInstanceOf(CardBankWithoutAccountError);
    expect(tx.recurringExpense.create).not.toHaveBeenCalled();
    expect(tx.expense.updateMany).not.toHaveBeenCalled();
  });
});

describe("a paid debit expense dated in the future, whatever the funds check says", () => {
  it("refuses a cash expense that is edited to add a debit card with a future date, and allows today", async () => {
    db.expense.findFirst.mockResolvedValue({
      ...STORED_PAID,
      cardId: null,
      date: new Date(`${TOMORROW}T00:00:00.000Z`),
    });

    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, date: TOMORROW }),
    ).rejects.toBeInstanceOf(ExpenseFutureDebitError);
    expect(db.expense.updateMany).not.toHaveBeenCalled();
    expect(tx.expense.updateMany).not.toHaveBeenCalled();

    db.expense.findFirst.mockResolvedValue({ ...STORED_PAID, cardId: null });

    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, date: TODAY }),
    ).resolves.toBe(true);
  });

  it("refuses an already stored paid future-dated debit expense edited without changing its date", async () => {
    db.expense.findFirst.mockResolvedValue({
      ...STORED_PAID,
      date: new Date(`${TOMORROW}T00:00:00.000Z`),
    });

    await expect(
      updateExpense(USER_ID, "exp_1", {
        ...input,
        date: TOMORROW,
        notes: "Nota",
      }),
    ).rejects.toBeInstanceOf(ExpenseFutureDebitError);
    expect(db.expense.updateMany).not.toHaveBeenCalled();
  });

  it("leaves a future-dated planned or covered edit, and a credit one, alone", async () => {
    db.expense.findFirst.mockResolvedValue({
      ...STORED_PAID,
      cardId: null,
      status: "PLANNED",
    });

    for (const status of ["PLANNED", "COVERED"] as const) {
      await expect(
        updateExpense(USER_ID, "exp_1", { ...input, date: TOMORROW, status }),
      ).resolves.toBe(true);
    }

    db.card.findFirst.mockResolvedValue(creditCardRecord());
    await expect(
      updateExpense(USER_ID, "exp_1", {
        ...input,
        cardId: "card_1",
        accountId: "acc_1",
        date: TOMORROW,
      }),
    ).resolves.toBe(true);
  });
});

describe("the order of an edit and of a paid mark: lock, read, read, write", () => {
  it("locks the account before reading its balance twice and writing, when an edit raises the amount", async () => {
    const order: string[] = [];

    db.expense.findFirst.mockResolvedValue(STORED_PAID);
    locks.lockAccount.mockImplementation(async () => {
      order.push("lock");

      return LOCKED;
    });
    balances.readAccountBalances.mockImplementation(async () => {
      order.push("read");

      return balance(1000000);
    });
    tx.expense.updateMany.mockImplementation(async () => {
      order.push("write");

      return { count: 1 };
    });

    await updateExpense(USER_ID, "exp_1", { ...input, amount: 600000 });

    expect(order).toEqual(["lock", "read", "read", "write"]);
  });

  it("does the same when a pending expense is marked paid", async () => {
    const order: string[] = [];

    db.expense.findFirst.mockResolvedValue({
      status: "PLANNED",
      amount: BigInt(500000),
      currency: "ARS",
      date: new Date("2026-10-05T00:00:00.000Z"),
      accountId: "acc_1",
      cardId: "card_9",
      card: { kind: "DEBIT" },
    });
    locks.lockAccount.mockImplementation(async () => {
      order.push("lock");

      return LOCKED;
    });
    balances.readAccountBalances.mockImplementation(async () => {
      order.push("read");

      return balance(1000000);
    });
    tx.expense.updateMany.mockImplementation(async () => {
      order.push("write");

      return { count: 1 };
    });

    await setExpenseStatus(USER_ID, "exp_1", "SETTLED");

    expect(order).toEqual(["lock", "read", "read", "write"]);
  });
});
