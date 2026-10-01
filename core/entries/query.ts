import { z } from "zod";

import { SUPPORTED_CURRENCY_CODES } from "@/core/incomes/consts";
import { firstOfMonthIso, isValidIsoDate } from "@/core/incomes/dates";

import { ENTRY_STATUSES } from "./status";
import type { EntryStatus } from "./status";

// The list state (filters, sort, page) lives in the URL. Everything here is pure so the
// same rules serve the server (parsing search params) and the client (building URLs).

export const ENTRY_SORT_KEYS = ["date", "description", "category"] as const;

export type EntrySortKey = (typeof ENTRY_SORT_KEYS)[number];

export type SortDirection = "asc" | "desc";

export interface EntriesQuery {
  page: number;
  from: string | null;
  to: string | null;
  categoryId: string | null;
  currency: string | null;
  status: EntryStatus | null;
  sort: EntrySortKey;
  direction: SortDirection;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const DEFAULT_ENTRIES_QUERY: EntriesQuery = {
  page: 1,
  from: null,
  to: null,
  categoryId: null,
  currency: null,
  status: null,
  sort: "date",
  direction: "desc",
};

const SUPPORTED_CURRENCY_SET = new Set(SUPPORTED_CURRENCY_CODES);

// Dates read newest first; text columns read A to Z.
export const defaultDirection = (sort: EntrySortKey): SortDirection =>
  sort === "date" ? "desc" : "asc";

const firstValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

// Each field has a schema that resolves to its default when the value is missing or
// invalid, so parsing can never throw or reject the whole query over one bad param.
const pageSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .catch(1);

const dateSchema = z.string().refine(isValidIsoDate).nullable().catch(null);

const categoryIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .nullable()
  .catch(null);

const currencySchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .refine((value) => SUPPORTED_CURRENCY_SET.has(value))
  .nullable()
  .catch(null);

const statusSchema = z.enum(ENTRY_STATUSES).nullable().catch(null);

const sortSchema = z.enum(ENTRY_SORT_KEYS).catch("date");

const directionSchema = z.enum(["asc", "desc"]).nullable().catch(null);

// The range the list opens with: the first of today's month up to today.
export const defaultDateRange = (
  today: string,
): { from: string; to: string } => ({
  from: firstOfMonthIso(today),
  to: today,
});

export interface ParseOptions {
  // The user's calendar date. When given and the URL says nothing about dates, the list shows
  // the current month up to today instead of everything.
  today?: string;
}

// A `from` or `to` key that is present, even empty, is the user's choice ("" = no date
// filter). Only a URL with neither key falls back to the default range.
const hasDateParams = (raw: RawSearchParams): boolean =>
  raw.from !== undefined || raw.to !== undefined;

export const parseEntriesQuery = (
  raw: RawSearchParams,
  { today }: ParseOptions = {},
): EntriesQuery => {
  const range =
    today !== undefined && !hasDateParams(raw) ? defaultDateRange(today) : null;
  const from = range
    ? range.from
    : dateSchema.parse(firstValue(raw.from) ?? null);
  const to = range ? range.to : dateSchema.parse(firstValue(raw.to) ?? null);
  const sort = sortSchema.parse(firstValue(raw.sort));
  const [start, end] = from && to && from > to ? [to, from] : [from, to];

  return {
    page: pageSchema.parse(firstValue(raw.page)),
    from: start,
    to: end,
    categoryId: categoryIdSchema.parse(firstValue(raw.categoryId) ?? null),
    currency: currencySchema.parse(firstValue(raw.currency) ?? null),
    status: statusSchema.parse(firstValue(raw.status) ?? null),
    sort,
    direction:
      directionSchema.parse(firstValue(raw.direction) ?? null) ??
      defaultDirection(sort),
  };
};

// Whether the dates are exactly the default range for `today`.
const isDefaultRange = (query: EntriesQuery, today: string): boolean => {
  const range = defaultDateRange(today);

  return query.from === range.from && query.to === range.to;
};

// The query string ("?a=b" or "") holding only what differs from the defaults. Pass `today` to
// treat the default date range as "nothing to write", which gives the default state a clean URL
// that the server resolves to the current month. "No date filter at all" is the one thing that
// must be written, as empty `from` and `to`: a URL without them means "use the default range"
// and would bring that range back.
export const serializeEntriesQuery = (
  query: EntriesQuery,
  today?: string,
): string => {
  const params = new URLSearchParams();
  const datesAreDefault = today !== undefined && isDefaultRange(query, today);

  if (query.page !== DEFAULT_ENTRIES_QUERY.page)
    params.set("page", String(query.page));
  if (!datesAreDefault) {
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    if (!query.from && !query.to) {
      params.set("from", "");
      params.set("to", "");
    }
  }
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.currency) params.set("currency", query.currency);
  if (query.status) params.set("status", query.status);
  if (query.sort !== DEFAULT_ENTRIES_QUERY.sort) params.set("sort", query.sort);
  if (query.direction !== defaultDirection(query.sort))
    params.set("direction", query.direction);

  const serialized = params.toString();

  return serialized ? `?${serialized}` : "";
};

// Whether the list differs from where it starts. With `today`, the start is the default date
// range (so the dates only count when they differ from it); without it, any date counts.
export const hasActiveFilters = (
  query: EntriesQuery,
  today?: string,
): boolean => {
  if (query.categoryId || query.currency || query.status) {
    return true;
  }

  return today === undefined
    ? Boolean(query.from || query.to)
    : !isDefaultRange(query, today);
};

// Changing anything but the page sends the user back to page 1.
export const withQueryChange = (
  query: EntriesQuery,
  patch: Partial<EntriesQuery>,
): EntriesQuery => ({ ...query, ...patch, page: patch.page ?? 1 });

// Back to the starting point: no category, currency or status, and, with `today`, the default date range
// (without it the dates are simply removed). The sort is kept.
export const clearFilters = (
  query: EntriesQuery,
  today?: string,
): EntriesQuery => ({
  ...query,
  page: 1,
  ...(today === undefined ? { from: null, to: null } : defaultDateRange(today)),
  categoryId: null,
  currency: null,
  status: null,
});
