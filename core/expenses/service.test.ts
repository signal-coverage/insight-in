import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are
  // observed on the same mocks.
  $transaction: vi.fn(),
  expense: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  recurringExpense: {
    create: vi.fn(),
    count: vi.fn(),
  },
  recurringExpenseDecision: {
    create: vi.fn(),
  },
  installmentPlan: {
    count: vi.fn(),
  },
  card: {
    findFirst: vi.fn(),
  },
  expenseCategory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
}));

const usable = vi.hoisted(() => ({ assertUsableAccount: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/accounts/usable", () => usable);

import {
  AccountArchivedError,
  AccountNotFoundError,
} from "@/core/accounts/errors";
import { InstallmentCurrencyLockedError } from "@/core/entries/errors";
import {
  CardCurrencyMismatchError,
  CardNotFoundError,
} from "@/core/cards/errors";
import { WITH_CARD_DETAILS } from "@/core/cards/service";
import { creditCardRecord } from "@/core/cards/testFixtures";
import { DEFAULT_ENTRIES_QUERY } from "@/core/entries/query";
import type { EntriesQuery } from "@/core/entries/query";
import {
  CategoryInUseError,
  CategoryNotFoundError,
  DuplicateCategoryError,
  LastCategoryError,
} from "@/core/incomes/errors";

import {
  createCategory,
  createExpense,
  deleteCategory,
  deleteExpense,
  listCategories,
  listCategoriesWithCounts,
  listExpenseCurrencies,
  listExpenses,
  listExpenseTotals,
  renameCategory,
  setExpenseStatus,
  updateExpense,
} from "./service";
import { ExpenseChangedError } from "./errors";
import type { ExpenseInput } from "./types";

const {
  card,
  expense,
  expenseCategory,
  installmentPlan,
  recurringExpense,
  recurringExpenseDecision,
} = db;

const USER_ID = "user_123";
const ACCOUNT_ROW = {
  name: "Caja de ahorro",
  bank: { name: "Banco Galicia" },
};
const INCLUDE = {
  category: { select: { name: true } },
  account: { select: { name: true, bank: { select: { name: true } } } },
};

const query = (patch: Partial<EntriesQuery> = {}): EntriesQuery => ({
  ...DEFAULT_ENTRIES_QUERY,
  ...patch,
});

// What an update of the `found` expense is conditioned on: the record as it was read.
const UNCHANGED_SINCE_READ = {
  id: "exp_1",
  userId: USER_ID,
  status: "SETTLED",
  amount: BigInt(35000050),
  accountId: "acc_1",
  cardId: null,
  currency: "ARS",
  date: new Date("2026-09-05T00:00:00.000Z"),
};

const input: ExpenseInput = {
  description: "Monthly rent",
  amount: 35000050,
  currency: "ARS",
  date: "2026-09-05",
  categoryId: "cat_1",
  notes: null,
  status: "SETTLED",
  accountId: "acc_1",
  isRecurring: false,
  cardId: null,
  originCurrency: null,
  originAmount: null,
  expectedReimbursement: null,
};

const recurringInput: ExpenseInput = { ...input, isRecurring: true };

// Closes on the 25th and is paid on the 5th: a purchase made on 2026-09-05 is in the statement that
// closes on 2026-09-25, which is paid on 2026-10-05.
const cardInput: ExpenseInput = { ...input, cardId: "card_1" };

// What an expense outside any card writes on update, so a card that was removed is cleared.
const NO_CARD = { cardId: null, purchaseDate: null };

// What a purchase on the card above writes.
const CARD_DATA = {
  cardId: "card_1",
  purchaseDate: new Date("2026-09-05T00:00:00.000Z"),
};

const row = {
  id: "exp_1",
  userId: USER_ID,
  description: "Monthly rent",
  amount: BigInt(35000050),
  currency: "ARS",
  date: new Date("2026-09-05T00:00:00.000Z"),
  categoryId: "cat_1",
  category: { name: "Alquiler" },
  notes: null,
  status: "SETTLED",
  accountId: "acc_1",
  account: ACCOUNT_ROW,
  isRecurring: false,
  originCurrency: null,
  originAmount: null,
  expectedReimbursement: null,
  recurringExpenseId: null,
  cardId: null,
  purchaseDate: null,
  createdAt: new Date("2026-09-06T10:00:00.000Z"),
  updatedAt: new Date("2026-09-06T10:00:00.000Z"),
};

const WRITABLE_DATA = {
  description: "Monthly rent",
  amount: BigInt(35000050),
  currency: "ARS",
  date: new Date("2026-09-05T00:00:00.000Z"),
  categoryId: "cat_1",
  notes: null,
  status: "SETTLED",
  accountId: "acc_1",
  originCurrency: null,
  originAmount: null,
  expectedReimbursement: null,
};

const TEMPLATE_DATA = {
  description: "Monthly rent",
  amount: BigInt(35000050),
  currency: "ARS",
  categoryId: "cat_1",
  notes: null,
  accountId: "acc_1",
  originCurrency: null,
  originAmount: null,
  dayOfMonth: 5,
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  expenseCategory.findFirst.mockResolvedValue({
    id: "cat_1",
    name: "Alquiler",
  });
});

describe("createExpense", () => {
  it("verifies the category belongs to the user before writing", async () => {
    expense.create.mockResolvedValue(row);

    await createExpense(USER_ID, input);

    expect(expenseCategory.findFirst).toHaveBeenCalledWith({
      where: { id: "cat_1", userId: USER_ID },
      select: { id: true },
    });
  });

  it("stores the record for the user with a bigint amount and a UTC date", async () => {
    expense.create.mockResolvedValue(row);

    await createExpense(USER_ID, input);

    expect(expense.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, ...WRITABLE_DATA, isRecurring: false },
      include: INCLUDE,
    });
  });

  it("returns the created expense as a plain object", async () => {
    expense.create.mockResolvedValue(row);

    await expect(createExpense(USER_ID, input)).resolves.toEqual({
      ...input,
      id: "exp_1",
      categoryName: "Alquiler",
      accountLabel: "Banco Galicia · Caja de ahorro",
      purchaseDate: null,
      reimbursementReceived: 0,
    });
  });

  describe("with a card", () => {
    beforeEach(() => {
      card.findFirst.mockResolvedValue(creditCardRecord());
      expense.create.mockResolvedValue({
        ...row,
        cardId: "card_1",
        date: new Date("2026-10-05T00:00:00.000Z"),
        purchaseDate: new Date("2026-09-05T00:00:00.000Z"),
      });
    });

    it("looks the card up among the user's own", async () => {
      await createExpense(USER_ID, cardInput);

      expect(card.findFirst).toHaveBeenCalledWith({
        where: { id: "card_1", userId: USER_ID },
        include: WITH_CARD_DETAILS,
      });
    });

    it("dates the expense on the charge date of the card's cycle and keeps the purchase day apart", async () => {
      await createExpense(USER_ID, cardInput);

      expect(expense.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          ...WRITABLE_DATA,
          date: new Date("2026-10-05T00:00:00.000Z"),
          ...CARD_DATA,
          isRecurring: false,
        },
        include: INCLUDE,
      });
    });

    it("moves the charge to the next statement when the purchase is after the closing day", async () => {
      await createExpense(USER_ID, { ...cardInput, date: "2026-09-26" });

      expect(expense.create.mock.calls[0][0].data).toMatchObject({
        date: new Date("2026-11-05T00:00:00.000Z"),
        purchaseDate: new Date("2026-09-26T00:00:00.000Z"),
      });
    });

    it("returns the expense with the charge date, the card and the purchase day", async () => {
      await expect(createExpense(USER_ID, cardInput)).resolves.toMatchObject({
        date: "2026-10-05",
        cardId: "card_1",
        purchaseDate: "2026-09-05",
      });
    });

    it("rejects a card that is not the user's without writing", async () => {
      card.findFirst.mockResolvedValue(null);

      await expect(createExpense(USER_ID, cardInput)).rejects.toBeInstanceOf(
        CardNotFoundError,
      );
      expect(expense.create).not.toHaveBeenCalled();
    });

    it("rejects a card in another currency than the expense without writing", async () => {
      card.findFirst.mockResolvedValue(creditCardRecord({ currency: "USD" }));

      await expect(createExpense(USER_ID, cardInput)).rejects.toBeInstanceOf(
        CardCurrencyMismatchError,
      );
      expect(expense.create).not.toHaveBeenCalled();
    });

    it("rejects a crypto expense on a credit card, which has no cap in it, and accepts the legal-tender twin", async () => {
      await expect(
        createExpense(USER_ID, { ...cardInput, currency: "USDC" }),
      ).rejects.toBeInstanceOf(CardCurrencyMismatchError);
      expect(expense.create).not.toHaveBeenCalled();

      await expect(createExpense(USER_ID, cardInput)).resolves.toBeDefined();
      expect(expense.create).toHaveBeenCalledTimes(1);
    });

    it("takes the template of a recurring expense from the charge date, which is the date the expense has", async () => {
      recurringExpense.create.mockResolvedValue({ id: "rec_1" });
      recurringExpenseDecision.create.mockResolvedValue({});

      await createExpense(USER_ID, { ...cardInput, isRecurring: true });

      expect(recurringExpense.create.mock.calls[0][0].data.dayOfMonth).toBe(5);
      expect(recurringExpenseDecision.create).toHaveBeenCalledWith({
        data: {
          recurringExpenseId: "rec_1",
          month: "2026-10",
          decision: "ENABLED",
        },
      });
    });
  });

  it("never looks a card up for an expense without one, and writes no card", async () => {
    expense.create.mockResolvedValue(row);

    await createExpense(USER_ID, input);

    expect(card.findFirst).not.toHaveBeenCalled();
    expect(expense.create.mock.calls[0][0].data).not.toHaveProperty("cardId");
    expect(expense.create.mock.calls[0][0].data).not.toHaveProperty(
      "purchaseDate",
    );
  });

  it("rejects a category the user does not own without writing", async () => {
    expenseCategory.findFirst.mockResolvedValue(null);

    await expect(createExpense(USER_ID, input)).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    expect(expense.create).not.toHaveBeenCalled();
  });

  it("stores COVERED: any expense may be paid by someone else", async () => {
    expense.create.mockResolvedValue({ ...row, status: "COVERED" });

    await expect(
      createExpense(USER_ID, { ...input, status: "COVERED" }),
    ).resolves.toMatchObject({ status: "COVERED" });
    expect(expense.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        ...WRITABLE_DATA,
        status: "COVERED",
        isRecurring: false,
      },
      include: INCLUDE,
    });
  });

  it("stores COVERED for a recurring expense too, with its template", async () => {
    recurringExpense.create.mockResolvedValue({ id: "rec_1" });
    recurringExpenseDecision.create.mockResolvedValue({});
    expense.create.mockResolvedValue({
      ...row,
      status: "COVERED",
      isRecurring: true,
      recurringExpenseId: "rec_1",
    });

    await expect(
      createExpense(USER_ID, { ...recurringInput, status: "COVERED" }),
    ).resolves.toMatchObject({ status: "COVERED", isRecurring: true });
    expect(expense.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        ...WRITABLE_DATA,
        status: "COVERED",
        isRecurring: true,
        recurringExpenseId: "rec_1",
      },
      include: INCLUDE,
    });
  });

  it("still verifies the category belongs to the user when the expense is covered", async () => {
    expenseCategory.findFirst.mockResolvedValue(null);

    await expect(
      createExpense(USER_ID, { ...input, status: "COVERED" }),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
    expect(expense.create).not.toHaveBeenCalled();
  });

  it("creates no template for an expense that is not recurring", async () => {
    expense.create.mockResolvedValue(row);

    await createExpense(USER_ID, input);

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(recurringExpense.create).not.toHaveBeenCalled();
    expect(recurringExpenseDecision.create).not.toHaveBeenCalled();
  });

  describe("when it is marked as recurring", () => {
    beforeEach(() => {
      recurringExpense.create.mockResolvedValue({ id: "rec_1" });
      expense.create.mockResolvedValue({
        ...row,
        isRecurring: true,
        recurringExpenseId: "rec_1",
      });
      recurringExpenseDecision.create.mockResolvedValue({});
    });

    it("remembers a template copied from the saved values, on the day of the expense", async () => {
      await createExpense(USER_ID, recurringInput);

      expect(recurringExpense.create).toHaveBeenCalledWith({
        data: { userId: USER_ID, ...TEMPLATE_DATA },
      });
    });

    it("links the expense to the template and keeps the flag in step with the link", async () => {
      await createExpense(USER_ID, recurringInput);

      expect(expense.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          ...WRITABLE_DATA,
          isRecurring: true,
          recurringExpenseId: "rec_1",
        },
        include: INCLUDE,
      });
    });

    it("records an enabled decision for the month of the expense, so it is not asked again", async () => {
      await createExpense(USER_ID, recurringInput);

      expect(recurringExpenseDecision.create).toHaveBeenCalledWith({
        data: {
          recurringExpenseId: "rec_1",
          month: "2026-09",
          decision: "ENABLED",
        },
      });
    });

    it("does all of it in one transaction", async () => {
      await createExpense(USER_ID, recurringInput);

      expect(db.$transaction).toHaveBeenCalledTimes(1);
    });

    it("returns the created expense with the recurring mark", async () => {
      await expect(
        createExpense(USER_ID, recurringInput),
      ).resolves.toMatchObject({ id: "exp_1", isRecurring: true });
    });

    it("writes nothing when the category is not the user's", async () => {
      expenseCategory.findFirst.mockResolvedValue(null);

      await expect(
        createExpense(USER_ID, recurringInput),
      ).rejects.toBeInstanceOf(CategoryNotFoundError);
      expect(db.$transaction).not.toHaveBeenCalled();
    });
  });

  it("checks the account is the user's, active and in the expense's currency before writing", async () => {
    expense.create.mockResolvedValue(row);

    await createExpense(USER_ID, input);

    expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
      accountId: "acc_1",
      currency: "ARS",
      keepAccountId: null,
    });
  });

  it("writes nothing when the account is refused (another user's, archived or in another currency)", async () => {
    usable.assertUsableAccount.mockRejectedValue(new AccountArchivedError());

    await expect(createExpense(USER_ID, input)).rejects.toBeInstanceOf(
      AccountArchivedError,
    );
    expect(expense.create).not.toHaveBeenCalled();
    expect(recurringExpense.create).not.toHaveBeenCalled();
  });

  it("returns the account of the expense, labelled 'Banco · Cuenta'", async () => {
    expense.create.mockResolvedValue(row);

    await expect(createExpense(USER_ID, input)).resolves.toMatchObject({
      accountId: "acc_1",
      accountLabel: "Banco Galicia · Caja de ahorro",
    });
  });

  it("gives the template of a recurring expense the expense's account", async () => {
    recurringExpense.create.mockResolvedValue({ id: "rec_1" });
    expense.create.mockResolvedValue({ ...row, isRecurring: true });

    await createExpense(USER_ID, { ...recurringInput, accountId: "acc_7" });

    expect(recurringExpense.create.mock.calls[0][0].data.accountId).toBe(
      "acc_7",
    );
    expect(expense.create.mock.calls[0][0].data.accountId).toBe("acc_7");
  });
});

describe("updateExpense", () => {
  const found = (
    recurringExpenseId: string | null,
    installmentPlanId: string | null = null,
  ) =>
    expense.findFirst.mockResolvedValue({
      recurringExpenseId,
      installmentPlanId,
      currency: "ARS",
      expectedReimbursement: null,
      accountId: "acc_1",
      cardId: null,
      amount: BigInt(35000050),
      date: new Date("2026-09-05T00:00:00.000Z"),
      status: "SETTLED",
    });

  it("looks the record up scoped to the user", async () => {
    found(null);
    expense.updateMany.mockResolvedValue({ count: 1 });

    await updateExpense(USER_ID, "exp_1", input);

    expect(expense.findFirst).toHaveBeenCalledWith({
      where: { id: "exp_1", userId: USER_ID },
      select: {
        recurringExpenseId: true,
        installmentPlanId: true,
        currency: true,
        expectedReimbursement: true,
        accountId: true,
        cardId: true,
        amount: true,
        date: true,
        status: true,
      },
    });
  });

  describe("an installment of a plan", () => {
    it("may be marked as covered by someone else", async () => {
      found(null, "plan_1");
      expense.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        updateExpense(USER_ID, "exp_1", { ...input, status: "COVERED" }),
      ).resolves.toBe(true);
      expect(expense.updateMany).toHaveBeenCalledWith({
        where: UNCHANGED_SINCE_READ,
        data: { ...WRITABLE_DATA, status: "COVERED", isRecurring: false },
      });
    });

    it("keeps the currency of its plan: USDC and USD are refused on an ARS installment, ARS is accepted", async () => {
      found(null, "plan_1");
      expense.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        updateExpense(USER_ID, "exp_1", { ...input, currency: "USDC" }),
      ).rejects.toBeInstanceOf(InstallmentCurrencyLockedError);
      await expect(
        updateExpense(USER_ID, "exp_1", { ...input, currency: "USD" }),
      ).rejects.toBeInstanceOf(InstallmentCurrencyLockedError);
      expect(expense.updateMany).not.toHaveBeenCalled();

      await expect(updateExpense(USER_ID, "exp_1", input)).resolves.toBe(true);
      expect(expense.updateMany).toHaveBeenCalledTimes(1);
    });

    it("never becomes recurring, even when the form sends the switch on", async () => {
      found(null, "plan_1");
      expense.updateMany.mockResolvedValue({ count: 1 });

      await updateExpense(USER_ID, "exp_1", recurringInput);

      expect(db.$transaction).not.toHaveBeenCalled();
      expect(recurringExpense.create).not.toHaveBeenCalled();
      expect(expense.updateMany.mock.calls[0][0].data).toMatchObject({
        isRecurring: false,
      });
    });

    it("ignores a card sent with the form: it keeps the card of its plan and its own date", async () => {
      found(null, "plan_1");
      expense.updateMany.mockResolvedValue({ count: 1 });

      await updateExpense(USER_ID, "exp_1", cardInput);

      const { data } = expense.updateMany.mock.calls[0][0];

      expect(card.findFirst).not.toHaveBeenCalled();
      expect(data).not.toHaveProperty("cardId");
      expect(data).not.toHaveProperty("purchaseDate");
      expect(data.date).toEqual(new Date("2026-09-05T00:00:00.000Z"));
    });

    it("never has its link to the plan or its number written by an edit", async () => {
      found(null, "plan_1");
      expense.updateMany.mockResolvedValue({ count: 1 });

      await updateExpense(USER_ID, "exp_1", input);

      const { data } = expense.updateMany.mock.calls[0][0];

      expect(data).not.toHaveProperty("installmentPlanId");
      expect(data).not.toHaveProperty("installmentNumber");
    });
  });

  describe("an expense outside a plan", () => {
    it("may be marked as covered by someone else", async () => {
      found(null);
      expense.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        updateExpense(USER_ID, "exp_1", { ...input, status: "COVERED" }),
      ).resolves.toBe(true);
      expect(expense.updateMany).toHaveBeenCalledWith({
        where: UNCHANGED_SINCE_READ,
        data: {
          ...WRITABLE_DATA,
          ...NO_CARD,
          status: "COVERED",
          isRecurring: false,
        },
      });
    });

    describe("with a card", () => {
      beforeEach(() => {
        found(null);
        expense.updateMany.mockResolvedValue({ count: 1 });
        card.findFirst.mockResolvedValue(creditCardRecord());
      });

      it("recomputes the charge date from the card, whatever the client says, and stores the purchase day", async () => {
        await expect(updateExpense(USER_ID, "exp_1", cardInput)).resolves.toBe(
          true,
        );

        expect(card.findFirst).toHaveBeenCalledWith({
          where: { id: "card_1", userId: USER_ID },
          include: WITH_CARD_DETAILS,
        });
        expect(expense.updateMany).toHaveBeenCalledWith({
          where: UNCHANGED_SINCE_READ,
          data: {
            ...WRITABLE_DATA,
            date: new Date("2026-10-05T00:00:00.000Z"),
            ...CARD_DATA,
            isRecurring: false,
          },
        });
      });

      it("rejects a card that is not the user's without writing", async () => {
        card.findFirst.mockResolvedValue(null);

        await expect(
          updateExpense(USER_ID, "exp_1", cardInput),
        ).rejects.toBeInstanceOf(CardNotFoundError);
        expect(expense.updateMany).not.toHaveBeenCalled();
      });

      it("rejects a card in another currency without writing", async () => {
        card.findFirst.mockResolvedValue(creditCardRecord({ currency: "USD" }));

        await expect(
          updateExpense(USER_ID, "exp_1", cardInput),
        ).rejects.toBeInstanceOf(CardCurrencyMismatchError);
        expect(expense.updateMany).not.toHaveBeenCalled();
      });

      it("clears the card and the purchase day when the card is taken off", async () => {
        await updateExpense(USER_ID, "exp_1", input);

        expect(card.findFirst).not.toHaveBeenCalled();
        expect(expense.updateMany.mock.calls[0][0].data).toMatchObject(NO_CARD);
      });
    });

    it("may be covered while it becomes recurring, in the same transaction", async () => {
      found(null);
      recurringExpense.create.mockResolvedValue({ id: "rec_1" });
      recurringExpenseDecision.create.mockResolvedValue({});
      expense.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        updateExpense(USER_ID, "exp_1", {
          ...recurringInput,
          status: "COVERED",
        }),
      ).resolves.toBe(true);
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(expense.updateMany).toHaveBeenCalledWith({
        where: UNCHANGED_SINCE_READ,
        data: {
          ...WRITABLE_DATA,
          ...NO_CARD,
          status: "COVERED",
          isRecurring: true,
          recurringExpenseId: "rec_1",
        },
      });
    });

    it("may be covered when it already belongs to a recurring template", async () => {
      found("rec_1");
      expense.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        updateExpense(USER_ID, "exp_1", { ...input, status: "COVERED" }),
      ).resolves.toBe(true);
      expect(expense.updateMany).toHaveBeenCalledWith({
        where: UNCHANGED_SINCE_READ,
        data: {
          ...WRITABLE_DATA,
          ...NO_CARD,
          status: "COVERED",
          isRecurring: true,
        },
      });
    });

    it("is still looked up scoped to the user: another user's expense stays untouched", async () => {
      expense.findFirst.mockResolvedValue(null);

      await expect(
        updateExpense(USER_ID, "exp_9", { ...input, status: "COVERED" }),
      ).resolves.toBe(false);
      expect(expense.updateMany).not.toHaveBeenCalled();
    });
  });

  it("only touches a record owned by the user, with an explicit field list", async () => {
    found(null);
    expense.updateMany.mockResolvedValue({ count: 1 });

    await expect(updateExpense(USER_ID, "exp_1", input)).resolves.toBe(true);
    expect(expense.updateMany).toHaveBeenCalledWith({
      where: UNCHANGED_SINCE_READ,
      data: { ...WRITABLE_DATA, ...NO_CARD, isRecurring: false },
    });
  });

  it("returns false, writing nothing, when the record is not the user's", async () => {
    expense.findFirst.mockResolvedValue(null);

    await expect(updateExpense(USER_ID, "exp_9", input)).resolves.toBe(false);
    expect(expense.updateMany).not.toHaveBeenCalled();
    expect(recurringExpense.create).not.toHaveBeenCalled();
  });

  it("refuses as changed, not as missing, when the record disappears or changes before the write", async () => {
    found(null);
    expense.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateExpense(USER_ID, "exp_1", input)).rejects.toBeInstanceOf(
      ExpenseChangedError,
    );
  });

  describe("an expense that is not linked to a template", () => {
    it("creates a template, links the expense and records an enabled decision when the switch is on", async () => {
      found(null);
      recurringExpense.create.mockResolvedValue({ id: "rec_1" });
      expense.updateMany.mockResolvedValue({ count: 1 });
      recurringExpenseDecision.create.mockResolvedValue({});

      await expect(
        updateExpense(USER_ID, "exp_1", recurringInput),
      ).resolves.toBe(true);

      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(recurringExpense.create).toHaveBeenCalledWith({
        data: { userId: USER_ID, ...TEMPLATE_DATA },
      });
      expect(expense.updateMany).toHaveBeenCalledWith({
        where: UNCHANGED_SINCE_READ,
        data: {
          ...WRITABLE_DATA,
          ...NO_CARD,
          isRecurring: true,
          recurringExpenseId: "rec_1",
        },
      });
      expect(recurringExpenseDecision.create).toHaveBeenCalledWith({
        data: {
          recurringExpenseId: "rec_1",
          month: "2026-09",
          decision: "ENABLED",
        },
      });
    });

    it("undoes the whole transaction, template included, when the expense is gone by the time it is linked", async () => {
      let rolledBackWith: unknown;

      db.$transaction.mockImplementation(
        async (run: (tx: typeof db) => unknown) => {
          try {
            return await run(db);
          } catch (error) {
            // A throw inside the callback is what makes the database roll back.
            rolledBackWith = error;
            throw error;
          }
        },
      );
      found(null);
      recurringExpense.create.mockResolvedValue({ id: "rec_1" });
      recurringExpenseDecision.create.mockResolvedValue({});
      expense.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        updateExpense(USER_ID, "exp_1", recurringInput),
      ).rejects.toBeInstanceOf(ExpenseChangedError);
      expect(rolledBackWith).toBeInstanceOf(ExpenseChangedError);
    });

    it("creates nothing when the switch is off", async () => {
      found(null);
      expense.updateMany.mockResolvedValue({ count: 1 });

      await updateExpense(USER_ID, "exp_1", input);

      expect(db.$transaction).not.toHaveBeenCalled();
      expect(recurringExpense.create).not.toHaveBeenCalled();
    });
  });

  describe("an expense that is linked to a template", () => {
    it("never touches the template, whatever the form says", async () => {
      found("rec_1");
      expense.updateMany.mockResolvedValue({ count: 1 });

      await updateExpense(USER_ID, "exp_1", {
        ...recurringInput,
        description: "Changed",
        amount: 1,
      });

      expect(recurringExpense.create).not.toHaveBeenCalled();
      expect(recurringExpenseDecision.create).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("keeps the link and the flag even when the form sends the switch off", async () => {
      found("rec_1");
      expense.updateMany.mockResolvedValue({ count: 1 });

      await updateExpense(USER_ID, "exp_1", input);

      const { data } = expense.updateMany.mock.calls[0][0];

      expect(data).toMatchObject({ isRecurring: true });
      expect(data).not.toHaveProperty("recurringExpenseId");
    });

    it("still saves the changes to the row itself", async () => {
      found("rec_1");
      expense.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        updateExpense(USER_ID, "exp_1", recurringInput),
      ).resolves.toBe(true);
      expect(expense.updateMany).toHaveBeenCalledWith({
        where: UNCHANGED_SINCE_READ,
        data: { ...WRITABLE_DATA, ...NO_CARD, isRecurring: true },
      });
    });
  });

  it("lets the edit keep the account the expense already has, even if it was archived since", async () => {
    expense.findFirst.mockResolvedValue({
      recurringExpenseId: null,
      installmentPlanId: null,
      currency: "ARS",
      expectedReimbursement: null,
      accountId: "acc_old",
      cardId: null,
      amount: BigInt(35000050),
      date: new Date("2026-09-05T00:00:00.000Z"),
      status: "SETTLED",
    });
    expense.updateMany.mockResolvedValue({ count: 1 });

    await updateExpense(USER_ID, "exp_1", { ...input, accountId: "acc_old" });

    expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
      accountId: "acc_old",
      currency: "ARS",
      keepAccountId: "acc_old",
    });
  });

  describe("the account exception for an archived account", () => {
    const foundOn = (recurringExpenseId: string | null) =>
      expense.findFirst.mockResolvedValue({
        recurringExpenseId,
        installmentPlanId: null,
        currency: "ARS",
        expectedReimbursement: null,
        accountId: "acc_old",
        cardId: null,
        amount: BigInt(35000050),
        date: new Date("2026-09-05T00:00:00.000Z"),
        status: "SETTLED",
      });

    it("does not cover a NEW template: turning the switch on checks the account with no exception and writes nothing when it is archived", async () => {
      foundOn(null);
      usable.assertUsableAccount.mockRejectedValue(new AccountArchivedError());

      await expect(
        updateExpense(USER_ID, "exp_1", {
          ...recurringInput,
          accountId: "acc_old",
        }),
      ).rejects.toBeInstanceOf(AccountArchivedError);
      expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
        accountId: "acc_old",
        currency: "ARS",
        keepAccountId: null,
      });
      expect(expense.updateMany).not.toHaveBeenCalled();
      expect(recurringExpense.create).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("still covers the existing record when the switch is off", async () => {
      foundOn(null);
      expense.updateMany.mockResolvedValue({ count: 1 });

      await updateExpense(USER_ID, "exp_1", { ...input, accountId: "acc_old" });

      expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
        accountId: "acc_old",
        currency: "ARS",
        keepAccountId: "acc_old",
      });
    });

    it("still covers an expense that is already recurring, whatever the switch says", async () => {
      foundOn("rec_1");
      expense.updateMany.mockResolvedValue({ count: 1 });

      await updateExpense(USER_ID, "exp_1", {
        ...recurringInput,
        accountId: "acc_old",
      });

      expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
        accountId: "acc_old",
        currency: "ARS",
        keepAccountId: "acc_old",
      });
      expect(recurringExpense.create).not.toHaveBeenCalled();
    });
  });

  it("writes nothing when the account is not the user's", async () => {
    expense.findFirst.mockResolvedValue({
      recurringExpenseId: null,
      installmentPlanId: null,
      currency: "ARS",
      expectedReimbursement: null,
      accountId: "acc_1",
      cardId: null,
      amount: BigInt(35000050),
      date: new Date("2026-09-05T00:00:00.000Z"),
      status: "SETTLED",
    });
    usable.assertUsableAccount.mockRejectedValue(new AccountNotFoundError());

    await expect(
      updateExpense(USER_ID, "exp_1", {
        ...input,
        accountId: "acc_of_someone_else",
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(expense.updateMany).not.toHaveBeenCalled();
  });

  it("does not check any account for an expense that is not the user's", async () => {
    expense.findFirst.mockResolvedValue(null);

    await expect(updateExpense(USER_ID, "exp_9", input)).resolves.toBe(false);
    expect(usable.assertUsableAccount).not.toHaveBeenCalled();
  });
});

describe("setExpenseStatus", () => {
  it("only touches a record owned by the user and changes nothing else", async () => {
    expense.updateMany.mockResolvedValue({ count: 1 });

    await expect(setExpenseStatus(USER_ID, "exp_1", "PLANNED")).resolves.toBe(
      true,
    );
    expect(expense.updateMany).toHaveBeenCalledWith({
      where: { id: "exp_1", userId: USER_ID },
      data: { status: "PLANNED" },
    });
  });

  it("refuses as changed, not as missing, a paid mark that matches nothing any more", async () => {
    // A pending, card-less expense that is gone or changed by the time of the write.
    expense.findFirst.mockResolvedValue({
      status: "PLANNED",
      amount: BigInt(35000050),
      currency: "ARS",
      date: new Date("2026-09-05T00:00:00.000Z"),
      accountId: "acc_1",
      cardId: null,
      card: null,
    });
    expense.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      setExpenseStatus(USER_ID, "exp_9", "SETTLED"),
    ).rejects.toBeInstanceOf(ExpenseChangedError);
  });

  it("returns false when the record is not the user's", async () => {
    expense.findFirst.mockResolvedValue(null);

    await expect(setExpenseStatus(USER_ID, "exp_9", "SETTLED")).resolves.toBe(
      false,
    );
    expect(expense.updateMany).not.toHaveBeenCalled();
  });

  describe("COVERED", () => {
    it("is set on any expense, scoped to the user, whether or not it belongs to a plan", async () => {
      expense.updateMany.mockResolvedValue({ count: 1 });

      await expect(setExpenseStatus(USER_ID, "exp_1", "COVERED")).resolves.toBe(
        true,
      );
      expect(expense.updateMany).toHaveBeenCalledWith({
        where: { id: "exp_1", userId: USER_ID },
        data: { status: "COVERED" },
      });
    });

    it("needs no look-up of the expense first", async () => {
      expense.updateMany.mockResolvedValue({ count: 1 });

      await setExpenseStatus(USER_ID, "exp_1", "COVERED");

      expect(expense.findFirst).not.toHaveBeenCalled();
    });

    it("returns false when the record is not the user's", async () => {
      expense.updateMany.mockResolvedValue({ count: 0 });

      await expect(setExpenseStatus(USER_ID, "exp_9", "COVERED")).resolves.toBe(
        false,
      );
      expect(expense.updateMany).toHaveBeenCalledWith({
        where: { id: "exp_9", userId: USER_ID },
        data: { status: "COVERED" },
      });
    });
  });
});

describe("deleteExpense", () => {
  it("only deletes a record owned by the user", async () => {
    expense.deleteMany.mockResolvedValue({ count: 1 });

    await expect(deleteExpense(USER_ID, "exp_1")).resolves.toBe(true);
    expect(expense.deleteMany).toHaveBeenCalledWith({
      where: { id: "exp_1", userId: USER_ID },
    });
  });

  it("returns false when nothing matched", async () => {
    expense.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteExpense(USER_ID, "exp_9")).resolves.toBe(false);
  });
});

describe("listExpenses", () => {
  it("returns one page of plain objects with the paging numbers", async () => {
    expense.count.mockResolvedValue(1);
    expense.findMany.mockResolvedValue([{ ...row, isRecurring: true }]);

    const result = await listExpenses(USER_ID, query());

    expect(result).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    });
    expect(result.rows[0]).toMatchObject({
      id: "exp_1",
      categoryName: "Alquiler",
      isRecurring: true,
    });
    expect(expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        include: INCLUDE,
        skip: 0,
        take: 25,
      }),
    );
  });

  it("carries the plan and the number of an installment", async () => {
    expense.count.mockResolvedValue(1);
    expense.findMany.mockResolvedValue([
      {
        ...row,
        status: "COVERED",
        installmentPlanId: "plan_1",
        installmentNumber: 3,
      },
    ]);

    const { rows } = await listExpenses(USER_ID, query());

    expect(rows[0]).toMatchObject({
      status: "COVERED",
      installmentPlanId: "plan_1",
      installmentNumber: 3,
    });
  });

  it("filters by COVERED like by any other status", async () => {
    expense.count.mockResolvedValue(0);
    expense.findMany.mockResolvedValue([]);

    await listExpenses(USER_ID, query({ status: "COVERED" }));

    expect(expense.findMany.mock.calls[0][0].where).toEqual({
      userId: USER_ID,
      status: "COVERED",
    });
  });

  it("applies the status filter", async () => {
    expense.count.mockResolvedValue(0);
    expense.findMany.mockResolvedValue([]);

    await listExpenses(USER_ID, query({ status: "PLANNED" }));

    expect(expense.findMany.mock.calls[0][0].where).toEqual({
      userId: USER_ID,
      status: "PLANNED",
    });
  });

  it("clamps a page past the end to the last page", async () => {
    expense.count.mockResolvedValue(30);
    expense.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([row]);

    const result = await listExpenses(USER_ID, query({ page: 9 }));

    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(expense.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: 25 }),
    );
  });
});

describe("listExpenseTotals", () => {
  it("sums per currency and status over the whole filtered set", async () => {
    expense.groupBy.mockResolvedValue([
      { currency: "ARS", status: "SETTLED", _sum: { amount: BigInt(100000) } },
      { currency: "ARS", status: "PLANNED", _sum: { amount: BigInt(50000) } },
    ]);

    await expect(
      listExpenseTotals(USER_ID, query({ categoryId: "cat_1" })),
    ).resolves.toEqual([{ currency: "ARS", total: 150000, settled: 100000 }]);
    expect(expense.groupBy).toHaveBeenCalledWith({
      by: ["currency", "status"],
      where: { userId: USER_ID, categoryId: "cat_1" },
      _sum: { amount: true },
    });
  });
});

describe("listExpenseTotals with covered installments", () => {
  it("leaves the covered ones out of the total, the paid and the pending parts", async () => {
    expense.groupBy.mockResolvedValue([
      { currency: "ARS", status: "SETTLED", _sum: { amount: BigInt(100000) } },
      { currency: "ARS", status: "PLANNED", _sum: { amount: BigInt(50000) } },
      { currency: "ARS", status: "COVERED", _sum: { amount: BigInt(70000) } },
    ]);

    await expect(listExpenseTotals(USER_ID)).resolves.toEqual([
      { currency: "ARS", total: 150000, settled: 100000 },
    ]);
  });
});

describe("listExpenseCurrencies", () => {
  it("lists the distinct currencies the user has expenses in", async () => {
    expense.groupBy.mockResolvedValue([
      { currency: "ARS" },
      { currency: "USD" },
    ]);

    await expect(listExpenseCurrencies(USER_ID)).resolves.toEqual([
      "ARS",
      "USD",
    ]);
    expect(expense.groupBy).toHaveBeenCalledWith({
      by: ["currency"],
      where: { userId: USER_ID },
      orderBy: { currency: "asc" },
    });
  });
});

describe("listCategories", () => {
  it("returns the user's categories alphabetically without seeding", async () => {
    expenseCategory.findMany.mockResolvedValue([
      { id: "c2", userId: USER_ID, name: "Salud", createdAt: new Date() },
      { id: "c1", userId: USER_ID, name: "Comida", createdAt: new Date() },
    ]);

    await expect(listCategories(USER_ID)).resolves.toEqual([
      { id: "c1", name: "Comida" },
      { id: "c2", name: "Salud" },
    ]);
    expect(expenseCategory.createMany).not.toHaveBeenCalled();
  });

  it("seeds the default categories for a user with none, tolerating races", async () => {
    expenseCategory.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "c1", userId: USER_ID, name: "Alquiler", createdAt: new Date() },
      ]);
    expenseCategory.createMany.mockResolvedValue({ count: 6 });

    const result = await listCategories(USER_ID);

    expect(expenseCategory.createMany).toHaveBeenCalledWith({
      data: [
        "Alquiler",
        "Servicios",
        "Comida",
        "Transporte",
        "Salud",
        "Otros",
      ].map((name) => ({
        userId: USER_ID,
        name,
      })),
      skipDuplicates: true,
    });
    expect(result).toEqual([{ id: "c1", name: "Alquiler" }]);
  });
});

describe("listCategoriesWithCounts", () => {
  it("adds how many expenses use each category", async () => {
    expenseCategory.findMany.mockResolvedValue([
      {
        id: "c1",
        userId: USER_ID,
        name: "Comida",
        createdAt: new Date(),
        _count: { expenses: 4 },
      },
    ]);

    await expect(listCategoriesWithCounts(USER_ID)).resolves.toEqual([
      { id: "c1", name: "Comida", expenseCount: 4 },
    ]);
  });
});

describe("createCategory", () => {
  it("checks for a case-insensitive duplicate within the user's categories", async () => {
    expenseCategory.findFirst.mockResolvedValue(null);
    expenseCategory.create.mockResolvedValue({
      id: "c9",
      userId: USER_ID,
      name: "Mascotas",
    });

    await expect(createCategory(USER_ID, "Mascotas")).resolves.toEqual({
      id: "c9",
      name: "Mascotas",
    });
    expect(expenseCategory.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        name: { equals: "Mascotas", mode: "insensitive" },
      },
      select: { id: true },
    });
  });

  it("rejects a duplicate name", async () => {
    expenseCategory.findFirst.mockResolvedValue({ id: "c1" });

    await expect(createCategory(USER_ID, "comida")).rejects.toBeInstanceOf(
      DuplicateCategoryError,
    );
    expect(expenseCategory.create).not.toHaveBeenCalled();
  });

  it("maps the unique constraint of a race to a duplicate", async () => {
    expenseCategory.findFirst.mockResolvedValue(null);
    expenseCategory.create.mockRejectedValue({ code: "P2002" });

    await expect(createCategory(USER_ID, "Comida")).rejects.toBeInstanceOf(
      DuplicateCategoryError,
    );
  });
});

describe("renameCategory", () => {
  it("renames a category owned by the user", async () => {
    expenseCategory.findFirst
      .mockResolvedValueOnce({ id: "c1", name: "Comida" })
      .mockResolvedValueOnce(null);
    expenseCategory.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      renameCategory(USER_ID, "c1", "Supermercado"),
    ).resolves.toEqual({
      id: "c1",
      name: "Supermercado",
    });
    expect(expenseCategory.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", userId: USER_ID },
      data: { name: "Supermercado" },
    });
  });

  it("reports a category that is not the user's", async () => {
    expenseCategory.findFirst.mockResolvedValue(null);

    await expect(renameCategory(USER_ID, "c9", "X")).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
  });

  it("rejects a name that clashes with another category", async () => {
    expenseCategory.findFirst
      .mockResolvedValueOnce({ id: "c1", name: "Comida" })
      .mockResolvedValueOnce({ id: "c2" });

    await expect(renameCategory(USER_ID, "c1", "Salud")).rejects.toBeInstanceOf(
      DuplicateCategoryError,
    );
  });
});

describe("deleteCategory", () => {
  const owned = (
    expenses: number,
    recurringExpenses = 0,
    installmentPlans = 0,
  ) => ({
    id: "c1",
    _count: { expenses, recurringExpenses, installmentPlans },
  });

  it("blocks a category that only an installment plan uses, and reports it", async () => {
    expenseCategory.findFirst.mockResolvedValue(owned(0, 0, 1));

    const error = await deleteCategory(USER_ID, "c1").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(CategoryInUseError);
    expect(error).toMatchObject({
      count: 0,
      recurringCount: 0,
      installmentCount: 1,
    });
    expect(expenseCategory.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes an unused category when it is not the last one", async () => {
    expenseCategory.findFirst.mockResolvedValue(owned(0));
    expenseCategory.count.mockResolvedValue(3);
    expenseCategory.deleteMany.mockResolvedValue({ count: 1 });

    await deleteCategory(USER_ID, "c1");

    expect(expenseCategory.deleteMany).toHaveBeenCalledWith({
      where: { id: "c1", userId: USER_ID },
    });
  });

  it("blocks a category that expenses still use and reports the count", async () => {
    expenseCategory.findFirst.mockResolvedValue(owned(2));

    const error = await deleteCategory(USER_ID, "c1").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(CategoryInUseError);
    expect(error).toMatchObject({ count: 2 });
    expect(expenseCategory.deleteMany).not.toHaveBeenCalled();
  });

  it("blocks a category that only a recurring template uses, and reports it", async () => {
    expenseCategory.findFirst.mockResolvedValue(owned(0, 1));

    const error = await deleteCategory(USER_ID, "c1").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(CategoryInUseError);
    expect(error).toMatchObject({ count: 0, recurringCount: 1 });
    expect(expenseCategory.deleteMany).not.toHaveBeenCalled();
  });

  it("blocks the last remaining category", async () => {
    expenseCategory.findFirst.mockResolvedValue(owned(0));
    expenseCategory.count.mockResolvedValue(1);

    await expect(deleteCategory(USER_ID, "c1")).rejects.toBeInstanceOf(
      LastCategoryError,
    );
  });

  it("reports a category that is not the user's", async () => {
    expenseCategory.findFirst.mockResolvedValue(null);

    await expect(deleteCategory(USER_ID, "c9")).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
  });

  it("reports in-use when an expense is attached between the check and the delete", async () => {
    expenseCategory.findFirst.mockResolvedValue(owned(0));
    expenseCategory.count.mockResolvedValue(3);
    expenseCategory.deleteMany.mockRejectedValue({ code: "P2003" });
    expense.count.mockResolvedValue(1);
    recurringExpense.count.mockResolvedValue(2);
    installmentPlan.count.mockResolvedValue(3);

    const error = await deleteCategory(USER_ID, "c1").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(CategoryInUseError);
    expect(error).toMatchObject({
      count: 1,
      recurringCount: 2,
      installmentCount: 3,
    });
  });
});
