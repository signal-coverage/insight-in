# Banks and Accounts (Stage 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user keep banks (a bank, a virtual wallet, the cash drawer) and, inside each, accounts that hold one currency, on a new `/dashboard/banks` page with a swimlane board, search, archived toggle and create/edit/archive drawers. Stage 1 is additive: no balances, no movements, `medium` and the entry models are untouched.

**Architecture:** Two new Prisma models (`Bank`, `Account`), a `core/banks` and a `core/accounts` slice (zod schemas, userId-scoped services, server actions, types) mirroring `core/cards`, plus an idempotent `ensureDefaultCash(userId)`. The page mirrors the Cards/Roadmap pages (streamed promise handed to a client component through `Await`); the board is a custom swimlane (one row per bank, one tile per account) mirroring the Roadmap board's styling and tests.

**Tech Stack:** Next.js 16.3.6 (App Router, server actions), React 19.2, TypeScript, Prisma 7 + Neon, zod 4, HeroUI v3 (`@heroui/react`), Tailwind 4, Vitest 4 + Testing Library (jsdom per file), Clerk.

**Spec:** docs/superpowers/specs/2026-10-04-accounts-banks-transfers-design.md (Stage 1 only)

## Global Constraints

- Copy language: all UI copy (labels, buttons, errors, empty states) in Spanish es-AR, neutral/professional, voseo as in Cards/Roadmap ("Creá", "Archivá"). Code, identifiers, comments and tests in English. Route slug in English: `/dashboard/banks`.
- Component layout is enforced by `components/componentStructure.test.ts` (scans `components/` and `app/`, `.tsx` files that are not tests): no `type`/`interface`/`enum` declarations in a component file, no `const`/helper function at column 0 (only the component itself), exactly one component per file, no props typed inline (`}: {`), no inline `className="..."` of 40+ characters (move it to `styles.ts`), a sub-component is never a bare file under a nested `components/` folder (it gets its own folder `Name/Name.tsx` plus `index.ts`). Types go in `types.ts`, constants in `consts.ts`, styles in `styles.ts`, helpers in `utils.ts`, hooks in `useX.ts`.
- Strict TDD with Vitest: every behaviour gets a failing test first; run it and see it fail for the stated reason before writing the implementation. Component tests start with `// @vitest-environment jsdom`.
- Money convention (minor units, `BigInt` in the DB) is untouched: stage 1 stores no money.
- Every record is scoped by the Clerk `userId` that comes from the session (`runAuthenticated`), never from client input; another user's id behaves as not found.
- Names: bank name unique per user (`@@unique([userId, name])`), account name unique per bank (`@@unique([bankId, name])`); the services also compare ignoring case (like the categories do: `mode: "insensitive"`), excluding the record itself on rename; names are trimmed, non-empty, at most 40 characters (same as `CATEGORY_NAME_MAX_LENGTH`).
- Account currency is validated with the repo helper `currencyField` (`core/entries/fields.ts`, ISO code in `SUPPORTED_CURRENCY_CODES`). Account currency stays editable in stage 1.
- Archive, never delete. A bank can be archived only when all its accounts are archived. An account cannot be created in, or reactivated under, an archived bank.
- Colors: never blue buttons; only theme tokens already used by existing components (`bg-surface-secondary`, `bg-surface-tertiary`, `ring-border`, `border-border`, `text-muted`, `ring-focus`). Async buttons use `PendingButton` (guard `components/shared/PendingButton/pendingButtonUsage.test.ts` forbids `isPending` on a raw HeroUI `Button`).
- Raw `<button>` elements (tiles) are hit by the global rule in `app/globals.css` (`height: 2.5rem`, `max-width: fit-content`, `padding: 0.5rem`, `border-radius: var(--field-radius)`); tiles opt out with the documented classes `app-button--full-width app-button--row-height`.
- Next.js (this repo runs 16.3.6, see AGENTS.md): pages are async Server Components that call `requireUserId()` (guard `lib/auth/routeProtection.test.ts`); `"use server"` files export only async functions; `revalidatePath(BANKS_PATH)` is called only after a successful write (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`).
- HeroUI v3 usage is copied from components that already work in this repo (Cards drawer, Roadmap drawer, sidebar `SearchField`, `ExpectedIncomesSwitch`), checked against `.heroui-docs/react/components/` (`(overlays)/drawer.mdx`, `(forms)/search-field.mdx`, `(controls)/switch.mdx`, `(layout)/card.mdx`).
- No git commit steps (the user commits only when asked). Every task ends with a verify step: that task's tests, `npx tsc --noEmit`, and `npx eslint <the task's paths>` (the husky pre-commit hook runs `npm run lint`).
- Do not start, stop or restart `next dev` (the human runs it on port 3000). The migration (Task 1) touches the shared Neon dev database and is run by the human or confirmed with the human first.
- Stage 1 is additive: do not touch `medium`, `Income`/`Expense` models, balances or the summary.

## Review Focus

1. Concurrent or repeated `ensureDefaultCash` (two page loads at once, a reload, a user who renamed or archived "Efectivo" must not get a second "Efectivo" back) — pinned in Task 6.
2. Creating or renaming to a name that already exists with a different case or surrounding whitespace, for banks and accounts, and renaming a record to another casing of its own name (allowed) — pinned in Task 3 (trim), Task 4 (bank service), Task 5 (account service).
3. Archive rules: archiving a bank that still has active accounts, reactivating an account under an archived bank, creating an account in an archived bank (all refused with a Spanish message, enforced inside the write statement, not only in the UI) — pinned in Task 4, Task 5, Task 9, Task 10, Task 16, Task 17.
4. Search interacting with archived items: a query that matches only an archived account (or archived bank) must not surface its bank while archived items are hidden, and must when the toggle is on; accent/case-insensitive match — pinned in Task 7 (pure) and Task 19 (page behaviour).
5. Another user's bank/account id (behaves as not found, never touched) and the same account name in two different banks (allowed) — pinned in Task 4, Task 5, Task 9, Task 10 and the schema constraints in Task 1.

## File Structure

Prisma and tooling

- Modify `prisma/schema.prisma` — add `Bank` and `Account` models.
- Create `prisma/schema.test.ts` — pins the constraints of the two models (unique per user / per bank, restrict FK, archivedAt).
- Create `prisma/migrations/<timestamp>_banks_and_accounts/migration.sql` — generated by `prisma migrate dev` (human).
- Modify `scripts/clearData/tables.ts` and `scripts/clearData/tables.test.ts` — `db:clear` knows `Account` and `Bank`.

Core: banks (`core/banks`)

- Create `consts.ts` (path, limits, form fields, Spanish messages), `types.ts`, `errors.ts`, `schema.ts` (+ `schema.test.ts`), `service.ts` (+ `service.test.ts`), `board.ts` (+ `board.test.ts`, pure search/archived filtering), `pageData.ts` (+ `pageData.test.ts`), `actionHelpers.ts` (shared by both actions files), `actions.ts` (+ `actions.test.ts`).

Core: accounts (`core/accounts`)

- Create `consts.ts`, `types.ts`, `errors.ts`, `schema.ts` (+ `schema.test.ts`), `mappers.ts` (row to plain account), `service.ts` (+ `service.test.ts`), `defaultCash.ts` (+ `defaultCash.test.ts`), `actions.ts` (+ `actions.test.ts`).

Navigation

- Modify `components/Sidebar/consts.ts` and `components/Sidebar/consts.test.ts` — "Bancos" item after "Tarjetas".
- Modify `components/Navbar/components/NavbarBreadcrumbs/consts.ts` and `utils.test.ts` — breadcrumb name.

Route

- Create `app/dashboard/banks/page.tsx` (session check, starts loading, renders `Banks`), `app/dashboard/banks/loadBanksView.ts` (+ `loadBanksView.test.ts`).

Components (`components/Banks`)

- `Banks.tsx` (+ `Banks.test.tsx`), `index.ts`, `types.ts`, `consts.ts`, `styles.ts` — the page: header with the shared Actions menu, toolbar, board, drawers, filter state.
- `components/BanksToolbar/` — search field and "Mostrar archivados" switch.
- `components/BanksBoard/` — the swimlane list and its empty states; `components/BankRow/` one row; `components/BankCell/` first column (bank, opens its editor); `components/AccountTile/` name + currency only; `components/AddAccountTile/` the "+ cuenta" tile.
- `components/LoadingBoard/` — skeleton rows while the data streams in.
- `components/BankFormDrawer/` — create/edit/archive/reactivate a bank.
- `components/AccountFormDrawer/` — create/edit/archive/reactivate an account.

## Tasks

### Task 1: Prisma models `Bank` and `Account` and the migration

**Files:**

- Test: `prisma/schema.test.ts`
- Modify: `prisma/schema.prisma`
- Create (by the migration command, human): `prisma/migrations/<timestamp>_banks_and_accounts/migration.sql`

**Interfaces:**

- Consumes: nothing.
- Produces: Prisma models `Bank { id, userId, name, archivedAt: Date | null, createdAt, updatedAt, accounts }` and `Account { id, userId, bankId, name, currency, archivedAt: Date | null, createdAt, updatedAt, bank }`; after `npx prisma generate`, `prisma.bank` / `prisma.account` and the row types `Bank` / `Account` exported by `@/lib/generated/prisma/client`.

- [ ] **Step 1: Write the failing test** `prisma/schema.test.ts`

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// There is no database in the unit tests, so the constraints that decide the rules of this feature
// (a name is unique per user for a bank and per bank for an account; an account always has a bank
// that cannot be deleted under it; archive instead of delete) are pinned on the schema text itself.
const SCHEMA = readFileSync(join(__dirname, "schema.prisma"), "utf8");

const modelBlock = (name: string): string => {
  const match = SCHEMA.match(
    new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, "m"),
  );

  if (!match) {
    throw new Error(`model ${name} is not in schema.prisma`);
  }

  return match[1];
};

describe("model Bank", () => {
  const bank = modelBlock("Bank");

  it("belongs to a Clerk user and is named", () => {
    expect(bank).toMatch(/userId\s+String/);
    expect(bank).toMatch(/name\s+String/);
  });

  it("has a name that is unique per user", () => {
    expect(bank).toContain("@@unique([userId, name])");
  });

  it("is archived with a date, never deleted", () => {
    expect(bank).toMatch(/archivedAt\s+DateTime\?/);
  });

  it("owns its accounts", () => {
    expect(bank).toMatch(/accounts\s+Account\[\]/);
  });
});

describe("model Account", () => {
  const account = modelBlock("Account");

  it("belongs to a Clerk user and holds exactly one currency", () => {
    expect(account).toMatch(/userId\s+String/);
    expect(account).toMatch(/currency\s+String/);
  });

  it("belongs to a bank that cannot be deleted while it has accounts", () => {
    expect(account).toMatch(
      /bank\s+Bank\s+@relation\(fields: \[bankId\], references: \[id\], onDelete: Restrict\)/,
    );
  });

  it("has a name that is unique per bank, not per user", () => {
    expect(account).toContain("@@unique([bankId, name])");
    expect(account).not.toContain("@@unique([userId, name])");
  });

  it("is archived with a date, never deleted", () => {
    expect(account).toMatch(/archivedAt\s+DateTime\?/);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run prisma/schema.test.ts`
Expected: FAIL, `model Bank is not in schema.prisma` (thrown by `modelBlock`).

- [ ] **Step 3: Add the models.** Append to the end of `prisma/schema.prisma` (anchor: the last lines of the file are `  @@index([userId, status, position])` followed by `}`):

```prisma

// A place that holds the user's money: a bank, a virtual wallet or the cash drawer. It only groups
// accounts. A bank the user gives up is archived, never deleted, so history can keep pointing at it.
model Bank {
  id         String    @id @default(cuid())
  // Clerk user id — banks are private to their owner.
  userId     String
  name       String
  // Set when the user gives the bank up; null while it is in use. It can be set only when every
  // account of the bank is archived (the service enforces it).
  archivedAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  accounts   Account[]

  @@unique([userId, name])
  @@index([userId])
}

// Where money sits: it belongs to exactly one bank and holds exactly one currency. Archived, never
// deleted, so history can keep pointing at it.
model Account {
  id         String    @id @default(cuid())
  // Clerk user id — accounts are private to their owner.
  userId     String
  bankId     String
  bank       Bank      @relation(fields: [bankId], references: [id], onDelete: Restrict)
  name       String
  // ISO 4217 code, validated against the Dinero currency list at the boundary.
  currency   String
  archivedAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@unique([bankId, name])
  @@index([userId])
}
```

- [ ] **Step 4: Run the test and see it pass, then validate the schema**

Run: `npx vitest run prisma/schema.test.ts`
Expected: PASS (8 tests).
Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid`.

- [ ] **Step 5: Regenerate the Prisma client (writes only `lib/generated/prisma`, git-ignored, no database access)**

Run: `npx prisma generate`
Expected: `Generated Prisma Client ... to .\lib\generated\prisma`. Later tasks need it for `npx tsc --noEmit`.

- [ ] **Step 6: Create the migration. RUN BY THE HUMAN, OR CONFIRM WITH THE HUMAN FIRST: it touches the shared Neon dev database.**

Run: `npx prisma migrate dev --name banks_and_accounts`
Expected: a new folder `prisma/migrations/<timestamp>_banks_and_accounts/migration.sql` applied to the dev database. Compare the generated SQL with this (the table, index and FK names must match; no hand-written CHECK is needed in stage 1 because names are validated at the boundary):

```sql
-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bank_userId_idx" ON "Bank"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_userId_name_key" ON "Bank"("userId", "name");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_bankId_name_key" ON "Account"("bankId", "name");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

Then `npx prisma generate` again (the human may need to restart `next dev` to load the regenerated client; do not do it here).

- [ ] **Step 7: Verify**

Run: `npx vitest run prisma/schema.test.ts` then `npx tsc --noEmit`
Expected: tests PASS, `tsc` reports no errors. (No lint target: no `.ts` source changed besides the test.)

### Task 2: `db:clear` knows the new tables

`scripts/clearData` deletes every app table in dependency order; a new table that it does not list would survive `npm run db:clear` (and a Restrict FK makes the order matter: accounts before banks).

**Files:**

- Test: `scripts/clearData/tables.test.ts`
- Modify: `scripts/clearData/tables.ts`

**Interfaces:**

- Consumes: Task 1 models (names only).
- Produces: `CLEAR_ORDER` now lists `"Account"` then `"Bank"` (children before parents).

- [ ] **Step 1: Write the failing test.** In `scripts/clearData/tables.test.ts` replace

```ts
  Card: [],
  BoardItem: [],
```

with

```ts
  Card: [],
  Account: ["Bank"],
  Bank: [],
  BoardItem: [],
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run scripts/clearData/tables.test.ts`
Expected: FAIL in "lists every app table exactly once" (`Account` and `Bank` are missing from `CLEAR_ORDER`).

- [ ] **Step 3: Implement.** In `scripts/clearData/tables.ts` replace

```ts
 * BoardItem (the roadmap) has no foreign keys, so it can go anywhere.
```

with

```ts
 *   Account -> Bank (Restrict), so accounts go before their bank
 * BoardItem (the roadmap) has no foreign keys, so it can go anywhere.
```

and replace

```ts
  "Card",
  "BoardItem",
```

with

```ts
  "Card",
  "Account",
  "Bank",
  "BoardItem",
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run scripts/clearData`
Expected: PASS (all clearData tests; the other files use `CLEAR_ORDER.length` dynamically).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` and `npx eslint scripts/clearData`
Expected: no errors.

### Task 3: Declarations and validation schemas (banks and accounts)

**Files:**

- Test: `core/banks/schema.test.ts`, `core/accounts/schema.test.ts`
- Create: `core/banks/consts.ts`, `core/banks/types.ts`, `core/banks/errors.ts`, `core/banks/schema.ts`, `core/accounts/consts.ts`, `core/accounts/types.ts`, `core/accounts/errors.ts`, `core/accounts/schema.ts`

**Interfaces:**

- Consumes: `requiredText`, `currencyField` from `@/core/entries/fields`; `ActionFailure` type from `@/core/entries/actionHelpers`.
- Produces (exact names used by every later task):
  - `core/banks/consts.ts`: `BANKS_PATH = "/dashboard/banks"`, `BANK_NAME_MAX_LENGTH = 40`, `BANK_FORM_FIELDS`, `BANK_NOT_FOUND_MESSAGE`, `DUPLICATE_BANK_MESSAGE`, `BANK_ARCHIVED_MESSAGE`, `bankHasActiveAccountsMessage(count)`.
  - `core/banks/types.ts`: `BankInput { name }`, `Bank { id, name, archived }` (extends `BankInput`), `BankWithAccounts extends Bank { accounts: Account[] }`, `BankFilter { query, showArchived }`, `BanksFieldErrors`, `BanksActionResult`, `ParsedForm<T>`.
  - `core/banks/errors.ts`: `BankNotFoundError`, `DuplicateBankError`, `BankHasActiveAccountsError(count)`, `BankArchivedError`.
  - `core/banks/schema.ts`: `bankInputSchema` (output `BankInput`).
  - `core/accounts/consts.ts`: `ACCOUNT_NAME_MAX_LENGTH = 40`, `CREATE_ACCOUNT_FORM_FIELDS`, `UPDATE_ACCOUNT_FORM_FIELDS`, `DEFAULT_CASH_BANK_NAME = "Efectivo"`, `DEFAULT_CASH_ACCOUNT_NAME = "Efectivo"`, `DEFAULT_CASH_CURRENCY = "ARS"`, `ACCOUNT_NOT_FOUND_MESSAGE`, `DUPLICATE_ACCOUNT_MESSAGE`, `BANK_REQUIRED_MESSAGE`.
  - `core/accounts/types.ts`: `AccountInput { name, currency }`, `CreateAccountInput extends AccountInput { bankId }`, `Account extends AccountInput { id, bankId, archived }`.
  - `core/accounts/errors.ts`: `AccountNotFoundError`, `DuplicateAccountError`.
  - `core/accounts/schema.ts`: `accountInputSchema` (output `AccountInput`), `createAccountInputSchema` (output `CreateAccountInput`).

- [ ] **Step 1: Write the failing test** `core/banks/schema.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { bankInputSchema } from "./schema";

const messages = (input: unknown): string[] => {
  const result = bankInputSchema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
};

describe("bankInputSchema", () => {
  it("trims the name", () => {
    expect(bankInputSchema.parse({ name: "  Banco Galicia  " })).toEqual({
      name: "Banco Galicia",
    });
  });

  it("keeps the casing the user typed", () => {
    expect(bankInputSchema.parse({ name: "mercado PAGO" })).toEqual({
      name: "mercado PAGO",
    });
  });

  it("refuses an empty name, a name of only spaces and a missing name", () => {
    expect(messages({ name: "" })).toEqual(["El nombre es obligatorio."]);
    expect(messages({ name: "   " })).toEqual(["El nombre es obligatorio."]);
    expect(messages({})).toEqual(["El nombre es obligatorio."]);
  });

  it("accepts 40 characters and refuses 41", () => {
    expect(messages({ name: "a".repeat(40) })).toEqual([]);
    expect(messages({ name: "a".repeat(41) })).toEqual([
      "El nombre admite como máximo 40 caracteres.",
    ]);
  });

  it("counts the length after trimming", () => {
    expect(messages({ name: ` ${"a".repeat(40)} ` })).toEqual([]);
  });

  it("strips fields it does not know, so an owner or an archive date can never ride along", () => {
    expect(
      bankInputSchema.parse({ name: "A", userId: "attacker", archivedAt: "x" }),
    ).toEqual({ name: "A" });
  });
});
```

`core/accounts/schema.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { accountInputSchema, createAccountInputSchema } from "./schema";

const messagesOf = (schema: z.ZodType, input: unknown): string[] => {
  const result = schema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
};

describe("accountInputSchema", () => {
  it("trims the name and keeps a supported currency", () => {
    expect(
      accountInputSchema.parse({ name: "  Caja de ahorro  ", currency: "ARS" }),
    ).toEqual({ name: "Caja de ahorro", currency: "ARS" });
  });

  it("accepts any supported ISO currency", () => {
    expect(
      accountInputSchema.safeParse({ name: "Dólares", currency: "USD" })
        .success,
    ).toBe(true);
  });

  it("refuses a currency the app does not support, and one in lower case", () => {
    expect(
      messagesOf(accountInputSchema, { name: "A", currency: "ZZZ" }),
    ).toEqual(["Selecciona una moneda compatible."]);
    expect(
      messagesOf(accountInputSchema, { name: "A", currency: "ars" }),
    ).toEqual(["Selecciona una moneda compatible."]);
  });

  it("requires a currency", () => {
    expect(messagesOf(accountInputSchema, { name: "A" })).toEqual([
      "La moneda es obligatoria.",
    ]);
  });

  it("refuses an empty name and a name of only spaces", () => {
    expect(
      messagesOf(accountInputSchema, { name: "", currency: "ARS" }),
    ).toEqual(["El nombre es obligatorio."]);
    expect(
      messagesOf(accountInputSchema, { name: "  ", currency: "ARS" }),
    ).toEqual(["El nombre es obligatorio."]);
  });

  it("accepts 40 characters and refuses 41", () => {
    expect(
      messagesOf(accountInputSchema, { name: "a".repeat(40), currency: "ARS" }),
    ).toEqual([]);
    expect(
      messagesOf(accountInputSchema, { name: "a".repeat(41), currency: "ARS" }),
    ).toEqual(["El nombre admite como máximo 40 caracteres."]);
  });

  it("does not take a bank: an edit can never move an account to another bank", () => {
    expect(
      accountInputSchema.parse({
        name: "A",
        currency: "ARS",
        bankId: "bank_2",
      }),
    ).toEqual({ name: "A", currency: "ARS" });
  });
});

describe("createAccountInputSchema", () => {
  it("takes the bank the account is created in", () => {
    expect(
      createAccountInputSchema.parse({
        bankId: " bank_1 ",
        name: "Caja de ahorro",
        currency: "ARS",
      }),
    ).toEqual({ bankId: "bank_1", name: "Caja de ahorro", currency: "ARS" });
  });

  it("requires a bank", () => {
    expect(
      messagesOf(createAccountInputSchema, { name: "A", currency: "ARS" }),
    ).toEqual(["Elegí un banco."]);
    expect(
      messagesOf(createAccountInputSchema, {
        bankId: "  ",
        name: "A",
        currency: "ARS",
      }),
    ).toEqual(["Elegí un banco."]);
  });

  it("strips fields it does not know", () => {
    expect(
      createAccountInputSchema.parse({
        bankId: "bank_1",
        name: "A",
        currency: "ARS",
        userId: "attacker",
        archivedAt: "x",
      }),
    ).toEqual({ bankId: "bank_1", name: "A", currency: "ARS" });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run core/banks/schema.test.ts core/accounts/schema.test.ts`
Expected: FAIL, `Failed to resolve import "./schema"` in both files.

- [ ] **Step 3: Create the declarations.**

`core/banks/consts.ts`

```ts
export const BANKS_PATH = "/dashboard/banks";

// Same limit as the names of the categories.
export const BANK_NAME_MAX_LENGTH = 40;

export const BANK_FORM_FIELDS = ["name"] as const;

export const BANK_NOT_FOUND_MESSAGE = "No se encontró el banco.";
export const DUPLICATE_BANK_MESSAGE = "Ya tenés un banco con este nombre.";
// Said when an account is created in, or brought back under, a bank that is archived.
export const BANK_ARCHIVED_MESSAGE =
  "Este banco está archivado. Reactivalo primero.";

export const bankHasActiveAccountsMessage = (count: number): string =>
  count === 1
    ? "Este banco todavía tiene 1 cuenta activa. Archivala primero."
    : `Este banco todavía tiene ${count} cuentas activas. Archivalas primero.`;
```

`core/banks/types.ts`

```ts
import type { Account } from "@/core/accounts/types";
import type { ActionFailure } from "@/core/entries/actionHelpers";

// Validated bank data.
export interface BankInput {
  name: string;
}

// A bank as the client reads it: no owner, and the archive date as a flag.
export interface Bank extends BankInput {
  id: string;
  archived: boolean;
}

export interface BankWithAccounts extends Bank {
  accounts: Account[];
}

// What the board shows: the text typed in the search field and whether archived items are shown.
export interface BankFilter {
  query: string;
  showArchived: boolean;
}

export type BanksFieldErrors = Record<string, string[]>;

// What every write of the banks page answers (banks and accounts alike).
export type BanksActionResult =
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: BanksFieldErrors };

// A form that was read and validated, or the failure to hand back to the user.
export type ParsedForm<T> = { data: T } | { error: ActionFailure };
```

`core/banks/errors.ts`

```ts
// Kept apart from the service so actions can branch on them (and tests can mock the service)
// without the classes disappearing with it.

// The bank does not exist or is not the user's.
export class BankNotFoundError extends Error {
  constructor() {
    super("Bank not found");
    this.name = "BankNotFoundError";
  }
}

// The user already has a bank with this name (ignoring case).
export class DuplicateBankError extends Error {
  constructor() {
    super("A bank with this name already exists");
    this.name = "DuplicateBankError";
  }
}

// A bank is archived only when all its accounts are.
export class BankHasActiveAccountsError extends Error {
  constructor(readonly count: number) {
    super(`The bank still has ${count} active account(s)`);
    this.name = "BankHasActiveAccountsError";
  }
}

// An account cannot be created in, or brought back under, an archived bank.
export class BankArchivedError extends Error {
  constructor() {
    super("The bank is archived");
    this.name = "BankArchivedError";
  }
}
```

`core/banks/schema.ts`

```ts
import { z } from "zod";

import { requiredText } from "@/core/entries/fields";

import { BANK_NAME_MAX_LENGTH } from "./consts";

// Trimmed, non-empty, at most 40 characters. Fields it does not know (an owner, an archive date)
// are dropped, so they can never reach the database through here.
export const bankInputSchema = z.object({
  name: requiredText("El nombre", BANK_NAME_MAX_LENGTH),
});
```

`core/accounts/consts.ts`

```ts
// Same limit as the names of the categories.
export const ACCOUNT_NAME_MAX_LENGTH = 40;

export const CREATE_ACCOUNT_FORM_FIELDS = [
  "bankId",
  "name",
  "currency",
] as const;
// An edit never moves an account to another bank.
export const UPDATE_ACCOUNT_FORM_FIELDS = ["name", "currency"] as const;

// What a user gets the first time anything needs accounts: a bank for the cash, with one account.
export const DEFAULT_CASH_BANK_NAME = "Efectivo";
export const DEFAULT_CASH_ACCOUNT_NAME = "Efectivo";
export const DEFAULT_CASH_CURRENCY = "ARS";

export const ACCOUNT_NOT_FOUND_MESSAGE = "No se encontró la cuenta.";
export const DUPLICATE_ACCOUNT_MESSAGE =
  "Ya tenés una cuenta con este nombre en este banco.";
export const BANK_REQUIRED_MESSAGE = "Elegí un banco.";
```

`core/accounts/types.ts`

```ts
// Validated account data. The currency is an ISO code the app supports.
export interface AccountInput {
  name: string;
  currency: string;
}

export interface CreateAccountInput extends AccountInput {
  bankId: string;
}

// An account as the client reads it: no owner, and the archive date as a flag.
export interface Account extends AccountInput {
  id: string;
  bankId: string;
  archived: boolean;
}
```

`core/accounts/errors.ts`

```ts
// Kept apart from the service so actions can branch on them (and tests can mock the service)
// without the classes disappearing with it.

// The account does not exist or is not the user's.
export class AccountNotFoundError extends Error {
  constructor() {
    super("Account not found");
    this.name = "AccountNotFoundError";
  }
}

// The bank already has an account with this name (ignoring case).
export class DuplicateAccountError extends Error {
  constructor() {
    super("An account with this name already exists in the bank");
    this.name = "DuplicateAccountError";
  }
}
```

- [ ] **Step 4: Create the schemas.**

`core/accounts/schema.ts`

```ts
import { z } from "zod";

import { currencyField, requiredText } from "@/core/entries/fields";

import { ACCOUNT_NAME_MAX_LENGTH, BANK_REQUIRED_MESSAGE } from "./consts";

// What an account says: the only part of it an edit can change. Fields it does not know (an owner,
// a bank, an archive date) are dropped, so they can never reach the database through here.
export const accountInputSchema = z.object({
  name: requiredText("El nombre", ACCOUNT_NAME_MAX_LENGTH),
  currency: currencyField,
});

// A new account also says which bank it goes to. The service checks that the bank is the user's.
export const createAccountInputSchema = accountInputSchema.extend({
  bankId: z
    .string({ error: BANK_REQUIRED_MESSAGE })
    .trim()
    .min(1, BANK_REQUIRED_MESSAGE),
});
```

- [ ] **Step 5: Run and see them pass**

Run: `npx vitest run core/banks/schema.test.ts core/accounts/schema.test.ts`
Expected: PASS (6 + 10 tests).

- [ ] **Step 6: Verify**

Run: `npx vitest run core/banks core/accounts` then `npx tsc --noEmit` and `npx eslint core/banks core/accounts`
Expected: tests PASS, no type or lint errors.

### Task 4: Bank service

**Files:**

- Test: `core/banks/service.test.ts`
- Create: `core/accounts/mappers.ts`, `core/banks/service.ts`

**Interfaces:**

- Consumes: `prisma` (`@/infrastructure/db/client`), `isUniqueConstraintError` (`@/core/entries/dbErrors`), row types `Bank`, `Account` from `@/lib/generated/prisma/client`, Task 3 types and errors.
- Produces:
  - `core/accounts/mappers.ts`: `toAccount(row: AccountRow): Account`.
  - `core/banks/service.ts`:
    - `listBanksWithAccounts(userId: string): Promise<BankWithAccounts[]>`
    - `createBank(userId: string, input: BankInput): Promise<Bank>`
    - `updateBank(userId: string, id: string, input: BankInput): Promise<void>`
    - `archiveBank(userId: string, id: string): Promise<void>`
    - `unarchiveBank(userId: string, id: string): Promise<void>`
    - Throws `BankNotFoundError`, `DuplicateBankError`, `BankHasActiveAccountsError`.

- [ ] **Step 1: Write the failing test** `core/banks/service.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  bank: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  account: { count: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import {
  BankHasActiveAccountsError,
  BankNotFoundError,
  DuplicateBankError,
} from "./errors";
import {
  archiveBank,
  createBank,
  listBanksWithAccounts,
  unarchiveBank,
  updateBank,
} from "./service";

const { bank, account } = db;

const USER_ID = "user_123";
const AT = new Date("2026-10-04T12:00:00.000Z");

const bankRow = (patch: Record<string, unknown> = {}) => ({
  id: "bank_1",
  userId: USER_ID,
  name: "Banco Galicia",
  archivedAt: null,
  createdAt: AT,
  updatedAt: AT,
  ...patch,
});

const accountRow = (patch: Record<string, unknown> = {}) => ({
  id: "acc_1",
  userId: USER_ID,
  bankId: "bank_1",
  name: "Caja de ahorro",
  currency: "ARS",
  archivedAt: null,
  createdAt: AT,
  updatedAt: AT,
  ...patch,
});

const uniqueViolation = () =>
  Object.assign(new Error("unique"), { code: "P2002" });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listBanksWithAccounts", () => {
  it("reads only the user's banks and accounts, in the order they were added", async () => {
    bank.findMany.mockResolvedValue([]);

    await listBanksWithAccounts(USER_ID);

    expect(bank.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        accounts: {
          where: { userId: USER_ID },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });
  });

  it("returns plain banks and accounts: no owner, the archive date as a flag", async () => {
    bank.findMany.mockResolvedValue([
      {
        ...bankRow(),
        accounts: [
          accountRow(),
          accountRow({ id: "acc_2", name: "Vieja", archivedAt: AT }),
        ],
      },
      {
        ...bankRow({ id: "bank_2", name: "Viejo", archivedAt: AT }),
        accounts: [],
      },
    ]);

    expect(await listBanksWithAccounts(USER_ID)).toEqual([
      {
        id: "bank_1",
        name: "Banco Galicia",
        archived: false,
        accounts: [
          {
            id: "acc_1",
            bankId: "bank_1",
            name: "Caja de ahorro",
            currency: "ARS",
            archived: false,
          },
          {
            id: "acc_2",
            bankId: "bank_1",
            name: "Vieja",
            currency: "ARS",
            archived: true,
          },
        ],
      },
      { id: "bank_2", name: "Viejo", archived: true, accounts: [] },
    ]);
  });
});

describe("createBank", () => {
  it("looks for a clash among the user's banks ignoring case, then creates with an explicit field list", async () => {
    bank.findFirst.mockResolvedValue(null);
    bank.create.mockResolvedValue(bankRow());

    const created = await createBank(USER_ID, { name: "Banco Galicia" });

    expect(bank.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        name: { equals: "Banco Galicia", mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(bank.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, name: "Banco Galicia" },
    });
    expect(created).toEqual({
      id: "bank_1",
      name: "Banco Galicia",
      archived: false,
    });
  });

  it("refuses a name that exists with another casing", async () => {
    bank.findFirst.mockResolvedValue({ id: "bank_9" });

    await expect(
      createBank(USER_ID, { name: "BANCO GALICIA" }),
    ).rejects.toBeInstanceOf(DuplicateBankError);
    expect(bank.create).not.toHaveBeenCalled();
  });

  it("maps the unique constraint (two identical requests at once) to the same error", async () => {
    bank.findFirst.mockResolvedValue(null);
    bank.create.mockRejectedValue(uniqueViolation());

    await expect(
      createBank(USER_ID, { name: "Galicia" }),
    ).rejects.toBeInstanceOf(DuplicateBankError);
  });

  it("lets any other failure through", async () => {
    bank.findFirst.mockResolvedValue(null);
    bank.create.mockRejectedValue(new Error("db down"));

    await expect(createBank(USER_ID, { name: "Galicia" })).rejects.toThrow(
      "db down",
    );
  });
});

describe("updateBank", () => {
  it("renames the user's bank after checking nobody else has that name", async () => {
    bank.findFirst
      .mockResolvedValueOnce({ id: "bank_1" })
      .mockResolvedValueOnce(null);
    bank.updateMany.mockResolvedValue({ count: 1 });

    await updateBank(USER_ID, "bank_1", { name: "Galicia" });

    expect(bank.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: "bank_1", userId: USER_ID },
      select: { id: true },
    });
    expect(bank.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        userId: USER_ID,
        id: { not: "bank_1" },
        name: { equals: "Galicia", mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(bank.updateMany).toHaveBeenCalledWith({
      where: { id: "bank_1", userId: USER_ID },
      data: { name: "Galicia" },
    });
  });

  it("lets a bank take another casing of its own name: the clash lookup leaves the bank itself out", async () => {
    bank.findFirst
      .mockResolvedValueOnce({ id: "bank_1" })
      .mockResolvedValueOnce(null);
    bank.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      updateBank(USER_ID, "bank_1", { name: "banco galicia" }),
    ).resolves.toBeUndefined();
    expect(bank.findFirst.mock.calls[1][0].where.id).toEqual({ not: "bank_1" });
  });

  it("treats another user's bank (or an unknown id) as not found and writes nothing", async () => {
    bank.findFirst.mockResolvedValue(null);

    await expect(
      updateBank(USER_ID, "bank_of_someone_else", { name: "Galicia" }),
    ).rejects.toBeInstanceOf(BankNotFoundError);
    expect(bank.findFirst).toHaveBeenCalledWith({
      where: { id: "bank_of_someone_else", userId: USER_ID },
      select: { id: true },
    });
    expect(bank.updateMany).not.toHaveBeenCalled();
  });

  it("refuses the name of another bank of the user", async () => {
    bank.findFirst
      .mockResolvedValueOnce({ id: "bank_1" })
      .mockResolvedValueOnce({ id: "bank_2" });

    await expect(
      updateBank(USER_ID, "bank_1", { name: "Mercado Pago" }),
    ).rejects.toBeInstanceOf(DuplicateBankError);
    expect(bank.updateMany).not.toHaveBeenCalled();
  });

  it("maps the unique constraint to the same error", async () => {
    bank.findFirst
      .mockResolvedValueOnce({ id: "bank_1" })
      .mockResolvedValueOnce(null);
    bank.updateMany.mockRejectedValue(uniqueViolation());

    await expect(
      updateBank(USER_ID, "bank_1", { name: "Galicia" }),
    ).rejects.toBeInstanceOf(DuplicateBankError);
  });

  it("is not found when the bank disappears before the write", async () => {
    bank.findFirst
      .mockResolvedValueOnce({ id: "bank_1" })
      .mockResolvedValueOnce(null);
    bank.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateBank(USER_ID, "bank_1", { name: "Galicia" }),
    ).rejects.toBeInstanceOf(BankNotFoundError);
  });
});

describe("archiveBank", () => {
  it("archives in one statement that carries the rule: only an active bank without active accounts", async () => {
    bank.updateMany.mockResolvedValue({ count: 1 });

    await expect(archiveBank(USER_ID, "bank_1")).resolves.toBeUndefined();

    expect(bank.updateMany).toHaveBeenCalledWith({
      where: {
        id: "bank_1",
        userId: USER_ID,
        archivedAt: null,
        accounts: { none: { archivedAt: null } },
      },
      data: { archivedAt: expect.any(Date) },
    });
    expect(bank.findFirst).not.toHaveBeenCalled();
  });

  it("refuses a bank that still has active accounts and says how many", async () => {
    bank.updateMany.mockResolvedValue({ count: 0 });
    bank.findFirst.mockResolvedValue({ id: "bank_1", archivedAt: null });
    account.count.mockResolvedValue(2);

    await expect(archiveBank(USER_ID, "bank_1")).rejects.toMatchObject({
      name: "BankHasActiveAccountsError",
      count: 2,
    });
    expect(account.count).toHaveBeenCalledWith({
      where: { bankId: "bank_1", userId: USER_ID, archivedAt: null },
    });
  });

  it("treats another user's bank (or an unknown id) as not found", async () => {
    bank.updateMany.mockResolvedValue({ count: 0 });
    bank.findFirst.mockResolvedValue(null);

    await expect(
      archiveBank(USER_ID, "bank_of_someone_else"),
    ).rejects.toBeInstanceOf(BankNotFoundError);
    expect(bank.updateMany.mock.calls[0][0].where.userId).toBe(USER_ID);
    expect(bank.findFirst).toHaveBeenCalledWith({
      where: { id: "bank_of_someone_else", userId: USER_ID },
      select: { id: true, archivedAt: true },
    });
    expect(account.count).not.toHaveBeenCalled();
  });

  it("does nothing, without failing, for a bank that is already archived", async () => {
    bank.updateMany.mockResolvedValue({ count: 0 });
    bank.findFirst.mockResolvedValue({ id: "bank_1", archivedAt: AT });

    await expect(archiveBank(USER_ID, "bank_1")).resolves.toBeUndefined();
    expect(account.count).not.toHaveBeenCalled();
  });
});

describe("unarchiveBank", () => {
  it("brings back the user's archived bank; its accounts stay archived", async () => {
    bank.updateMany.mockResolvedValue({ count: 1 });

    await expect(unarchiveBank(USER_ID, "bank_1")).resolves.toBeUndefined();

    expect(bank.updateMany).toHaveBeenCalledWith({
      where: { id: "bank_1", userId: USER_ID, archivedAt: { not: null } },
      data: { archivedAt: null },
    });
  });

  it("treats another user's bank (or an unknown id) as not found", async () => {
    bank.updateMany.mockResolvedValue({ count: 0 });
    bank.findFirst.mockResolvedValue(null);

    await expect(
      unarchiveBank(USER_ID, "bank_of_someone_else"),
    ).rejects.toBeInstanceOf(BankNotFoundError);
    expect(bank.findFirst).toHaveBeenCalledWith({
      where: { id: "bank_of_someone_else", userId: USER_ID },
      select: { id: true },
    });
  });

  it("does nothing, without failing, for a bank that is already active", async () => {
    bank.updateMany.mockResolvedValue({ count: 0 });
    bank.findFirst.mockResolvedValue({ id: "bank_1" });

    await expect(unarchiveBank(USER_ID, "bank_1")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run core/banks/service.test.ts`
Expected: FAIL, `Failed to resolve import "./service"`.

- [ ] **Step 3: Implement.** `core/accounts/mappers.ts`

```ts
import type { Account as AccountRow } from "@/lib/generated/prisma/client";

import type { Account } from "./types";

// The row as the client reads it: no owner, and the archive date as a flag.
export const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  bankId: row.bankId,
  name: row.name,
  currency: row.currency,
  archived: row.archivedAt !== null,
});
```

`core/banks/service.ts`

```ts
import { toAccount } from "@/core/accounts/mappers";
import { isUniqueConstraintError } from "@/core/entries/dbErrors";
import { prisma } from "@/infrastructure/db/client";
import type { Bank as BankRow } from "@/lib/generated/prisma/client";

import {
  BankHasActiveAccountsError,
  BankNotFoundError,
  DuplicateBankError,
} from "./errors";
import type { Bank, BankInput, BankWithAccounts } from "./types";

// The order every read uses, so a tie between two rows is always broken the same way.
const CREATION_ORDER = [{ createdAt: "asc" as const }, { id: "asc" as const }];

const toBank = (row: BankRow): Bank => ({
  id: row.id,
  name: row.name,
  archived: row.archivedAt !== null,
});

// The user's banks with their accounts, archived ones included (the board decides what to show).
// Every read is scoped by userId, so one user can never see another user's banks.
export const listBanksWithAccounts = async (
  userId: string,
): Promise<BankWithAccounts[]> => {
  const rows = await prisma.bank.findMany({
    where: { userId },
    orderBy: CREATION_ORDER,
    include: { accounts: { where: { userId }, orderBy: CREATION_ORDER } },
  });

  return rows.map((row) => ({
    ...toBank(row),
    accounts: row.accounts.map(toAccount),
  }));
};

// Names are unique per user, ignoring case ("galicia" clashes with "Galicia"). The constraint is
// case-sensitive, so the lookup does the case-insensitive part and the constraint catches a race.
export const createBank = async (
  userId: string,
  input: BankInput,
): Promise<Bank> => {
  const duplicate = await prisma.bank.findFirst({
    where: { userId, name: { equals: input.name, mode: "insensitive" } },
    select: { id: true },
  });

  if (duplicate) {
    throw new DuplicateBankError();
  }

  try {
    // Explicit field list: the owner and the id can never be overridden by the payload.
    const row = await prisma.bank.create({
      data: { userId, name: input.name },
    });

    return toBank(row);
  } catch (error) {
    // Two identical requests can both pass the check above; the constraint catches the second.
    if (isUniqueConstraintError(error)) {
      throw new DuplicateBankError();
    }

    throw error;
  }
};

// Renaming to another casing of its own name is fine; clashing with a different bank (ignoring
// case) is not.
export const updateBank = async (
  userId: string,
  id: string,
  input: BankInput,
): Promise<void> => {
  const current = await prisma.bank.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!current) {
    throw new BankNotFoundError();
  }

  const duplicate = await prisma.bank.findFirst({
    where: {
      userId,
      id: { not: id },
      name: { equals: input.name, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new DuplicateBankError();
  }

  try {
    const { count } = await prisma.bank.updateMany({
      where: { id, userId },
      data: { name: input.name },
    });

    if (count === 0) {
      throw new BankNotFoundError();
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateBankError();
    }

    throw error;
  }
};

// A bank is archived only when all its accounts are. The rule is part of the update statement
// itself, so an account reactivated while this runs cannot slip past it. Archiving an archived
// bank is not an error.
export const archiveBank = async (
  userId: string,
  id: string,
): Promise<void> => {
  const { count } = await prisma.bank.updateMany({
    where: {
      id,
      userId,
      archivedAt: null,
      accounts: { none: { archivedAt: null } },
    },
    data: { archivedAt: new Date() },
  });

  if (count > 0) {
    return;
  }

  // Nothing was archived: say why.
  const found = await prisma.bank.findFirst({
    where: { id, userId },
    select: { id: true, archivedAt: true },
  });

  if (!found) {
    throw new BankNotFoundError();
  }

  if (found.archivedAt !== null) {
    return;
  }

  const active = await prisma.account.count({
    where: { bankId: id, userId, archivedAt: null },
  });

  throw new BankHasActiveAccountsError(active);
};

// Brings the bank back. Its accounts stay archived: the user reactivates the ones they want.
export const unarchiveBank = async (
  userId: string,
  id: string,
): Promise<void> => {
  const { count } = await prisma.bank.updateMany({
    where: { id, userId, archivedAt: { not: null } },
    data: { archivedAt: null },
  });

  if (count > 0) {
    return;
  }

  const found = await prisma.bank.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!found) {
    throw new BankNotFoundError();
  }
};
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run core/banks/service.test.ts`
Expected: PASS (19 tests).

- [ ] **Step 5: Verify**

Run: `npx vitest run core/banks core/accounts` then `npx tsc --noEmit` and `npx eslint core/banks core/accounts`
Expected: tests PASS, no type or lint errors.

### Task 5: Account service

**Files:**

- Test: `core/accounts/service.test.ts`
- Create: `core/accounts/service.ts`

**Interfaces:**

- Consumes: `prisma`, `isUniqueConstraintError`, `toAccount` (Task 4), `BankNotFoundError` and `BankArchivedError` (`@/core/banks/errors`), `AccountNotFoundError`, `DuplicateAccountError`, types from Task 3.
- Produces in `core/accounts/service.ts`:
  - `createAccount(userId: string, input: CreateAccountInput): Promise<Account>`
  - `updateAccount(userId: string, id: string, input: AccountInput): Promise<void>` (name and currency; the currency stays editable in stage 1)
  - `archiveAccount(userId: string, id: string): Promise<void>`
  - `unarchiveAccount(userId: string, id: string): Promise<void>`
  - Throws `BankNotFoundError`, `BankArchivedError`, `AccountNotFoundError`, `DuplicateAccountError`.

- [ ] **Step 1: Write the failing test** `core/accounts/service.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  bank: { findFirst: vi.fn() },
  account: {
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { BankArchivedError, BankNotFoundError } from "@/core/banks/errors";

import { AccountNotFoundError, DuplicateAccountError } from "./errors";
import {
  archiveAccount,
  createAccount,
  unarchiveAccount,
  updateAccount,
} from "./service";

const { bank, account } = db;

const USER_ID = "user_123";
const AT = new Date("2026-10-04T12:00:00.000Z");

const accountRow = (patch: Record<string, unknown> = {}) => ({
  id: "acc_1",
  userId: USER_ID,
  bankId: "bank_1",
  name: "Caja de ahorro",
  currency: "ARS",
  archivedAt: null,
  createdAt: AT,
  updatedAt: AT,
  ...patch,
});

const uniqueViolation = () =>
  Object.assign(new Error("unique"), { code: "P2002" });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createAccount", () => {
  const input = { bankId: "bank_1", name: "Caja de ahorro", currency: "ARS" };

  beforeEach(() => {
    bank.findFirst.mockResolvedValue({ id: "bank_1", archivedAt: null });
    account.findFirst.mockResolvedValue(null);
    account.create.mockResolvedValue(accountRow());
  });

  it("checks the bank is the user's, looks for a clash inside that bank ignoring case, then creates", async () => {
    const created = await createAccount(USER_ID, input);

    expect(bank.findFirst).toHaveBeenCalledWith({
      where: { id: "bank_1", userId: USER_ID },
      select: { id: true, archivedAt: true },
    });
    expect(account.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        bankId: "bank_1",
        name: { equals: "Caja de ahorro", mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(account.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        bankId: "bank_1",
        name: "Caja de ahorro",
        currency: "ARS",
      },
    });
    expect(created).toEqual({
      id: "acc_1",
      bankId: "bank_1",
      name: "Caja de ahorro",
      currency: "ARS",
      archived: false,
    });
  });

  it("allows the same name in another bank: the clash lookup is scoped to the chosen bank", async () => {
    bank.findFirst.mockResolvedValue({ id: "bank_2", archivedAt: null });
    account.create.mockResolvedValue(
      accountRow({ id: "acc_9", bankId: "bank_2" }),
    );

    await createAccount(USER_ID, {
      ...input,
      bankId: "bank_2",
      name: "Efectivo",
    });

    expect(account.findFirst.mock.calls[0][0].where).toEqual({
      userId: USER_ID,
      bankId: "bank_2",
      name: { equals: "Efectivo", mode: "insensitive" },
    });
    expect(account.create).toHaveBeenCalledTimes(1);
  });

  it("treats another user's bank (or an unknown id) as not found and creates nothing", async () => {
    bank.findFirst.mockResolvedValue(null);

    await expect(
      createAccount(USER_ID, { ...input, bankId: "bank_of_someone_else" }),
    ).rejects.toBeInstanceOf(BankNotFoundError);
    expect(bank.findFirst).toHaveBeenCalledWith({
      where: { id: "bank_of_someone_else", userId: USER_ID },
      select: { id: true, archivedAt: true },
    });
    expect(account.create).not.toHaveBeenCalled();
  });

  it("refuses an archived bank", async () => {
    bank.findFirst.mockResolvedValue({ id: "bank_1", archivedAt: AT });

    await expect(createAccount(USER_ID, input)).rejects.toBeInstanceOf(
      BankArchivedError,
    );
    expect(account.create).not.toHaveBeenCalled();
  });

  it("refuses a name the bank already has with another casing", async () => {
    account.findFirst.mockResolvedValue({ id: "acc_9" });

    await expect(
      createAccount(USER_ID, { ...input, name: "CAJA DE AHORRO" }),
    ).rejects.toBeInstanceOf(DuplicateAccountError);
    expect(account.create).not.toHaveBeenCalled();
  });

  it("maps the unique constraint (two identical requests at once) to the same error", async () => {
    account.create.mockRejectedValue(uniqueViolation());

    await expect(createAccount(USER_ID, input)).rejects.toBeInstanceOf(
      DuplicateAccountError,
    );
  });

  it("lets any other failure through", async () => {
    account.create.mockRejectedValue(new Error("db down"));

    await expect(createAccount(USER_ID, input)).rejects.toThrow("db down");
  });

  it("writes an explicit field list: the owner and the archive date never come from the payload", async () => {
    await createAccount(USER_ID, {
      ...input,
      userId: "attacker",
      archivedAt: new Date(),
    } as never);

    expect(account.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        bankId: "bank_1",
        name: "Caja de ahorro",
        currency: "ARS",
      },
    });
  });
});

describe("updateAccount", () => {
  it("changes the name and the currency of the user's account after checking the rest of its bank", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);
    account.updateMany.mockResolvedValue({ count: 1 });

    await updateAccount(USER_ID, "acc_1", { name: "Ahorros", currency: "USD" });

    expect(account.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: "acc_1", userId: USER_ID },
      select: { id: true, bankId: true },
    });
    expect(account.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        userId: USER_ID,
        bankId: "bank_1",
        id: { not: "acc_1" },
        name: { equals: "Ahorros", mode: "insensitive" },
      },
      select: { id: true },
    });
    // The currency stays editable in stage 1: there are no movements to protect yet.
    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      data: { name: "Ahorros", currency: "USD" },
    });
  });

  it("lets an account take another casing of its own name: the clash lookup leaves the account itself out", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);
    account.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      updateAccount(USER_ID, "acc_1", {
        name: "caja de ahorro",
        currency: "ARS",
      }),
    ).resolves.toBeUndefined();
    expect(account.findFirst.mock.calls[1][0].where.id).toEqual({
      not: "acc_1",
    });
  });

  it("treats another user's account (or an unknown id) as not found and writes nothing", async () => {
    account.findFirst.mockResolvedValue(null);

    await expect(
      updateAccount(USER_ID, "acc_of_someone_else", {
        name: "A",
        currency: "ARS",
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(account.findFirst).toHaveBeenCalledWith({
      where: { id: "acc_of_someone_else", userId: USER_ID },
      select: { id: true, bankId: true },
    });
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("refuses the name of another account of the same bank", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce({ id: "acc_2" });

    await expect(
      updateAccount(USER_ID, "acc_1", {
        name: "Cuenta en dólares",
        currency: "ARS",
      }),
    ).rejects.toBeInstanceOf(DuplicateAccountError);
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("maps the unique constraint to the same error", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);
    account.updateMany.mockRejectedValue(uniqueViolation());

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "A", currency: "ARS" }),
    ).rejects.toBeInstanceOf(DuplicateAccountError);
  });

  it("is not found when the account disappears before the write", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);
    account.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "A", currency: "ARS" }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });
});

describe("archiveAccount", () => {
  it("archives the user's active account", async () => {
    account.updateMany.mockResolvedValue({ count: 1 });

    await expect(archiveAccount(USER_ID, "acc_1")).resolves.toBeUndefined();

    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID, archivedAt: null },
      data: { archivedAt: expect.any(Date) },
    });
    expect(account.findFirst).not.toHaveBeenCalled();
  });

  it("treats another user's account (or an unknown id) as not found", async () => {
    account.updateMany.mockResolvedValue({ count: 0 });
    account.findFirst.mockResolvedValue(null);

    await expect(
      archiveAccount(USER_ID, "acc_of_someone_else"),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(account.findFirst).toHaveBeenCalledWith({
      where: { id: "acc_of_someone_else", userId: USER_ID },
      select: { id: true },
    });
  });

  it("does nothing, without failing, for an account that is already archived", async () => {
    account.updateMany.mockResolvedValue({ count: 0 });
    account.findFirst.mockResolvedValue({ id: "acc_1" });

    await expect(archiveAccount(USER_ID, "acc_1")).resolves.toBeUndefined();
  });
});

describe("unarchiveAccount", () => {
  it("brings back an archived account whose bank is active, in one statement that carries the rule", async () => {
    account.updateMany.mockResolvedValue({ count: 1 });

    await expect(unarchiveAccount(USER_ID, "acc_1")).resolves.toBeUndefined();

    expect(account.updateMany).toHaveBeenCalledWith({
      where: {
        id: "acc_1",
        userId: USER_ID,
        archivedAt: { not: null },
        bank: { archivedAt: null },
      },
      data: { archivedAt: null },
    });
  });

  it("refuses to bring an account back under an archived bank", async () => {
    account.updateMany.mockResolvedValue({ count: 0 });
    account.findFirst.mockResolvedValue({
      archivedAt: AT,
      bank: { archivedAt: AT },
    });

    await expect(unarchiveAccount(USER_ID, "acc_1")).rejects.toBeInstanceOf(
      BankArchivedError,
    );
    expect(account.findFirst).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      select: { archivedAt: true, bank: { select: { archivedAt: true } } },
    });
  });

  it("treats another user's account (or an unknown id) as not found", async () => {
    account.updateMany.mockResolvedValue({ count: 0 });
    account.findFirst.mockResolvedValue(null);

    await expect(
      unarchiveAccount(USER_ID, "acc_of_someone_else"),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it("does nothing, without failing, for an account that is already active", async () => {
    account.updateMany.mockResolvedValue({ count: 0 });
    account.findFirst.mockResolvedValue({
      archivedAt: null,
      bank: { archivedAt: null },
    });

    await expect(unarchiveAccount(USER_ID, "acc_1")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run core/accounts/service.test.ts`
Expected: FAIL, `Failed to resolve import "./service"`.

- [ ] **Step 3: Implement** `core/accounts/service.ts`

```ts
import { BankArchivedError, BankNotFoundError } from "@/core/banks/errors";
import { isUniqueConstraintError } from "@/core/entries/dbErrors";
import { prisma } from "@/infrastructure/db/client";

import { AccountNotFoundError, DuplicateAccountError } from "./errors";
import { toAccount } from "./mappers";
import type { Account, AccountInput, CreateAccountInput } from "./types";

// Names are unique per bank, ignoring case: "Efectivo" may exist in two banks, never twice in one.
// A bank id that comes from the client is never trusted: it must be the user's and it must be
// active. (An archive that lands between this check and the insert is not guarded: it would leave
// one active account under a bank archived a moment earlier, which the user can fix by archiving
// the account.)
export const createAccount = async (
  userId: string,
  input: CreateAccountInput,
): Promise<Account> => {
  const bank = await prisma.bank.findFirst({
    where: { id: input.bankId, userId },
    select: { id: true, archivedAt: true },
  });

  if (!bank) {
    throw new BankNotFoundError();
  }

  if (bank.archivedAt !== null) {
    throw new BankArchivedError();
  }

  const duplicate = await prisma.account.findFirst({
    where: {
      userId,
      bankId: bank.id,
      name: { equals: input.name, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new DuplicateAccountError();
  }

  try {
    // Explicit field list: the owner, the id and the archive date can never be overridden by the
    // payload.
    const row = await prisma.account.create({
      data: {
        userId,
        bankId: bank.id,
        name: input.name,
        currency: input.currency,
      },
    });

    return toAccount(row);
  } catch (error) {
    // Two identical requests can both pass the check above; the constraint catches the second.
    if (isUniqueConstraintError(error)) {
      throw new DuplicateAccountError();
    }

    throw error;
  }
};

// Changes the name and the currency. The currency stays editable in stage 1: nothing carries an
// account yet, so there are no movements to protect. Renaming to another casing of its own name is
// fine; clashing with another account of the same bank (ignoring case) is not.
export const updateAccount = async (
  userId: string,
  id: string,
  input: AccountInput,
): Promise<void> => {
  const current = await prisma.account.findFirst({
    where: { id, userId },
    select: { id: true, bankId: true },
  });

  if (!current) {
    throw new AccountNotFoundError();
  }

  const duplicate = await prisma.account.findFirst({
    where: {
      userId,
      bankId: current.bankId,
      id: { not: id },
      name: { equals: input.name, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new DuplicateAccountError();
  }

  try {
    const { count } = await prisma.account.updateMany({
      where: { id, userId },
      data: { name: input.name, currency: input.currency },
    });

    if (count === 0) {
      throw new AccountNotFoundError();
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateAccountError();
    }

    throw error;
  }
};

// Archiving an archived account is not an error.
export const archiveAccount = async (
  userId: string,
  id: string,
): Promise<void> => {
  const { count } = await prisma.account.updateMany({
    where: { id, userId, archivedAt: null },
    data: { archivedAt: new Date() },
  });

  if (count > 0) {
    return;
  }

  const found = await prisma.account.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!found) {
    throw new AccountNotFoundError();
  }
};

// An account is brought back only under an active bank. The rule is part of the update statement
// itself, so a bank archived while this runs cannot end up holding an active account. Reactivating
// an active account is not an error.
export const unarchiveAccount = async (
  userId: string,
  id: string,
): Promise<void> => {
  const { count } = await prisma.account.updateMany({
    where: {
      id,
      userId,
      archivedAt: { not: null },
      bank: { archivedAt: null },
    },
    data: { archivedAt: null },
  });

  if (count > 0) {
    return;
  }

  const found = await prisma.account.findFirst({
    where: { id, userId },
    select: { archivedAt: true, bank: { select: { archivedAt: true } } },
  });

  if (!found) {
    throw new AccountNotFoundError();
  }

  if (found.archivedAt === null) {
    return;
  }

  throw new BankArchivedError();
};
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run core/accounts/service.test.ts`
Expected: PASS (21 tests).

- [ ] **Step 5: Verify**

Run: `npx vitest run core/banks core/accounts` then `npx tsc --noEmit` and `npx eslint core/banks core/accounts`
Expected: tests PASS, no type or lint errors.

### Task 6: `ensureDefaultCash(userId)`

The first time anything needs accounts, the user gets a bank "Efectivo" with an account "Efectivo" in ARS. It is idempotent and safe under races (the unique constraints decide, `createMany` + `skipDuplicates` like the category seeding). It seeds only a user who has no banks at all, so a user who renamed or archived "Efectivo" never gets a second one back.

**Files:**

- Test: `core/accounts/defaultCash.test.ts`
- Create: `core/accounts/defaultCash.ts`

**Interfaces:**

- Consumes: `prisma`, `DEFAULT_CASH_BANK_NAME`, `DEFAULT_CASH_ACCOUNT_NAME`, `DEFAULT_CASH_CURRENCY` (Task 3).
- Produces: `ensureDefaultCash(userId: string): Promise<void>` in `core/accounts/defaultCash.ts`.

- [ ] **Step 1: Write the failing test** `core/accounts/defaultCash.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are observed
  // on the same mocks.
  $transaction: vi.fn(),
  bank: { count: vi.fn(), createMany: vi.fn(), findFirst: vi.fn() },
  account: { createMany: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { ensureDefaultCash } from "./defaultCash";

const { bank, account } = db;

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  bank.count.mockResolvedValue(0);
  bank.createMany.mockResolvedValue({ count: 1 });
  bank.findFirst.mockResolvedValue({ id: "bank_cash" });
  account.createMany.mockResolvedValue({ count: 1 });
});

describe("ensureDefaultCash", () => {
  it("creates the bank 'Efectivo' with an account 'Efectivo' in ARS, in one transaction", async () => {
    await ensureDefaultCash(USER_ID);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(bank.createMany).toHaveBeenCalledWith({
      data: [{ userId: USER_ID, name: "Efectivo" }],
      skipDuplicates: true,
    });
    expect(bank.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, name: "Efectivo" },
      select: { id: true },
    });
    expect(account.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: USER_ID,
          bankId: "bank_cash",
          name: "Efectivo",
          currency: "ARS",
        },
      ],
      skipDuplicates: true,
    });
  });

  it("only looks at the banks of the user", async () => {
    await ensureDefaultCash(USER_ID);

    expect(bank.count).toHaveBeenCalledWith({ where: { userId: USER_ID } });
  });

  it("does nothing for a user who already has a bank: a renamed or archived 'Efectivo' is never brought back", async () => {
    bank.count.mockResolvedValue(1);

    await ensureDefaultCash(USER_ID);

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(bank.createMany).not.toHaveBeenCalled();
    expect(account.createMany).not.toHaveBeenCalled();
  });

  it("is safe when two requests race: the constraint swallows the second insert and neither fails", async () => {
    bank.createMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    account.createMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(
      Promise.all([ensureDefaultCash(USER_ID), ensureDefaultCash(USER_ID)]),
    ).resolves.toEqual([undefined, undefined]);

    // Both inserts skip duplicates: a plain create would throw on the unique constraint (and the
    // mock has no `create`, so it would fail here).
    expect(bank.createMany).toHaveBeenCalledTimes(2);
    expect(
      bank.createMany.mock.calls.every(([arg]) => arg.skipDuplicates),
    ).toBe(true);
    expect(account.createMany).toHaveBeenCalledTimes(2);
    expect(
      account.createMany.mock.calls.every(([arg]) => arg.skipDuplicates),
    ).toBe(true);
  });

  it("is idempotent: calling it again after the seed (the bank now exists) writes nothing", async () => {
    await ensureDefaultCash(USER_ID);
    bank.count.mockResolvedValue(1);
    bank.createMany.mockClear();
    account.createMany.mockClear();

    await ensureDefaultCash(USER_ID);

    expect(bank.createMany).not.toHaveBeenCalled();
    expect(account.createMany).not.toHaveBeenCalled();
  });

  it("fails loudly when the bank cannot be read back, so no account is created without a bank", async () => {
    bank.findFirst.mockResolvedValue(null);

    await expect(ensureDefaultCash(USER_ID)).rejects.toThrow(
      "The default cash bank could not be read back",
    );
    expect(account.createMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run core/accounts/defaultCash.test.ts`
Expected: FAIL, `Failed to resolve import "./defaultCash"`.

- [ ] **Step 3: Implement** `core/accounts/defaultCash.ts`

```ts
import { prisma } from "@/infrastructure/db/client";

import {
  DEFAULT_CASH_ACCOUNT_NAME,
  DEFAULT_CASH_BANK_NAME,
  DEFAULT_CASH_CURRENCY,
} from "./consts";

// A user with no banks at all gets a bank "Efectivo" with an account "Efectivo" in ARS. Both
// inserts are createMany + skipDuplicates (ON CONFLICT DO NOTHING), so the seeding is idempotent and
// safe when two requests race: the unique constraints decide, and the second request simply finds
// what the first one wrote. It runs in one transaction, so a failure never leaves a bank without
// its account. A user who already has any bank (even a renamed or archived default) is left alone.
export const ensureDefaultCash = async (userId: string): Promise<void> => {
  const existing = await prisma.bank.count({ where: { userId } });

  if (existing > 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.bank.createMany({
      data: [{ userId, name: DEFAULT_CASH_BANK_NAME }],
      skipDuplicates: true,
    });

    const bank = await tx.bank.findFirst({
      where: { userId, name: DEFAULT_CASH_BANK_NAME },
      select: { id: true },
    });

    if (!bank) {
      throw new Error("The default cash bank could not be read back");
    }

    await tx.account.createMany({
      data: [
        {
          userId,
          bankId: bank.id,
          name: DEFAULT_CASH_ACCOUNT_NAME,
          currency: DEFAULT_CASH_CURRENCY,
        },
      ],
      skipDuplicates: true,
    });
  });
};
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run core/accounts/defaultCash.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Verify**

Run: `npx vitest run core/banks core/accounts` then `npx tsc --noEmit` and `npx eslint core/banks core/accounts`
Expected: tests PASS, no type or lint errors.

### Task 7: Board filtering (search and archived toggle), pure

**Files:**

- Test: `core/banks/board.test.ts`
- Create: `core/banks/board.ts`

**Interfaces:**

- Consumes: `BankWithAccounts`, `Bank`, `BankFilter` (Task 3).
- Produces in `core/banks/board.ts`:
  - `normalizeSearch(text: string): string` (trim, lower case, accents removed)
  - `filterBanks(banks: readonly BankWithAccounts[], filter: BankFilter): BankWithAccounts[]`
  - `countActiveAccounts(bank: BankWithAccounts): number`
  - `activeBanks(banks: readonly BankWithAccounts[]): Bank[]`

Rules: archived banks and archived accounts are hidden unless `showArchived`. A bank stays when its own name matches (then it keeps all its visible accounts) or when any visible account matches (then it keeps only the matching ones). A match is on the name only, case- and accent-insensitive, trimmed. An archived account that is hidden never makes its bank appear.

- [ ] **Step 1: Write the failing test** `core/banks/board.test.ts`

```ts
import { describe, expect, it } from "vitest";

import type { Account } from "@/core/accounts/types";

import {
  activeBanks,
  countActiveAccounts,
  filterBanks,
  normalizeSearch,
} from "./board";
import type { BankWithAccounts } from "./types";

const account = (
  id: string,
  bankId: string,
  name: string,
  patch: Partial<Account> = {},
): Account => ({
  id,
  bankId,
  name,
  currency: "ARS",
  archived: false,
  ...patch,
});

const BANKS: BankWithAccounts[] = [
  {
    id: "cash",
    name: "Efectivo",
    archived: false,
    accounts: [account("cash_ars", "cash", "Efectivo")],
  },
  {
    id: "galicia",
    name: "Banco Galicia",
    archived: false,
    accounts: [
      account("gal_sav", "galicia", "Caja de ahorro"),
      account("gal_usd", "galicia", "Cuenta en dólares", { currency: "USD" }),
      account("gal_old", "galicia", "Cuenta vieja", { archived: true }),
    ],
  },
  {
    id: "old",
    name: "Banco Viejo",
    archived: true,
    accounts: [account("old_acc", "old", "Caja cerrada", { archived: true })],
  },
];

const idsOf = (banks: BankWithAccounts[]) => banks.map((bank) => bank.id);
const accountIdsOf = (banks: BankWithAccounts[], bankId: string) =>
  banks.find((bank) => bank.id === bankId)?.accounts.map((item) => item.id);

describe("normalizeSearch", () => {
  it("trims, lowers the case and drops accents", () => {
    expect(normalizeSearch("  Cuenta en DÓLARES ")).toBe("cuenta en dolares");
  });
});

describe("filterBanks without a query", () => {
  it("hides archived banks and archived accounts", () => {
    const result = filterBanks(BANKS, { query: "", showArchived: false });

    expect(idsOf(result)).toEqual(["cash", "galicia"]);
    expect(accountIdsOf(result, "galicia")).toEqual(["gal_sav", "gal_usd"]);
  });

  it("shows them all when archived items are shown, in the order they came", () => {
    const result = filterBanks(BANKS, { query: "", showArchived: true });

    expect(idsOf(result)).toEqual(["cash", "galicia", "old"]);
    expect(accountIdsOf(result, "galicia")).toEqual([
      "gal_sav",
      "gal_usd",
      "gal_old",
    ]);
  });

  it("treats a query of only spaces as no query", () => {
    expect(
      idsOf(filterBanks(BANKS, { query: "   ", showArchived: false })),
    ).toEqual(["cash", "galicia"]);
  });

  it("does not change the list it is given", () => {
    const before = JSON.stringify(BANKS);

    filterBanks(BANKS, { query: "galicia", showArchived: true });

    expect(JSON.stringify(BANKS)).toBe(before);
  });
});

describe("filterBanks with a query", () => {
  it("keeps a bank whose own name matches, with all its visible accounts", () => {
    const result = filterBanks(BANKS, {
      query: "galicia",
      showArchived: false,
    });

    expect(idsOf(result)).toEqual(["galicia"]);
    expect(accountIdsOf(result, "galicia")).toEqual(["gal_sav", "gal_usd"]);
  });

  it("keeps a bank when only one of its accounts matches, showing just the matching accounts", () => {
    const result = filterBanks(BANKS, { query: "ahorro", showArchived: false });

    expect(idsOf(result)).toEqual(["galicia"]);
    expect(accountIdsOf(result, "galicia")).toEqual(["gal_sav"]);
  });

  it("ignores case, accents and surrounding spaces", () => {
    const result = filterBanks(BANKS, {
      query: "  DOLARES ",
      showArchived: false,
    });

    expect(idsOf(result)).toEqual(["galicia"]);
    expect(accountIdsOf(result, "galicia")).toEqual(["gal_usd"]);
  });

  it("does not let an archived account that is hidden make its bank appear", () => {
    const hidden = filterBanks(BANKS, { query: "vieja", showArchived: false });

    expect(hidden).toEqual([]);
  });

  it("lets that archived account match once archived items are shown", () => {
    const shown = filterBanks(BANKS, { query: "vieja", showArchived: true });

    expect(idsOf(shown)).toEqual(["galicia"]);
    expect(accountIdsOf(shown, "galicia")).toEqual(["gal_old"]);
  });

  it("does not show an archived bank, found by its name or by its account, while archived items are hidden", () => {
    expect(filterBanks(BANKS, { query: "viejo", showArchived: false })).toEqual(
      [],
    );
    expect(
      filterBanks(BANKS, { query: "cerrada", showArchived: false }),
    ).toEqual([]);
  });

  it("finds an archived bank by its name or its account once archived items are shown", () => {
    expect(
      idsOf(filterBanks(BANKS, { query: "viejo", showArchived: true })),
    ).toEqual(["old"]);
    expect(
      idsOf(filterBanks(BANKS, { query: "cerrada", showArchived: true })),
    ).toEqual(["old"]);
  });

  it("matches names only, not currencies", () => {
    expect(filterBanks(BANKS, { query: "USD", showArchived: false })).toEqual(
      [],
    );
  });

  it("returns nothing when nothing matches", () => {
    expect(filterBanks(BANKS, { query: "zzz", showArchived: true })).toEqual(
      [],
    );
  });
});

describe("countActiveAccounts", () => {
  it("counts the accounts that are not archived", () => {
    expect(countActiveAccounts(BANKS[1])).toBe(2);
    expect(countActiveAccounts(BANKS[2])).toBe(0);
  });
});

describe("activeBanks", () => {
  it("lists the banks that are not archived as plain banks, without their accounts", () => {
    expect(activeBanks(BANKS)).toEqual([
      { id: "cash", name: "Efectivo", archived: false },
      { id: "galicia", name: "Banco Galicia", archived: false },
    ]);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run core/banks/board.test.ts`
Expected: FAIL, `Failed to resolve import "./board"`.

- [ ] **Step 3: Implement** `core/banks/board.ts`

```ts
import type { Bank, BankFilter, BankWithAccounts } from "./types";

// What the search compares: lower case, without accents, without surrounding spaces, so "DOLARES"
// finds "Cuenta en dólares".
export const normalizeSearch = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// The rows the board shows. Archived banks and archived accounts are hidden unless `showArchived`;
// what is hidden never takes part in the search, so a query that only matches a hidden archived
// account does not bring its bank back. A bank stays when its own name matches (with all its visible
// accounts) or when any of its visible accounts matches (with only the matching ones). The search
// compares names only. The input is never changed.
export const filterBanks = (
  banks: readonly BankWithAccounts[],
  { query, showArchived }: BankFilter,
): BankWithAccounts[] => {
  const needle = normalizeSearch(query);
  const matches = (name: string): boolean =>
    needle === "" || normalizeSearch(name).includes(needle);

  return banks.flatMap((bank) => {
    if (bank.archived && !showArchived) {
      return [];
    }

    const visible = bank.accounts.filter(
      (account) => showArchived || !account.archived,
    );

    if (matches(bank.name)) {
      return [{ ...bank, accounts: visible }];
    }

    const hits = visible.filter((account) => matches(account.name));

    return hits.length > 0 ? [{ ...bank, accounts: hits }] : [];
  });
};

export const countActiveAccounts = (bank: BankWithAccounts): number =>
  bank.accounts.filter((account) => !account.archived).length;

// The banks an account can be created in.
export const activeBanks = (banks: readonly BankWithAccounts[]): Bank[] =>
  banks
    .filter((bank) => !bank.archived)
    .map(({ id, name, archived }) => ({ id, name, archived }));
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run core/banks/board.test.ts`
Expected: PASS (16 tests).

- [ ] **Step 5: Verify**

Run: `npx vitest run core/banks core/accounts` then `npx tsc --noEmit` and `npx eslint core/banks core/accounts`
Expected: tests PASS, no type or lint errors.

### Task 8: Page data (seed, then read)

**Files:**

- Test: `core/banks/pageData.test.ts`
- Create: `core/banks/pageData.ts`

**Interfaces:**

- Consumes: `ensureDefaultCash` (Task 6), `listBanksWithAccounts` (Task 4).
- Produces: `loadBanksBoard(userId: string): Promise<BankWithAccounts[]>` in `core/banks/pageData.ts`.

- [ ] **Step 1: Write the failing test** `core/banks/pageData.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  ensureDefaultCash: vi.fn(),
  listBanksWithAccounts: vi.fn(),
}));

vi.mock("@/core/accounts/defaultCash", () => ({
  ensureDefaultCash: deps.ensureDefaultCash,
}));
vi.mock("./service", () => ({
  listBanksWithAccounts: deps.listBanksWithAccounts,
}));

import { loadBanksBoard } from "./pageData";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("loadBanksBoard", () => {
  it("makes sure the user has the default cash bank before it reads the board", async () => {
    const calls: string[] = [];

    deps.ensureDefaultCash.mockImplementation(async () => {
      calls.push("ensure");
    });
    deps.listBanksWithAccounts.mockImplementation(async () => {
      calls.push("list");

      return [];
    });

    await loadBanksBoard("user_1");

    expect(calls).toEqual(["ensure", "list"]);
    expect(deps.ensureDefaultCash).toHaveBeenCalledWith("user_1");
    expect(deps.listBanksWithAccounts).toHaveBeenCalledWith("user_1");
  });

  it("gives the banks as the service read them", async () => {
    const banks = [
      { id: "bank_1", name: "Efectivo", archived: false, accounts: [] },
    ];

    deps.ensureDefaultCash.mockResolvedValue(undefined);
    deps.listBanksWithAccounts.mockResolvedValue(banks);

    await expect(loadBanksBoard("user_1")).resolves.toEqual(banks);
  });

  it("does not read the board when the seeding fails, so the failure reaches the error boundary", async () => {
    deps.ensureDefaultCash.mockRejectedValue(new Error("database down"));

    await expect(loadBanksBoard("user_1")).rejects.toThrow("database down");
    expect(deps.listBanksWithAccounts).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run core/banks/pageData.test.ts`
Expected: FAIL, `Failed to resolve import "./pageData"`.

- [ ] **Step 3: Implement** `core/banks/pageData.ts`

```ts
import { ensureDefaultCash } from "@/core/accounts/defaultCash";

import { listBanksWithAccounts } from "./service";
import type { BankWithAccounts } from "./types";

// Everything the banks page needs: the user's banks with their accounts. The first visit seeds the
// default cash bank (idempotent, safe when two requests race), so a user never lands on an empty
// board by accident.
export const loadBanksBoard = async (
  userId: string,
): Promise<BankWithAccounts[]> => {
  await ensureDefaultCash(userId);

  return listBanksWithAccounts(userId);
};
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run core/banks/pageData.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify**

Run: `npx vitest run core/banks core/accounts` then `npx tsc --noEmit` and `npx eslint core/banks core/accounts`
Expected: tests PASS, no type or lint errors.

### Task 9: Server actions for banks (and the helpers both actions files share)

**Files:**

- Test: `core/banks/actions.test.ts`
- Create: `core/banks/actionHelpers.ts`, `core/banks/actions.ts`

**Interfaces:**

- Consumes: `runAuthenticated`, `failure`, `fieldFailure`, `readForm` and the `ActionFailure` type from `@/core/entries/actionHelpers`; Task 3 schema/consts/errors/types; Task 4 service; `AccountNotFoundError`, `DuplicateAccountError`, `ACCOUNT_NOT_FOUND_MESSAGE`, `DUPLICATE_ACCOUNT_MESSAGE` (Task 3).
- Produces:
  - `core/banks/actionHelpers.ts` (not a `"use server"` module): `runAuthenticated`, `SUCCESS`, `toFieldFailure(error: z.ZodError): ActionFailure`, `toKnownFailure(error: unknown): ActionFailure | undefined`, `write(run: () => Promise<unknown>): Promise<BanksActionResult | ActionFailure>`, `isUsableId(id: unknown): id is string`.
  - `core/banks/actions.ts`: `createBankAction(formData: FormData): Promise<BanksActionResult>`, `updateBankAction(id: string, formData: FormData)`, `archiveBankAction(id: string)`, `unarchiveBankAction(id: string)`, each returning `Promise<BanksActionResult>`.

- [ ] **Step 1: Write the failing test** `core/banks/actions.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  createBank: vi.fn(),
  updateBank: vi.fn(),
  archiveBank: vi.fn(),
  unarchiveBank: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createBank: mocks.createBank,
  updateBank: mocks.updateBank,
  archiveBank: mocks.archiveBank,
  unarchiveBank: mocks.unarchiveBank,
}));

import {
  BankHasActiveAccountsError,
  BankNotFoundError,
  DuplicateBankError,
} from "./errors";
import {
  archiveBankAction,
  createBankAction,
  unarchiveBankAction,
  updateBankAction,
} from "./actions";

const USER_ID = "user_123";

const formOf = (values: Record<string, string> = { name: "Banco Galicia" }) => {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => formData.set(key, value));

  return formData;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("createBankAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await createBankAction(formOf())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createBank).not.toHaveBeenCalled();
  });

  it("returns field errors for a blank name without touching the service", async () => {
    const result = await createBankAction(formOf({ name: "   " }));

    expect(result).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { name: ["El nombre es obligatorio."] },
    });
    expect(mocks.createBank).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("creates the bank for the authenticated user with the trimmed name", async () => {
    mocks.createBank.mockResolvedValue({ id: "bank_1" });

    expect(
      await createBankAction(formOf({ name: "  Banco Galicia  " })),
    ).toEqual({
      status: "success",
    });
    expect(mocks.createBank).toHaveBeenCalledWith(USER_ID, {
      name: "Banco Galicia",
    });
  });

  it("ignores a userId in the form", async () => {
    mocks.createBank.mockResolvedValue({ id: "bank_1" });

    await createBankAction(formOf({ name: "Galicia", userId: "attacker" }));

    expect(mocks.createBank.mock.calls[0][0]).toBe(USER_ID);
    expect(mocks.createBank.mock.calls[0][1]).not.toHaveProperty("userId");
  });

  it("revalidates the banks page after a successful write", async () => {
    mocks.createBank.mockResolvedValue({ id: "bank_1" });

    await createBankAction(formOf());

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/banks");
  });

  it("puts a duplicate name on the name field and does not revalidate", async () => {
    mocks.createBank.mockRejectedValue(new DuplicateBankError());

    expect(await createBankAction(formOf())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { name: ["Ya tenés un banco con este nombre."] },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.createBank.mockRejectedValue(new Error("db down"));

    expect(await createBankAction(formOf())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});

describe("updateBankAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await updateBankAction("bank_1", formOf())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.updateBank).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await updateBankAction(
      "bank_1",
      formOf({ name: "a".repeat(41) }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      name: ["El nombre admite como máximo 40 caracteres."],
    });
    expect(mocks.updateBank).not.toHaveBeenCalled();
  });

  it("renames the bank of the authenticated user and revalidates", async () => {
    mocks.updateBank.mockResolvedValue(undefined);

    expect(
      await updateBankAction("bank_1", formOf({ name: "Galicia" })),
    ).toEqual({
      status: "success",
    });
    expect(mocks.updateBank).toHaveBeenCalledWith(USER_ID, "bank_1", {
      name: "Galicia",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/banks");
  });

  it("answers 'not found' for an id that is not text, without touching the service", async () => {
    expect(await updateBankAction("", formOf())).toEqual({
      status: "error",
      message: "No se encontró el banco.",
    });
    expect(mocks.updateBank).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's bank", async () => {
    mocks.updateBank.mockRejectedValue(new BankNotFoundError());

    expect(await updateBankAction("bank_of_someone_else", formOf())).toEqual({
      status: "error",
      message: "No se encontró el banco.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("puts a duplicate name on the name field", async () => {
    mocks.updateBank.mockRejectedValue(new DuplicateBankError());

    const result = await updateBankAction("bank_1", formOf());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      name: ["Ya tenés un banco con este nombre."],
    });
  });
});

describe("archiveBankAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await archiveBankAction("bank_1")).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.archiveBank).not.toHaveBeenCalled();
  });

  it("archives the bank of the authenticated user and revalidates", async () => {
    mocks.archiveBank.mockResolvedValue(undefined);

    expect(await archiveBankAction("bank_1")).toEqual({ status: "success" });
    expect(mocks.archiveBank).toHaveBeenCalledWith(USER_ID, "bank_1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/banks");
  });

  it("explains that the accounts must be archived first, and how many are left", async () => {
    mocks.archiveBank.mockRejectedValue(new BankHasActiveAccountsError(2));

    expect(await archiveBankAction("bank_1")).toEqual({
      status: "error",
      message:
        "Este banco todavía tiene 2 cuentas activas. Archivalas primero.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("says it in the singular for one account", async () => {
    mocks.archiveBank.mockRejectedValue(new BankHasActiveAccountsError(1));

    expect(await archiveBankAction("bank_1")).toEqual({
      status: "error",
      message: "Este banco todavía tiene 1 cuenta activa. Archivala primero.",
    });
  });

  it("answers 'not found' for another user's bank and for an id that is not text", async () => {
    mocks.archiveBank.mockRejectedValue(new BankNotFoundError());

    expect(await archiveBankAction("bank_of_someone_else")).toEqual({
      status: "error",
      message: "No se encontró el banco.",
    });
    expect(await archiveBankAction("")).toEqual({
      status: "error",
      message: "No se encontró el banco.",
    });
  });
});

describe("unarchiveBankAction", () => {
  it("brings the bank of the authenticated user back and revalidates", async () => {
    mocks.unarchiveBank.mockResolvedValue(undefined);

    expect(await unarchiveBankAction("bank_1")).toEqual({ status: "success" });
    expect(mocks.unarchiveBank).toHaveBeenCalledWith(USER_ID, "bank_1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/banks");
  });

  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    await unarchiveBankAction("bank_1");

    expect(mocks.unarchiveBank).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's bank", async () => {
    mocks.unarchiveBank.mockRejectedValue(new BankNotFoundError());

    expect(await unarchiveBankAction("bank_of_someone_else")).toEqual({
      status: "error",
      message: "No se encontró el banco.",
    });
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run core/banks/actions.test.ts`
Expected: FAIL, `Failed to resolve import "./actions"`.

- [ ] **Step 3: Implement.** `core/banks/actionHelpers.ts`

```ts
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ACCOUNT_NOT_FOUND_MESSAGE,
  DUPLICATE_ACCOUNT_MESSAGE,
} from "@/core/accounts/consts";
import {
  AccountNotFoundError,
  DuplicateAccountError,
} from "@/core/accounts/errors";
import {
  failure,
  fieldFailure,
  runAuthenticated as runScoped,
} from "@/core/entries/actionHelpers";
import type { ActionFailure } from "@/core/entries/actionHelpers";

import {
  BANK_ARCHIVED_MESSAGE,
  BANK_NOT_FOUND_MESSAGE,
  BANKS_PATH,
  DUPLICATE_BANK_MESSAGE,
  bankHasActiveAccountsMessage,
} from "./consts";
import {
  BankArchivedError,
  BankHasActiveAccountsError,
  BankNotFoundError,
  DuplicateBankError,
} from "./errors";
import type { BanksActionResult, BanksFieldErrors } from "./types";

// Plumbing shared by the server actions of banks and of accounts. It is not a "use server" module:
// nothing here is callable from the browser.

// The owner always comes from the Clerk session; see runAuthenticated in the entries helpers.
export const runAuthenticated = <Result extends { status: string }>(
  run: (userId: string) => Promise<Result>,
) => runScoped("banks", run);

export const SUCCESS: BanksActionResult = { status: "success" };

export const toFieldFailure = (error: z.ZodError): ActionFailure =>
  fieldFailure(z.flattenError(error).fieldErrors as BanksFieldErrors);

// The errors a bank or an account can run into that the user can act on. Anything else is
// unexpected and is left for runAuthenticated to log.
export const toKnownFailure = (error: unknown): ActionFailure | undefined => {
  if (error instanceof DuplicateBankError) {
    return fieldFailure({ name: [DUPLICATE_BANK_MESSAGE] });
  }

  if (error instanceof DuplicateAccountError) {
    return fieldFailure({ name: [DUPLICATE_ACCOUNT_MESSAGE] });
  }

  if (error instanceof BankNotFoundError) {
    return failure(BANK_NOT_FOUND_MESSAGE);
  }

  if (error instanceof AccountNotFoundError) {
    return failure(ACCOUNT_NOT_FOUND_MESSAGE);
  }

  if (error instanceof BankArchivedError) {
    return failure(BANK_ARCHIVED_MESSAGE);
  }

  if (error instanceof BankHasActiveAccountsError) {
    return failure(bankHasActiveAccountsMessage(error.count));
  }

  return undefined;
};

// Runs a write and turns the known failures into the result the UI shows; revalidates the page
// only when the write went through.
export const write = async (
  run: () => Promise<unknown>,
): Promise<BanksActionResult | ActionFailure> => {
  try {
    await run();
  } catch (error) {
    const known = toKnownFailure(error);

    if (known) {
      return known;
    }

    throw error;
  }

  revalidatePath(BANKS_PATH);

  return SUCCESS;
};

// An id that is not text cannot be a record of the user.
export const isUsableId = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0;
```

`core/banks/actions.ts`

```ts
"use server";

import { failure, readForm } from "@/core/entries/actionHelpers";

import {
  isUsableId,
  runAuthenticated,
  toFieldFailure,
  write,
} from "./actionHelpers";
import { BANK_FORM_FIELDS, BANK_NOT_FOUND_MESSAGE } from "./consts";
import { bankInputSchema } from "./schema";
import { archiveBank, createBank, unarchiveBank, updateBank } from "./service";
import type { BankInput, BanksActionResult, ParsedForm } from "./types";

const parseBankForm = (formData: FormData): ParsedForm<BankInput> => {
  const result = bankInputSchema.safeParse(
    readForm(formData, BANK_FORM_FIELDS),
  );

  return result.success
    ? { data: result.data }
    : { error: toFieldFailure(result.error) };
};

export async function createBankAction(
  formData: FormData,
): Promise<BanksActionResult> {
  return runAuthenticated(async (userId) => {
    const parsed = parseBankForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(() => createBank(userId, parsed.data));
  });
}

export async function updateBankAction(
  id: string,
  formData: FormData,
): Promise<BanksActionResult> {
  return runAuthenticated(async (userId) => {
    if (!isUsableId(id)) {
      return failure(BANK_NOT_FOUND_MESSAGE);
    }

    const parsed = parseBankForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(() => updateBank(userId, id, parsed.data));
  });
}

// Archives the bank. The service refuses while any of its accounts is still active.
export async function archiveBankAction(
  id: string,
): Promise<BanksActionResult> {
  return runAuthenticated(async (userId) => {
    if (!isUsableId(id)) {
      return failure(BANK_NOT_FOUND_MESSAGE);
    }

    return write(() => archiveBank(userId, id));
  });
}

export async function unarchiveBankAction(
  id: string,
): Promise<BanksActionResult> {
  return runAuthenticated(async (userId) => {
    if (!isUsableId(id)) {
      return failure(BANK_NOT_FOUND_MESSAGE);
    }

    return write(() => unarchiveBank(userId, id));
  });
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run core/banks/actions.test.ts`
Expected: PASS (21 tests).

- [ ] **Step 5: Verify**

Run: `npx vitest run core/banks core/accounts` then `npx tsc --noEmit` and `npx eslint core/banks core/accounts`
Expected: tests PASS, no type or lint errors.

### Task 10: Server actions for accounts

**Files:**

- Test: `core/accounts/actions.test.ts`
- Create: `core/accounts/actions.ts`

**Interfaces:**

- Consumes: `runAuthenticated`, `toFieldFailure`, `write`, `isUsableId` (Task 9), `failure`, `readForm`, schemas and consts of Task 3, service of Task 5, `BanksActionResult`, `ParsedForm` (Task 3).
- Produces in `core/accounts/actions.ts`: `createAccountAction(formData: FormData)`, `updateAccountAction(id: string, formData: FormData)`, `archiveAccountAction(id: string)`, `unarchiveAccountAction(id: string)`, each `Promise<BanksActionResult>`.

- [ ] **Step 1: Write the failing test** `core/accounts/actions.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  archiveAccount: vi.fn(),
  unarchiveAccount: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createAccount: mocks.createAccount,
  updateAccount: mocks.updateAccount,
  archiveAccount: mocks.archiveAccount,
  unarchiveAccount: mocks.unarchiveAccount,
}));

import { BankArchivedError, BankNotFoundError } from "@/core/banks/errors";

import {
  archiveAccountAction,
  createAccountAction,
  unarchiveAccountAction,
  updateAccountAction,
} from "./actions";
import { AccountNotFoundError, DuplicateAccountError } from "./errors";

const USER_ID = "user_123";

const formOf = (patch: Record<string, string> = {}): FormData => {
  const values: Record<string, string> = {
    bankId: "bank_1",
    name: "Caja de ahorro",
    currency: "ARS",
    ...patch,
  };
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => formData.set(key, value));

  return formData;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("createAccountAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await createAccountAction(formOf())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await createAccountAction(
      formOf({ bankId: "", name: "  ", currency: "ars" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        bankId: ["Elegí un banco."],
        name: ["El nombre es obligatorio."],
        currency: ["Selecciona una moneda compatible."],
      },
    });
    expect(mocks.createAccount).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("creates the account for the authenticated user", async () => {
    mocks.createAccount.mockResolvedValue({ id: "acc_1" });

    expect(
      await createAccountAction(formOf({ name: "  Caja de ahorro  " })),
    ).toEqual({
      status: "success",
    });
    expect(mocks.createAccount).toHaveBeenCalledWith(USER_ID, {
      bankId: "bank_1",
      name: "Caja de ahorro",
      currency: "ARS",
    });
  });

  it("ignores a userId and an archive date in the form", async () => {
    mocks.createAccount.mockResolvedValue({ id: "acc_1" });

    await createAccountAction(
      formOf({ userId: "attacker", archivedAt: "2026-01-01" }),
    );

    expect(mocks.createAccount.mock.calls[0][0]).toBe(USER_ID);
    expect(mocks.createAccount.mock.calls[0][1]).not.toHaveProperty("userId");
    expect(mocks.createAccount.mock.calls[0][1]).not.toHaveProperty(
      "archivedAt",
    );
  });

  it("revalidates the banks page after a successful write", async () => {
    mocks.createAccount.mockResolvedValue({ id: "acc_1" });

    await createAccountAction(formOf());

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/banks");
  });

  it("puts a duplicate name on the name field", async () => {
    mocks.createAccount.mockRejectedValue(new DuplicateAccountError());

    expect(await createAccountAction(formOf())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        name: ["Ya tenés una cuenta con este nombre en este banco."],
      },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's bank", async () => {
    mocks.createAccount.mockRejectedValue(new BankNotFoundError());

    expect(
      await createAccountAction(formOf({ bankId: "bank_of_someone_else" })),
    ).toEqual({
      status: "error",
      message: "No se encontró el banco.",
    });
  });

  it("explains that an archived bank cannot take accounts", async () => {
    mocks.createAccount.mockRejectedValue(new BankArchivedError());

    expect(await createAccountAction(formOf())).toEqual({
      status: "error",
      message: "Este banco está archivado. Reactivalo primero.",
    });
  });

  it("returns a generic error when the service fails", async () => {
    mocks.createAccount.mockRejectedValue(new Error("db down"));

    expect(await createAccountAction(formOf())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});

describe("updateAccountAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    await updateAccountAction("acc_1", formOf());

    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await updateAccountAction(
      "acc_1",
      formOf({ currency: "ZZZ" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      currency: ["Selecciona una moneda compatible."],
    });
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it("saves the name and the currency of the user's account, and never a bank", async () => {
    mocks.updateAccount.mockResolvedValue(undefined);

    expect(
      await updateAccountAction(
        "acc_1",
        formOf({ bankId: "bank_of_someone_else", currency: "USD" }),
      ),
    ).toEqual({ status: "success" });
    expect(mocks.updateAccount).toHaveBeenCalledWith(USER_ID, "acc_1", {
      name: "Caja de ahorro",
      currency: "USD",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/banks");
  });

  it("answers 'not found' for an id that is not text, without touching the service", async () => {
    expect(await updateAccountAction("", formOf())).toEqual({
      status: "error",
      message: "No se encontró la cuenta.",
    });
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's account", async () => {
    mocks.updateAccount.mockRejectedValue(new AccountNotFoundError());

    expect(await updateAccountAction("acc_of_someone_else", formOf())).toEqual({
      status: "error",
      message: "No se encontró la cuenta.",
    });
  });

  it("puts a duplicate name on the name field", async () => {
    mocks.updateAccount.mockRejectedValue(new DuplicateAccountError());

    const result = await updateAccountAction("acc_1", formOf());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      name: ["Ya tenés una cuenta con este nombre en este banco."],
    });
  });
});

describe("archiveAccountAction", () => {
  it("archives the account of the authenticated user and revalidates", async () => {
    mocks.archiveAccount.mockResolvedValue(undefined);

    expect(await archiveAccountAction("acc_1")).toEqual({ status: "success" });
    expect(mocks.archiveAccount).toHaveBeenCalledWith(USER_ID, "acc_1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/banks");
  });

  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    await archiveAccountAction("acc_1");

    expect(mocks.archiveAccount).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's account and for an id that is not text", async () => {
    mocks.archiveAccount.mockRejectedValue(new AccountNotFoundError());

    expect(await archiveAccountAction("acc_of_someone_else")).toEqual({
      status: "error",
      message: "No se encontró la cuenta.",
    });
    expect(await archiveAccountAction("")).toEqual({
      status: "error",
      message: "No se encontró la cuenta.",
    });
  });
});

describe("unarchiveAccountAction", () => {
  it("brings the account of the authenticated user back and revalidates", async () => {
    mocks.unarchiveAccount.mockResolvedValue(undefined);

    expect(await unarchiveAccountAction("acc_1")).toEqual({
      status: "success",
    });
    expect(mocks.unarchiveAccount).toHaveBeenCalledWith(USER_ID, "acc_1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/banks");
  });

  it("explains that the bank must be reactivated first", async () => {
    mocks.unarchiveAccount.mockRejectedValue(new BankArchivedError());

    expect(await unarchiveAccountAction("acc_1")).toEqual({
      status: "error",
      message: "Este banco está archivado. Reactivalo primero.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's account", async () => {
    mocks.unarchiveAccount.mockRejectedValue(new AccountNotFoundError());

    expect(await unarchiveAccountAction("acc_of_someone_else")).toEqual({
      status: "error",
      message: "No se encontró la cuenta.",
    });
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run core/accounts/actions.test.ts`
Expected: FAIL, `Failed to resolve import "./actions"`.

- [ ] **Step 3: Implement** `core/accounts/actions.ts`

```ts
"use server";

import {
  isUsableId,
  runAuthenticated,
  toFieldFailure,
  write,
} from "@/core/banks/actionHelpers";
import type { BanksActionResult, ParsedForm } from "@/core/banks/types";
import { failure, readForm } from "@/core/entries/actionHelpers";

import {
  ACCOUNT_NOT_FOUND_MESSAGE,
  CREATE_ACCOUNT_FORM_FIELDS,
  UPDATE_ACCOUNT_FORM_FIELDS,
} from "./consts";
import { accountInputSchema, createAccountInputSchema } from "./schema";
import {
  archiveAccount,
  createAccount,
  unarchiveAccount,
  updateAccount,
} from "./service";
import type { AccountInput, CreateAccountInput } from "./types";

const parseCreateForm = (
  formData: FormData,
): ParsedForm<CreateAccountInput> => {
  const result = createAccountInputSchema.safeParse(
    readForm(formData, CREATE_ACCOUNT_FORM_FIELDS),
  );

  return result.success
    ? { data: result.data }
    : { error: toFieldFailure(result.error) };
};

// An edit reads only the name and the currency: the bank an account belongs to never changes.
const parseUpdateForm = (formData: FormData): ParsedForm<AccountInput> => {
  const result = accountInputSchema.safeParse(
    readForm(formData, UPDATE_ACCOUNT_FORM_FIELDS),
  );

  return result.success
    ? { data: result.data }
    : { error: toFieldFailure(result.error) };
};

export async function createAccountAction(
  formData: FormData,
): Promise<BanksActionResult> {
  return runAuthenticated(async (userId) => {
    const parsed = parseCreateForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(() => createAccount(userId, parsed.data));
  });
}

export async function updateAccountAction(
  id: string,
  formData: FormData,
): Promise<BanksActionResult> {
  return runAuthenticated(async (userId) => {
    if (!isUsableId(id)) {
      return failure(ACCOUNT_NOT_FOUND_MESSAGE);
    }

    const parsed = parseUpdateForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(() => updateAccount(userId, id, parsed.data));
  });
}

export async function archiveAccountAction(
  id: string,
): Promise<BanksActionResult> {
  return runAuthenticated(async (userId) => {
    if (!isUsableId(id)) {
      return failure(ACCOUNT_NOT_FOUND_MESSAGE);
    }

    return write(() => archiveAccount(userId, id));
  });
}

// Brings the account back. The service refuses while its bank is archived.
export async function unarchiveAccountAction(
  id: string,
): Promise<BanksActionResult> {
  return runAuthenticated(async (userId) => {
    if (!isUsableId(id)) {
      return failure(ACCOUNT_NOT_FOUND_MESSAGE);
    }

    return write(() => unarchiveAccount(userId, id));
  });
}
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run core/accounts/actions.test.ts`
Expected: PASS (21 tests).

- [ ] **Step 5: Verify**

Run: `npx vitest run core/banks core/accounts` then `npx tsc --noEmit` and `npx eslint core/banks core/accounts`
Expected: tests PASS, no type or lint errors.

### Task 11: Navigation: sidebar item "Bancos" and its breadcrumb

"Bancos" is a top-level item without children, right after "Tarjetas".

**Files:**

- Test: `components/Sidebar/consts.test.ts`, `components/Navbar/components/NavbarBreadcrumbs/utils.test.ts`
- Modify: `components/Sidebar/consts.ts`, `components/Navbar/components/NavbarBreadcrumbs/consts.ts`

**Interfaces:**

- Consumes: `NavItem` (`components/Sidebar/types.ts`), `buildCrumbs` (`components/Navbar/components/NavbarBreadcrumbs/utils.ts`).
- Produces: `NAV_ITEMS[4]` is `{ label: "Bancos", href: "/dashboard/banks", icon: BuildingLibraryIcon }` (no `children`); the roadmap moves to index 5; `SEGMENT_LABELS.banks = "Bancos"`.

- [ ] **Step 1: Write the failing tests.** In `components/Sidebar/consts.test.ts` replace the first line

```ts
import { CreditCardIcon, ViewColumnsIcon } from "@heroicons/react/24/outline";
```

with

```ts
import {
  BuildingLibraryIcon,
  CreditCardIcon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";
```

replace the roadmap test

```ts
it("puts the roadmap right after the cards, with a columns icon", () => {
  expect(NAV_ITEMS[4].label).toBe("Hoja de ruta");
  expect(NAV_ITEMS[4].href).toBe("/dashboard/roadmap");
  expect(NAV_ITEMS[4].icon).toBe(ViewColumnsIcon);
});
```

with

```ts
it("puts the banks right after the cards, as a top-level item without children", () => {
  const banks = NAV_ITEMS[4];

  expect(banks.label).toBe("Bancos");
  expect(banks.href).toBe("/dashboard/banks");
  expect(banks.icon).toBe(BuildingLibraryIcon);
  expect(banks.children).toBeUndefined();
});

it("puts the roadmap right after the banks, with a columns icon", () => {
  expect(NAV_ITEMS[5].label).toBe("Hoja de ruta");
  expect(NAV_ITEMS[5].href).toBe("/dashboard/roadmap");
  expect(NAV_ITEMS[5].icon).toBe(ViewColumnsIcon);
});
```

and replace `expect(NAV_ITEMS.slice(5).map((item) => item.label)).toEqual([` with `expect(NAV_ITEMS.slice(6).map((item) => item.label)).toEqual([`.

In `components/Navbar/components/NavbarBreadcrumbs/utils.test.ts` add, after the "names the cards page Tarjetas" test:

```ts
it("names the banks page Bancos", () => {
  expect(buildCrumbs("/dashboard/banks")).toEqual([
    { label: "Panel", href: "/dashboard" },
    { label: "Bancos" },
  ]);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run components/Sidebar/consts.test.ts components/Navbar/components/NavbarBreadcrumbs/utils.test.ts`
Expected: FAIL: the banks item test (index 4 is still the roadmap), the roadmap-at-5 test, the placeholders test, and the breadcrumb test (`Banks` instead of `Bancos`, the capitalized slug fallback).

- [ ] **Step 3: Implement.** In `components/Sidebar/consts.ts` change the import to

```ts
import {
  BanknotesIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  DocumentTextIcon,
  ReceiptPercentIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";
```

and add after the "Tarjetas" line:

```ts
  { label: "Bancos", href: "/dashboard/banks", icon: BuildingLibraryIcon },
```

In `components/Navbar/components/NavbarBreadcrumbs/consts.ts` add after `cards: "Tarjetas",`:

```ts
  banks: "Bancos",
```

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run components/Sidebar components/Navbar`
Expected: PASS.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` and `npx eslint components/Sidebar components/Navbar`
Expected: no errors.

### Task 12: Board tiles: `AccountTile` and `AddAccountTile`

The tile shows the account name and its currency ONLY (no balance: balances arrive in stage 2).

**Files:**

- Test: `components/Banks/components/BanksBoard/components/BankRow/components/AccountTile/AccountTile.test.tsx`, `.../AddAccountTile/AddAccountTile.test.tsx`
- Create (in each of the two folders under `components/Banks/components/BanksBoard/components/BankRow/components/`): `AccountTile/{AccountTile.tsx,index.ts,types.ts,consts.ts,styles.ts}`, `AddAccountTile/{AddAccountTile.tsx,index.ts,types.ts,consts.ts,styles.ts}`

**Interfaces:**

- Consumes: `Account` (`@/core/accounts/types`), HeroUI `Chip`.
- Produces: `AccountTile({ account: Account, onEdit: (account: Account) => void })` (a button named `Editar cuenta <name>`); `AddAccountTile({ bankId: string, bankName: string, onAdd: (bankId: string) => void })` (a button with the text `+ cuenta` and the accessible name `+ cuenta en <bankName>`).

- [ ] **Step 1: Write the failing tests.** `AccountTile/AccountTile.test.tsx`

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Account } from "@/core/accounts/types";

import { AccountTile } from "./AccountTile";

const ACCOUNT: Account = {
  id: "acc_1",
  bankId: "bank_1",
  name: "Caja de ahorro",
  currency: "ARS",
  archived: false,
};

const tile = (name = "Editar cuenta Caja de ahorro") =>
  screen.getByRole("button", { name });

describe("AccountTile", () => {
  it("shows the name and the currency of the account and nothing else (no balance)", () => {
    render(<AccountTile account={ACCOUNT} onEdit={vi.fn()} />);

    expect(tile()).toHaveTextContent(/^Caja de ahorroARS$/);
  });

  it("opens the editor of the account when pressed", () => {
    const onEdit = vi.fn();

    render(<AccountTile account={ACCOUNT} onEdit={onEdit} />);
    fireEvent.click(tile());

    expect(onEdit).toHaveBeenCalledWith(ACCOUNT);
  });

  it("marks an archived account", () => {
    render(
      <AccountTile account={{ ...ACCOUNT, archived: true }} onEdit={vi.fn()} />,
    );

    expect(tile()).toHaveTextContent("Archivada");
  });

  it("does not mark an active account as archived", () => {
    render(<AccountTile account={ACCOUNT} onEdit={vi.fn()} />);

    expect(tile()).not.toHaveTextContent("Archivada");
  });

  it("opts out of the global button size so the tile keeps its own, and is a plain button", () => {
    render(<AccountTile account={ACCOUNT} onEdit={vi.fn()} />);

    expect(tile()).toHaveAttribute("type", "button");
    expect(tile()).toHaveClass(
      "app-button--full-width",
      "app-button--row-height",
    );
  });
});
```

`AddAccountTile/AddAccountTile.test.tsx`

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddAccountTile } from "./AddAccountTile";

describe("AddAccountTile", () => {
  it("reads '+ cuenta' and says which bank it adds to", () => {
    render(
      <AddAccountTile
        bankId="bank_1"
        bankName="Banco Galicia"
        onAdd={vi.fn()}
      />,
    );

    const tile = screen.getByRole("button", {
      name: "+ cuenta en Banco Galicia",
    });

    expect(tile).toHaveTextContent("+ cuenta");
  });

  it("starts a new account in that bank when pressed", () => {
    const onAdd = vi.fn();

    render(
      <AddAccountTile bankId="bank_1" bankName="Banco Galicia" onAdd={onAdd} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "+ cuenta en Banco Galicia" }),
    );

    expect(onAdd).toHaveBeenCalledWith("bank_1");
  });

  it("opts out of the global button size", () => {
    render(
      <AddAccountTile
        bankId="bank_1"
        bankName="Banco Galicia"
        onAdd={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "+ cuenta en Banco Galicia" }),
    ).toHaveClass("app-button--full-width", "app-button--row-height");
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run components/Banks/components/BanksBoard/components/BankRow/components`
Expected: FAIL, `Failed to resolve import "./AccountTile"` and `"./AddAccountTile"`.

- [ ] **Step 3: Implement `AccountTile`.** `AccountTile/types.ts`

```ts
import type { Account } from "@/core/accounts/types";

export interface AccountTileProps {
  account: Account;
  // Opens the editor of the account.
  onEdit: (account: Account) => void;
}
```

`AccountTile/consts.ts`

```ts
export const ARCHIVED_ACCOUNT_LABEL = "Archivada";

export const editAccountLabel = (name: string): string =>
  `Editar cuenta ${name}`;
```

`AccountTile/styles.ts`

```ts
// A raw <button> is hit by the global button rule of app/globals.css (fixed height, fit-content
// width, padding, field radius): the two app-button--* classes are its documented opt-outs.
export const TILE_CLASS_NAME =
  "app-button--full-width app-button--row-height flex h-24 w-44 shrink-0 flex-col items-start justify-between gap-2 bg-surface-secondary p-3 text-left ring-1 ring-inset ring-border hover:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none";

// An archived account stays readable but quieter.
export const ARCHIVED_TILE_CLASS_NAME = `${TILE_CLASS_NAME} opacity-60`;

export const NAME_CLASS_NAME = "line-clamp-2 text-sm font-medium break-words";

export const META_CLASS_NAME = "flex flex-wrap items-center gap-1";
```

`AccountTile/AccountTile.tsx`

```tsx
import { Chip } from "@heroui/react";

import { ARCHIVED_ACCOUNT_LABEL, editAccountLabel } from "./consts";
import {
  ARCHIVED_TILE_CLASS_NAME,
  META_CLASS_NAME,
  NAME_CLASS_NAME,
  TILE_CLASS_NAME,
} from "./styles";
import type { AccountTileProps } from "./types";

// One account of a bank: its name and its currency, nothing else. Pressing it opens the editor.
export function AccountTile({ account, onEdit }: AccountTileProps) {
  return (
    <button
      type="button"
      className={account.archived ? ARCHIVED_TILE_CLASS_NAME : TILE_CLASS_NAME}
      aria-label={editAccountLabel(account.name)}
      onClick={() => onEdit(account)}
    >
      <span className={NAME_CLASS_NAME}>{account.name}</span>
      <span className={META_CLASS_NAME}>
        <Chip size="sm" variant="soft">
          {account.currency}
        </Chip>
        {account.archived ? (
          <Chip size="sm" variant="soft">
            {ARCHIVED_ACCOUNT_LABEL}
          </Chip>
        ) : null}
      </span>
    </button>
  );
}
```

`AccountTile/index.ts`

```ts
export { AccountTile } from "./AccountTile";
```

- [ ] **Step 4: Implement `AddAccountTile`.** `AddAccountTile/types.ts`

```ts
export interface AddAccountTileProps {
  bankId: string;
  bankName: string;
  // Starts a new account in this bank.
  onAdd: (bankId: string) => void;
}
```

`AddAccountTile/consts.ts`

```ts
export const ADD_ACCOUNT_TEXT = "+ cuenta";

export const addAccountLabel = (bankName: string): string =>
  `+ cuenta en ${bankName}`;
```

`AddAccountTile/styles.ts`

```ts
// Same size as an account tile, drawn as an empty slot. See AccountTile/styles.ts for the two
// app-button--* classes.
export const ADD_TILE_CLASS_NAME =
  "app-button--full-width app-button--row-height flex h-24 w-44 shrink-0 items-center justify-center border border-dashed border-border p-3 text-sm text-muted hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none";
```

`AddAccountTile/AddAccountTile.tsx`

```tsx
import { ADD_ACCOUNT_TEXT, addAccountLabel } from "./consts";
import { ADD_TILE_CLASS_NAME } from "./styles";
import type { AddAccountTileProps } from "./types";

// The last tile of an active bank's row: it starts a new account in that bank.
export function AddAccountTile({
  bankId,
  bankName,
  onAdd,
}: AddAccountTileProps) {
  return (
    <button
      type="button"
      className={ADD_TILE_CLASS_NAME}
      aria-label={addAccountLabel(bankName)}
      onClick={() => onAdd(bankId)}
    >
      {ADD_ACCOUNT_TEXT}
    </button>
  );
}
```

`AddAccountTile/index.ts`

```ts
export { AddAccountTile } from "./AddAccountTile";
```

- [ ] **Step 5: Run and see them pass**

Run: `npx vitest run components/Banks/components/BanksBoard/components/BankRow/components`
Expected: PASS (5 + 3 tests).

- [ ] **Step 6: Verify**

Run: `npx vitest run components/componentStructure.test.ts components/Banks` then `npx tsc --noEmit` and `npx eslint components/Banks`
Expected: structure guard and tests PASS, no type or lint errors.

### Task 13: `BankCell` and `BankRow`

**Files:**

- Test: `components/Banks/components/BanksBoard/components/BankRow/components/BankCell/BankCell.test.tsx`, `components/Banks/components/BanksBoard/components/BankRow/BankRow.test.tsx`
- Create: `components/Banks/styles.ts` (shared board styles), `.../BankRow/components/BankCell/{BankCell.tsx,index.ts,types.ts,consts.ts,styles.ts}`, `.../BankRow/{BankRow.tsx,index.ts,types.ts,consts.ts,styles.ts}`

**Interfaces:**

- Consumes: `Bank`, `BankWithAccounts` (`@/core/banks/types`), `Account`, `AccountTile`, `AddAccountTile` (Task 12).
- Produces:
  - `components/Banks/styles.ts`: `BOARD_CLASS_NAME` (scrolls horizontally), `ROW_CLASS_NAME`, `EMPTY_CLASS_NAME`.
  - `BankCell({ bank: Bank, onEdit: (bankId: string) => void })`: a button named `Editar banco <name>`.
  - `BankRow({ bank: BankWithAccounts, onEditBank: (bankId: string) => void, onEditAccount: (account: Account) => void, onAddAccount: (bankId: string) => void })`: an `<li>`; first the bank cell, then a list named `Cuentas de <bank>` with one tile per account in the order given, then the "+ cuenta" tile unless the bank is archived.

- [ ] **Step 1: Write the failing tests.** `BankCell/BankCell.test.tsx`

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Bank } from "@/core/banks/types";

import { BankCell } from "./BankCell";

const BANK: Bank = { id: "bank_1", name: "Banco Galicia", archived: false };

const cell = () =>
  screen.getByRole("button", { name: "Editar banco Banco Galicia" });

describe("BankCell", () => {
  it("shows the name of the bank", () => {
    render(<BankCell bank={BANK} onEdit={vi.fn()} />);

    expect(cell()).toHaveTextContent("Banco Galicia");
  });

  it("opens the editor of the bank when pressed", () => {
    const onEdit = vi.fn();

    render(<BankCell bank={BANK} onEdit={onEdit} />);
    fireEvent.click(cell());

    expect(onEdit).toHaveBeenCalledWith("bank_1");
  });

  it("marks an archived bank, and only an archived one", () => {
    const { rerender } = render(<BankCell bank={BANK} onEdit={vi.fn()} />);

    expect(cell()).not.toHaveTextContent("Archivado");

    rerender(<BankCell bank={{ ...BANK, archived: true }} onEdit={vi.fn()} />);

    expect(cell()).toHaveTextContent("Archivado");
  });

  it("opts out of the global button size", () => {
    render(<BankCell bank={BANK} onEdit={vi.fn()} />);

    expect(cell()).toHaveClass(
      "app-button--full-width",
      "app-button--row-height",
    );
  });
});
```

`BankRow/BankRow.test.tsx`

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BankWithAccounts } from "@/core/banks/types";

import { BankRow } from "./BankRow";

const BANK: BankWithAccounts = {
  id: "bank_1",
  name: "Banco Galicia",
  archived: false,
  accounts: [
    {
      id: "acc_1",
      bankId: "bank_1",
      name: "Caja de ahorro",
      currency: "ARS",
      archived: false,
    },
    {
      id: "acc_2",
      bankId: "bank_1",
      name: "Cuenta en dólares",
      currency: "USD",
      archived: false,
    },
  ],
};

const renderRow = (bank: BankWithAccounts = BANK) => {
  const handlers = {
    onEditBank: vi.fn(),
    onEditAccount: vi.fn(),
    onAddAccount: vi.fn(),
  };

  render(
    <ul>
      <BankRow bank={bank} {...handlers} />
    </ul>,
  );

  return handlers;
};

const tilesList = (bankName = "Banco Galicia") =>
  screen.getByRole("list", { name: `Cuentas de ${bankName}` });

describe("BankRow", () => {
  it("starts with the bank, then one tile per account in the order given, then '+ cuenta'", () => {
    renderRow();

    expect(
      screen.getByRole("button", { name: "Editar banco Banco Galicia" }),
    ).toBeInTheDocument();
    expect(
      within(tilesList())
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Editar cuenta Caja de ahorro",
      "Editar cuenta Cuenta en dólares",
      "+ cuenta en Banco Galicia",
    ]);
  });

  it("has no balance anywhere: each tile is its name and its currency", () => {
    renderRow();

    expect(
      screen.getByRole("button", { name: "Editar cuenta Cuenta en dólares" }),
    ).toHaveTextContent(/^Cuenta en dólaresUSD$/);
  });

  it("offers only '+ cuenta' for a bank without accounts", () => {
    renderRow({ ...BANK, accounts: [] });

    expect(
      within(tilesList())
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["+ cuenta en Banco Galicia"]);
  });

  it("offers no '+ cuenta' for an archived bank: nothing can be added to it", () => {
    renderRow({ ...BANK, archived: true });

    expect(
      screen.queryByRole("button", { name: "+ cuenta en Banco Galicia" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Editar cuenta Caja de ahorro" }),
    ).toBeInTheDocument();
  });

  it("reports the bank, the account and the bank to add to", () => {
    const { onEditBank, onEditAccount, onAddAccount } = renderRow();

    fireEvent.click(
      screen.getByRole("button", { name: "Editar banco Banco Galicia" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Editar cuenta Caja de ahorro" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "+ cuenta en Banco Galicia" }),
    );

    expect(onEditBank).toHaveBeenCalledWith("bank_1");
    expect(onEditAccount).toHaveBeenCalledWith(BANK.accounts[0]);
    expect(onAddAccount).toHaveBeenCalledWith("bank_1");
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run components/Banks/components/BanksBoard/components/BankRow`
Expected: FAIL, `Failed to resolve import "./BankCell"` / `"./BankRow"`.

- [ ] **Step 3: Create the shared board styles** `components/Banks/styles.ts`

```ts
// The board scrolls sideways inside its own box on a narrow screen, never the page. Each row is as
// wide as its tiles (at least the box), so every row scrolls together.
export const BOARD_CLASS_NAME =
  "slim-scrollbar flex min-w-0 flex-col gap-3 overflow-x-auto pb-2";

// One swimlane: the bank first, then its account tiles.
export const ROW_CLASS_NAME = "flex w-max min-w-full items-stretch gap-3";

// Said when there is nothing to show, in the same quiet voice as the hints of the forms.
export const EMPTY_CLASS_NAME = "px-1 text-sm text-muted";
```

- [ ] **Step 4: Implement `BankCell`.** `BankCell/types.ts`

```ts
import type { Bank } from "@/core/banks/types";

export interface BankCellProps {
  bank: Bank;
  // Opens the editor of the bank.
  onEdit: (bankId: string) => void;
}
```

`BankCell/consts.ts`

```ts
export const ARCHIVED_BANK_LABEL = "Archivado";

export const editBankLabel = (name: string): string => `Editar banco ${name}`;
```

`BankCell/styles.ts`

```ts
// The first column of a row. It stays in view while the tiles scroll under it. See
// AccountTile/styles.ts for the two app-button--* classes.
export const CELL_CLASS_NAME =
  "app-button--full-width app-button--row-height sticky left-0 z-10 flex min-h-24 w-52 shrink-0 flex-col items-start justify-between gap-2 bg-surface-secondary p-3 text-left ring-1 ring-inset ring-border hover:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none";

export const ARCHIVED_CELL_CLASS_NAME = `${CELL_CLASS_NAME} opacity-60`;

export const NAME_CLASS_NAME =
  "line-clamp-2 text-base font-semibold break-words";
```

`BankCell/BankCell.tsx`

```tsx
import { Chip } from "@heroui/react";

import { ARCHIVED_BANK_LABEL, editBankLabel } from "./consts";
import {
  ARCHIVED_CELL_CLASS_NAME,
  CELL_CLASS_NAME,
  NAME_CLASS_NAME,
} from "./styles";
import type { BankCellProps } from "./types";

// The first column of a row: the bank. Pressing it opens the editor of the bank.
export function BankCell({ bank, onEdit }: BankCellProps) {
  return (
    <button
      type="button"
      className={bank.archived ? ARCHIVED_CELL_CLASS_NAME : CELL_CLASS_NAME}
      aria-label={editBankLabel(bank.name)}
      onClick={() => onEdit(bank.id)}
    >
      <span className={NAME_CLASS_NAME}>{bank.name}</span>
      {bank.archived ? (
        <Chip size="sm" variant="soft">
          {ARCHIVED_BANK_LABEL}
        </Chip>
      ) : null}
    </button>
  );
}
```

`BankCell/index.ts`

```ts
export { BankCell } from "./BankCell";
```

- [ ] **Step 5: Implement `BankRow`.** `BankRow/types.ts`

```ts
import type { Account } from "@/core/accounts/types";
import type { BankWithAccounts } from "@/core/banks/types";

export interface BankRowProps {
  bank: BankWithAccounts;
  onEditBank: (bankId: string) => void;
  onEditAccount: (account: Account) => void;
  // Starts a new account in the bank with this id.
  onAddAccount: (bankId: string) => void;
}
```

`BankRow/consts.ts`

```ts
export const accountsLabel = (bankName: string): string =>
  `Cuentas de ${bankName}`;
```

`BankRow/styles.ts`

```ts
// The tiles of a row, side by side at the height of the row.
export const TILES_CLASS_NAME = "flex items-stretch gap-3";

// The list item only carries its tile, so the tile can take the full height.
export const TILE_ITEM_CLASS_NAME = "flex";
```

`BankRow/BankRow.tsx`

```tsx
import { ROW_CLASS_NAME } from "@/components/Banks/styles";

import { AccountTile } from "./components/AccountTile";
import { AddAccountTile } from "./components/AddAccountTile";
import { BankCell } from "./components/BankCell";
import { accountsLabel } from "./consts";
import { TILE_ITEM_CLASS_NAME, TILES_CLASS_NAME } from "./styles";
import type { BankRowProps } from "./types";

// One swimlane: the bank in the first column, then one tile per account and, unless the bank is
// archived, the "+ cuenta" tile.
export function BankRow({
  bank,
  onEditBank,
  onEditAccount,
  onAddAccount,
}: BankRowProps) {
  return (
    <li className={ROW_CLASS_NAME}>
      <BankCell bank={bank} onEdit={onEditBank} />
      <ul className={TILES_CLASS_NAME} aria-label={accountsLabel(bank.name)}>
        {bank.accounts.map((account) => (
          <li key={account.id} className={TILE_ITEM_CLASS_NAME}>
            <AccountTile account={account} onEdit={onEditAccount} />
          </li>
        ))}
        {bank.archived ? null : (
          <li className={TILE_ITEM_CLASS_NAME}>
            <AddAccountTile
              bankId={bank.id}
              bankName={bank.name}
              onAdd={onAddAccount}
            />
          </li>
        )}
      </ul>
    </li>
  );
}
```

`BankRow/index.ts`

```ts
export { BankRow } from "./BankRow";
```

- [ ] **Step 6: Run and see them pass**

Run: `npx vitest run components/Banks/components/BanksBoard/components/BankRow`
Expected: PASS (17 tests: 5 AccountTile, 3 AddAccountTile, 4 BankCell, 5 BankRow).

- [ ] **Step 7: Verify**

Run: `npx vitest run components/componentStructure.test.ts components/Banks` then `npx tsc --noEmit` and `npx eslint components/Banks`
Expected: structure guard and tests PASS, no type or lint errors.

### Task 14: `BanksBoard` (the swimlane list and its empty states)

**Files:**

- Test: `components/Banks/components/BanksBoard/BanksBoard.test.tsx`
- Create: `components/Banks/components/BanksBoard/{BanksBoard.tsx,index.ts,types.ts,consts.ts}`

**Interfaces:**

- Consumes: `BankRow` and `BankRowProps` (Task 13), `BOARD_CLASS_NAME`, `EMPTY_CLASS_NAME` (`@/components/Banks/styles`), `BankWithAccounts`.
- Produces: `BanksBoard({ banks: readonly BankWithAccounts[], isSearching: boolean, onEditBank, onEditAccount, onAddAccount })`: a list named `Bancos y cuentas` (horizontally scrollable) with one `BankRow` per bank, or a status message when there are no banks (`Ningún banco ni cuenta coincide con la búsqueda.` while searching, `No hay bancos para mostrar. Creá uno desde el menú Acciones.` otherwise). It renders exactly the banks it is given: filtering happens outside.

- [ ] **Step 1: Write the failing test** `BanksBoard.test.tsx`

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BankWithAccounts } from "@/core/banks/types";

import { BanksBoard } from "./BanksBoard";

const BANKS: BankWithAccounts[] = [
  {
    id: "cash",
    name: "Efectivo",
    archived: false,
    accounts: [
      {
        id: "cash_ars",
        bankId: "cash",
        name: "Efectivo",
        currency: "ARS",
        archived: false,
      },
    ],
  },
  {
    id: "galicia",
    name: "Banco Galicia",
    archived: false,
    accounts: [
      {
        id: "gal_sav",
        bankId: "galicia",
        name: "Caja de ahorro",
        currency: "ARS",
        archived: false,
      },
      {
        id: "gal_usd",
        bankId: "galicia",
        name: "Cuenta en dólares",
        currency: "USD",
        archived: false,
      },
    ],
  },
];

const renderBoard = (
  banks: BankWithAccounts[] = BANKS,
  isSearching = false,
) => {
  const handlers = {
    onEditBank: vi.fn(),
    onEditAccount: vi.fn(),
    onAddAccount: vi.fn(),
  };

  render(<BanksBoard banks={banks} isSearching={isSearching} {...handlers} />);

  return handlers;
};

describe("BanksBoard", () => {
  it("shows one row per bank, in the order given, the bank first", () => {
    renderBoard();

    expect(
      screen
        .getAllByRole("button", { name: /^Editar banco / })
        .map((button) => button.textContent),
    ).toEqual(["Efectivo", "Banco Galicia"]);
  });

  it("shows the accounts of each bank in its own row, with '+ cuenta' last", () => {
    renderBoard();

    expect(
      within(screen.getByRole("list", { name: "Cuentas de Banco Galicia" }))
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Editar cuenta Caja de ahorro",
      "Editar cuenta Cuenta en dólares",
      "+ cuenta en Banco Galicia",
    ]);
    expect(
      within(screen.getByRole("list", { name: "Cuentas de Efectivo" }))
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Editar cuenta Efectivo", "+ cuenta en Efectivo"]);
  });

  it("scrolls sideways inside its own box, so a narrow screen never scrolls the page", () => {
    renderBoard();

    expect(screen.getByRole("list", { name: "Bancos y cuentas" })).toHaveClass(
      "overflow-x-auto",
    );
  });

  it("reports the bank, the account and the bank to add to", () => {
    const { onEditBank, onEditAccount, onAddAccount } = renderBoard();

    fireEvent.click(
      screen.getByRole("button", { name: "Editar banco Banco Galicia" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Editar cuenta Caja de ahorro" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "+ cuenta en Banco Galicia" }),
    );

    expect(onEditBank).toHaveBeenCalledWith("galicia");
    expect(onEditAccount).toHaveBeenCalledWith(BANKS[1].accounts[0]);
    expect(onAddAccount).toHaveBeenCalledWith("galicia");
  });

  it("says there is nothing to show when there are no banks", () => {
    renderBoard([]);

    expect(screen.getByRole("status")).toHaveTextContent(
      "No hay bancos para mostrar. Creá uno desde el menú Acciones.",
    );
    expect(screen.queryByRole("list", { name: "Bancos y cuentas" })).toBeNull();
  });

  it("says nothing matched while a search is active", () => {
    renderBoard([], true);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Ningún banco ni cuenta coincide con la búsqueda.",
    );
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run components/Banks/components/BanksBoard/BanksBoard.test.tsx`
Expected: FAIL, `Failed to resolve import "./BanksBoard"`.

- [ ] **Step 3: Implement.** `BanksBoard/types.ts`

```ts
import type { BankWithAccounts } from "@/core/banks/types";

import type { BankRowProps } from "./components/BankRow/types";

// The banks are shown exactly as given: the search and the archived toggle are applied by the
// caller (see core/banks/board.ts).
export interface BanksBoardProps extends Pick<
  BankRowProps,
  "onEditBank" | "onEditAccount" | "onAddAccount"
> {
  banks: readonly BankWithAccounts[];
  // Whether a search is active, which decides what an empty board says.
  isSearching: boolean;
}
```

`BanksBoard/consts.ts`

```ts
export const BOARD_LABEL = "Bancos y cuentas";

export const NO_BANKS_MESSAGE =
  "No hay bancos para mostrar. Creá uno desde el menú Acciones.";
export const NO_RESULTS_MESSAGE =
  "Ningún banco ni cuenta coincide con la búsqueda.";
```

`BanksBoard/BanksBoard.tsx`

```tsx
import { BOARD_CLASS_NAME, EMPTY_CLASS_NAME } from "@/components/Banks/styles";

import { BankRow } from "./components/BankRow";
import { BOARD_LABEL, NO_BANKS_MESSAGE, NO_RESULTS_MESSAGE } from "./consts";
import type { BanksBoardProps } from "./types";

// The swimlanes: one row per bank, the bank in the first column and the rest of the row holding one
// tile per account. It is not a table: the rows scroll sideways together on a narrow screen.
export function BanksBoard({
  banks,
  isSearching,
  onEditBank,
  onEditAccount,
  onAddAccount,
}: BanksBoardProps) {
  if (banks.length === 0) {
    return (
      <p role="status" className={EMPTY_CLASS_NAME}>
        {isSearching ? NO_RESULTS_MESSAGE : NO_BANKS_MESSAGE}
      </p>
    );
  }

  return (
    <ul className={BOARD_CLASS_NAME} aria-label={BOARD_LABEL}>
      {banks.map((bank) => (
        <BankRow
          key={bank.id}
          bank={bank}
          onEditBank={onEditBank}
          onEditAccount={onEditAccount}
          onAddAccount={onAddAccount}
        />
      ))}
    </ul>
  );
}
```

`BanksBoard/index.ts`

```ts
export { BanksBoard } from "./BanksBoard";
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run components/Banks/components/BanksBoard/BanksBoard.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Verify**

Run: `npx vitest run components/componentStructure.test.ts components/Banks` then `npx tsc --noEmit` and `npx eslint components/Banks`
Expected: structure guard and tests PASS, no type or lint errors.

### Task 15: `LoadingBoard`

**Files:**

- Test: `components/Banks/components/LoadingBoard/LoadingBoard.test.tsx`
- Create: `components/Banks/components/LoadingBoard/{LoadingBoard.tsx,index.ts,consts.ts,styles.ts}`

**Interfaces:**

- Consumes: HeroUI `Skeleton`, `BOARD_CLASS_NAME`, `ROW_CLASS_NAME` (`@/components/Banks/styles`).
- Produces: `LoadingBoard()`: a status region named `Cargando bancos y cuentas` with a few skeleton rows shaped like the real ones.

- [ ] **Step 1: Write the failing test** `LoadingBoard.test.tsx`

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingBoard } from "./LoadingBoard";

describe("LoadingBoard", () => {
  it("announces that the banks are loading", () => {
    render(<LoadingBoard />);

    expect(
      screen.getByRole("status", { name: "Cargando bancos y cuentas" }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("has no buttons: nothing can be pressed while there is no data", () => {
    render(<LoadingBoard />);

    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("scrolls sideways like the real board, so nothing shifts when it arrives", () => {
    render(<LoadingBoard />);

    expect(
      screen.getByRole("status", { name: "Cargando bancos y cuentas" }),
    ).toHaveClass("overflow-x-auto");
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run components/Banks/components/LoadingBoard`
Expected: FAIL, `Failed to resolve import "./LoadingBoard"`.

- [ ] **Step 3: Implement.** `LoadingBoard/consts.ts`

```ts
export const LOADING_LABEL = "Cargando bancos y cuentas";

// How many skeleton tiles each row shows: a few, and not the same in each, so it does not read as a
// grid of identical boxes. It says nothing about how many accounts there will be.
export const ROW_PLACEHOLDERS: readonly number[] = [2, 3, 1];
```

`LoadingBoard/styles.ts`

```ts
// The first column and a tile of a row, at the size of the real ones.
export const CELL_SKELETON_CLASS_NAME = "h-24 w-52 shrink-0 rounded-2xl";
export const TILE_SKELETON_CLASS_NAME = "h-24 w-44 shrink-0 rounded-2xl";
```

`LoadingBoard/LoadingBoard.tsx`

```tsx
import { Skeleton } from "@heroui/react";

import { BOARD_CLASS_NAME, ROW_CLASS_NAME } from "@/components/Banks/styles";

import { LOADING_LABEL, ROW_PLACEHOLDERS } from "./consts";
import { CELL_SKELETON_CLASS_NAME, TILE_SKELETON_CLASS_NAME } from "./styles";

// The board while its data is on its way: a few rows shaped like the real ones, so the page keeps
// its shape and nothing shifts when the real board replaces it.
export function LoadingBoard() {
  return (
    <div
      className={BOARD_CLASS_NAME}
      role="status"
      aria-busy="true"
      aria-label={LOADING_LABEL}
    >
      {ROW_PLACEHOLDERS.map((tiles, row) => (
        <div key={row} className={ROW_CLASS_NAME}>
          <Skeleton className={CELL_SKELETON_CLASS_NAME} />
          {Array.from({ length: tiles }, (_, tile) => (
            <Skeleton key={tile} className={TILE_SKELETON_CLASS_NAME} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

`LoadingBoard/index.ts`

```ts
export { LoadingBoard } from "./LoadingBoard";
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run components/Banks/components/LoadingBoard`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify**

Run: `npx vitest run components/componentStructure.test.ts components/Banks` then `npx tsc --noEmit` and `npx eslint components/Banks`
Expected: structure guard and tests PASS, no type or lint errors.

### Task 16: `BankFormDrawer` (create, edit, archive, reactivate a bank)

**Files:**

- Test: `components/Banks/components/BankFormDrawer/BankFormDrawer.test.tsx`
- Create: `components/Banks/types.ts`, `components/Banks/components/BankFormDrawer/{BankFormDrawer.tsx,BankFormContent.tsx,index.ts,types.ts,consts.ts,styles.ts}`

**Interfaces:**

- Consumes: `createBankAction`, `updateBankAction`, `archiveBankAction`, `unarchiveBankAction` (Task 9), `BANK_NAME_MAX_LENGTH`, `countActiveAccounts` (Task 7), `PendingButton`, `InlineAlert`, entries form styles.
- Produces:
  - `components/Banks/types.ts`: `BanksProps { board: Source<readonly BankWithAccounts[]> }`, `BankFormTarget { key: number; bank: BankWithAccounts | null }`, `AccountFormTarget { key: number; account: Account | null; bankId: string | null }`.
  - `BankFormDrawer({ isOpen, onOpenChange, onClose, target: BankFormTarget })`. Create mode (`target.bank === null`): heading "Crear banco", name field, button "Crear banco". Edit mode: heading "Editar banco", the name prefilled, "Guardar cambios", and an archive section with "Archivar banco" (disabled with a hint while the bank has active accounts) or "Reactivar banco" for an archived bank. A server refusal is shown as an alert.

- [ ] **Step 1: Write the failing test** `BankFormDrawer.test.tsx`

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createBankAction: vi.fn(),
  updateBankAction: vi.fn(),
  archiveBankAction: vi.fn(),
  unarchiveBankAction: vi.fn(),
}));

vi.mock("@/core/banks/actions", () => actions);

import type { BankWithAccounts } from "@/core/banks/types";

import type { BankFormTarget } from "../../types";
import { BankFormDrawer } from "./BankFormDrawer";

const account = (id: string, archived: boolean) => ({
  id,
  bankId: "bank_1",
  name: `Cuenta ${id}`,
  currency: "ARS",
  archived,
});

const WITH_ACTIVE_ACCOUNT: BankWithAccounts = {
  id: "bank_1",
  name: "Banco Galicia",
  archived: false,
  accounts: [account("a1", false), account("a2", true)],
};
const READY_TO_ARCHIVE: BankWithAccounts = {
  ...WITH_ACTIVE_ACCOUNT,
  accounts: [account("a1", true)],
};
const ARCHIVED: BankWithAccounts = {
  ...READY_TO_ARCHIVE,
  archived: true,
};

const renderForm = (target: BankFormTarget) => {
  const onClose = vi.fn();

  render(
    <BankFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
    />,
  );

  return { onClose };
};

const CREATE: BankFormTarget = { key: 1, bank: null };
const edit = (bank: BankWithAccounts): BankFormTarget => ({ key: 2, bank });

const nameInput = () => screen.getByRole("textbox", { name: /Nombre/ });
const sentForm = (action: ReturnType<typeof vi.fn>, index = 0): FormData =>
  action.mock.calls[0][index] as FormData;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("is titled 'Crear banco' and explains what a bank is", () => {
    renderForm(CREATE);

    expect(
      screen.getByRole("heading", { name: "Crear banco" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Un banco agrupa tus cuentas/)).toBeVisible();
  });

  it("has a create button with the plus icon, and a Cancel", () => {
    renderForm(CREATE);

    const button = screen.getByRole("button", { name: "Crear banco" });

    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("starts with an empty name limited to 40 characters, and offers no archive", () => {
    renderForm(CREATE);

    expect(nameInput()).toHaveValue("");
    expect(nameInput()).toHaveAttribute("maxlength", "40");
    expect(screen.queryByRole("button", { name: "Archivar banco" })).toBeNull();
  });

  it("sends the name through the create action and closes", async () => {
    actions.createBankAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CREATE);

    fireEvent.change(nameInput(), { target: { value: "Banco Galicia" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear banco" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentForm(actions.createBankAction).get("name")).toBe(
      "Banco Galicia",
    );
    expect(actions.updateBankAction).not.toHaveBeenCalled();
  });

  it("shows 'Creando banco…' with a spinner and locks Cancel while it saves", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.createBankAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { onClose } = renderForm(CREATE);

    fireEvent.change(nameInput(), { target: { value: "Galicia" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear banco" }));

    const pending = await screen.findByRole("button", {
      name: /Creando banco/,
    });

    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    finish({ status: "success" });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the error of the name field the server refused, and stays open", async () => {
    actions.createBankAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { name: ["Ya tenés un banco con este nombre."] },
    });
    const { onClose } = renderForm(CREATE);

    fireEvent.change(nameInput(), { target: { value: "galicia" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear banco" }));

    expect(
      await screen.findByText("Ya tenés un banco con este nombre."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a failure that belongs to no field as an alert", async () => {
    actions.createBankAction.mockResolvedValue({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    renderForm(CREATE);

    fireEvent.change(nameInput(), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear banco" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo salió mal. Inténtalo de nuevo.",
    );
  });
});

describe("edit mode", () => {
  it("is titled 'Editar banco' and starts with the name of the bank", () => {
    renderForm(edit(WITH_ACTIVE_ACCOUNT));

    expect(
      screen.getByRole("heading", { name: "Editar banco" }),
    ).toBeInTheDocument();
    expect(nameInput()).toHaveValue("Banco Galicia");
  });

  it("saves through the update action with the id of the bank, and closes", async () => {
    actions.updateBankAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit(WITH_ACTIVE_ACCOUNT));

    fireEvent.change(nameInput(), { target: { value: "Galicia" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.updateBankAction.mock.calls[0][0]).toBe("bank_1");
    expect(sentForm(actions.updateBankAction, 1).get("name")).toBe("Galicia");
    expect(actions.createBankAction).not.toHaveBeenCalled();
  });

  it("cannot archive a bank that still has active accounts, and says why", () => {
    renderForm(edit(WITH_ACTIVE_ACCOUNT));

    expect(
      screen.getByRole("button", { name: "Archivar banco" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Para archivar este banco, archivá primero todas sus cuentas.",
      ),
    ).toBeVisible();
  });

  it("archives a bank whose accounts are all archived, and closes", async () => {
    actions.archiveBankAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit(READY_TO_ARCHIVE));

    fireEvent.click(screen.getByRole("button", { name: "Archivar banco" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.archiveBankAction).toHaveBeenCalledWith("bank_1");
  });

  it("shows 'Archivando…' with a spinner while the bank is being archived", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.archiveBankAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { onClose } = renderForm(edit(READY_TO_ARCHIVE));

    fireEvent.click(screen.getByRole("button", { name: "Archivar banco" }));

    const pending = await screen.findByRole("button", { name: /Archivando/ });

    expect(pending.querySelector(".spinner")).not.toBeNull();

    finish({ status: "success" });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the refusal of the server (an account was reactivated meanwhile) as an alert and stays open", async () => {
    actions.archiveBankAction.mockResolvedValue({
      status: "error",
      message: "Este banco todavía tiene 1 cuenta activa. Archivala primero.",
    });
    const { onClose } = renderForm(edit(READY_TO_ARCHIVE));

    fireEvent.click(screen.getByRole("button", { name: "Archivar banco" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este banco todavía tiene 1 cuenta activa. Archivala primero.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("offers to reactivate an archived bank instead, and does so through the unarchive action", async () => {
    actions.unarchiveBankAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit(ARCHIVED));

    expect(screen.queryByRole("button", { name: "Archivar banco" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reactivar banco" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.unarchiveBankAction).toHaveBeenCalledWith("bank_1");
    expect(actions.archiveBankAction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run components/Banks/components/BankFormDrawer`
Expected: FAIL, `Failed to resolve import "./BankFormDrawer"` (and `../../types`).

- [ ] **Step 3: Create the page types.** `components/Banks/types.ts`

```ts
import type { Source } from "@/components/shared/Await";
import type { Account } from "@/core/accounts/types";
import type { BankWithAccounts } from "@/core/banks/types";

// The data is a `Source`: the value itself, or a promise of it while it loads. The page renders its
// header and toolbar at once and the board waits only for its own piece.
export interface BanksProps {
  board: Source<readonly BankWithAccounts[]>;
}

// What the bank drawer is currently showing: a new bank, or the bank being edited (with its
// accounts, which decide whether it can be archived). The key remounts the form so every opening
// starts from fresh defaults and cleared errors.
export interface BankFormTarget {
  key: number;
  bank: BankWithAccounts | null;
}

// What the account drawer is currently showing: a new account (in `bankId` when the "+ cuenta" tile
// of a bank was pressed, in no bank yet when it came from the Actions menu), or the account being
// edited.
export interface AccountFormTarget {
  key: number;
  account: Account | null;
  bankId: string | null;
}
```

- [ ] **Step 4: Implement the drawer.** `BankFormDrawer/types.ts`

```ts
import type { BankFormTarget } from "../../types";

export interface BankFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: BankFormTarget;
}

export type BankFormContentProps = Pick<
  BankFormDrawerProps,
  "onClose" | "target"
>;
```

`BankFormDrawer/consts.ts`

```ts
export const FORM_ID = "bank-form";

export const CREATE_HEADING = "Crear banco";
export const EDIT_HEADING = "Editar banco";
export const CREATE_SUBMIT_LABEL = "Crear banco";
export const EDIT_SUBMIT_LABEL = "Guardar cambios";
// What the submit button says while the save is in flight.
export const CREATE_PENDING_LABEL = "Creando banco…";
export const EDIT_PENDING_LABEL = "Guardando…";

export const CREATE_DESCRIPTION =
  "Un banco agrupa tus cuentas: una cuenta bancaria, una billetera virtual o el efectivo.";
export const EDIT_DESCRIPTION = "Actualizá el nombre de este banco.";

export const NAME_FIELD_NAME = "name";
export const NAME_LABEL = "Nombre";
export const NAME_PLACEHOLDER = "Ej.: Banco Galicia";

export const ARCHIVE_SECTION_LABEL = "Archivo";
export const ARCHIVE_LABEL = "Archivar banco";
export const ARCHIVE_PENDING_LABEL = "Archivando…";
export const UNARCHIVE_LABEL = "Reactivar banco";
export const UNARCHIVE_PENDING_LABEL = "Reactivando…";

// What the archive section says: a bank is archived only when all its accounts are.
export const bankArchiveHint = (
  isArchived: boolean,
  activeAccounts: number,
): string => {
  if (isArchived) {
    return "Este banco está archivado: no aparece en el tablero salvo que muestres los archivados. Reactivalo para volver a usarlo.";
  }

  if (activeAccounts > 0) {
    return "Para archivar este banco, archivá primero todas sus cuentas.";
  }

  return "Archivar oculta el banco del tablero. No se borra nada y podés reactivarlo cuando quieras.";
};
```

`BankFormDrawer/styles.ts`

```ts
// The archive controls, set apart from the form above them.
export const ARCHIVE_SECTION_CLASS_NAME =
  "mt-6 flex flex-col items-start gap-3 border-t border-border pt-4";
```

`BankFormDrawer/BankFormDrawer.tsx`

```tsx
import { Drawer } from "@heroui/react";

import { DRAWER_DIALOG_CLASS_NAME } from "@/components/Entries/styles";

import { BankFormContent } from "./BankFormContent";
import type { BankFormDrawerProps } from "./types";

export function BankFormDrawer({
  isOpen,
  onOpenChange,
  onClose,
  target,
}: BankFormDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DRAWER_DIALOG_CLASS_NAME}>
          <BankFormContent key={target.key} target={target} onClose={onClose} />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
```

`BankFormDrawer/BankFormContent.tsx`

```tsx
import { PlusIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { CANCEL_LABEL } from "@/components/Entries/formConsts";
import {
  DRAWER_DESCRIPTION_CLASS_NAME,
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  FORM_CLASS_NAME,
} from "@/components/Entries/styles";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import {
  archiveBankAction,
  createBankAction,
  unarchiveBankAction,
  updateBankAction,
} from "@/core/banks/actions";
import { countActiveAccounts } from "@/core/banks/board";
import { BANK_NAME_MAX_LENGTH } from "@/core/banks/consts";
import type { BanksFieldErrors } from "@/core/banks/types";

import {
  ARCHIVE_LABEL,
  ARCHIVE_PENDING_LABEL,
  ARCHIVE_SECTION_LABEL,
  bankArchiveHint,
  CREATE_DESCRIPTION,
  CREATE_HEADING,
  CREATE_PENDING_LABEL,
  CREATE_SUBMIT_LABEL,
  EDIT_DESCRIPTION,
  EDIT_HEADING,
  EDIT_PENDING_LABEL,
  EDIT_SUBMIT_LABEL,
  FORM_ID,
  NAME_FIELD_NAME,
  NAME_LABEL,
  NAME_PLACEHOLDER,
  UNARCHIVE_LABEL,
  UNARCHIVE_PENDING_LABEL,
} from "./consts";
import { ARCHIVE_SECTION_CLASS_NAME } from "./styles";
import type { BankFormContentProps } from "./types";

// Mounted with a fresh key on every opening, so field defaults and errors always reset.
export function BankFormContent({ target, onClose }: BankFormContentProps) {
  const { bank } = target;
  const [isSaving, startSave] = useTransition();
  const [isArchiving, startArchive] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<BanksFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const activeAccounts = bank ? countActiveAccounts(bank) : 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startSave(async () => {
      const result = bank
        ? await updateBankAction(bank.id, formData)
        : await createBankAction(formData);

      if (result.status === "success") {
        onClose();

        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors ? null : result.message);
    });
  };

  // A bank is archived only when all its accounts are: the button is disabled until then, and the
  // server enforces the rule anyway (a refusal is shown as an alert).
  const handleArchiveToggle = () => {
    if (!bank) {
      return;
    }

    startArchive(async () => {
      const result = bank.archived
        ? await unarchiveBankAction(bank.id)
        : await archiveBankAction(bank.id);

      if (result.status === "success") {
        onClose();

        return;
      }

      setFormError(result.message);
    });
  };

  return (
    <>
      <Drawer.CloseTrigger />
      <Drawer.Header>
        <Drawer.Heading>{bank ? EDIT_HEADING : CREATE_HEADING}</Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
          {bank ? EDIT_DESCRIPTION : CREATE_DESCRIPTION}
        </p>
      </Drawer.Header>
      <Drawer.Body>
        <Form
          id={FORM_ID}
          className={FORM_CLASS_NAME}
          validationErrors={fieldErrors}
          onSubmit={handleSubmit}
        >
          <TextField
            isRequired
            autoFocus
            className={FIELD_CLASS_NAME}
            name={NAME_FIELD_NAME}
            maxLength={BANK_NAME_MAX_LENGTH}
            defaultValue={bank?.name ?? ""}
          >
            <Label>{NAME_LABEL}</Label>
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              placeholder={NAME_PLACEHOLDER}
            />
            <FieldError />
          </TextField>

          {formError ? (
            <InlineAlert variant="error">{formError}</InlineAlert>
          ) : null}
        </Form>

        {bank ? (
          <section
            className={ARCHIVE_SECTION_CLASS_NAME}
            aria-label={ARCHIVE_SECTION_LABEL}
          >
            <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
              {bankArchiveHint(bank.archived, activeAccounts)}
            </p>
            <PendingButton
              type="button"
              variant="secondary"
              isPending={isArchiving}
              isDisabled={isSaving || (!bank.archived && activeAccounts > 0)}
              label={bank.archived ? UNARCHIVE_LABEL : ARCHIVE_LABEL}
              pendingLabel={
                bank.archived ? UNARCHIVE_PENDING_LABEL : ARCHIVE_PENDING_LABEL
              }
              onPress={handleArchiveToggle}
            />
          </section>
        ) : null}
      </Drawer.Body>
      <Drawer.Footer>
        <Button
          slot="close"
          variant="tertiary"
          isDisabled={isSaving || isArchiving}
        >
          {CANCEL_LABEL}
        </Button>
        <PendingButton
          type="submit"
          form={FORM_ID}
          isPending={isSaving}
          isDisabled={isArchiving}
          Icon={bank ? undefined : PlusIcon}
          label={bank ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL}
          pendingLabel={bank ? EDIT_PENDING_LABEL : CREATE_PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
```

`BankFormDrawer/index.ts`

```ts
export { BankFormDrawer } from "./BankFormDrawer";
```

- [ ] **Step 5: Run and see it pass**

Run: `npx vitest run components/Banks/components/BankFormDrawer`
Expected: PASS (14 tests).

- [ ] **Step 6: Verify**

Run: `npx vitest run components/componentStructure.test.ts components/shared/PendingButton components/Banks` then `npx tsc --noEmit` and `npx eslint components/Banks`
Expected: structure and PendingButton guards plus tests PASS, no type or lint errors.

### Task 17: `AccountFormDrawer` (create, edit, archive, reactivate an account)

**Files:**

- Test: `components/Banks/components/AccountFormDrawer/AccountFormDrawer.test.tsx`, `components/Banks/components/AccountFormDrawer/utils.test.ts`
- Create: `components/Banks/components/AccountFormDrawer/{AccountFormDrawer.tsx,AccountFormContent.tsx,index.ts,types.ts,consts.ts,styles.ts,utils.ts}`

**Interfaces:**

- Consumes: `createAccountAction`, `updateAccountAction`, `archiveAccountAction`, `unarchiveAccountAction` (Task 10), `AccountFormTarget` (Task 16), `Bank` (Task 3), `ACCOUNT_NAME_MAX_LENGTH`, `CURRENCY_OPTIONS`, `CURRENCY_LABEL`, `CURRENCY_PLACEHOLDER`, `DEFAULT_CURRENCY_CODE` (`@/core/incomes/consts`).
- Produces:
  - `pickDefaultBankId(bankId: string | null, banks: readonly Bank[]): string | undefined` in `utils.ts`: the bank the drawer opens with (the one asked for if it is among `banks`, else the only bank when there is exactly one, else none).
  - `AccountFormDrawer({ isOpen, onOpenChange, onClose, target: AccountFormTarget, banks: readonly Bank[] })`. Create mode: heading "Crear cuenta", a "Banco" select (the active `banks`, the default from `pickDefaultBankId`), "Nombre", "Moneda" (default ARS), button "Crear cuenta"; with no banks it says "Primero creá un banco para poder agregarle cuentas." and the button is disabled. Edit mode: heading "Editar cuenta", no bank select (an edit never moves an account), name and currency prefilled, "Guardar cambios", archive section with "Archivar cuenta" / "Reactivar cuenta".

- [ ] **Step 1: Write the failing tests.** `utils.test.ts`

```ts
import { describe, expect, it } from "vitest";

import type { Bank } from "@/core/banks/types";

import { pickDefaultBankId } from "./utils";

const BANK_A: Bank = { id: "a", name: "Efectivo", archived: false };
const BANK_B: Bank = { id: "b", name: "Banco Galicia", archived: false };

describe("pickDefaultBankId", () => {
  it("uses the bank that was asked for when it is one of the banks", () => {
    expect(pickDefaultBankId("b", [BANK_A, BANK_B])).toBe("b");
  });

  it("uses the only bank when there is exactly one and none was asked for", () => {
    expect(pickDefaultBankId(null, [BANK_A])).toBe("a");
  });

  it("chooses nothing when there are several banks and none was asked for", () => {
    expect(pickDefaultBankId(null, [BANK_A, BANK_B])).toBeUndefined();
  });

  it("ignores a bank that is not among the banks (an archived or unknown one)", () => {
    expect(pickDefaultBankId("gone", [BANK_A, BANK_B])).toBeUndefined();
    expect(pickDefaultBankId("gone", [BANK_A])).toBe("a");
  });

  it("chooses nothing when there are no banks", () => {
    expect(pickDefaultBankId(null, [])).toBeUndefined();
  });
});
```

`AccountFormDrawer.test.tsx`

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createAccountAction: vi.fn(),
  updateAccountAction: vi.fn(),
  archiveAccountAction: vi.fn(),
  unarchiveAccountAction: vi.fn(),
}));

vi.mock("@/core/accounts/actions", () => actions);

import type { Account } from "@/core/accounts/types";
import type { Bank } from "@/core/banks/types";

import type { AccountFormTarget } from "../../types";
import { AccountFormDrawer } from "./AccountFormDrawer";

const CASH: Bank = { id: "bank_cash", name: "Efectivo", archived: false };
const GALICIA: Bank = {
  id: "bank_galicia",
  name: "Banco Galicia",
  archived: false,
};

const ACCOUNT: Account = {
  id: "acc_1",
  bankId: "bank_galicia",
  name: "Cuenta en dólares",
  currency: "USD",
  archived: false,
};

const renderForm = (
  target: AccountFormTarget,
  banks: readonly Bank[] = [CASH, GALICIA],
) => {
  const onClose = vi.fn();

  render(
    <AccountFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
      banks={banks}
    />,
  );

  return { onClose };
};

const CREATE: AccountFormTarget = { key: 1, account: null, bankId: null };
const edit = (account: Account): AccountFormTarget => ({
  key: 2,
  account,
  bankId: null,
});

const nameInput = () => screen.getByRole("textbox", { name: /Nombre/ });
const bankTrigger = () => screen.getByRole("button", { name: /^Banco/ });
const currencyTrigger = () => screen.getByRole("button", { name: /Moneda/ });
const sentForm = (action: ReturnType<typeof vi.fn>, index = 0): FormData =>
  action.mock.calls[0][index] as FormData;

const pickBank = async (name: string) => {
  fireEvent.keyDown(bankTrigger(), { key: "ArrowDown" });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("is titled 'Crear cuenta' and says an account holds one currency", () => {
    renderForm(CREATE);

    expect(
      screen.getByRole("heading", { name: "Crear cuenta" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/guarda dinero en una sola moneda/)).toBeVisible();
  });

  it("asks for the bank, the name and the currency, and offers no archive", () => {
    renderForm(CREATE);

    expect(bankTrigger()).toBeVisible();
    expect(nameInput()).toHaveValue("");
    expect(nameInput()).toHaveAttribute("maxlength", "40");
    expect(currencyTrigger()).toHaveTextContent("ARS");
    expect(
      screen.queryByRole("button", { name: "Archivar cuenta" }),
    ).toBeNull();
  });

  it("has a create button with the plus icon, and a Cancel", () => {
    renderForm(CREATE);

    const button = screen.getByRole("button", { name: "Crear cuenta" });

    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("starts with the bank whose '+ cuenta' tile was pressed", () => {
    renderForm({ key: 1, account: null, bankId: "bank_galicia" });

    expect(bankTrigger()).toHaveTextContent("Banco Galicia");
  });

  it("starts with the only bank when there is exactly one", () => {
    renderForm(CREATE, [CASH]);

    expect(bankTrigger()).toHaveTextContent("Efectivo");
  });

  it("asks to choose a bank when there are several and none was asked for", () => {
    renderForm(CREATE);

    expect(bankTrigger()).toHaveTextContent("Seleccioná un banco");
  });

  it("offers only the banks it is given", async () => {
    renderForm(CREATE);

    fireEvent.keyDown(bankTrigger(), { key: "ArrowDown" });

    expect(
      await screen.findByRole("option", { name: "Efectivo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Banco Galicia" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("sends the bank, the name and the currency through the create action, and closes", async () => {
    actions.createAccountAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CREATE);

    await pickBank("Banco Galicia");
    fireEvent.change(nameInput(), { target: { value: "Caja de ahorro" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const form = sentForm(actions.createAccountAction);

    expect(form.get("bankId")).toBe("bank_galicia");
    expect(form.get("name")).toBe("Caja de ahorro");
    expect(form.get("currency")).toBe("ARS");
    expect(actions.updateAccountAction).not.toHaveBeenCalled();
  });

  it("shows 'Creando cuenta…' with a spinner and locks Cancel while it saves", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.createAccountAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { onClose } = renderForm({
      key: 1,
      account: null,
      bankId: "bank_cash",
    });

    fireEvent.change(nameInput(), { target: { value: "Caja" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    const pending = await screen.findByRole("button", {
      name: /Creando cuenta/,
    });

    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    finish({ status: "success" });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the error of the name field the server refused, and stays open", async () => {
    actions.createAccountAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        name: ["Ya tenés una cuenta con este nombre en este banco."],
      },
    });
    const { onClose } = renderForm({
      key: 1,
      account: null,
      bankId: "bank_cash",
    });

    fireEvent.change(nameInput(), { target: { value: "efectivo" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByText(
        "Ya tenés una cuenta con este nombre en este banco.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a failure that belongs to no field (an archived bank) as an alert", async () => {
    actions.createAccountAction.mockResolvedValue({
      status: "error",
      message: "Este banco está archivado. Reactivalo primero.",
    });
    renderForm({ key: 1, account: null, bankId: "bank_cash" });

    fireEvent.change(nameInput(), { target: { value: "Caja" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este banco está archivado. Reactivalo primero.",
    );
  });

  it("with no banks, says to create one first and cannot be submitted", () => {
    renderForm(CREATE, []);

    expect(
      screen.getByText("Primero creá un banco para poder agregarle cuentas."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Banco/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeDisabled();
  });
});

describe("edit mode", () => {
  it("is titled 'Editar cuenta' and starts with the name and the currency of the account", () => {
    renderForm(edit(ACCOUNT));

    expect(
      screen.getByRole("heading", { name: "Editar cuenta" }),
    ).toBeInTheDocument();
    expect(nameInput()).toHaveValue("Cuenta en dólares");
    expect(currencyTrigger()).toHaveTextContent("USD");
  });

  it("has no bank to choose: an edit never moves an account", () => {
    renderForm(edit(ACCOUNT));

    expect(screen.queryByRole("button", { name: /^Banco/ })).toBeNull();
  });

  it("saves through the update action with the id of the account, and never sends a bank", async () => {
    actions.updateAccountAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit(ACCOUNT));

    fireEvent.change(nameInput(), { target: { value: "Dólares" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.updateAccountAction.mock.calls[0][0]).toBe("acc_1");

    const form = sentForm(actions.updateAccountAction, 1);

    expect(form.get("name")).toBe("Dólares");
    expect(form.get("currency")).toBe("USD");
    expect(form.has("bankId")).toBe(false);
    expect(actions.createAccountAction).not.toHaveBeenCalled();
  });

  it("archives the account through the archive action, and closes", async () => {
    actions.archiveAccountAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit(ACCOUNT));

    fireEvent.click(screen.getByRole("button", { name: "Archivar cuenta" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.archiveAccountAction).toHaveBeenCalledWith("acc_1");
  });

  it("offers to reactivate an archived account instead, through the unarchive action", async () => {
    actions.unarchiveAccountAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit({ ...ACCOUNT, archived: true }));

    expect(
      screen.queryByRole("button", { name: "Archivar cuenta" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reactivar cuenta" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.unarchiveAccountAction).toHaveBeenCalledWith("acc_1");
    expect(actions.archiveAccountAction).not.toHaveBeenCalled();
  });

  it("explains that the bank must be reactivated first when the server refuses to bring the account back", async () => {
    actions.unarchiveAccountAction.mockResolvedValue({
      status: "error",
      message: "Este banco está archivado. Reactivalo primero.",
    });
    const { onClose } = renderForm(edit({ ...ACCOUNT, archived: true }));

    fireEvent.click(screen.getByRole("button", { name: "Reactivar cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este banco está archivado. Reactivalo primero.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows 'Archivando…' with a spinner while the account is being archived", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.archiveAccountAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { onClose } = renderForm(edit(ACCOUNT));

    fireEvent.click(screen.getByRole("button", { name: "Archivar cuenta" }));

    const pending = await screen.findByRole("button", { name: /Archivando/ });

    expect(pending.querySelector(".spinner")).not.toBeNull();

    finish({ status: "success" });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run components/Banks/components/AccountFormDrawer`
Expected: FAIL, `Failed to resolve import "./utils"` and `"./AccountFormDrawer"`.

- [ ] **Step 3: Implement.** `AccountFormDrawer/utils.ts`

```ts
import type { Bank } from "@/core/banks/types";

// The bank the drawer opens with: the one asked for (the "+ cuenta" tile of a bank) when it is among
// the banks an account can be created in, else the only bank when there is exactly one, else none.
export const pickDefaultBankId = (
  bankId: string | null,
  banks: readonly Bank[],
): string | undefined => {
  if (bankId !== null && banks.some((bank) => bank.id === bankId)) {
    return bankId;
  }

  return banks.length === 1 ? banks[0].id : undefined;
};
```

`AccountFormDrawer/types.ts`

```ts
import type { Bank } from "@/core/banks/types";

import type { AccountFormTarget } from "../../types";

export interface AccountFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: AccountFormTarget;
  // The banks an account can be created in: the active ones.
  banks: readonly Bank[];
}

export type AccountFormContentProps = Pick<
  AccountFormDrawerProps,
  "onClose" | "target" | "banks"
>;
```

`AccountFormDrawer/consts.ts`

```ts
export const FORM_ID = "account-form";

export const CREATE_HEADING = "Crear cuenta";
export const EDIT_HEADING = "Editar cuenta";
export const CREATE_SUBMIT_LABEL = "Crear cuenta";
export const EDIT_SUBMIT_LABEL = "Guardar cambios";
// What the submit button says while the save is in flight.
export const CREATE_PENDING_LABEL = "Creando cuenta…";
export const EDIT_PENDING_LABEL = "Guardando…";

export const CREATE_DESCRIPTION =
  "Una cuenta guarda dinero en una sola moneda y pertenece a un banco.";
export const EDIT_DESCRIPTION =
  "Actualizá el nombre o la moneda de esta cuenta.";

export const BANK_FIELD_NAME = "bankId";
export const BANK_LABEL = "Banco";
export const BANK_PLACEHOLDER = "Seleccioná un banco";
export const NO_BANKS_HINT =
  "Primero creá un banco para poder agregarle cuentas.";

export const NAME_FIELD_NAME = "name";
export const NAME_LABEL = "Nombre";
export const NAME_PLACEHOLDER = "Ej.: Caja de ahorro";

export const CURRENCY_FIELD_NAME = "currency";

export const ARCHIVE_SECTION_LABEL = "Archivo";
export const ARCHIVE_LABEL = "Archivar cuenta";
export const ARCHIVE_PENDING_LABEL = "Archivando…";
export const UNARCHIVE_LABEL = "Reactivar cuenta";
export const UNARCHIVE_PENDING_LABEL = "Reactivando…";

export const accountArchiveHint = (isArchived: boolean): string =>
  isArchived
    ? "Esta cuenta está archivada: no aparece en el tablero salvo que muestres los archivados. Reactivala para volver a usarla."
    : "Archivar oculta la cuenta del tablero. No se borra nada y podés reactivarla cuando quieras.";
```

`AccountFormDrawer/styles.ts`

```ts
// The archive controls, set apart from the form above them.
export const ARCHIVE_SECTION_CLASS_NAME =
  "mt-6 flex flex-col items-start gap-3 border-t border-border pt-4";
```

`AccountFormDrawer/AccountFormDrawer.tsx`

```tsx
import { Drawer } from "@heroui/react";

import { DRAWER_DIALOG_CLASS_NAME } from "@/components/Entries/styles";

import { AccountFormContent } from "./AccountFormContent";
import type { AccountFormDrawerProps } from "./types";

export function AccountFormDrawer({
  isOpen,
  onOpenChange,
  onClose,
  target,
  banks,
}: AccountFormDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DRAWER_DIALOG_CLASS_NAME}>
          <AccountFormContent
            key={target.key}
            target={target}
            banks={banks}
            onClose={onClose}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
```

`AccountFormDrawer/AccountFormContent.tsx`

```tsx
import { PlusIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";
import {
  CANCEL_LABEL,
  CURRENCY_LABEL,
  CURRENCY_PLACEHOLDER,
} from "@/components/Entries/formConsts";
import {
  DRAWER_DESCRIPTION_CLASS_NAME,
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  FORM_CLASS_NAME,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import {
  archiveAccountAction,
  createAccountAction,
  unarchiveAccountAction,
  updateAccountAction,
} from "@/core/accounts/actions";
import { ACCOUNT_NAME_MAX_LENGTH } from "@/core/accounts/consts";
import type { BanksFieldErrors } from "@/core/banks/types";
import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";

import {
  accountArchiveHint,
  ARCHIVE_LABEL,
  ARCHIVE_PENDING_LABEL,
  ARCHIVE_SECTION_LABEL,
  BANK_FIELD_NAME,
  BANK_LABEL,
  BANK_PLACEHOLDER,
  CREATE_DESCRIPTION,
  CREATE_HEADING,
  CREATE_PENDING_LABEL,
  CREATE_SUBMIT_LABEL,
  CURRENCY_FIELD_NAME,
  EDIT_DESCRIPTION,
  EDIT_HEADING,
  EDIT_PENDING_LABEL,
  EDIT_SUBMIT_LABEL,
  FORM_ID,
  NAME_FIELD_NAME,
  NAME_LABEL,
  NAME_PLACEHOLDER,
  NO_BANKS_HINT,
  UNARCHIVE_LABEL,
  UNARCHIVE_PENDING_LABEL,
} from "./consts";
import { ARCHIVE_SECTION_CLASS_NAME } from "./styles";
import type { AccountFormContentProps } from "./types";
import { pickDefaultBankId } from "./utils";

// Mounted with a fresh key on every opening, so field defaults and errors always reset.
export function AccountFormContent({
  target,
  banks,
  onClose,
}: AccountFormContentProps) {
  const { account, bankId } = target;
  const [isSaving, startSave] = useTransition();
  const [isArchiving, startArchive] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<BanksFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  // A new account needs a bank to go to; an edit never moves it.
  const hasNoBanks = !account && banks.length === 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startSave(async () => {
      const result = account
        ? await updateAccountAction(account.id, formData)
        : await createAccountAction(formData);

      if (result.status === "success") {
        onClose();

        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors ? null : result.message);
    });
  };

  // The server refuses to bring an account back under an archived bank (its message is shown as an
  // alert).
  const handleArchiveToggle = () => {
    if (!account) {
      return;
    }

    startArchive(async () => {
      const result = account.archived
        ? await unarchiveAccountAction(account.id)
        : await archiveAccountAction(account.id);

      if (result.status === "success") {
        onClose();

        return;
      }

      setFormError(result.message);
    });
  };

  return (
    <>
      <Drawer.CloseTrigger />
      <Drawer.Header>
        <Drawer.Heading>
          {account ? EDIT_HEADING : CREATE_HEADING}
        </Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
          {account ? EDIT_DESCRIPTION : CREATE_DESCRIPTION}
        </p>
      </Drawer.Header>
      <Drawer.Body>
        <Form
          id={FORM_ID}
          className={FORM_CLASS_NAME}
          validationErrors={fieldErrors}
          onSubmit={handleSubmit}
        >
          {hasNoBanks ? (
            <p className={DRAWER_DESCRIPTION_CLASS_NAME}>{NO_BANKS_HINT}</p>
          ) : null}

          {account || hasNoBanks ? null : (
            <Select
              isRequired
              variant={FIELD_VARIANT}
              className={FIELD_CLASS_NAME}
              name={BANK_FIELD_NAME}
              placeholder={BANK_PLACEHOLDER}
              defaultValue={pickDefaultBankId(bankId, banks)}
            >
              <Label>{BANK_LABEL}</Label>
              <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {banks.map((bank) => (
                    <ListBox.Item
                      key={bank.id}
                      id={bank.id}
                      textValue={bank.name}
                    >
                      {bank.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
              <FieldError />
            </Select>
          )}

          <TextField
            isRequired
            autoFocus
            className={FIELD_CLASS_NAME}
            name={NAME_FIELD_NAME}
            maxLength={ACCOUNT_NAME_MAX_LENGTH}
            defaultValue={account?.name ?? ""}
          >
            <Label>{NAME_LABEL}</Label>
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              placeholder={NAME_PLACEHOLDER}
            />
            <FieldError />
          </TextField>

          <Select
            isRequired
            variant={FIELD_VARIANT}
            className={FIELD_CLASS_NAME}
            name={CURRENCY_FIELD_NAME}
            placeholder={CURRENCY_PLACEHOLDER}
            defaultValue={account?.currency ?? DEFAULT_CURRENCY_CODE}
          >
            <Label>{CURRENCY_LABEL}</Label>
            <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {CURRENCY_OPTIONS.map(({ code, label }) => (
                  <ListBox.Item key={code} id={code} textValue={label}>
                    {label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
            <FieldError />
          </Select>

          {formError ? (
            <InlineAlert variant="error">{formError}</InlineAlert>
          ) : null}
        </Form>

        {account ? (
          <section
            className={ARCHIVE_SECTION_CLASS_NAME}
            aria-label={ARCHIVE_SECTION_LABEL}
          >
            <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
              {accountArchiveHint(account.archived)}
            </p>
            <PendingButton
              type="button"
              variant="secondary"
              isPending={isArchiving}
              isDisabled={isSaving}
              label={account.archived ? UNARCHIVE_LABEL : ARCHIVE_LABEL}
              pendingLabel={
                account.archived
                  ? UNARCHIVE_PENDING_LABEL
                  : ARCHIVE_PENDING_LABEL
              }
              onPress={handleArchiveToggle}
            />
          </section>
        ) : null}
      </Drawer.Body>
      <Drawer.Footer>
        <Button
          slot="close"
          variant="tertiary"
          isDisabled={isSaving || isArchiving}
        >
          {CANCEL_LABEL}
        </Button>
        <PendingButton
          type="submit"
          form={FORM_ID}
          isPending={isSaving}
          isDisabled={isArchiving || hasNoBanks}
          Icon={account ? undefined : PlusIcon}
          label={account ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL}
          pendingLabel={account ? EDIT_PENDING_LABEL : CREATE_PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
```

`AccountFormDrawer/index.ts`

```ts
export { AccountFormDrawer } from "./AccountFormDrawer";
```

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run components/Banks/components/AccountFormDrawer`
Expected: PASS (5 + 19 tests). If the bank option lookup in a test fails in jsdom (the `pickBank` helper opens the listbox with `ArrowDown` on the trigger, the same pattern `EntriesFilters.test.tsx` and `RepaymentPlannerDrawer.test.tsx` use), compare with that helper before changing the component.

- [ ] **Step 5: Verify**

Run: `npx vitest run components/componentStructure.test.ts components/shared/PendingButton components/Banks` then `npx tsc --noEmit` and `npx eslint components/Banks`
Expected: guards and tests PASS, no type or lint errors.

### Task 18: `BanksToolbar` (search field and "Mostrar archivados" switch)

**Files:**

- Test: `components/Banks/components/BanksToolbar/BanksToolbar.test.tsx`
- Create: `components/Banks/components/BanksToolbar/{BanksToolbar.tsx,index.ts,types.ts,consts.ts,styles.ts}`

**Interfaces:**

- Consumes: HeroUI `SearchField`, `Switch`; `FIELD_VARIANT` (`@/components/Entries/styles`).
- Produces: `BanksToolbar({ query: string, onQueryChange: (query: string) => void, showArchived: boolean, onShowArchivedChange: (showArchived: boolean) => void })`: a controlled search field (accessible name `Buscar bancos y cuentas`) and a switch named `Mostrar archivados`.

- [ ] **Step 1: Write the failing test** `BanksToolbar.test.tsx`

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BanksToolbar } from "./BanksToolbar";

const renderToolbar = (query = "", showArchived = false) => {
  const handlers = { onQueryChange: vi.fn(), onShowArchivedChange: vi.fn() };

  render(
    <BanksToolbar query={query} showArchived={showArchived} {...handlers} />,
  );

  return handlers;
};

const search = () =>
  screen.getByRole("searchbox", { name: "Buscar bancos y cuentas" });
const toggle = () => screen.getByRole("switch", { name: "Mostrar archivados" });

describe("BanksToolbar", () => {
  it("has a search field with a Spanish placeholder", () => {
    renderToolbar();

    expect(search()).toHaveAttribute("placeholder", "Buscar banco o cuenta");
  });

  it("shows the query it is given", () => {
    renderToolbar("galicia");

    expect(search()).toHaveValue("galicia");
  });

  it("reports what is typed", () => {
    const { onQueryChange } = renderToolbar();

    fireEvent.change(search(), { target: { value: "ahorro" } });

    expect(onQueryChange).toHaveBeenCalledWith("ahorro");
  });

  it("has a switch for the archived items, off by default", () => {
    renderToolbar();

    expect(toggle()).not.toBeChecked();
  });

  it("shows the switch on when archived items are shown", () => {
    renderToolbar("", true);

    expect(toggle()).toBeChecked();
  });

  it("reports the new value when the switch is toggled", () => {
    const { onShowArchivedChange } = renderToolbar();

    fireEvent.click(toggle());

    expect(onShowArchivedChange).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run components/Banks/components/BanksToolbar`
Expected: FAIL, `Failed to resolve import "./BanksToolbar"`.

- [ ] **Step 3: Implement.** `BanksToolbar/types.ts`

```ts
export interface BanksToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  showArchived: boolean;
  onShowArchivedChange: (showArchived: boolean) => void;
}
```

`BanksToolbar/consts.ts`

```ts
export const SEARCH_LABEL = "Buscar bancos y cuentas";
export const SEARCH_PLACEHOLDER = "Buscar banco o cuenta";
export const SHOW_ARCHIVED_LABEL = "Mostrar archivados";
```

`BanksToolbar/styles.ts`

```ts
export const ROOT_CLASS_NAME = "flex flex-wrap items-center gap-4";

export const SEARCH_CLASS_NAME = "w-full sm:w-72";
```

`BanksToolbar/BanksToolbar.tsx`

```tsx
import { SearchField, Switch } from "@heroui/react";

import { FIELD_VARIANT } from "@/components/Entries/styles";

import {
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  SHOW_ARCHIVED_LABEL,
} from "./consts";
import { ROOT_CLASS_NAME, SEARCH_CLASS_NAME } from "./styles";
import type { BanksToolbarProps } from "./types";

// What narrows the board: a search over bank and account names, and whether archived items show.
// Both are controlled by the page, which applies them to the rows.
export function BanksToolbar({
  query,
  onQueryChange,
  showArchived,
  onShowArchivedChange,
}: BanksToolbarProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <SearchField
        aria-label={SEARCH_LABEL}
        variant={FIELD_VARIANT}
        className={SEARCH_CLASS_NAME}
        value={query}
        onChange={onQueryChange}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={SEARCH_PLACEHOLDER} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <Switch isSelected={showArchived} onChange={onShowArchivedChange}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          {SHOW_ARCHIVED_LABEL}
        </Switch.Content>
      </Switch>
    </div>
  );
}
```

`BanksToolbar/index.ts`

```ts
export { BanksToolbar } from "./BanksToolbar";
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run components/Banks/components/BanksToolbar`
Expected: PASS (6 tests). If `getByRole("searchbox", ...)` does not resolve in jsdom, query the input with `screen.getByLabelText("Buscar bancos y cuentas")` instead in this file and in Task 19 (the component is the same; only the query changes).

- [ ] **Step 5: Verify**

Run: `npx vitest run components/componentStructure.test.ts components/Banks` then `npx tsc --noEmit` and `npx eslint components/Banks`
Expected: guards and tests PASS, no type or lint errors.

### Task 19: `Banks` page component (header, Actions menu, filters, board, drawers)

**Files:**

- Test: `components/Banks/Banks.test.tsx`
- Create: `components/Banks/{Banks.tsx,index.ts,consts.ts}` (`types.ts` and `styles.ts` already exist from Tasks 16 and 13)

**Interfaces:**

- Consumes: `PageHeader` (shared Actions menu), `ROOT_CLASS_NAME` (`@/components/Entries/styles`), `Await`, `filterBanks` and `activeBanks` (Task 7), `BanksBoard`, `BanksToolbar`, `LoadingBoard`, `BankFormDrawer`, `AccountFormDrawer`, `BanksProps`, `BankFormTarget`, `AccountFormTarget` (Task 16).
- Produces: `Banks({ board })` exported from `components/Banks/index.ts`. Header title "Bancos"; Actions menu with "Crear banco" and "Crear cuenta" (opening the two drawers); search and archived toggle applied to the rows; clicking a bank or a tile opens its edit drawer; the "+ cuenta" tile opens the account drawer with that bank chosen.

- [ ] **Step 1: Write the failing test** `components/Banks/Banks.test.tsx`

```tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/banks/actions", () => ({
  createBankAction: vi.fn(),
  updateBankAction: vi.fn(),
  archiveBankAction: vi.fn(),
  unarchiveBankAction: vi.fn(),
}));
vi.mock("@/core/accounts/actions", () => ({
  createAccountAction: vi.fn(),
  updateAccountAction: vi.fn(),
  archiveAccountAction: vi.fn(),
  unarchiveAccountAction: vi.fn(),
}));

import type { BankWithAccounts } from "@/core/banks/types";

import { Banks } from "./Banks";

const BANKS: BankWithAccounts[] = [
  {
    id: "bank_cash",
    name: "Efectivo",
    archived: false,
    accounts: [
      {
        id: "acc_cash",
        bankId: "bank_cash",
        name: "Efectivo",
        currency: "ARS",
        archived: false,
      },
    ],
  },
  {
    id: "bank_galicia",
    name: "Banco Galicia",
    archived: false,
    accounts: [
      {
        id: "acc_sav",
        bankId: "bank_galicia",
        name: "Caja de ahorro",
        currency: "ARS",
        archived: false,
      },
      {
        id: "acc_usd",
        bankId: "bank_galicia",
        name: "Cuenta en dólares",
        currency: "USD",
        archived: false,
      },
      {
        id: "acc_old",
        bankId: "bank_galicia",
        name: "Cuenta vieja",
        currency: "ARS",
        archived: true,
      },
    ],
  },
  {
    id: "bank_old",
    name: "Banco Viejo",
    archived: true,
    accounts: [
      {
        id: "acc_dead",
        bankId: "bank_old",
        name: "Caja cerrada",
        currency: "ARS",
        archived: true,
      },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

const bankButton = (name: string) =>
  screen.queryByRole("button", { name: `Editar banco ${name}` });
const accountButton = (name: string) =>
  screen.queryByRole("button", { name: `Editar cuenta ${name}` });

const typeSearch = (value: string) =>
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Buscar bancos y cuentas" }),
    { target: { value } },
  );
const toggleArchived = () =>
  fireEvent.click(screen.getByRole("switch", { name: "Mostrar archivados" }));

const chooseAction = async (name: string) => {
  fireEvent.keyDown(screen.getByRole("button", { name: "Acciones" }), {
    key: "ArrowDown",
  });
  await screen.findByRole("menu");

  const item = screen.getByRole("menuitem", { name });

  fireEvent.keyDown(item, { key: "Enter" });
  fireEvent.keyUp(item, { key: "Enter" });
};

describe("Banks page", () => {
  it("shows the title and what the page is for", () => {
    render(<Banks board={BANKS} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Bancos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tus bancos, billeteras y efectivo, con las cuentas que tenés en cada uno.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the header, the toolbar and the skeleton while the banks load", () => {
    render(<Banks board={new Promise(() => {})} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Bancos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Acciones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Buscar bancos y cuentas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Cargando bancos y cuentas" }),
    ).toBeInTheDocument();
    expect(bankButton("Efectivo")).toBeNull();
  });

  it("shows the board once its promise resolves", async () => {
    // Settled before it renders, inside act: the case jsdom can drive (see Await.test.tsx).
    const data = Promise.resolve(BANKS);

    await act(async () => {
      render(<Banks board={data} />);
    });

    expect(
      await screen.findByRole("button", { name: "Editar banco Banco Galicia" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Cargando bancos y cuentas" }),
    ).toBeNull();
  });

  it("shows the active banks with their active accounts, name and currency only, and hides what is archived", () => {
    render(<Banks board={BANKS} />);

    expect(bankButton("Efectivo")).toBeInTheDocument();
    expect(bankButton("Banco Galicia")).toBeInTheDocument();
    expect(accountButton("Caja de ahorro")).toHaveTextContent(
      /^Caja de ahorroARS$/,
    );
    expect(accountButton("Cuenta en dólares")).toHaveTextContent(
      /^Cuenta en dólaresUSD$/,
    );
    expect(bankButton("Banco Viejo")).toBeNull();
    expect(accountButton("Cuenta vieja")).toBeNull();
    expect(accountButton("Caja cerrada")).toBeNull();
  });

  it("shows archived banks and accounts when the toggle is on, and hides them again when it is off", () => {
    render(<Banks board={BANKS} />);

    toggleArchived();

    expect(bankButton("Banco Viejo")).toBeInTheDocument();
    expect(accountButton("Cuenta vieja")).toBeInTheDocument();
    expect(accountButton("Caja cerrada")).toBeInTheDocument();

    toggleArchived();

    expect(bankButton("Banco Viejo")).toBeNull();
    expect(accountButton("Cuenta vieja")).toBeNull();
  });

  it("keeps a bank row when the bank name matches the search, with all its accounts", () => {
    render(<Banks board={BANKS} />);

    typeSearch("galicia");

    expect(bankButton("Banco Galicia")).toBeInTheDocument();
    expect(accountButton("Caja de ahorro")).toBeInTheDocument();
    expect(accountButton("Cuenta en dólares")).toBeInTheDocument();
    expect(bankButton("Efectivo")).toBeNull();
  });

  it("keeps a bank row when only one of its accounts matches, showing that account (accents and case ignored)", () => {
    render(<Banks board={BANKS} />);

    typeSearch("DOLARES");

    expect(bankButton("Banco Galicia")).toBeInTheDocument();
    expect(accountButton("Cuenta en dólares")).toBeInTheDocument();
    expect(accountButton("Caja de ahorro")).toBeNull();
    expect(bankButton("Efectivo")).toBeNull();
    expect(
      screen.getByRole("button", { name: "+ cuenta en Banco Galicia" }),
    ).toBeInTheDocument();
  });

  it("does not bring a bank back because of an archived account that is hidden", () => {
    render(<Banks board={BANKS} />);

    typeSearch("cuenta vieja");

    expect(bankButton("Banco Galicia")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ningún banco ni cuenta coincide con la búsqueda.",
    );

    toggleArchived();

    expect(bankButton("Banco Galicia")).toBeInTheDocument();
    expect(accountButton("Cuenta vieja")).toBeInTheDocument();
    expect(accountButton("Caja de ahorro")).toBeNull();
  });

  it("lists 'Crear banco' and 'Crear cuenta' in the Actions menu, in that order", async () => {
    render(<Banks board={BANKS} />);

    fireEvent.keyDown(screen.getByRole("button", { name: "Acciones" }), {
      key: "ArrowDown",
    });
    await screen.findByRole("menu");

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Crear banco", "Crear cuenta"]);
  });

  it("opens the bank drawer from 'Crear banco'", async () => {
    render(<Banks board={BANKS} />);

    await chooseAction("Crear banco");

    expect(
      await screen.findByRole("heading", { name: "Crear banco" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Nombre/ })).toHaveValue("");
  });

  it("opens the account drawer from 'Crear cuenta', offering only the active banks", async () => {
    render(<Banks board={BANKS} />);

    await chooseAction("Crear cuenta");

    expect(
      await screen.findByRole("heading", { name: "Crear cuenta" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("button", { name: /^Banco/ }), {
      key: "ArrowDown",
    });
    await screen.findByRole("listbox");

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Efectivo", "Banco Galicia"]);
  });

  it("opens the editor of a bank when its cell is pressed", async () => {
    render(<Banks board={BANKS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Editar banco Banco Galicia" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Editar banco" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Nombre/ })).toHaveValue(
      "Banco Galicia",
    );
  });

  it("opens the editor of an account when its tile is pressed", async () => {
    render(<Banks board={BANKS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Editar cuenta Cuenta en dólares" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Editar cuenta" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Nombre/ })).toHaveValue(
      "Cuenta en dólares",
    );
    expect(screen.getByRole("button", { name: /Moneda/ })).toHaveTextContent(
      "USD",
    );
  });

  it("opens a new account with the bank of the '+ cuenta' tile already chosen", async () => {
    render(<Banks board={BANKS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "+ cuenta en Banco Galicia" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Crear cuenta" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Banco/ })).toHaveTextContent(
      "Banco Galicia",
    );
  });

  it("lets an archived bank be reactivated from its editor, which is reachable with the toggle on", async () => {
    render(<Banks board={BANKS} />);

    toggleArchived();
    fireEvent.click(
      screen.getByRole("button", { name: "Editar banco Banco Viejo" }),
    );

    expect(
      await screen.findByRole("button", { name: "Reactivar banco" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run components/Banks/Banks.test.tsx`
Expected: FAIL, `Failed to resolve import "./Banks"`.

- [ ] **Step 3: Implement.** `components/Banks/consts.ts`

```ts
import { BuildingLibraryIcon, PlusIcon } from "@heroicons/react/24/outline";

import type { ActionsMenuItem } from "@/components/Entries/components/PageHeader";

import type { AccountFormTarget, BankFormTarget } from "./types";

export const PAGE_TITLE = "Bancos";
export const PAGE_DESCRIPTION =
  "Tus bancos, billeteras y efectivo, con las cuentas que tenés en cada uno.";

export const ACTIONS_LABEL = "Acciones";
export const CREATE_BANK_ACTION = "create-bank";
export const CREATE_BANK_LABEL = "Crear banco";
export const CREATE_ACCOUNT_ACTION = "create-account";
export const CREATE_ACCOUNT_LABEL = "Crear cuenta";

// What the Actions menu offers, in order.
export const ACTION_ITEMS: readonly ActionsMenuItem[] = [
  {
    id: CREATE_BANK_ACTION,
    label: CREATE_BANK_LABEL,
    Icon: BuildingLibraryIcon,
  },
  { id: CREATE_ACCOUNT_ACTION, label: CREATE_ACCOUNT_LABEL, Icon: PlusIcon },
];

export const INITIAL_BANK_TARGET: BankFormTarget = { key: 0, bank: null };
export const INITIAL_ACCOUNT_TARGET: AccountFormTarget = {
  key: 0,
  account: null,
  bankId: null,
};
```

`components/Banks/Banks.tsx`

```tsx
"use client";

import { useOverlayState } from "@heroui/react";
import { useState } from "react";

import { PageHeader } from "@/components/Entries/components/PageHeader";
import { ROOT_CLASS_NAME } from "@/components/Entries/styles";
import { Await } from "@/components/shared/Await";
import type { Account } from "@/core/accounts/types";
import { activeBanks, filterBanks } from "@/core/banks/board";
import type { BankWithAccounts } from "@/core/banks/types";

import { AccountFormDrawer } from "./components/AccountFormDrawer";
import { BankFormDrawer } from "./components/BankFormDrawer";
import { BanksBoard } from "./components/BanksBoard";
import { BanksToolbar } from "./components/BanksToolbar";
import { LoadingBoard } from "./components/LoadingBoard";
import {
  ACTION_ITEMS,
  ACTIONS_LABEL,
  CREATE_ACCOUNT_ACTION,
  CREATE_BANK_ACTION,
  INITIAL_ACCOUNT_TARGET,
  INITIAL_BANK_TARGET,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
} from "./consts";
import type { AccountFormTarget, BankFormTarget, BanksProps } from "./types";

export function Banks({ board }: BanksProps) {
  const bankForm = useOverlayState();
  const accountForm = useOverlayState();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [bankTarget, setBankTarget] =
    useState<BankFormTarget>(INITIAL_BANK_TARGET);
  const [accountTarget, setAccountTarget] = useState<AccountFormTarget>(
    INITIAL_ACCOUNT_TARGET,
  );

  const openBankForm = (bank: BankWithAccounts | null) => {
    setBankTarget((current) => ({ key: current.key + 1, bank }));
    bankForm.open();
  };

  const openAccountForm = (account: Account | null, bankId: string | null) => {
    setAccountTarget((current) => ({ key: current.key + 1, account, bankId }));
    accountForm.open();
  };

  const handleHeaderAction = (id: string) => {
    if (id === CREATE_BANK_ACTION) {
      openBankForm(null);
    } else if (id === CREATE_ACCOUNT_ACTION) {
      openAccountForm(null, null);
    }
  };

  // The board and the two drawers need the banks, so they appear once the data has arrived (the
  // header and the toolbar are already on screen). The drawers get the whole list, not the filtered
  // one: what is hidden by the search still counts (a bank with a hidden active account cannot be
  // archived).
  const renderBanks = (banks: readonly BankWithAccounts[]) => (
    <>
      <BanksBoard
        banks={filterBanks(banks, { query, showArchived })}
        isSearching={query.trim() !== ""}
        onEditBank={(bankId) => {
          const bank = banks.find((candidate) => candidate.id === bankId);

          if (bank) {
            openBankForm(bank);
          }
        }}
        onEditAccount={(account) => openAccountForm(account, null)}
        onAddAccount={(bankId) => openAccountForm(null, bankId)}
      />

      <BankFormDrawer
        isOpen={bankForm.isOpen}
        onOpenChange={bankForm.setOpen}
        onClose={bankForm.close}
        target={bankTarget}
      />

      <AccountFormDrawer
        isOpen={accountForm.isOpen}
        onOpenChange={accountForm.setOpen}
        onClose={accountForm.close}
        target={accountTarget}
        banks={activeBanks(banks)}
      />
    </>
  );

  return (
    <main className={ROOT_CLASS_NAME}>
      <PageHeader
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        actionsLabel={ACTIONS_LABEL}
        actions={ACTION_ITEMS}
        onAction={handleHeaderAction}
      />

      <BanksToolbar
        query={query}
        onQueryChange={setQuery}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
      />

      <Await source={board} fallback={<LoadingBoard />}>
        {renderBanks}
      </Await>
    </main>
  );
}
```

`components/Banks/index.ts`

```ts
export { Banks } from "./Banks";
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run components/Banks/Banks.test.tsx`
Expected: PASS (15 tests).

- [ ] **Step 5: Verify**

Run: `npx vitest run components/componentStructure.test.ts components/shared components/Banks` then `npx tsc --noEmit` and `npx eslint components/Banks`
Expected: guards and tests PASS, no type or lint errors.

### Task 20: The route `/dashboard/banks`

**Files:**

- Test: `app/dashboard/banks/loadBanksView.test.ts`
- Create: `app/dashboard/banks/loadBanksView.ts`, `app/dashboard/banks/page.tsx`

**Interfaces:**

- Consumes: `loadBanksBoard` (Task 8), `Banks` (Task 19), `requireUserId` (`@/lib/auth/requireUserId`).
- Produces: `loadBanksView(userId: string): { board: Promise<BankWithAccounts[]> }` (returns at once, without awaiting) and the default-exported `BanksPage`. There are no dates in stage 1, so no Argentine-time handling is needed here.

- [ ] **Step 1: Write the failing test** `app/dashboard/banks/loadBanksView.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const pageData = vi.hoisted(() => ({ loadBanksBoard: vi.fn() }));

vi.mock("@/core/banks/pageData", () => pageData);

import type { BankWithAccounts } from "@/core/banks/types";

import { loadBanksView } from "./loadBanksView";

const BANKS: BankWithAccounts[] = [
  {
    id: "bank_1",
    name: "Efectivo",
    archived: false,
    accounts: [
      {
        id: "acc_1",
        bankId: "bank_1",
        name: "Efectivo",
        currency: "ARS",
        archived: false,
      },
    ],
  },
];

beforeEach(() => {
  pageData.loadBanksBoard.mockReset();
});

describe("loadBanksView", () => {
  it("returns at once, without waiting for the data: that is what lets the page render first", () => {
    // Never settles: if the function awaited it, this line would hang the test.
    pageData.loadBanksBoard.mockReturnValue(new Promise(() => {}));

    const view = loadBanksView("user_1");

    expect(Object.keys(view)).toEqual(["board"]);
    expect(view.board).toBeInstanceOf(Promise);
  });

  it("loads the board of the user once", async () => {
    pageData.loadBanksBoard.mockResolvedValue(BANKS);

    await loadBanksView("user_1").board;

    expect(pageData.loadBanksBoard).toHaveBeenCalledTimes(1);
    expect(pageData.loadBanksBoard).toHaveBeenCalledWith("user_1");
  });

  it("gives the banks as the loader read them", async () => {
    pageData.loadBanksBoard.mockResolvedValue(BANKS);

    await expect(loadBanksView("user_1").board).resolves.toEqual(BANKS);
  });

  it("rejects the board when the load fails, so it reaches the error boundary", async () => {
    pageData.loadBanksBoard.mockRejectedValue(new Error("database down"));

    await expect(loadBanksView("user_1").board).rejects.toThrow(
      "database down",
    );
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run app/dashboard/banks/loadBanksView.test.ts`
Expected: FAIL, `Failed to resolve import "./loadBanksView"`.

- [ ] **Step 3: Implement.** `app/dashboard/banks/loadBanksView.ts`

```ts
import { loadBanksBoard } from "@/core/banks/pageData";

// Starts loading everything the page needs and returns immediately, without awaiting it. The page
// hands the promise straight to the client component, so the header and the toolbar render at once
// and only the board waits for its data.
//
// The promise is created here, once per request, so its identity is stable: a client component that
// waits on it gets the same promise on every render.
export const loadBanksView = (userId: string) => ({
  board: loadBanksBoard(userId),
});
```

`app/dashboard/banks/page.tsx`

```tsx
import { Banks } from "@/components/Banks";
import { requireUserId } from "@/lib/auth/requireUserId";

import { loadBanksView } from "./loadBanksView";

export default async function BanksPage() {
  const userId = await requireUserId();

  // Not awaited on purpose. The session check above is quick; the database work starts here and
  // streams in behind the page, so the header is on screen at once and only the board waits for its
  // data.
  const view = loadBanksView(userId);

  return <Banks {...view} />;
}
```

- [ ] **Step 4: Run and see it pass, then the route guards**

Run: `npx vitest run app/dashboard/banks lib/auth/routeProtection.test.ts components/componentStructure.test.ts`
Expected: PASS (the route-protection guard finds `requireUserId` in the new page and no `"use client"`; the structure guard accepts the page as a route file).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` and `npx eslint app/dashboard/banks`
Expected: no errors.

### Task 21: Final check and the browser pass (handed to the human)

**Files:** none (verification only).

**Interfaces:** consumes everything above.

- [ ] **Step 1: Run the whole suite, the types and the linter**

Run: `npx vitest run`
Expected: every test PASSES, including the structure and PendingButton guards, the route-protection guard, `clearData` and the sidebar tests.
Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors (this is what the husky pre-commit hook runs).

- [ ] **Step 2: Self-check against the spec (Stage 1)** — confirm each item has a passing test above: `Bank`/`Account` models and migration (Task 1); services scoped by userId with Spanish domain errors (Tasks 4, 5); `ensureDefaultCash` idempotent and race-safe (Task 6); sidebar "Bancos" after "Tarjetas", no children (Task 11); header with the shared Actions menu, "Crear banco" and "Crear cuenta" drawers (Tasks 16, 17, 19); edit/archive/reactivate of banks and accounts, a bank archived only when all its accounts are (Tasks 4, 16); search that keeps a bank row when the bank or any of its (visible) accounts match, and the archived toggle (Tasks 7, 18, 19); swimlane board with name and currency only, "+ cuenta" tile, horizontal scroll (Tasks 12, 13, 14); account currency editable (Tasks 5, 17).

- [ ] **Step 3: Hand to the human.** The migration of Task 1 must be applied to the dev database, and the human's `next dev` on port 3000 must have the regenerated Prisma client (restart it if `prisma.bank` is undefined). Do not start, stop or restart the dev server from here. Then the browser pass, reusing the already signed-in Playwright session (do not close the browser; clean `.playwright-mcp` files by hand afterwards):
  1. Open `http://localhost:3000/dashboard/banks`: "Bancos" is highlighted in the sidebar right after "Tarjetas", the breadcrumb reads "Panel / Bancos", and one row "Efectivo" with one tile "Efectivo" · ARS and a "+ cuenta" tile appears. Reload twice: still a single "Efectivo" bank and account.
  2. Acciones > Crear banco: create "Banco Galicia"; try "banco galicia" (and " Banco Galicia ") again: the name field shows "Ya tenés un banco con este nombre."
  3. Acciones > Crear cuenta: pick Banco Galicia, name "Caja de ahorro", currency ARS. Create "Cuenta en dólares" in USD from the "+ cuenta" tile of the Galicia row (the bank is preselected). Create an account named "Efectivo" in Galicia: allowed (same name in another bank); a second "efectivo" in the same bank is refused.
  4. Tiles show only the name and a currency chip (no amounts). Click a tile: "Editar cuenta" with the values; change the currency to EUR and save.
  5. Open "Banco Galicia": "Archivar banco" is disabled with the hint to archive its accounts first. Archive its accounts one by one (each tile disappears), then archive the bank (the row disappears).
  6. Turn on "Mostrar archivados": the archived bank and accounts return, dimmed with the "Archivado"/"Archivada" chips, and the archived bank has no "+ cuenta" tile. Open an archived account of an archived bank and press "Reactivar cuenta": it is refused with "Este banco está archivado. Reactivalo primero." Reactivate the bank, then the account.
  7. Search "dolares" (without the accent): the Galicia row stays with only the matching tile. Search for the name of an archived account with the toggle off: "Ningún banco ni cuenta coincide con la búsqueda."; turn the toggle on: the row appears.
  8. Narrow the window to phone width: the page does not scroll sideways; the board does, and the bank cell stays at the left while the tiles scroll.
  9. Check the tiles and buttons are not blue in the themes you use, and that they have the intended size (not the global 2.5rem button height).
