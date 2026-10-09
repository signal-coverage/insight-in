import { labelOfAccount, WITH_ACCOUNT_LABEL } from "@/core/accounts/label";
import type { AccountWithBank } from "@/core/accounts/label";
import { lockAccount } from "@/core/accounts/locks";
import { assertUsableAccount } from "@/core/accounts/usable";
import { readAccountBalances } from "@/core/balances/accountBalances";
import { firstInstallmentDate } from "@/core/cards/cycle";
import { InstallmentCurrencyLockedError } from "@/core/entries/errors";
import {
  CardBankWithoutAccountError,
  CardCurrencyMismatchError,
} from "@/core/cards/errors";
import { limitIn } from "@/core/cards/kinds";
import { findOwnedCard } from "@/core/cards/service";
import {
  isForeignKeyError,
  isUniqueConstraintError,
} from "@/core/entries/dbErrors";
import {
  buildEntriesOrderBy,
  buildEntriesWhere,
  foldCurrencyTotals,
} from "@/core/entries/listing";
import { DEFAULT_ENTRIES_QUERY } from "@/core/entries/query";
import type { EntriesQuery } from "@/core/entries/query";
import type { EntryStatus } from "@/core/entries/status";
import { dateToIsoDate, isoDateToDate, todayIso } from "@/core/incomes/dates";
import {
  CategoryInUseError,
  CategoryNotFoundError,
  DuplicateCategoryError,
  LastCategoryError,
} from "@/core/incomes/errors";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { receivedById } from "@/core/reimbursements/compute";
import {
  ExpenseCurrencyLockedError,
  ReimbursementLockedError,
} from "@/core/reimbursements/errors";
import {
  countLinkedIncomes,
  listReceivedTotals,
} from "@/core/reimbursements/service";
import { monthOf } from "@/core/summary/month";
import { isFutureDate } from "@/core/transfers/rules";
import { prisma } from "@/infrastructure/db/client";
import type {
  Expense as ExpenseRow,
  ExpenseCategory as CategoryRow,
  Prisma,
} from "@/lib/generated/prisma/client";

import { DEFAULT_EXPENSE_CATEGORY_NAMES, EXPENSES_PAGE_SIZE } from "./consts";
import { debitAccountOf, needsDebitFundsCheck } from "./debit";
import type { StoredCharge } from "./debit";
import {
  ExpenseAccountRequiredError,
  ExpenseChangedError,
  ExpenseFutureDebitError,
  ExpenseInsufficientFundsError,
} from "./errors";
import { dayOfMonthOf } from "./recurrence";
import type {
  CurrencyTotal,
  Expense,
  ExpenseCategory,
  ExpenseCategoryWithCount,
  ExpenseInput,
  ExpensesPage,
} from "./types";

type ExpenseWithCategory = ExpenseRow & {
  category: { name: string };
  account: AccountWithBank;
};

// What every read of an expense brings along: the name of its category and its account's label.
const WITH_CATEGORY_NAME = {
  category: { select: { name: true } },
  ...WITH_ACCOUNT_LABEL,
} as const;

// `received` is what the incomes linked to the expense add up to; a new or edited expense is
// returned without it (0), and the list reads it for the rows that expect a reimbursement.
const toExpense = (row: ExpenseWithCategory, received = 0): Expense => ({
  id: row.id,
  description: row.description,
  amount: minorUnitsToNumber(row.amount),
  currency: row.currency,
  date: dateToIsoDate(row.date),
  categoryId: row.categoryId,
  categoryName: row.category.name,
  notes: row.notes,
  status: row.status,
  accountId: row.accountId,
  accountLabel: labelOfAccount(row.account),
  isRecurring: row.isRecurring,
  originCurrency: row.originCurrency,
  originAmount:
    row.originAmount === null ? null : minorUnitsToNumber(row.originAmount),
  expectedReimbursement:
    row.expectedReimbursement === null
      ? null
      : minorUnitsToNumber(row.expectedReimbursement),
  reimbursementReceived: received,
  installmentPlanId: row.installmentPlanId,
  installmentNumber: row.installmentNumber,
  cardId: row.cardId ?? null,
  purchaseDate: row.purchaseDate ? dateToIsoDate(row.purchaseDate) : null,
});

const toCategory = (
  row: Pick<CategoryRow, "id" | "name">,
): ExpenseCategory => ({
  id: row.id,
  name: row.name,
});

// A client the writes of an expense go through: the Prisma client itself, or a transaction.
type EntryWriter = Pick<
  Prisma.TransactionClient,
  "expense" | "recurringExpense" | "recurringExpenseDecision"
>;

// Where an expense lands once its card is known: the date it is stored with (the charge date for a
// credit card, the date as typed otherwise), the card fields to write, and the account the money
// leaves. `debit` is set when a debit card decided that account.
interface Charge {
  date: string;
  cardId: string | null;
  purchaseDate: string | null;
  accountId: string;
  debit: boolean;
}

// The account the form chose, which an expense without a card or with a credit card needs.
const chosenAccountId = (input: ExpenseInput): string => {
  if (!input.accountId) {
    throw new ExpenseAccountRequiredError();
  }

  return input.accountId;
};

// The client only sends a card id and the purchase day, so neither is trusted: the card must be the
// user's. A credit card must have a cap in the currency of the expense, and the charge date is worked
// out from its billing cycle. A debit or prepaid card takes the money the same day, from its bank's
// account in the expense's currency (or the one the expense already left, see debitAccountOf); the
// account the form sent is ignored. Without a card nothing changes.
const resolveCharge = async (
  userId: string,
  input: ExpenseInput,
  stored: StoredCharge | null,
): Promise<Charge> => {
  if (!input.cardId) {
    return {
      date: input.date,
      cardId: null,
      purchaseDate: null,
      accountId: chosenAccountId(input),
      debit: false,
    };
  }

  const card = await findOwnedCard(userId, input.cardId);

  if (card.kind === "DEBIT") {
    return {
      date: input.date,
      cardId: card.id,
      purchaseDate: null,
      accountId: debitAccountOf(card, input.currency, stored),
      debit: true,
    };
  }

  if (!limitIn(card, input.currency)) {
    throw new CardCurrencyMismatchError();
  }

  return {
    date: firstInstallmentDate(input.date, card.closingDay, card.dueDay),
    cardId: card.id,
    purchaseDate: input.date,
    accountId: chosenAccountId(input),
    debit: false,
  };
};

const toCardData = ({ cardId, purchaseDate }: Charge) => ({
  cardId,
  purchaseDate: purchaseDate ? isoDateToDate(purchaseDate) : null,
});

// What a debit expense takes from its account.
interface DebitUse {
  accountId: string;
  currency: string;
  // Minor units.
  amount: number;
  date: string;
}

// Money that leaves on a day that has not come is not a thing a debit card does: a paid expense with a
// debit card cannot be dated after today, whether or not its funds need a new check.
const assertNotFutureDebit = (
  isDebit: boolean,
  status: EntryStatus,
  date: string,
): void => {
  if (isDebit && status === "SETTLED" && isFutureDate(date, todayIso())) {
    throw new ExpenseFutureDebitError();
  }
};

// The funds check of a debit card, stage 3's pattern: the account row is locked first (FOR NO KEY
// UPDATE, like every writer of an account), then its balance is read at the expense's date and now,
// without the expense's own effect, inside the transaction that writes it, so two expenses on the same
// account cannot spend the same money. The lower of the two balances must cover the amount. The
// account may have been archived or changed between the read and the lock: only the account the
// expense already has (`keepAccountId`) may be archived.
const assertDebitFunds = async (
  tx: Prisma.TransactionClient,
  userId: string,
  use: DebitUse,
  excludeExpenseId: string | undefined,
  keepAccountId: string | null,
): Promise<void> => {
  const locked = await lockAccount(tx, userId, use.accountId);

  if (
    !locked ||
    locked.currency !== use.currency ||
    (locked.archivedAt !== null && locked.id !== keepAccountId)
  ) {
    throw new CardBankWithoutAccountError(use.currency);
  }

  const [onDate] = await readAccountBalances(tx, userId, [use.accountId], {
    asOf: use.date,
    excludeExpenseId,
  });
  const [now] = await readAccountBalances(tx, userId, [use.accountId], {
    excludeExpenseId,
  });
  const available = Math.min(onDate?.balance ?? 0, now?.balance ?? 0);

  if (available < use.amount) {
    throw new ExpenseInsufficientFundsError(available, use.currency);
  }
};

// The reference price as the database stores it: a pair of both values or two nulls.
const toOriginData = (
  input: Pick<ExpenseInput, "originCurrency" | "originAmount">,
) => ({
  originCurrency: input.originCurrency,
  originAmount: input.originAmount === null ? null : BigInt(input.originAmount),
});

// Explicit field list: the owner and id can never be overridden by the payload. The recurring
// flag is not part of it: it follows the link to a template, which the callers set themselves.
// `date` is the date to store, which the card may have moved, and `accountId` the account the charge
// resolved. The origin is written as a pair; nulls clear a previous one on update, and so does a null
// expected reimbursement.
const toWritableData = (
  input: ExpenseInput,
  charge: Pick<Charge, "date" | "accountId">,
) => ({
  description: input.description,
  amount: BigInt(input.amount),
  currency: input.currency,
  date: isoDateToDate(charge.date),
  categoryId: input.categoryId,
  notes: input.notes,
  status: input.status,
  accountId: charge.accountId,
  ...toOriginData(input),
  expectedReimbursement:
    input.expectedReimbursement === null
      ? null
      : BigInt(input.expectedReimbursement),
});

// The incomes linked to an expense are in its currency and need it to expect a reimbursement, so
// neither can change underneath them. Nothing is read unless the edit touches one of the two.
const assertReimbursementsStillValid = async (
  userId: string,
  id: string,
  current: { currency: string; expectedReimbursement: bigint | null },
  input: ExpenseInput,
): Promise<void> => {
  const changesCurrency = current.currency !== input.currency;
  const clearsReimbursement =
    current.expectedReimbursement !== null &&
    input.expectedReimbursement === null;

  if (!changesCurrency && !clearsReimbursement) {
    return;
  }

  if ((await countLinkedIncomes(userId, id)) === 0) {
    return;
  }

  throw changesCurrency
    ? new ExpenseCurrencyLockedError()
    : new ReimbursementLockedError();
};

// Remembers the expense being saved as a monthly template (same description, amount, currency,
// category, account, notes and reference price, on the same day of the month) and records that this month is already
// accounted for: the expense itself is the month's occurrence. `date` is the date the expense is
// stored with, which is the charge date when it was paid with a card.
const createTemplateFor = async (
  db: EntryWriter,
  userId: string,
  input: ExpenseInput,
  charge: Pick<Charge, "date" | "accountId">,
): Promise<string> => {
  const template = await db.recurringExpense.create({
    data: {
      userId,
      description: input.description,
      amount: BigInt(input.amount),
      currency: input.currency,
      categoryId: input.categoryId,
      notes: input.notes,
      accountId: charge.accountId,
      ...toOriginData(input),
      dayOfMonth: dayOfMonthOf(charge.date),
    },
  });

  await db.recurringExpenseDecision.create({
    data: {
      recurringExpenseId: template.id,
      month: monthOf(charge.date),
      decision: "ENABLED",
    },
  });

  return template.id;
};

// The client only sends a category id, so it is never trusted: it must belong to the user.
export const assertCategoryOwnedBy = async (
  userId: string,
  categoryId: string,
): Promise<void> => {
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });

  if (!category) {
    throw new CategoryNotFoundError();
  }
};

// One page of the user's expenses. A page past the end is clamped to the last one. Every
// operation is scoped by userId (see buildEntriesWhere) so one user can never read or change
// another user's records.
export const listExpenses = async (
  userId: string,
  query: EntriesQuery = DEFAULT_ENTRIES_QUERY,
): Promise<ExpensesPage> => {
  const where = buildEntriesWhere(userId, query);
  const orderBy = buildEntriesOrderBy(query);
  const findPage = (page: number) =>
    prisma.expense.findMany({
      where,
      include: WITH_CATEGORY_NAME,
      orderBy,
      skip: (page - 1) * EXPENSES_PAGE_SIZE,
      take: EXPENSES_PAGE_SIZE,
    });

  const [total, requestedRows] = await Promise.all([
    prisma.expense.count({ where }),
    findPage(query.page),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / EXPENSES_PAGE_SIZE));
  const page = Math.min(query.page, totalPages);
  const rows =
    page === query.page || total === 0 ? requestedRows : await findPage(page);

  // What came back for the rows that expect a reimbursement: one grouped query, and none at all when
  // no row on the page expects one.
  const received = receivedById(
    await listReceivedTotals(
      userId,
      rows
        .filter((row) => row.expectedReimbursement !== null)
        .map((row) => row.id),
    ),
  );

  return {
    rows: rows.map((row) => toExpense(row, received.get(row.id) ?? 0)),
    total,
    page,
    pageSize: EXPENSES_PAGE_SIZE,
    totalPages,
  };
};

// Per-currency totals over the whole filtered set, split into paid and pending. Amounts in
// different currencies are never added together.
export const listExpenseTotals = async (
  userId: string,
  query: EntriesQuery = DEFAULT_ENTRIES_QUERY,
): Promise<CurrencyTotal[]> => {
  const groups = await prisma.expense.groupBy({
    by: ["currency", "status"],
    where: buildEntriesWhere(userId, query),
    _sum: { amount: true },
  });

  return foldCurrencyTotals(groups);
};

// The currencies the user actually has expenses in, for the currency filter.
export const listExpenseCurrencies = async (
  userId: string,
): Promise<string[]> => {
  const groups = await prisma.expense.groupBy({
    by: ["currency"],
    where: { userId },
    orderBy: { currency: "asc" },
  });

  return groups.map((group) => group.currency);
};

export const createExpense = async (
  userId: string,
  input: ExpenseInput,
): Promise<Expense> => {
  await assertCategoryOwnedBy(userId, input.categoryId);

  const charge = await resolveCharge(userId, input, null);

  await assertUsableAccount(userId, {
    accountId: charge.accountId,
    currency: input.currency,
    keepAccountId: null,
  });

  assertNotFutureDebit(charge.debit, input.status, charge.date);

  // An expense without a card writes no card fields at all: they stay null.
  const cardData = charge.cardId ? toCardData(charge) : {};
  const insert = (db: EntryWriter, recurringExpenseId: string | null) =>
    db.expense.create({
      data: {
        userId,
        ...toWritableData(input, charge),
        ...cardData,
        isRecurring: recurringExpenseId !== null,
        ...(recurringExpenseId ? { recurringExpenseId } : {}),
      },
      include: WITH_CATEGORY_NAME,
    });
  const needsFunds =
    charge.debit &&
    needsDebitFundsCheck(null, {
      accountId: charge.accountId,
      amount: input.amount,
      date: charge.date,
      status: input.status,
    });

  if (!input.isRecurring && !needsFunds) {
    return toExpense(await insert(prisma, null));
  }

  // A recurring expense is saved together with its template, and a paid debit expense together with
  // the check of its account's funds, or not at all.
  const row = await prisma.$transaction(async (tx) => {
    if (needsFunds) {
      await assertDebitFunds(
        tx,
        userId,
        {
          accountId: charge.accountId,
          currency: input.currency,
          amount: input.amount,
          date: charge.date,
        },
        undefined,
        null,
      );
    }

    const recurringExpenseId = input.isRecurring
      ? await createTemplateFor(tx, userId, input, charge)
      : null;

    return insert(tx, recurringExpenseId);
  });

  return toExpense(row);
};

// What the expense looked like when it was read, as the database stores it: the write is conditioned
// on all of it, so an edit that committed in between (after the check, before the write) makes the write
// match nothing instead of landing on money that was never checked.
interface ExpenseSnapshot {
  status: EntryStatus;
  amount: bigint;
  accountId: string;
  cardId: string | null;
  currency: string;
  date: Date;
}

const unchangedSince = (
  userId: string,
  id: string,
  snapshot: ExpenseSnapshot,
) => ({
  id,
  userId,
  status: snapshot.status,
  amount: snapshot.amount,
  accountId: snapshot.accountId,
  cardId: snapshot.cardId,
  currency: snapshot.currency,
  date: snapshot.date,
});

// Returns false when no record with that id belongs to the user. An expense that already belongs
// to a template stays linked and recurring whatever the form says, and its template is never
// touched: stopping the repetition is done from the recurring-expenses wizard. One that does not
// belong to a template yet gets one when the switch is on, except an installment of a plan: it
// never becomes recurring. Any expense may be covered by someone else. The card of an installment is
// the card of its plan (always a credit card): an edit never changes it, and the installment keeps
// the date and the account it is given. Any other expense takes the card of the form (none clears
// it); a debit card re-checks its funds only when the edit asks something new of the account. The
// write only lands on the expense as it was read: if it changed in between, ExpenseChangedError.
export const updateExpense = async (
  userId: string,
  id: string,
  input: ExpenseInput,
): Promise<boolean> => {
  await assertCategoryOwnedBy(userId, input.categoryId);

  const current = await prisma.expense.findFirst({
    where: { id, userId },
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

  if (!current) {
    return false;
  }

  const stored: StoredCharge = {
    cardId: current.cardId,
    currency: current.currency,
    accountId: current.accountId,
    amount: minorUnitsToNumber(current.amount),
    date: dateToIsoDate(current.date),
    status: current.status,
  };

  // An installment keeps the currency of its plan (and with it its card).
  if (current.installmentPlanId && input.currency !== current.currency) {
    throw new InstallmentCurrencyLockedError();
  }

  // An expense that is not recurring yet, is not an installment and has the switch turned on gets a
  // brand-new template below.
  const createsTemplate =
    !current.recurringExpenseId &&
    !current.installmentPlanId &&
    input.isRecurring;

  const charge: Charge = current.installmentPlanId
    ? {
        date: input.date,
        cardId: null,
        purchaseDate: null,
        accountId: chosenAccountId(input),
        debit: false,
      }
    : await resolveCharge(userId, input, stored);

  // The edit may keep the account the expense already has, even if it was archived since; that
  // exception is for the existing record, never for a new template.
  const keepAccountId = createsTemplate ? null : current.accountId;

  await assertUsableAccount(userId, {
    accountId: charge.accountId,
    currency: input.currency,
    keepAccountId,
  });

  await assertReimbursementsStillValid(userId, id, current, input);

  assertNotFutureDebit(charge.debit, input.status, charge.date);

  const cardData = current.installmentPlanId ? {} : toCardData(charge);
  const needsFunds =
    charge.debit &&
    needsDebitFundsCheck(stored, {
      accountId: charge.accountId,
      amount: input.amount,
      date: charge.date,
      status: input.status,
    });

  const write = async (db: EntryWriter): Promise<boolean> => {
    const recurringExpenseId = createsTemplate
      ? await createTemplateFor(db, userId, input, charge)
      : null;
    const { count } = await db.expense.updateMany({
      where: unchangedSince(userId, id, current),
      data: {
        ...toWritableData(input, charge),
        ...cardData,
        isRecurring:
          recurringExpenseId !== null || current.recurringExpenseId !== null,
        ...(recurringExpenseId ? { recurringExpenseId } : {}),
      },
    });

    // The expense was found a moment ago, so a write that matches nothing means it changed (or went)
    // in between. A template created for it is undone with the transaction.
    if (count === 0) {
      throw new ExpenseChangedError();
    }

    return true;
  };

  if (!createsTemplate && !needsFunds) {
    return write(prisma);
  }

  return prisma.$transaction(async (tx) => {
    if (needsFunds) {
      await assertDebitFunds(
        tx,
        userId,
        {
          accountId: charge.accountId,
          currency: input.currency,
          amount: input.amount,
          date: charge.date,
        },
        id,
        keepAccountId,
      );
    }

    return write(tx);
  });
};

// Changes the status of one expense without touching anything else. Returns false when no record
// with that id belongs to the user. Any expense may be COVERED (paid by someone else). Paying a
// pending debit expense takes its money now, so it goes through the funds check of a save; any other
// change looks at no account. Marking paid reads the expense, checks it and writes it only if it is
// still as it was read (ExpenseChangedError otherwise), so an edit that committed in between never gets
// settled unchecked; the funds are read under the account's lock.
export const setExpenseStatus = async (
  userId: string,
  id: string,
  status: EntryStatus,
): Promise<boolean> => {
  if (status !== "SETTLED") {
    const { count } = await prisma.expense.updateMany({
      where: { id, userId },
      data: { status },
    });

    return count > 0;
  }

  const current = await prisma.expense.findFirst({
    where: { id, userId },
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

  if (!current) {
    return false;
  }

  assertNotFutureDebit(
    current.card?.kind === "DEBIT",
    status,
    dateToIsoDate(current.date),
  );

  const update = async (db: EntryWriter): Promise<boolean> => {
    const { count } = await db.expense.updateMany({
      where: unchangedSince(userId, id, current),
      data: { status },
    });

    if (count === 0) {
      throw new ExpenseChangedError();
    }

    return true;
  };

  if (current.card?.kind !== "DEBIT" || current.status === "SETTLED") {
    return update(prisma);
  }

  return prisma.$transaction(async (tx) => {
    await assertDebitFunds(
      tx,
      userId,
      {
        accountId: current.accountId,
        currency: current.currency,
        amount: minorUnitsToNumber(current.amount),
        date: dateToIsoDate(current.date),
      },
      id,
      current.accountId,
    );

    return update(tx);
  });
};

// Returns false when no record with that id belongs to the user.
export const deleteExpense = async (
  userId: string,
  id: string,
): Promise<boolean> => {
  const { count } = await prisma.expense.deleteMany({ where: { id, userId } });

  return count > 0;
};

// Deletes the user's expenses among `ids` in one statement, with the same effect on each one as
// deleteExpense (a plan's other installments and the recurring link stay untouched). Returns how
// many were deleted: an id that is gone, or is not the user's, simply does not count.
export const deleteExpenses = async (
  userId: string,
  ids: readonly string[],
): Promise<number> => {
  const { count } = await prisma.expense.deleteMany({
    where: { id: { in: [...ids] }, userId },
  });

  return count;
};

const findCategories = async (userId: string): Promise<ExpenseCategory[]> => {
  const rows = await prisma.expenseCategory.findMany({ where: { userId } });

  return rows.map(toCategory).sort((a, b) => a.name.localeCompare(b.name));
};

const seedDefaultCategories = async (userId: string): Promise<void> => {
  await prisma.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_CATEGORY_NAMES.map((name) => ({ userId, name })),
    skipDuplicates: true,
  });
};

// A user with no categories at all gets the defaults. createMany + skipDuplicates makes
// the seeding idempotent and safe when two requests race (the unique constraint decides).
export const listCategories = async (
  userId: string,
): Promise<ExpenseCategory[]> => {
  const existing = await findCategories(userId);

  if (existing.length > 0) {
    return existing;
  }

  await seedDefaultCategories(userId);

  return findCategories(userId);
};

// Names are unique per user, ignoring case ("comida" clashes with "Comida").
export const createCategory = async (
  userId: string,
  name: string,
): Promise<ExpenseCategory> => {
  const duplicate = await prisma.expenseCategory.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });

  if (duplicate) {
    throw new DuplicateCategoryError();
  }

  try {
    const row = await prisma.expenseCategory.create({ data: { userId, name } });

    return toCategory(row);
  } catch (error) {
    // Two identical requests can both pass the check above; the constraint catches the second.
    if (isUniqueConstraintError(error)) {
      throw new DuplicateCategoryError();
    }

    throw error;
  }
};

const findCategoriesWithCounts = async (
  userId: string,
): Promise<ExpenseCategoryWithCount[]> => {
  const rows = await prisma.expenseCategory.findMany({
    where: { userId },
    include: { _count: { select: { expenses: true } } },
  });

  return rows
    .map((row) => ({ ...toCategory(row), expenseCount: row._count.expenses }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

// Same seeding rule as listCategories, plus how many expenses use each category.
export const listCategoriesWithCounts = async (
  userId: string,
): Promise<ExpenseCategoryWithCount[]> => {
  const existing = await findCategoriesWithCounts(userId);

  if (existing.length > 0) {
    return existing;
  }

  await seedDefaultCategories(userId);

  return findCategoriesWithCounts(userId);
};

// Renaming to another casing of its own name is fine; clashing with a different category
// (ignoring case) is not.
export const renameCategory = async (
  userId: string,
  id: string,
  name: string,
): Promise<ExpenseCategory> => {
  const current = await prisma.expenseCategory.findFirst({
    where: { id, userId },
    select: { id: true, name: true },
  });

  if (!current) {
    throw new CategoryNotFoundError();
  }

  if (current.name === name) {
    return { id: current.id, name: current.name };
  }

  const duplicate = await prisma.expenseCategory.findFirst({
    where: {
      userId,
      id: { not: id },
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new DuplicateCategoryError();
  }

  try {
    const { count } = await prisma.expenseCategory.updateMany({
      where: { id, userId },
      data: { name },
    });

    if (count === 0) {
      throw new CategoryNotFoundError();
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateCategoryError();
    }

    throw error;
  }

  return { id, name };
};

// Blocked while expenses use the category (the foreign key restricts it anyway) and for the
// last remaining category, so the lazy default seeding never brings defaults back by surprise.
export const deleteCategory = async (
  userId: string,
  id: string,
): Promise<void> => {
  const category = await prisma.expenseCategory.findFirst({
    where: { id, userId },
    select: {
      id: true,
      _count: {
        select: {
          expenses: true,
          recurringExpenses: true,
          installmentPlans: true,
        },
      },
    },
  });

  if (!category) {
    throw new CategoryNotFoundError();
  }

  if (
    category._count.expenses > 0 ||
    category._count.recurringExpenses > 0 ||
    category._count.installmentPlans > 0
  ) {
    throw new CategoryInUseError(
      category._count.expenses,
      category._count.recurringExpenses,
      category._count.installmentPlans,
    );
  }

  if ((await prisma.expenseCategory.count({ where: { userId } })) <= 1) {
    throw new LastCategoryError();
  }

  try {
    const { count } = await prisma.expenseCategory.deleteMany({
      where: { id, userId },
    });

    if (count === 0) {
      throw new CategoryNotFoundError();
    }
  } catch (error) {
    // An expense, template or plan was attached between the check above and the delete.
    if (isForeignKeyError(error)) {
      const [expenses, templates, plans] = await Promise.all([
        prisma.expense.count({ where: { categoryId: id, userId } }),
        prisma.recurringExpense.count({ where: { categoryId: id, userId } }),
        prisma.installmentPlan.count({ where: { categoryId: id, userId } }),
      ]);

      throw new CategoryInUseError(expenses, templates, plans);
    }

    throw error;
  }
};
