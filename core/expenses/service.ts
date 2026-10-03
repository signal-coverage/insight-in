import { firstInstallmentDate } from "@/core/cards/cycle";
import { CardCurrencyMismatchError } from "@/core/cards/errors";
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
import { dateToIsoDate, isoDateToDate } from "@/core/incomes/dates";
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
import { prisma } from "@/infrastructure/db/client";
import type {
  Expense as ExpenseRow,
  ExpenseCategory as CategoryRow,
  Prisma,
} from "@/lib/generated/prisma/client";

import { DEFAULT_EXPENSE_CATEGORY_NAMES, EXPENSES_PAGE_SIZE } from "./consts";
import { dayOfMonthOf } from "./recurrence";
import type {
  CurrencyTotal,
  Expense,
  ExpenseCategory,
  ExpenseCategoryWithCount,
  ExpenseInput,
  ExpensesPage,
} from "./types";

type ExpenseWithCategory = ExpenseRow & { category: { name: string } };

const WITH_CATEGORY_NAME = { category: { select: { name: true } } } as const;

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
  medium: row.medium,
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

// Where an expense lands once its card is known: the date it is stored with (the charge date for an
// expense paid with a card, the date as typed otherwise) and the card fields to write.
interface Charge {
  date: string;
  cardId: string | null;
  purchaseDate: string | null;
}

// The client only sends a card id and the purchase day, so neither is trusted: the card must be the
// user's and in the currency of the expense, and the charge date is worked out here from the card's
// billing cycle. Without a card nothing changes.
const resolveCharge = async (
  userId: string,
  input: ExpenseInput,
): Promise<Charge> => {
  if (!input.cardId) {
    return { date: input.date, cardId: null, purchaseDate: null };
  }

  const card = await findOwnedCard(userId, input.cardId);

  if (card.currency !== input.currency) {
    throw new CardCurrencyMismatchError();
  }

  return {
    date: firstInstallmentDate(input.date, card.closingDay, card.dueDay),
    cardId: card.id,
    purchaseDate: input.date,
  };
};

const toCardData = ({ cardId, purchaseDate }: Charge) => ({
  cardId,
  purchaseDate: purchaseDate ? isoDateToDate(purchaseDate) : null,
});

// The reference price as the database stores it: a pair of both values or two nulls.
const toOriginData = (
  input: Pick<ExpenseInput, "originCurrency" | "originAmount">,
) => ({
  originCurrency: input.originCurrency,
  originAmount: input.originAmount === null ? null : BigInt(input.originAmount),
});

// Explicit field list: the owner and id can never be overridden by the payload. The recurring
// flag is not part of it: it follows the link to a template, which the callers set themselves.
// `date` is the date to store, which the card may have moved. The origin is written as a pair;
// nulls clear a previous one on update, and so does a null expected reimbursement.
const toWritableData = (input: ExpenseInput, date: string) => ({
  description: input.description,
  amount: BigInt(input.amount),
  currency: input.currency,
  date: isoDateToDate(date),
  categoryId: input.categoryId,
  notes: input.notes,
  status: input.status,
  medium: input.medium,
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

// Thrown inside a transaction to undo it when the row it was about to link has gone.
class ExpenseVanishedError extends Error {}

// Remembers the expense being saved as a monthly template (same description, amount, currency,
// category, notes and reference price, on the same day of the month) and records that this month is already
// accounted for: the expense itself is the month's occurrence. `date` is the date the expense is
// stored with, which is the charge date when it was paid with a card.
const createTemplateFor = async (
  tx: Prisma.TransactionClient,
  userId: string,
  input: ExpenseInput,
  date: string,
): Promise<string> => {
  const template = await tx.recurringExpense.create({
    data: {
      userId,
      description: input.description,
      amount: BigInt(input.amount),
      currency: input.currency,
      categoryId: input.categoryId,
      notes: input.notes,
      medium: input.medium,
      ...toOriginData(input),
      dayOfMonth: dayOfMonthOf(date),
    },
  });

  await tx.recurringExpenseDecision.create({
    data: {
      recurringExpenseId: template.id,
      month: monthOf(date),
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

  const charge = await resolveCharge(userId, input);
  // An expense without a card writes no card fields at all: they stay null.
  const cardData = charge.cardId ? toCardData(charge) : {};

  if (!input.isRecurring) {
    const row = await prisma.expense.create({
      data: {
        userId,
        ...toWritableData(input, charge.date),
        ...cardData,
        isRecurring: false,
      },
      include: WITH_CATEGORY_NAME,
    });

    return toExpense(row);
  }

  // A recurring expense is saved together with its template, or not at all.
  const row = await prisma.$transaction(async (tx) => {
    const recurringExpenseId = await createTemplateFor(
      tx,
      userId,
      input,
      charge.date,
    );

    return tx.expense.create({
      data: {
        userId,
        ...toWritableData(input, charge.date),
        ...cardData,
        isRecurring: true,
        recurringExpenseId,
      },
      include: WITH_CATEGORY_NAME,
    });
  });

  return toExpense(row);
};

// Returns false when no record with that id belongs to the user. An expense that already belongs
// to a template stays linked and recurring whatever the form says, and its template is never
// touched: stopping the repetition is done from the recurring-expenses wizard. One that does not
// belong to a template yet gets one when the switch is on, except an installment of a plan: it
// never becomes recurring. Any expense may be covered by someone else. The card of an installment is
// the card of its plan: an edit never changes it, and the installment keeps the date it is given.
// Any other expense takes the card of the form (none clears it) and the charge date follows.
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
    },
  });

  if (!current) {
    return false;
  }

  await assertReimbursementsStillValid(userId, id, current, input);

  const charge: Charge = current.installmentPlanId
    ? { date: input.date, cardId: null, purchaseDate: null }
    : await resolveCharge(userId, input);
  const cardData = current.installmentPlanId ? {} : toCardData(charge);

  if (
    current.recurringExpenseId ||
    current.installmentPlanId ||
    !input.isRecurring
  ) {
    const { count } = await prisma.expense.updateMany({
      where: { id, userId },
      data: {
        ...toWritableData(input, charge.date),
        ...cardData,
        isRecurring: current.recurringExpenseId !== null,
      },
    });

    return count > 0;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const recurringExpenseId = await createTemplateFor(
        tx,
        userId,
        input,
        charge.date,
      );
      const { count } = await tx.expense.updateMany({
        where: { id, userId },
        data: {
          ...toWritableData(input, charge.date),
          ...cardData,
          isRecurring: true,
          recurringExpenseId,
        },
      });

      if (count === 0) {
        throw new ExpenseVanishedError();
      }
    });
  } catch (error) {
    if (error instanceof ExpenseVanishedError) {
      return false;
    }

    throw error;
  }

  return true;
};

// Changes the status of one expense without touching anything else. Returns false when no record
// with that id belongs to the user. Any expense may be COVERED (paid by someone else).
export const setExpenseStatus = async (
  userId: string,
  id: string,
  status: EntryStatus,
): Promise<boolean> => {
  const { count } = await prisma.expense.updateMany({
    where: { id, userId },
    data: { status },
  });

  return count > 0;
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
