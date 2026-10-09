# Account Instead of Medium (Stage 2a: entries move to accounts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every income, expense, recurring template and installment plan belongs to an account instead of a "Medio" (DIGITAL/CASH). The forms offer a "Cuenta" select (active accounts of the chosen currency, reset when the currency changes, preselected when there is exactly one, a link to Bancos when there is none), the services refuse an account that is not the user's, is archived or is in another currency, generated entries copy their template's or plan's account, and the Incomes/Expenses tables show a "Cuenta" column ("Banco · Cuenta") instead of the cash marker.

**Architecture:** Expand/contract. Task 1 ships an _expand_ migration: a nullable `accountId` (FK `Restrict`, index) on `Income`, `Expense`, `RecurringIncome`, `RecurringExpense`, `InstallmentPlan` and `OpeningBalance`, while `medium` stays in the database with its `DEFAULT 'DIGITAL'`. Then each entry slice switches to `accountId` in one vertical task (schema + service + form + table + tests), so `medium` disappears from the code slice by slice and every task boundary stays green. Code that reads `accountId` from a row goes through two tiny shims in `core/accounts/expand.ts` (marked `EXPAND`) because the column is still nullable; stage 2b's contract task makes it `NOT NULL`, drops `medium` and deletes the shims. The summary, the opening balance and the Banks board balances are untouched here (stage 2b).

**Tech Stack:** Next.js 16.3.6 (App Router, server actions), React 19.2, TypeScript, Prisma 7 + Neon, zod 4, HeroUI v3 (`@heroui/react`), Tailwind 4, Vitest 4 + Testing Library (jsdom per file), Clerk.

**Spec:** docs/superpowers/specs/2026-10-04-accounts-banks-transfers-design.md (Stage 2: "Data model", "Forms, tables and opening balance"). Stage 2b (`docs/superpowers/plans/2026-10-05-account-instead-of-medium-stage-2b.md`) covers the balances, the summary, the opening balance, the balance-dependent Banks rules and the contract migration. Stage 3 (transfers) is out of scope.

**Why two plans:** stage 2 is ~25 tasks in two phases that each ship on their own and leave the app fully working: 2a moves every entry onto an account (the summary keeps reading `medium`, which the database still fills with `DIGITAL`); 2b rebuilds every balance on accounts and contracts the schema. Splitting keeps each plan reviewable and lets the human apply the expand migration and check the forms before the balance work starts.

## Global Constraints

- Copy language: all UI copy (labels, buttons, errors, empty states, hints) in Spanish es-AR, neutral/professional, voseo as in Cards/Roadmap/Banks ("Elegí", "Creá", "Reactivala"). Code, identifiers, comments and tests in English. Route slugs stay English.
- Component layout is enforced by `components/componentStructure.test.ts` (scans `components/` and `app/`, `.tsx` files that are not tests): no `type`/`interface`/`enum` declarations in a component file, no `const`/helper function at column 0 (only the component itself), exactly one component per file, no props typed inline (`}: {`), no inline `className="..."` of 40+ characters (move it to `styles.ts`), a sub-component is never a bare file under a nested `components/` folder (it gets its own folder `Name/Name.tsx` plus `index.ts`). Types go in `types.ts`, constants in `consts.ts`, styles in `styles.ts`, helpers in `utils.ts`, hooks in `useX.ts`.
- Strict TDD with Vitest: every behaviour gets a failing test first; run it and see it fail for the stated reason before writing the implementation (RED), then see it pass (GREEN). Component tests start with `// @vitest-environment jsdom`. Tests that pin the old `medium` behaviour are rewritten in the task that changes that behaviour (each task names them).
- Money convention: minor units, `BigInt` in the database, `number` in the app (`minorUnitsToNumber` at the boundary). Nothing in this plan changes an amount.
- Every record is scoped by the Clerk `userId` that comes from the session (`runAuthenticated`), never from client input; another user's id (entry, account, category, card) behaves as not found and nothing is written.
- The account of an entry: required on every write; it must be the user's (`AccountNotFoundError`), in the currency of the movement (`AccountCurrencyMismatchError`) and active (`AccountArchivedError`), except that an edit may keep the archived account the record already has. One guard does it: `assertUsableAccount` (Task 2). Generated entries (recurring wizard, recurring catch-up, plan installments) copy the template's or plan's account without re-checking it (stage 2b forbids archiving an account that a template or a pending entry still uses).
- Colors: never blue buttons; only theme tokens already used by existing components (`text-muted`, `bg-surface-secondary`, `ring-border`, ...). Async buttons use `PendingButton` (guard `components/shared/PendingButton/pendingButtonUsage.test.ts` forbids `isPending` on a raw HeroUI `Button`).
- Next.js (this repo runs 16.3.6, see AGENTS.md): pages are async Server Components that call `requireUserId()` (guard `lib/auth/routeProtection.test.ts`); `"use server"` files export only async functions; `revalidatePath` only after a successful write. No new Next API is used in this plan.
- HeroUI v3 usage is copied from components that already work in this repo (`CardField` for the select, `SidebarNavLink` for `Link`), checked against `.heroui-docs/react/components/(pickers)/select.mdx` and `(navigation)/link.mdx`.
- No git commit steps (the user commits only when asked). Every task ends with a verify step: that task's tests, `npx tsc --noEmit`, and `npx eslint <the task's paths>` (the husky pre-commit hook runs `npm run lint`). Every task boundary leaves `npx vitest run`, `npx tsc --noEmit` and `npm run lint` fully green; the last step of every task runs all three.
- Do not start, stop or restart `next dev` (the human runs it on port 3000). Migrations touching the shared Neon database are written by hand into `prisma/migrations/<timestamp>_<name>/migration.sql`; the controller applies them with `npx prisma migrate deploy` only after the human's OK. The implementer only runs `npx prisma validate`, `npx prisma generate` and `npx prisma migrate diff --from-schema ... --to-schema ... --script` (read-only, no database).
- `EXPAND` marker: every line that only exists because `accountId` is still nullable carries a `// EXPAND` comment or goes through `core/accounts/expand.ts`. Stage 2b Task 11 greps for `EXPAND` and removes all of them.

## Review Focus

1. A movement in a currency that differs from its account's: the form never offers such an account (Task 4) and every service refuses it with a Spanish field error on "Cuenta", whatever the client sends — pinned in Task 2 (guard + error mapping), Task 6 (expenses), Task 7 (incomes), Task 8 (expense templates), Task 9 (income templates), Task 10 (purchases in installments), Task 11 (repayments).
2. An archived account chosen on an old entry: a new entry, template or plan never takes an archived account (refused), while editing an entry or template that already sits on an archived account keeps it (offered as "… (archivada)" and accepted on save) — pinned in Task 2 (`keepAccountId`), Task 4 (field), Task 6 and Task 7 (edits), Task 8 and Task 9 (template edits).
3. Another user's account id (or an unknown one) in any write: behaves as not found, nothing is written — pinned in Task 2 and in each slice's service test (Tasks 6–11).
4. Generated entries carry their template's or plan's account: the monthly wizard, `setRecurringDecision`, the recurring-income catch-up, every installment of a purchase or repayment, and the template created from a recurring expense — pinned in Task 6 (template from an expense), Task 8, Task 9, Task 10, Task 11.
5. A currency change in a form leaves no stale account behind (reset to none, or to the only account of the new currency) and a purchase with the user's own credit card no longer forces anything: the account is always chosen — pinned in Task 4 (`resolveAccountId`), Task 6 (expense form), Task 10 (planner, own-card rule removed), Task 11 (repayment planner).

## File Structure

Prisma and tooling

- Modify `prisma/schema.prisma` — nullable `accountId` + `account` relation (`Restrict`) + `@@index([accountId])` on six models; six back-relations on `Account`.
- Modify `prisma/schema.test.ts` — pins the new relations.
- Create `prisma/migrations/20261005120000_entries_account_expand/migration.sql` — written by hand (Task 1).
- Modify `scripts/clearData/tables.ts` and `scripts/clearData/tables.test.ts` — the entries and `OpeningBalance` now reference `Account`.

Core: accounts (`core/accounts`)

- Modify `errors.ts` (+ `AccountArchivedError`, `AccountCurrencyMismatchError`), `consts.ts` (+ entry-facing messages), `types.ts` (+ `AccountChoice`).
- Create `usable.ts` (+ `usable.test.ts`) — `assertUsableAccount`.
- Create `label.ts` (+ `label.test.ts`) — `accountLabel(bankName, accountName)` = "Banco · Cuenta".
- Create `choices.ts` (+ `choices.test.ts`) — `listAccountChoices(userId)` for the forms.
- Create `expand.ts` (+ `expand.test.ts`) — `EXPAND` shims `assignedAccountId`, `assignedAccountLabel` (deleted by the contract task of 2b).
- `label.ts` also holds `labelOfAccount` and the `WITH_ACCOUNT_LABEL` include every entry read uses.

Core: entries

- Modify `core/entries/fields.ts` — `accountIdField`; Task 12 removes `mediumField`.
- Modify `core/entries/actionHelpers.ts` — maps the three account errors to a field error on `accountId`.
- Create `core/entries/actionHelpers.test.ts`, `core/entries/accountIdField.test.ts`.
- Modify `core/entries/medium.ts`, `core/entries/medium.test.ts` (Task 12 trims them to what 2b still reads).

Core: entry slices

- `core/expenses/{schema,consts,types,service,pageData,recurringSchema,recurringService}.ts` and their tests.
- `core/incomes/{schema,consts,types,service,pageData}.ts` and their tests.
- `core/installments/{schema,types,service,incomeService}.ts` and their tests.

Components

- Create `components/Entries/components/AccountField/` (`AccountField.tsx`, `AccountField.test.tsx`, `consts.ts`, `types.ts`, `styles.ts`, `utils.ts`, `utils.test.ts`, `index.ts`).
- Modify the forms: `ExpenseFormDrawer`, `IncomeFormDrawer`, `TemplateFormDrawer` (+ `RecurringExpensesDrawer` plumbing), `RecurringFormDrawer`, `InstallmentPlannerDrawer` (+ `PurchaseForm`, `CardOwnershipFields`), `RepaymentPlannerDrawer` (+ `RepaymentForm`).
- Modify the tables: `ExpensesTable`, `IncomesTable` (+ `components/Entries/tableStyles.ts`); delete `components/Entries/components/CashMarker/`; remove the `cash` marker from `components/Entries/markers.ts` and `components/Help/legend.ts`.
- Modify `components/Expenses/{Expenses.tsx,types.ts}`, `components/Incomes/{Incomes.tsx,types.ts}`.
- Delete `components/Entries/components/MediumField/` (Task 12); `components/Entries/components/InstallmentTicket/consts.ts` swaps `MEDIUM_LINE` for `ACCOUNT_LINE`.

Routes

- Modify `app/dashboard/expenses/loadExpensesView.ts` (+ test) and `app/dashboard/incomes/loadIncomesView.ts` (+ test).

## Shared fixtures (used by many tasks)

Test files that need an account use these literal values, so every task writes the same thing:

```ts
// An account as the forms receive it.
const ACCOUNTS = [
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
// The account relation as a database row carries it (see WITH_ACCOUNT_LABEL).
const ACCOUNT_ROW = { name: "Caja de ahorro", bank: { name: "Banco Galicia" } };
```

Mechanical fixture rules (each task says which files they apply to). They replace the single `medium` line of a fixture, wherever it sits:

- **Input rule** (validated input objects such as `ExpenseInput`, `IncomeInput`, `RecurringExpenseInput`, `RecurringIncomeInput`, `InstallmentPlanInput`, `IncomeInstallmentPlanInput`, and the objects a mocked service is expected to be called with): `medium: "DIGITAL",` or `medium: "CASH",` → `accountId: "acc_1",`
- **Write rule** (expected `data` of a Prisma `create`/`createMany`/`updateMany`, e.g. `WRITABLE_DATA`, `TEMPLATE_DATA`): `medium: "…",` → `accountId: "acc_1",`
- **Row rule** (database rows a mocked `findMany`/`create`/`findFirst` resolves with): `medium: "…",` → `accountId: "acc_1",` followed by the line `account: ACCOUNT_ROW,` (declare `ACCOUNT_ROW` near the top of the file, as above). Template and plan rows (which are never read with the account relation) only get `accountId: "acc_1",`.
- **Output rule** (`Expense`, `Income`, `ExpenseRow`, `IncomeRow` objects the code returns or the UI receives): `medium: "…",` → `accountId: "acc_1",` followed by `accountLabel: "Banco Galicia · Caja de ahorro",`
- **Form rule** (FormData builders such as `buildFormData` in action tests): add `accountId: "acc_1",` to the default values object.

## Tasks

### Task 1: Expand migration — nullable `accountId` on the six models

**Files:**

- Test: `prisma/schema.test.ts`, `scripts/clearData/tables.test.ts`
- Modify: `prisma/schema.prisma`, `scripts/clearData/tables.ts`
- Create: `prisma/migrations/20261005120000_entries_account_expand/migration.sql`

**Interfaces:**

- Consumes: `Account` model (stage 1).
- Produces: after `npx prisma generate`, the row types `Income`, `Expense`, `RecurringIncome`, `RecurringExpense`, `InstallmentPlan`, `OpeningBalance` from `@/lib/generated/prisma/client` carry `accountId: string | null`, and each has an optional `account` relation; `Account` has `incomes`, `expenses`, `recurringIncomes`, `recurringExpenses`, `installmentPlans`, `openingBalances` relation lists (used by stage 2b's `_count`). `medium` and `PaymentMedium` are unchanged.

- [ ] **Step 1: Write the failing schema test.** Append to `prisma/schema.test.ts`:

```ts
// Stage 2 (expand): every movement and every opening amount points at an account that cannot be
// deleted while anything points at it. The column is still nullable here; the contract step of
// stage 2b makes it required.
const ACCOUNT_RELATION =
  /account\s+Account\?\s+@relation\(fields: \[accountId\], references: \[id\], onDelete: Restrict\)/;

describe.each([
  "Income",
  "RecurringIncome",
  "Expense",
  "RecurringExpense",
  "InstallmentPlan",
  "OpeningBalance",
])("model %s and its account", (name) => {
  const model = modelBlock(name);

  it("points at an account that cannot be deleted under it", () => {
    expect(model).toMatch(/accountId\s+String\?/);
    expect(model).toMatch(ACCOUNT_RELATION);
  });

  it("indexes the account, so the movements of an account are found without a scan", () => {
    expect(model).toContain("@@index([accountId])");
  });
});

describe("model Account and its movements", () => {
  const account = modelBlock("Account");

  it("lists everything that points at it", () => {
    expect(account).toMatch(/incomes\s+Income\[\]/);
    expect(account).toMatch(/expenses\s+Expense\[\]/);
    expect(account).toMatch(/recurringIncomes\s+RecurringIncome\[\]/);
    expect(account).toMatch(/recurringExpenses\s+RecurringExpense\[\]/);
    expect(account).toMatch(/installmentPlans\s+InstallmentPlan\[\]/);
    expect(account).toMatch(/openingBalances\s+OpeningBalance\[\]/);
  });
});
```

In `scripts/clearData/tables.test.ts` replace the `PARENTS` object with:

```ts
const PARENTS: Record<string, string[]> = {
  RecurringExpenseDecision: ["RecurringExpense"],
  Expense: [
    "ExpenseCategory",
    "RecurringExpense",
    "InstallmentPlan",
    "Card",
    "Account",
  ],
  Income: [
    "IncomeCategory",
    "RecurringIncome",
    "InstallmentPlan",
    "Expense",
    "Account",
  ],
  InstallmentPlan: ["ExpenseCategory", "IncomeCategory", "Card", "Account"],
  RecurringExpense: ["ExpenseCategory", "Account"],
  RecurringIncome: ["IncomeCategory", "Account"],
  Card: [],
  OpeningBalance: ["Account"],
  Account: ["Bank"],
  Bank: [],
  BoardItem: [],
  ExpenseCategory: [],
  IncomeCategory: [],
};
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run prisma/schema.test.ts scripts/clearData/tables.test.ts`
Expected: FAIL — six "points at an account" tests (`accountId` missing), six index tests, the Account back-relations test, and "deletes every child before the parents it references" (`OpeningBalance before Account`).

- [ ] **Step 3: Snapshot the current schema for the diff** (no database):

Run: `cp prisma/schema.prisma "${TMPDIR:-/tmp}/schema-before-2a.prisma"`

- [ ] **Step 4: Edit `prisma/schema.prisma`.** In each of the six models add the two fields and the index exactly as below (keep every existing line, including `medium`).

In `model Income`, after the line `  medium         PaymentMedium  @default(DIGITAL)` add:

```prisma
  // The account the money arrived in. Nullable only until the contract step of stage 2b, which makes
  // it required; the services already require it.
  accountId      String?
  account        Account?       @relation(fields: [accountId], references: [id], onDelete: Restrict)
```

and before its closing `}` (after `  @@index([reimbursesExpenseId])`) add `  @@index([accountId])`.

In `model RecurringIncome`, after `  medium      PaymentMedium      @default(DIGITAL)` add:

```prisma
  // Copied onto every income the template generates.
  accountId   String?
  account     Account?           @relation(fields: [accountId], references: [id], onDelete: Restrict)
```

and after `  @@index([userId])` add `  @@index([accountId])`.

In `model Expense`, after `  medium                PaymentMedium   @default(DIGITAL)` add:

```prisma
  // The account the money left (for a credit-card expense, the account that pays the statement).
  accountId             String?
  account               Account?        @relation(fields: [accountId], references: [id], onDelete: Restrict)
```

and after `  @@index([cardId])` add `  @@index([accountId])`.

In `model InstallmentPlan`, after `  medium           PaymentMedium    @default(DIGITAL)` add:

```prisma
  // Copied onto every installment of the plan.
  accountId        String?
  account          Account?         @relation(fields: [accountId], references: [id], onDelete: Restrict)
```

and after `  @@index([cardId])` add `  @@index([accountId])`.

In `model RecurringExpense`, after `  medium         PaymentMedium              @default(DIGITAL)` add:

```prisma
  // Copied onto every expense the wizard creates from the template.
  accountId      String?
  account        Account?                   @relation(fields: [accountId], references: [id], onDelete: Restrict)
```

and after `  @@index([categoryId])` add `  @@index([accountId])`.

In `model OpeningBalance`, after `  medium    PaymentMedium` add:

```prisma
  // The account the amount was held in. Stage 2b moves the opening balance to one row per account.
  accountId String?
  account   Account?      @relation(fields: [accountId], references: [id], onDelete: Restrict)
```

and after `  @@index([userId])` add `  @@index([accountId])`.

In `model Account`, after `  updatedAt  DateTime  @updatedAt` add:

```prisma
  // Everything that points at the account. The foreign keys restrict, so an account with movements
  // can never be deleted (it is archived instead).
  incomes           Income[]
  expenses          Expense[]
  recurringIncomes  RecurringIncome[]
  recurringExpenses RecurringExpense[]
  installmentPlans  InstallmentPlan[]
  openingBalances   OpeningBalance[]
```

Run `npx prisma format` so the columns realign (it only touches whitespace).

- [ ] **Step 5: Write the migration by hand.** Create `prisma/migrations/20261005120000_entries_account_expand/migration.sql`:

```sql
-- Stage 2 (expand): every movement, template, plan and opening amount gets an account. The column is
-- nullable for now: the code switches to it slice by slice while `medium` (with its DEFAULT 'DIGITAL')
-- is still there, and the contract migration of stage 2b makes it NOT NULL and drops `medium`.

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "InstallmentPlan" ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "OpeningBalance" ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "RecurringExpense" ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "RecurringIncome" ADD COLUMN     "accountId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_accountId_idx" ON "Expense"("accountId");

-- CreateIndex
CREATE INDEX "Income_accountId_idx" ON "Income"("accountId");

-- CreateIndex
CREATE INDEX "InstallmentPlan_accountId_idx" ON "InstallmentPlan"("accountId");

-- CreateIndex
CREATE INDEX "OpeningBalance_accountId_idx" ON "OpeningBalance"("accountId");

-- CreateIndex
CREATE INDEX "RecurringExpense_accountId_idx" ON "RecurringExpense"("accountId");

-- CreateIndex
CREATE INDEX "RecurringIncome_accountId_idx" ON "RecurringIncome"("accountId");

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringIncome" ADD CONSTRAINT "RecurringIncome_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningBalance" ADD CONSTRAINT "OpeningBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 6: Check the hand-written SQL against Prisma's own diff (read-only, no database)**

Run: `npx prisma migrate diff --from-schema "${TMPDIR:-/tmp}/schema-before-2a.prisma" --to-schema prisma/schema.prisma --script`
Expected: the same 6 `ADD COLUMN`, 6 `CREATE INDEX` and 6 `ADD CONSTRAINT ... ON DELETE RESTRICT` statements (order and spacing may differ; no `DROP`, no `NOT NULL`). If a statement differs in substance, fix `schema.prisma`, never the expectation.

- [ ] **Step 7: Update the clear order.** In `scripts/clearData/tables.ts` replace

```ts
 *   Account -> Bank (Restrict), so accounts go before their bank
```

with

```ts
 *   Income / Expense / InstallmentPlan / RecurringExpense / RecurringIncome / OpeningBalance -> Account
 *     (Restrict), so they all go before the accounts
 *   Account -> Bank (Restrict), so accounts go before their bank
```

and replace the array body

```ts
  "Card",
  "Account",
  "Bank",
  "BoardItem",
  "OpeningBalance",
  "ExpenseCategory",
```

with

```ts
  "Card",
  "OpeningBalance",
  "Account",
  "Bank",
  "BoardItem",
  "ExpenseCategory",
```

- [ ] **Step 8: Validate, regenerate, see the tests pass**

Run: `npx prisma validate` → `The schema at prisma\schema.prisma is valid`.
Run: `npx prisma generate` → `Generated Prisma Client ... to .\lib\generated\prisma` (writes only the git-ignored client).
Run: `npx vitest run prisma/schema.test.ts scripts/clearData`
Expected: PASS.

- [ ] **Step 9: Hand the migration to the controller.** Do NOT run `prisma migrate deploy` or `migrate dev`. Report the migration path; the controller applies it with `npx prisma migrate deploy` after the human's OK.

- [ ] **Step 10: Verify**

Run: `npx vitest run` then `npx tsc --noEmit` then `npm run lint`
Expected: all green (the generated client only adds optional fields; no code reads them yet).

### Task 2: The account guard and its errors

**Files:**

- Test: `core/accounts/usable.test.ts`, `core/entries/accountIdField.test.ts`, `core/entries/actionHelpers.test.ts`
- Create: `core/accounts/usable.ts`
- Modify: `core/accounts/errors.ts`, `core/accounts/consts.ts`, `core/entries/fields.ts`, `core/entries/actionHelpers.ts`

**Interfaces:**

- Consumes: `prisma` (`@/infrastructure/db/client`), `AccountNotFoundError` (stage 1).
- Produces:
  - `core/accounts/errors.ts`: `AccountArchivedError`, `AccountCurrencyMismatchError`.
  - `core/accounts/consts.ts`: `ACCOUNT_REQUIRED_MESSAGE = "Elegí una cuenta."`, `ACCOUNT_CHOICE_NOT_FOUND_MESSAGE = "Elegí una cuenta válida."`, `ACCOUNT_ARCHIVED_MESSAGE = "Esta cuenta está archivada. Elegí otra o reactivala en Bancos."`, `ACCOUNT_CURRENCY_MISMATCH_MESSAGE = "Esta cuenta es de otra moneda. Elegí una cuenta en la moneda del movimiento."`
  - `core/accounts/usable.ts`: `interface AccountUse { accountId: string; currency: string; keepAccountId?: string | null }` and `assertUsableAccount(userId: string, use: AccountUse): Promise<void>` — throws `AccountNotFoundError`, `AccountCurrencyMismatchError`, `AccountArchivedError` (the archived check is skipped when `accountId === keepAccountId`).
  - `core/entries/fields.ts`: `accountIdField` (trimmed non-empty string, message `ACCOUNT_REQUIRED_MESSAGE`).
  - `core/entries/actionHelpers.ts`: `runAuthenticated` now turns the three account errors into `fieldFailure({ accountId: [message] })`.

- [ ] **Step 1: Write the failing tests.**

`core/accounts/usable.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ account: { findFirst: vi.fn() } }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import {
  AccountArchivedError,
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "./errors";
import { assertUsableAccount } from "./usable";

const USER_ID = "user_123";
const AT = new Date("2026-10-04T12:00:00.000Z");

const accountRow = (patch: Record<string, unknown> = {}) => ({
  id: "acc_1",
  currency: "ARS",
  archivedAt: null,
  ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("assertUsableAccount", () => {
  it("reads the account only among the user's own", async () => {
    db.account.findFirst.mockResolvedValue(accountRow());

    await assertUsableAccount(USER_ID, { accountId: "acc_1", currency: "ARS" });

    expect(db.account.findFirst).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      select: { id: true, currency: true, archivedAt: true },
    });
  });

  it("accepts an active account in the currency of the movement", async () => {
    db.account.findFirst.mockResolvedValue(accountRow());

    await expect(
      assertUsableAccount(USER_ID, { accountId: "acc_1", currency: "ARS" }),
    ).resolves.toBeUndefined();
  });

  it("treats another user's account (or an unknown id) as not found", async () => {
    db.account.findFirst.mockResolvedValue(null);

    await expect(
      assertUsableAccount(USER_ID, {
        accountId: "acc_of_someone_else",
        currency: "ARS",
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it("refuses an account in another currency than the movement", async () => {
    db.account.findFirst.mockResolvedValue(accountRow({ currency: "USD" }));

    await expect(
      assertUsableAccount(USER_ID, { accountId: "acc_1", currency: "ARS" }),
    ).rejects.toBeInstanceOf(AccountCurrencyMismatchError);
  });

  it("refuses an archived account for a new movement", async () => {
    db.account.findFirst.mockResolvedValue(accountRow({ archivedAt: AT }));

    await expect(
      assertUsableAccount(USER_ID, { accountId: "acc_1", currency: "ARS" }),
    ).rejects.toBeInstanceOf(AccountArchivedError);
  });

  it("lets an edit keep the archived account the record already has", async () => {
    db.account.findFirst.mockResolvedValue(accountRow({ archivedAt: AT }));

    await expect(
      assertUsableAccount(USER_ID, {
        accountId: "acc_1",
        currency: "ARS",
        keepAccountId: "acc_1",
      }),
    ).resolves.toBeUndefined();
  });

  it("still refuses an archived account an edit moves the record to", async () => {
    db.account.findFirst.mockResolvedValue(
      accountRow({ id: "acc_2", archivedAt: AT }),
    );

    await expect(
      assertUsableAccount(USER_ID, {
        accountId: "acc_2",
        currency: "ARS",
        keepAccountId: "acc_1",
      }),
    ).rejects.toBeInstanceOf(AccountArchivedError);
  });

  it("checks the currency even when the record keeps its archived account", async () => {
    db.account.findFirst.mockResolvedValue(
      accountRow({ currency: "USD", archivedAt: AT }),
    );

    await expect(
      assertUsableAccount(USER_ID, {
        accountId: "acc_1",
        currency: "ARS",
        keepAccountId: "acc_1",
      }),
    ).rejects.toBeInstanceOf(AccountCurrencyMismatchError);
  });
});
```

`core/entries/accountIdField.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { accountIdField } from "./fields";

describe("accountIdField", () => {
  it("trims the id it receives", () => {
    expect(accountIdField.parse(" acc_1 ")).toBe("acc_1");
  });

  it("requires an account: missing, empty or blank", () => {
    for (const value of [undefined, "", "   "]) {
      const result = accountIdField.safeParse(value);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("Elegí una cuenta.");
    }
  });
});
```

`core/entries/actionHelpers.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));

import {
  AccountArchivedError,
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "@/core/accounts/errors";

import { runAuthenticated } from "./actionHelpers";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: "user_123" });
});

const failWith = (error: Error) =>
  runAuthenticated("test", async () => {
    throw error;
  });

describe("runAuthenticated and the account of an entry", () => {
  it("puts an unknown or foreign account on the Cuenta field", async () => {
    expect(await failWith(new AccountNotFoundError())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { accountId: ["Elegí una cuenta válida."] },
    });
  });

  it("puts an archived account on the Cuenta field", async () => {
    expect(await failWith(new AccountArchivedError())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        accountId: [
          "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
        ],
      },
    });
  });

  it("puts an account in another currency on the Cuenta field", async () => {
    expect(await failWith(new AccountCurrencyMismatchError())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        accountId: [
          "Esta cuenta es de otra moneda. Elegí una cuenta en la moneda del movimiento.",
        ],
      },
    });
  });

  it("does not log these: they are the user's to fix", async () => {
    await failWith(new AccountArchivedError());

    expect(console.error).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run core/accounts/usable.test.ts core/entries/accountIdField.test.ts core/entries/actionHelpers.test.ts`
Expected: FAIL — `Failed to resolve import "./usable"`; `accountIdField` is not exported (`Cannot read properties of undefined`); `AccountArchivedError` is not exported.

- [ ] **Step 3: Add the errors and messages.** Append to `core/accounts/errors.ts`:

```ts
// An archived account takes no new movements (an edit may keep the one a record already has).
export class AccountArchivedError extends Error {
  constructor() {
    super("The account is archived");
    this.name = "AccountArchivedError";
  }
}

// A movement is always in the currency of its account.
export class AccountCurrencyMismatchError extends Error {
  constructor() {
    super("The account is in another currency than the movement");
    this.name = "AccountCurrencyMismatchError";
  }
}
```

Append to `core/accounts/consts.ts`:

```ts
// What the entry forms (incomes, expenses, templates, planners) say about the "Cuenta" field.
export const ACCOUNT_REQUIRED_MESSAGE = "Elegí una cuenta.";
export const ACCOUNT_CHOICE_NOT_FOUND_MESSAGE = "Elegí una cuenta válida.";
export const ACCOUNT_ARCHIVED_MESSAGE =
  "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.";
export const ACCOUNT_CURRENCY_MISMATCH_MESSAGE =
  "Esta cuenta es de otra moneda. Elegí una cuenta en la moneda del movimiento.";
```

- [ ] **Step 4: Create the guard.** `core/accounts/usable.ts`

```ts
import { prisma } from "@/infrastructure/db/client";

import {
  AccountArchivedError,
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "./errors";

// What a write wants to do with an account: put a movement of `currency` in it. `keepAccountId` is
// the account the record already has (null or absent for a new one).
export interface AccountUse {
  accountId: string;
  currency: string;
  keepAccountId?: string | null;
}

// The client only sends an account id, so it is never trusted: the account must be the user's (any
// other id behaves as not found), in the currency of the movement and active. An edit may keep the
// account the record already has even if it was archived since, so old entries stay editable; it can
// never move a record to an archived account. The check is not serialized against a concurrent
// archive or currency change of the account (stage 2b locks those writes, not the entry writes): the
// window is a single request wide.
export const assertUsableAccount = async (
  userId: string,
  { accountId, currency, keepAccountId = null }: AccountUse,
): Promise<void> => {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
    select: { id: true, currency: true, archivedAt: true },
  });

  if (!account) {
    throw new AccountNotFoundError();
  }

  if (account.currency !== currency) {
    throw new AccountCurrencyMismatchError();
  }

  if (account.archivedAt !== null && account.id !== keepAccountId) {
    throw new AccountArchivedError();
  }
};
```

- [ ] **Step 5: Add the field.** In `core/entries/fields.ts` add the import (after the `@/core/incomes/money` import):

```ts
import { ACCOUNT_REQUIRED_MESSAGE } from "@/core/accounts/consts";
```

and after the `mediumField` definition add:

```ts
// The account of an entry, template or plan. The service checks that it is the user's, active and in
// the currency of the movement.
export const accountIdField = z
  .string({ error: ACCOUNT_REQUIRED_MESSAGE })
  .trim()
  .min(1, ACCOUNT_REQUIRED_MESSAGE);
```

- [ ] **Step 6: Map the errors.** In `core/entries/actionHelpers.ts` add the imports (at the top, before the `@/core/cards/consts` import):

```ts
import {
  ACCOUNT_ARCHIVED_MESSAGE,
  ACCOUNT_CHOICE_NOT_FOUND_MESSAGE,
  ACCOUNT_CURRENCY_MISMATCH_MESSAGE,
} from "@/core/accounts/consts";
import {
  AccountArchivedError,
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "@/core/accounts/errors";
```

and inside `toKnownFailure`, right after the `CardCurrencyMismatchError` branch, add:

```ts
// The account of an entry, template or plan: one that is not the user's, archived, or in another
// currency than the movement.
if (error instanceof AccountNotFoundError) {
  return fieldFailure({ accountId: [ACCOUNT_CHOICE_NOT_FOUND_MESSAGE] });
}

if (error instanceof AccountArchivedError) {
  return fieldFailure({ accountId: [ACCOUNT_ARCHIVED_MESSAGE] });
}

if (error instanceof AccountCurrencyMismatchError) {
  return fieldFailure({ accountId: [ACCOUNT_CURRENCY_MISMATCH_MESSAGE] });
}
```

(The banks and accounts actions keep their own mapping: `core/banks/actionHelpers.ts` catches `AccountNotFoundError` in `write()` before this generic one is ever reached.)

- [ ] **Step 7: Run and see them pass**

Run: `npx vitest run core/accounts/usable.test.ts core/entries/accountIdField.test.ts core/entries/actionHelpers.test.ts core/accounts core/banks`
Expected: PASS (8 + 2 + 4 new tests; the stage-1 banks/accounts tests stay green).

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/accounts core/entries`, then `npx vitest run` and `npm run lint`
Expected: all green.

### Task 3: Account choices for the forms, the "Banco · Cuenta" label and the EXPAND shims

**Files:**

- Test: `core/accounts/label.test.ts`, `core/accounts/choices.test.ts`, `core/accounts/expand.test.ts`
- Create: `core/accounts/label.ts`, `core/accounts/choices.ts`, `core/accounts/expand.ts`
- Modify: `core/accounts/types.ts`

**Interfaces:**

- Consumes: `prisma`, `ensureDefaultCash(userId)` (`./defaultCash`, stage 1).
- Produces:
  - `core/accounts/types.ts`: `interface AccountChoice { id: string; currency: string; label: string; archived: boolean }`.
  - `core/accounts/label.ts`: `ACCOUNT_LABEL_SEPARATOR = " · "`, `accountLabel(bankName: string, accountName: string): string`, `interface AccountWithBank { name: string; bank: { name: string } }`, `labelOfAccount(account: AccountWithBank): string`, and `WITH_ACCOUNT_LABEL` (the Prisma include `{ account: { select: { name: true, bank: { select: { name: true } } } } }` every entry read uses).
  - `core/accounts/choices.ts`: `listAccountChoices(userId: string): Promise<AccountChoice[]>` — seeds the default cash first, returns every account of the user (archived ones included, flagged), ordered by bank then account creation.
  - `core/accounts/expand.ts` (deleted by stage 2b Task 11): `assignedAccountId(accountId: string | null): string`, `assignedAccountLabel(account: AccountWithBank | null | undefined): string`.

- [ ] **Step 1: Write the failing tests.**

`core/accounts/label.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { accountLabel, labelOfAccount, WITH_ACCOUNT_LABEL } from "./label";

describe("accountLabel", () => {
  it("reads as 'Banco · Cuenta'", () => {
    expect(accountLabel("Banco Galicia", "Caja de ahorro")).toBe(
      "Banco Galicia · Caja de ahorro",
    );
  });

  it("keeps the names as the user wrote them", () => {
    expect(accountLabel("Efectivo", "Efectivo")).toBe("Efectivo · Efectivo");
  });
});

describe("labelOfAccount", () => {
  it("labels an account read with its bank", () => {
    expect(
      labelOfAccount({
        name: "Caja de ahorro",
        bank: { name: "Banco Galicia" },
      }),
    ).toBe("Banco Galicia · Caja de ahorro");
  });
});

describe("WITH_ACCOUNT_LABEL", () => {
  it("reads just the two names the label needs", () => {
    expect(WITH_ACCOUNT_LABEL).toEqual({
      account: { select: { name: true, bank: { select: { name: true } } } },
    });
  });
});
```

`core/accounts/choices.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ account: { findMany: vi.fn() } }));
const defaultCash = vi.hoisted(() => ({ ensureDefaultCash: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("./defaultCash", () => defaultCash);

import { listAccountChoices } from "./choices";

const USER_ID = "user_123";
const AT = new Date("2026-10-04T12:00:00.000Z");

beforeEach(() => {
  vi.resetAllMocks();
  db.account.findMany.mockResolvedValue([]);
});

describe("listAccountChoices", () => {
  it("seeds the default cash account before reading, so a new user always has one to pick", async () => {
    const order: string[] = [];

    defaultCash.ensureDefaultCash.mockImplementation(async () => {
      order.push("seed");
    });
    db.account.findMany.mockImplementation(async () => {
      order.push("read");

      return [];
    });

    await listAccountChoices(USER_ID);

    expect(defaultCash.ensureDefaultCash).toHaveBeenCalledWith(USER_ID);
    expect(order).toEqual(["seed", "read"]);
  });

  it("reads only the user's accounts, with their bank, in the board's order", async () => {
    await listAccountChoices(USER_ID);

    expect(db.account.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      include: { bank: { select: { name: true } } },
      orderBy: [
        { bank: { createdAt: "asc" } },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });
  });

  it("names each account 'Banco · Cuenta' and keeps the archived ones, flagged", async () => {
    db.account.findMany.mockResolvedValue([
      {
        id: "acc_1",
        currency: "ARS",
        name: "Caja de ahorro",
        archivedAt: null,
        bank: { name: "Banco Galicia" },
      },
      {
        id: "acc_2",
        currency: "USD",
        name: "Vieja",
        archivedAt: AT,
        bank: { name: "Banco Galicia" },
      },
    ]);

    expect(await listAccountChoices(USER_ID)).toEqual([
      {
        id: "acc_1",
        currency: "ARS",
        label: "Banco Galicia · Caja de ahorro",
        archived: false,
      },
      {
        id: "acc_2",
        currency: "USD",
        label: "Banco Galicia · Vieja",
        archived: true,
      },
    ]);
  });
});
```

`core/accounts/expand.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { assignedAccountId, assignedAccountLabel } from "./expand";

// Until the contract migration of stage 2b, a row read from the database may still lack an account.
// The tables were empty when the expand migration ran, so it does not happen in practice; the shims
// only keep the types honest.
describe("assignedAccountId", () => {
  it("passes an account id through", () => {
    expect(assignedAccountId("acc_1")).toBe("acc_1");
  });

  it("turns a missing account into an empty id, which no form offers", () => {
    expect(assignedAccountId(null)).toBe("");
  });
});

describe("assignedAccountLabel", () => {
  it("labels the account 'Banco · Cuenta'", () => {
    expect(
      assignedAccountLabel({
        name: "Caja de ahorro",
        bank: { name: "Banco Galicia" },
      }),
    ).toBe("Banco Galicia · Caja de ahorro");
  });

  it("turns a missing account into an empty label", () => {
    expect(assignedAccountLabel(null)).toBe("");
    expect(assignedAccountLabel(undefined)).toBe("");
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run core/accounts/label.test.ts core/accounts/choices.test.ts core/accounts/expand.test.ts`
Expected: FAIL — `Failed to resolve import` for `./label`, `./choices` and `./expand`.

- [ ] **Step 3: Implement.** Append to `core/accounts/types.ts`:

```ts
// An account as the entry forms offer it: "Banco · Cuenta", its currency, and whether it is archived
// (an archived account is only offered to the record that already has it).
export interface AccountChoice {
  id: string;
  currency: string;
  label: string;
  archived: boolean;
}
```

`core/accounts/label.ts`

```ts
export const ACCOUNT_LABEL_SEPARATOR = " · ";

// How an account is named wherever it appears next to a movement: "Banco Galicia · Caja de ahorro".
export const accountLabel = (bankName: string, accountName: string): string =>
  `${bankName}${ACCOUNT_LABEL_SEPARATOR}${accountName}`;

// An account as an entry read brings it along (see WITH_ACCOUNT_LABEL).
export interface AccountWithBank {
  name: string;
  bank: { name: string };
}

export const labelOfAccount = (account: AccountWithBank): string =>
  accountLabel(account.bank.name, account.name);

// What every read of an entry includes to label its account.
export const WITH_ACCOUNT_LABEL = {
  account: { select: { name: true, bank: { select: { name: true } } } },
} as const;
```

`core/accounts/choices.ts`

```ts
import { prisma } from "@/infrastructure/db/client";

import { ensureDefaultCash } from "./defaultCash";
import { accountLabel } from "./label";
import type { AccountChoice } from "./types";

// The accounts the entry forms can offer, in the order of the Banks board (bank, then account, by
// creation). Archived ones come along, flagged: a form shows one only to the record that already has
// it. The first time anything needs accounts the default cash account is seeded (idempotent), so a
// new user always has one to pick. Scoped by userId.
export const listAccountChoices = async (
  userId: string,
): Promise<AccountChoice[]> => {
  await ensureDefaultCash(userId);

  const rows = await prisma.account.findMany({
    where: { userId },
    include: { bank: { select: { name: true } } },
    orderBy: [
      { bank: { createdAt: "asc" } },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  return rows.map((row) => ({
    id: row.id,
    currency: row.currency,
    label: accountLabel(row.bank.name, row.name),
    archived: row.archivedAt !== null,
  }));
};
```

`core/accounts/expand.ts`

```ts
// EXPAND — this whole file is deleted by stage 2b, Task 11 (the contract migration makes every
// accountId NOT NULL). Until then the column is nullable, so a row read back may lack an account; the
// tables were empty when the expand migration ran, so in practice it never does.
import { labelOfAccount } from "./label";
import type { AccountWithBank } from "./label";

// EXPAND: the account id of a row, or "" (no form offers it, so the user picks one on edit).
export const assignedAccountId = (accountId: string | null): string =>
  accountId ?? "";

// EXPAND: "Banco · Cuenta" for the row's account, or "" when it has none.
export const assignedAccountLabel = (
  account: AccountWithBank | null | undefined,
): string => (account ? labelOfAccount(account) : "");
```

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run core/accounts`
Expected: PASS.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/accounts`, then `npx vitest run` and `npm run lint`
Expected: all green.

### Task 4: The "Cuenta" field

**Files:**

- Test: `components/Entries/components/AccountField/utils.test.ts`, `components/Entries/components/AccountField/AccountField.test.tsx`
- Create: `components/Entries/components/AccountField/{AccountField.tsx,consts.ts,types.ts,styles.ts,utils.ts,index.ts}`

**Interfaces:**

- Consumes: `AccountChoice` (`@/core/accounts/types`), `BANKS_PATH` (`@/core/banks/consts`), `FIELD_CLASS_NAME`, `FIELD_VARIANT`, `SELECT_TRIGGER_CLASS_NAME` (`@/components/Entries/styles`).
- Produces (exported from `index.ts`):
  - `AccountField` component, props `AccountFieldProps { accounts: readonly AccountChoice[]; currency: string; value: string | null; keepAccountId?: string | null; onChange: (accountId: string | null) => void; errorMessage?: string }`. It renders a required select labelled "Cuenta" and a hidden input `name="accountId"` carrying `value ?? ""`, so a `<form>` that contains it submits the choice.
  - `offeredAccounts(accounts, currency, keepAccountId?: string | null): AccountChoice[]` — active accounts of the currency, plus the kept one when it is in that currency.
  - `resolveAccountId(accounts, currency, chosen: string | null, keepAccountId?: string | null): string | null` — the chosen id while it is offered; otherwise the only offered account; otherwise null.

- [ ] **Step 1: Write the failing tests.**

`components/Entries/components/AccountField/utils.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { offeredAccounts, resolveAccountId } from "./utils";

const ACCOUNTS = [
  {
    id: "galicia",
    currency: "ARS",
    label: "Banco Galicia · Caja de ahorro",
    archived: false,
  },
  {
    id: "cash",
    currency: "ARS",
    label: "Efectivo · Efectivo",
    archived: false,
  },
  { id: "old", currency: "ARS", label: "Banco Nación · Vieja", archived: true },
  {
    id: "dollars",
    currency: "USD",
    label: "Banco Galicia · Dólares",
    archived: false,
  },
];

const ids = (accounts: { id: string }[]) => accounts.map(({ id }) => id);

describe("offeredAccounts", () => {
  it("offers the active accounts in the currency of the movement, in the order given", () => {
    expect(ids(offeredAccounts(ACCOUNTS, "ARS"))).toEqual(["galicia", "cash"]);
    expect(ids(offeredAccounts(ACCOUNTS, "USD"))).toEqual(["dollars"]);
  });

  it("offers nothing in a currency the user has no account in", () => {
    expect(offeredAccounts(ACCOUNTS, "EUR")).toEqual([]);
  });

  it("also offers the archived account the record already has, in its place", () => {
    expect(ids(offeredAccounts(ACCOUNTS, "ARS", "old"))).toEqual([
      "galicia",
      "cash",
      "old",
    ]);
  });

  it("does not offer the kept archived account in another currency", () => {
    expect(ids(offeredAccounts(ACCOUNTS, "USD", "old"))).toEqual(["dollars"]);
  });
});

describe("resolveAccountId", () => {
  it("keeps the choice while it is offered", () => {
    expect(resolveAccountId(ACCOUNTS, "ARS", "cash")).toBe("cash");
  });

  it("preselects the only account of the currency when nothing is chosen", () => {
    expect(resolveAccountId(ACCOUNTS, "USD", null)).toBe("dollars");
  });

  it("chooses nothing when the currency has several accounts and none is chosen", () => {
    expect(resolveAccountId(ACCOUNTS, "ARS", null)).toBeNull();
  });

  it("drops a choice in another currency: the currency changed under it", () => {
    expect(resolveAccountId(ACCOUNTS, "ARS", "dollars")).toBeNull();
    expect(resolveAccountId(ACCOUNTS, "USD", "galicia")).toBe("dollars");
  });

  it("drops an archived choice unless it is the record's own", () => {
    expect(resolveAccountId(ACCOUNTS, "ARS", "old")).toBeNull();
    expect(resolveAccountId(ACCOUNTS, "ARS", "old", "old")).toBe("old");
  });

  it("chooses nothing in a currency without accounts", () => {
    expect(resolveAccountId(ACCOUNTS, "EUR", "galicia")).toBeNull();
  });

  it("drops an id that is not among the accounts at all", () => {
    expect(resolveAccountId(ACCOUNTS, "USD", "")).toBe("dollars");
  });
});
```

`components/Entries/components/AccountField/AccountField.test.tsx`

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccountField } from "./AccountField";

const ACCOUNTS = [
  {
    id: "galicia",
    currency: "ARS",
    label: "Banco Galicia · Caja de ahorro",
    archived: false,
  },
  {
    id: "cash",
    currency: "ARS",
    label: "Efectivo · Efectivo",
    archived: false,
  },
  { id: "old", currency: "ARS", label: "Banco Nación · Vieja", archived: true },
  {
    id: "dollars",
    currency: "USD",
    label: "Banco Galicia · Dólares",
    archived: false,
  },
];

const renderField = (
  patch: Partial<Parameters<typeof AccountField>[0]> = {},
) => {
  const onChange = vi.fn();

  render(
    <form aria-label="form">
      <AccountField
        accounts={ACCOUNTS}
        currency="ARS"
        value={null}
        onChange={onChange}
        {...patch}
      />
    </form>,
  );

  return { onChange };
};

const trigger = () => screen.getByRole("button", { name: /Cuenta/ });

const open = async () => {
  fireEvent.keyDown(trigger(), { key: "ArrowDown" });

  return screen.findAllByRole("option");
};

const submitted = () =>
  new FormData(screen.getByRole("form", { name: "form" }) as HTMLFormElement);

describe("AccountField", () => {
  it("is a select named Cuenta that asks to pick one while none is chosen", () => {
    renderField();

    expect(trigger()).toHaveTextContent("Elegí una cuenta");
  });

  it("offers only the active accounts in the currency of the movement, as 'Banco · Cuenta'", async () => {
    renderField();

    const options = await open();

    expect(options.map((option) => option.textContent)).toEqual([
      "Banco Galicia · Caja de ahorro",
      "Efectivo · Efectivo",
    ]);
  });

  it("follows the currency: other currency, other accounts", async () => {
    renderField({ currency: "USD" });

    const options = await open();

    expect(options.map((option) => option.textContent)).toEqual([
      "Banco Galicia · Dólares",
    ]);
  });

  it("shows the account that is chosen", () => {
    renderField({ value: "cash" });

    expect(trigger()).toHaveTextContent("Efectivo · Efectivo");
  });

  it("offers the archived account the record already has, marked as archived", async () => {
    renderField({ value: "old", keepAccountId: "old" });

    expect(trigger()).toHaveTextContent("Banco Nación · Vieja (archivada)");

    const options = await open();

    expect(options.map((option) => option.textContent)).toContain(
      "Banco Nación · Vieja (archivada)",
    );
  });

  it("reports the id of the account picked", async () => {
    const { onChange } = renderField();

    const options = await open();

    fireEvent.keyDown(options[1], { key: "Enter" });
    fireEvent.keyUp(options[1], { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("cash");
  });

  it("submits the chosen account with the form, and nothing while none is chosen", () => {
    renderField({ value: "galicia" });

    expect(submitted().get("accountId")).toBe("galicia");
  });

  it("submits an empty account while none is chosen, which the server refuses", () => {
    renderField();

    expect(submitted().get("accountId")).toBe("");
  });

  it("says there is no account in the currency and links to Bancos to create one", () => {
    renderField({ currency: "EUR" });

    expect(screen.getByText(/No tenés cuentas en EUR\./)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Creá una en Bancos" }),
    ).toHaveAttribute("href", "/dashboard/banks");
  });

  it("shows no such hint while the currency has accounts", () => {
    renderField();

    expect(
      screen.queryByRole("link", { name: "Creá una en Bancos" }),
    ).not.toBeInTheDocument();
  });

  it("shows the error the server found for the account", () => {
    renderField({ errorMessage: "Elegí una cuenta." });

    expect(screen.getByText("Elegí una cuenta.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run components/Entries/components/AccountField`
Expected: FAIL — `Failed to resolve import "./utils"` and `"./AccountField"`.

- [ ] **Step 3: Implement.**

`components/Entries/components/AccountField/types.ts`

```ts
import type { AccountChoice } from "@/core/accounts/types";

export interface AccountFieldProps {
  // Every account of the user (archived ones included): the field decides which ones to offer.
  accounts: readonly AccountChoice[];
  // Only the accounts in this currency are offered: a movement is always in its account's currency.
  currency: string;
  // The id of the account chosen, or null while none is (see resolveAccountId).
  value: string | null;
  // The account the record being edited already has: offered even if it was archived since.
  keepAccountId?: string | null;
  onChange: (accountId: string | null) => void;
  // What the server said about the account, shown under the field.
  errorMessage?: string;
}
```

`components/Entries/components/AccountField/consts.ts`

```ts
export const ACCOUNT_LABEL = "Cuenta";

// Shown while no account is chosen.
export const ACCOUNT_PLACEHOLDER = "Elegí una cuenta";

// The field name every entry form submits the account under.
export const ACCOUNT_FIELD_NAME = "accountId";

// After the label of an archived account that the record being edited already has.
export const ARCHIVED_SUFFIX = " (archivada)";

export const CREATE_ACCOUNT_LINK_LABEL = "Creá una en Bancos";

export const noAccountsHint = (currency: string): string =>
  `No tenés cuentas en ${currency}.`;
```

`components/Entries/components/AccountField/styles.ts`

```ts
// The line under the field when the currency has no account yet.
export const HINT_CLASS_NAME = "text-sm text-muted";
```

`components/Entries/components/AccountField/utils.ts`

```ts
import type { AccountChoice } from "@/core/accounts/types";

// The accounts a movement in `currency` can go to: the active ones, plus the one the record already has
// (`keepAccountId`) even if it was archived since. The order is the one given (the board's).
export const offeredAccounts = (
  accounts: readonly AccountChoice[],
  currency: string,
  keepAccountId: string | null = null,
): AccountChoice[] =>
  accounts.filter(
    (account) =>
      account.currency === currency &&
      (!account.archived || account.id === keepAccountId),
  );

// The account the field shows: the choice while it is still offered (a currency change drops one of
// the old currency); otherwise the only account of the currency, so the common case needs no click;
// otherwise none.
export const resolveAccountId = (
  accounts: readonly AccountChoice[],
  currency: string,
  chosen: string | null,
  keepAccountId: string | null = null,
): string | null => {
  const offered = offeredAccounts(accounts, currency, keepAccountId);

  if (chosen !== null && offered.some((account) => account.id === chosen)) {
    return chosen;
  }

  return offered.length === 1 ? offered[0].id : null;
};
```

`components/Entries/components/AccountField/AccountField.tsx`

```tsx
import {
  Description,
  FieldError,
  Label,
  Link,
  ListBox,
  Select,
} from "@heroui/react";

import {
  FIELD_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { BANKS_PATH } from "@/core/banks/consts";

import {
  ACCOUNT_FIELD_NAME,
  ACCOUNT_LABEL,
  ACCOUNT_PLACEHOLDER,
  ARCHIVED_SUFFIX,
  CREATE_ACCOUNT_LINK_LABEL,
  noAccountsHint,
} from "./consts";
import { HINT_CLASS_NAME } from "./styles";
import type { AccountFieldProps } from "./types";
import { offeredAccounts } from "./utils";

// "Cuenta" of an entry: the account the money moves in. Only the active accounts in the currency of
// the movement are offered (plus the archived one the record already has). The choice travels in a
// hidden input, so the form that contains the field submits it; with no account in the currency, a
// line says so and links to Bancos.
export function AccountField({
  accounts,
  currency,
  value,
  keepAccountId = null,
  onChange,
  errorMessage,
}: AccountFieldProps) {
  const options = offeredAccounts(accounts, currency, keepAccountId);

  return (
    <>
      <Select
        isRequired
        variant={FIELD_VARIANT}
        className={FIELD_CLASS_NAME}
        placeholder={ACCOUNT_PLACEHOLDER}
        value={value}
        isInvalid={errorMessage !== undefined}
        onChange={(key) => onChange(typeof key === "string" ? key : null)}
      >
        <Label>{ACCOUNT_LABEL}</Label>
        <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map(({ id, label, archived }) => (
              <ListBox.Item
                key={id}
                id={id}
                textValue={archived ? `${label}${ARCHIVED_SUFFIX}` : label}
              >
                {archived ? `${label}${ARCHIVED_SUFFIX}` : label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        {options.length === 0 ? (
          <Description>
            <span className={HINT_CLASS_NAME}>
              {noAccountsHint(currency)}{" "}
              <Link href={BANKS_PATH}>{CREATE_ACCOUNT_LINK_LABEL}</Link>
            </span>
          </Description>
        ) : null}
        {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
      </Select>
      <input type="hidden" name={ACCOUNT_FIELD_NAME} value={value ?? ""} />
    </>
  );
}
```

`components/Entries/components/AccountField/index.ts`

```ts
export { AccountField } from "./AccountField";
export { offeredAccounts, resolveAccountId } from "./utils";
```

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run components/Entries/components/AccountField components/componentStructure.test.ts`
Expected: PASS. If the trigger text of a chosen archived option does not render the suffix, check `.heroui-docs/react/components/(pickers)/select.mdx` (`Select.Value` renders the selected item's `textValue`), not the test.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`, `npx eslint components/Entries/components/AccountField`, then `npx vitest run` and `npm run lint`
Expected: all green.

### Task 5: The expenses and incomes pages load the accounts

**Files:**

- Test: `core/expenses/pageData.test.ts`, `core/incomes/pageData.test.ts`, `app/dashboard/expenses/loadExpensesView.test.ts`, `app/dashboard/incomes/loadIncomesView.test.ts`
- Modify: `core/expenses/pageData.ts`, `core/incomes/pageData.ts`, `app/dashboard/expenses/loadExpensesView.ts`, `app/dashboard/incomes/loadIncomesView.ts`, `components/Expenses/types.ts`, `components/Incomes/types.ts`, `components/Expenses/Expenses.test.tsx`, `components/Expenses/Expenses.bulkDelete.test.tsx`, `components/Incomes/Incomes.test.tsx`, `components/Incomes/Incomes.bulkDelete.test.tsx`

**Interfaces:**

- Consumes: `listAccountChoices` (Task 3), `AccountChoice`.
- Produces: `loadExpensesPageData(...)` and `loadIncomesPageData(...)` results gain `accounts: AccountChoice[]`; `loadExpensesView(...)` and `loadIncomesView(...)` gain `accounts: Promise<AccountChoice[]>`; `ExpensesProps` and `IncomesProps` gain `accounts: Source<AccountChoice[]>` (consumed from Task 6 on; until then the components ignore it).

- [ ] **Step 1: Write the failing tests.**

In `core/expenses/pageData.test.ts`: add after `const cardsService = ...`:

```ts
const choices = vi.hoisted(() => ({ listAccountChoices: vi.fn() }));
```

after `vi.mock("@/core/cards/service", () => cardsService);` add `vi.mock("@/core/accounts/choices", () => choices);`; after the `PLAN` constant add

```ts
const ACCOUNT = {
  id: "acc_1",
  currency: "ARS",
  label: "Banco Galicia · Caja de ahorro",
  archived: false,
};
```

in `beforeEach` add `choices.listAccountChoices.mockResolvedValue([ACCOUNT]);`; in the first test's expected object add `accounts: [ACCOUNT],` after `cards: [CARD],` and add the assertion `expect(choices.listAccountChoices).toHaveBeenCalledWith("user_1");`.

In `core/incomes/pageData.test.ts`: add `const choices = vi.hoisted(() => ({ listAccountChoices: vi.fn() }));` after `progress`, `vi.mock("@/core/accounts/choices", () => choices);` after the other mocks, and in `beforeEach` `choices.listAccountChoices.mockResolvedValue([{ id: "acc_1", currency: "USD", label: "Banco Galicia · Dólares", archived: false }]);`. Then add this test inside `describe("loadIncomesPageData", ...)`:

```ts
it("reads the user's accounts once, for the income, template and repayment forms", async () => {
  service.materializeRecurringIncomes.mockResolvedValue(2);

  const data = await loadIncomesPageData(USER_ID, DEFAULT_ENTRIES_QUERY, TODAY);

  expect(choices.listAccountChoices).toHaveBeenCalledTimes(1);
  expect(choices.listAccountChoices).toHaveBeenCalledWith(USER_ID);
  expect(data.accounts).toEqual([
    {
      id: "acc_1",
      currency: "USD",
      label: "Banco Galicia · Dólares",
      archived: false,
    },
  ]);
});
```

In `app/dashboard/expenses/loadExpensesView.test.ts`: add to `LOADED` (after `cards: [...]`):

```ts
  accounts: [
    {
      id: "acc_1",
      currency: "ARS",
      label: "Banco Galicia · Caja de ahorro",
      archived: false,
    },
  ],
```

in the first test add `"accounts",` as the first element of the sorted key list (`["accounts", "cards", "categories", ...]`), and add:

```ts
it("hands the forms the user's accounts as they were read", async () => {
  pageData.loadExpensesPageData.mockResolvedValue(LOADED);

  expect(await start().accounts).toEqual(LOADED.accounts);
});
```

In `app/dashboard/incomes/loadIncomesView.test.ts`: add the same `accounts` array to its loaded fixture object, add `"accounts"` to its expected key list (keeping it sorted if the test sorts), and add the same "hands the forms the user's accounts" test, adapted to that file's loader call (`loadIncomesView("user_1", DEFAULT_ENTRIES_QUERY, "2026-09-30")` — use the exact call the file's other tests already use) and its mock (`pageData.loadIncomesPageData`).

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run core/expenses/pageData.test.ts core/incomes/pageData.test.ts app/dashboard/expenses app/dashboard/incomes`
Expected: FAIL — `accounts` missing from the page data and from the views.

- [ ] **Step 3: Implement.** In `core/expenses/pageData.ts` add `import { listAccountChoices } from "@/core/accounts/choices";`, extend the destructuring and the `Promise.all`:

```ts
const [page, totals, categories, currencies, items, plans, cards, accounts] =
  await Promise.all([
    listExpenses(userId, query),
    listExpenseTotals(userId, query),
    listCategoriesWithCounts(userId),
    listExpenseCurrencies(userId),
    listRecurringExpenses(userId, month),
    listInstallmentPlans(userId, month),
    listCardsWithCharges(userId),
    listAccountChoices(userId),
  ]);
```

and add `accounts,` after `cards,` in the returned object; extend its leading comment with: "The accounts (archived ones flagged) feed the "Cuenta" field of every form."

In `core/incomes/pageData.ts` add `import { listAccountChoices } from "@/core/accounts/choices";` and read the accounts once, with the reimbursables:

```ts
const [created, firstReads, reimbursables, accounts] = await Promise.all([
  materializeRecurringIncomes(userId, today),
  readAll(userId, query, month),
  listReimbursableExpenses(userId),
  listAccountChoices(userId),
]);
```

and add `accounts,` after `reimbursables,` in the returned object.

In `app/dashboard/expenses/loadExpensesView.ts` add after `cards: ...`:

```ts
    // Every account of the user, for the "Cuenta" field of the forms.
    accounts: data.then(({ accounts }) => accounts),
```

and the same line after `reimbursables: ...` in `app/dashboard/incomes/loadIncomesView.ts`.

In `components/Expenses/types.ts` add `import type { AccountChoice } from "@/core/accounts/types";` and, in `ExpensesProps` after `cards`:

```ts
// Every account of the user, for the "Cuenta" field of the forms.
accounts: Source<AccountChoice[]>;
```

and the same import and property in `IncomesProps` of `components/Incomes/types.ts` (after `reimbursables`).

In `components/Expenses/Expenses.test.tsx` and `components/Expenses/Expenses.bulkDelete.test.tsx` declare the `ACCOUNTS` constant of "Shared fixtures" and add the line `accounts={ACCOUNTS}` right after every `cards={[]}` line of an `<Expenses` render; in `components/Incomes/Incomes.test.tsx` and `components/Incomes/Incomes.bulkDelete.test.tsx` declare `ACCOUNTS` and add `accounts={ACCOUNTS}` right after every `reimbursables={...}` line of an `<Incomes` render (for the line `reimbursables={never()}` add `accounts={never()}`; for `reimbursables={Promise.resolve([])}` add `accounts={Promise.resolve(ACCOUNTS)}`). Real accounts, not an empty list: from Task 6 on the forms these pages open require one, and with one account per currency it is preselected, so a test that saves a form keeps passing.

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run core/expenses core/incomes app/dashboard components/Expenses/Expenses.test.tsx components/Expenses/Expenses.bulkDelete.test.tsx components/Incomes/Incomes.test.tsx components/Incomes/Incomes.bulkDelete.test.tsx`
Expected: PASS. (`app/dashboard/expenses/page.tsx` and `incomes/page.tsx` spread the view into the component, so `accounts` reaches it with no page change.)

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/expenses core/incomes app/dashboard components/Expenses components/Incomes`, then `npx vitest run` and `npm run lint`
Expected: all green.

### Task 6: Expenses move to an account

The single expense: its schema, service, form and table switch from `medium` to `accountId`. The template a recurring expense creates copies the account. The "Cuenta" column replaces the cash marker in the expenses table.

**Files:**

- Test: `core/expenses/schema.test.ts`, `core/expenses/service.test.ts`, `core/expenses/actions.test.ts`, `components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.test.tsx`, `components/Expenses/components/ExpensesTable/ExpensesTable.test.tsx`
- Fixture-only updates (rules from "Shared fixtures"): `core/expenses/service.origin.test.ts`, `core/expenses/service.reimbursement.test.ts`, `core/expenses/schema.origin.test.ts`, `core/expenses/schema.reimbursement.test.ts`, `components/Expenses/utils.test.ts`, `components/Expenses/Expenses.test.tsx`, `components/Expenses/Expenses.bulkDelete.test.tsx`, `components/Expenses/components/DeleteExpenseDialog/DeleteExpenseDialog.test.tsx`, `components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.origin.test.tsx`, `components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.reimbursement.test.tsx`, `components/Expenses/components/ExpensesTable/ExpensesTable.selection.test.tsx`, `components/Help/markerAudit.test.tsx`, `components/Incomes/components/IncomesTable/IncomesTable.test.tsx` (only the shared minimum width)
- Modify: `core/expenses/{schema,consts,types,service}.ts`, `components/Expenses/components/ExpenseFormDrawer/{ExpenseFormContent.tsx,ExpenseFormDrawer.tsx,types.ts}`, `components/Expenses/components/ExpensesTable/{ExpensesTable.tsx,consts.ts}`, `components/Entries/tableStyles.ts`, `components/Expenses/Expenses.tsx`

**Interfaces:**

- Consumes: `accountIdField` + error mapping (Task 2), `assertUsableAccount` (Task 2), `WITH_ACCOUNT_LABEL`, `assignedAccountId`, `assignedAccountLabel` (Task 3), `AccountField`, `resolveAccountId` (Task 4), `ExpensesProps.accounts` (Task 5).
- Produces:
  - `ExpenseInput.accountId: string` (replaces `medium`); `Expense.accountLabel: string` ("Banco · Cuenta"); `EXPENSE_FORM_FIELDS` has `"accountId"` instead of `"medium"`.
  - `createExpense` / `updateExpense` check the account (`keepAccountId` = the expense's current account on update) and write `accountId`; the template created for a recurring expense gets `accountId`.
  - `ExpenseFormDrawerProps.accounts: readonly AccountChoice[]` (and `ExpenseFormContentProps` picks it).
  - `components/Entries/tableStyles.ts`: `ACCOUNT_COLUMN_CLASS_NAME = "w-44 overflow-hidden text-ellipsis"`, `ACCOUNT_CLASS_NAME = "block truncate"`, `FIXED_TABLE_CLASS_NAME = "table-fixed min-w-[59rem]"`.
  - `components/Expenses/components/ExpensesTable/consts.ts`: `ACCOUNT_HEADER = "Cuenta"`.

- [ ] **Step 1: Write the failing schema and action tests.**

In `core/expenses/schema.test.ts`: apply the **Input rule** to the valid input fixture (it gains `accountId: "acc_1"` where `medium: "DIGITAL"` was), then replace the test `it("defaults the medium to digital and accepts cash", ...)` (the whole `it` block) with:

```ts
it("requires the account and trims it", () => {
  expect(
    expenseInputSchema.safeParse({ ...validInput, accountId: " acc_1 " }).data
      ?.accountId,
  ).toBe("acc_1");
  expect(errorPaths({ ...validInput, accountId: "" })).toEqual(["accountId"]);

  const withoutAccount: Record<string, unknown> = { ...validInput };

  delete withoutAccount.accountId;

  expect(errorPaths(withoutAccount)).toEqual(["accountId"]);
});

it("no longer knows a medium: one that arrives is dropped", () => {
  const parsed = expenseInputSchema.safeParse({
    ...validInput,
    medium: "CASH",
  });

  expect(parsed.success).toBe(true);
  expect(parsed.data).not.toHaveProperty("medium");
});
```

In `core/expenses/actions.test.ts`: apply the **Form rule** to `buildFormData` (default `accountId: "acc_1"`), the **Input rule** to the object expected in "creates the expense for the authenticated user..." (`medium: "DIGITAL",` → `accountId: "acc_1",`), and replace the test `it("passes on the medium the form sends", ...)` with:

```ts
it("passes on the account the form sends", async () => {
  mocks.createExpense.mockResolvedValue({ id: "exp_1" });

  await createExpenseAction(buildFormData({ accountId: "acc_9" }));

  expect(mocks.createExpense.mock.calls[0][1].accountId).toBe("acc_9");
});

it("refuses a form without an account, without touching the service", async () => {
  const result = await createExpenseAction(buildFormData({ accountId: "" }));

  expect(result.status === "error" && result.fieldErrors).toEqual({
    accountId: ["Elegí una cuenta."],
  });
  expect(mocks.createExpense).not.toHaveBeenCalled();
});

it("puts an archived account refused by the service on the Cuenta field", async () => {
  mocks.updateExpense.mockRejectedValue(new AccountArchivedError());

  const result = await updateExpenseAction("exp_1", buildFormData());

  expect(result.status === "error" && result.fieldErrors).toEqual({
    accountId: [
      "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
    ],
  });
});
```

with the import `import { AccountArchivedError } from "@/core/accounts/errors";` added next to the other error imports.

- [ ] **Step 2: Write the failing service tests.** In `core/expenses/service.test.ts`:

1. Add before `vi.mock("@/infrastructure/db/client", ...)`:

```ts
const usable = vi.hoisted(() => ({ assertUsableAccount: vi.fn() }));

vi.mock("@/core/accounts/usable", () => usable);
```

and the imports `import { AccountArchivedError, AccountNotFoundError } from "@/core/accounts/errors";`. 2. Declare `const ACCOUNT_ROW = { name: "Caja de ahorro", bank: { name: "Banco Galicia" } };` after `USER_ID`, and change `INCLUDE` to:

```ts
const INCLUDE = {
  category: { select: { name: true } },
  account: { select: { name: true, bank: { select: { name: true } } } },
};
```

3. Apply the **Input rule** to `input`, the **Row rule** to `row`, the **Write rule** to `WRITABLE_DATA` and `TEMPLATE_DATA`. In every `findFirst` mock of an expense being updated (`expense.findFirst.mockResolvedValue({ recurringExpenseId: ..., installmentPlanId: ..., currency: ..., expectedReimbursement: ... })`) add `accountId: "acc_1",`. Wherever the file expects a mapped expense with `toEqual`, apply the **Output rule**.
4. Add these tests at the end of `describe("createExpense", ...)`:

```ts
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

  expect(recurringExpense.create.mock.calls[0][0].data.accountId).toBe("acc_7");
  expect(expense.create.mock.calls[0][0].data.accountId).toBe("acc_7");
});
```

and at the end of `describe("updateExpense", ...)`:

```ts
it("lets the edit keep the account the expense already has, even if it was archived since", async () => {
  expense.findFirst.mockResolvedValue({
    recurringExpenseId: null,
    installmentPlanId: null,
    currency: "ARS",
    expectedReimbursement: null,
    accountId: "acc_old",
  });
  expense.updateMany.mockResolvedValue({ count: 1 });

  await updateExpense(USER_ID, "exp_1", { ...input, accountId: "acc_old" });

  expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
    accountId: "acc_old",
    currency: "ARS",
    keepAccountId: "acc_old",
  });
});

it("writes nothing when the account is not the user's", async () => {
  expense.findFirst.mockResolvedValue({
    recurringExpenseId: null,
    installmentPlanId: null,
    currency: "ARS",
    expectedReimbursement: null,
    accountId: "acc_1",
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
```

5. In `core/expenses/service.origin.test.ts` and `core/expenses/service.reimbursement.test.ts`: add the same `usable` hoisted mock + `vi.mock("@/core/accounts/usable", () => usable);`, apply the **Input rule** to their input fixtures, the **Row rule** to their row fixtures, the **Write rule** to any expected write data, add `accountId: "acc_1",` to every `expense.findFirst.mockResolvedValue({...})` object of a current expense, and update every expected `include` that equals `{ category: { select: { name: true } } }` to the `INCLUDE` value above.

- [ ] **Step 3: Write the failing form and table tests.**

In `components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.test.tsx`:

1. Add after `DOLLAR_CARD`:

```ts
const ACCOUNTS = [
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
```

2. Apply the **Output rule** to `EXPENSE`.
3. Give `renderForm` a third parameter `accounts: readonly AccountChoice[] = ACCOUNTS` (import `type { AccountChoice } from "@/core/accounts/types"`) and pass `accounts={accounts}` to `<ExpenseFormDrawer`.
4. Replace the whole `describe("medium field", ...)` block with:

```ts
describe("account field", () => {
  const accountTrigger = () => screen.getByRole("button", { name: /Cuenta/ });

  const pickCurrency = async (label: RegExp) => {
    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
      key: "ArrowDown",
    });

    const option = await screen.findByRole("option", { name: label });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });
  };

  it("replaces the Medio radio: there is no Digital/Efectivo choice any more", () => {
    renderForm(null);

    expect(
      screen.queryByRole("radiogroup", { name: "Medio" }),
    ).not.toBeInTheDocument();
    expect(accountTrigger()).toBeInTheDocument();
  });

  it("preselects the only account of the currency for a new expense", () => {
    renderForm(null);

    expect(accountTrigger()).toHaveTextContent(
      "Banco Galicia · Caja de ahorro",
    );
  });

  it("starts on the account of the expense being edited", () => {
    renderForm(
      { ...EXPENSE, accountId: "acc_2" },
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
    );

    expect(accountTrigger()).toHaveTextContent("Efectivo · Efectivo");
  });

  it("keeps an archived account the expense already has, marked as archived", () => {
    renderForm(
      { ...EXPENSE, accountId: "acc_old" },
      [],
      [
        ...ACCOUNTS,
        {
          id: "acc_old",
          currency: "ARS",
          label: "Banco Nación · Vieja",
          archived: true,
        },
      ],
    );

    expect(accountTrigger()).toHaveTextContent(
      "Banco Nación · Vieja (archivada)",
    );
  });

  it("follows a currency change: the account of the old currency goes, the only one of the new comes", async () => {
    renderForm(null);

    await pickCurrency(/USD/);

    expect(accountTrigger()).toHaveTextContent(
      "Banco Galicia · Cuenta en dólares",
    );
  });

  it("asks for an account again when the new currency has several", async () => {
    renderForm(
      null,
      [],
      [
        ...ACCOUNTS,
        {
          id: "acc_usd_2",
          currency: "USD",
          label: "Efectivo · Dólares",
          archived: false,
        },
      ],
    );

    await pickCurrency(/USD/);

    expect(accountTrigger()).toHaveTextContent("Elegí una cuenta");
  });

  it("sends the chosen account with the rest of the form", async () => {
    actions.createExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Coffee" },
    });
    fireEvent.change(screen.getByLabelText(/Monto/), {
      target: { value: "10" },
    });
    await pickCategory("Comida");
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(createdForm().get("accountId")).toBe("acc_1");
    expect(createdForm().has("medium")).toBe(false);
  });

  it("shows the error the server found for the account", async () => {
    actions.updateExpenseAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        accountId: [
          "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
        ],
      },
    });
    renderForm(EXPENSE);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText(
        "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
      ),
    ).toBeInTheDocument();
  });
});
```

(The currency select is labelled `CURRENCY_LABEL` = "Moneda" and its options read "USD - dólar estadounidense" — `CURRENCY_OPTIONS` in `components/Entries/currencyOptions.ts` — so `/USD/` matches exactly one option.)

5. In `ExpenseFormDrawer.origin.test.tsx` and `ExpenseFormDrawer.reimbursement.test.tsx`: apply the **Output rule** to their `ExpenseRow` fixtures and pass `accounts={ACCOUNTS}` (declare the same `ACCOUNTS` constant) to every `<ExpenseFormDrawer` they render.

In `components/Expenses/components/ExpensesTable/ExpensesTable.test.tsx`: apply the **Output rule** to `ROW`; in every header list of the file (`"lists Actions first..."` and the loading-state header test, if it lists them) insert `"Cuenta",` between `"Categoría",` and `"Fecha",`; in "shows the formatted values of each row" add `expect(first).toHaveTextContent("Banco Galicia · Caja de ahorro");`; in "uses a fixed layout..." change `"min-w-[48rem]"` to `"min-w-[59rem]"`; apply the **Cash-marker rule** below; and add:

```ts
describe("ExpensesTable account column", () => {
  it("names the account of each expense as 'Banco · Cuenta', cut with an ellipsis when long", () => {
    renderTable();

    const header = screen.getByRole("columnheader", { name: "Cuenta" });

    expect(header).toHaveClass("w-44", "overflow-hidden", "text-ellipsis");
    expect(
      within(bodyRows()[0]).getByText("Banco Galicia · Caja de ahorro"),
    ).toBeInTheDocument();
  });

  it("no longer draws a cash marker beside the description", () => {
    renderTable([{ ...ROW, accountLabel: "Efectivo · Efectivo" }]);

    expect(
      within(bodyRows()[0]).queryByRole("img", { name: "Efectivo" }),
    ).not.toBeInTheDocument();
  });
});
```

**Cash-marker rule** (expenses table test now; incomes table test in Task 7): (a) delete the whole `describe("ExpensesTable cash marker", ...)` block (the new "account column" describe above takes its place); (b) delete the test `it("can sit beside the cash marker on an installment paid in cash", ...)`; (c) in every remaining test that puts `medium: "CASH"` into a row (`"gives the markers a tooltip with their own text"`, the origin describe's `"can show it next to the other markers"`), delete that `medium: "CASH",` property and delete the line `expect(screen.getByRole("img", { name: "Efectivo" })).toBeInTheDocument();` of that test.

The incomes table shares `FIXED_TABLE_CLASS_NAME`: in `components/Incomes/components/IncomesTable/IncomesTable.test.tsx` change `"min-w-[48rem]"` to `"min-w-[59rem]"` now (its column arrives in Task 7).

In `components/Help/markerAudit.test.tsx`: apply the **Output rule** to `EXPENSE` and `COVERED_EXPENSE` (the `medium: "CASH",` / `medium: "DIGITAL",` lines; `COVERED_EXPENSE` spreads `EXPENSE`, so its own `medium` line is simply deleted), and in the expected list of the first test delete the first `"Efectivo",` (the one under the comment "Expenses: the first row, then the covered one."), and rename that test to `"shows up in the tables of the audit: installment, recurring, repayment, cash (incomes), origin (twice), reimbursement (both ways) and covered"`.

Apply the **Output rule** to the `ExpenseRow`/`Expense` fixtures of `components/Expenses/utils.test.ts`, `Expenses.test.tsx`, `Expenses.bulkDelete.test.tsx`, `DeleteExpenseDialog.test.tsx`, `ExpensesTable.selection.test.tsx`, and the **Input rule** to the valid inputs of `core/expenses/schema.origin.test.ts` and `core/expenses/schema.reimbursement.test.ts` (each of these files has a single `medium` line per fixture; `npx tsc --noEmit` lists any that is left).

- [ ] **Step 4: Run them and see them fail**

Run: `npx vitest run core/expenses components/Expenses components/Help`
Expected: FAIL — the schema still defaults `medium` and does not know `accountId`; the service does not call `assertUsableAccount` nor include the account; the form still shows the Medio radio; the table has no Cuenta column. (`npx tsc --noEmit` also fails on the fixtures now carrying `accountId`/`accountLabel`: that is the RED for the types.)

- [ ] **Step 5: Implement the core.**

`core/expenses/schema.ts`: in the import from `@/core/entries/fields` replace `mediumField,` with `accountIdField,` (keep the list alphabetical: `accountIdField` first) and in the object replace `    medium: mediumField,` with `    accountId: accountIdField,`.

`core/expenses/consts.ts`: in `EXPENSE_FORM_FIELDS` replace `"medium",` with `"accountId",`.

`core/expenses/types.ts`: in `ExpenseInput` replace

```ts
// Whether the money left an account or came out of the wallet.
medium: PaymentMedium;
```

with

```ts
// The account the money left (for a card purchase, the account that pays the statement). It is the
// user's and in the currency of the expense (the service checks it).
accountId: string;
```

and in `Expense` add after `categoryName: string;`:

```ts
// "Banco · Cuenta" of the account, for the table.
accountLabel: string;
```

(`PaymentMedium` is still imported by `RecurringExpenseItem`/`RecurringExpenseInput` until Task 8; keep the import.)

`core/expenses/service.ts`:

1. Add imports:

```ts
import {
  assignedAccountId,
  assignedAccountLabel,
} from "@/core/accounts/expand";
import { WITH_ACCOUNT_LABEL } from "@/core/accounts/label";
import { assertUsableAccount } from "@/core/accounts/usable";
```

2. Replace

```ts
type ExpenseWithCategory = ExpenseRow & { category: { name: string } };

const WITH_CATEGORY_NAME = { category: { select: { name: true } } } as const;
```

with

```ts
type ExpenseWithCategory = ExpenseRow & {
  category: { name: string };
  account?: { name: string; bank: { name: string } } | null;
};

// What every read of an expense brings along: the name of its category and its account's label.
const WITH_CATEGORY_NAME = {
  category: { select: { name: true } },
  ...WITH_ACCOUNT_LABEL,
} as const;
```

3. In `toExpense` replace `    medium: row.medium,` with

```ts
    accountId: assignedAccountId(row.accountId), // EXPAND
    accountLabel: assignedAccountLabel(row.account), // EXPAND
```

4. In `toWritableData` replace `  medium: input.medium,` with `  accountId: input.accountId,`; in `createTemplateFor` replace `      medium: input.medium,` with `      accountId: input.accountId,` and update its comment's field list ("same description, amount, currency, category, account, notes and reference price").
5. In `createExpense`, after `await assertCategoryOwnedBy(userId, input.categoryId);` add:

```ts
await assertUsableAccount(userId, {
  accountId: input.accountId,
  currency: input.currency,
  keepAccountId: null,
});
```

6. In `updateExpense`, add `accountId: true,` to the `select` of `current`, and right after the `if (!current) { return false; }` block add:

```ts
// The edit may keep the account the expense already has, even if it was archived since.
await assertUsableAccount(userId, {
  accountId: input.accountId,
  currency: input.currency,
  keepAccountId: current.accountId,
});
```

- [ ] **Step 6: Implement the form.**

`components/Expenses/components/ExpenseFormDrawer/types.ts`: add `import type { AccountChoice } from "@/core/accounts/types";`, add to `ExpenseFormDrawerProps`:

```ts
  // Every account of the user, for the "Cuenta" field.
  accounts: readonly AccountChoice[];
```

and change the `Pick` to `"onClose" | "target" | "categories" | "cards" | "accounts"`.

`ExpenseFormDrawer.tsx`: destructure `accounts` and pass `accounts={accounts}` to `<ExpenseFormContent`.

`ExpenseFormContent.tsx`:

1. Remove the imports of `MediumField` and `DEFAULT_PAYMENT_MEDIUM`; add `import { AccountField, resolveAccountId } from "@/components/Entries/components/AccountField";`.
2. Destructure `accounts` in the props.
3. After the `cardId` state add:

```ts
// The account the money leaves. A currency change drops it (the field then preselects the only
// account of the new currency, if there is exactly one); an edit keeps the expense's own account
// even if it was archived since.
const keepAccountId = expense?.accountId ?? null;
const [accountId, setAccountId] = useState<string | null>(keepAccountId);
const account = resolveAccountId(accounts, currency, accountId, keepAccountId);
```

4. In `handleCurrencyChange` add `setAccountId(null);` after `setCurrency(next);`.
5. Replace

```tsx
<MediumField defaultMedium={expense?.medium ?? DEFAULT_PAYMENT_MEDIUM} />
```

with

```tsx
<AccountField
  accounts={accounts}
  currency={currency}
  value={account}
  keepAccountId={keepAccountId}
  onChange={setAccountId}
  errorMessage={fieldErrors.accountId?.[0]}
/>
```

`components/Expenses/Expenses.tsx`: destructure `accounts` from the props and wrap the `ExpenseFormDrawer` (only it; the planner moves in Task 10) in the accounts:

```tsx
<Await source={accounts} fallback={null}>
  {(loadedAccounts) => (
    <ExpenseFormDrawer
      isOpen={formState.isOpen}
      onOpenChange={formState.setOpen}
      onClose={formState.close}
      target={formTarget}
      categories={loadedCategories}
      cards={loadedCards}
      accounts={loadedAccounts}
    />
  )}
</Await>
```

- [ ] **Step 7: Implement the table column.**

`components/Entries/tableStyles.ts`: change `FIXED_TABLE_CLASS_NAME` to `"table-fixed min-w-[59rem]"` (the 11rem "Cuenta" column joins the 48rem the table had) and add after `CATEGORY_COLUMN_CLASS_NAME`:

```ts
// "Banco · Cuenta" is cut with an ellipsis instead of spilling into the next column.
export const ACCOUNT_COLUMN_CLASS_NAME = "w-44 overflow-hidden text-ellipsis";
export const ACCOUNT_CLASS_NAME = "block truncate";
```

`components/Expenses/components/ExpensesTable/consts.ts`: add `export const ACCOUNT_HEADER = "Cuenta";` after `CATEGORY_HEADER`.

`ExpensesTable.tsx`: remove the `CashMarker` import and the line `          {row.medium === "CASH" ? <CashMarker /> : null}`; import `ACCOUNT_CLASS_NAME`, `ACCOUNT_COLUMN_CLASS_NAME` from `@/components/Entries/tableStyles` and `ACCOUNT_HEADER` from `./consts`; insert after the `category` column:

```tsx
    {
      key: "account",
      header: ACCOUNT_HEADER,
      className: ACCOUNT_COLUMN_CLASS_NAME,
      cell: (row) => (
        <TruncatedText className={ACCOUNT_CLASS_NAME}>
          {row.accountLabel}
        </TruncatedText>
      ),
      loadingCell: <Skeleton className="h-4 w-3/4" />,
    },
```

- [ ] **Step 8: Run and see them pass**

Run: `npx vitest run core/expenses components/Expenses components/Help components/Entries`
Expected: PASS.

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit` (any error left is a fixture the rules above did not reach: apply the matching rule), `npx eslint core/expenses components/Expenses components/Entries components/Help`, then `npx vitest run` and `npm run lint`
Expected: all green. `rg -n "medium" core/expenses/service.ts core/expenses/schema.ts components/Expenses/components/ExpenseFormDrawer components/Expenses/components/ExpensesTable` prints nothing.

### Task 7: Incomes move to an account (and the cash marker goes)

Same switch for the single income. The incomes table gets its "Cuenta" column, and with it the last user of the cash marker goes: `CashMarker`, `MARKERS.cash` and the legend's "Efectivo" entry are deleted.

**Files:**

- Test: `core/incomes/schema.test.ts`, `core/incomes/service.test.ts`, `core/incomes/actions.test.ts`, `components/Incomes/components/IncomeFormDrawer/IncomeFormDrawer.test.tsx`, `components/Incomes/components/IncomesTable/IncomesTable.test.tsx`, `components/Help/markerAudit.test.tsx`
- Fixture-only updates: `core/incomes/service.origin.test.ts`, `core/incomes/service.reimbursement.test.ts`, `core/incomes/service.list.test.ts`, `core/incomes/schema.origin.test.ts`, `core/incomes/schema.reimbursement.test.ts`, `components/Incomes/utils.test.ts`, `components/Incomes/Incomes.test.tsx`, `components/Incomes/Incomes.bulkDelete.test.tsx`, `components/Incomes/components/DeleteIncomeDialog/DeleteIncomeDialog.test.tsx`, `components/Incomes/components/IncomeFormDrawer/IncomeFormDrawer.reimbursement.test.tsx`, `components/Incomes/components/IncomesTable/IncomesTable.selection.test.tsx`
- Modify: `core/incomes/{schema,consts,types,service}.ts`, `components/Incomes/components/IncomeFormDrawer/{IncomeFormContent.tsx,IncomeFormDrawer.tsx,types.ts}`, `components/Incomes/components/IncomesTable/{IncomesTable.tsx,consts.ts}`, `components/Incomes/Incomes.tsx`, `components/Entries/markers.ts`, `components/Help/legend.ts`
- Delete: `components/Entries/components/CashMarker/` (all five files)

**Interfaces:**

- Consumes: Tasks 2–4, `ACCOUNT_CLASS_NAME` / `ACCOUNT_COLUMN_CLASS_NAME` (Task 6), `IncomesProps.accounts` (Task 5).
- Produces: `IncomeInput.accountId: string` (replaces `medium`); `Income.accountLabel: string`; `INCOME_FORM_FIELDS` has `"accountId"` instead of `"medium"`; `createIncome` / `updateIncome` check the account (`keepAccountId` = the income's current account on update, read with one `findFirst`); `IncomeFormDrawerProps.accounts: readonly AccountChoice[]`; `components/Incomes/components/IncomesTable/consts.ts`: `ACCOUNT_HEADER = "Cuenta"`; `MARKERS` has no `cash` key.

- [ ] **Step 1: Write the failing core tests.**

`core/incomes/schema.test.ts`: apply the **Input rule** to the valid input; replace `it("defaults the medium to digital and accepts cash", ...)` and `it("rejects an unknown medium", ...)` with:

```ts
it("requires the account and trims it", () => {
  expect(
    incomeInputSchema.safeParse({ ...validInput, accountId: " acc_1 " }).data
      ?.accountId,
  ).toBe("acc_1");
  expect(errorPaths({ ...validInput, accountId: "" })).toEqual(["accountId"]);
});

it("no longer knows a medium: one that arrives is dropped", () => {
  const parsed = incomeInputSchema.safeParse({ ...validInput, medium: "CASH" });

  expect(parsed.success).toBe(true);
  expect(parsed.data).not.toHaveProperty("medium");
});
```

`core/incomes/actions.test.ts`: apply the **Form rule** to its form builder and the **Input rule** to the object `createIncome` is expected to receive; replace `it("passes on the medium the form sends", ...)` and `it("refuses a medium that does not exist", ...)` with:

```ts
it("passes on the account the form sends", async () => {
  mocks.createIncome.mockResolvedValue({ id: "inc_1" });

  await createIncomeAction(buildFormData({ accountId: "acc_9" }));

  expect(mocks.createIncome.mock.calls[0][1].accountId).toBe("acc_9");
});

it("refuses a form without an account, without touching the service", async () => {
  const result = await createIncomeAction(buildFormData({ accountId: "" }));

  expect(result.status === "error" && result.fieldErrors).toEqual(
    expect.objectContaining({ accountId: ["Elegí una cuenta."] }),
  );
  expect(mocks.createIncome).not.toHaveBeenCalled();
});

it("puts an account in another currency on the Cuenta field", async () => {
  mocks.createIncome.mockRejectedValue(new AccountCurrencyMismatchError());

  const result = await createIncomeAction(buildFormData());

  expect(result.status === "error" && result.fieldErrors).toEqual({
    accountId: [
      "Esta cuenta es de otra moneda. Elegí una cuenta en la moneda del movimiento.",
    ],
  });
});
```

with `import { AccountCurrencyMismatchError } from "@/core/accounts/errors";`.

`core/incomes/service.test.ts`:

1. Add `findFirst: vi.fn(),` to the `income` mock; add the hoisted `usable` mock and `vi.mock("@/core/accounts/usable", () => usable);` exactly as in Task 6; import `AccountArchivedError` and `AccountNotFoundError` from `@/core/accounts/errors`; declare `ACCOUNT_ROW`.
2. Apply the **Input rule** to `input`, the **Row rule** to `row`, the **Write rule** to `WRITABLE_DATA`; add `account: { select: { name: true, bank: { select: { name: true } } } },` to the expected `include` in "stores the record for the user ...".
3. In `beforeEach` add `income.findFirst.mockResolvedValue({ accountId: "acc_1" });`; in "returns false when the record does not exist or belongs to someone else" add `income.findFirst.mockResolvedValue(null);` as its first line.
4. Replace `it("stores the medium it is given", ...)` and `it("returns the medium of the stored income", ...)` with:

```ts
it("checks the account is the user's, active and in the income's currency before writing", async () => {
  income.create.mockResolvedValue(row);

  await createIncome(USER_ID, input);

  expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
    accountId: "acc_1",
    currency: "USD",
    keepAccountId: null,
  });
  expect(income.create.mock.calls[0][0].data.accountId).toBe("acc_1");
});

it("writes nothing when the account is refused", async () => {
  usable.assertUsableAccount.mockRejectedValue(new AccountArchivedError());

  await expect(createIncome(USER_ID, input)).rejects.toBeInstanceOf(
    AccountArchivedError,
  );
  expect(income.create).not.toHaveBeenCalled();
});

it("returns the account of the income, labelled 'Banco · Cuenta'", async () => {
  income.create.mockResolvedValue(row);

  await expect(createIncome(USER_ID, input)).resolves.toMatchObject({
    accountId: "acc_1",
    accountLabel: "Banco Galicia · Caja de ahorro",
  });
});
```

5. Add at the end of `describe("updateIncome", ...)`:

```ts
it("reads the income's current account, scoped to the user, and lets the edit keep it even if archived", async () => {
  income.findFirst.mockResolvedValue({ accountId: "acc_old" });
  income.updateMany.mockResolvedValue({ count: 1 });

  await updateIncome(USER_ID, "inc_1", { ...input, accountId: "acc_old" });

  expect(income.findFirst).toHaveBeenCalledWith({
    where: { id: "inc_1", userId: USER_ID },
    select: { accountId: true },
  });
  expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
    accountId: "acc_old",
    currency: "USD",
    keepAccountId: "acc_old",
  });
});

it("writes nothing when the account is not the user's", async () => {
  usable.assertUsableAccount.mockRejectedValue(new AccountNotFoundError());

  await expect(
    updateIncome(USER_ID, "inc_1", { ...input, accountId: "acc_x" }),
  ).rejects.toBeInstanceOf(AccountNotFoundError);
  expect(income.updateMany).not.toHaveBeenCalled();
});

it("checks no account for an income that is not the user's", async () => {
  income.findFirst.mockResolvedValue(null);

  await expect(updateIncome(USER_ID, "inc_9", input)).resolves.toBe(false);
  expect(usable.assertUsableAccount).not.toHaveBeenCalled();
});
```

6. In `core/incomes/service.origin.test.ts` and `core/incomes/service.reimbursement.test.ts`: add `findFirst: vi.fn(),` to their `income` mock, the `usable` mock, `income.findFirst.mockResolvedValue({ accountId: "acc_1" });` in `beforeEach`, apply the **Input**, **Row** and **Write** rules, and add the `account` include line to every expected `include` (including line ~200 of the reimbursement test). In `core/incomes/service.list.test.ts` add the `account` include line to `INCLUDE` and apply the **Row rule** / **Output rule** to its rows and expected incomes.

- [ ] **Step 2: Write the failing component tests.**

`components/Incomes/components/IncomeFormDrawer/IncomeFormDrawer.test.tsx`: declare the `ACCOUNTS` constant of "Shared fixtures"; `INCOME` is in USD, so replace its `medium: "DIGITAL",` line with `accountId: "acc_usd",` and `accountLabel: "Banco Galicia · Cuenta en dólares",`; give `renderForm` a second parameter `accounts: readonly AccountChoice[] = ACCOUNTS` and pass `accounts={accounts}` to `<IncomeFormDrawer`; replace the whole `describe("medium field", ...)` block with:

```ts
describe("account field", () => {
  const accountTrigger = () => screen.getByRole("button", { name: /Cuenta/ });

  it("replaces the Medio radio", () => {
    renderForm(null);

    expect(
      screen.queryByRole("radiogroup", { name: "Medio" }),
    ).not.toBeInTheDocument();
    expect(accountTrigger()).toBeInTheDocument();
  });

  it("preselects the only account in the currency of a new income", () => {
    renderForm(null);

    // A new income starts in pesos: the only ARS account is chosen.
    expect(accountTrigger()).toHaveTextContent(
      "Banco Galicia · Caja de ahorro",
    );
  });

  it("starts on the account of the income being edited", () => {
    renderForm(INCOME);

    expect(accountTrigger()).toHaveTextContent(
      "Banco Galicia · Cuenta en dólares",
    );
  });

  it("drops the account when the currency changes, and takes the only one of the new currency", async () => {
    renderForm(INCOME);

    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
      key: "ArrowDown",
    });

    const pesos = await screen.findByRole("option", { name: /^ARS/ });

    fireEvent.keyDown(pesos, { key: "Enter" });
    fireEvent.keyUp(pesos, { key: "Enter" });

    expect(accountTrigger()).toHaveTextContent(
      "Banco Galicia · Caja de ahorro",
    );
  });

  it("sends the chosen account with the rest of the form", async () => {
    actions.updateIncomeAction.mockResolvedValue({ status: "success" });
    renderForm(INCOME);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(actions.updateIncomeAction).toHaveBeenCalledTimes(1),
    );

    const formData = actions.updateIncomeAction.mock.calls[0][1] as FormData;

    expect(formData.get("accountId")).toBe("acc_usd");
    expect(formData.has("medium")).toBe(false);
  });
});
```

In `IncomeFormDrawer.reimbursement.test.tsx` apply the **Output rule** and pass `accounts={ACCOUNTS}`.

`components/Incomes/components/IncomesTable/IncomesTable.test.tsx`: apply the **Output rule** to `ROW`; insert `"Cuenta",` between `"Categoría",` and `"Fecha",` in both header lists; apply the **Cash-marker rule** of Task 6 to this file: delete `describe("IncomesTable cash marker", ...)` entirely, delete `it("can show it next to the cash marker", ...)`, and in the origin describe's `"can show it next to the other markers"` delete `medium: "CASH", ` from the row and the `"Efectivo"` expectation. Add:

```ts
describe("IncomesTable account column", () => {
  it("names the account of each income as 'Banco · Cuenta', cut with an ellipsis when long", () => {
    renderTable();

    expect(screen.getByRole("columnheader", { name: "Cuenta" })).toHaveClass(
      "w-44",
      "overflow-hidden",
      "text-ellipsis",
    );
    expect(
      within(bodyRows()[0]).getByText("Banco Galicia · Caja de ahorro"),
    ).toBeInTheDocument();
  });

  it("draws no cash marker any more: the account says where the money is", () => {
    renderTable([{ ...ROW, accountLabel: "Efectivo · Efectivo" }]);

    expect(screen.queryByRole("img", { name: "Efectivo" })).toBeNull();
  });
});
```

`components/Help/markerAudit.test.tsx`: apply the **Output rule** to `INCOME`; in the first test's expected list delete the remaining `"Efectivo",` (under the comment "Incomes."), and rename the test to `"shows up in the tables of the audit: installment, recurring, repayment, origin (twice), reimbursement (both ways) and covered"`.

Apply the **Output rule** to the fixtures of `components/Incomes/utils.test.ts`, `Incomes.test.tsx`, `Incomes.bulkDelete.test.tsx`, `DeleteIncomeDialog.test.tsx`, `IncomesTable.selection.test.tsx`, and the **Input rule** to the valid inputs of `core/incomes/schema.origin.test.ts` and `core/incomes/schema.reimbursement.test.ts`.

- [ ] **Step 3: Run them and see them fail**

Run: `npx vitest run core/incomes components/Incomes components/Help`
Expected: FAIL — schema/service/form/table still on `medium`; the audit still draws "Efectivo".

- [ ] **Step 4: Implement the core.**

`core/incomes/schema.ts`: add `accountIdField,` to the import from `@/core/entries/fields` and in `incomeInputSchema` replace `    medium: mediumField,` with `    accountId: accountIdField,` (keep `mediumField` for `recurringIncomeInputSchema` until Task 9).

`core/incomes/consts.ts`: in `INCOME_FORM_FIELDS` replace `"medium",` with `"accountId",` (leave `RECURRING_FORM_FIELDS` for Task 9).

`core/incomes/types.ts`: in `IncomeInput` replace

```ts
// Whether the money arrived in an account or as cash.
medium: PaymentMedium;
```

with

```ts
// The account the money arrived in. It is the user's and in the currency of the income (the service
// checks it).
accountId: string;
```

and in `Income` add after `categoryName: string;`:

```ts
// "Banco · Cuenta" of the account, for the table.
accountLabel: string;
```

`core/incomes/service.ts`:

1. Add the imports `import { assignedAccountId, assignedAccountLabel } from "@/core/accounts/expand";`, `import { WITH_ACCOUNT_LABEL } from "@/core/accounts/label";` and `import { assertUsableAccount } from "@/core/accounts/usable";`.
2. In `type IncomeWithCategory` add `account?: { name: string; bank: { name: string } } | null;`; change `WITH_DETAILS` to

```ts
const WITH_DETAILS = {
  ...WITH_CATEGORY_NAME,
  ...WITH_ACCOUNT_LABEL,
  reimbursesExpense: { select: { description: true } },
} as const;
```

3. In `toIncome` replace `  medium: row.medium,` with

```ts
  accountId: assignedAccountId(row.accountId), // EXPAND
  accountLabel: assignedAccountLabel(row.account), // EXPAND
```

4. In `toWritableData` replace `  medium: input.medium,` with `  accountId: input.accountId,`.
5. In `createIncome`, after `await assertCategoryOwnedBy(userId, input.categoryId);` add:

```ts
await assertUsableAccount(userId, {
  accountId: input.accountId,
  currency: input.currency,
  keepAccountId: null,
});
```

6. Replace the body of `updateIncome` (from `assertNotCovered(input.status);` to the end) with:

```ts
assertNotCovered(input.status);
await assertCategoryOwnedBy(userId, input.categoryId);

const current = await prisma.income.findFirst({
  where: { id, userId },
  select: { accountId: true },
});

if (!current) {
  return false;
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
```

and update its comment to "Returns false when no record with that id belongs to the user (nothing else is checked then)."

- [ ] **Step 5: Implement the form, the table and the marker removal.**

`components/Incomes/components/IncomeFormDrawer/types.ts`: import `AccountChoice`, add `accounts: readonly AccountChoice[];` (comment "Every account of the user, for the "Cuenta" field.") to `IncomeFormDrawerProps` and `"accounts"` to the `Pick`. `IncomeFormDrawer.tsx`: destructure and pass `accounts`.

`IncomeFormContent.tsx`: remove the `MediumField` and `DEFAULT_PAYMENT_MEDIUM` imports; import `{ AccountField, resolveAccountId }` from `@/components/Entries/components/AccountField`; destructure `accounts`; after the `currency` state add

```ts
// The account the money arrives in: a currency change drops it, an edit keeps its own (even archived).
const keepAccountId = income?.accountId ?? null;
const [accountId, setAccountId] = useState<string | null>(keepAccountId);
const account = resolveAccountId(accounts, currency, accountId, keepAccountId);
```

in the currency select's `onChange` replace `setCurrency(value);` with

```ts
setCurrency(value);
setAccountId(null);
```

and replace the `<MediumField ... />` element with

```tsx
<AccountField
  accounts={accounts}
  currency={currency}
  value={account}
  keepAccountId={keepAccountId}
  onChange={setAccountId}
  errorMessage={fieldErrors.accountId?.[0]}
/>
```

`components/Incomes/Incomes.tsx`: destructure `accounts`; inside the `reimbursables` `Await`, wrap the `IncomeFormDrawer` in `<Await source={accounts} fallback={null}>{(loadedAccounts) => (<IncomeFormDrawer ... accounts={loadedAccounts} />)}</Await>` (same shape as Task 6).

`components/Incomes/components/IncomesTable/consts.ts`: add `export const ACCOUNT_HEADER = "Cuenta";` after `CATEGORY_HEADER`. `IncomesTable.tsx`: remove the `CashMarker` import and the `{row.medium === "CASH" ? <CashMarker /> : null}` line; import `ACCOUNT_CLASS_NAME`, `ACCOUNT_COLUMN_CLASS_NAME`, `ACCOUNT_HEADER`; insert after the `category` column the same `account` column as in Task 6 Step 7.

Delete the directory `components/Entries/components/CashMarker/` (`CashMarker.tsx`, `CashMarker.test.tsx`, `consts.ts`, `styles.ts`, `index.ts`).

`components/Entries/markers.ts`: delete the line `  cash: { icon: WalletIcon, label: "Efectivo" },` and the `WalletIcon,` import.

`components/Help/legend.ts`: delete the whole entry object whose `id` is `"cash"` (the first entry of `beside-description`).

- [ ] **Step 6: Run and see them pass**

Run: `npx vitest run core/incomes components/Incomes components/Help components/Entries components/componentStructure.test.ts`
Expected: PASS.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/incomes components/Incomes components/Help components/Entries`, then `npx vitest run` and `npm run lint`
Expected: all green. `rg -n "CashMarker|MARKERS.cash" components core` prints nothing.

### Task 8: Recurring expense templates move to an account

The template form edits the template's account; the monthly wizard and `setRecurringDecision` create the month's expense in the template's account.

**Files:**

- Test: `core/expenses/recurringTemplateSchema.test.ts`, `core/expenses/recurringService.test.ts`, `core/expenses/recurringService.manage.test.ts`, `components/Expenses/components/RecurringExpensesDrawer/components/TemplateFormDrawer/TemplateFormDrawer.test.tsx`
- Fixture-only updates: `core/expenses/recurringActions.manage.test.ts`, `core/expenses/recurrence.test.ts`, `components/Expenses/components/RecurringExpensesDrawer/utils.test.ts`, `components/Expenses/components/RecurringExpensesDrawer/RecurringExpensesDrawer.test.tsx`, `components/Expenses/components/RecurringExpensesDrawer/RecurringExpensesDrawer.manage.test.tsx`, `components/Expenses/components/RecurringExpensesDrawer/components/TemplateFormDrawer/TemplateFormDrawer.origin.test.tsx`, `components/Expenses/components/RecurringExpensesDrawer/components/RecurringTable/components/DecisionCell/DecisionCell.test.tsx`, `components/Expenses/components/RecurringExpensesDrawer/components/RecurringTable/components/AmountCell/AmountCell.test.tsx`, `core/expenses/pageData.test.ts`, `app/dashboard/expenses/loadExpensesView.test.ts`
- Modify: `core/expenses/{recurringSchema,consts,types,recurringService}.ts`, `components/Expenses/components/RecurringExpensesDrawer/{RecurringExpensesDrawer.tsx,RecurringExpensesContent.tsx,types.ts}`, `.../TemplateFormDrawer/{TemplateFormDrawer.tsx,TemplateFormContent.tsx,types.ts}`, `components/Expenses/Expenses.tsx`

**Interfaces:**

- Consumes: Tasks 2–4.
- Produces: `RecurringExpenseItem.accountId: string` and `RecurringExpenseInput.accountId: string` (replace `medium`); `RECURRING_FORM_FIELDS` (expenses) has `"accountId"`; `updateRecurringExpense` reads the template's current account and checks the new one (`keepAccountId` = current); `applyRecurringDecisions` and `setRecurringDecision` write `accountId: template.accountId`; `RecurringExpensesDrawerProps.accounts`, `TemplateFormDrawerProps.accounts`, `TemplateFormContentProps.accounts` (`readonly AccountChoice[]`).

- [ ] **Step 1: Write the failing tests.**

`core/expenses/recurringTemplateSchema.test.ts`: apply the **Input rule** to the valid input and to the expected output object; in `it("defaults the medium to digital and turns empty notes into null", ...)` delete the `medium: undefined,` line and the `expect(result.data?.medium).toBe("DIGITAL");` line and rename it `"turns empty notes into null"`; replace `it("rejects a medium that does not exist", ...)` with:

```ts
it("requires the account", () => {
  expect(errorPaths({ ...validInput, accountId: "" })).toEqual(["accountId"]);
});
```

`core/expenses/recurringService.test.ts`: apply the **Write rule** to the template rows it mocks (`medium: "DIGITAL",` → `accountId: "acc_1",`) and to expected `createMany` data; replace `it("gives the expense the medium of its template", ...)` with:

```ts
it("creates the month's expense in the account of its template", async () => {
  recurringExpense.findMany.mockResolvedValue([
    templateRow({ accountId: "acc_cash" }),
    templateRow({ id: "rec_2", accountId: "acc_bank" }),
  ]);

  await applyRecurringDecisions(USER_ID, MONTH, [
    { recurringExpenseId: "rec_1", choice: "enable" },
    { recurringExpenseId: "rec_2", choice: "enable" },
  ]);

  expect(
    expense.createMany.mock.calls[0][0].data.map(
      (row: { accountId: string }) => row.accountId,
    ),
  ).toEqual(["acc_cash", "acc_bank"]);
});
```

(Keep the exact local names the file already uses for the mocks, the month constant and the template factory; the replaced test used them.)

`core/expenses/recurringService.manage.test.ts`: apply the **Write rule** to `templateRow` and to the expected `createMany` data of "creates the month's pending expense from the template ..."; apply the **Input rule** to the input of `describe("updateRecurringExpense", ...)` and the **Write rule** to its expected `data`; add the hoisted `usable` mock + `vi.mock("@/core/accounts/usable", () => usable);` and `import { AccountArchivedError } from "@/core/accounts/errors";`; add inside `describe("updateRecurringExpense", ...)`:

```ts
it("checks the new account and lets the template keep the one it has, even if archived", async () => {
  recurringExpense.findFirst.mockResolvedValue(
    templateRow({ accountId: "acc_old" }),
  );

  await updateRecurringExpense(USER_ID, "rec_1", {
    ...input,
    accountId: "acc_old",
  });

  expect(recurringExpense.findFirst).toHaveBeenCalledWith({
    where: { id: "rec_1", userId: USER_ID },
    select: { accountId: true },
  });
  expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
    accountId: "acc_old",
    currency: input.currency,
    keepAccountId: "acc_old",
  });
});

it("writes nothing when the account is refused", async () => {
  usable.assertUsableAccount.mockRejectedValue(new AccountArchivedError());

  await expect(
    updateRecurringExpense(USER_ID, "rec_1", input),
  ).rejects.toBeInstanceOf(AccountArchivedError);
  expect(recurringExpense.updateMany).not.toHaveBeenCalled();
});

it("checks no account for a template that is not the user's", async () => {
  recurringExpense.findFirst.mockResolvedValue(null);

  await expect(updateRecurringExpense(USER_ID, "rec_9", input)).resolves.toBe(
    false,
  );
  expect(usable.assertUsableAccount).not.toHaveBeenCalled();
});
```

and in `describe("setRecurringDecision: enable", ...)` add:

```ts
it("creates the month's expense in the template's account", async () => {
  recurringExpense.findFirst.mockResolvedValue(
    templateRow({ accountId: "acc_cash" }),
  );
  expense.findMany.mockResolvedValue([]);

  await setRecurringDecision(USER_ID, "rec_1", MONTH, "ENABLED");

  expect(expense.createMany.mock.calls[0][0].data[0].accountId).toBe(
    "acc_cash",
  );
});
```

`TemplateFormDrawer.test.tsx`: declare `ACCOUNTS`; apply the **Write rule** shape to its `RecurringRow` fixture (`medium: "…",` → `accountId: "acc_1",`); pass `accounts={ACCOUNTS}` to every `<TemplateFormDrawer`; replace the test(s) that assert the Medio radio (the file's 3 `medium` hits) with:

```ts
describe("account field", () => {
  it("starts on the template's account and sends it with the form", async () => {
    actions.updateRecurringExpenseAction.mockResolvedValue({
      status: "success",
    });
    renderForm();

    expect(screen.getByRole("button", { name: /Cuenta/ })).toHaveTextContent(
      "Banco Galicia · Caja de ahorro",
    );

    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));

    await waitFor(() =>
      expect(actions.updateRecurringExpenseAction).toHaveBeenCalledTimes(1),
    );

    const formData = actions.updateRecurringExpenseAction.mock
      .calls[0][1] as FormData;

    expect(formData.get("accountId")).toBe("acc_1");
    expect(formData.has("medium")).toBe(false);
  });
});
```

(`renderForm`, `actions` and the submit button name are the ones the file already uses; if its render helper takes the template as an argument, call it with the fixture.) Apply the same `accountId` fixture change and `accounts={ACCOUNTS}` to `TemplateFormDrawer.origin.test.tsx`, and the **Write rule** shape (`accountId: "acc_1"`) to every `RecurringRow` / `RecurringExpenseItem` fixture of the other fixture-only files listed above (in `RecurringExpensesDrawer.test.tsx` and `.manage.test.tsx` also pass `accounts={ACCOUNTS}` — or `accounts={[]}` where no template form is opened — to every `<RecurringExpensesDrawer`).

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run core/expenses components/Expenses/components/RecurringExpensesDrawer`
Expected: FAIL — templates still carry `medium`; no account guard on update; the template form shows Medio.

- [ ] **Step 3: Implement the core.**

`core/expenses/recurringSchema.ts`: import `accountIdField` instead of `mediumField`; replace `    medium: mediumField,` with `    accountId: accountIdField,`.

`core/expenses/consts.ts`: in `RECURRING_FORM_FIELDS` replace `"medium",` with `"accountId",`.

`core/expenses/types.ts`: in `RecurringExpenseItem` replace

```ts
// Copied onto the expense the wizard creates from it.
medium: PaymentMedium;
```

with

```ts
// The account the wizard creates the month's expense in.
accountId: string;
```

in `RecurringExpenseInput` replace `  medium: PaymentMedium;` with `  accountId: string;`, and delete the now unused `import type { PaymentMedium } from "@/core/entries/medium";`.

`core/expenses/recurringService.ts`:

1. Add `import { assignedAccountId } from "@/core/accounts/expand";` and `import { assertUsableAccount } from "@/core/accounts/usable";`.
2. In `toItem` replace `  medium: row.medium,` with `  accountId: assignedAccountId(row.accountId), // EXPAND`.
3. In `applyRecurringDecisions` replace `            medium: template.medium,` with `            // The month's expense goes to the template's account.\n            accountId: template.accountId,`.
4. In `setRecurringDecision` replace `              medium: template.medium,` with `              accountId: template.accountId,`.
5. In `updateRecurringExpense`, after `await assertCategoryOwnedBy(userId, input.categoryId);` add:

```ts
const current = await prisma.recurringExpense.findFirst({
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
```

and replace `      medium: input.medium,` with `      accountId: input.accountId,`.

- [ ] **Step 4: Implement the form plumbing.**

`RecurringExpensesDrawer/types.ts`: import `AccountChoice`; add to `RecurringExpensesDrawerProps`

```ts
  // For the "Cuenta" field of the form that edits a template.
  accounts: readonly AccountChoice[];
```

and `"accounts"` to the `RecurringExpensesContentProps` `Pick`. `RecurringExpensesDrawer.tsx`: destructure and pass `accounts`. `RecurringExpensesContent.tsx`: destructure `accounts` and pass `accounts={accounts}` to `<TemplateFormDrawer`.

`TemplateFormDrawer/types.ts`: import `AccountChoice`; add `accounts: readonly AccountChoice[];` to `TemplateFormDrawerProps` and to `TemplateFormContentProps`. `TemplateFormDrawer.tsx`: destructure and pass `accounts`.

`TemplateFormContent.tsx`: replace the `MediumField` import with `import { AccountField, resolveAccountId } from "@/components/Entries/components/AccountField";`; destructure `accounts`; after the `currency` state add:

```ts
// The account the month's expense goes to: the template keeps its own, even if it was archived
// since; a currency change drops it.
const keepAccountId = template.accountId;
const [accountId, setAccountId] = useState<string | null>(keepAccountId);
const account = resolveAccountId(accounts, currency, accountId, keepAccountId);
```

in the currency select's `onChange` add `setAccountId(null);` after `setCurrency(value);`; replace `<MediumField defaultMedium={template.medium} />` with:

```tsx
<AccountField
  accounts={accounts}
  currency={currency}
  value={account}
  keepAccountId={keepAccountId}
  onChange={setAccountId}
  errorMessage={fieldErrors.accountId?.[0]}
/>
```

`components/Expenses/Expenses.tsx`: wrap the `RecurringExpensesDrawer` (inside the categories `Await` of the recurring section) in `<Await source={accounts} fallback={null}>{(loadedAccounts) => (<RecurringExpensesDrawer ... accounts={loadedAccounts} />)}</Await>`.

- [ ] **Step 5: Run and see them pass**

Run: `npx vitest run core/expenses components/Expenses app/dashboard/expenses`
Expected: PASS.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/expenses components/Expenses`, then `npx vitest run` and `npm run lint`
Expected: all green. `rg -n "medium" core/expenses components/Expenses/components/RecurringExpensesDrawer` prints nothing.

### Task 9: Recurring incomes move to an account

**Files:**

- Test: `core/incomes/schema.recurring.test.ts`, `core/incomes/service.recurring.test.ts`, `core/incomes/actions.recurring.test.ts`, `components/Incomes/components/RecurringFormDrawer/RecurringFormDrawer.test.tsx`
- Fixture-only updates: `components/Incomes/components/RecurringIncomesDrawer/RecurringIncomesDrawer.test.tsx`, `components/Incomes/components/RecurringIncomesDrawer/components/DeleteRecurringDialog/DeleteRecurringDialog.test.tsx`, `components/Incomes/utils.test.ts`
- Modify: `core/incomes/{schema,consts,types,service}.ts`, `components/Incomes/components/RecurringFormDrawer/{RecurringFormContent.tsx,RecurringFormDrawer.tsx,types.ts}`, `components/Incomes/Incomes.tsx`

**Interfaces:**

- Consumes: Tasks 2–4.
- Produces: `RecurringIncomeInput.accountId: string` (replaces `medium`; `RecurringIncome` extends it); incomes' `RECURRING_FORM_FIELDS` has `"accountId"`; `createRecurringIncome` checks the account (`keepAccountId: null`), `updateRecurringIncome` reads the template's current account and checks (`keepAccountId` = current); `materializeRecurringIncomes` gives every generated income `accountId: template.accountId`; `RecurringFormDrawerProps.accounts: readonly AccountChoice[]`; the recurring form's currency select becomes controlled.

- [ ] **Step 1: Write the failing tests.**

`core/incomes/schema.recurring.test.ts`: **Input rule** on the valid input; replace `it("defaults the medium to digital and accepts cash", ...)` and `it("rejects an unknown medium", ...)` with:

```ts
it("requires the account and trims it", () => {
  expect(
    recurringIncomeInputSchema.safeParse({
      ...validInput,
      accountId: " acc_1 ",
    }).data?.accountId,
  ).toBe("acc_1");
  expect(errorPaths({ ...validInput, accountId: "" })).toEqual(["accountId"]);
});
```

`core/incomes/actions.recurring.test.ts`: **Form rule** on its builder; **Input rule** on the expected service input; replace `it("passes on the medium the form sends", ...)` with:

```ts
it("passes on the account the form sends", async () => {
  mocks.createRecurringIncome.mockResolvedValue({ id: "rec_1" });

  await createRecurringIncomeAction(buildFormData({ accountId: "acc_9" }));

  expect(mocks.createRecurringIncome.mock.calls[0][1].accountId).toBe("acc_9");
});
```

`core/incomes/service.recurring.test.ts`: add `findFirst: vi.fn(),` to the `recurringIncome` mock; add the `usable` mock; import `AccountArchivedError`; **Input rule** on `input`, **Write rule** on `WRITABLE_DATA` and on the expected generated rows of "creates every occurrence up to today ...", and replace `medium: "DIGITAL",` in `templateRow` with `accountId: "acc_1",`; in `beforeEach` add `recurringIncome.findFirst.mockResolvedValue({ accountId: "acc_1" });`; in "returns false when the template is not the user's" add `recurringIncome.findFirst.mockResolvedValue(null);` first. Replace `it("carries the medium of a cash template", ...)` with:

```ts
it("carries the account of each template", async () => {
  recurringIncome.findMany.mockResolvedValue([
    templateRow({ accountId: "acc_cash" }),
  ]);

  const [template] = await listRecurringIncomes(USER_ID);

  expect(template.accountId).toBe("acc_cash");
});
```

replace `it("gives every generated income the medium of its template", ...)` with:

```ts
it("generates every income in the account of its template", async () => {
  recurringIncome.findMany.mockResolvedValue([
    templateRow({ id: "rec_cash", accountId: "acc_cash" }),
    templateRow({ id: "rec_bank", accountId: "acc_bank" }),
  ]);
  income.groupBy.mockResolvedValue([]);
  income.createMany.mockResolvedValue({ count: 6 });

  await materializeRecurringIncomes(USER_ID, "2026-09-30");

  const accounts = new Map(
    income.createMany.mock.calls[0][0].data.map(
      (row: { recurringIncomeId: string; accountId: string }) => [
        row.recurringIncomeId,
        row.accountId,
      ],
    ),
  );

  expect(accounts).toEqual(
    new Map([
      ["rec_cash", "acc_cash"],
      ["rec_bank", "acc_bank"],
    ]),
  );
});
```

and add to `describe("createRecurringIncome", ...)` and `describe("updateRecurringIncome", ...)` respectively:

```ts
it("checks the account before writing, and writes nothing when it is refused", async () => {
  usable.assertUsableAccount.mockRejectedValue(new AccountArchivedError());

  await expect(createRecurringIncome(USER_ID, input)).rejects.toBeInstanceOf(
    AccountArchivedError,
  );
  expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
    accountId: "acc_1",
    currency: "USD",
    keepAccountId: null,
  });
  expect(recurringIncome.create).not.toHaveBeenCalled();
});
```

```ts
it("lets the template keep the account it has, even if archived", async () => {
  recurringIncome.findFirst.mockResolvedValue({ accountId: "acc_old" });
  recurringIncome.updateMany.mockResolvedValue({ count: 1 });

  await updateRecurringIncome(USER_ID, "rec_1", {
    ...input,
    accountId: "acc_old",
  });

  expect(recurringIncome.findFirst).toHaveBeenCalledWith({
    where: { id: "rec_1", userId: USER_ID },
    select: { accountId: true },
  });
  expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
    accountId: "acc_old",
    currency: "USD",
    keepAccountId: "acc_old",
  });
});
```

`RecurringFormDrawer.test.tsx`: declare `ACCOUNTS`; replace `medium: "DIGITAL",` in `RECURRING` with `accountId: "acc_usd",` (the fixture is in USD); pass `accounts={ACCOUNTS}` to `<RecurringFormDrawer`; replace the whole `describe("medium field", ...)` with:

```ts
describe("account field", () => {
  const accountTrigger = () => screen.getByRole("button", { name: /Cuenta/ });

  it("preselects the only account in the currency of a new template (pesos)", () => {
    renderForm(null);

    expect(accountTrigger()).toHaveTextContent(
      "Banco Galicia · Caja de ahorro",
    );
    expect(formValue("accountId")).toBe("acc_1");
  });

  it("starts on the account of the template being edited", () => {
    renderForm(RECURRING);

    expect(accountTrigger()).toHaveTextContent(
      "Banco Galicia · Cuenta en dólares",
    );
  });

  it("drops the account when the currency changes, and takes the only one of the new currency", async () => {
    renderForm(RECURRING);

    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
      key: "ArrowDown",
    });

    const pesos = await screen.findByRole("option", { name: /^ARS/ });

    fireEvent.keyDown(pesos, { key: "Enter" });
    fireEvent.keyUp(pesos, { key: "Enter" });

    expect(formValue("accountId")).toBe("acc_1");
  });

  it("sends the chosen account with the rest of the form", async () => {
    actions.updateRecurringIncomeAction.mockResolvedValue({
      status: "success",
    });
    renderForm(RECURRING);

    submit();

    await waitFor(() =>
      expect(actions.updateRecurringIncomeAction).toHaveBeenCalledTimes(1),
    );

    const formData = actions.updateRecurringIncomeAction.mock
      .calls[0][1] as FormData;

    expect(formData.get("accountId")).toBe("acc_usd");
    expect(formData.has("medium")).toBe(false);
  });
});
```

Apply `accountId: "acc_1"` (replacing `medium`) to the `RecurringRow`/`RecurringIncome` fixtures of the fixture-only files.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run core/incomes components/Incomes/components/RecurringFormDrawer components/Incomes/components/RecurringIncomesDrawer components/Incomes/utils.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the core.**

`core/incomes/schema.ts`: in `recurringIncomeInputSchema` replace `    medium: mediumField,` with `    accountId: accountIdField,` and drop `mediumField,` from the import list.

`core/incomes/consts.ts`: in `RECURRING_FORM_FIELDS` replace `"medium",` with `"accountId",`.

`core/incomes/types.ts`: in `RecurringIncomeInput` replace

```ts
// Copied onto every income the template generates.
medium: PaymentMedium;
```

with

```ts
// The account every generated income goes to.
accountId: string;
```

and delete `import type { PaymentMedium } from "@/core/entries/medium";`.

`core/incomes/service.ts`:

1. In `toRecurringIncome` replace `  medium: row.medium,` with `  accountId: assignedAccountId(row.accountId), // EXPAND`.
2. In `toRecurringWritableData` replace `  medium: input.medium,` with `  accountId: input.accountId,`.
3. In `createRecurringIncome`, after `await assertCategoryOwnedBy(userId, input.categoryId);` add the `assertUsableAccount(userId, { accountId: input.accountId, currency: input.currency, keepAccountId: null })` call.
4. In `updateRecurringIncome`, after the category check add:

```ts
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
```

5. In `materializeRecurringIncomes` replace `        medium: template.medium,` with `        // Every occurrence goes to the template's account.\n        accountId: template.accountId,`.

- [ ] **Step 4: Implement the form.**

`RecurringFormDrawer/types.ts`: import `AccountChoice`; add `accounts: readonly AccountChoice[];` to `RecurringFormDrawerProps` (comment "Every account of the user, for the "Cuenta" field.") and `"accounts"` to the content's `Pick`. `RecurringFormDrawer.tsx`: destructure and pass `accounts`.

`RecurringFormContent.tsx`:

1. Remove the `MediumField` and `DEFAULT_PAYMENT_MEDIUM` imports; import `{ AccountField, resolveAccountId }`.
2. Destructure `accounts`; after the `formError` state add:

```ts
// The currency is kept in state because the account choice depends on it; a currency change drops
// the account, an edit keeps the template's own (even archived).
const [currency, setCurrency] = useState(
  recurring?.currency ?? DEFAULT_CURRENCY_CODE,
);
const keepAccountId = recurring?.accountId ?? null;
const [accountId, setAccountId] = useState<string | null>(keepAccountId);
const account = resolveAccountId(accounts, currency, accountId, keepAccountId);
```

3. Make the currency select controlled: replace `              defaultValue={recurring?.currency ?? DEFAULT_CURRENCY_CODE}` with

```tsx
              value={currency}
              onChange={(value) => {
                if (typeof value === "string") {
                  setCurrency(value);
                  setAccountId(null);
                }
              }}
```

4. Replace the `<MediumField ... />` element with the `AccountField` element (same props as in Task 7).

`components/Incomes/Incomes.tsx`: wrap the `RecurringFormDrawer` in `<Await source={accounts} fallback={null}>{(loadedAccounts) => (<RecurringFormDrawer ... accounts={loadedAccounts} />)}</Await>`.

- [ ] **Step 5: Run and see them pass**

Run: `npx vitest run core/incomes components/Incomes`
Expected: PASS.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/incomes components/Incomes`, then `npx vitest run` and `npm run lint`
Expected: all green. `rg -n "medium" core/incomes components/Incomes/components/RecurringFormDrawer` prints nothing.

### Task 10: Purchases in installments move to an account (the own-card rule goes)

A purchase in cuotas always names the account that pays it, chosen explicitly, whether the card is the user's own or borrowed. The rule "an own card forces DIGITAL" disappears from the schema, the service and the planner. Every installment is created in the plan's account. The ticket shows a "Cuenta" line.

**Files:**

- Test: `core/installments/schema.test.ts`, `core/installments/service.test.ts`, `core/installments/actions.test.ts`, `components/Expenses/components/InstallmentPlannerDrawer/utils.test.ts`, `components/Expenses/components/InstallmentPlannerDrawer/InstallmentPlannerDrawer.test.tsx`
- Modify: `core/installments/{schema,types,service}.ts`, `components/Entries/components/InstallmentTicket/consts.ts`, `components/Expenses/components/InstallmentPlannerDrawer/{utils.ts,types.ts,InstallmentPlannerContent.tsx,InstallmentPlannerDrawer.tsx}`, `.../components/PurchaseForm/{PurchaseForm.tsx,types.ts}`, `.../components/PurchaseForm/components/CardOwnershipFields/CardOwnershipFields.tsx`, `components/Expenses/Expenses.tsx`

**Interfaces:**

- Consumes: Tasks 2–4.
- Produces:
  - `InstallmentPlanInput.accountId: string` and `InstallmentPlanPayload.accountId: string` (replace `medium`); `installmentPlanSchema` takes `accountId` (`accountIdField`). `IncomeInstallmentPlanInput` stops deriving from `InstallmentPlanInput` and becomes a standalone interface with the same fields it has today (still `medium`), so the income side moves on its own in Task 11; `IncomeInstallmentPlanPayload`, `incomeInstallmentPlanSchema` and `incomeService.ts` are not touched here.
  - `createInstallmentPlan` checks the account (`keepAccountId: null`) and writes `accountId` on the plan and on every installment.
  - `components/Entries/components/InstallmentTicket/consts.ts`: `ACCOUNT_LINE = "Cuenta"` (`MEDIUM_LINE` stays until Task 11).
  - Planner: `PurchaseValues.accountId: string | null` (replaces `medium`); `PurchaseSummary.accountLabel: string`; `toPayload(values, cards = [], accounts: readonly AccountChoice[] = [])`; `parsePurchase(values, cards = [], accounts = [])`; `withPurchaseChange(values, patch, cards): PurchaseValues` (drops a card of another currency and the account when the currency changes); `InstallmentPlannerDrawerProps.accounts`, `PurchaseFormProps.accounts`.

- [ ] **Step 1: Write the failing core tests.**

`core/installments/schema.test.ts` (only `describe("installmentPlanSchema", ...)`, lines 1–296 today; the `incomeInstallmentPlanSchema` describe is Task 11's): in its payload fixtures (`validInput` and the expected output object, the `medium` lines at ~13 and ~36) apply the **Input rule** (`accountId: "acc_1",`); delete the tests `it("keeps the medium the user chose, cash included, since that is how the lender is repaid", ...)`, `it("is always digital money, whatever medium came with it", ...)` and `it("defaults the medium to digital and accepts cash", ...)`; and add to the purchase describe:

```ts
it("requires the account the purchase is paid from", () => {
  expect(errorPaths({ ...validInput, accountId: "" })).toEqual(["accountId"]);
});

it("keeps the account chosen with an own card: a card no longer forces anything", () => {
  expect(
    installmentPlanSchema.safeParse({ ...withCard, accountId: "acc_cash" }).data
      ?.accountId,
  ).toBe("acc_cash");
});

it("no longer outputs a medium", () => {
  expect(installmentPlanSchema.safeParse(validInput).data).not.toHaveProperty(
    "medium",
  );
});
```

(`errorPaths`, `validInput` and `withCard` are the file's existing helpers.)

`core/installments/service.test.ts`: add the `usable` mock and `import { AccountArchivedError } from "@/core/accounts/errors";`; **Input rule** on `input` (and on `withCard`, which spreads it); **Write rule** on the expected plan/installments data (lines ~85 and ~101); replace the tests `"stores the plan and every installment as digital money, whatever medium came with it: a credit card is never cash"` and `"keeps the medium of a purchase with no card of the user's (a borrowed one)"` with:

```ts
it("stores the plan and every installment in the account chosen, with or without a card", async () => {
  await createInstallmentPlan(USER_ID, { ...withCard, accountId: "acc_cash" });

  expect(installmentPlan.create.mock.calls[0][0].data.accountId).toBe(
    "acc_cash",
  );
  expect(
    expense.createMany.mock.calls[0][0].data.every(
      ({ accountId }: { accountId: string }) => accountId === "acc_cash",
    ),
  ).toBe(true);
});

it("checks the account before writing anything, and writes nothing when it is refused", async () => {
  usable.assertUsableAccount.mockRejectedValue(new AccountArchivedError());

  await expect(createInstallmentPlan(USER_ID, input)).rejects.toBeInstanceOf(
    AccountArchivedError,
  );
  expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
    accountId: "acc_1",
    currency: input.currency,
    keepAccountId: null,
  });
  expect(installmentPlan.create).not.toHaveBeenCalled();
  expect(expense.createMany).not.toHaveBeenCalled();
});
```

`core/installments/actions.test.ts` (purchase part only; the `"... with kind income"` describe is Task 11's): **Input rule** on the purchase payload builder and its expected input (lines ~55 and ~106); replace the two tests at lines ~190–203 (the own card forcing `"DIGITAL"` and `"keeps the medium of a borrowed card ..."`) with:

```ts
it("passes on the account chosen, also with an own card", async () => {
  await createInstallmentPlanAction(payload({ accountId: "acc_cash" }));

  expect(mocks.createInstallmentPlan.mock.calls[0][1].accountId).toBe(
    "acc_cash",
  );
});
```

(`payload` is the file's builder; if the own-card variant is a separate builder, pass the account through it.)

- [ ] **Step 2: Write the failing planner tests.**

`components/Expenses/components/InstallmentPlannerDrawer/utils.test.ts`:

1. Declare `ACCOUNTS` (shared fixtures) and `const ARS_ONLY = ACCOUNTS.filter(({ currency }) => currency === "ARS");`.
2. In the values fixture and in `initialValues`' expected object replace `medium: "DIGITAL",` with `accountId: null,`; in `toPayload`'s expected object replace `medium: "DIGITAL",` with `accountId: "",`.
3. Rename `"starts empty, in pesos, digital, twelve installments, the first one today"` to `"starts empty, in pesos, with no account, twelve installments, the first one today"`.
4. Delete `it("names cash as Efectivo", ...)`, `it("is always digital money: a credit card is never cash", ...)`, `it("has no medium line: a credit card is always digital money", ...)`; in `"sends no card keys for a borrowed card: the typed first date counts, and so does the medium"` remove `medium: "CASH"` from the input and the expected `medium: "CASH",` and rename it `"sends no card keys for a borrowed card: the typed first date counts"`; in the expected object of `parsePurchase`'s `"keeps the card and the first installment the cycle gives"` replace `medium: "DIGITAL",` with `accountId: "acc_1",` and make that test call `parsePurchase(withCard(), CARDS, ACCOUNTS)`.
5. In `toTicketLines` tests: the expected label list of `"lists the data of the purchase in the order a receipt would, a borrowed card with its medium"` ends with `"Tarjeta", "Cuenta"` instead of `"Tarjeta", "Medio"` (rename the test `"... a borrowed card, then the account"`); the summaries these tests build go through `parsePurchase(values, [], ARS_ONLY)`; the own-card ticket test `"ends with the card, as an own one"` now expects the card line second to last and `{ label: "Cuenta", value: "Banco Galicia · Caja de ahorro" }` last.
6. Add:

```ts
describe("the account of the purchase", () => {
  it("sends the account chosen", () => {
    expect(
      toPayload({ ...VALUES, accountId: "acc_1" }, [], ACCOUNTS).accountId,
    ).toBe("acc_1");
  });

  it("sends the only account of the currency when none was chosen", () => {
    expect(
      toPayload({ ...VALUES, accountId: null }, [], ACCOUNTS).accountId,
    ).toBe("acc_1");
  });

  it("sends no account while there are several in the currency and none was chosen", () => {
    expect(
      toPayload(
        { ...VALUES, accountId: null },
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
    expect(parsePurchase({ ...VALUES, accountId: null }, [], [])).toBeNull();
  });

  it("names the account on the ticket", () => {
    const summary = parsePurchase(
      { ...VALUES, accountId: "acc_1" },
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
        { ...VALUES, accountId: "acc_1" },
        { currency: "USD" },
        [],
      ).accountId,
    ).toBeNull();
  });

  it("keeps the account when anything else changes", () => {
    expect(
      withPurchaseChange({ ...VALUES, accountId: "acc_1" }, { notes: "x" }, [])
        .accountId,
    ).toBe("acc_1");
  });

  it("still drops a card of another currency", () => {
    expect(
      withPurchaseChange(
        { ...VALUES, cardOwnership: "own", cardId: "card_ars" },
        { currency: "USD" },
        CARDS,
      ).cardId,
    ).toBeNull();
  });
});
```

(`VALUES` and `CARDS` stand for the file's existing valid-values fixture and cards fixture — use their real names; `card_ars` stands for the id of its ARS card.)

`InstallmentPlannerDrawer.test.tsx`: declare `ACCOUNTS`; give `renderPlanner` a second parameter `accounts: readonly AccountChoice[] = ACCOUNTS` passed as `accounts={accounts}`; delete the `mediumGroup` helper; then:

- `"asks for the product, category, whose card, medium, ..."`: replace `expect(mediumGroup()).toBeVisible();` with `expect(screen.getByRole("button", { name: /Cuenta/ })).toBeVisible();` and rename "medium" to "account" in the title.
- `"starts in pesos, digital, with the total amount and twelve cuotas"`: replace the `Digital` radio expectation with `expect(screen.getByRole("button", { name: /Cuenta/ })).toHaveTextContent("Banco Galicia · Caja de ahorro");` and rename to `"starts in pesos, on the only peso account, ..."`.
- `"asks for one of the user's cards, with no 'Sin tarjeta' option, and not for the medium"`: replace `expect(mediumGroup()).not.toBeInTheDocument();` with `expect(screen.getByRole("button", { name: /Cuenta/ })).toBeVisible();` and rename to `"... and for the account that pays it"`.
- `"asks for the medium, to repay the lender, and for the first date as typed"`: replace the two medium expectations with the same `Cuenta` visibility expectation; rename `"asks for the account, and for the first date as typed"`.
- `"remembers the medium and the card when going back and forth"`: delete the two `Efectivo` lines; rename `"remembers the card when going back and forth"`.
- Ticket tests: `"lists the product, ..., the card as borrowed and the medium"` expects `line("Cuenta")` to have text `"Banco Galicia · Caja de ahorro"` instead of `line("Medio")` → `"Digital"` (rename "... and the account"); delete `"shows cash as Efectivo"`; `"says the card is the user's own, with its name, and has no medium line"` becomes `"... and names the account"`, replacing the `queryByText("Medio")` assertion with `expect(within(ticket()).getByText("Cuenta")).toBeInTheDocument();`.
- Saving tests: in every expected payload replace `medium: "DIGITAL",` with `accountId: "acc_1",`; delete `"sends cash when the borrowed card is repaid in cash"` and `"sends digital money even if cash was chosen on a borrowed card before"`.
- Add:

```ts
describe("the account that pays the purchase", () => {
  it("drops the account when the currency changes and takes the only one of the new currency", async () => {
    renderPlanner();

    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
      key: "ArrowDown",
    });

    const dollars = await screen.findByRole("option", { name: /^USD/ });

    fireEvent.keyDown(dollars, { key: "Enter" });
    fireEvent.keyUp(dollars, { key: "Enter" });

    expect(screen.getByRole("button", { name: /Cuenta/ })).toHaveTextContent(
      "Banco Galicia · Cuenta en dólares",
    );
  });

  it("links to Bancos when the currency has no account", () => {
    renderPlanner([], []);

    expect(
      screen.getByRole("link", { name: "Creá una en Bancos" }),
    ).toHaveAttribute("href", "/dashboard/banks");
  });
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `npx vitest run core/installments components/Expenses/components/InstallmentPlannerDrawer`
Expected: FAIL.

- [ ] **Step 4: Implement the core.**

`core/installments/types.ts`: in `InstallmentPlanInput` replace `  medium: PaymentMedium;` with

```ts
// The account that pays the installments (with a card, the account that pays its statement). It
// is the user's, active and in the currency of the purchase (the service checks it).
accountId: string;
```

and update the comment above `cardId` (drop "A purchase with a card is always digital money."); in `InstallmentPlanPayload` replace `  medium: PaymentMedium;` with `  accountId: string;`; replace the `IncomeInstallmentPlanInput` type alias with a standalone interface (same fields as today; Task 11 swaps its `medium`):

```ts
// A validated loan repaid to the user in installments: like a purchase, without a card. The category
// is one of the user's income categories, and `medium` is how the money arrives (Task 11 of stage 2a
// replaces it with the account).
export interface IncomeInstallmentPlanInput {
  description: string;
  categoryId: string;
  currency: string;
  medium: PaymentMedium;
  notes: string | null;
  totalCuotas: number;
  totalAmount: number;
  firstDate: string;
}
```

(keep the `PaymentMedium` import for it and for `IncomeInstallmentPlanPayload`).

`core/installments/schema.ts`: add `accountIdField,` to the import from `@/core/entries/fields` (keep `mediumField` for the income schema until Task 11); delete the `DEFAULT_PAYMENT_MEDIUM` import; in `installmentPlanSchema` replace `    medium: mediumField,` with `    accountId: accountIdField,`; in its transform delete the two comment lines and the line `      medium: cardOwnership === "own" ? DEFAULT_PAYMENT_MEDIUM : value.medium,`.

`core/installments/service.ts`: delete the `DEFAULT_PAYMENT_MEDIUM` import; add `import { assertUsableAccount } from "@/core/accounts/usable";`; in `createInstallmentPlan` after the category check add

```ts
await assertUsableAccount(userId, {
  accountId: input.accountId,
  currency: input.currency,
  keepAccountId: null,
});
```

delete the two comment lines and `const medium = cardId ? DEFAULT_PAYMENT_MEDIUM : input.medium;`; replace `        medium,` in the plan data with `        accountId: input.accountId,` and in the installments data with `        // Every installment is paid from the plan's account.\n        accountId: input.accountId,`.

`core/installments/incomeService.ts` is not touched (its input keeps `medium` until Task 11).

`components/Entries/components/InstallmentTicket/consts.ts`: add `export const ACCOUNT_LINE = "Cuenta";` after `MEDIUM_LINE`.

- [ ] **Step 5: Implement the planner.**

`InstallmentPlannerDrawer/types.ts`: import `AccountChoice`; delete the `PaymentMedium` import; in `InstallmentPlannerDrawerProps` add `accounts: readonly AccountChoice[];` (comment "Every account of the user: the purchase is paid from one of them.") and `"accounts"` to the content `Pick`; in `PurchaseValues` replace `  medium: PaymentMedium;` with `  // The account that pays the purchase, or null while none is chosen (see resolveAccountId).\n  accountId: string | null;`; in `PurchaseSummary` add `  // "Banco · Cuenta" of the account that pays it.\n  accountLabel: string;`.

`InstallmentPlannerDrawer/utils.ts`:

1. Imports: replace `MEDIUM_LINE,` with `ACCOUNT_LINE,` in the ticket-consts import; delete the `MEDIUM_OPTIONS` and `DEFAULT_PAYMENT_MEDIUM` imports; add `import { resolveAccountId } from "@/components/Entries/components/AccountField";` and `import type { AccountChoice } from "@/core/accounts/types";`.
2. In `initialValues` replace `  medium: DEFAULT_PAYMENT_MEDIUM,` with `  accountId: null,` and update its comment ("nothing typed, pesos, no account yet, …").
3. Add after `dropMismatchedCard`:

```ts
// A change of the first step: a currency change leaves behind a card and an account of the old
// currency (the account field then offers the new currency's, preselecting it when it is the only one).
export const withPurchaseChange = (
  values: PurchaseValues,
  patch: Partial<PurchaseValues>,
  cards: readonly CardOption[],
): PurchaseValues => {
  const next = dropMismatchedCard({ ...values, ...patch }, cards);

  return patch.currency !== undefined && patch.currency !== values.currency
    ? { ...next, accountId: null }
    : next;
};
```

4. Replace `toPayload` with:

```ts
// What the server receives. A piece with no value yet goes as a value the server's rules refuse. The
// account is the one chosen, or the only one of the currency. With an own card the first date is the
// one its cycle gives (the server works it out again), and the card and the day of the purchase travel
// with it. A borrowed card sends nothing about cards: the typed date counts.
export const toPayload = (
  values: PurchaseValues,
  cards: readonly CardOption[] = [],
  accounts: readonly AccountChoice[] = [],
): InstallmentPlanPayload => {
  const card = cardOf(values, cards);

  return {
    description: values.description,
    categoryId: values.categoryId ?? "",
    currency: values.currency,
    accountId:
      resolveAccountId(accounts, values.currency, values.accountId) ?? "",
    notes: values.notes,
    amount: values.amount,
    amountMode: values.amountMode,
    totalCuotas: values.totalCuotas ?? Number.NaN,
    firstDate: firstDateOf(values, card) ?? "",
    cardOwnership: values.cardOwnership,
    ...(card
      ? { cardId: card.id, purchaseDate: values.purchaseDate ?? "" }
      : {}),
  };
};
```

5. `parsePurchase(values, cards = [], accounts: readonly AccountChoice[] = [])`: call `toPayload(values, cards, accounts)` and add to the returned summary `accountLabel: accounts.find(({ id }) => id === input.accountId)?.label ?? "",`.
6. Replace `cardLines` with:

```ts
// The card of the purchase on the ticket, then the account that pays it.
const cardLines = ({ card, accountLabel }: PurchaseSummary): TicketLine[] => [
  {
    label: CARD_LINE,
    value: card ? ownCardValue(card.title) : BORROWED_CARD_VALUE,
  },
  { label: ACCOUNT_LINE, value: accountLabel },
];
```

`InstallmentPlannerContent.tsx`: destructure `accounts`; `parsePurchase(values, cards, accounts)`; `handleChange` becomes `setValues((current) => withPurchaseChange(current, patch, cards));` (import `withPurchaseChange`, drop `dropMismatchedCard` from the import); `createInstallmentPlanAction(toPayload(values, cards, accounts))`; pass `accounts={accounts}` to `<PurchaseForm`. `InstallmentPlannerDrawer.tsx`: destructure and pass `accounts`.

`PurchaseForm/types.ts`: import `AccountChoice` and add `accounts: readonly AccountChoice[];` (comment "Every account of the user: the purchase is paid from one of them."). `PurchaseForm.tsx`: import `{ AccountField, resolveAccountId }`; destructure `accounts`; update the comment above `CardOwnershipFields` to "A purchase in installments is always on a card: one of the user's own (with the cards of the purchase's currency to pick from) or a borrowed one. Either way the account that pays it is chosen right after."; insert after `<CardOwnershipFields ... />`:

```tsx
<AccountField
  accounts={accounts}
  currency={values.currency}
  value={resolveAccountId(accounts, values.currency, values.accountId)}
  onChange={(accountId) => onChange({ accountId })}
/>
```

`CardOwnershipFields.tsx`: delete the `MediumField` import and the block `{isOwn ? null : (<MediumField ... />)}`; update its leading comment: "Whose card pays the purchase, and what each answer asks next. An own card is one of the user's: the list under it says which one suits the purchase, it informs and never blocks. A borrowed card has no record, so the first installment's date is typed (by the form). The account is asked by the form, for both."

`components/Expenses/Expenses.tsx`: move the `InstallmentPlannerDrawer` inside the accounts `Await` added in Task 6 (next to the `ExpenseFormDrawer`) and pass `accounts={loadedAccounts}`.

- [ ] **Step 6: Run and see them pass**

Run: `npx vitest run core/installments components/Expenses components/Entries`
Expected: PASS.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/installments components/Expenses components/Entries`, then `npx vitest run` and `npm run lint`
Expected: all green (the repayment planner is untouched: its payload type still has `medium`). `rg -n "DEFAULT_PAYMENT_MEDIUM|medium" core/installments/service.ts components/Expenses` prints nothing; `rg -n "medium" core/installments` prints only `incomeService.ts`, the income parts of `schema.ts`/`types.ts` and their tests (Task 11).

### Task 11: Repayments in installments move to an account

**Files:**

- Test: `core/installments/incomeService.test.ts`, `core/installments/schema.test.ts` (the `incomeInstallmentPlanSchema` describe), `core/installments/actions.test.ts` (the `"... with kind income"` describe), `components/Incomes/components/RepaymentPlannerDrawer/utils.test.ts`, `components/Incomes/components/RepaymentPlannerDrawer/RepaymentPlannerDrawer.test.tsx`
- Modify: `core/installments/{incomeService,schema,types}.ts`, `components/Entries/components/InstallmentTicket/consts.ts`, `components/Incomes/components/RepaymentPlannerDrawer/{utils.ts,types.ts,RepaymentPlannerContent.tsx,RepaymentPlannerDrawer.tsx}`, `.../components/RepaymentForm/{RepaymentForm.tsx,types.ts}`, `components/Incomes/Incomes.tsx`

**Interfaces:**

- Consumes: Tasks 2–4, `ACCOUNT_LINE` (Task 10).
- Produces: `IncomeInstallmentPlanInput.accountId: string` and `IncomeInstallmentPlanPayload.accountId: string` (replace `medium`; `PaymentMedium` is no longer imported by `core/installments/types.ts`); `incomeInstallmentPlanSchema` takes `accountId`; `createIncomeInstallmentPlan` checks the account and writes it on the plan and every installment; `RepaymentValues.accountId: string | null` (replaces `medium`); `RepaymentSummary.accountLabel: string`; `toPayload(values, accounts = [])`, `parseRepayment(values, accounts = [])`, `withRepaymentChange(values, patch): RepaymentValues`; `RepaymentPlannerDrawerProps.accounts`, `RepaymentFormProps.accounts`. `MEDIUM_LINE` is deleted.

- [ ] **Step 1: Write the failing tests.**

`core/installments/incomeService.test.ts`: add the `usable` mock and `import { AccountArchivedError } from "@/core/accounts/errors";`; **Input rule** on `input` (`medium: "CASH",` → `accountId: "acc_1",`); **Write rule** on the expected plan and installment data (lines ~86, ~108); rename `"creates every installment as a planned income linked to the plan, with its number, medium and notes"` to `"... with its number, account and notes"`; replace `it("keeps the medium the user chose on the plan and on every installment", ...)` with:

```ts
it("puts the plan and every installment in the account chosen", async () => {
  await createIncomeInstallmentPlan(USER_ID, {
    ...input,
    accountId: "acc_cash",
  });

  expect(installmentPlan.create.mock.calls[0][0].data.accountId).toBe(
    "acc_cash",
  );
  expect(
    income.createMany.mock.calls[0][0].data.every(
      ({ accountId }: { accountId: string }) => accountId === "acc_cash",
    ),
  ).toBe(true);
});

it("checks the account before writing anything, and writes nothing when it is refused", async () => {
  usable.assertUsableAccount.mockRejectedValue(new AccountArchivedError());

  await expect(
    createIncomeInstallmentPlan(USER_ID, input),
  ).rejects.toBeInstanceOf(AccountArchivedError);
  expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
    accountId: "acc_1",
    currency: input.currency,
    keepAccountId: null,
  });
  expect(installmentPlan.create).not.toHaveBeenCalled();
});
```

`core/installments/schema.test.ts`, inside `describe("incomeInstallmentPlanSchema", ...)` only: **Input rule** on its input fixtures (the `medium: "CASH",` lines at ~303 and ~324); replace `it("keeps the medium the user chose, since it is how the money arrives", ...)` with

```ts
it("keeps the account the money arrives in", () => {
  expect(
    incomeInstallmentPlanSchema.safeParse({
      ...validInput,
      accountId: "acc_cash",
    }).data?.accountId,
  ).toBe("acc_cash");
});
```

(`validInput` = that describe's own valid-input constant; use its real name if it differs) and in its table of invalid fields replace the row `["a medium", { medium: "CHEQUE" }, "medium"]` with `["an account", { accountId: "" }, "accountId"]`.

`core/installments/actions.test.ts`, inside `describe("createInstallmentPlanAction with kind income", ...)` only: **Input rule** on its payload and on its expected service input (the `medium: "CASH",` lines at ~310 and ~341).

`RepaymentPlannerDrawer/utils.test.ts`: declare `ACCOUNTS`; in the values fixture replace `medium: "CASH",` with `accountId: "acc_1",`; in `initialValues`' expected object replace `medium: "DIGITAL",` with `accountId: null,` (rename the test "... in pesos, with no account, ..."); in `toPayload`'s expected objects replace `medium: ...` with `accountId: "acc_1",` and call `toPayload(values, ACCOUNTS)`; in `parseRepayment`'s expected input replace `medium: "CASH",` with `accountId: "acc_1",` and call `parseRepayment(values, ACCOUNTS)`; in the ticket tests the last label is `"Cuenta"` instead of `"Medio"`, its value `"Banco Galicia · Caja de ahorro"`; replace `it("names the digital medium too", ...)` with:

```ts
it("is not valid without an account", () => {
  expect(parseRepayment({ ...VALUES, accountId: null }, [])).toBeNull();
});

it("drops the account when the currency changes", () => {
  expect(
    withRepaymentChange({ ...VALUES, accountId: "acc_1" }, { currency: "USD" })
      .accountId,
  ).toBeNull();
  expect(
    withRepaymentChange({ ...VALUES, accountId: "acc_1" }, { notes: "x" })
      .accountId,
  ).toBe("acc_1");
});
```

(`VALUES` = the file's values fixture.)

`RepaymentPlannerDrawer.test.tsx`: declare `ACCOUNTS`; pass `accounts={ACCOUNTS}` in `renderPlanner`; in `"asks for the concept, category, amount, currency, medium, ..."` replace the Medio radiogroup expectation with `expect(screen.getByRole("button", { name: /Cuenta/ })).toBeVisible();` (rename "medium" → "account"); in `"starts in pesos, digital, ..."` replace the Digital radio expectation with `expect(screen.getByRole("button", { name: /Cuenta/ })).toHaveTextContent("Banco Galicia · Caja de ahorro");`; in `"lists the repayment line by line, in order"` replace `"Medio"` with `"Cuenta"`; in `"fills the lines with what was typed"` replace `expect(value("Medio")).toBe("Digital");` with `expect(value("Cuenta")).toBe("Banco Galicia · Caja de ahorro");`; delete `"shows the medium that was chosen"` and `"sends cash when the money arrives in cash"`; in the expected payload of `"sends the repayment as an income plan, as typed, and closes the drawer"` replace `medium: "DIGITAL",` with `accountId: "acc_1",`.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run core/installments/incomeService.test.ts components/Incomes/components/RepaymentPlannerDrawer`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`core/installments/types.ts`: in the standalone `IncomeInstallmentPlanInput` (Task 10) replace `  medium: PaymentMedium;` with

```ts
// The account the money arrives in. It is the user's, active and in the currency of the loan.
accountId: string;
```

and update its comment (drop "and `medium` is how the money arrives (Task 11 …)"); in `IncomeInstallmentPlanPayload` replace `  medium: PaymentMedium;` with `  accountId: string;`; delete `import type { PaymentMedium } from "@/core/entries/medium";`.

`core/installments/schema.ts`: drop `mediumField,` from the fields import; in `incomeInstallmentPlanSchema` replace `    medium: mediumField,` with `    accountId: accountIdField,` and in its transform replace `    medium: value.medium,` with `    accountId: value.accountId,`.

`core/installments/incomeService.ts`: add `import { assertUsableAccount } from "@/core/accounts/usable";`; after the category check add the `assertUsableAccount(userId, { accountId: input.accountId, currency: input.currency, keepAccountId: null })` call; replace `        medium: input.medium,` in the plan data with `        accountId: input.accountId,` and in the installment data with `        // Every installment arrives in the plan's account.\n        accountId: input.accountId,`.

`components/Entries/components/InstallmentTicket/consts.ts`: delete `export const MEDIUM_LINE = "Medio";`.

`RepaymentPlannerDrawer/types.ts`: delete the `PaymentMedium` import, import `AccountChoice`; add `accounts: readonly AccountChoice[];` to `RepaymentPlannerDrawerProps` and `"accounts"` to the content `Pick`; in `RepaymentValues` replace

```ts
// How the money arrives.
medium: PaymentMedium;
```

with

```ts
// The account the money arrives in, or null while none is chosen (see resolveAccountId).
accountId: string | null;
```

and in `RepaymentSummary` add `  // "Banco · Cuenta" of the account.\n  accountLabel: string;`.

`RepaymentPlannerDrawer/utils.ts`: replace `MEDIUM_LINE,` with `ACCOUNT_LINE,` in the import; delete the `MEDIUM_OPTIONS` and `DEFAULT_PAYMENT_MEDIUM` imports; import `resolveAccountId` and `type AccountChoice`; in `initialValues` replace the `medium` line with `  accountId: null,`; replace `toPayload` and `parseRepayment` with:

```ts
// What the server receives. A piece with no value yet goes as a value the server's rules refuse. The
// account is the one chosen, or the only one of the currency.
export const toPayload = (
  values: RepaymentValues,
  accounts: readonly AccountChoice[] = [],
): IncomeInstallmentPlanPayload => ({
  kind: "income",
  description: values.description,
  categoryId: values.categoryId ?? "",
  currency: values.currency,
  accountId:
    resolveAccountId(accounts, values.currency, values.accountId) ?? "",
  notes: values.notes,
  amount: values.amount,
  amountMode: values.amountMode,
  totalCuotas: values.totalCuotas ?? Number.NaN,
  firstDate: values.firstDate ?? "",
});

// A change of the first step: a currency change drops the account of the old currency.
export const withRepaymentChange = (
  values: RepaymentValues,
  patch: Partial<RepaymentValues>,
): RepaymentValues =>
  patch.currency !== undefined && patch.currency !== values.currency
    ? { ...values, ...patch, accountId: null }
    : { ...values, ...patch };

// The repayment as the server will read it, or null while it is not valid. It is the server's own
// schema, so the button and the live preview agree with what the save will accept.
export const parseRepayment = (
  values: RepaymentValues,
  accounts: readonly AccountChoice[] = [],
): RepaymentSummary | null => {
  const parsed = incomeInstallmentPlanSchema.safeParse(
    toPayload(values, accounts),
  );

  if (!parsed.success) {
    return null;
  }

  const input = parsed.data;

  return {
    input,
    accountLabel:
      accounts.find(({ id }) => id === input.accountId)?.label ?? "",
    ...splitSummary(input.totalAmount, input.totalCuotas),
    lastMonth: lastInstallmentMonth(input.firstDate, input.totalCuotas),
  };
};
```

and in `toTicketLines` take `accountLabel` from the summary (`{ input, installmentAmount, isApproximate, lastMonth, accountLabel }`), delete the `const medium = ...` line, and replace the last line with `    { label: ACCOUNT_LINE, value: accountLabel },`.

`RepaymentPlannerContent.tsx`: destructure `accounts`; `parseRepayment(values, accounts)`; `handleChange` becomes `setValues((current) => withRepaymentChange(current, patch));`; `createInstallmentPlanAction(toPayload(values, accounts))`; pass `accounts` to `<RepaymentForm`. `RepaymentPlannerDrawer.tsx`: destructure and pass `accounts`.

`RepaymentForm/types.ts`: import `AccountChoice`, add `accounts: readonly AccountChoice[];`. `RepaymentForm.tsx`: replace the `MediumField` import with `{ AccountField, resolveAccountId }`; destructure `accounts`; replace the comment and the `<MediumField ... />` element with:

```tsx
{
  /* The account the money arrives in. */
}
<AccountField
  accounts={accounts}
  currency={values.currency}
  value={resolveAccountId(accounts, values.currency, values.accountId)}
  onChange={(accountId) => onChange({ accountId })}
/>;
```

and update the component's leading comment ("…the money arrives in an account, on the dates the user types.").

`components/Incomes/Incomes.tsx`: move the `RepaymentPlannerDrawer` inside the accounts `Await` added in Task 9 (next to the `RecurringFormDrawer`) and pass `accounts={loadedAccounts}`.

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run core/installments components/Incomes components/Entries`
Expected: PASS.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/installments components/Incomes components/Entries`, then `npx vitest run` and `npm run lint`
Expected: all green. `rg -n "medium|MEDIUM_LINE" components/Incomes core/installments components/Entries/components/InstallmentTicket` prints nothing.

### Task 12: Remove the medium from the UI and the entry fields

Nothing in the forms, tables, planners or entry schemas uses the medium any more. Delete what is left of it there, and prove it with a grep. What stage 2b still reads (`PaymentMedium` in the summary, the opening balance and the database) stays until 2b removes it.

**Files:**

- Delete: `components/Entries/components/MediumField/` (`MediumField.tsx`, `MediumField.test.tsx`, `consts.ts`, `types.ts`, `index.ts`)
- Modify: `core/entries/fields.ts`, `core/entries/medium.ts`, `core/entries/medium.test.ts`

**Interfaces:**

- Consumes: Tasks 6–11 (no consumer of `MediumField`, `MEDIUM_OPTIONS`, `mediumField`, `DEFAULT_PAYMENT_MEDIUM` or `isPaymentMedium` is left).
- Produces: `core/entries/medium.ts` exports only `PAYMENT_MEDIUMS` and `type PaymentMedium` (still read by `core/summary/{types,service}.ts`, `core/balances/types.ts` and `components/Summary/utils.ts` until stage 2b).

- [ ] **Step 1: Prove nothing uses them (the "failing" check of a deletion)**

Run: `rg -n "MediumField|MEDIUM_OPTIONS|mediumField|DEFAULT_PAYMENT_MEDIUM|isPaymentMedium" core components app --glob "!components/Entries/components/MediumField/**" --glob "!core/entries/medium*" --glob "!core/entries/fields.ts"`
Expected: no output. (If anything prints, the task that owns that slice is unfinished: stop and report it.)

- [ ] **Step 2: Trim the test first.** Replace `core/entries/medium.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { PAYMENT_MEDIUMS } from "./medium";

// What is left of the payment medium until stage 2b: the database enum, which the summary and the
// opening balance still read. Entries no longer carry it (they carry an account).
describe("payment medium (read-only until stage 2b)", () => {
  it("still mirrors the database enum", () => {
    expect([...PAYMENT_MEDIUMS]).toEqual(["DIGITAL", "CASH"]);
  });
});
```

- [ ] **Step 3: Delete.** Delete the directory `components/Entries/components/MediumField/`. In `core/entries/fields.ts` delete the import `import { DEFAULT_PAYMENT_MEDIUM, PAYMENT_MEDIUMS } from "./medium";` and the whole `mediumField` export. Replace `core/entries/medium.ts` with:

```ts
// The database enum the summary and the opening balance still read until stage 2b moves them onto
// accounts and drops it. Entries no longer carry a medium: they carry an account.
export const PAYMENT_MEDIUMS = ["DIGITAL", "CASH"] as const;

export type PaymentMedium = (typeof PAYMENT_MEDIUMS)[number];
```

- [ ] **Step 4: Run and see everything pass**

Run: `npx vitest run core/entries components/Entries components/componentStructure.test.ts`
Expected: PASS.

- [ ] **Step 5: Prove the medium is gone from the entries**

Run: `rg -n "\bmedium\b|Medium|\"CASH\"|\"DIGITAL\"" core/expenses core/incomes core/installments core/entries components app --glob "!core/entries/medium.ts" --glob "!core/entries/medium.test.ts"`
Expected: only lines in `components/Summary/` (stage 2b Tasks 2–3) and `app/dashboard/overview/loadSummaryView.test.ts` (stage 2b Task 3). Nothing under `core/expenses`, `core/incomes`, `core/installments`, `core/entries` (besides `medium.ts`), `components/Expenses`, `components/Incomes`, `components/Entries`.

- [ ] **Step 6: Verify (end of stage 2a)**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`
Expected: all green. Report to the controller: stage 2a done; the expand migration (Task 1) must be applied before the human tries the forms against the database (every create now writes `accountId`, which needs the column). Until stage 2b, the summary still splits by `medium`, which every new entry stores as `DIGITAL` (the column's default): the "Billetera" card stays at the cash opening amount only. That is expected and is replaced in 2b.

## Self-review notes (2a)

- Spec coverage (stage 2 items owned by 2a): required `accountId` on the five entry models (Tasks 1, 6–11; `NOT NULL` in 2b Task 11); generated entries copy the account (Tasks 6, 8, 9, 10, 11); movement currency = account currency (Task 2 guard, every service); "Medio" radio → "Cuenta" select with the four behaviours (Task 4 + each form); own-card rule removed (Task 10); `CashMarker` → "Cuenta" column (Tasks 6, 7). Opening balance, summary, board balances and balance rules are stage 2b.
- Every task boundary compiles: types change per slice, and each slice's task updates every file `tsc` names (the fixture rules). The one cross-slice type (`IncomeInstallmentPlanPayload`) is bridged in Task 10 Step 7 and finished in Task 11.
- Not in the spec but decided here: an edit may keep an archived account (Review Focus 2); the account field lists accounts in Banks-board order; `listAccountChoices` seeds the default cash account.
