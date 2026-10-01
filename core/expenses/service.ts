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

const toExpense = (row: ExpenseWithCategory): Expense => ({
  id: row.id,
  description: row.description,
  amount: minorUnitsToNumber(row.amount),
  currency: row.currency,
  date: dateToIsoDate(row.date),
  categoryId: row.categoryId,
  categoryName: row.category.name,
  notes: row.notes,
  status: row.status,
  isRecurring: row.isRecurring,
});

const toCategory = (
  row: Pick<CategoryRow, "id" | "name">,
): ExpenseCategory => ({
  id: row.id,
  name: row.name,
});

// Explicit field list: the owner and id can never be overridden by the payload. The recurring
// flag is not part of it: it follows the link to a template, which the callers set themselves.
const toWritableData = (input: ExpenseInput) => ({
  description: input.description,
  amount: BigInt(input.amount),
  currency: input.currency,
  date: isoDateToDate(input.date),
  categoryId: input.categoryId,
  notes: input.notes,
  status: input.status,
});

// Thrown inside a transaction to undo it when the row it was about to link has gone.
class ExpenseVanishedError extends Error {}

// Remembers the expense being saved as a monthly template (same description, amount, currency,
// category and notes, on the same day of the month) and records that this month is already
// accounted for: the expense itself is the month's occurrence.
const createTemplateFor = async (
  tx: Prisma.TransactionClient,
  userId: string,
  input: ExpenseInput,
): Promise<string> => {
  const template = await tx.recurringExpense.create({
    data: {
      userId,
      description: input.description,
      amount: BigInt(input.amount),
      currency: input.currency,
      categoryId: input.categoryId,
      notes: input.notes,
      dayOfMonth: dayOfMonthOf(input.date),
    },
  });

  await tx.recurringExpenseDecision.create({
    data: {
      recurringExpenseId: template.id,
      month: monthOf(input.date),
      decision: "ENABLED",
    },
  });

  return template.id;
};

// The client only sends a category id, so it is never trusted: it must belong to the user.
const assertCategoryOwnedBy = async (
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

  return {
    rows: rows.map(toExpense),
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

  if (!input.isRecurring) {
    const row = await prisma.expense.create({
      data: { userId, ...toWritableData(input), isRecurring: false },
      include: WITH_CATEGORY_NAME,
    });

    return toExpense(row);
  }

  // A recurring expense is saved together with its template, or not at all.
  const row = await prisma.$transaction(async (tx) => {
    const recurringExpenseId = await createTemplateFor(tx, userId, input);

    return tx.expense.create({
      data: {
        userId,
        ...toWritableData(input),
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
// belong to a template yet gets one when the switch is on.
export const updateExpense = async (
  userId: string,
  id: string,
  input: ExpenseInput,
): Promise<boolean> => {
  await assertCategoryOwnedBy(userId, input.categoryId);

  const current = await prisma.expense.findFirst({
    where: { id, userId },
    select: { recurringExpenseId: true },
  });

  if (!current) {
    return false;
  }

  if (current.recurringExpenseId || !input.isRecurring) {
    const { count } = await prisma.expense.updateMany({
      where: { id, userId },
      data: {
        ...toWritableData(input),
        isRecurring: current.recurringExpenseId !== null,
      },
    });

    return count > 0;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const recurringExpenseId = await createTemplateFor(tx, userId, input);
      const { count } = await tx.expense.updateMany({
        where: { id, userId },
        data: {
          ...toWritableData(input),
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

// Flips one expense between planned and paid without touching anything else. Returns false
// when no record with that id belongs to the user.
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
      _count: { select: { expenses: true, recurringExpenses: true } },
    },
  });

  if (!category) {
    throw new CategoryNotFoundError();
  }

  if (category._count.expenses > 0 || category._count.recurringExpenses > 0) {
    throw new CategoryInUseError(
      category._count.expenses,
      category._count.recurringExpenses,
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
    // An expense or template was attached between the check above and the delete.
    if (isForeignKeyError(error)) {
      const [expenses, templates] = await Promise.all([
        prisma.expense.count({ where: { categoryId: id, userId } }),
        prisma.recurringExpense.count({ where: { categoryId: id, userId } }),
      ]);

      throw new CategoryInUseError(expenses, templates);
    }

    throw error;
  }
};
