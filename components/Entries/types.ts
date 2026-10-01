// Types shared by the incomes and expenses screens.

// One card of the totals bar: amounts are already formatted in the category's currency, so the
// client never re-derives money presentation. `settled` and `pending` split `label`.
export interface TotalRow {
  currency: string;
  label: string;
  settled: string;
  pending: string;
}

export interface PaginationInfo {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

export interface EntryCategory {
  id: string;
  name: string;
}

// A category plus how many entries (incomes or expenses) use it.
export interface CategoryWithCount extends EntryCategory {
  count: number;
}

export type FieldErrors = Record<string, string[]>;

export type ActionResult =
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: FieldErrors };

export type CategoryActionResult =
  | { status: "success"; category: EntryCategory }
  | { status: "error"; message: string; fieldErrors?: FieldErrors };

// What the shared category pieces call, so they work for incomes and expenses alike.
export interface CategoryActions {
  create: (name: string) => Promise<CategoryActionResult>;
  rename: (id: string, name: string) => Promise<CategoryActionResult>;
  remove: (id: string) => Promise<ActionResult>;
}
