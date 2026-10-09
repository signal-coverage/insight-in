import { labelOfAccount, WITH_ACCOUNT_LABEL } from "@/core/accounts/label";
import type { AccountWithBank } from "@/core/accounts/label";
import { assertUsableAccount } from "@/core/accounts/usable";
import { prisma } from "@/infrastructure/db/client";
import type {
  Income as IncomeRow,
  IncomeCategory as CategoryRow,
  RecurringIncome as RecurringRow,
} from "@/lib/generated/prisma/client";

import { DEFAULT_CATEGORY_NAMES, INCOMES_PAGE_SIZE } from "./consts";
import {
  isForeignKeyError,
  isUniqueConstraintError,
} from "@/core/entries/dbErrors";
import {
  buildEntriesOrderBy,
  buildEntriesWhere,
  foldCurrencyTotals,
} from "@/core/entries/listing";
import {
  CoveredNotAllowedError,
  InstallmentCurrencyLockedError,
} from "@/core/entries/errors";
import type { EntryStatus } from "@/core/entries/status";

import { dateToIsoDate, isoDateToDate } from "./dates";
import {
  CategoryInUseError,
  CategoryNotFoundError,
  DuplicateCategoryError,
  LastCategoryError,
} from "./errors";
import { minorUnitsToNumber } from "./money";
import { DEFAULT_ENTRIES_QUERY } from "@/core/entries/query";
import { occurrenceDates } from "./recurrence";
import { assertReimbursable } from "@/core/reimbursements/service";
import type { EntriesQuery } from "@/core/entries/query";
import type {
  Income,
  IncomeCategory,
  IncomeCategoryWithCount,
  IncomeInput,
  IncomesPage,
  CurrencyTotal,
  RecurringIncome,
  RecurringIncomeInput,
} from "./types";

type IncomeWithCategory = IncomeRow & {
  category: { name: string };
  account: AccountWithBank;
  // The expense the income pays back, when it pays one back.
  reimbursesExpense?: { description: string } | null;
};
type RecurringWithCategory = RecurringRow & { category: { name: string } };

const WITH_CATEGORY_NAME = { category: { select: { name: true } } } as const;

// What an income needs besides its own columns: the name of its category and the description of the
// expense it pays back, in the same query.
const WITH_DETAILS = {
  ...WITH_CATEGORY_NAME,
  ...WITH_ACCOUNT_LABEL,
  reimbursesExpense: { select: { description: true } },
} as const;

const toIncome = (row: IncomeWithCategory): Income => ({
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
  originCurrency: row.originCurrency,
  originAmount:
    row.originAmount === null ? null : minorUnitsToNumber(row.originAmount),
  reimbursesExpenseId: row.reimbursesExpenseId,
  reimbursesExpenseDescription: row.reimbursesExpense?.description ?? null,
  recurringIncomeId: row.recurringIncomeId,
  installmentPlanId: row.installmentPlanId,
  installmentNumber: row.installmentNumber,
});

const toCategory = (row: Pick<CategoryRow, "id" | "name">): IncomeCategory => ({
  id: row.id,
  name: row.name,
});

// Explicit field list: the owner and id can never be overridden by the payload.
const toWritableData = (input: IncomeInput) => ({
  description: input.description,
  amount: BigInt(input.amount),
  currency: input.currency,
  date: isoDateToDate(input.date),
  categoryId: input.categoryId,
  notes: input.notes,
  status: input.status,
  accountId: input.accountId,
  // Written as a pair; nulls clear a previous origin on update.
  originCurrency: input.originCurrency,
  originAmount: input.originAmount === null ? null : BigInt(input.originAmount),
  // The expense this income pays back; null unlinks it on update.
  reimbursesExpenseId: input.reimbursesExpenseId,
});

// The client only sends the id of the expense an income pays back, so it is never trusted: it must be
// the user's, expect a reimbursement and be in the currency the income is saved with.
const assertReimbursementLink = async (
  userId: string,
  input: IncomeInput,
): Promise<void> => {
  if (input.reimbursesExpenseId !== null) {
    await assertReimbursable(userId, input.reimbursesExpenseId, input.currency);
  }
};

// Nothing else ever pays an income, so "covered by someone else" has no meaning for it.
const assertNotCovered = (status: EntryStatus): void => {
  if (status === "COVERED") {
    throw new CoveredNotAllowedError();
  }
};

// The client only sends a category id, so it is never trusted: it must belong to the user.
export const assertCategoryOwnedBy = async (
  userId: string,
  categoryId: string,
): Promise<void> => {
  const category = await prisma.incomeCategory.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });

  if (!category) {
    throw new CategoryNotFoundError();
  }
};

// Every operation is scoped by userId so one user can never read or change another
// user's records (see buildEntriesWhere for the list filters).
// One page of the user's incomes. A page past the end is clamped to the last one.
export const listIncomes = async (
  userId: string,
  query: EntriesQuery = DEFAULT_ENTRIES_QUERY,
): Promise<IncomesPage> => {
  const where = buildEntriesWhere(userId, query);
  const orderBy = buildEntriesOrderBy(query);
  const findPage = (page: number) =>
    prisma.income.findMany({
      where,
      include: WITH_DETAILS,
      orderBy,
      skip: (page - 1) * INCOMES_PAGE_SIZE,
      take: INCOMES_PAGE_SIZE,
    });

  // The count and the requested page are independent, so they run together. Only a page past
  // the end needs a second query (for the clamped last page); with no matches there is
  // nothing to fetch.
  const [total, requestedRows] = await Promise.all([
    prisma.income.count({ where }),
    findPage(query.page),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / INCOMES_PAGE_SIZE));
  const page = Math.min(query.page, totalPages);
  const rows =
    page === query.page || total === 0 ? requestedRows : await findPage(page);

  return {
    rows: rows.map(toIncome),
    total,
    page,
    pageSize: INCOMES_PAGE_SIZE,
    totalPages,
  };
};

// Per-currency totals over the whole filtered set (not just the visible page), computed by
// the database and split into settled and pending. Amounts in different currencies are never
// added together.
export const listIncomeTotals = async (
  userId: string,
  query: EntriesQuery = DEFAULT_ENTRIES_QUERY,
): Promise<CurrencyTotal[]> => {
  const groups = await prisma.income.groupBy({
    by: ["currency", "status"],
    where: buildEntriesWhere(userId, query),
    _sum: { amount: true },
  });

  return foldCurrencyTotals(groups);
};

// The currencies the user actually has incomes in, for the currency filter.
export const listIncomeCurrencies = async (
  userId: string,
): Promise<string[]> => {
  const groups = await prisma.income.groupBy({
    by: ["currency"],
    where: { userId },
    orderBy: { currency: "asc" },
  });

  return groups.map((group) => group.currency);
};

export const createIncome = async (
  userId: string,
  input: IncomeInput,
): Promise<Income> => {
  assertNotCovered(input.status);
  await assertCategoryOwnedBy(userId, input.categoryId);
  await assertUsableAccount(userId, {
    accountId: input.accountId,
    currency: input.currency,
    keepAccountId: null,
  });
  await assertReimbursementLink(userId, input);

  const row = await prisma.income.create({
    data: { userId, ...toWritableData(input) },
    include: WITH_DETAILS,
  });

  return toIncome(row);
};

// Returns false when no record with that id belongs to the user (nothing else is checked then).
export const updateIncome = async (
  userId: string,
  id: string,
  input: IncomeInput,
): Promise<boolean> => {
  assertNotCovered(input.status);
  await assertCategoryOwnedBy(userId, input.categoryId);

  const current = await prisma.income.findFirst({
    where: { id, userId },
    select: { accountId: true, installmentPlanId: true, currency: true },
  });

  if (!current) {
    return false;
  }

  // A row of a repayment plan keeps the currency of its plan.
  if (current.installmentPlanId && input.currency !== current.currency) {
    throw new InstallmentCurrencyLockedError();
  }

  // The edit may keep the account the income already has, even if it was archived since.
  await assertUsableAccount(userId, {
    accountId: input.accountId,
    currency: input.currency,
    keepAccountId: current.accountId,
  });
  await assertReimbursementLink(userId, input);

  const { count } = await prisma.income.updateMany({
    where: { id, userId },
    data: toWritableData(input),
  });

  return count > 0;
};

// Flips one income between planned and collected without touching anything else. Returns false
// when no record with that id belongs to the user.
export const setIncomeStatus = async (
  userId: string,
  id: string,
  status: EntryStatus,
): Promise<boolean> => {
  assertNotCovered(status);

  const { count } = await prisma.income.updateMany({
    where: { id, userId },
    data: { status },
  });

  return count > 0;
};

// Returns false when no record with that id belongs to the user.
export const deleteIncome = async (
  userId: string,
  id: string,
): Promise<boolean> => {
  const { count } = await prisma.income.deleteMany({ where: { id, userId } });

  return count > 0;
};

// Deletes the user's incomes among `ids` in one statement, with the same effect on each one as
// deleteIncome. Returns how many were deleted: an id that is gone, or is not the user's, simply
// does not count.
export const deleteIncomes = async (
  userId: string,
  ids: readonly string[],
): Promise<number> => {
  const { count } = await prisma.income.deleteMany({
    where: { id: { in: [...ids] }, userId },
  });

  return count;
};

const findCategories = async (userId: string): Promise<IncomeCategory[]> => {
  const rows = await prisma.incomeCategory.findMany({ where: { userId } });

  return rows.map(toCategory).sort((a, b) => a.name.localeCompare(b.name));
};

const seedDefaultCategories = async (userId: string): Promise<void> => {
  await prisma.incomeCategory.createMany({
    data: DEFAULT_CATEGORY_NAMES.map((name) => ({ userId, name })),
    skipDuplicates: true,
  });
};

// A user with no categories at all gets the defaults. createMany + skipDuplicates makes
// the seeding idempotent and safe when two requests race (the unique constraint decides).
export const listCategories = async (
  userId: string,
): Promise<IncomeCategory[]> => {
  const existing = await findCategories(userId);

  if (existing.length > 0) {
    return existing;
  }

  await seedDefaultCategories(userId);

  return findCategories(userId);
};

// Names are unique per user, ignoring case ("salary" clashes with "Salary").
export const createCategory = async (
  userId: string,
  name: string,
): Promise<IncomeCategory> => {
  const duplicate = await prisma.incomeCategory.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });

  if (duplicate) {
    throw new DuplicateCategoryError();
  }

  try {
    const row = await prisma.incomeCategory.create({ data: { userId, name } });

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
): Promise<IncomeCategoryWithCount[]> => {
  const rows = await prisma.incomeCategory.findMany({
    where: { userId },
    include: { _count: { select: { incomes: true } } },
  });

  return rows
    .map((row) => ({ ...toCategory(row), incomeCount: row._count.incomes }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

// Same seeding rule as listCategories, plus how many incomes use each category.
export const listCategoriesWithCounts = async (
  userId: string,
): Promise<IncomeCategoryWithCount[]> => {
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
): Promise<IncomeCategory> => {
  const current = await prisma.incomeCategory.findFirst({
    where: { id, userId },
    select: { id: true, name: true },
  });

  if (!current) {
    throw new CategoryNotFoundError();
  }

  if (current.name === name) {
    return { id: current.id, name: current.name };
  }

  const duplicate = await prisma.incomeCategory.findFirst({
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
    const { count } = await prisma.incomeCategory.updateMany({
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

// Blocked while incomes use the category (the foreign key restricts it anyway) and for the
// last remaining category, so the lazy default seeding never brings defaults back by surprise.
export const deleteCategory = async (
  userId: string,
  id: string,
): Promise<void> => {
  const category = await prisma.incomeCategory.findFirst({
    where: { id, userId },
    select: {
      id: true,
      _count: {
        select: {
          incomes: true,
          recurringIncomes: true,
          installmentPlans: true,
        },
      },
    },
  });

  if (!category) {
    throw new CategoryNotFoundError();
  }

  if (
    category._count.incomes > 0 ||
    category._count.recurringIncomes > 0 ||
    category._count.installmentPlans > 0
  ) {
    throw new CategoryInUseError(
      category._count.incomes,
      category._count.recurringIncomes,
      category._count.installmentPlans,
    );
  }

  if ((await prisma.incomeCategory.count({ where: { userId } })) <= 1) {
    throw new LastCategoryError();
  }

  try {
    const { count } = await prisma.incomeCategory.deleteMany({
      where: { id, userId },
    });

    if (count === 0) {
      throw new CategoryNotFoundError();
    }
  } catch (error) {
    // An income, template or plan was attached between the check above and the delete.
    if (isForeignKeyError(error)) {
      const [incomes, templates, plans] = await Promise.all([
        prisma.income.count({ where: { categoryId: id, userId } }),
        prisma.recurringIncome.count({ where: { categoryId: id, userId } }),
        prisma.installmentPlan.count({
          where: { incomeCategoryId: id, userId },
        }),
      ]);

      throw new CategoryInUseError(incomes, templates, plans);
    }

    throw error;
  }
};

const toRecurringIncome = (row: RecurringWithCategory): RecurringIncome => ({
  id: row.id,
  description: row.description,
  amount: minorUnitsToNumber(row.amount),
  currency: row.currency,
  categoryId: row.categoryId,
  categoryName: row.category.name,
  notes: row.notes,
  accountId: row.accountId,
  frequency: row.frequency,
  startDate: dateToIsoDate(row.startDate),
  endDate: row.endDate ? dateToIsoDate(row.endDate) : null,
});

// Explicit field list: the owner and id can never be overridden by the payload.
const toRecurringWritableData = (input: RecurringIncomeInput) => ({
  description: input.description,
  amount: BigInt(input.amount),
  currency: input.currency,
  categoryId: input.categoryId,
  notes: input.notes,
  accountId: input.accountId,
  frequency: input.frequency,
  startDate: isoDateToDate(input.startDate),
  endDate: input.endDate ? isoDateToDate(input.endDate) : null,
});

export const listRecurringIncomes = async (
  userId: string,
): Promise<RecurringIncome[]> => {
  const rows = await prisma.recurringIncome.findMany({
    where: { userId },
    include: WITH_CATEGORY_NAME,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return rows.map(toRecurringIncome);
};

export const createRecurringIncome = async (
  userId: string,
  input: RecurringIncomeInput,
): Promise<RecurringIncome> => {
  await assertCategoryOwnedBy(userId, input.categoryId);
  await assertUsableAccount(userId, {
    accountId: input.accountId,
    currency: input.currency,
    keepAccountId: null,
  });

  const row = await prisma.recurringIncome.create({
    data: { userId, ...toRecurringWritableData(input) },
    include: WITH_CATEGORY_NAME,
  });

  return toRecurringIncome(row);
};

// Editing a template only affects occurrences generated from now on: incomes it already
// produced are ordinary rows and stay untouched. Returns false when it is not the user's.
export const updateRecurringIncome = async (
  userId: string,
  id: string,
  input: RecurringIncomeInput,
): Promise<boolean> => {
  await assertCategoryOwnedBy(userId, input.categoryId);

  const current = await prisma.recurringIncome.findFirst({
    where: { id, userId },
    select: { accountId: true },
  });

  if (!current) {
    return false;
  }

  // The template may keep the account it has, even if it was archived since.
  await assertUsableAccount(userId, {
    accountId: input.accountId,
    currency: input.currency,
    keepAccountId: current.accountId,
  });

  const { count } = await prisma.recurringIncome.updateMany({
    where: { id, userId },
    data: toRecurringWritableData(input),
  });

  return count > 0;
};

// The foreign key sets recurringIncomeId to null on the generated incomes, so they stay.
export const deleteRecurringIncome = async (
  userId: string,
  id: string,
): Promise<boolean> => {
  const { count } = await prisma.recurringIncome.deleteMany({
    where: { id, userId },
  });

  return count > 0;
};

// Catch-up generation, run when the incomes page loads (there is no scheduler). For every
// template that has started it creates the occurrences up to `today` (a YYYY-MM-DD Argentine date)
// that are newer than the latest income already generated from it. Re-running is a no-op:
// the (recurringIncomeId, date) unique constraint plus skipDuplicates make it safe under
// concurrent requests, and an income the user deleted from the middle is not brought back.
// Returns how many incomes were created.
export const materializeRecurringIncomes = async (
  userId: string,
  today: string,
): Promise<number> => {
  const templates = await prisma.recurringIncome.findMany({
    where: { userId, startDate: { lte: isoDateToDate(today) } },
  });

  if (templates.length === 0) {
    return 0;
  }

  const latest = await prisma.income.groupBy({
    by: ["recurringIncomeId"],
    where: {
      userId,
      recurringIncomeId: { in: templates.map((template) => template.id) },
    },
    _max: { date: true },
  });
  const latestByTemplate = new Map(
    latest.flatMap((group) =>
      group.recurringIncomeId && group._max.date
        ? [[group.recurringIncomeId, dateToIsoDate(group._max.date)] as const]
        : [],
    ),
  );

  const data = templates.flatMap((template) => {
    const generatedThrough = latestByTemplate.get(template.id);

    return occurrenceDates({
      frequency: template.frequency,
      startDate: dateToIsoDate(template.startDate),
      endDate: template.endDate ? dateToIsoDate(template.endDate) : null,
      until: today,
    })
      .filter((date) => !generatedThrough || date > generatedThrough)
      .map((date) => ({
        userId,
        description: template.description,
        amount: template.amount,
        currency: template.currency,
        categoryId: template.categoryId,
        notes: template.notes,
        // Every occurrence goes to the template's account.
        accountId: template.accountId,
        date: isoDateToDate(date),
        recurringIncomeId: template.id,
        // A generated occurrence still has to be confirmed as collected.
        status: "PLANNED" as const,
      }));
  });

  if (data.length === 0) {
    return 0;
  }

  const { count } = await prisma.income.createMany({
    data,
    skipDuplicates: true,
  });

  return count;
};
