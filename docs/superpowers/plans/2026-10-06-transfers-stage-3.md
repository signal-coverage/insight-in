# Transfers Stage 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user can move money between their own accounts of the same currency (a `Transfer` model, a `/dashboard/transfers` page with a table and a create/edit/delete drawer, a "Transferencias" sidebar item), every account balance reflects the transfers, a transfer never counts as income or expense, and the summary gets a "Por cuenta" card with the balance of each account grouped by bank.

**Architecture:** `core/balances` stays the single place that turns money into balances: a transfer is two more settled flows (`transferOut` from the source, `transferIn` into the destination) read by the same `readAccountBalances`, which gains an `asOf` day (the funds check is "at the transfer date") and an `excludeTransferId` (an edit does not count itself). `getMonthlySummary` is not touched: it never reads transfers, so the monthly totals are neutral by construction. The transfers service runs check-and-write in one transaction that locks every account the write touches in ascending id order, and keeps one invariant: a write may never push an account it takes money from below zero (create checks the source, delete checks the destination, an edit compares net changes per account with two pure functions). The page follows the Cards/Incomes pattern (server loader returning promises, `Await`, shared `DataTable`, `useRowSelection`, `BulkDeleteDialog`); the "Por cuenta" card is its own section of the summary page fed by its own promise.

**Tech Stack:** Next.js 16.3.6 (App Router, server actions), React 19.2, TypeScript, Prisma 7 + Neon, zod 4, HeroUI v3 (`@heroui/react`), Tailwind 4, Vitest 4 + Testing Library (jsdom per file), Clerk.

**Spec:** docs/superpowers/specs/2026-10-04-accounts-banks-transfers-design.md (sections "Decisions", "Data model" > `Transfer` and "Account balance", "Stages" > 3, "Transfers (stage 3)", "Summary (stage 2 and 3)", "Errors", "Testing", "Out of scope"). Depends on stages 1, 2a and 2b being done and their migrations applied (they are: the user applied the contract migration on 2026-10-06).

## Decisions taken

The spec is silent or ambiguous on these; each one is the safest default. The user may veto any of them before or during the build.

- **D1 Fields.** `Transfer`: `id`, `userId`, `fromAccountId`, `toAccountId` (both FK `Restrict`), `amount` (BigInt minor units, CHECK `> 0`), `date` (`@db.Date`), `notes` (optional, named `notes` like `Income.notes`, as the spec says), `createdAt`, `updatedAt`; CHECK `fromAccountId <> toAccountId`. No currency column (the spec: "Its currency is the accounts' currency (not stored)").
- **D2 Currency.** The form sends a `currency` (like every entry form: pick the currency, then the accounts of that currency). The service checks inside the transaction that BOTH locked accounts are in that currency (error per side). The table shows the currency of the source account.
- **D3 Date.** `date <= today` in Argentine time (`todayIso()`), and the year must be 2000 to 2099 (the range the month filter can reach). No planned/future transfers: the spec puts them out of scope and the user confirmed they stay out of stage 3 (they are listed under "Deferred").
- **D4 Funds check.** At the transfer date: `readAccountBalances(tx, userId, [fromAccountId], { asOf: date, excludeTransferId })` and `balance >= amount`. A date before the opening month began has balance 0 (no balance is invented), so it is refused as insufficient funds. A transfer dated at or after the date of an entry sees only what had moved by then (the spec: "sufficient funds in the source account at the transfer date"). **Amended (final review): the source is checked at the transfer date AND now (a second read without `asOf`, the lower of the two balances is reported), per the user's never-below-zero rule; this replaces the old "a backdated transfer can leave a later balance negative; accepted".**
- **D5 Locks.** Every account a write touches is locked `FOR UPDATE`, one after the other, in ascending id order: both accounts on create; the old AND the new accounts on an edit; every account of the transfers on a delete (the spec says "locks the source account row"; the other rows are locked too so a concurrent archive or currency change cannot interleave, and the fixed order makes A to B and B to A deadlock-free). READ COMMITTED reasoning: the statements after the locks see what the previous lock holder committed.
- **D6 Invariant (user decision): a write may never push an account it takes money from below zero.** Create checks the SOURCE at the transfer date (D4). Delete checks the DESTINATION now (D7). An edit is the old transfer undone plus the new one made, compared as a NET change per account by two small pure functions (`netDeltas` / `giveBacks` in `core/transfers/rules.ts`): (a) the new source must cover the new amount at the new date WITHOUT the edited transfer's own old effect (`excludeTransferId`), checked unless the edit asks nothing more of it (same source, same date, amount not higher); (b) every other account that ends with less than it has now (the old destination when the amount goes down or the destination changes) must still hold that much now. A notes-only edit changes nothing in the money, so it checks nothing and can never fail for funds. Re-validates everything else (same, active, currency, date); an edit may keep an account (either side) that was archived since and can never move a side to an archived one. This replaces the spec sentence "The funds check only runs when a transfer is created or edited": the user's decision overrides it.
- **D7 Delete.** A delete reverses the money (the destination gives the amount back to the source), so it is allowed only when the destination's CURRENT balance (the Banks board's: every settled movement, the transfer being deleted included) is at least the amount; otherwise it is refused with "No se puede deshacer: {Banco · Cuenta} tiene {saldo} y tendría que devolver {monto}." The source only gains and is never checked. It locks both accounts (D5). A bulk delete (at most `MAX_BULK_DELETE` ids; only the user's own ids count) compares the NET change of each account over the whole selection, so the answer does not depend on the order of the ids, and it is all or nothing. Negative balances can still arise from deleting an income or entering an expense: shown in red, never blocked (the spec).
- **D8 Balances.** Transfers count like settled flows: dated from the first day of the opening month when there is an opening balance (all of them otherwise), no upper date for the "now" balance. The currency totals do not change (`transferOut` and `transferIn` cancel inside one currency). `getMonthlySummary` does not read transfers at all, so Ingresos, Gastos, Anterior, Actual and Objetivo are untouched.
- **D9 Movements.** `countAccountMovements` / `listAccountsWithMovements` also count `transfersOut` and `transfersIn`: an account with transfers cannot change currency, and the Banks board flags it. The archive rule needs no change: it already archives only at zero balance, and the balance now includes transfers.
- **D10 Page.** `/dashboard/transfers?month=YYYY-MM` shows that month's transfers (default: the Argentine current month, newest first, capped at 500). Search, account and currency filters are client-side over that month; there is no pagination and no sort control. Columns: date, source ("Banco · Cuenta"), destination, amount, currency, notes. Header Actions menu: "Crear transferencia" only (the icon-help item is for tables with markers).
- **D11 "Por cuenta".** A separate section BELOW the per-currency sections of the summary (not inside them: a currency with accounts can have no row that month). One card per currency, banks as groups, accounts as lines, a per-currency total line, negative balances in red. It shows TODAY's balances (the Banks board's), whatever month is viewed; archived accounts show only while their balance is not zero.
- **D12 Sidebar.** "Transferencias" goes right after "Bancos" (the spec says "after Tarjetas"; Bancos already sits right after Tarjetas, so this keeps the two next to each other), icon `ArrowsRightLeftIcon`.
- **D13 Revalidation.** Every successful transfer write revalidates `/dashboard/transfers`, `/dashboard/banks` and `/dashboard/overview` (balances changed on both).
- **D14 Deferred items absorbed.** (a) the shared settled-flow reader with an `asOf` bound (Task 3, needed by D4); (b) `FOR SHARE` on the opening-balance save's payload accounts (Task 10, closes the window documented in `saveOpeningBalances`; transfers lock the same rows, in the same order).

## Global Constraints

- Copy language: all UI copy (labels, buttons, errors, empty states, hints) in Spanish es-AR, neutral/professional, voseo as in Cards/Roadmap/Banks ("Dejala en cero", "Reactivala"). Code, identifiers, comments and tests in English. Route slugs stay English (`/dashboard/transfers`).
- Component layout is enforced by `components/componentStructure.test.ts` (scans `components/` and `app/`, `.tsx` files that are not tests): no `type`/`interface`/`enum` declarations in a component file, no `const`/helper function at column 0 (only the component itself), exactly one component per file, no props typed inline (`}: {`), no inline `className="..."` of 40+ characters (move it to `styles.ts`), a sub-component is never a bare file under a nested `components/` folder (it gets its own folder `Name/Name.tsx` plus `index.ts`). Types go in `types.ts`, constants in `consts.ts`, styles in `styles.ts`, helpers in `utils.ts`, hooks in `useX.ts`.
- Strict TDD with Vitest: every behaviour gets a failing test first; run it and see it fail for the stated reason before writing the implementation (RED), then see it pass (GREEN). Component tests start with `// @vitest-environment jsdom`. Unit tests never need the database: services are tested against the Prisma mock (`vi.mock("@/infrastructure/db/client", …)`), exactly like `core/accounts/service.test.ts`.
- Money convention: minor units, `BigInt` in the database, `number` in the app (`minorUnitsToNumber` at the boundary); money is formatted on the server with `formatMoney(minorUnits, currency)` (es-AR), the client only places text. Amounts in different currencies are never added.
- Balance rule (binding, from the spec): `balance(account, date) = opening (if the opening month has started) + settled incomes − settled expenses − transfers out + transfers in`, counting entries up to `date`. `PLANNED` and `COVERED` entries never move money. A currency's total is the sum of its accounts, so transfers never change it. The "current" balance of an account (Banks board, archive rule, "Por cuenta") counts every settled entry with no upper date.
- Transfers (binding, from the spec): "Create validates: both accounts are the user's and active, same currency, different, amount > 0, date not in the future (Argentine time), and sufficient funds in the source account at the transfer date (reusing the balance computation). Check and insert happen in one transaction that locks the source account row, so two concurrent transfers cannot spend the same money. Editing re-validates; deleting is allowed (also in bulk). The funds check only runs when a transfer is created or edited." **Stage 3 refinement decided by the user, which overrides the last two sentences where they differ:** a delete also checks funds (the destination must still hold the amount it would give back, see D6 and D7), an edit compares net changes per account, and every account a write touches is locked in ascending id order.
- Errors (binding, from the spec): "Field errors follow the existing action-result shape. Domain errors, in Spanish: insufficient funds in the source account, archived account, currency mismatch, same account on both sides, future date. Services stay scoped by `userId`; an id belonging to another user behaves as not found."
- Out of scope (binding, from the spec): "Cross-currency transfers, transfer fees, planned/future transfers, linking credit cards to a bank or account, per-account benefits/notes, importing statements."
- Every record is scoped by the Clerk `userId` that comes from the session (`runAuthenticated`), never from client input; another user's id behaves as not found and nothing is written.
- Colors: never blue buttons; only theme tokens (`text-muted`, `text-danger` for a negative balance, `bg-surface-secondary`, `ring-border`, ...). Async buttons use `PendingButton` (guard `components/shared/PendingButton/pendingButtonUsage.test.ts`).
- Next.js (this repo runs 16.3.6, see AGENTS.md: it differs from what you remember): pages are async Server Components that call `requireUserId()` (guard `lib/auth/routeProtection.test.ts`); `"use server"` files export only async functions; `revalidatePath` only after a successful write. Before writing the page, the actions or any Next API, read the relevant guide in `node_modules/next/dist/docs/` (`01-app/03-api-reference/04-functions/revalidatePath.md`, `01-app/01-getting-started/03-layouts-and-pages.md`, `01-app/03-api-reference/03-file-conventions/page.md`). "Today" and "the current month" are Argentine time: always `todayIso()` from `core/incomes/dates.ts` and `monthOf(todayIso())`; never `new Date().toISOString()`.
- HeroUI v3 differs from what you remember (AGENTS.md: "STOP. What you remember about HeroUI React v3 is WRONG for this project"). Every UI task starts by reading the HeroUI docs it uses under `.heroui-docs/react/components/` (`(overlays)/drawer.mdx`, `(overlays)/alert-dialog.mdx`, `(pickers)/select.mdx`, `(forms)/text-field.mdx`, `(forms)/search-field.mdx`, `(data-display)/table.mdx`, `(layout)/card.mdx`) and then copies the markup of the components that already work in this repo (named in each task). If `.heroui-docs` is missing, run `heroui agents-md --react --output AGENTS.md` first.
- Row locks: `SELECT … FOR UPDATE` / `FOR SHARE` through `tx.$queryRaw` tagged templates inside `prisma.$transaction(async (tx) => …)`; ids and userId travel as parameters, never inside the SQL text (pinned in each lock test). Inside one interactive transaction the queries run one after another (no `Promise.all` on `tx`). Several account rows are always locked in ascending id order (`inLockOrder`).
- Database: the dev database holds the user's REAL data. The migration is additive only (a new table, its indexes and foreign keys; nothing existing is altered, dropped or rewritten). Migrations are written by hand into `prisma/migrations/<timestamp>_<name>/migration.sql`. The implementer runs `npx prisma validate`, `npx prisma generate` and nothing else against Prisma: NEVER `prisma migrate dev|deploy|reset|resolve`, `prisma db push` or any command that opens a database connection. Applying the migration is the USER's action (`npx prisma migrate deploy`), requested by the controller at the gate after Task 1. No test may need the database.
- Do not start, stop or restart `next dev`, and do not close the Playwright browser. No git commit/add/stash steps anywhere: the user commits only when asked; the snapshot is taken by the controller.
- Every task ends with a verify step that runs, in this order: that task's tests, `npx vitest run` (the whole suite), `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, and `npx prettier --check <the files the task created or changed>` (never `npm run format`: it rewrites the whole repo). A task boundary is only reached with all of them green.

## Review Focus

The inputs and conditions the spec implies but no obvious test exercises, the ones most likely to bite a person using this, most likely first. Each one is pinned by a test in the task named at the end of the line.

1. A **backdated** transfer: the account is rich today but was empty on the chosen day (or the day is before the opening month began). A person expects "Fondos insuficientes" for that day, not today's balance. Pinned in Task 3 (reader `asOf`, opening not started returns nothing) and Task 4 (the service asks for the balance as of the transfer date, never "now").
2. **Undoing money the destination already spent**: deleting a transfer (one or several), lowering its amount or moving it to another destination when the destination no longer holds what it would give back must be refused with a message naming the account and its balance, while the same writes succeed when the destination still holds it, a **notes-only edit** never fails for funds however much the accounts spent since, and an edit that raises the amount on a source holding exactly that transfer's money works (the edit does not count against itself). Pinned in Task 2 (`netDeltas` / `giveBacks`), Task 3 (`excludeTransferId`), Task 4 (delete refused / allowed, bulk by net change, edit lowering the amount, edit changing the destination, notes-only edit reads no balance), Task 5 (the refusal reaches the user as a plain message on delete and on the amount field on edit) and Task 6 (the delete dialog shows the refusal and stays open).
3. **Two writes at once** (double spend from the same source; A to B at the same time as B to A, or an edit or a delete of either): every account a write touches is locked in ascending id order whatever the direction of the transfer. Pinned in Task 4 (lock order tests with the source id greater than the destination id, and the old and new accounts of an edit together).
4. **Late evening in Argentina**, when UTC is already tomorrow: a transfer dated "tomorrow" by the Argentine calendar is future and refused; "today" by the Argentine calendar is accepted. Pinned in Task 4 (fake clock at `2026-10-07T01:00:00Z`).
5. An account **with transfers**: its currency can no longer change, the Banks board counts it as having movements, the Banks balance and the "Por cuenta" total move with the transfer while the summary's incomes, expenses and per-currency totals do not, and a balance that is negative for another reason (an income deleted after its money was transferred away) renders in red and is never blocked. Pinned in Task 3 (`countAccountMovements`, `listAccountsWithMovements`, neutrality property, summary service never reads `transfer`) and Task 9 (negative balance renders as danger text).

## Execution notes for the controller

- Work in place on branch `develop`, no worktree (node_modules, `.env.local`, the generated Prisma client and the user's running `next dev` live in this directory), no commits.
- **Gate after Task 1.** Tasks 1 and 2 are safe for the running app (nothing at runtime reads `Transfer` yet). Task 3 is the first task whose code queries the `Transfer` table, and the user's `next dev` hot-reloads the working tree, so BEFORE dispatching Task 3 ask the user (one message, one question): "Apply the additive migration `20261007120000_transfers` with `npx prisma migrate deploy` (it only creates the `Transfer` table) and restart `next dev` (it caches the Prisma client on `globalThis`)." Do not apply it yourself. `npx prisma migrate status` (read-only, allowed) may be used to confirm it afterwards.
- Unit tests of every task mock the database; browser verification happens only in Task 11, after the gate.
- The summary page, the Banks page and the opening balance editor call `readAccountBalances`, which Task 3 changes to read `Transfer`. That is why the gate sits before Task 3.

---

### Task 1: The `Transfer` table (schema, additive migration, client, clear-data)

**Files:**

- Modify: `prisma/schema.prisma` (new `model Transfer`, two relation fields on `Account`)
- Create: `prisma/migrations/20261007120000_transfers/migration.sql`
- Modify: `prisma/schema.test.ts`
- Modify: `scripts/clearData/tables.ts`
- Modify: `scripts/clearData/tables.test.ts`

**Interfaces:**

- Consumes: the existing `Account` model.
- Produces: the generated Prisma client with `prisma.transfer` and `Prisma.TransactionClient["transfer"]`; the `Transfer` row type (`@/lib/generated/prisma/client`); the relation names `"TransferFrom"` / `"TransferTo"` and the `Account.transfersOut` / `Account.transfersIn` relation fields that `_count` selects use in Task 3; `CLEAR_ORDER` including `"Transfer"` before `"Account"`.

- [ ] **Step 1: Record the baseline**

Run: `npx vitest run` then `npx tsc --noEmit` then `npm run lint`.
Expected: all green. Write down the numbers of test files and tests (the final task compares against them).

- [ ] **Step 2: Write the failing schema and migration tests**

Append to `prisma/schema.test.ts` (it already has `SCHEMA`, `modelBlock`, and the `readFileSync`/`join` imports):

```ts
const withoutComments = (block: string): string =>
  block.replace(/\/\/.*$/gm, "");

describe("model Transfer", () => {
  const transfer = withoutComments(modelBlock("Transfer"));

  it("belongs to a Clerk user", () => {
    expect(transfer).toMatch(/userId\s+String/);
  });

  it("leaves one account and enters another, neither of which can be deleted under it", () => {
    expect(transfer).toMatch(
      /fromAccount\s+Account\s+@relation\("TransferFrom", fields: \[fromAccountId\], references: \[id\], onDelete: Restrict\)/,
    );
    expect(transfer).toMatch(
      /toAccount\s+Account\s+@relation\("TransferTo", fields: \[toAccountId\], references: \[id\], onDelete: Restrict\)/,
    );
  });

  it("keeps the amount in minor units and the day as a calendar date", () => {
    expect(transfer).toMatch(/amount\s+BigInt/);
    expect(transfer).toMatch(/date\s+DateTime\s+@db\.Date/);
  });

  it("has optional notes", () => {
    expect(transfer).toMatch(/notes\s+String\?/);
  });

  it("has no currency of its own: it is the currency of its accounts", () => {
    expect(transfer).not.toMatch(/\bcurrency\b/);
  });

  it("indexes the user's list by date and each side of the transfer", () => {
    expect(transfer).toContain("@@index([userId, date(sort: Desc)])");
    expect(transfer).toContain("@@index([fromAccountId])");
    expect(transfer).toContain("@@index([toAccountId])");
  });
});

describe("model Account and its transfers", () => {
  it("lists the transfers that leave it and the ones that enter it", () => {
    const account = modelBlock("Account");

    expect(account).toMatch(
      /transfersOut\s+Transfer\[\]\s+@relation\("TransferFrom"\)/,
    );
    expect(account).toMatch(
      /transfersIn\s+Transfer\[\]\s+@relation\("TransferTo"\)/,
    );
  });
});

describe("the transfers migration", () => {
  const MIGRATION = readFileSync(
    join(__dirname, "migrations", "20261007120000_transfers", "migration.sql"),
    "utf8",
  );

  it("only adds: nothing that exists is dropped, renamed, truncated, updated or deleted", () => {
    expect(MIGRATION).not.toMatch(/\b(DROP|TRUNCATE|RENAME)\b/i);
    expect(MIGRATION).not.toMatch(/^\s*(UPDATE|DELETE|INSERT)\b/im);
  });

  it("alters no table but the new one", () => {
    const altered = [...MIGRATION.matchAll(/ALTER TABLE "(\w+)"/g)].map(
      (match) => match[1],
    );

    expect(altered.length).toBeGreaterThan(0);
    expect(new Set(altered)).toEqual(new Set(["Transfer"]));
  });

  it("restricts both foreign keys to accounts", () => {
    expect(MIGRATION.match(/ON DELETE RESTRICT/g)).toHaveLength(2);
  });

  it("checks what Prisma cannot express: a positive amount and two different accounts", () => {
    expect(MIGRATION).toContain('CHECK ("amount" > 0)');
    expect(MIGRATION).toContain('CHECK ("fromAccountId" <> "toAccountId")');
  });
});
```

In `scripts/clearData/tables.test.ts` add the new table to `PARENTS` (after `OpeningBalance`):

```ts
  Transfer: ["Account"],
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run prisma/schema.test.ts scripts/clearData/tables.test.ts`
Expected: FAIL (`model Transfer is not in schema.prisma`, the migration file does not exist, and CLEAR_ORDER lacks `Transfer`).

- [ ] **Step 4: Write the schema, the migration and the clear-data order**

In `prisma/schema.prisma`, add two relation fields at the end of the `Account` model (after `openingBalances OpeningBalance[]`), keeping the file's alignment:

```prisma
  // The transfers that take money out of the account and the ones that bring it in. The foreign keys
  // restrict, so an account with transfers can never be deleted (it is archived instead).
  transfersOut      Transfer[]         @relation("TransferFrom")
  transfersIn       Transfer[]         @relation("TransferTo")
```

Add the model after `Account`:

```prisma
// Money moved between two accounts of the same user and the same currency. It is its own model, not an
// income or an expense, so no total of incomes or expenses can include it by mistake. The accounts
// decide the currency (the service checks they match), so none is stored here. A CHECK constraint of
// the migration keeps the amount positive and the two accounts different.
model Transfer {
  id            String   @id @default(cuid())
  // Clerk user id — transfers are private to their owner.
  userId        String
  fromAccountId String
  fromAccount   Account  @relation("TransferFrom", fields: [fromAccountId], references: [id], onDelete: Restrict)
  toAccountId   String
  toAccount     Account  @relation("TransferTo", fields: [toAccountId], references: [id], onDelete: Restrict)
  // Minor units, like Income.amount. Always positive.
  amount        BigInt
  // The day the money moved. Never after today (Argentine time); the service enforces it.
  date          DateTime @db.Date
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId, date(sort: Desc)])
  @@index([fromAccountId])
  @@index([toAccountId])
}
```

Create `prisma/migrations/20261007120000_transfers/migration.sql`:

```sql
-- Stage 3: transfers between the user's own accounts. Additive only: a new table, its indexes, its
-- foreign keys and two checks. Nothing that exists is altered, dropped or rewritten, so the data the
-- user already has is untouched.

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transfer_userId_date_idx" ON "Transfer"("userId", "date" DESC);

-- CreateIndex
CREATE INDEX "Transfer_fromAccountId_idx" ON "Transfer"("fromAccountId");

-- CreateIndex
CREATE INDEX "Transfer_toAccountId_idx" ON "Transfer"("toAccountId");

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A transfer moves a positive amount between two different accounts. Prisma cannot express these, so
-- they are written by hand (the table is new and empty, so it already complies).
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_distinct_accounts_check" CHECK ("fromAccountId" <> "toAccountId");
```

In `scripts/clearData/tables.ts` add one line to the header comment and one entry to `CLEAR_ORDER`:

```ts
 *   Income / Expense / InstallmentPlan / RecurringExpense / RecurringIncome / OpeningBalance / Transfer
 *     -> Account (Restrict), so they all go before the accounts
```

(replace the existing "Income / Expense / InstallmentPlan / … -> Account (Restrict)" lines with the two above), and in the array, right before `"OpeningBalance"`:

```ts
  "Transfer",
  "OpeningBalance",
```

- [ ] **Step 5: Regenerate the client (no database access)**

Run: `npx prisma validate` then `npx prisma generate`.
Expected: both succeed; `lib/generated/prisma` now has the `Transfer` model. If `validate` complains about a missing `DATABASE_URL`, run only `generate`. Do not run any other `prisma` subcommand.

- [ ] **Step 6: Run the task's tests to see them pass**

Run: `npx vitest run prisma/schema.test.ts scripts/clearData`
Expected: PASS.

- [ ] **Step 7: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check prisma/schema.test.ts scripts/clearData/tables.ts scripts/clearData/tables.test.ts`.
Expected: all green, same counts as the baseline plus the new tests.

- [ ] **Step 8: Do NOT commit (the user commits only when asked); the snapshot is taken by the controller**

**GATE (controller):** before dispatching Task 3, ask the user to run `npx prisma migrate deploy` (additive: it only creates `Transfer`) and to restart `next dev`. Wait for the answer.

---

### Task 2: The transfer language: constants, errors, types, input schema and pure rules

**Files:**

- Create: `core/transfers/consts.ts`
- Create: `core/transfers/errors.ts`
- Create: `core/transfers/types.ts`
- Create: `core/transfers/schema.ts`
- Create: `core/transfers/rules.ts`
- Test: `core/transfers/schema.test.ts`
- Test: `core/transfers/rules.test.ts`

**Interfaces:**

- Consumes: `currencyField`, `amountField`, `dateField`, `notesField`, `checkAmount`, `toAmount` (`@/core/entries/fields`); `isValidIsoDate` (`@/core/incomes/dates`); `isSupportedMonth`, `monthOf` (`@/core/summary/month`); `LockedAccount` (`@/core/accounts/locks`); `ACCOUNT_*_MESSAGE` (`@/core/accounts/consts`); `BANKS_PATH` (`@/core/banks/consts`).
- Produces:
  - consts: `TRANSFERS_PATH`, `OVERVIEW_PATH`, `TRANSFER_REVALIDATE_PATHS`, `TRANSFER_FORM_FIELDS`, `MAX_TRANSFERS_PER_MONTH`, `TRANSFER_NOT_FOUND_MESSAGE`, `TRANSFERS_NOT_FOUND_MESSAGE`, `FROM_ACCOUNT_REQUIRED_MESSAGE`, `TO_ACCOUNT_REQUIRED_MESSAGE`, `SAME_ACCOUNT_MESSAGE`, `FUTURE_DATE_MESSAGE`, `DATE_RANGE_MESSAGE`, `insufficientFundsMessage(available: string): string`, `giveBackMessage(accountLabel: string, available: string, amount: string): string`, `ACCOUNT_PROBLEM_MESSAGES: Readonly<Record<TransferAccountProblem, string>>`.
  - errors: `TransferNotFoundError`, `TransferSameAccountError`, `TransferFutureDateError`, `TransferInsufficientFundsError(available: number, currency: string)`, `TransferGiveBackError(accountLabel: string, available: number, amount: number, currency: string)` (all minor units), `TransferAccountError(side: TransferSide, problem: TransferAccountProblem)`, `type TransferSide = "from" | "to"`, `type TransferAccountProblem = "NOT_FOUND" | "ARCHIVED" | "CURRENCY_MISMATCH"`.
  - types: `TransferInput`, `Transfer`, `TransferFieldErrors`, `TransferActionResult`, `TransfersDeleteResult`.
  - schema: `transferInputSchema` (zod, output `TransferInput`).
  - rules: `isFutureDate(date: string, today: string): boolean`, `FundsClaim`, `needsFundsCheck(previous: FundsClaim | null, next: FundsClaim): boolean`, `assertTransferAccount(side: TransferSide, account: LockedAccount | null, currency: string, keepAccountId: string | null): void`, `TransferMove { fromAccountId: string; toAccountId: string; amount: number }`, `netDeltas(removed: readonly TransferMove[], added: readonly TransferMove[]): Map<string, number>` (what a write changes in each account: the removed transfers reversed, the added ones applied; zero changes are absent), `GiveBack { accountId: string; amount: number }`, `giveBacks(deltas: ReadonlyMap<string, number>, except?: string | null): GiveBack[]` (the accounts that end with less than they have now, and by how much, sorted by account id; `except` is the new source, which is checked on the transfer's date instead).

- [ ] **Step 1: Write the failing schema test**

Create `core/transfers/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { transferInputSchema } from "./schema";

const VALID = {
  currency: "ARS",
  fromAccountId: "acc_1",
  toAccountId: "acc_2",
  amount: "1500.50",
  date: "2026-10-06",
  notes: "  Alquiler  ",
};

const parse = (patch: Record<string, unknown> = {}) =>
  transferInputSchema.safeParse({ ...VALID, ...patch });

const errorsOf = (patch: Record<string, unknown>) => {
  const result = parse(patch);

  if (result.success) {
    throw new Error("expected the input to be rejected");
  }

  return z.flattenError(result.error).fieldErrors;
};

describe("transferInputSchema", () => {
  it("turns a valid form into the persisted shape, with the amount in minor units and trimmed notes", () => {
    expect(parse()).toMatchObject({
      success: true,
      data: {
        currency: "ARS",
        fromAccountId: "acc_1",
        toAccountId: "acc_2",
        amount: 150050,
        date: "2026-10-06",
        notes: "Alquiler",
      },
    });
  });

  it("reads the amount with the decimals of the currency", () => {
    expect(parse({ currency: "USD", amount: "0.01" })).toMatchObject({
      success: true,
      data: { amount: 1 },
    });
  });

  it("stores no notes when they are blank or missing", () => {
    expect(parse({ notes: "   " })).toMatchObject({
      success: true,
      data: { notes: null },
    });
    expect(parse({ notes: undefined })).toMatchObject({
      success: true,
      data: { notes: null },
    });
  });

  it("keeps only its own fields: an owner or an id in the payload never gets through", () => {
    const result = parse({ userId: "attacker", id: "x" });

    expect(result.success && Object.keys(result.data).sort()).toEqual([
      "amount",
      "currency",
      "date",
      "fromAccountId",
      "notes",
      "toAccountId",
    ]);
  });

  it("asks for both accounts, each with its own message", () => {
    expect(
      errorsOf({ fromAccountId: undefined, toAccountId: "" }),
    ).toMatchObject({
      fromAccountId: ["Elegí la cuenta de origen."],
      toAccountId: ["Elegí la cuenta de destino."],
    });
  });

  it("refuses the same account on both sides, on the destination field", () => {
    expect(errorsOf({ toAccountId: "acc_1" }).toAccountId).toEqual([
      "El origen y el destino tienen que ser cuentas distintas.",
    ]);
  });

  it.each([
    ["0", "El monto debe ser mayor que cero."],
    ["0.00", "El monto debe ser mayor que cero."],
    [
      "-5",
      "Ingresa un monto válido, con dígitos y un punto para los decimales.",
    ],
    [
      "abc",
      "Ingresa un monto válido, con dígitos y un punto para los decimales.",
    ],
    [
      "1.234",
      "Ingresa un monto válido, con dígitos y un punto para los decimales.",
    ],
    ["", "Ingresa un monto válido, con dígitos y un punto para los decimales."],
  ])("refuses the amount %j", (amount, message) => {
    expect(errorsOf({ amount }).amount).toEqual([message]);
  });

  it("refuses an unsupported currency and does not also complain about the amount", () => {
    const errors = errorsOf({ currency: "XXX" });

    expect(errors.currency).toEqual(["Selecciona una moneda compatible."]);
    expect(errors.amount).toBeUndefined();
  });

  it("refuses a date the calendar does not have", () => {
    expect(errorsOf({ date: "2026-02-30" }).date).toEqual([
      "Ingresa una fecha válida.",
    ]);
  });

  it("refuses a date outside the years the app can show (2000 to 2099)", () => {
    const message = "Ingresá una fecha entre los años 2000 y 2099.";

    expect(errorsOf({ date: "1999-12-31" }).date).toEqual([message]);
    expect(errorsOf({ date: "2100-01-01" }).date).toEqual([message]);
    expect(parse({ date: "2000-01-01" }).success).toBe(true);
  });

  it("refuses notes longer than the limit", () => {
    expect(errorsOf({ notes: "a".repeat(1001) }).notes).toEqual([
      "Las notas admiten como máximo 1000 caracteres.",
    ]);
  });
});
```

- [ ] **Step 2: Write the failing rules test**

Create `core/transfers/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  assertTransferAccount,
  giveBacks,
  isFutureDate,
  needsFundsCheck,
  netDeltas,
} from "./rules";
import type { GiveBack, TransferMove } from "./rules";
import { TransferAccountError } from "./errors";

describe("isFutureDate", () => {
  it("is true only for a day after today", () => {
    expect(isFutureDate("2026-10-07", "2026-10-06")).toBe(true);
    expect(isFutureDate("2026-10-06", "2026-10-06")).toBe(false);
    expect(isFutureDate("2026-10-05", "2026-10-06")).toBe(false);
    expect(isFutureDate("2027-01-01", "2026-12-31")).toBe(true);
  });
});

describe("needsFundsCheck", () => {
  const PREVIOUS = { fromAccountId: "acc_a", amount: 1000, date: "2026-10-01" };

  it("always checks a new transfer", () => {
    expect(needsFundsCheck(null, PREVIOUS)).toBe(true);
  });

  it("does not check an edit that asks nothing more of the source (notes, destination, same or lower amount)", () => {
    expect(needsFundsCheck(PREVIOUS, { ...PREVIOUS })).toBe(false);
    expect(needsFundsCheck(PREVIOUS, { ...PREVIOUS, amount: 400 })).toBe(false);
  });

  it.each([
    ["a higher amount", { amount: 1001 }],
    ["another source", { fromAccountId: "acc_b" }],
    ["an earlier day", { date: "2026-09-30" }],
    ["a later day", { date: "2026-10-02" }],
  ])("checks an edit with %s", (_label, patch) => {
    expect(needsFundsCheck(PREVIOUS, { ...PREVIOUS, ...patch })).toBe(true);
  });
});

describe("netDeltas", () => {
  const MOVE = { fromAccountId: "acc_a", toAccountId: "acc_b", amount: 5000 };

  it("a new transfer takes its amount out of the source and puts it into the destination", () => {
    expect(netDeltas([], [MOVE])).toEqual(
      new Map([
        ["acc_a", -5000],
        ["acc_b", 5000],
      ]),
    );
  });

  it("removing a transfer reverses it: the source gets the amount back, the destination gives it back", () => {
    expect(netDeltas([MOVE], [])).toEqual(
      new Map([
        ["acc_a", 5000],
        ["acc_b", -5000],
      ]),
    );
  });

  it("an edit that changes nothing in the money (its notes) has no net change at all", () => {
    expect(netDeltas([MOVE], [{ ...MOVE }])).toEqual(new Map());
  });

  it("an edit that lowers the amount only gives back the difference, from the destination", () => {
    expect(netDeltas([MOVE], [{ ...MOVE, amount: 4000 }])).toEqual(
      new Map([
        ["acc_a", 1000],
        ["acc_b", -1000],
      ]),
    );
  });

  it("an edit that changes the destination takes the whole amount from the old one and gives it to the new one", () => {
    expect(netDeltas([MOVE], [{ ...MOVE, toAccountId: "acc_c" }])).toEqual(
      new Map([
        ["acc_b", -5000],
        ["acc_c", 5000],
      ]),
    );
  });

  it("adds up the transfers of one account (a bulk delete): what an account gets back and gives back cancels", () => {
    expect(
      netDeltas(
        [MOVE, { fromAccountId: "acc_b", toAccountId: "acc_c", amount: 2000 }],
        [],
      ),
    ).toEqual(
      new Map([
        ["acc_a", 5000],
        ["acc_b", -3000],
        ["acc_c", -2000],
      ]),
    );
  });

  it("leaves out an account whose changes cancel exactly", () => {
    const chain = [
      MOVE,
      { fromAccountId: "acc_b", toAccountId: "acc_c", amount: 5000 },
    ];

    expect(netDeltas(chain, []).has("acc_b")).toBe(false);
  });

  it("does not change the moves it is given", () => {
    const removed = [{ ...MOVE }];

    netDeltas(removed, []);

    expect(removed).toEqual([MOVE]);
  });
});

describe("giveBacks", () => {
  it("lists only the accounts that end with less, with how much, sorted by account id", () => {
    expect(
      giveBacks(
        new Map([
          ["acc_c", -2000],
          ["acc_a", 5000],
          ["acc_b", -3000],
        ]),
      ),
    ).toEqual([
      { accountId: "acc_b", amount: 3000 },
      { accountId: "acc_c", amount: 2000 },
    ]);
  });

  it("never lists an account that only gains (a delete's source) or has no change", () => {
    expect(giveBacks(new Map([["acc_a", 5000]]))).toEqual([]);
    expect(giveBacks(new Map())).toEqual([]);
  });

  it("leaves out the new source, which is checked on the transfer's date instead", () => {
    expect(
      giveBacks(
        new Map([
          ["acc_a", -8000],
          ["acc_b", -1000],
        ]),
        "acc_a",
      ),
    ).toEqual([{ accountId: "acc_b", amount: 1000 }]);
  });

  it.each([
    [
      "a delete",
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [],
      [{ accountId: "b", amount: 5000 }],
    ],
    [
      "an edit lowering the amount",
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [{ fromAccountId: "a", toAccountId: "b", amount: 4000 }],
      [{ accountId: "b", amount: 1000 }],
    ],
    [
      "an edit changing the destination",
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [{ fromAccountId: "a", toAccountId: "c", amount: 5000 }],
      [{ accountId: "b", amount: 5000 }],
    ],
    [
      "an edit that only changes the notes",
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [],
    ],
    [
      "an edit raising the amount (the destination only gains, the source is checked on its date)",
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [{ fromAccountId: "a", toAccountId: "b", amount: 7000 }],
      [],
    ],
    [
      "a new transfer",
      [],
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [],
    ],
  ])(
    "%s",
    (
      _label,
      removed: TransferMove[],
      added: TransferMove[],
      expected: GiveBack[],
    ) => {
      const nextSource = added.length > 0 ? added[0].fromAccountId : null;

      expect(giveBacks(netDeltas(removed, added), nextSource)).toEqual(
        expected,
      );
    },
  );
});

describe("assertTransferAccount", () => {
  const active = { id: "acc_a", currency: "ARS", archivedAt: null };
  const archived = {
    id: "acc_old",
    currency: "ARS",
    archivedAt: new Date("2026-09-01T00:00:00.000Z"),
  };

  it("accepts an active account in the currency of the transfer", () => {
    expect(() =>
      assertTransferAccount("from", active, "ARS", null),
    ).not.toThrow();
  });

  it("treats an account that is not the user's as not found, naming the side", () => {
    expect(() => assertTransferAccount("to", null, "ARS", null)).toThrow(
      new TransferAccountError("to", "NOT_FOUND"),
    );
  });

  it("refuses an account in another currency", () => {
    expect(() =>
      assertTransferAccount(
        "from",
        { ...active, currency: "USD" },
        "ARS",
        null,
      ),
    ).toThrow(new TransferAccountError("from", "CURRENCY_MISMATCH"));
  });

  it("refuses an archived account, but an edit may keep the one the transfer already has", () => {
    expect(() => assertTransferAccount("to", archived, "ARS", null)).toThrow(
      new TransferAccountError("to", "ARCHIVED"),
    );
    expect(() =>
      assertTransferAccount("to", archived, "ARS", "acc_other"),
    ).toThrow(new TransferAccountError("to", "ARCHIVED"));
    expect(() =>
      assertTransferAccount("to", archived, "ARS", "acc_old"),
    ).not.toThrow();
  });

  it("checks the currency before the archive state, like assertUsableAccount", () => {
    expect(() =>
      assertTransferAccount(
        "from",
        { ...archived, currency: "USD" },
        "ARS",
        null,
      ),
    ).toThrow(new TransferAccountError("from", "CURRENCY_MISMATCH"));
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run core/transfers`
Expected: FAIL (the modules do not exist).

- [ ] **Step 4: Write the implementation**

`core/transfers/errors.ts`:

```ts
// Kept apart from the service so actions can branch on them (and tests can mock the service)
// without the classes disappearing with it.

// The transfer does not exist or is not the user's.
export class TransferNotFoundError extends Error {
  constructor() {
    super("Transfer not found");
    this.name = "TransferNotFoundError";
  }
}

// Money cannot leave an account and enter the same one.
export class TransferSameAccountError extends Error {
  constructor() {
    super("The transfer has the same account on both sides");
    this.name = "TransferSameAccountError";
  }
}

// A transfer is money that already moved: its day is never after today (Argentine time).
export class TransferFutureDateError extends Error {
  constructor() {
    super("The transfer date is in the future");
    this.name = "TransferFutureDateError";
  }
}

// The source account held less than the amount on the transfer date (minor units, in `currency`).
export class TransferInsufficientFundsError extends Error {
  constructor(
    readonly available: number,
    readonly currency: string,
  ) {
    super(`The source account held ${available} (${currency}) on that date`);
    this.name = "TransferInsufficientFundsError";
  }
}

export type TransferSide = "from" | "to";

export type TransferAccountProblem =
  "NOT_FOUND" | "ARCHIVED" | "CURRENCY_MISMATCH";

// One side of the transfer has an account that cannot be used: not the user's, archived, or in
// another currency than the transfer. The side tells the form which field to mark.
export class TransferAccountError extends Error {
  constructor(
    readonly side: TransferSide,
    readonly problem: TransferAccountProblem,
  ) {
    super(`The ${side} account of the transfer is unusable: ${problem}`);
    this.name = "TransferAccountError";
  }
}

// Undoing a transfer (deleting it, lowering its amount, moving it to another destination) takes money
// back from an account, and this one already spent it. `available` is what it holds now and `amount`
// what it would have to give back (minor units, in `currency`); `accountLabel` is "Banco · Cuenta".
export class TransferGiveBackError extends Error {
  constructor(
    readonly accountLabel: string,
    readonly available: number,
    readonly amount: number,
    readonly currency: string,
  ) {
    super(
      `${accountLabel} holds ${available} (${currency}) and would have to give back ${amount}`,
    );
    this.name = "TransferGiveBackError";
  }
}
```

`core/transfers/consts.ts`:

```ts
import {
  ACCOUNT_ARCHIVED_MESSAGE,
  ACCOUNT_CHOICE_NOT_FOUND_MESSAGE,
  ACCOUNT_CURRENCY_MISMATCH_MESSAGE,
} from "@/core/accounts/consts";
import { BANKS_PATH } from "@/core/banks/consts";

import type { TransferAccountProblem } from "./errors";

export const TRANSFERS_PATH = "/dashboard/transfers";
export const OVERVIEW_PATH = "/dashboard/overview";

// Moving money changes what the Banks board and the summary's "Por cuenta" card show, so a write
// refreshes all three pages.
export const TRANSFER_REVALIDATE_PATHS = [
  TRANSFERS_PATH,
  BANKS_PATH,
  OVERVIEW_PATH,
] as const;

export const TRANSFER_FORM_FIELDS = [
  "currency",
  "fromAccountId",
  "toAccountId",
  "amount",
  "date",
  "notes",
] as const;

// A month of transfers is read whole (the list has no pages); a real month never gets near this.
export const MAX_TRANSFERS_PER_MONTH = 500;

export const TRANSFER_NOT_FOUND_MESSAGE = "No se encontró la transferencia.";
export const TRANSFERS_NOT_FOUND_MESSAGE =
  "No se encontraron las transferencias seleccionadas.";

export const FROM_ACCOUNT_REQUIRED_MESSAGE = "Elegí la cuenta de origen.";
export const TO_ACCOUNT_REQUIRED_MESSAGE = "Elegí la cuenta de destino.";
export const SAME_ACCOUNT_MESSAGE =
  "El origen y el destino tienen que ser cuentas distintas.";
export const FUTURE_DATE_MESSAGE = "La fecha no puede ser posterior a hoy.";
export const DATE_RANGE_MESSAGE =
  "Ingresá una fecha entre los años 2000 y 2099.";

// `available` is already formatted in the currency of the transfer.
export const insufficientFundsMessage = (available: string): string =>
  `La cuenta de origen no tiene fondos suficientes: a esa fecha tenía ${available}.`;

// What each problem of an account says, on the field of the side it is about.
export const ACCOUNT_PROBLEM_MESSAGES: Readonly<
  Record<TransferAccountProblem, string>
> = {
  NOT_FOUND: ACCOUNT_CHOICE_NOT_FOUND_MESSAGE,
  ARCHIVED: ACCOUNT_ARCHIVED_MESSAGE,
  CURRENCY_MISMATCH: ACCOUNT_CURRENCY_MISMATCH_MESSAGE,
};

// Said when undoing a transfer (a delete, or an edit that takes money back) would push the account that
// has to give it back below zero. `available` and `amount` are already formatted in its currency.
export const giveBackMessage = (
  accountLabel: string,
  available: string,
  amount: string,
): string =>
  `No se puede deshacer: ${accountLabel} tiene ${available} y tendría que devolver ${amount}.`;
```

`core/transfers/types.ts`:

```ts
// Validated transfer data. `amount` is in minor units of `currency`; `date` is "YYYY-MM-DD".
export interface TransferInput {
  currency: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  notes: string | null;
}

// A transfer as the client reads it: no owner, the accounts labelled "Banco · Cuenta", and the
// currency of its accounts.
export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  fromLabel: string;
  toLabel: string;
  currency: string;
  amount: number;
  date: string;
  notes: string | null;
}

export type TransferFieldErrors = Record<string, string[]>;

export type TransferActionResult =
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: TransferFieldErrors };

// What deleting several transfers at once answers: how many went away.
export type TransfersDeleteResult =
  { status: "success"; deleted: number } | { status: "error"; message: string };
```

`core/transfers/schema.ts`:

```ts
import { z } from "zod";

import {
  amountField,
  checkAmount,
  currencyField,
  dateField,
  notesField,
  toAmount,
} from "@/core/entries/fields";
import { isValidIsoDate } from "@/core/incomes/dates";
import { isSupportedMonth, monthOf } from "@/core/summary/month";

import {
  DATE_RANGE_MESSAGE,
  FROM_ACCOUNT_REQUIRED_MESSAGE,
  SAME_ACCOUNT_MESSAGE,
  TO_ACCOUNT_REQUIRED_MESSAGE,
} from "./consts";
import type { TransferInput } from "./types";

const accountField = (message: string) =>
  z.string({ error: message }).trim().min(1, message);

// Validates raw form values (all strings) and outputs the persisted shape, with the amount already
// converted to minor units for the chosen currency. The service checks what only the database can
// tell: that both accounts are the user's, active and in that currency, the date against today, and
// the funds.
export const transferInputSchema = z
  .object({
    currency: currencyField,
    fromAccountId: accountField(FROM_ACCOUNT_REQUIRED_MESSAGE),
    toAccountId: accountField(TO_ACCOUNT_REQUIRED_MESSAGE),
    amount: amountField,
    date: dateField,
    notes: notesField,
  })
  .superRefine((value, ctx) => {
    checkAmount(value, ctx);

    if (
      value.fromAccountId !== "" &&
      value.fromAccountId === value.toAccountId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["toAccountId"],
        message: SAME_ACCOUNT_MESSAGE,
      });
    }

    // The month filter only reaches 2000 to 2099, so a transfer outside them could never be found.
    if (isValidIsoDate(value.date) && !isSupportedMonth(monthOf(value.date))) {
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: DATE_RANGE_MESSAGE,
      });
    }
  })
  .transform((value): TransferInput => ({
    ...value,
    amount: toAmount(value),
  }));
```

`core/transfers/rules.ts`:

```ts
import type { LockedAccount } from "@/core/accounts/locks";

import { TransferAccountError } from "./errors";
import type { TransferSide } from "./errors";

// Pure rules of a transfer, apart from the service so they are tested without a database.

// ISO dates compare as text.
export const isFutureDate = (date: string, today: string): boolean =>
  date > today;

// What a transfer asks of its source account.
export interface FundsClaim {
  fromAccountId: string;
  // Minor units.
  amount: number;
  // "YYYY-MM-DD".
  date: string;
}

// A new transfer always asks for funds. An edit asks again only when it asks something new of the
// source: another source, another day (the balance of that day may be lower) or a higher amount. A
// change of destination or notes, or a lower amount on the same source and day, keeps the claim the
// source already honoured, so an old transfer can always be annotated.
export const needsFundsCheck = (
  previous: FundsClaim | null,
  next: FundsClaim,
): boolean =>
  previous === null ||
  previous.fromAccountId !== next.fromAccountId ||
  previous.date !== next.date ||
  next.amount > previous.amount;

// The same rule as assertUsableAccount, applied to an account that was just read under its row lock:
// it must be the user's, in the currency of the transfer, and active. An edit may keep the account the
// transfer already has (`keepAccountId`) even if it was archived since; it can never move to an
// archived one.
export const assertTransferAccount = (
  side: TransferSide,
  account: LockedAccount | null,
  currency: string,
  keepAccountId: string | null,
): void => {
  if (account === null) {
    throw new TransferAccountError(side, "NOT_FOUND");
  }

  if (account.currency !== currency) {
    throw new TransferAccountError(side, "CURRENCY_MISMATCH");
  }

  if (account.archivedAt !== null && account.id !== keepAccountId) {
    throw new TransferAccountError(side, "ARCHIVED");
  }
};

// One transfer as far as money is concerned.
export interface TransferMove {
  fromAccountId: string;
  toAccountId: string;
  // Minor units.
  amount: number;
}

// What a write changes in each account, in minor units. A transfer takes its amount out of the source
// and puts it into the destination; the transfers a write takes away have that effect reversed (the
// source gets the amount back, the destination gives it back) and the ones it adds have it applied. The
// net per account is what matters: an edit that keeps the destination and lowers the amount only takes
// the difference from it, and an edit that changes nothing in the money (its notes) changes nothing.
// An account whose net change is zero is absent.
export const netDeltas = (
  removed: readonly TransferMove[],
  added: readonly TransferMove[],
): Map<string, number> => {
  const deltas = new Map<string, number>();
  const add = (accountId: string, amount: number) =>
    deltas.set(accountId, (deltas.get(accountId) ?? 0) + amount);

  for (const move of removed) {
    add(move.fromAccountId, move.amount);
    add(move.toAccountId, -move.amount);
  }

  for (const move of added) {
    add(move.fromAccountId, -move.amount);
    add(move.toAccountId, move.amount);
  }

  return new Map([...deltas].filter(([, delta]) => delta !== 0));
};

export interface GiveBack {
  accountId: string;
  // Minor units the account ends up with less than it has now.
  amount: number;
}

// The accounts that end up with less than they hold now, and by how much, sorted by account id: each
// must still hold that much now, or the write would push it below zero. An account that only gains is
// never listed. `except` is the account the new transfer leaves from: its funds are checked on the
// transfer's own date, without the effect of the transfer being replaced, so it is not checked here.
export const giveBacks = (
  deltas: ReadonlyMap<string, number>,
  except: string | null = null,
): GiveBack[] =>
  [...deltas]
    .filter(([accountId, delta]) => delta < 0 && accountId !== except)
    .map(([accountId, delta]) => ({ accountId, amount: -delta }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run core/transfers`
Expected: PASS. (If a zod-4 detail makes one of the schema tests fail for a reason other than the code above, fix the test's expectation only when the behaviour is the documented one; otherwise fix the schema.)

- [ ] **Step 6: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check core/transfers`.
Expected: all green.

- [ ] **Step 7: Do NOT commit (the user commits only when asked); the snapshot is taken by the controller**

---

### Task 3: Balance integration: transfer flows, `asOf`, `excludeTransferId`, movements

**Files:**

- Modify: `core/balances/types.ts` (`AccountFlow.kind`)
- Modify: `core/balances/accounts.ts` (`signed`, header comment)
- Modify: `core/balances/accountBalances.ts` (`BalanceReader`, `BalanceOptions`, transfer reads, `asOf`)
- Modify: `core/accounts/movements.ts` (count transfers)
- Test: `core/balances/accounts.test.ts`
- Test: `core/balances/accountBalances.test.ts`
- Test: `core/accounts/movements.test.ts`
- Test: `core/summary/service.test.ts` (the summary never reads transfers)

**Interfaces:**

- Consumes: `prisma.transfer` and the `Account.transfersOut`/`transfersIn` relations (Task 1, migration applied at the gate); `getOpeningBalances`; `monthRange`.
- Produces:
  - `AccountFlow["kind"]` is now `"income" | "expense" | "transferOut" | "transferIn"`.
  - `BalanceReader = Pick<Prisma.TransactionClient, "openingBalance" | "income" | "expense" | "transfer" | "account">`.
  - `interface BalanceOptions { asOf?: string; excludeTransferId?: string }`.
  - `readAccountBalances(db: BalanceReader, userId: string, accountIds?: readonly string[], options?: BalanceOptions): Promise<AccountBalance[]>` (the previous 3-argument form keeps working and means "now, everything").
  - `countAccountMovements` / `listAccountsWithMovements` count `transfersOut` and `transfersIn`.

- [ ] **Step 1: Write the failing pure tests (`accounts.test.ts`)**

Append to `core/balances/accounts.test.ts` (it already imports `sumAccountBalances`, `totalsByCurrency`, and has the `flow` helper):

```ts
describe("transfers as flows", () => {
  it("takes the amount out of the source and puts it into the destination", () => {
    expect(
      sumAccountBalances(
        [],
        [
          flow("acc_a", "income", 10000),
          flow("acc_a", "transferOut", 4000),
          flow("acc_b", "transferIn", 4000),
        ],
      ),
    ).toEqual([
      { accountId: "acc_a", currency: "ARS", balance: 6000 },
      { accountId: "acc_b", currency: "ARS", balance: 4000 },
    ]);
  });

  it("lets an account go negative (an income deleted after its money was transferred away leaves it in red, never blocked)", () => {
    expect(
      sumAccountBalances(
        [{ accountId: "acc_b", currency: "ARS", amount: 0 }],
        [flow("acc_b", "expense", 3000)],
      ),
    ).toEqual([{ accountId: "acc_b", currency: "ARS", balance: -3000 }]);
  });

  it.each([[1], [4000], [10000], [999999999]])(
    "never changes the total of a currency: a transfer of %i leaves it as it was",
    (amount) => {
      const base = [
        flow("acc_a", "income", 10000),
        flow("acc_b", "expense", 2500),
        flow("acc_usd", "income", 777, "USD"),
      ];
      const before = totalsByCurrency(sumAccountBalances([], base));
      const after = totalsByCurrency(
        sumAccountBalances(
          [],
          [
            ...base,
            flow("acc_a", "transferOut", amount),
            flow("acc_b", "transferIn", amount),
          ],
        ),
      );

      expect(after).toEqual(before);
    },
  );

  it("is neutral in the previous balance of a month too", () => {
    const opened = opening("2026-06", ["acc_a", 5000], ["acc_b", 0]);
    const flows = [
      flow("acc_a", "transferOut", 2000),
      flow("acc_b", "transferIn", 2000),
    ];

    expect(
      totalsByCurrency(previousAccountBalances("2026-09", opened, flows)),
    ).toEqual(totalsByCurrency(previousAccountBalances("2026-09", opened, [])));
  });
});
```

(`previousAccountBalances` and the `opening` helper already exist in the file; add `previousAccountBalances` to the import if the file's import list lacks it.)

- [ ] **Step 2: Write the failing reader tests (`accountBalances.test.ts`)**

In `core/balances/accountBalances.test.ts`, replace `fakeDb` with a version that has the two new tables (everything else in the file stays):

```ts
const fakeDb = () => ({
  openingBalance: { findMany: vi.fn().mockResolvedValue([]) },
  income: { groupBy: vi.fn().mockResolvedValue([]) },
  expense: { groupBy: vi.fn().mockResolvedValue([]) },
  transfer: { groupBy: vi.fn().mockResolvedValue([]) },
  account: { findMany: vi.fn().mockResolvedValue([]) },
});

// A transfer group is keyed by the side it was grouped by.
const outGroup = (accountId: string, amount: number) => ({
  fromAccountId: accountId,
  _sum: { amount: BigInt(amount) },
});
const inGroup = (accountId: string, amount: number) => ({
  toAccountId: accountId,
  _sum: { amount: BigInt(amount) },
});
```

Append these tests inside `describe("readAccountBalances", …)`:

```ts
describe("transfers", () => {
  it("reads the user's transfers grouped by each side, with no upper date", async () => {
    await readAccountBalances(db as never, USER_ID);

    expect(db.transfer.groupBy).toHaveBeenCalledWith({
      by: ["fromAccountId"],
      where: { userId: USER_ID },
      _sum: { amount: true },
    });
    expect(db.transfer.groupBy).toHaveBeenCalledWith({
      by: ["toAccountId"],
      where: { userId: USER_ID },
      _sum: { amount: true },
    });
  });

  it("takes the money out of the source and into the destination, in the currency of the accounts", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("acc_bank", "ARS", 5000),
    ]);
    db.transfer.groupBy.mockImplementation(async ({ by }: { by: string[] }) =>
      by[0] === "fromAccountId"
        ? [outGroup("acc_bank", 1200)]
        : [inGroup("acc_cash", 1200)],
    );
    db.account.findMany.mockResolvedValue([
      { id: "acc_bank", currency: "ARS" },
      { id: "acc_cash", currency: "ARS" },
    ]);

    expect(await readAccountBalances(db as never, USER_ID)).toEqual([
      { accountId: "acc_bank", currency: "ARS", balance: 3800 },
      { accountId: "acc_cash", currency: "ARS", balance: 1200 },
    ]);
    expect(db.account.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, id: { in: ["acc_bank", "acc_cash"] } },
      select: { id: true, currency: true },
    });
  });

  it("shows an account that only has transfers", async () => {
    db.transfer.groupBy.mockImplementation(async ({ by }: { by: string[] }) =>
      by[0] === "toAccountId" ? [inGroup("acc_new", 700)] : [],
    );
    db.account.findMany.mockResolvedValue([{ id: "acc_new", currency: "USD" }]);

    expect(await readAccountBalances(db as never, USER_ID)).toEqual([
      { accountId: "acc_new", currency: "USD", balance: 700 },
    ]);
  });

  it("does not look the accounts up when there is no transfer", async () => {
    await readAccountBalances(db as never, USER_ID);

    expect(db.account.findMany).not.toHaveBeenCalled();
  });

  it("counts transfers from the first day of the opening month, like the entries", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("acc_bank", "ARS", 5000),
    ]);

    await readAccountBalances(db as never, USER_ID);

    for (const call of db.transfer.groupBy.mock.calls) {
      expect(call[0].where.date).toEqual({
        gte: new Date("2026-06-01T00:00:00.000Z"),
      });
    }
  });

  it("narrows each side to the accounts asked for", async () => {
    await readAccountBalances(db as never, USER_ID, ["acc_bank"]);

    expect(db.transfer.groupBy).toHaveBeenCalledWith({
      by: ["fromAccountId"],
      where: { userId: USER_ID, fromAccountId: { in: ["acc_bank"] } },
      _sum: { amount: true },
    });
    expect(db.transfer.groupBy).toHaveBeenCalledWith({
      by: ["toAccountId"],
      where: { userId: USER_ID, toAccountId: { in: ["acc_bank"] } },
      _sum: { amount: true },
    });
  });
});

describe("asOf", () => {
  it("counts every kind of movement up to that day, both ends included", async () => {
    await readAccountBalances(db as never, USER_ID, ["acc_bank"], {
      asOf: "2026-09-15",
    });

    const upTo = { lte: new Date("2026-09-15T00:00:00.000Z") };

    expect(db.income.groupBy.mock.calls[0][0].where.date).toEqual(upTo);
    expect(db.expense.groupBy.mock.calls[0][0].where.date).toEqual(upTo);
    for (const call of db.transfer.groupBy.mock.calls) {
      expect(call[0].where.date).toEqual(upTo);
    }
  });

  it("keeps the opening month as the lower bound when there is an opening balance that has started", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("acc_bank", "ARS", 5000),
    ]);

    const balances = await readAccountBalances(
      db as never,
      USER_ID,
      ["acc_bank"],
      { asOf: "2026-06-01" },
    );

    expect(db.income.groupBy.mock.calls[0][0].where.date).toEqual({
      gte: new Date("2026-06-01T00:00:00.000Z"),
      lte: new Date("2026-06-01T00:00:00.000Z"),
    });
    expect(balances).toEqual([
      { accountId: "acc_bank", currency: "ARS", balance: 5000 },
    ]);
  });

  it("holds nothing before the opening month began: no balance is invented, and nothing is queried", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("acc_bank", "ARS", 5000),
    ]);

    const balances = await readAccountBalances(
      db as never,
      USER_ID,
      ["acc_bank"],
      { asOf: "2026-05-31" },
    );

    expect(balances).toEqual([]);
    expect(db.income.groupBy).not.toHaveBeenCalled();
    expect(db.expense.groupBy).not.toHaveBeenCalled();
    expect(db.transfer.groupBy).not.toHaveBeenCalled();
  });

  it("without an opening balance only the upper bound applies", async () => {
    db.income.groupBy.mockResolvedValue([group("acc_bank", "ARS", 900)]);

    const balances = await readAccountBalances(
      db as never,
      USER_ID,
      undefined,
      {
        asOf: "2026-01-01",
      },
    );

    expect(balances).toEqual([
      { accountId: "acc_bank", currency: "ARS", balance: 900 },
    ]);
  });
});

describe("excludeTransferId", () => {
  it("leaves that transfer out of both sides, so an edit never counts against itself", async () => {
    await readAccountBalances(db as never, USER_ID, ["acc_bank"], {
      excludeTransferId: "tr_1",
    });

    for (const call of db.transfer.groupBy.mock.calls) {
      expect(call[0].where.id).toEqual({ not: "tr_1" });
    }
    expect(db.income.groupBy.mock.calls[0][0].where.id).toBeUndefined();
  });
});
```

- [ ] **Step 3: Write the failing movements and summary tests**

In `core/accounts/movements.test.ts`, extend the helpers and the two expectations:

```ts
const counts = (patch: Record<string, number> = {}) => ({
  incomes: 0,
  expenses: 0,
  recurringIncomes: 0,
  recurringExpenses: 0,
  installmentPlans: 0,
  openingBalances: 0,
  transfersOut: 0,
  transfersIn: 0,
  ...patch,
});

const COUNT_SELECT = {
  incomes: true,
  expenses: true,
  recurringIncomes: true,
  recurringExpenses: true,
  installmentPlans: true,
  openingBalances: true,
  transfersOut: true,
  transfersIn: true,
};
```

and add two tests:

```ts
describe("transfers pin an account", () => {
  it("count as movements on both sides: an account with transfers cannot change its currency", async () => {
    const db = {
      account: {
        findFirst: vi.fn().mockResolvedValue({
          _count: counts({ transfersOut: 1, transfersIn: 2 }),
        }),
      },
    };

    await expect(
      countAccountMovements(db as never, USER_ID, "acc_1"),
    ).resolves.toBe(3);
  });

  it("flag an account that only has a transfer coming in", async () => {
    const db = {
      account: {
        findMany: vi.fn().mockResolvedValue([
          { id: "acc_1", _count: counts({ transfersIn: 1 }) },
          { id: "acc_2", _count: counts() },
        ]),
      },
    };

    await expect(
      listAccountsWithMovements(db as never, USER_ID),
    ).resolves.toEqual(new Set(["acc_1"]));
  });
});
```

In `core/summary/service.test.ts`, add the table to the hoisted mock and a test that the summary never reads it:

```ts
const db = vi.hoisted(() => ({
  income: { groupBy: vi.fn() },
  expense: { groupBy: vi.fn(), findMany: vi.fn() },
  openingBalance: { findMany: vi.fn() },
  // The summary must never read it: a transfer is neither an income nor an expense.
  transfer: { groupBy: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
}));
```

```ts
it("never reads transfers: moving money between accounts changes no total of the month", async () => {
  db.openingBalance.findMany.mockResolvedValue([
    openingRow("acc_ARS", "ARS", 5000, "2026-06"),
  ]);
  db.income.groupBy.mockResolvedValue([monthGroup("ARS", "SETTLED", 1000)]);

  await getMonthlySummary(USER_ID, "2026-09");

  expect(db.transfer.groupBy).not.toHaveBeenCalled();
  expect(db.transfer.findMany).not.toHaveBeenCalled();
  expect(db.transfer.aggregate).not.toHaveBeenCalled();
});
```

Add it inside `describe("getMonthlySummary", …)`.

- [ ] **Step 4: Run the tests to see them fail**

Run: `npx vitest run core/balances core/accounts/movements.test.ts core/summary/service.test.ts`
Expected: FAIL — `transferOut`/`transferIn` are not flow kinds (type errors surface as wrong sums), `db.transfer.groupBy` is never called, `asOf` is ignored, `_count` does not select the transfer relations. The summary test passes already (it pins what must keep being true).

- [ ] **Step 5: Write the implementation**

`core/balances/types.ts` — replace the `AccountFlow` block:

```ts
// Settled money that moved in one account, one side at a time (minor units, positive for its side).
// A transfer is two flows of its own kind: out of the source and into the destination.
export interface AccountFlow {
  accountId: string;
  currency: string;
  kind: "income" | "expense" | "transferOut" | "transferIn";
  amount: number;
}
```

`core/balances/accounts.ts` — replace the header comment and `signed`:

```ts
// The one place that turns money into balances. Every balance of the app (the summary, the Banks
// board, the archive rule, the transfers' funds check, the "Por cuenta" card) is built here, so a
// currency's total is always the sum of its accounts. A transfer is two flows (one out of the source,
// one into the destination) of the same amount and currency, so it can never alter a currency total.

const signed = ({ kind, amount }: AccountFlow): number =>
  kind === "income" || kind === "transferIn" ? amount : -amount;
```

`core/accounts/movements.ts` — update the comment and the map:

```ts
// Everything that points at an account and pins its currency: its incomes and expenses, its recurring
// templates and installment plans, its opening amount and the transfers that leave it or enter it.
const MOVEMENT_COUNTS = {
  incomes: true,
  expenses: true,
  recurringIncomes: true,
  recurringExpenses: true,
  installmentPlans: true,
  openingBalances: true,
  transfersOut: true,
  transfersIn: true,
} as const;
```

`core/balances/accountBalances.ts` — replace the whole file:

```ts
import { isoDateToDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { monthRange } from "@/core/summary/month";
import type { Prisma } from "@/lib/generated/prisma/client";

import { sumAccountBalances } from "./accounts";
import { getOpeningBalances } from "./service";
import type { AccountBalance, AccountFlow } from "./types";

export type BalanceReader = Pick<
  Prisma.TransactionClient,
  "openingBalance" | "income" | "expense" | "transfer" | "account"
>;

export interface BalanceOptions {
  // Count only what had moved by this day ("YYYY-MM-DD", the day included): the balance of an account
  // on a date. Without it every settled movement counts, whatever its date (what the account holds now).
  asOf?: string;
  // A transfer left out of the sums: the one an edit is about to replace, so it never counts against
  // its own funds.
  excludeTransferId?: string;
}

interface FlowGroup {
  accountId: string;
  currency: string;
  _sum: { amount: bigint | null };
}

interface TransferGroup {
  accountId: string;
  _sum: { amount: bigint | null };
}

const toFlows = (
  groups: readonly FlowGroup[],
  kind: AccountFlow["kind"],
): AccountFlow[] =>
  groups.flatMap(({ accountId, currency, _sum }) =>
    _sum.amount === null
      ? []
      : [
          {
            accountId,
            currency,
            kind,
            amount: minorUnitsToNumber(_sum.amount),
          },
        ],
  );

// A transfer has no currency of its own: it is the one of its accounts.
const toTransferFlows = (
  groups: readonly TransferGroup[],
  kind: "transferOut" | "transferIn",
  currencyOf: ReadonlyMap<string, string>,
): AccountFlow[] =>
  groups.flatMap(({ accountId, _sum }) => {
    const currency = currencyOf.get(accountId);

    return _sum.amount === null || currency === undefined
      ? []
      : [
          {
            accountId,
            currency,
            kind,
            amount: minorUnitsToNumber(_sum.amount),
          },
        ];
  });

const dateRange = (from: string | null, asOf: string | undefined) =>
  from === null && asOf === undefined
    ? {}
    : {
        date: {
          ...(from === null ? {} : { gte: isoDateToDate(from) }),
          ...(asOf === undefined ? {} : { lte: isoDateToDate(asOf) }),
        },
      };

// What the user's accounts hold (all of them, or only `accountIds`): the opening amount plus every
// settled income and transfer in, minus every settled expense and transfer out, counting from the
// first day of the opening month when there is one. A settled movement is money that already moved,
// so there is no upper date unless `asOf` asks for the balance of a day: then only what had moved by
// that day counts, and before the opening month began nothing does (no balance is invented). Scoped
// by userId. Any client can read it, so the archive rule and the transfers' funds check call it inside
// the transaction that locks the accounts. Accounts with neither an opening amount nor a movement are
// absent: their balance is 0.
export const readAccountBalances = async (
  db: BalanceReader,
  userId: string,
  accountIds?: readonly string[],
  { asOf, excludeTransferId }: BalanceOptions = {},
): Promise<AccountBalance[]> => {
  const opening = await getOpeningBalances(userId, db);
  const openingFrom = opening ? monthRange(opening.month).from : null;

  if (openingFrom !== null && asOf !== undefined && asOf < openingFrom) {
    return [];
  }

  const range = dateRange(openingFrom, asOf);
  const scope = accountIds ? { in: [...accountIds] } : null;
  const query = {
    by: ["accountId", "currency"] as ("accountId" | "currency")[],
    where: {
      userId,
      status: "SETTLED" as const,
      ...(scope ? { accountId: scope } : {}),
      ...range,
    },
    _sum: { amount: true as const },
  };
  const incomes = await db.income.groupBy(query);
  const expenses = await db.expense.groupBy(query);

  const transferWhere = {
    userId,
    ...range,
    ...(excludeTransferId ? { id: { not: excludeTransferId } } : {}),
  };
  const outgoing = (
    await db.transfer.groupBy({
      by: ["fromAccountId"],
      where: { ...transferWhere, ...(scope ? { fromAccountId: scope } : {}) },
      _sum: { amount: true },
    })
  ).map(({ fromAccountId, _sum }) => ({ accountId: fromAccountId, _sum }));
  const incoming = (
    await db.transfer.groupBy({
      by: ["toAccountId"],
      where: { ...transferWhere, ...(scope ? { toAccountId: scope } : {}) },
      _sum: { amount: true },
    })
  ).map(({ toAccountId, _sum }) => ({ accountId: toAccountId, _sum }));

  const transferAccountIds = [
    ...new Set([...outgoing, ...incoming].map(({ accountId }) => accountId)),
  ];
  const currencies =
    transferAccountIds.length === 0
      ? []
      : await db.account.findMany({
          where: { userId, id: { in: transferAccountIds } },
          select: { id: true, currency: true },
        });
  const currencyOf = new Map(
    currencies.map(({ id, currency }) => [id, currency]),
  );

  const wanted = accountIds ? new Set(accountIds) : null;
  const amounts = (opening?.amounts ?? []).filter(
    ({ accountId }) => wanted === null || wanted.has(accountId),
  );

  return sumAccountBalances(amounts, [
    ...toFlows(incomes, "income"),
    ...toFlows(expenses, "expense"),
    ...toTransferFlows(outgoing, "transferOut", currencyOf),
    ...toTransferFlows(incoming, "transferIn", currencyOf),
  ]);
};
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run core/balances core/accounts core/banks core/summary`
Expected: PASS. If another test file's database mock lacks `transfer`/`account` because it calls the real `readAccountBalances`, add the two tables (returning `[]`) to that mock; do not weaken any assertion.

- [ ] **Step 7: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check core/balances core/accounts/movements.ts core/accounts/movements.test.ts core/summary/service.test.ts`.
Expected: all green.

- [ ] **Step 8: Do NOT commit (the user commits only when asked); the snapshot is taken by the controller**

---

### Task 4: The transfers service (list, create, update, delete) and ordered account locks

**Files:**

- Modify: `core/accounts/locks.ts` (add `inLockOrder`, `lockAccounts`)
- Test: `core/accounts/locks.test.ts`
- Create: `core/transfers/service.ts`
- Test: `core/transfers/service.test.ts`

**Interfaces:**

- Consumes: Task 2 (`TransferInput`, `Transfer`, errors including `TransferGiveBackError`, `isFutureDate`, `needsFundsCheck`, `assertTransferAccount`, `netDeltas`, `giveBacks`, `MAX_TRANSFERS_PER_MONTH`); Task 3 (`readAccountBalances(tx, userId, [id], { asOf, excludeTransferId })` for the dated source check and `readAccountBalances(tx, userId, ids)` for the current balance of the accounts that give money back); `lockAccount`, `LockedAccount` (`@/core/accounts/locks`); `accountLabel` (`@/core/accounts/label`); `todayIso`, `isoDateToDate`, `dateToIsoDate` (`@/core/incomes/dates`); `minorUnitsToNumber`; `monthRange`.
- Produces:
  - `inLockOrder(ids: readonly string[]): string[]` (deduplicated, ascending) and `lockAccounts(tx, userId, ids): Promise<Map<string, LockedAccount>>` in `core/accounts/locks.ts`.
  - `listTransfers(userId: string, month: string): Promise<Transfer[]>`
  - `createTransfer(userId: string, input: TransferInput, today?: string): Promise<void>`
  - `updateTransfer(userId: string, id: string, input: TransferInput, today?: string): Promise<boolean>` (false when the transfer is not the user's)
  - `deleteTransfer(userId: string, id: string): Promise<boolean>` and `deleteTransfers(userId: string, ids: readonly string[]): Promise<number>`; both lock the accounts of the transfers (ascending id), refuse with `TransferGiveBackError` when an account would have to give back more than it holds (the whole selection is checked by net change, all or nothing), and only then delete.
  - `createTransfer` / `updateTransfer` throw `TransferInsufficientFundsError` (the source on the transfer date), `TransferGiveBackError` (the old destination cannot give back) and the account/date errors of Task 2.
  - `today` defaults to `todayIso()` (Argentine time).

- [ ] **Step 1: Write the failing lock tests**

Append to `core/accounts/locks.test.ts` and extend its import to `import { inLockOrder, lockAccount, lockAccounts } from "./locks";`:

```ts
describe("inLockOrder", () => {
  it("sorts the ids ascending and drops duplicates, so every caller locks in the same order", () => {
    expect(inLockOrder(["acc_c", "acc_a", "acc_c", "acc_b"])).toEqual([
      "acc_a",
      "acc_b",
      "acc_c",
    ]);
  });

  it("does not change what it is given", () => {
    const ids = ["b", "a"];

    inLockOrder(ids);

    expect(ids).toEqual(["b", "a"]);
  });
});

describe("lockAccounts", () => {
  const accounts: Record<
    string,
    { id: string; currency: string; archivedAt: Date | null }
  > = {
    acc_a: { id: "acc_a", currency: "ARS", archivedAt: null },
    acc_b: { id: "acc_b", currency: "USD", archivedAt: null },
  };

  it("locks each account FOR UPDATE, one after the other, in ascending id order whatever the order asked", async () => {
    const tx = {
      $queryRaw: vi.fn(async (_strings: TemplateStringsArray, id: string) =>
        accounts[id] ? [accounts[id]] : [],
      ),
    };

    const locked = await lockAccounts(tx as never, USER_ID, [
      "acc_b",
      "acc_a",
      "acc_b",
    ]);

    expect(tx.$queryRaw.mock.calls.map((call) => call[1])).toEqual([
      "acc_a",
      "acc_b",
    ]);
    expect(tx.$queryRaw.mock.calls.every((call) => call[2] === USER_ID)).toBe(
      true,
    );
    expect([...locked.keys()]).toEqual(["acc_a", "acc_b"]);
    expect(locked.get("acc_b")).toEqual(accounts.acc_b);
  });

  it("leaves out an account that is not the user's", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };

    expect((await lockAccounts(tx, USER_ID, ["acc_x"])).size).toBe(0);
  });
});
```

- [ ] **Step 2: Write the failing service tests**

Create `core/transfers/service.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  transfer: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  account: { findFirst: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const balances = vi.hoisted(() => ({ readAccountBalances: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/balances/accountBalances", () => balances);

import {
  TransferAccountError,
  TransferFutureDateError,
  TransferGiveBackError,
  TransferInsufficientFundsError,
  TransferSameAccountError,
} from "./errors";
import {
  createTransfer,
  deleteTransfer,
  deleteTransfers,
  listTransfers,
  updateTransfer,
} from "./service";

const USER_ID = "user_123";
const TODAY = "2026-10-06";
const OLD = new Date("2026-09-01T00:00:00.000Z");

const ACCOUNTS: Record<
  string,
  { id: string; currency: string; archivedAt: Date | null }
> = {
  acc_a: { id: "acc_a", currency: "ARS", archivedAt: null },
  acc_b: { id: "acc_b", currency: "ARS", archivedAt: null },
  acc_c: { id: "acc_c", currency: "ARS", archivedAt: null },
  acc_usd: { id: "acc_usd", currency: "USD", archivedAt: null },
  acc_old: { id: "acc_old", currency: "ARS", archivedAt: OLD },
};

const INPUT = {
  currency: "ARS",
  fromAccountId: "acc_a",
  toAccountId: "acc_b",
  amount: 5000,
  date: TODAY,
  notes: null,
};

// What each account holds, whichever accounts and day the reader is asked about. An account that is
// not in the map has no balance row (it holds nothing).
const held = (byAccount: Record<string, number>) =>
  balances.readAccountBalances.mockImplementation(
    async (_tx: unknown, _userId: string, ids?: string[]) =>
      (ids ?? [])
        .filter((id) => id in byAccount)
        .map((id) => ({
          accountId: id,
          currency: "ARS",
          balance: byAccount[id],
        })),
  );

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  db.$queryRaw.mockImplementation(
    async (_strings: TemplateStringsArray, id: string) =>
      ACCOUNTS[id] ? [ACCOUNTS[id]] : [],
  );
  db.account.findFirst.mockResolvedValue({
    name: "Efectivo",
    bank: { name: "Efectivo" },
  });
  db.transfer.create.mockResolvedValue({});
  db.transfer.updateMany.mockResolvedValue({ count: 1 });
  db.transfer.deleteMany.mockResolvedValue({ count: 1 });
  held({ acc_a: 10000, acc_b: 10000, acc_c: 10000 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createTransfer", () => {
  it("locks both accounts, reads the source's funds as of the transfer date, then creates, in one transaction", async () => {
    const order: string[] = [];

    db.$queryRaw.mockImplementation(
      async (_strings: TemplateStringsArray, id: string) => {
        order.push(`lock ${id}`);

        return [ACCOUNTS[id]];
      },
    );
    balances.readAccountBalances.mockImplementation(async () => {
      order.push("funds");

      return [{ accountId: "acc_a", currency: "ARS", balance: 10000 }];
    });
    db.transfer.create.mockImplementation(async () => {
      order.push("create");

      return {};
    });

    await createTransfer(USER_ID, { ...INPUT, date: "2026-09-20" }, TODAY);

    expect(order).toEqual(["lock acc_a", "lock acc_b", "funds", "create"]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(balances.readAccountBalances).toHaveBeenCalledWith(
      db,
      USER_ID,
      ["acc_a"],
      { asOf: "2026-09-20", excludeTransferId: undefined },
    );
  });

  it("only asks about the source: the destination merely gains, so it is never checked", async () => {
    await createTransfer(USER_ID, INPUT, TODAY);

    expect(balances.readAccountBalances).toHaveBeenCalledTimes(1);
  });

  it("locks the lower id first even when the source has the higher one (A to B and B to A never deadlock)", async () => {
    held({ acc_b: 9000 });

    await createTransfer(
      USER_ID,
      { ...INPUT, fromAccountId: "acc_b", toAccountId: "acc_a" },
      TODAY,
    );

    expect(db.$queryRaw.mock.calls.map((call) => call[1])).toEqual([
      "acc_a",
      "acc_b",
    ]);
  });

  it("creates with an explicit field list: the owner comes from the session, never from the payload", async () => {
    await createTransfer(
      USER_ID,
      { ...INPUT, notes: "Alquiler", userId: "attacker", id: "x" } as never,
      TODAY,
    );

    expect(db.transfer.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        fromAccountId: "acc_a",
        toAccountId: "acc_b",
        amount: 5000n,
        date: new Date("2026-10-06T00:00:00.000Z"),
        notes: "Alquiler",
      },
    });
  });

  it("accepts exactly the funds the source holds", async () => {
    held({ acc_a: 5000 });

    await expect(
      createTransfer(USER_ID, INPUT, TODAY),
    ).resolves.toBeUndefined();
  });

  it.each([[4999], [0], [-300], [null]])(
    "refuses when the source held %s on that day, and creates nothing",
    async (balance) => {
      held(balance === null ? {} : { acc_a: balance });

      const error = await createTransfer(USER_ID, INPUT, TODAY).catch(
        (thrown) => thrown,
      );

      expect(error).toBeInstanceOf(TransferInsufficientFundsError);
      expect(error.available).toBe(balance ?? 0);
      expect(error.currency).toBe("ARS");
      expect(db.transfer.create).not.toHaveBeenCalled();
    },
  );

  it("asks for the balance of the transfer date, never of today (a backdated transfer on an account that was empty then)", async () => {
    held({ acc_a: 0 });

    await expect(
      createTransfer(USER_ID, { ...INPUT, date: "2026-03-01" }, TODAY),
    ).rejects.toBeInstanceOf(TransferInsufficientFundsError);
    expect(balances.readAccountBalances.mock.calls[0][3]).toEqual({
      asOf: "2026-03-01",
      excludeTransferId: undefined,
    });
  });

  it("refuses a future date before opening any transaction", async () => {
    await expect(
      createTransfer(USER_ID, { ...INPUT, date: "2026-10-07" }, TODAY),
    ).rejects.toBeInstanceOf(TransferFutureDateError);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("uses the Argentine calendar: at 22:00 in Buenos Aires, when UTC is already tomorrow, tomorrow is still the future", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T01:00:00.000Z"));

    await expect(
      createTransfer(USER_ID, { ...INPUT, date: "2026-10-07" }),
    ).rejects.toBeInstanceOf(TransferFutureDateError);
    await expect(
      createTransfer(USER_ID, { ...INPUT, date: "2026-10-06" }),
    ).resolves.toBeUndefined();
  });

  it("refuses the same account on both sides before locking anything", async () => {
    await expect(
      createTransfer(USER_ID, { ...INPUT, toAccountId: "acc_a" }, TODAY),
    ).rejects.toBeInstanceOf(TransferSameAccountError);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("treats an account that is not the user's as not found, on the side it is about", async () => {
    await expect(
      createTransfer(USER_ID, { ...INPUT, toAccountId: "acc_other" }, TODAY),
    ).rejects.toEqual(new TransferAccountError("to", "NOT_FOUND"));
    await expect(
      createTransfer(USER_ID, { ...INPUT, fromAccountId: "acc_other" }, TODAY),
    ).rejects.toEqual(new TransferAccountError("from", "NOT_FOUND"));
  });

  it("refuses an account in another currency than the transfer, on its side", async () => {
    await expect(
      createTransfer(USER_ID, { ...INPUT, toAccountId: "acc_usd" }, TODAY),
    ).rejects.toEqual(new TransferAccountError("to", "CURRENCY_MISMATCH"));
  });

  it("refuses an archived account on either side of a new transfer", async () => {
    await expect(
      createTransfer(USER_ID, { ...INPUT, toAccountId: "acc_old" }, TODAY),
    ).rejects.toEqual(new TransferAccountError("to", "ARCHIVED"));
    await expect(
      createTransfer(USER_ID, { ...INPUT, fromAccountId: "acc_old" }, TODAY),
    ).rejects.toEqual(new TransferAccountError("from", "ARCHIVED"));
    expect(db.transfer.create).not.toHaveBeenCalled();
  });
});

describe("updateTransfer", () => {
  // The transfer as stored: 50,00 from acc_a to acc_b on the first of the month.
  const CURRENT = {
    fromAccountId: "acc_a",
    toAccountId: "acc_b",
    amount: 5000n,
    date: new Date("2026-10-01T00:00:00.000Z"),
  };
  const SAME = { ...INPUT, date: "2026-10-01" };

  beforeEach(() => {
    db.transfer.findFirst.mockResolvedValue(CURRENT);
  });

  it("is false for a transfer that is not the user's, touching nothing else", async () => {
    db.transfer.findFirst.mockResolvedValue(null);

    await expect(updateTransfer(USER_ID, "tr_x", INPUT, TODAY)).resolves.toBe(
      false,
    );
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.transfer.updateMany).not.toHaveBeenCalled();
    expect(db.transfer.findFirst).toHaveBeenCalledWith({
      where: { id: "tr_x", userId: USER_ID },
      select: {
        fromAccountId: true,
        toAccountId: true,
        amount: true,
        date: true,
      },
    });
  });

  it("never reads a balance for an edit that changes nothing in the money (only the notes): it cannot fail for funds however much the accounts spent since", async () => {
    held({ acc_a: 0, acc_b: 0 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, notes: "Con nota" }, TODAY),
    ).resolves.toBe(true);
    expect(balances.readAccountBalances).not.toHaveBeenCalled();
  });

  it("leaves the edited transfer out of its own funds: an account that holds exactly that transfer's money can raise it by what it has", async () => {
    held({ acc_a: 7000 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, amount: 7000 }, TODAY),
    ).resolves.toBe(true);
    expect(balances.readAccountBalances).toHaveBeenCalledTimes(1);
    expect(balances.readAccountBalances).toHaveBeenCalledWith(
      db,
      USER_ID,
      ["acc_a"],
      { asOf: "2026-10-01", excludeTransferId: "tr_1" },
    );
  });

  it("checks the source again when the amount goes up beyond what it holds", async () => {
    held({ acc_a: 5500 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, amount: 6000 }, TODAY),
    ).rejects.toBeInstanceOf(TransferInsufficientFundsError);
    expect(db.transfer.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["another source", { fromAccountId: "acc_c", toAccountId: "acc_b" }],
    ["another day", { date: "2026-09-15" }],
  ])(
    "checks the new source, on the new date, for an edit with %s",
    async (_label, patch) => {
      held({ acc_a: 0, acc_c: 0 });

      await expect(
        updateTransfer(USER_ID, "tr_1", { ...SAME, ...patch }, TODAY),
      ).rejects.toBeInstanceOf(TransferInsufficientFundsError);
    },
  );

  it("refuses lowering the amount when the destination already spent the money it would give back", async () => {
    // 50,00 down to 40,00: acc_b must give back 10,00 and holds 8,00.
    held({ acc_b: 800 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, amount: 4000 }, TODAY),
    ).rejects.toMatchObject({
      name: "TransferGiveBackError",
      accountLabel: "Efectivo · Efectivo",
      available: 800,
      amount: 1000,
      currency: "ARS",
    });
    expect(balances.readAccountBalances).toHaveBeenCalledWith(db, USER_ID, [
      "acc_b",
    ]);
    expect(db.transfer.updateMany).not.toHaveBeenCalled();
  });

  it("allows lowering the amount when the destination can give back exactly the difference, and never checks the source for it", async () => {
    held({ acc_b: 1000 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, amount: 4000 }, TODAY),
    ).resolves.toBe(true);
    expect(balances.readAccountBalances).toHaveBeenCalledTimes(1);
  });

  it("refuses moving the transfer to another destination when the old destination already spent the money", async () => {
    held({ acc_b: 2000 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, toAccountId: "acc_c" }, TODAY),
    ).rejects.toBeInstanceOf(TransferGiveBackError);
    expect(db.account.findFirst).toHaveBeenCalledWith({
      where: { id: "acc_b", userId: USER_ID },
      select: { name: true, bank: { select: { name: true } } },
    });
    expect(db.transfer.updateMany).not.toHaveBeenCalled();
  });

  it("allows moving it to another destination when the old one still holds the whole amount", async () => {
    held({ acc_b: 5000 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, toAccountId: "acc_c" }, TODAY),
    ).resolves.toBe(true);
  });

  it("compares net changes per account: a destination that becomes the new source is checked once, as the source, without the transfer's old inflow", async () => {
    // acc_b was the destination (+50,00) and becomes the source of 30,00 on the same day.
    held({ acc_b: 7000 });

    await expect(
      updateTransfer(
        USER_ID,
        "tr_1",
        { ...SAME, fromAccountId: "acc_b", toAccountId: "acc_a", amount: 3000 },
        TODAY,
      ),
    ).resolves.toBe(true);
    expect(balances.readAccountBalances).toHaveBeenCalledTimes(1);
    expect(balances.readAccountBalances).toHaveBeenCalledWith(
      db,
      USER_ID,
      ["acc_b"],
      { asOf: "2026-10-01", excludeTransferId: "tr_1" },
    );
  });

  it("locks the accounts of the old and the new transfer together, in ascending id order", async () => {
    held({ acc_b: 9000, acc_c: 9000 });

    await updateTransfer(
      USER_ID,
      "tr_1",
      { ...SAME, fromAccountId: "acc_c", toAccountId: "acc_a" },
      TODAY,
    );

    expect(db.$queryRaw.mock.calls.map((call) => call[1])).toEqual([
      "acc_a",
      "acc_b",
      "acc_c",
    ]);
  });

  it("lets an edit keep an account that was archived since, on the side it was already", async () => {
    db.transfer.findFirst.mockResolvedValue({
      ...CURRENT,
      toAccountId: "acc_old",
    });

    await expect(
      updateTransfer(
        USER_ID,
        "tr_1",
        { ...SAME, toAccountId: "acc_old", notes: "x" },
        TODAY,
      ),
    ).resolves.toBe(true);
  });

  it("never moves a side to an archived account", async () => {
    await expect(
      updateTransfer(
        USER_ID,
        "tr_1",
        { ...SAME, toAccountId: "acc_old" },
        TODAY,
      ),
    ).rejects.toEqual(new TransferAccountError("to", "ARCHIVED"));
  });

  it("writes an explicit field list, scoped by the owner, and answers whether it changed anything", async () => {
    await updateTransfer(USER_ID, "tr_1", { ...SAME, notes: "Nota" }, TODAY);

    expect(db.transfer.updateMany).toHaveBeenCalledWith({
      where: { id: "tr_1", userId: USER_ID },
      data: {
        fromAccountId: "acc_a",
        toAccountId: "acc_b",
        amount: 5000n,
        date: new Date("2026-10-01T00:00:00.000Z"),
        notes: "Nota",
      },
    });

    db.transfer.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateTransfer(USER_ID, "tr_1", SAME, TODAY)).resolves.toBe(
      false,
    );
  });

  it("refuses a future date before opening any transaction", async () => {
    await expect(
      updateTransfer(USER_ID, "tr_1", { ...INPUT, date: "2026-10-07" }, TODAY),
    ).rejects.toBeInstanceOf(TransferFutureDateError);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("deleteTransfer and deleteTransfers", () => {
  const row = (
    id: string,
    fromAccountId: string,
    toAccountId: string,
    amount: number,
  ) => ({ id, fromAccountId, toAccountId, amount: BigInt(amount) });

  it("reads the user's transfers, locks both accounts in ascending id order, checks the destination and deletes, in one transaction", async () => {
    const order: string[] = [];

    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_b", "acc_a", 5000),
    ]);
    db.$queryRaw.mockImplementation(
      async (_strings: TemplateStringsArray, id: string) => {
        order.push(`lock ${id}`);

        return [ACCOUNTS[id]];
      },
    );
    balances.readAccountBalances.mockImplementation(async () => {
      order.push("funds");

      return [{ accountId: "acc_a", currency: "ARS", balance: 5000 }];
    });
    db.transfer.deleteMany.mockImplementation(async () => {
      order.push("delete");

      return { count: 1 };
    });

    await expect(deleteTransfer(USER_ID, "tr_1")).resolves.toBe(true);

    expect(order).toEqual(["lock acc_a", "lock acc_b", "funds", "delete"]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.transfer.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["tr_1"] }, userId: USER_ID },
      select: {
        id: true,
        fromAccountId: true,
        toAccountId: true,
        amount: true,
      },
    });
    expect(db.transfer.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["tr_1"] }, userId: USER_ID },
    });
  });

  it("refuses to delete a transfer whose destination already spent the money, naming the account and what it holds, and deletes nothing", async () => {
    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_a", "acc_b", 5000),
    ]);
    held({ acc_b: 3000 });

    await expect(deleteTransfer(USER_ID, "tr_1")).rejects.toMatchObject({
      name: "TransferGiveBackError",
      accountLabel: "Efectivo · Efectivo",
      available: 3000,
      amount: 5000,
      currency: "ARS",
    });
    expect(balances.readAccountBalances).toHaveBeenCalledWith(db, USER_ID, [
      "acc_b",
    ]);
    expect(db.transfer.deleteMany).not.toHaveBeenCalled();
  });

  it("allows deleting when the destination still holds exactly the amount", async () => {
    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_a", "acc_b", 5000),
    ]);
    held({ acc_b: 5000 });

    await expect(deleteTransfer(USER_ID, "tr_1")).resolves.toBe(true);
  });

  it("never checks the source of the transfer: it only gains", async () => {
    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_a", "acc_b", 5000),
    ]);
    held({ acc_a: -9999, acc_b: 9999 });

    await expect(deleteTransfer(USER_ID, "tr_1")).resolves.toBe(true);
    expect(balances.readAccountBalances.mock.calls[0][2]).toEqual(["acc_b"]);
  });

  it("is false for a transfer that is not the user's, locking and deleting nothing", async () => {
    db.transfer.findMany.mockResolvedValue([]);

    await expect(deleteTransfer(USER_ID, "tr_x")).resolves.toBe(false);
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.transfer.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes only the user's transfers among the ids and says how many went", async () => {
    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_a", "acc_b", 5000),
      row("tr_2", "acc_a", "acc_b", 100),
    ]);
    db.transfer.deleteMany.mockResolvedValue({ count: 2 });

    await expect(
      deleteTransfers(USER_ID, ["tr_1", "tr_2", "tr_foreign"]),
    ).resolves.toBe(2);
    expect(db.transfer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["tr_1", "tr_2", "tr_foreign"] }, userId: USER_ID },
      }),
    );
    expect(db.transfer.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["tr_1", "tr_2"] }, userId: USER_ID },
    });
  });

  it("checks a bulk delete by the net change of each account over the whole selection, whatever the order of the ids", async () => {
    // acc_a -> acc_b 50,00 and acc_b -> acc_c 20,00: acc_b gives back 50,00 and gets 20,00 back (net 30,00),
    // acc_c gives back 20,00, acc_a only gains.
    db.transfer.findMany.mockResolvedValue([
      row("tr_2", "acc_b", "acc_c", 2000),
      row("tr_1", "acc_a", "acc_b", 5000),
    ]);
    held({ acc_b: 3000, acc_c: 2000 });

    await expect(deleteTransfers(USER_ID, ["tr_2", "tr_1"])).resolves.toBe(1);
    expect(balances.readAccountBalances).toHaveBeenCalledWith(db, USER_ID, [
      "acc_b",
      "acc_c",
    ]);
  });

  it("refuses the whole bulk delete when one account cannot give back its net amount, deleting nothing", async () => {
    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_a", "acc_b", 5000),
      row("tr_2", "acc_b", "acc_c", 2000),
    ]);
    held({ acc_b: 3000, acc_c: 1999 });

    await expect(
      deleteTransfers(USER_ID, ["tr_1", "tr_2"]),
    ).rejects.toMatchObject({
      name: "TransferGiveBackError",
      available: 1999,
      amount: 2000,
    });
    expect(db.transfer.deleteMany).not.toHaveBeenCalled();
  });
});

describe("listTransfers", () => {
  const row = (patch: Record<string, unknown> = {}) => ({
    id: "tr_1",
    userId: USER_ID,
    fromAccountId: "acc_a",
    toAccountId: "acc_b",
    amount: 150050n,
    date: new Date("2026-10-03T00:00:00.000Z"),
    notes: "Alquiler",
    createdAt: OLD,
    updatedAt: OLD,
    fromAccount: {
      name: "Caja de ahorro",
      currency: "ARS",
      bank: { name: "Galicia" },
    },
    toAccount: { name: "Efectivo", bank: { name: "Efectivo" } },
    ...patch,
  });

  it("reads the user's transfers of the month, newest first, with the accounts labelled", async () => {
    db.transfer.findMany.mockResolvedValue([row()]);

    const transfers = await listTransfers(USER_ID, "2026-10");

    expect(db.transfer.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        date: {
          gte: new Date("2026-10-01T00:00:00.000Z"),
          lte: new Date("2026-10-31T00:00:00.000Z"),
        },
      },
      include: {
        fromAccount: {
          select: {
            name: true,
            currency: true,
            bank: { select: { name: true } },
          },
        },
        toAccount: { select: { name: true, bank: { select: { name: true } } } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 500,
    });
    expect(transfers).toEqual([
      {
        id: "tr_1",
        fromAccountId: "acc_a",
        toAccountId: "acc_b",
        fromLabel: "Galicia · Caja de ahorro",
        toLabel: "Efectivo · Efectivo",
        currency: "ARS",
        amount: 150050,
        date: "2026-10-03",
        notes: "Alquiler",
      },
    ]);
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run core/accounts/locks.test.ts core/transfers/service.test.ts`
Expected: FAIL (`inLockOrder`, `lockAccounts` and `./service` do not exist).

- [ ] **Step 4: Write the implementation**

Append to `core/accounts/locks.ts`:

```ts
// The one order in which several account rows are ever locked: ascending id, each once. Every writer
// that locks more than one account (a transfer, the opening balance save) uses it, so two of them can
// never wait for each other's rows.
export const inLockOrder = (ids: readonly string[]): string[] =>
  [...new Set(ids)].sort();

// Locks the user's accounts one after the other, in lock order, until the surrounding transaction ends.
// The map holds the ones that are the user's (an id that is not simply is not in it).
export const lockAccounts = async (
  tx: Locker,
  userId: string,
  accountIds: readonly string[],
): Promise<Map<string, LockedAccount>> => {
  const locked = new Map<string, LockedAccount>();

  for (const id of inLockOrder(accountIds)) {
    const account = await lockAccount(tx, userId, id);

    if (account) {
      locked.set(id, account);
    }
  }

  return locked;
};
```

Create `core/transfers/service.ts`:

```ts
import { accountLabel } from "@/core/accounts/label";
import { lockAccounts } from "@/core/accounts/locks";
import type { LockedAccount } from "@/core/accounts/locks";
import { readAccountBalances } from "@/core/balances/accountBalances";
import { dateToIsoDate, isoDateToDate, todayIso } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { monthRange } from "@/core/summary/month";
import { prisma } from "@/infrastructure/db/client";
import type {
  Prisma,
  Transfer as TransferRecord,
} from "@/lib/generated/prisma/client";

import { MAX_TRANSFERS_PER_MONTH } from "./consts";
import {
  TransferFutureDateError,
  TransferGiveBackError,
  TransferInsufficientFundsError,
  TransferSameAccountError,
} from "./errors";
import {
  assertTransferAccount,
  giveBacks,
  isFutureDate,
  needsFundsCheck,
  netDeltas,
} from "./rules";
import type { GiveBack } from "./rules";
import type { Transfer, TransferInput } from "./types";

// Every operation is scoped by userId, so one user can never read or change another user's transfers.
//
// The invariant of every write: it may never push an account it takes money from below zero. A
// transfer takes money from its source (create) and, when it is undone, from its destination (delete);
// an edit is the old transfer undone and the new one made, compared as a NET change per account (see
// netDeltas / giveBacks in rules.ts). An account that only gains is never checked. Negative balances
// can still arise from other writes (deleting an income, entering an expense): they are shown in red,
// never blocked.

type TransferWithAccounts = TransferRecord & {
  fromAccount: { name: string; currency: string; bank: { name: string } };
  toAccount: { name: string; bank: { name: string } };
};

// What a transfer needs besides its own columns: the label of both accounts and the currency of the
// source (both accounts have the same one), in the same query.
const WITH_ACCOUNTS = {
  fromAccount: {
    select: { name: true, currency: true, bank: { select: { name: true } } },
  },
  toAccount: { select: { name: true, bank: { select: { name: true } } } },
} as const;

const toTransfer = (row: TransferWithAccounts): Transfer => ({
  id: row.id,
  fromAccountId: row.fromAccountId,
  toAccountId: row.toAccountId,
  fromLabel: accountLabel(row.fromAccount.bank.name, row.fromAccount.name),
  toLabel: accountLabel(row.toAccount.bank.name, row.toAccount.name),
  currency: row.fromAccount.currency,
  amount: minorUnitsToNumber(row.amount),
  date: dateToIsoDate(row.date),
  notes: row.notes,
});

// Explicit field list: the owner and the id can never be overridden by the payload. The currency is
// not stored: it is the one of the accounts.
const toWritableData = (input: TransferInput) => ({
  fromAccountId: input.fromAccountId,
  toAccountId: input.toAccountId,
  amount: BigInt(input.amount),
  date: isoDateToDate(input.date),
  notes: input.notes,
});

// The user's transfers of one month ("YYYY-MM"), newest first.
export const listTransfers = async (
  userId: string,
  month: string,
): Promise<Transfer[]> => {
  const { from, to } = monthRange(month);
  const rows = await prisma.transfer.findMany({
    where: {
      userId,
      date: { gte: isoDateToDate(from), lte: isoDateToDate(to) },
    },
    include: WITH_ACCOUNTS,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: MAX_TRANSFERS_PER_MONTH,
  });

  return rows.map(toTransfer);
};

// Every account that has to give money back must hold that much NOW (the balance the Banks board shows,
// the transfer being undone included): the one that cannot makes the write fail, naming the account
// and what it holds. All accounts are read in one query, after the locks.
const assertGiveBacks = async (
  tx: Prisma.TransactionClient,
  userId: string,
  due: readonly GiveBack[],
  locked: ReadonlyMap<string, LockedAccount>,
): Promise<void> => {
  if (due.length === 0) {
    return;
  }

  const rows = await readAccountBalances(
    tx,
    userId,
    due.map(({ accountId }) => accountId),
  );
  const heldBy = new Map(
    rows.map(({ accountId, balance }) => [accountId, balance]),
  );

  for (const { accountId, amount } of due) {
    const available = heldBy.get(accountId) ?? 0;

    if (available < amount) {
      const account = await tx.account.findFirst({
        where: { id: accountId, userId },
        select: { name: true, bank: { select: { name: true } } },
      });

      throw new TransferGiveBackError(
        account ? accountLabel(account.bank.name, account.name) : accountId,
        available,
        amount,
        // Every account of a transfer of the user was locked (and so read) by the caller.
        (locked.get(accountId) as LockedAccount).currency,
      );
    }
  }
};

// The transfer an edit replaces, as far as money is concerned.
interface PreviousTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
}

// Everything that must hold for a create or an edit, inside the transaction that will write it: the
// accounts differ; the accounts of the new transfer AND of the old one (an edit) are locked in ascending
// id order, so A to B and B to A never wait for each other and archiving or changing the currency of
// any of them cannot interleave (they take the same row); the new accounts are the user's, in the
// currency of the transfer and active (an edit may keep an archived one on the side it already was);
// the new source held the amount on the transfer's date, without the effect of the transfer being
// replaced; and every other account that ends up with less than it has now (the old destination when
// the amount goes down or the destination changes) can still give that much back. The funds are read
// AFTER the locks: under READ COMMITTED every statement sees what the previous holder of the lock
// committed, so two transfers from the same source cannot spend the same money. (Incomes and expenses
// do not take the lock: one saved in the same instant can still land, and the balance then shows it, in
// red if negative.)
const settle = async (
  tx: Prisma.TransactionClient,
  userId: string,
  input: TransferInput,
  previous: PreviousTransfer | null,
): Promise<void> => {
  if (input.fromAccountId === input.toAccountId) {
    throw new TransferSameAccountError();
  }

  const locked = await lockAccounts(tx, userId, [
    input.fromAccountId,
    input.toAccountId,
    ...(previous ? [previous.fromAccountId, previous.toAccountId] : []),
  ]);

  assertTransferAccount(
    "from",
    locked.get(input.fromAccountId) ?? null,
    input.currency,
    previous?.fromAccountId ?? null,
  );
  assertTransferAccount(
    "to",
    locked.get(input.toAccountId) ?? null,
    input.currency,
    previous?.toAccountId ?? null,
  );

  if (needsFundsCheck(previous, input)) {
    const [source] = await readAccountBalances(
      tx,
      userId,
      [input.fromAccountId],
      { asOf: input.date, excludeTransferId: previous?.id },
    );
    const available = source?.balance ?? 0;

    if (available < input.amount) {
      throw new TransferInsufficientFundsError(available, input.currency);
    }
  }

  await assertGiveBacks(
    tx,
    userId,
    giveBacks(
      netDeltas(previous ? [previous] : [], [input]),
      input.fromAccountId,
    ),
    locked,
  );
};

const assertNotFuture = (date: string, today: string): void => {
  if (isFutureDate(date, today)) {
    throw new TransferFutureDateError();
  }
};

export const createTransfer = async (
  userId: string,
  input: TransferInput,
  today: string = todayIso(),
): Promise<void> => {
  assertNotFuture(input.date, today);

  await prisma.$transaction(async (tx) => {
    await settle(tx, userId, input, null);
    await tx.transfer.create({ data: { userId, ...toWritableData(input) } });
  });
};

// Returns false when no transfer with that id belongs to the user (nothing else is checked then). The
// transfer is read before its accounts are locked (their ids are needed to lock them), so an edit
// racing with another edit of the same transfer is last-writer-wins; the funds it checks are still
// read under the locks.
export const updateTransfer = async (
  userId: string,
  id: string,
  input: TransferInput,
  today: string = todayIso(),
): Promise<boolean> => {
  assertNotFuture(input.date, today);

  return prisma.$transaction(async (tx) => {
    const current = await tx.transfer.findFirst({
      where: { id, userId },
      select: {
        fromAccountId: true,
        toAccountId: true,
        amount: true,
        date: true,
      },
    });

    if (!current) {
      return false;
    }

    await settle(tx, userId, input, {
      id,
      fromAccountId: current.fromAccountId,
      toAccountId: current.toAccountId,
      amount: minorUnitsToNumber(current.amount),
      date: dateToIsoDate(current.date),
    });

    const { count } = await tx.transfer.updateMany({
      where: { id, userId },
      data: toWritableData(input),
    });

    return count > 0;
  });
};

// Deleting a transfer undoes the money: the source gets the amount back and the destination gives it
// back, so it is allowed only when the destination still holds it (a transfer made by mistake can be
// removed, one whose money was already spent cannot: the destination would go below zero). The source
// only gains, so it is never checked. Both accounts are locked in ascending id order and read after
// the locks, like a create. Several transfers are checked together by the net change of each account
// over the whole selection (so the answer does not depend on the order of the ids), all or nothing.
// Returns how many were deleted: an id that is gone, or is not the user's, simply does not count.
export const deleteTransfers = async (
  userId: string,
  ids: readonly string[],
): Promise<number> =>
  prisma.$transaction(async (tx) => {
    const rows = await tx.transfer.findMany({
      where: { id: { in: [...ids] }, userId },
      select: {
        id: true,
        fromAccountId: true,
        toAccountId: true,
        amount: true,
      },
    });

    if (rows.length === 0) {
      return 0;
    }

    const moves = rows.map(({ fromAccountId, toAccountId, amount }) => ({
      fromAccountId,
      toAccountId,
      amount: minorUnitsToNumber(amount),
    }));
    const locked = await lockAccounts(
      tx,
      userId,
      moves.flatMap(({ fromAccountId, toAccountId }) => [
        fromAccountId,
        toAccountId,
      ]),
    );

    await assertGiveBacks(tx, userId, giveBacks(netDeltas(moves, [])), locked);

    const { count } = await tx.transfer.deleteMany({
      where: { id: { in: rows.map(({ id }) => id) }, userId },
    });

    return count;
  });

// Returns false when no transfer with that id belongs to the user.
export const deleteTransfer = async (
  userId: string,
  id: string,
): Promise<boolean> => (await deleteTransfers(userId, [id])) > 0;
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run core/accounts/locks.test.ts core/transfers`
Expected: PASS.

- [ ] **Step 6: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check core/accounts/locks.ts core/accounts/locks.test.ts core/transfers`.
Expected: all green.

- [ ] **Step 7: Do NOT commit (the user commits only when asked); the snapshot is taken by the controller**

---

### Task 5: Server actions and revalidation

**Files:**

- Create: `core/transfers/actions.ts`
- Test: `core/transfers/actions.test.ts`
- Test: `core/transfers/actions.bulkDelete.test.ts`

**Interfaces:**

- Consumes: Task 4 service functions; Task 2 (`transferInputSchema`, consts including `giveBackMessage`, errors including `TransferGiveBackError`, types); `failure`, `fieldFailure`, `readForm`, `runAuthenticated` (`@/core/entries/actionHelpers`); `bulkIdsSchema`, `BULK_INVALID_MESSAGE` (`@/core/entries/bulk`); `formatMoney`.
- Produces ("use server", async functions only):
  - `createTransferAction(formData: FormData): Promise<TransferActionResult>`
  - `updateTransferAction(id: string, formData: FormData): Promise<TransferActionResult>`
  - `deleteTransferAction(id: string): Promise<TransferActionResult>`
  - `deleteTransfersAction(ids: string[]): Promise<TransfersDeleteResult>`
  - Errors map to field errors: `TransferAccountError` to `fromAccountId` / `toAccountId` by side, `TransferSameAccountError` to `toAccountId`, `TransferFutureDateError` to `date`, `TransferInsufficientFundsError` to `amount`; `TransferGiveBackError` (an account that would have to give back more than it holds) to `amount` on create/edit and to a plain message on delete (single and bulk), always naming the account and its balance; `TransferNotFoundError` and a missing id to a plain message.

- [ ] **Step 1: Write the failing action tests**

Create `core/transfers/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  createTransfer: vi.fn(),
  updateTransfer: vi.fn(),
  deleteTransfer: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createTransfer: mocks.createTransfer,
  updateTransfer: mocks.updateTransfer,
  deleteTransfer: mocks.deleteTransfer,
}));

import { formatMoney } from "@/core/incomes/money";

import {
  createTransferAction,
  deleteTransferAction,
  updateTransferAction,
} from "./actions";
import { giveBackMessage, insufficientFundsMessage } from "./consts";
import {
  TransferAccountError,
  TransferFutureDateError,
  TransferGiveBackError,
  TransferInsufficientFundsError,
  TransferSameAccountError,
} from "./errors";

const USER_ID = "user_123";

const formOf = (patch: Record<string, string> = {}): FormData => {
  const values: Record<string, string> = {
    currency: "ARS",
    fromAccountId: "acc_a",
    toAccountId: "acc_b",
    amount: "1500.50",
    date: "2026-10-06",
    notes: "Alquiler",
    ...patch,
  };
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => formData.set(key, value));

  return formData;
};

const STORED = {
  currency: "ARS",
  fromAccountId: "acc_a",
  toAccountId: "acc_b",
  amount: 150050,
  date: "2026-10-06",
  notes: "Alquiler",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("createTransferAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await createTransferAction(formOf())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await createTransferAction(
      formOf({ amount: "abc", toAccountId: "acc_a" }),
    );

    expect(result).toMatchObject({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        amount: [
          "Ingresa un monto válido, con dígitos y un punto para los decimales.",
        ],
        toAccountId: [
          "El origen y el destino tienen que ser cuentas distintas.",
        ],
      },
    });
    expect(mocks.createTransfer).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("creates the transfer for the authenticated user, with the amount in minor units, and refreshes the three pages", async () => {
    mocks.createTransfer.mockResolvedValue(undefined);

    expect(await createTransferAction(formOf())).toEqual({ status: "success" });
    expect(mocks.createTransfer).toHaveBeenCalledWith(USER_ID, STORED);
    expect(mocks.revalidatePath.mock.calls.map((call) => call[0])).toEqual([
      "/dashboard/transfers",
      "/dashboard/banks",
      "/dashboard/overview",
    ]);
  });

  it("ignores a userId in the form", async () => {
    const formData = formOf();

    formData.set("userId", "attacker");
    mocks.createTransfer.mockResolvedValue(undefined);

    await createTransferAction(formData);

    expect(mocks.createTransfer).toHaveBeenCalledWith(USER_ID, STORED);
  });

  it.each([
    [
      "an unusable source account",
      new TransferAccountError("from", "ARCHIVED"),
      "fromAccountId",
      "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
    ],
    [
      "a destination that is not the user's",
      new TransferAccountError("to", "NOT_FOUND"),
      "toAccountId",
      "Elegí una cuenta válida.",
    ],
    [
      "a destination in another currency",
      new TransferAccountError("to", "CURRENCY_MISMATCH"),
      "toAccountId",
      "Esta cuenta es de otra moneda. Elegí una cuenta en la moneda del movimiento.",
    ],
    [
      "the same account on both sides",
      new TransferSameAccountError(),
      "toAccountId",
      "El origen y el destino tienen que ser cuentas distintas.",
    ],
    [
      "a future date",
      new TransferFutureDateError(),
      "date",
      "La fecha no puede ser posterior a hoy.",
    ],
  ])(
    "turns %s into an error on its field",
    async (_label, error, field, message) => {
      mocks.createTransfer.mockRejectedValue(error);

      expect(await createTransferAction(formOf())).toEqual({
        status: "error",
        message: "Corrige los campos resaltados.",
        fieldErrors: { [field]: [message] },
      });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("says how much the source held when it has not enough, on the amount", async () => {
    mocks.createTransfer.mockRejectedValue(
      new TransferInsufficientFundsError(120000, "ARS"),
    );

    expect(await createTransferAction(formOf())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        amount: [insufficientFundsMessage(formatMoney(120000, "ARS"))],
      },
    });
  });

  it("logs an unexpected failure and answers a generic message", async () => {
    mocks.createTransfer.mockRejectedValue(new Error("db down"));

    expect(await createTransferAction(formOf())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("updateTransferAction", () => {
  it("updates the transfer of the user with the validated input", async () => {
    mocks.updateTransfer.mockResolvedValue(true);

    expect(await updateTransferAction("tr_1", formOf())).toEqual({
      status: "success",
    });
    expect(mocks.updateTransfer).toHaveBeenCalledWith(USER_ID, "tr_1", STORED);
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
  });

  it("says the transfer was not found when it is not the user's, and refreshes nothing", async () => {
    mocks.updateTransfer.mockResolvedValue(false);

    expect(await updateTransferAction("tr_x", formOf())).toEqual({
      status: "error",
      message: "No se encontró la transferencia.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await updateTransferAction("tr_1", formOf({ date: "nope" }));

    expect(result.status === "error" && result.fieldErrors).toEqual({
      date: ["Ingresa una fecha válida."],
    });
    expect(mocks.updateTransfer).not.toHaveBeenCalled();
  });

  it("shows a refusal to take money back from the old destination on the amount, naming the account and what it holds", async () => {
    mocks.updateTransfer.mockRejectedValue(
      new TransferGiveBackError("Efectivo · Efectivo", 800, 1000, "ARS"),
    );

    expect(await updateTransferAction("tr_1", formOf())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        amount: [
          giveBackMessage(
            "Efectivo · Efectivo",
            formatMoney(800, "ARS"),
            formatMoney(1000, "ARS"),
          ),
        ],
      },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("turns a domain error into the field it is about", async () => {
    mocks.updateTransfer.mockRejectedValue(
      new TransferInsufficientFundsError(0, "ARS"),
    );

    const result = await updateTransferAction("tr_1", formOf());

    expect(
      result.status === "error" && Object.keys(result.fieldErrors ?? {}),
    ).toEqual(["amount"]);
  });
});

describe("deleteTransferAction", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await deleteTransferAction("tr_1")).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.deleteTransfer).not.toHaveBeenCalled();
  });

  it("deletes through the service scoped to the user and refreshes the three pages", async () => {
    mocks.deleteTransfer.mockResolvedValue(true);

    expect(await deleteTransferAction("tr_1")).toEqual({ status: "success" });
    expect(mocks.deleteTransfer).toHaveBeenCalledWith(USER_ID, "tr_1");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
  });

  it("answers a plain message, naming the account and what it holds, when the destination already spent the money; it refreshes nothing and logs nothing", async () => {
    mocks.deleteTransfer.mockRejectedValue(
      new TransferGiveBackError("Efectivo · Efectivo", 300, 1500, "ARS"),
    );

    expect(await deleteTransferAction("tr_1")).toEqual({
      status: "error",
      message: giveBackMessage(
        "Efectivo · Efectivo",
        formatMoney(300, "ARS"),
        formatMoney(1500, "ARS"),
      ),
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("says not found for another user's id or for an id that is not text", async () => {
    mocks.deleteTransfer.mockResolvedValue(false);

    expect(await deleteTransferAction("tr_x")).toEqual({
      status: "error",
      message: "No se encontró la transferencia.",
    });
    expect(await deleteTransferAction("" as string)).toEqual({
      status: "error",
      message: "No se encontró la transferencia.",
    });
    expect(await deleteTransferAction(undefined as unknown as string)).toEqual({
      status: "error",
      message: "No se encontró la transferencia.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
```

Create `core/transfers/actions.bulkDelete.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  deleteTransfers: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({ deleteTransfers: mocks.deleteTransfers }));

import { MAX_BULK_DELETE } from "@/core/entries/bulk";
import { formatMoney } from "@/core/incomes/money";

import { deleteTransfersAction } from "./actions";
import { giveBackMessage } from "./consts";
import { TransferGiveBackError } from "./errors";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("deleteTransfersAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await deleteTransfersAction(["tr_1"])).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.deleteTransfers).not.toHaveBeenCalled();
  });

  it("deletes through the service scoped to the user, reports how many and refreshes the three pages", async () => {
    mocks.deleteTransfers.mockResolvedValue(2);

    expect(await deleteTransfersAction(["tr_1", "tr_2", "tr_foreign"])).toEqual(
      {
        status: "success",
        deleted: 2,
      },
    );
    expect(mocks.deleteTransfers).toHaveBeenCalledWith(USER_ID, [
      "tr_1",
      "tr_2",
      "tr_foreign",
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
  });

  it("deduplicates the ids it sends to the service", async () => {
    mocks.deleteTransfers.mockResolvedValue(1);

    await deleteTransfersAction(["tr_1", "tr_1"]);

    expect(mocks.deleteTransfers).toHaveBeenCalledWith(USER_ID, ["tr_1"]);
  });

  it("answers the refusal as a plain message, naming the account, when one cannot give its money back; nothing is refreshed and nothing is logged", async () => {
    mocks.deleteTransfers.mockRejectedValue(
      new TransferGiveBackError("Efectivo · Efectivo", 1999, 2000, "ARS"),
    );

    expect(await deleteTransfersAction(["tr_1", "tr_2"])).toEqual({
      status: "error",
      message: giveBackMessage(
        "Efectivo · Efectivo",
        formatMoney(1999, "ARS"),
        formatMoney(2000, "ARS"),
      ),
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("answers not found when none of the ids is the user's, and refreshes nothing", async () => {
    mocks.deleteTransfers.mockResolvedValue(0);

    expect(await deleteTransfersAction(["tr_x"])).toEqual({
      status: "error",
      message: "No se encontraron las transferencias seleccionadas.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["no ids", []],
    [
      "more ids than a person could select",
      Array.from({ length: MAX_BULK_DELETE + 1 }, (_, i) => `tr_${i}`),
    ],
    ["ids that are not text", [42, null]],
  ])("refuses %s without touching the service", async (_label, ids) => {
    const result = await deleteTransfersAction(ids as never);

    expect(result.status).toBe("error");
    expect(mocks.deleteTransfers).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run core/transfers/actions.test.ts core/transfers/actions.bulkDelete.test.ts`
Expected: FAIL (`./actions` does not exist).

- [ ] **Step 3: Write the implementation**

Create `core/transfers/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  failure,
  fieldFailure,
  readForm,
  runAuthenticated as runScoped,
} from "@/core/entries/actionHelpers";
import type { ActionFailure } from "@/core/entries/actionHelpers";
import { BULK_INVALID_MESSAGE, bulkIdsSchema } from "@/core/entries/bulk";
import { formatMoney } from "@/core/incomes/money";

import {
  ACCOUNT_PROBLEM_MESSAGES,
  FUTURE_DATE_MESSAGE,
  giveBackMessage,
  insufficientFundsMessage,
  SAME_ACCOUNT_MESSAGE,
  TRANSFER_FORM_FIELDS,
  TRANSFER_NOT_FOUND_MESSAGE,
  TRANSFER_REVALIDATE_PATHS,
  TRANSFERS_NOT_FOUND_MESSAGE,
} from "./consts";
import {
  TransferAccountError,
  TransferFutureDateError,
  TransferGiveBackError,
  TransferInsufficientFundsError,
  TransferNotFoundError,
  TransferSameAccountError,
} from "./errors";
import { transferInputSchema } from "./schema";
import {
  createTransfer,
  deleteTransfer,
  deleteTransfers,
  updateTransfer,
} from "./service";
import type {
  TransferActionResult,
  TransferFieldErrors,
  TransferInput,
  TransfersDeleteResult,
} from "./types";

// The owner always comes from the Clerk session; see runAuthenticated in the helpers.
const runAuthenticated = <Result extends { status: string }>(
  run: (userId: string) => Promise<Result>,
) => runScoped("transfers", run);

const SUCCESS: TransferActionResult = { status: "success" };

type ParsedForm = { data: TransferInput } | { error: ActionFailure };

const parseTransferForm = (formData: FormData): ParsedForm => {
  const result = transferInputSchema.safeParse(
    readForm(formData, TRANSFER_FORM_FIELDS),
  );

  if (result.success) {
    return { data: result.data };
  }

  return {
    error: fieldFailure(
      z.flattenError(result.error).fieldErrors as TransferFieldErrors,
    ),
  };
};

// The errors a transfer can run into that the user can act on, each on the field it is about.
// Anything else is unexpected and is left for runAuthenticated to log. `plain` is for the writes that
// have no form (a delete): the refusal then comes as a message, which is what its dialog shows.
const toKnownFailure = (
  error: unknown,
  plain = false,
): ActionFailure | undefined => {
  if (error instanceof TransferAccountError) {
    return fieldFailure({
      [error.side === "from" ? "fromAccountId" : "toAccountId"]: [
        ACCOUNT_PROBLEM_MESSAGES[error.problem],
      ],
    });
  }

  if (error instanceof TransferSameAccountError) {
    return fieldFailure({ toAccountId: [SAME_ACCOUNT_MESSAGE] });
  }

  if (error instanceof TransferFutureDateError) {
    return fieldFailure({ date: [FUTURE_DATE_MESSAGE] });
  }

  if (error instanceof TransferInsufficientFundsError) {
    return fieldFailure({
      amount: [
        insufficientFundsMessage(formatMoney(error.available, error.currency)),
      ],
    });
  }

  // An account would have to give back more than it holds (a delete, or an edit that takes money back
  // from the old destination): the message names the account and its balance.
  if (error instanceof TransferGiveBackError) {
    const message = giveBackMessage(
      error.accountLabel,
      formatMoney(error.available, error.currency),
      formatMoney(error.amount, error.currency),
    );

    return plain ? failure(message) : fieldFailure({ amount: [message] });
  }

  if (error instanceof TransferNotFoundError) {
    return failure(TRANSFER_NOT_FOUND_MESSAGE);
  }

  return undefined;
};

// Moving money changes the balances the Banks board and the summary show, so a write refreshes all of
// their pages, and only when it went through.
const revalidateAll = (): void => {
  TRANSFER_REVALIDATE_PATHS.forEach((path) => revalidatePath(path));
};

// Runs a write that answers whether it changed something, and turns the known failures into the result
// the form shows.
const write = async (
  run: () => Promise<boolean>,
  plain = false,
): Promise<TransferActionResult | ActionFailure> => {
  try {
    if (!(await run())) {
      return failure(TRANSFER_NOT_FOUND_MESSAGE);
    }
  } catch (error) {
    const known = toKnownFailure(error, plain);

    if (known) {
      return known;
    }

    throw error;
  }

  revalidateAll();

  return SUCCESS;
};

export async function createTransferAction(
  formData: FormData,
): Promise<TransferActionResult> {
  return runAuthenticated(async (userId) => {
    const parsed = parseTransferForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(async () => {
      await createTransfer(userId, parsed.data);

      return true;
    });
  });
}

export async function updateTransferAction(
  id: string,
  formData: FormData,
): Promise<TransferActionResult> {
  return runAuthenticated(async (userId) => {
    const parsed = parseTransferForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(() => updateTransfer(userId, id, parsed.data));
  });
}

export async function deleteTransferAction(
  id: string,
): Promise<TransferActionResult> {
  return runAuthenticated(async (userId) => {
    // An id that is not text cannot be a transfer of the user.
    if (typeof id !== "string" || id.length === 0) {
      return failure(TRANSFER_NOT_FOUND_MESSAGE);
    }

    return write(() => deleteTransfer(userId, id), true);
  });
}

// Deletes the selected transfers of the table in one go. Only the user's own are deleted; the result
// says how many were.
export async function deleteTransfersAction(
  ids: string[],
): Promise<TransfersDeleteResult> {
  return runAuthenticated<TransfersDeleteResult>(async (userId) => {
    const parsed = bulkIdsSchema.safeParse(ids);

    if (!parsed.success) {
      return failure(BULK_INVALID_MESSAGE);
    }

    let deleted: number;

    try {
      deleted = await deleteTransfers(userId, parsed.data);
    } catch (error) {
      const known = toKnownFailure(error, true);

      if (known) {
        return known;
      }

      throw error;
    }

    if (deleted === 0) {
      return failure(TRANSFERS_NOT_FOUND_MESSAGE);
    }

    revalidateAll();

    return { status: "success", deleted };
  });
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run core/transfers`
Expected: PASS.

- [ ] **Step 5: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check core/transfers`.
Expected: all green.

- [ ] **Step 6: Do NOT commit (the user commits only when asked); the snapshot is taken by the controller**

---

### Task 6: The create/edit drawer and the delete dialog (and `AccountField` for a transfer side)

**Read first:** `.heroui-docs/react/components/(overlays)/drawer.mdx`, `(overlays)/alert-dialog.mdx`, `(pickers)/select.mdx`, `(forms)/text-field.mdx`, `(forms)/form.mdx`, and the working components this task copies: `components/Incomes/components/IncomeFormDrawer/*` (drawer + `IncomeFormContent`), `components/Cards/components/DeleteCardDialog/*` (delete dialog), `components/Entries/components/AccountField/*`.

**Files:**

- Modify: `components/Entries/components/AccountField/AccountField.tsx`, `types.ts`, `utils.ts`
- Test: `components/Entries/components/AccountField/AccountField.test.tsx`, `components/Entries/components/AccountField/utils.test.ts` (create it if it does not exist)
- Create: `components/Transfers/types.ts`
- Create: `components/Transfers/components/TransferFormDrawer/{TransferFormDrawer.tsx, TransferFormContent.tsx, consts.ts, styles.ts, types.ts, index.ts}`
- Create: `components/Transfers/components/DeleteTransferDialog/{DeleteTransferDialog.tsx, DeleteTransferContent.tsx, consts.ts, styles.ts, types.ts, index.ts}`
- Test: `components/Transfers/components/TransferFormDrawer/TransferFormDrawer.test.tsx`
- Test: `components/Transfers/components/DeleteTransferDialog/DeleteTransferDialog.test.tsx`

**Interfaces:**

- Consumes: Task 5 actions (`createTransferAction`, `updateTransferAction`, `deleteTransferAction`); `AccountChoice` (`@/core/accounts/types`); `Transfer`, `TransferFieldErrors` (`@/core/transfers/types`); `DatePickerField`, `CURRENCY_OPTIONS`, `formConsts`, `Entries/styles` (existing); `PendingButton`, `InlineAlert`.
- Produces:
  - `AccountField` accepts four more optional props: `name?: string` (hidden input name, default `"accountId"`), `label?: string` (default `"Cuenta"`), `excludeAccountId?: string | null` (an account never offered, e.g. the other side of a transfer), `emptyHint?: string` (replaces "No tenés cuentas en {currency}."). `offeredAccounts(accounts, currency, keepAccountId?, excludeAccountId?)` and `resolveAccountId(accounts, currency, chosen, keepAccountId?, excludeAccountId?)` take the exclusion as a last optional argument. Every existing caller keeps working unchanged.
  - `components/Transfers/types.ts`: `TransferRow extends Transfer { amountLabel: string; amountDecimal: string; dateLabel: string }` and `FormTarget { key: number; transfer: TransferRow | null; defaultDate: string }`.
  - `TransferFormDrawer` props: `{ isOpen, onOpenChange, onClose, target: FormTarget, accounts: readonly AccountChoice[] }`.
  - `DeleteTransferDialog` props: `{ isOpen, onOpenChange, onClose, onDeleting: (ids: readonly string[]) => void, transfer: TransferRow | null }`.

- [ ] **Step 1: Write the failing `AccountField` tests**

Append to `components/Entries/components/AccountField/AccountField.test.tsx` (it already has `ACCOUNTS`, `renderField`, `open`, `submitted`):

```tsx
describe("AccountField as one side of a transfer", () => {
  it("takes its own label and submits under its own name", () => {
    renderField({
      label: "Cuenta de origen",
      name: "fromAccountId",
      value: "cash",
    });

    expect(
      screen.getByRole("button", { name: /Cuenta de origen/ }),
    ).toBeInTheDocument();
    expect(submitted().get("fromAccountId")).toBe("cash");
    expect(submitted().get("accountId")).toBeNull();
  });

  it("never offers the account excluded (the other side of the transfer)", async () => {
    renderField({ label: "Cuenta de destino", excludeAccountId: "galicia" });

    fireEvent.keyDown(
      screen.getByRole("button", { name: /Cuenta de destino/ }),
      { key: "ArrowDown" },
    );

    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "Efectivo · Efectivo",
    ]);
  });

  it("preselects the only account left once the excluded one is out", () => {
    renderField({ excludeAccountId: "galicia", label: "Cuenta de destino" });

    expect(submitted().get("accountId")).toBe("cash");
  });

  it("says its own line when nothing is left to offer, still linking to Bancos", () => {
    renderField({
      accounts: [ACCOUNTS[0]],
      excludeAccountId: "galicia",
      emptyHint: "Necesitás otra cuenta en ARS para recibir la transferencia.",
    });

    expect(
      screen.getByText(
        /Necesitás otra cuenta en ARS para recibir la transferencia\./,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Creá una en Bancos" }),
    ).toBeVisible();
    expect(screen.queryByText(/No tenés cuentas en ARS/)).toBeNull();
  });
});
```

Add to `components/Entries/components/AccountField/utils.test.ts` (create the file with the imports below if it does not exist; if it exists, append the `describe` and extend its imports):

```ts
import { describe, expect, it } from "vitest";

import { offeredAccounts, resolveAccountId } from "./utils";

const SIDE_ACCOUNTS = [
  { id: "a", currency: "ARS", label: "A", archived: false },
  { id: "b", currency: "ARS", label: "B", archived: false },
  { id: "old", currency: "ARS", label: "Old", archived: true },
];

describe("excluding an account", () => {
  it("offers every account but the excluded one", () => {
    expect(
      offeredAccounts(SIDE_ACCOUNTS, "ARS", null, "a").map((a) => a.id),
    ).toEqual(["b"]);
  });

  it("resolves to the only account left", () => {
    expect(resolveAccountId(SIDE_ACCOUNTS, "ARS", null, null, "a")).toBe("b");
  });

  it("drops a choice that is the excluded account", () => {
    expect(resolveAccountId(SIDE_ACCOUNTS, "ARS", "a", null, "a")).toBe("b");
  });

  it("keeps working without an exclusion, as before", () => {
    expect(resolveAccountId(SIDE_ACCOUNTS, "ARS", "b")).toBe("b");
    expect(resolveAccountId(SIDE_ACCOUNTS, "ARS", null)).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing drawer and dialog tests**

Create `components/Transfers/components/TransferFormDrawer/TransferFormDrawer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createTransferAction: vi.fn(),
  updateTransferAction: vi.fn(),
}));

vi.mock("@/core/transfers/actions", () => actions);

import type { AccountChoice } from "@/core/accounts/types";

import type { FormTarget, TransferRow } from "../../types";
import { TransferFormDrawer } from "./TransferFormDrawer";

const ACCOUNTS: AccountChoice[] = [
  {
    id: "galicia",
    currency: "ARS",
    label: "Galicia · Caja de ahorro",
    archived: false,
  },
  {
    id: "cash",
    currency: "ARS",
    label: "Efectivo · Efectivo",
    archived: false,
  },
  { id: "old", currency: "ARS", label: "Nación · Vieja", archived: true },
  {
    id: "dollars",
    currency: "USD",
    label: "Galicia · Dólares",
    archived: false,
  },
];

const ROW: TransferRow = {
  id: "tr_1",
  fromAccountId: "galicia",
  toAccountId: "old",
  fromLabel: "Galicia · Caja de ahorro",
  toLabel: "Nación · Vieja",
  currency: "ARS",
  amount: 150050,
  date: "2026-10-03",
  notes: "Alquiler",
  amountLabel: "$ 1.500,50",
  amountDecimal: "1500.50",
  dateLabel: "3 oct 2026",
};

const CREATE: FormTarget = {
  key: 1,
  transfer: null,
  defaultDate: "2026-10-06",
};
const EDIT: FormTarget = { key: 2, transfer: ROW, defaultDate: "2026-10-06" };

const renderForm = (
  target: FormTarget,
  accounts: readonly AccountChoice[] = ACCOUNTS,
) => {
  const onClose = vi.fn();

  render(
    <TransferFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
      accounts={accounts}
    />,
  );

  return { onClose };
};

const fromTrigger = () =>
  screen.getByRole("button", { name: /Cuenta de origen/ });
const toTrigger = () =>
  screen.getByRole("button", { name: /Cuenta de destino/ });
const currencyTrigger = () => screen.getByRole("button", { name: /Moneda/ });
const amountInput = () => screen.getByRole("textbox", { name: /Monto/ });
const submit = () =>
  screen.getByRole("button", { name: /Crear transferencia|Guardar cambios/ });

const pick = async (trigger: HTMLElement, name: string | RegExp) => {
  fireEvent.keyDown(trigger, { key: "ArrowDown" });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

const sent = (action: ReturnType<typeof vi.fn>, index = 0): FormData =>
  action.mock.calls[0][index] as FormData;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("is titled 'Crear transferencia' and says it counts as neither income nor expense", () => {
    renderForm(CREATE);

    expect(
      screen.getByRole("heading", { name: "Crear transferencia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no cuenta como ingreso ni como gasto/i),
    ).toBeVisible();
  });

  it("starts in pesos, with today's date and nothing chosen yet when there are two accounts", () => {
    renderForm(CREATE);

    expect(currencyTrigger()).toHaveTextContent("ARS");
    expect(fromTrigger()).toHaveTextContent("Elegí una cuenta");
    expect(toTrigger()).toHaveTextContent("Elegí una cuenta");
    expect(amountInput()).toHaveValue("");
  });

  it("never offers, as the destination, the account chosen as the source", async () => {
    renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    fireEvent.keyDown(toTrigger(), { key: "ArrowDown" });

    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "Efectivo · Efectivo",
    ]);
  });

  it("offers no archived account on a new transfer", async () => {
    renderForm(CREATE);

    fireEvent.keyDown(fromTrigger(), { key: "ArrowDown" });

    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "Galicia · Caja de ahorro",
      "Efectivo · Efectivo",
    ]);
  });

  it("drops both accounts when the currency changes", async () => {
    renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    await pick(currencyTrigger(), /USD/);

    expect(fromTrigger()).toHaveTextContent("Galicia · Dólares");
    expect(toTrigger()).toHaveTextContent("Elegí una cuenta");
  });

  it("says another account is needed when the currency has only one", async () => {
    renderForm(CREATE, [ACCOUNTS[0]]);

    expect(screen.getByText(/Necesitás otra cuenta en ARS/)).toBeVisible();
  });

  it("sends the currency, both accounts, the amount, the date and the notes, and closes on success", async () => {
    actions.createTransferAction.mockResolvedValue({ status: "success" });

    const { onClose } = renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    await pick(toTrigger(), "Efectivo · Efectivo");
    fireEvent.change(amountInput(), { target: { value: "1500.50" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Notas/ }), {
      target: { value: "Retiro" },
    });
    fireEvent.click(submit());

    await waitFor(() =>
      expect(actions.createTransferAction).toHaveBeenCalledTimes(1),
    );

    const form = sent(actions.createTransferAction);

    expect(form.get("currency")).toBe("ARS");
    expect(form.get("fromAccountId")).toBe("galicia");
    expect(form.get("toAccountId")).toBe("cash");
    expect(form.get("amount")).toBe("1500.50");
    expect(form.get("date")).toBe("2026-10-06");
    expect(form.get("notes")).toBe("Retiro");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the server's insufficient-funds message under the amount and stays open", async () => {
    actions.createTransferAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        amount: [
          "La cuenta de origen no tiene fondos suficientes: a esa fecha tenía $ 10,00.",
        ],
      },
    });

    const { onClose } = renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    await pick(toTrigger(), "Efectivo · Efectivo");
    fireEvent.change(amountInput(), { target: { value: "999" } });
    fireEvent.click(submit());

    expect(
      await screen.findByText(/no tiene fondos suficientes/),
    ).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows an account refusal under the field of its side", async () => {
    actions.createTransferAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        toAccountId: [
          "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
        ],
      },
    });

    renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    await pick(toTrigger(), "Efectivo · Efectivo");
    fireEvent.change(amountInput(), { target: { value: "5" } });
    fireEvent.click(submit());

    expect(await screen.findByText(/Esta cuenta está archivada/)).toBeVisible();
  });

  it("shows a general failure in an alert", async () => {
    actions.createTransferAction.mockResolvedValue({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });

    renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    await pick(toTrigger(), "Efectivo · Efectivo");
    fireEvent.change(amountInput(), { target: { value: "5" } });
    fireEvent.click(submit());

    expect(
      await screen.findByText("Algo salió mal. Inténtalo de nuevo."),
    ).toBeVisible();
  });

  it("locks the buttons and says it is working while the action is on its way", async () => {
    actions.createTransferAction.mockReturnValue(new Promise(() => {}));

    renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    await pick(toTrigger(), "Efectivo · Efectivo");
    fireEvent.change(amountInput(), { target: { value: "5" } });
    fireEvent.click(submit());

    expect(await screen.findByText("Creando transferencia…")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});

describe("edit mode", () => {
  it("is titled 'Editar transferencia' and starts from what the transfer has", () => {
    renderForm(EDIT);

    expect(
      screen.getByRole("heading", { name: "Editar transferencia" }),
    ).toBeInTheDocument();
    expect(currencyTrigger()).toHaveTextContent("ARS");
    expect(fromTrigger()).toHaveTextContent("Galicia · Caja de ahorro");
    expect(amountInput()).toHaveValue("1500.50");
    expect(screen.getByRole("textbox", { name: /Notas/ })).toHaveValue(
      "Alquiler",
    );
  });

  it("keeps an account that was archived since on its side, marked as such", () => {
    renderForm(EDIT);

    expect(toTrigger()).toHaveTextContent("Nación · Vieja (archivada)");
  });

  it("shows, under the amount, the refusal to take money back from the old destination, and stays open", async () => {
    const message =
      "No se puede deshacer: Nación · Vieja tiene $ 8,00 y tendría que devolver $ 10,00.";

    actions.updateTransferAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { amount: [message] },
    });

    const { onClose } = renderForm(EDIT);

    fireEvent.change(amountInput(), { target: { value: "1400.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("updates through the action with the id of the transfer", async () => {
    actions.updateTransferAction.mockResolvedValue({ status: "success" });

    const { onClose } = renderForm(EDIT);

    fireEvent.change(screen.getByRole("textbox", { name: /Notas/ }), {
      target: { value: "Otra nota" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(actions.updateTransferAction).toHaveBeenCalledTimes(1),
    );
    expect(actions.updateTransferAction.mock.calls[0][0]).toBe("tr_1");
    expect(sent(actions.updateTransferAction, 1).get("toAccountId")).toBe(
      "old",
    );
    expect(sent(actions.updateTransferAction, 1).get("notes")).toBe(
      "Otra nota",
    );
    expect(actions.createTransferAction).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
```

Create `components/Transfers/components/DeleteTransferDialog/DeleteTransferDialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ deleteTransferAction: vi.fn() }));

vi.mock("@/core/transfers/actions", () => actions);

import type { TransferRow } from "../../types";
import { DeleteTransferDialog } from "./DeleteTransferDialog";

const ROW: TransferRow = {
  id: "tr_1",
  fromAccountId: "galicia",
  toAccountId: "cash",
  fromLabel: "Galicia · Caja de ahorro",
  toLabel: "Efectivo · Efectivo",
  currency: "ARS",
  amount: 150050,
  date: "2026-10-03",
  notes: null,
  amountLabel: "$ 1.500,50",
  amountDecimal: "1500.50",
  dateLabel: "3 oct 2026",
};

const renderDialog = (transfer: TransferRow | null = ROW) => {
  const onClose = vi.fn();
  const onDeleting = vi.fn();

  render(
    <DeleteTransferDialog
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      onDeleting={onDeleting}
      transfer={transfer}
    />,
  );

  return { onClose, onDeleting };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DeleteTransferDialog", () => {
  it("asks about this transfer, names it and says the destination has to still hold the money", () => {
    renderDialog();

    expect(
      screen.getByRole("heading", { name: "¿Eliminar esta transferencia?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Galicia · Caja de ahorro a Efectivo · Efectivo \(\$ 1\.500,50\)/,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/tiene que seguir teniendo ese saldo disponible/),
    ).toBeVisible();
  });

  it("marks the row as going away before it waits, deletes it and closes", async () => {
    actions.deleteTransferAction.mockResolvedValue({ status: "success" });

    const { onClose, onDeleting } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() =>
      expect(actions.deleteTransferAction).toHaveBeenCalledWith("tr_1"),
    );
    expect(onDeleting).toHaveBeenCalledWith(["tr_1"]);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the failure and stays open", async () => {
    actions.deleteTransferAction.mockResolvedValue({
      status: "error",
      message: "No se encontró la transferencia.",
    });

    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(
      await screen.findByText("No se encontró la transferencia."),
    ).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the refusal when the destination already spent the money, naming the account and what it holds, and stays open", async () => {
    const message =
      "No se puede deshacer: Efectivo · Efectivo tiene $ 3,00 y tendría que devolver $ 1.500,50.";

    actions.deleteTransferAction.mockResolvedValue({
      status: "error",
      message,
    });

    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("does nothing without a transfer", () => {
    renderDialog(null);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(actions.deleteTransferAction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run components/Entries/components/AccountField components/Transfers`
Expected: FAIL (the new props are ignored; `components/Transfers` does not exist).

- [ ] **Step 4: Generalize `AccountField`**

`components/Entries/components/AccountField/utils.ts` — replace the two functions:

```ts
import type { AccountChoice } from "@/core/accounts/types";

// The accounts a movement in `currency` can go to: the active ones, plus the one the record already has
// (`keepAccountId`) even if it was archived since, minus the one that is excluded (the other side of a
// transfer). The order is the one given (the board's).
export const offeredAccounts = (
  accounts: readonly AccountChoice[],
  currency: string,
  keepAccountId: string | null = null,
  excludeAccountId: string | null = null,
): AccountChoice[] =>
  accounts.filter(
    (account) =>
      account.currency === currency &&
      account.id !== excludeAccountId &&
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
  excludeAccountId: string | null = null,
): string | null => {
  const offered = offeredAccounts(
    accounts,
    currency,
    keepAccountId,
    excludeAccountId,
  );

  if (chosen !== null && offered.some((account) => account.id === chosen)) {
    return chosen;
  }

  return offered.length === 1 ? offered[0].id : null;
};
```

`components/Entries/components/AccountField/types.ts` — add four optional props to `AccountFieldProps` (after `keepAccountId`):

```ts
  // An account that is never offered: the other side of a transfer.
  excludeAccountId?: string | null;
  // The name the chosen id is submitted under. "accountId" when omitted (every entry form).
  name?: string;
  // What the field is called. "Cuenta" when omitted.
  label?: string;
  // Replaces "No tenés cuentas en {currency}." under the field when nothing is left to offer.
  emptyHint?: string;
```

`components/Entries/components/AccountField/AccountField.tsx` — destructure the new props with defaults and use them:

```tsx
export function AccountField({
  accounts,
  currency,
  value,
  keepAccountId = null,
  excludeAccountId = null,
  name = ACCOUNT_FIELD_NAME,
  label = ACCOUNT_LABEL,
  emptyHint,
  onChange,
  errorMessage,
}: AccountFieldProps) {
  const options = offeredAccounts(
    accounts,
    currency,
    keepAccountId,
    excludeAccountId,
  );
  const resolved = resolveAccountId(
    accounts,
    currency,
    value,
    keepAccountId,
    excludeAccountId,
  );
```

and in the markup: `<Label>{label}</Label>`, the hint line `{emptyHint ?? noAccountsHint(currency)}{" "}`, and the hidden input `<input type="hidden" name={name} value={resolved ?? ""} />`. Nothing else in the file changes.

- [ ] **Step 5: Write the transfers types, the delete dialog and the drawer**

`components/Transfers/types.ts`:

```ts
import type { Transfer } from "@/core/transfers/types";

// A transfer plus the strings the UI needs, formatted on the server so the client never has to
// re-derive money or date presentation.
export interface TransferRow extends Transfer {
  // "$ 1.500,50", in the currency of the transfer.
  amountLabel: string;
  // The amount as plain text ("1500.50"), to prefill the form.
  amountDecimal: string;
  // "3 oct 2026".
  dateLabel: string;
}

// What the form drawer is currently showing. The key remounts the form so every opening starts from
// fresh defaults and cleared errors; the date is where a new transfer starts (today, Argentine time).
export interface FormTarget {
  key: number;
  transfer: TransferRow | null;
  defaultDate: string;
}
```

`components/Transfers/components/DeleteTransferDialog/consts.ts`:

```ts
export const DELETE_HEADING = "¿Eliminar esta transferencia?";
export const DELETE_WARNING =
  "Se eliminará de forma permanente y la plata vuelve a la cuenta de origen. Para poder eliminarla, la cuenta de destino tiene que seguir teniendo ese saldo disponible.";
export const CANCEL_LABEL = "Cancelar";
export const CONFIRM_LABEL = "Eliminar";
export const CONFIRM_PENDING_LABEL = "Eliminando…";

// "Galicia · Caja de ahorro a Efectivo · Efectivo ($ 1.500,50)".
export const transferSummary = (
  fromLabel: string,
  toLabel: string,
  amountLabel: string,
): string => `${fromLabel} a ${toLabel} (${amountLabel}).`;
```

`components/Transfers/components/DeleteTransferDialog/styles.ts`:

```ts
export const DIALOG_CLASS_NAME = "sm:max-w-[400px]";
```

`components/Transfers/components/DeleteTransferDialog/types.ts`:

```ts
import type { TransferRow } from "../../types";

export interface DeleteTransferDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  // Called with the id about to go, once the delete is confirmed and before it is awaited.
  onDeleting: (ids: readonly string[]) => void;
  transfer: TransferRow | null;
}

export type DeleteTransferContentProps = Pick<
  DeleteTransferDialogProps,
  "transfer" | "onClose" | "onDeleting"
>;
```

`components/Transfers/components/DeleteTransferDialog/index.ts`:

```ts
export { DeleteTransferDialog } from "./DeleteTransferDialog";
```

`components/Transfers/components/DeleteTransferDialog/DeleteTransferDialog.tsx`:

```tsx
import { AlertDialog } from "@heroui/react";

import { DeleteTransferContent } from "./DeleteTransferContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { DeleteTransferDialogProps } from "./types";

export function DeleteTransferDialog({
  isOpen,
  onOpenChange,
  onClose,
  onDeleting,
  transfer,
}: DeleteTransferDialogProps) {
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className={DIALOG_CLASS_NAME}>
          <DeleteTransferContent
            key={transfer?.id}
            transfer={transfer}
            onClose={onClose}
            onDeleting={onDeleting}
          />
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
```

`components/Transfers/components/DeleteTransferDialog/DeleteTransferContent.tsx`:

```tsx
import { AlertDialog, Button } from "@heroui/react";
import { useState, useTransition } from "react";

import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { deleteTransferAction } from "@/core/transfers/actions";

import {
  CANCEL_LABEL,
  CONFIRM_LABEL,
  CONFIRM_PENDING_LABEL,
  DELETE_HEADING,
  DELETE_WARNING,
  transferSummary,
} from "./consts";
import type { DeleteTransferContentProps } from "./types";

// Mounted with the transfer id as key, so a previous failure never leaks into another row.
export function DeleteTransferContent({
  transfer,
  onClose,
  onDeleting,
}: DeleteTransferContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!transfer) {
      return;
    }

    // Inside the transition, before the delete is awaited: the row reads as on its way out until the
    // refreshed rows arrive (or the delete fails and the transition ends).
    startTransition(async () => {
      onDeleting([transfer.id]);

      const result = await deleteTransferAction(transfer.id);

      if (result.status === "success") {
        onClose();

        return;
      }

      setError(result.message);
    });
  };

  return (
    <>
      <AlertDialog.CloseTrigger />
      <AlertDialog.Header>
        <AlertDialog.Icon status="danger" />
        <AlertDialog.Heading>{DELETE_HEADING}</AlertDialog.Heading>
      </AlertDialog.Header>
      <AlertDialog.Body>
        <p>
          {transfer
            ? `${transferSummary(transfer.fromLabel, transfer.toLabel, transfer.amountLabel)} `
            : null}
          {DELETE_WARNING}
        </p>
        {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      </AlertDialog.Body>
      <AlertDialog.Footer>
        <Button slot="close" variant="tertiary" isDisabled={isPending}>
          {CANCEL_LABEL}
        </Button>
        <PendingButton
          variant="danger"
          isPending={isPending}
          label={CONFIRM_LABEL}
          pendingLabel={CONFIRM_PENDING_LABEL}
          onPress={handleConfirm}
        />
      </AlertDialog.Footer>
    </>
  );
}
```

`components/Transfers/components/TransferFormDrawer/consts.ts`:

```ts
export const FORM_ID = "transfer-form";

export const CREATE_HEADING = "Crear transferencia";
export const EDIT_HEADING = "Editar transferencia";
export const CREATE_SUBMIT_LABEL = "Crear transferencia";
export const EDIT_SUBMIT_LABEL = "Guardar cambios";
// What the submit button says while the save is in flight.
export const CREATE_PENDING_LABEL = "Creando transferencia…";
export const EDIT_PENDING_LABEL = "Guardando…";

export const CREATE_DESCRIPTION =
  "Pasá plata de una cuenta a otra. No cuenta como ingreso ni como gasto.";
export const EDIT_DESCRIPTION = "Actualizá los datos de esta transferencia.";

export const FROM_LABEL = "Cuenta de origen";
export const TO_LABEL = "Cuenta de destino";
export const FROM_FIELD_NAME = "fromAccountId";
export const TO_FIELD_NAME = "toAccountId";

// Said under the destination when the currency has no other account to receive the money.
export const toEmptyHint = (currency: string): string =>
  `Necesitás otra cuenta en ${currency} para recibir la transferencia.`;
```

`components/Transfers/components/TransferFormDrawer/styles.ts`:

```ts
import {
  AMOUNT_ROW_CLASS_NAME,
  DRAWER_DESCRIPTION_CLASS_NAME,
  DRAWER_DIALOG_CLASS_NAME,
  FIELD_CLASS_NAME,
  FORM_CLASS_NAME,
} from "@/components/Entries/styles";

// The transfer form uses the drawers' shared look.
export const DIALOG_CLASS_NAME = DRAWER_DIALOG_CLASS_NAME;

export const DESCRIPTION_CLASS_NAME = DRAWER_DESCRIPTION_CLASS_NAME;

export { AMOUNT_ROW_CLASS_NAME, FIELD_CLASS_NAME, FORM_CLASS_NAME };
```

`components/Transfers/components/TransferFormDrawer/types.ts`:

```ts
import type { AccountChoice } from "@/core/accounts/types";

import type { FormTarget } from "../../types";

export interface TransferFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: FormTarget;
  // Every account of the user, for both account fields.
  accounts: readonly AccountChoice[];
}

export type TransferFormContentProps = Pick<
  TransferFormDrawerProps,
  "onClose" | "target" | "accounts"
>;
```

`components/Transfers/components/TransferFormDrawer/index.ts`:

```ts
export { TransferFormDrawer } from "./TransferFormDrawer";
```

`components/Transfers/components/TransferFormDrawer/TransferFormDrawer.tsx`:

```tsx
import { Drawer } from "@heroui/react";

import { TransferFormContent } from "./TransferFormContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { TransferFormDrawerProps } from "./types";

export function TransferFormDrawer({
  isOpen,
  onOpenChange,
  onClose,
  target,
  accounts,
}: TransferFormDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DIALOG_CLASS_NAME}>
          <TransferFormContent
            key={target.key}
            target={target}
            accounts={accounts}
            onClose={onClose}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
```

`components/Transfers/components/TransferFormDrawer/TransferFormContent.tsx`:

```tsx
import { PlusIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Description,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import {
  AccountField,
  resolveAccountId,
} from "@/components/Entries/components/AccountField";
import { DatePickerField } from "@/components/Entries/components/DatePickerField";
import { CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";
import {
  AMOUNT_HINT,
  AMOUNT_LABEL,
  AMOUNT_PLACEHOLDER,
  CANCEL_LABEL,
  CURRENCY_LABEL,
  CURRENCY_PLACEHOLDER,
  DATE_LABEL,
  NOTES_LABEL,
  NOTES_PLACEHOLDER,
} from "@/components/Entries/formConsts";
import {
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { DEFAULT_CURRENCY_CODE, NOTES_MAX_LENGTH } from "@/core/incomes/consts";
import {
  createTransferAction,
  updateTransferAction,
} from "@/core/transfers/actions";
import type { TransferFieldErrors } from "@/core/transfers/types";

import {
  CREATE_DESCRIPTION,
  CREATE_HEADING,
  CREATE_PENDING_LABEL,
  CREATE_SUBMIT_LABEL,
  EDIT_DESCRIPTION,
  EDIT_HEADING,
  EDIT_PENDING_LABEL,
  EDIT_SUBMIT_LABEL,
  FORM_ID,
  FROM_FIELD_NAME,
  FROM_LABEL,
  TO_FIELD_NAME,
  TO_LABEL,
  toEmptyHint,
} from "./consts";
import {
  AMOUNT_ROW_CLASS_NAME,
  DESCRIPTION_CLASS_NAME,
  FIELD_CLASS_NAME,
  FORM_CLASS_NAME,
} from "./styles";
import type { TransferFormContentProps } from "./types";

// Mounted with a fresh key on every opening, so field defaults and errors always reset.
export function TransferFormContent({
  target,
  accounts,
  onClose,
}: TransferFormContentProps) {
  const { transfer, defaultDate } = target;
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<TransferFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [currency, setCurrency] = useState(
    transfer?.currency ?? DEFAULT_CURRENCY_CODE,
  );
  // An edit keeps the accounts the transfer already has on their sides, even if archived since; a
  // currency change drops both choices.
  const keepFromId = transfer?.fromAccountId ?? null;
  const keepToId = transfer?.toAccountId ?? null;
  const [fromId, setFromId] = useState<string | null>(keepFromId);
  const [toId, setToId] = useState<string | null>(keepToId);
  const from = resolveAccountId(accounts, currency, fromId, keepFromId);
  // The destination never offers the source.
  const to = resolveAccountId(accounts, currency, toId, keepToId, from);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = transfer
        ? await updateTransferAction(transfer.id, formData)
        : await createTransferAction(formData);

      if (result.status === "success") {
        onClose();

        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors ? null : result.message);
    });
  };

  return (
    <>
      <Drawer.CloseTrigger />
      <Drawer.Header>
        <Drawer.Heading>
          {transfer ? EDIT_HEADING : CREATE_HEADING}
        </Drawer.Heading>
        <p className={DESCRIPTION_CLASS_NAME}>
          {transfer ? EDIT_DESCRIPTION : CREATE_DESCRIPTION}
        </p>
      </Drawer.Header>
      <Drawer.Body>
        <Form
          id={FORM_ID}
          className={FORM_CLASS_NAME}
          validationErrors={fieldErrors}
          onSubmit={handleSubmit}
        >
          <div className={AMOUNT_ROW_CLASS_NAME}>
            <TextField
              isRequired
              className={FIELD_CLASS_NAME}
              name="amount"
              inputMode="decimal"
              defaultValue={transfer?.amountDecimal ?? ""}
            >
              <Label>{AMOUNT_LABEL}</Label>
              <Input
                variant={FIELD_VARIANT}
                className={FIELD_HEIGHT_CLASS_NAME}
                placeholder={AMOUNT_PLACEHOLDER}
              />
              <Description>{AMOUNT_HINT}</Description>
              <FieldError />
            </TextField>

            <Select
              variant={FIELD_VARIANT}
              isRequired
              className={FIELD_CLASS_NAME}
              name="currency"
              placeholder={CURRENCY_PLACEHOLDER}
              value={currency}
              onChange={(value) => {
                if (typeof value === "string") {
                  setCurrency(value);
                  setFromId(null);
                  setToId(null);
                }
              }}
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
          </div>

          <AccountField
            accounts={accounts}
            currency={currency}
            value={from}
            keepAccountId={keepFromId}
            name={FROM_FIELD_NAME}
            label={FROM_LABEL}
            onChange={setFromId}
            errorMessage={fieldErrors.fromAccountId?.[0]}
          />

          <AccountField
            accounts={accounts}
            currency={currency}
            value={to}
            keepAccountId={keepToId}
            excludeAccountId={from}
            name={TO_FIELD_NAME}
            label={TO_LABEL}
            emptyHint={toEmptyHint(currency)}
            onChange={setToId}
            errorMessage={fieldErrors.toAccountId?.[0]}
          />

          <DatePickerField
            isRequired
            name="date"
            label={DATE_LABEL}
            defaultValue={transfer?.date ?? defaultDate}
          />

          <TextField
            className={FIELD_CLASS_NAME}
            name="notes"
            maxLength={NOTES_MAX_LENGTH}
            defaultValue={transfer?.notes ?? ""}
          >
            <Label>{NOTES_LABEL}</Label>
            <TextArea
              variant={FIELD_VARIANT}
              placeholder={NOTES_PLACEHOLDER}
              rows={3}
            />
            <FieldError />
          </TextField>

          {formError ? (
            <InlineAlert variant="error">{formError}</InlineAlert>
          ) : null}
        </Form>
      </Drawer.Body>
      <Drawer.Footer>
        <Button slot="close" variant="tertiary" isDisabled={isPending}>
          {CANCEL_LABEL}
        </Button>
        <PendingButton
          type="submit"
          form={FORM_ID}
          isPending={isPending}
          Icon={transfer ? undefined : PlusIcon}
          label={transfer ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL}
          pendingLabel={transfer ? EDIT_PENDING_LABEL : CREATE_PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run components/Entries/components/AccountField components/Transfers`
Expected: PASS. HeroUI renders selects and fields in its own way: if a selector in a test (an accessible name, how an option is chosen) does not match what renders, fix the SELECTOR to the way the existing tests (`AccountFormDrawer.test.tsx`, `AccountField.test.tsx`) query the same widgets; never relax what a test asserts about behaviour.

- [ ] **Step 7: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts components/shared/PendingButton/pendingButtonUsage.test.ts`, `npx prettier --check components/Transfers components/Entries/components/AccountField`.
Expected: all green (existing forms that use `AccountField` still pass unchanged).

- [ ] **Step 8: Do NOT commit (the user commits only when asked); the snapshot is taken by the controller**

---

### Task 7: The transfers table, the filters and the row mapping

**Read first:** `.heroui-docs/react/components/(data-display)/table.mdx`, `(forms)/search-field.mdx`, `(pickers)/select.mdx`; the working components this task copies: `components/Cards/components/CardsTable/*`, `components/Banks/components/BanksToolbar/*`, `components/Entries/components/EntriesFilters/*`.

**Files:**

- Modify: `components/Transfers/types.ts` (add `TransferFilters`, `TransfersTableData`)
- Create: `components/Transfers/consts.ts` (page copy, `NO_FILTERS`, `INITIAL_FORM_TARGET`, `BULK_DELETE_COPY`, `EMPTY_COPY`, `ACTION_ITEMS`)
- Create: `components/Transfers/utils.ts`
- Test: `components/Transfers/utils.test.ts`
- Create: `components/Transfers/components/TransfersTable/{TransfersTable.tsx, consts.ts, styles.ts, types.ts, index.ts}`
- Test: `components/Transfers/components/TransfersTable/TransfersTable.test.tsx`
- Create: `components/Transfers/components/TransfersFilters/{TransfersFilters.tsx, consts.ts, styles.ts, types.ts, utils.ts, index.ts}`
- Test: `components/Transfers/components/TransfersFilters/TransfersFilters.test.tsx`

**Interfaces:**

- Consumes: Task 6 (`TransferRow`, `FormTarget`); `Transfer` (`@/core/transfers/types`); `formatMoney`, `toDecimalString` (`@/core/incomes/money`); `formatIncomeDate` (`@/core/incomes/dates`); `normalizeSearch` (`@/core/banks/board`); `FilterSelect`, `FilterSelectSkeleton` (`@/components/Entries/components/EntriesFilters/components/...`); `buildCurrencyOptions(codes, active)` (`@/components/Entries/components/EntriesFilters/utils`); `DataTable`, `EntriesEmptyState`, `TruncatedText`, shared labels and `tableStyles`.
- Produces:
  - `TransferFilters { search: string; accountId: string | null; currency: string | null }`; `TransfersTableData { rows: TransferRow[] }`.
  - `NO_FILTERS: TransferFilters`; `INITIAL_FORM_TARGET: FormTarget`; `ADD_TRANSFER_ACTION = "add-transfer"`; `ACTION_ITEMS`; `BULK_DELETE_COPY`; `PAGE_TITLE`; `PAGE_DESCRIPTION`; `ACTIONS_LABEL`.
  - `toTransferRows(transfers: readonly Transfer[]): TransferRow[]`; `filterTransfers(rows: readonly TransferRow[], filters: TransferFilters): TransferRow[]`; `hasActiveFilters(filters: TransferFilters): boolean`; `transferTitle(row: TransferRow): string`.
  - `TransfersTable` props: `{ rows, isLoading?, isFiltered, onAdd, onClearFilters?, onEdit, onDelete, selectedIds?, onSelectionChange?, deletingIds? }`.
  - `TransfersFilters` props: `{ filters, accounts: Source<readonly AccountChoice[]>, canClear, onChange: (patch: Partial<TransferFilters>) => void, onClear }`.

- [ ] **Step 1: Write the failing utils test**

Create `components/Transfers/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { Transfer } from "@/core/transfers/types";

import { NO_FILTERS } from "./consts";
import type { TransferRow } from "./types";
import {
  filterTransfers,
  hasActiveFilters,
  toTransferRows,
  transferTitle,
} from "./utils";

const TRANSFER: Transfer = {
  id: "tr_1",
  fromAccountId: "acc_a",
  toAccountId: "acc_b",
  fromLabel: "Galicia · Caja de ahorro",
  toLabel: "Efectivo · Efectivo",
  currency: "ARS",
  amount: 150050,
  date: "2026-10-03",
  notes: "Alquiler",
};

const row = (patch: Partial<TransferRow> = {}): TransferRow => ({
  ...toTransferRows([TRANSFER])[0],
  ...patch,
});

describe("toTransferRows", () => {
  it("formats the money in the currency of the transfer and the date for reading, and keeps the rest", () => {
    expect(toTransferRows([TRANSFER])).toEqual([
      {
        ...TRANSFER,
        amountLabel: expect.stringMatching(/1\.500,50/),
        amountDecimal: "1500.50",
        dateLabel: expect.stringMatching(/3/),
      },
    ]);
  });

  it("formats each transfer in its own currency", () => {
    const [usd] = toTransferRows([
      { ...TRANSFER, currency: "USD", amount: 2500 },
    ]);

    expect(usd.amountLabel).toMatch(/25,00/);
    expect(usd.amountLabel).not.toBe(toTransferRows([TRANSFER])[0].amountLabel);
    expect(usd.amountDecimal).toBe("25.00");
  });
});

describe("transferTitle", () => {
  it("names the transfer by its two accounts, for the accessible name of its buttons", () => {
    expect(transferTitle(row())).toBe(
      "Transferencia de Galicia · Caja de ahorro a Efectivo · Efectivo",
    );
  });
});

describe("filterTransfers", () => {
  const rows = [
    row({
      id: "a",
      fromAccountId: "acc_a",
      toAccountId: "acc_b",
      currency: "ARS",
    }),
    row({
      id: "b",
      fromAccountId: "acc_c",
      toAccountId: "acc_d",
      fromLabel: "Nación · Dólares",
      toLabel: "Efectivo · Dólares",
      currency: "USD",
      notes: null,
    }),
  ];

  it("keeps every row without filters", () => {
    expect(filterTransfers(rows, NO_FILTERS)).toEqual(rows);
  });

  it("finds a row by either account, bank or note, ignoring case and accents", () => {
    expect(
      filterTransfers(rows, { ...NO_FILTERS, search: "NACION" }).map(
        (r) => r.id,
      ),
    ).toEqual(["b"]);
    expect(
      filterTransfers(rows, { ...NO_FILTERS, search: "caja de ahorro" }).map(
        (r) => r.id,
      ),
    ).toEqual(["a"]);
    expect(
      filterTransfers(rows, { ...NO_FILTERS, search: "alquiler" }).map(
        (r) => r.id,
      ),
    ).toEqual(["a"]);
    expect(
      filterTransfers(rows, { ...NO_FILTERS, search: "  efectivo " }).map(
        (r) => r.id,
      ),
    ).toEqual(["a", "b"]);
  });

  it("finds nothing for a text nothing has", () => {
    expect(filterTransfers(rows, { ...NO_FILTERS, search: "zzz" })).toEqual([]);
  });

  it("filters by an account on either side", () => {
    expect(
      filterTransfers(rows, { ...NO_FILTERS, accountId: "acc_b" }).map(
        (r) => r.id,
      ),
    ).toEqual(["a"]);
    expect(
      filterTransfers(rows, { ...NO_FILTERS, accountId: "acc_c" }).map(
        (r) => r.id,
      ),
    ).toEqual(["b"]);
  });

  it("filters by currency", () => {
    expect(
      filterTransfers(rows, { ...NO_FILTERS, currency: "USD" }).map(
        (r) => r.id,
      ),
    ).toEqual(["b"]);
  });

  it("combines the filters", () => {
    expect(
      filterTransfers(rows, {
        search: "efectivo",
        accountId: "acc_a",
        currency: "ARS",
      }).map((r) => r.id),
    ).toEqual(["a"]);
    expect(
      filterTransfers(rows, {
        search: "efectivo",
        accountId: "acc_a",
        currency: "USD",
      }),
    ).toEqual([]);
  });

  it("does not change the rows it is given", () => {
    const copy = [...rows];

    filterTransfers(rows, { ...NO_FILTERS, search: "nacion" });

    expect(rows).toEqual(copy);
  });
});

describe("hasActiveFilters", () => {
  it("is false at the defaults, including a search of only spaces", () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, search: "   " })).toBe(false);
  });

  it("is true when anything narrows the list", () => {
    expect(hasActiveFilters({ ...NO_FILTERS, search: "a" })).toBe(true);
    expect(hasActiveFilters({ ...NO_FILTERS, accountId: "acc_a" })).toBe(true);
    expect(hasActiveFilters({ ...NO_FILTERS, currency: "ARS" })).toBe(true);
  });
});
```

- [ ] **Step 2: Write the failing table and filters tests**

Create `components/Transfers/components/TransfersTable/TransfersTable.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TransferRow } from "../../types";
import { TransfersTable } from "./TransfersTable";

const ROWS: TransferRow[] = [
  {
    id: "tr_1",
    fromAccountId: "acc_a",
    toAccountId: "acc_b",
    fromLabel: "Galicia · Caja de ahorro",
    toLabel: "Efectivo · Efectivo",
    currency: "ARS",
    amount: 150050,
    date: "2026-10-03",
    notes: "Alquiler",
    amountLabel: "$ 1.500,50",
    amountDecimal: "1500.50",
    dateLabel: "3 oct 2026",
  },
  {
    id: "tr_2",
    fromAccountId: "acc_c",
    toAccountId: "acc_d",
    fromLabel: "Nación · Dólares",
    toLabel: "Efectivo · Dólares",
    currency: "USD",
    amount: 2500,
    date: "2026-10-01",
    notes: null,
    amountLabel: "US$ 25,00",
    amountDecimal: "25.00",
    dateLabel: "1 oct 2026",
  },
];

const renderTable = (
  patch: Partial<Parameters<typeof TransfersTable>[0]> = {},
) => {
  const handlers = {
    onAdd: vi.fn(),
    onClearFilters: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onSelectionChange: vi.fn(),
  };

  render(
    <TransfersTable rows={ROWS} isFiltered={false} {...handlers} {...patch} />,
  );

  return handlers;
};

describe("TransfersTable", () => {
  it("has the columns date, source, destination, amount, currency and notes, with an actions column", () => {
    renderTable();

    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent);

    expect(headers).toEqual(
      expect.arrayContaining([
        "Acciones",
        "Fecha",
        "Origen",
        "Destino",
        "Monto",
        "Moneda",
        "Notas",
      ]),
    );
  });

  it("shows each transfer as a row: date, both accounts as 'Banco · Cuenta', amount, currency and notes", () => {
    renderTable();

    const first = screen.getAllByRole("row")[1];

    expect(within(first).getByText("3 oct 2026")).toBeVisible();
    expect(within(first).getByText("Galicia · Caja de ahorro")).toBeVisible();
    expect(within(first).getByText("Efectivo · Efectivo")).toBeVisible();
    expect(within(first).getByText("$ 1.500,50")).toBeVisible();
    expect(within(first).getByText("ARS")).toBeVisible();
    expect(within(first).getByText("Alquiler")).toBeVisible();
  });

  it("says 'Sin notas' for a transfer without them", () => {
    renderTable();

    expect(screen.getByText("Sin notas")).toBeVisible();
  });

  it("edits and deletes through the buttons of each row, named after the transfer", () => {
    const { onEdit, onDelete } = renderTable();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Editar Transferencia de Galicia · Caja de ahorro a Efectivo · Efectivo",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Eliminar Transferencia de Nación · Dólares a Efectivo · Dólares",
      }),
    );

    expect(onEdit).toHaveBeenCalledWith(ROWS[0]);
    expect(onDelete).toHaveBeenCalledWith(ROWS[1]);
  });

  it("locks the buttons of a row that is being deleted", () => {
    renderTable({ deletingIds: new Set(["tr_1"]) });

    expect(
      screen.getByRole("button", {
        name: "Editar Transferencia de Galicia · Caja de ahorro a Efectivo · Efectivo",
      }),
    ).toBeDisabled();
  });

  it("has a checkbox per row and one for the whole page", () => {
    renderTable({ selectedIds: new Set(["tr_1"]) });

    expect(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("invites to create the first transfer when the month has none", () => {
    const { onAdd } = renderTable({ rows: [] });

    expect(screen.getByText("No hay transferencias en este mes")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Crear transferencia" }),
    );

    expect(onAdd).toHaveBeenCalled();
  });

  it("says nothing matches, and offers to clear the filters, when filters leave no row", () => {
    const { onClearFilters } = renderTable({ rows: [], isFiltered: true });

    expect(
      screen.getByText("Ninguna transferencia coincide con estos filtros"),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Limpiar filtros/ }));

    expect(onClearFilters).toHaveBeenCalled();
  });

  it("shows skeleton rows while loading, not the empty state", () => {
    renderTable({ rows: [], isLoading: true });

    expect(screen.queryByText("No hay transferencias en este mes")).toBeNull();
    expect(
      screen.getByLabelText("Cargando transferencias"),
    ).toBeInTheDocument();
  });
});
```

Create `components/Transfers/components/TransfersFilters/TransfersFilters.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AccountChoice } from "@/core/accounts/types";

import { NO_FILTERS } from "../../consts";
import { TransfersFilters } from "./TransfersFilters";

const ACCOUNTS: AccountChoice[] = [
  {
    id: "acc_a",
    currency: "ARS",
    label: "Galicia · Caja de ahorro",
    archived: false,
  },
  { id: "acc_old", currency: "ARS", label: "Nación · Vieja", archived: true },
  { id: "acc_c", currency: "USD", label: "Galicia · Dólares", archived: false },
];

const renderFilters = (
  patch: Partial<Parameters<typeof TransfersFilters>[0]> = {},
) => {
  const onChange = vi.fn();
  const onClear = vi.fn();

  render(
    <TransfersFilters
      filters={NO_FILTERS}
      accounts={ACCOUNTS}
      canClear={false}
      onChange={onChange}
      onClear={onClear}
      {...patch}
    />,
  );

  return { onChange, onClear };
};

describe("TransfersFilters", () => {
  it("is a group named for what it filters, with a search field", () => {
    renderFilters();

    expect(
      screen.getByRole("group", { name: "Filtrar transferencias" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Buscar transferencias" }),
    ).toBeInTheDocument();
  });

  it("reports what is typed in the search", () => {
    const { onChange } = renderFilters();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar transferencias" }),
      {
        target: { value: "alqui" },
      },
    );

    expect(onChange).toHaveBeenCalledWith({ search: "alqui" });
  });

  it("offers every account, archived ones included (a past transfer may use one), and the currencies the accounts have", async () => {
    renderFilters();

    fireEvent.keyDown(screen.getByRole("button", { name: /Cuenta/ }), {
      key: "ArrowDown",
    });

    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual([
      "Todas las cuentas",
      "Galicia · Caja de ahorro",
      "Nación · Vieja",
      "Galicia · Dólares",
    ]);
  });

  it("reports the account chosen", async () => {
    const { onChange } = renderFilters();

    fireEvent.keyDown(screen.getByRole("button", { name: /Cuenta/ }), {
      key: "ArrowDown",
    });

    const option = await screen.findByRole("option", {
      name: "Galicia · Dólares",
    });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith({ accountId: "acc_c" });
  });

  it("reports the currency chosen", async () => {
    const { onChange } = renderFilters();

    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
      key: "ArrowDown",
    });

    const option = await screen.findByRole("option", { name: "USD" });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith({ currency: "USD" });
  });

  it("offers 'Limpiar filtros' only when something is on", () => {
    const { onClear } = renderFilters({ canClear: true });

    fireEvent.click(screen.getByRole("button", { name: /Limpiar filtros/ }));

    expect(onClear).toHaveBeenCalled();
  });

  it("has no clear button at the defaults", () => {
    renderFilters();

    expect(
      screen.queryByRole("button", { name: /Limpiar filtros/ }),
    ).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run components/Transfers`
Expected: FAIL (the modules do not exist).

- [ ] **Step 4: Write the implementation**

Append to `components/Transfers/types.ts`:

```ts
// What narrows the month's list, applied on the client over the rows of the month.
export interface TransferFilters {
  search: string;
  accountId: string | null;
  currency: string | null;
}

// What the table needs: the month's rows.
export interface TransfersTableData {
  rows: TransferRow[];
}
```

`components/Transfers/consts.ts`:

```ts
import { PlusIcon } from "@heroicons/react/24/outline";
import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";

import type { BulkDeleteCopy } from "@/components/Entries/components/BulkDeleteDialog";
import type { EntriesEmptyStateCopy } from "@/components/Entries/components/EntriesEmptyState/types";
import type { ActionsMenuItem } from "@/components/Entries/components/PageHeader";

import type { FormTarget, TransferFilters } from "./types";

export const PAGE_TITLE = "Transferencias";
export const PAGE_DESCRIPTION =
  "Pasá plata entre tus cuentas. No cuenta como ingreso ni como gasto.";
export const ACTIONS_LABEL = "Acciones";
export const ADD_TRANSFER_LABEL = "Crear transferencia";
export const ADD_TRANSFER_ACTION = "add-transfer";

// What the Actions menu offers, in order.
export const ACTION_ITEMS: readonly ActionsMenuItem[] = [
  { id: ADD_TRANSFER_ACTION, label: ADD_TRANSFER_LABEL, Icon: PlusIcon },
];

export const NO_FILTERS: TransferFilters = {
  search: "",
  accountId: null,
  currency: null,
};

export const INITIAL_FORM_TARGET: FormTarget = {
  key: 0,
  transfer: null,
  defaultDate: "",
};

// What the dialog asks before deleting the selected transfers.
export const BULK_DELETE_COPY: BulkDeleteCopy = {
  heading: (count) =>
    count === 1
      ? "¿Eliminar 1 transferencia?"
      : `¿Eliminar ${count} transferencias?`,
};

export const EMPTY_COPY: EntriesEmptyStateCopy = {
  empty: {
    icon: ArrowsRightLeftIcon,
    title: "No hay transferencias en este mes",
    hint: "Pasá plata de una cuenta a otra y se va a reflejar en los saldos, sin contar como ingreso ni como gasto.",
    action: ADD_TRANSFER_LABEL,
  },
  filtered: {
    title: "Ninguna transferencia coincide con estos filtros",
    hint: "Probá cambiando la búsqueda, la cuenta o la moneda.",
  },
};
```

`components/Transfers/utils.ts`:

```ts
import { normalizeSearch } from "@/core/banks/board";
import { formatIncomeDate } from "@/core/incomes/dates";
import { formatMoney, toDecimalString } from "@/core/incomes/money";
import type { Transfer } from "@/core/transfers/types";

import type { TransferFilters, TransferRow } from "./types";

// Money and dates are formatted on the server so the client never re-derives presentation.
export const toTransferRows = (transfers: readonly Transfer[]): TransferRow[] =>
  transfers.map((transfer) => ({
    ...transfer,
    amountLabel: formatMoney(transfer.amount, transfer.currency),
    amountDecimal: toDecimalString(transfer.amount, transfer.currency),
    dateLabel: formatIncomeDate(transfer.date),
  }));

// The accessible name of the buttons of a row.
export const transferTitle = (row: TransferRow): string =>
  `Transferencia de ${row.fromLabel} a ${row.toLabel}`;

export const hasActiveFilters = ({
  search,
  accountId,
  currency,
}: TransferFilters): boolean =>
  normalizeSearch(search) !== "" || accountId !== null || currency !== null;

// The rows the table shows: the month's rows narrowed by the filters. The search looks at both
// accounts ("Banco · Cuenta") and the notes, ignoring case and accents; the account filter matches
// either side; the currency is the one of the transfer. The input is never changed.
export const filterTransfers = (
  rows: readonly TransferRow[],
  { search, accountId, currency }: TransferFilters,
): TransferRow[] => {
  const needle = normalizeSearch(search);

  return rows.filter((row) => {
    if (
      accountId !== null &&
      row.fromAccountId !== accountId &&
      row.toAccountId !== accountId
    ) {
      return false;
    }

    if (currency !== null && row.currency !== currency) {
      return false;
    }

    return (
      needle === "" ||
      [row.fromLabel, row.toLabel, row.notes ?? ""].some((text) =>
        normalizeSearch(text).includes(needle),
      )
    );
  });
};
```

`components/Transfers/components/TransfersTable/consts.ts`:

```ts
export const TABLE_LABEL = "Transferencias";
export const LOADING_LABEL = "Cargando transferencias";

export const ACTIONS_HEADER = "Acciones";
export const DATE_HEADER = "Fecha";
export const FROM_HEADER = "Origen";
export const TO_HEADER = "Destino";
export const AMOUNT_HEADER = "Monto";
export const CURRENCY_HEADER = "Moneda";
export const NOTES_HEADER = "Notas";
export const NO_NOTES = "Sin notas";
```

`components/Transfers/components/TransfersTable/styles.ts`:

```ts
// Takes every column's width from its own class, so the skeleton and the data line up; below the
// minimum the table scrolls sideways instead of squeezing the text.
export const FIXED_TABLE_CLASS_NAME = "table-fixed min-w-[56rem]";

// "Banco · Cuenta" is cut with an ellipsis instead of spilling into the next column.
export const ACCOUNT_COLUMN_CLASS_NAME = "w-56 overflow-hidden text-ellipsis";

export const CURRENCY_COLUMN_CLASS_NAME = "w-24";
```

`components/Transfers/components/TransfersTable/types.ts`:

```ts
import type { TransferRow } from "../../types";

export interface TransfersTableProps {
  rows: TransferRow[];
  // True while the rows are still on their way (first load or another month): skeleton rows instead.
  isLoading?: boolean;
  // True when filters are on, so an empty result reads "no matches" instead of "no transfers".
  isFiltered: boolean;
  onAdd: () => void;
  // Absent when the filters are already at their defaults: there is nothing to clear.
  onClearFilters?: () => void;
  onEdit: (transfer: TransferRow) => void;
  onDelete: (transfer: TransferRow) => void;
  // The ids of the selected rows. The checkbox column is there once `onSelectionChange` is.
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (ids: ReadonlySet<string>) => void;
  // The ids of the rows a delete is working on: dimmed, not selectable and with every control locked
  // until the refreshed rows arrive.
  deletingIds?: ReadonlySet<string>;
}
```

`components/Transfers/components/TransfersTable/index.ts`:

```ts
export { TransfersTable } from "./TransfersTable";
```

`components/Transfers/components/TransfersTable/TransfersTable.tsx`:

```tsx
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button, Skeleton } from "@heroui/react";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn } from "@/components/DataTable";
import { EntriesEmptyState } from "@/components/Entries/components/EntriesEmptyState";
import { TruncatedText } from "@/components/Entries/components/TruncatedText";
import {
  DELETING_LABEL,
  SELECT_ALL_LABEL,
  deleteLabel,
  editLabel,
  selectLabel,
} from "@/components/Entries/consts";
import {
  ACCOUNT_CLASS_NAME,
  ACTIONS_CLASS_NAME,
  ACTIONS_COLUMN_CLASS_NAME,
  ACTION_ICON_CLASS_NAME,
  AMOUNT_COLUMN_CLASS_NAME,
  CENTERED_CLASS_NAME,
  DATE_COLUMN_CLASS_NAME,
  END_ALIGNED_CLASS_NAME,
  NOTES_CLASS_NAME,
  TABLE_CLASS_NAME,
} from "@/components/Entries/tableStyles";

import { EMPTY_COPY } from "../../consts";
import type { TransferRow } from "../../types";
import { transferTitle } from "../../utils";
import {
  ACTIONS_HEADER,
  AMOUNT_HEADER,
  CURRENCY_HEADER,
  DATE_HEADER,
  FROM_HEADER,
  LOADING_LABEL,
  NO_NOTES,
  NOTES_HEADER,
  TABLE_LABEL,
  TO_HEADER,
} from "./consts";
import {
  ACCOUNT_COLUMN_CLASS_NAME,
  CURRENCY_COLUMN_CLASS_NAME,
  FIXED_TABLE_CLASS_NAME,
} from "./styles";
import type { TransfersTableProps } from "./types";

export function TransfersTable({
  rows,
  isLoading = false,
  isFiltered,
  onAdd,
  onClearFilters,
  onEdit,
  onDelete,
  selectedIds,
  onSelectionChange,
  deletingIds,
}: TransfersTableProps) {
  // A row being deleted can be neither edited nor deleted again nor ticked.
  const isDeleting = (row: TransferRow) => Boolean(deletingIds?.has(row.id));

  const columns: DataTableColumn<TransferRow>[] = [
    {
      key: "actions",
      header: ACTIONS_HEADER,
      className: ACTIONS_COLUMN_CLASS_NAME,
      headerClassName: CENTERED_CLASS_NAME,
      cell: (row) => (
        <div className={ACTIONS_CLASS_NAME}>
          <Button
            isIconOnly
            size="sm"
            variant="secondary"
            aria-label={editLabel(transferTitle(row))}
            isDisabled={isDeleting(row)}
            onPress={() => onEdit(row)}
          >
            <PencilSquareIcon
              className={ACTION_ICON_CLASS_NAME}
              aria-hidden="true"
            />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="danger-soft"
            aria-label={deleteLabel(transferTitle(row))}
            isDisabled={isDeleting(row)}
            onPress={() => onDelete(row)}
          >
            <TrashIcon className={ACTION_ICON_CLASS_NAME} aria-hidden="true" />
          </Button>
        </div>
      ),
      loadingCell: (
        <div className={ACTIONS_CLASS_NAME}>
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="size-10 rounded-lg" />
        </div>
      ),
    },
    {
      key: "date",
      header: DATE_HEADER,
      className: DATE_COLUMN_CLASS_NAME,
      isRowHeader: true,
      cell: (row) => row.dateLabel,
      loadingCell: <Skeleton className="h-4 w-3/4" />,
    },
    {
      key: "from",
      header: FROM_HEADER,
      className: ACCOUNT_COLUMN_CLASS_NAME,
      cell: (row) => (
        <TruncatedText className={ACCOUNT_CLASS_NAME}>
          {row.fromLabel}
        </TruncatedText>
      ),
      loadingCell: <Skeleton className="h-4 w-4/5" />,
    },
    {
      key: "to",
      header: TO_HEADER,
      className: ACCOUNT_COLUMN_CLASS_NAME,
      cell: (row) => (
        <TruncatedText className={ACCOUNT_CLASS_NAME}>
          {row.toLabel}
        </TruncatedText>
      ),
      loadingCell: <Skeleton className="h-4 w-4/5" />,
    },
    {
      key: "amount",
      header: AMOUNT_HEADER,
      className: AMOUNT_COLUMN_CLASS_NAME,
      headerClassName: END_ALIGNED_CLASS_NAME,
      cell: (row) => row.amountLabel,
      loadingCell: <Skeleton className="ml-auto h-4 w-3/4" />,
    },
    {
      key: "currency",
      header: CURRENCY_HEADER,
      className: CURRENCY_COLUMN_CLASS_NAME,
      cell: (row) => row.currency,
      loadingCell: <Skeleton className="h-4 w-1/2" />,
    },
    {
      key: "notes",
      header: NOTES_HEADER,
      cell: (row) =>
        row.notes ? (
          <TruncatedText className={NOTES_CLASS_NAME}>
            {row.notes}
          </TruncatedText>
        ) : (
          <span className={NOTES_CLASS_NAME}>{NO_NOTES}</span>
        ),
      loadingCell: <Skeleton className="h-4 w-2/3" />,
    },
  ];

  return (
    <DataTable
      label={TABLE_LABEL}
      className={TABLE_CLASS_NAME}
      tableClassName={FIXED_TABLE_CLASS_NAME}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      isLoading={isLoading}
      loadingLabel={LOADING_LABEL}
      selection={
        onSelectionChange
          ? {
              selectedKeys: selectedIds ?? new Set(),
              onSelectionChange,
              selectAllLabel: SELECT_ALL_LABEL,
              rowLabel: (row) => selectLabel(transferTitle(row)),
            }
          : undefined
      }
      isRowBusy={deletingIds ? isDeleting : undefined}
      busyLabel={DELETING_LABEL}
      emptyState={
        <EntriesEmptyState
          copy={EMPTY_COPY}
          variant={isFiltered ? "filtered" : "empty"}
          onAction={isFiltered ? onClearFilters : onAdd}
        />
      }
    />
  );
}
```

`components/Transfers/components/TransfersFilters/consts.ts`:

```ts
export const FILTERS_LABEL = "Filtrar transferencias";
export const SEARCH_LABEL = "Buscar transferencias";
export const SEARCH_PLACEHOLDER = "Buscá por cuenta, banco o nota";
export const ACCOUNT_LABEL = "Cuenta";
export const ALL_ACCOUNTS_LABEL = "Todas las cuentas";
export const CURRENCY_LABEL = "Moneda";
export const ALL_CURRENCIES_LABEL = "Todas las monedas";
export const CLEAR_LABEL = "Limpiar filtros";
```

`components/Transfers/components/TransfersFilters/styles.ts`:

```ts
export const ROOT_CLASS_NAME = "flex flex-wrap items-end gap-3";

export const SEARCH_CLASS_NAME = "w-full sm:w-72";

export const SELECT_FIELD_CLASS_NAME = "w-full sm:w-52";

export const CLEAR_ICON_CLASS_NAME = "size-4";
```

`components/Transfers/components/TransfersFilters/types.ts`:

```ts
import type { Source } from "@/components/shared/Await";
import type { AccountChoice } from "@/core/accounts/types";

import type { TransferFilters } from "../../types";

export interface TransfersFiltersProps {
  filters: TransferFilters;
  // Every account of the user, or a promise of them while they load: only the two selects wait for
  // them, the search works at once.
  accounts: Source<readonly AccountChoice[]>;
  // Whether anything narrows the list: the parent decides, the bar only shows the button.
  canClear: boolean;
  onChange: (patch: Partial<TransferFilters>) => void;
  onClear: () => void;
}
```

`components/Transfers/components/TransfersFilters/utils.ts`:

```ts
import type { FilterOption } from "@/components/Entries/components/EntriesFilters/types";
import type { AccountChoice } from "@/core/accounts/types";

// Every account, archived ones included: a past transfer may have used one.
export const accountOptions = (
  accounts: readonly AccountChoice[],
): FilterOption[] => accounts.map(({ id, label }) => ({ id, label }));

// The currencies the user's accounts hold, each once.
export const currencyCodes = (accounts: readonly AccountChoice[]): string[] => [
  ...new Set(accounts.map(({ currency }) => currency)),
];
```

`components/Transfers/components/TransfersFilters/index.ts`:

```ts
export { TransfersFilters } from "./TransfersFilters";
```

`components/Transfers/components/TransfersFilters/TransfersFilters.tsx`:

```tsx
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button, SearchField } from "@heroui/react";

import { FilterSelect } from "@/components/Entries/components/EntriesFilters/components/FilterSelect";
import { FilterSelectSkeleton } from "@/components/Entries/components/EntriesFilters/components/FilterSelectSkeleton";
import { buildCurrencyOptions } from "@/components/Entries/components/EntriesFilters/utils";
import {
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
} from "@/components/Entries/styles";
import { Await } from "@/components/shared/Await";

import {
  ACCOUNT_LABEL,
  ALL_ACCOUNTS_LABEL,
  ALL_CURRENCIES_LABEL,
  CLEAR_LABEL,
  CURRENCY_LABEL,
  FILTERS_LABEL,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
} from "./consts";
import {
  CLEAR_ICON_CLASS_NAME,
  ROOT_CLASS_NAME,
  SEARCH_CLASS_NAME,
  SELECT_FIELD_CLASS_NAME,
} from "./styles";
import type { TransfersFiltersProps } from "./types";
import { accountOptions, currencyCodes } from "./utils";

// What narrows the month's list: a search over the accounts and the notes, an account on either side
// and a currency. All of them are controlled by the page, which applies them to the rows.
export function TransfersFilters({
  filters,
  accounts,
  canClear,
  onChange,
  onClear,
}: TransfersFiltersProps) {
  return (
    <div className={ROOT_CLASS_NAME} role="group" aria-label={FILTERS_LABEL}>
      <SearchField
        aria-label={SEARCH_LABEL}
        variant={FIELD_VARIANT}
        className={SEARCH_CLASS_NAME}
        value={filters.search}
        onChange={(search) => onChange({ search })}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={SEARCH_PLACEHOLDER} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <Await
        source={accounts}
        fallback={
          <>
            <FilterSelectSkeleton
              label={ACCOUNT_LABEL}
              className={SELECT_FIELD_CLASS_NAME}
            />
            <FilterSelectSkeleton
              label={CURRENCY_LABEL}
              className={SELECT_FIELD_CLASS_NAME}
            />
          </>
        }
      >
        {(list) => (
          <>
            <FilterSelect
              label={ACCOUNT_LABEL}
              allLabel={ALL_ACCOUNTS_LABEL}
              options={accountOptions(list)}
              value={filters.accountId}
              className={SELECT_FIELD_CLASS_NAME}
              onChange={(accountId) => onChange({ accountId })}
            />
            <FilterSelect
              label={CURRENCY_LABEL}
              allLabel={ALL_CURRENCIES_LABEL}
              options={buildCurrencyOptions(
                currencyCodes(list),
                filters.currency,
              )}
              value={filters.currency}
              className={SELECT_FIELD_CLASS_NAME}
              onChange={(currency) => onChange({ currency })}
            />
          </>
        )}
      </Await>
      {canClear ? (
        <Button
          className={FIELD_HEIGHT_CLASS_NAME}
          variant="tertiary"
          onPress={onClear}
        >
          <XMarkIcon className={CLEAR_ICON_CLASS_NAME} aria-hidden="true" />
          {CLEAR_LABEL}
        </Button>
      ) : null}
    </div>
  );
}
```

Note: `FilterSelect`, `FilterSelectSkeleton` and `buildCurrencyOptions` live under `components/Entries/components/EntriesFilters/`; check that `FilterSelectSkeleton/index.ts` and `FilterSelect/index.ts` export them (they do: `components/Entries/components/EntriesFilters/components/FilterSelect/index.ts`), and import the types file path exactly as above.

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run components/Transfers`
Expected: PASS. Same note as Task 6 about selectors versus HeroUI's rendering: adapt a selector, never an assertion about behaviour.

- [ ] **Step 6: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check components/Transfers`.
Expected: all green.

- [ ] **Step 7: Do NOT commit (the user commits only when asked); the snapshot is taken by the controller**

---

### Task 8: The Transferencias page: loader, route, sidebar item, breadcrumb and the page component

**Read first:** `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` (and `03-api-reference/03-file-conventions/page.md` for `searchParams` in this version), `.heroui-docs/react/components/(overlays)/drawer.mdx`; the working pages this task copies: `app/dashboard/cards/*`, `app/dashboard/overview/page.tsx` (month parameter), `components/Cards/Cards.tsx`, `components/Summary/Summary.tsx`.

**Files:**

- Create: `core/transfers/pageData.ts`
- Test: `core/transfers/pageData.test.ts`
- Create: `app/dashboard/transfers/page.tsx`
- Create: `app/dashboard/transfers/loadTransfersView.ts`
- Test: `app/dashboard/transfers/loadTransfersView.test.ts`
- Modify: `components/Transfers/types.ts` (add `TransfersProps`)
- Create: `components/Transfers/Transfers.tsx`, `components/Transfers/index.ts`
- Test: `components/Transfers/Transfers.test.tsx`
- Modify: `components/Sidebar/consts.ts`, `components/Sidebar/consts.test.ts`
- Modify: `components/Navbar/components/NavbarBreadcrumbs/consts.ts`, `components/Navbar/components/NavbarBreadcrumbs/utils.test.ts`

**Interfaces:**

- Consumes: Task 4 `listTransfers`; `listAccountChoices` (`@/core/accounts/choices`, seeds the default cash account); Task 5 `deleteTransfersAction`; Task 6 `TransferFormDrawer`, `DeleteTransferDialog`; Task 7 table, filters and utils; `MonthSelector` (`@/components/Summary/components/MonthSelector`, takes `basePath`); `MONTH_PARAM` (`@/components/Summary/consts`); `parseMonthParam`, `monthOf`, `formatMonth`; `todayIso`; `requireUserId`.
- Produces:
  - `loadTransfersPageData(userId: string, month: string): Promise<{ transfers: Transfer[]; accounts: AccountChoice[] }>`
  - `loadTransfersView(userId: string, month: string): { table: Promise<TransfersTableData>; accounts: Promise<AccountChoice[]> }`
  - `Transfers` props (`TransfersProps`): `{ month: string; currentMonth: string; monthLabel: string; table: Source<TransfersTableData>; accounts: Source<readonly AccountChoice[]> }`
  - The route `/dashboard/transfers?month=YYYY-MM`.
  - Sidebar `NAV_ITEMS`: `Transferencias` at index 5 (right after `Bancos`, index 4); `Hoja de ruta` moves to index 6. Breadcrumb segment `transfers: "Transferencias"`.

- [ ] **Step 1: Write the failing data, loader and sidebar tests**

Create `core/transfers/pageData.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  listTransfers: vi.fn(),
  listAccountChoices: vi.fn(),
}));

vi.mock("./service", () => ({ listTransfers: deps.listTransfers }));
vi.mock("@/core/accounts/choices", () => ({
  listAccountChoices: deps.listAccountChoices,
}));

import { loadTransfersPageData } from "./pageData";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("loadTransfersPageData", () => {
  it("reads the month's transfers and every account of the user, together", async () => {
    const transfers = [{ id: "tr_1" }];
    const accounts = [{ id: "acc_a" }];

    deps.listTransfers.mockResolvedValue(transfers);
    deps.listAccountChoices.mockResolvedValue(accounts);

    await expect(loadTransfersPageData("user_1", "2026-10")).resolves.toEqual({
      transfers,
      accounts,
    });
    expect(deps.listTransfers).toHaveBeenCalledWith("user_1", "2026-10");
    expect(deps.listAccountChoices).toHaveBeenCalledWith("user_1");
  });

  it("starts both reads before waiting for either", async () => {
    const started: string[] = [];

    deps.listTransfers.mockImplementation(async () => {
      started.push("transfers");

      return [];
    });
    deps.listAccountChoices.mockImplementation(async () => {
      started.push("accounts");

      return [];
    });

    await loadTransfersPageData("user_1", "2026-10");

    expect(started.sort()).toEqual(["accounts", "transfers"]);
  });
});
```

Create `app/dashboard/transfers/loadTransfersView.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({ loadTransfersPageData: vi.fn() }));

vi.mock("@/core/transfers/pageData", () => deps);

import { loadTransfersView } from "./loadTransfersView";

const TRANSFER = {
  id: "tr_1",
  fromAccountId: "acc_a",
  toAccountId: "acc_b",
  fromLabel: "Galicia · Caja de ahorro",
  toLabel: "Efectivo · Efectivo",
  currency: "ARS",
  amount: 150050,
  date: "2026-10-03",
  notes: null,
};
const ACCOUNTS = [
  {
    id: "acc_a",
    currency: "ARS",
    label: "Galicia · Caja de ahorro",
    archived: false,
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  deps.loadTransfersPageData.mockResolvedValue({
    transfers: [TRANSFER],
    accounts: ACCOUNTS,
  });
});

describe("loadTransfersView", () => {
  it("returns promises and starts one load for the user and the month", () => {
    const view = loadTransfersView("user_1", "2026-10");

    expect(Object.keys(view).sort()).toEqual(["accounts", "table"]);
    expect(view.table).toBeInstanceOf(Promise);
    expect(view.accounts).toBeInstanceOf(Promise);
    expect(deps.loadTransfersPageData).toHaveBeenCalledTimes(1);
    expect(deps.loadTransfersPageData).toHaveBeenCalledWith(
      "user_1",
      "2026-10",
    );
  });

  it("gives the table the month's transfers as formatted rows", async () => {
    const { table } = loadTransfersView("user_1", "2026-10");
    const { rows } = await table;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "tr_1",
      amountDecimal: "1500.50",
      amountLabel: expect.stringMatching(/1\.500,50/),
    });
  });

  it("gives the accounts as they are", async () => {
    await expect(
      loadTransfersView("user_1", "2026-10").accounts,
    ).resolves.toEqual(ACCOUNTS);
  });
});
```

In `components/Sidebar/consts.test.ts` replace the two tests about the roadmap and add the new one:

```ts
it("puts Transferencias right after the banks, as a top-level item without children, with a two-arrows icon", () => {
  const transfers = NAV_ITEMS[5];

  expect(transfers.label).toBe("Transferencias");
  expect(transfers.href).toBe("/dashboard/transfers");
  expect(transfers.icon).toBe(ArrowsRightLeftIcon);
  expect(transfers.children).toBeUndefined();
});

it("puts the roadmap right after the transfers, with a columns icon", () => {
  expect(NAV_ITEMS[6].label).toBe("Hoja de ruta");
  expect(NAV_ITEMS[6].href).toBe("/dashboard/roadmap");
  expect(NAV_ITEMS[6].icon).toBe(ViewColumnsIcon);
});
```

(delete the old "puts the roadmap right after the banks" test, add `ArrowsRightLeftIcon` to the heroicons import, and fix any other index-based assertion in the file by running it.)

In `components/Navbar/components/NavbarBreadcrumbs/utils.test.ts` add next to the banks test:

```ts
it("names the transfers page Transferencias", () => {
  expect(buildCrumbs("/dashboard/transfers")).toEqual([
    { label: "Panel", href: "/dashboard" },
    { label: "Transferencias" },
  ]);
});
```

(copy the exact shape of the existing `Bancos` assertion in that file if its crumbs differ.)

- [ ] **Step 2: Write the failing page component test**

Create `components/Transfers/Transfers.test.tsx`:

```tsx
// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const actions = vi.hoisted(() => ({
  createTransferAction: vi.fn(),
  updateTransferAction: vi.fn(),
  deleteTransferAction: vi.fn(),
  deleteTransfersAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/core/transfers/actions", () => actions);

import type { AccountChoice } from "@/core/accounts/types";

import { Transfers } from "./Transfers";
import type { TransferRow, TransfersTableData } from "./types";

const ROW_A: TransferRow = {
  id: "tr_1",
  fromAccountId: "galicia",
  toAccountId: "cash",
  fromLabel: "Galicia · Caja de ahorro",
  toLabel: "Efectivo · Efectivo",
  currency: "ARS",
  amount: 150050,
  date: "2026-10-03",
  notes: "Alquiler",
  amountLabel: "$ 1.500,50",
  amountDecimal: "1500.50",
  dateLabel: "3 oct 2026",
};
const ROW_B: TransferRow = {
  id: "tr_2",
  fromAccountId: "dollars",
  toAccountId: "dollars2",
  fromLabel: "Galicia · Dólares",
  toLabel: "Nación · Dólares",
  currency: "USD",
  amount: 2500,
  date: "2026-10-01",
  notes: null,
  amountLabel: "US$ 25,00",
  amountDecimal: "25.00",
  dateLabel: "1 oct 2026",
};

const ACCOUNTS: AccountChoice[] = [
  {
    id: "galicia",
    currency: "ARS",
    label: "Galicia · Caja de ahorro",
    archived: false,
  },
  {
    id: "cash",
    currency: "ARS",
    label: "Efectivo · Efectivo",
    archived: false,
  },
  {
    id: "dollars",
    currency: "USD",
    label: "Galicia · Dólares",
    archived: false,
  },
  {
    id: "dollars2",
    currency: "USD",
    label: "Nación · Dólares",
    archived: false,
  },
];

const WITH_ROWS: TransfersTableData = { rows: [ROW_A, ROW_B] };
const EMPTY: TransfersTableData = { rows: [] };

const renderPage = (table: TransfersTableData = WITH_ROWS, month = "2026-10") =>
  render(
    <Transfers
      month={month}
      currentMonth="2026-10"
      monthLabel="Octubre de 2026"
      table={table}
      accounts={ACCOUNTS}
    />,
  );

const openMenu = () => {
  fireEvent.keyDown(screen.getByRole("button", { name: "Acciones" }), {
    key: "ArrowDown",
  });

  return screen.findByRole("menu");
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Transfers page", () => {
  it("shows the title, what the page is for and the month", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Transferencias" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No cuenta como ingreso ni como gasto/),
    ).toBeInTheDocument();
    expect(screen.getByText("Octubre de 2026")).toBeVisible();
  });

  it("offers only Crear transferencia in the Actions menu", async () => {
    renderPage();

    await openMenu();

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Crear transferencia"]);
  });

  it("moves between months through the address; the month in course has the bare address", () => {
    renderPage(WITH_ROWS, "2026-08");

    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Mes actual" }));

    expect(router.push.mock.calls.map((call) => call[0])).toEqual([
      "/dashboard/transfers?month=2026-07",
      "/dashboard/transfers?month=2026-09",
      "/dashboard/transfers",
    ]);
  });

  it("lists the month's transfers", () => {
    renderPage();

    expect(screen.getByText("Galicia · Caja de ahorro")).toBeVisible();
    expect(screen.getByText("US$ 25,00")).toBeVisible();
  });

  it("filters by search without leaving the page, and says so when nothing matches", () => {
    renderPage();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar transferencias" }),
      {
        target: { value: "alquiler" },
      },
    );

    expect(screen.getByText("Galicia · Caja de ahorro")).toBeVisible();
    expect(screen.queryByText("US$ 25,00")).toBeNull();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar transferencias" }),
      {
        target: { value: "zzz" },
      },
    );

    expect(
      screen.getByText("Ninguna transferencia coincide con estos filtros"),
    ).toBeVisible();

    fireEvent.click(
      screen.getAllByRole("button", { name: /Limpiar filtros/ })[0],
    );

    expect(screen.getByText("US$ 25,00")).toBeVisible();
  });

  it("shows the empty invitation when the month has no transfer", () => {
    renderPage(EMPTY);

    expect(screen.getByText("No hay transferencias en este mes")).toBeVisible();
  });

  it("opens the create drawer from the button of the empty state", async () => {
    renderPage(EMPTY);

    fireEvent.click(
      screen.getByRole("button", { name: "Crear transferencia" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Crear transferencia" }),
    ).toBeInTheDocument();
  });

  it("opens the edit drawer prefilled from the pencil of a row", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Editar Transferencia de Galicia · Caja de ahorro a Efectivo · Efectivo",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Editar transferencia" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Monto/ })).toHaveValue(
      "1500.50",
    );
  });

  it("opens the delete dialog from the trash of a row and deletes that transfer", async () => {
    actions.deleteTransferAction.mockResolvedValue({ status: "success" });
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Eliminar Transferencia de Galicia · Dólares a Nación · Dólares",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "¿Eliminar esta transferencia?",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Eliminar",
      }),
    );

    await waitFor(() =>
      expect(actions.deleteTransferAction).toHaveBeenCalledWith("tr_2"),
    );
  });

  it("deletes the selected transfers in one go", async () => {
    actions.deleteTransfersAction.mockResolvedValue({
      status: "success",
      deleted: 2,
    });
    renderPage();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    );

    expect(screen.getByText("2 seleccionadas")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar selección" }));

    expect(
      await screen.findByRole("heading", {
        name: "¿Eliminar 2 transferencias?",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /Eliminar/,
      }),
    );

    await waitFor(() =>
      expect(actions.deleteTransfersAction).toHaveBeenCalledWith([
        "tr_1",
        "tr_2",
      ]),
    );
  });

  it("shows the refusal inside the bulk dialog when an account cannot give its money back, and keeps the selection", async () => {
    const message =
      "No se puede deshacer: Nación · Dólares tiene US$ 1,00 y tendría que devolver US$ 25,00.";

    actions.deleteTransfersAction.mockResolvedValue({
      status: "error",
      message,
    });
    renderPage();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar selección" }));

    await screen.findByRole("heading", { name: "¿Eliminar 2 transferencias?" });
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /Eliminar/,
      }),
    );

    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByText("2 seleccionadas")).toBeInTheDocument();
  });

  it("only counts the selected rows that the filters still show", () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    );
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar transferencias" }),
      {
        target: { value: "alquiler" },
      },
    );

    expect(screen.getByText("1 seleccionada")).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run core/transfers/pageData.test.ts app/dashboard/transfers components/Transfers/Transfers.test.tsx components/Sidebar components/Navbar`
Expected: FAIL (modules missing; the sidebar and breadcrumb assertions fail).

- [ ] **Step 4: Write the implementation**

`core/transfers/pageData.ts`:

```ts
import { listAccountChoices } from "@/core/accounts/choices";

import { listTransfers } from "./service";

// Everything the transfers page needs: the month's transfers and every account of the user (for the
// form and the filters; the first visit seeds the default cash account, so a user never lands without
// one). The two reads are independent, so they run together.
export const loadTransfersPageData = async (userId: string, month: string) => {
  const [transfers, accounts] = await Promise.all([
    listTransfers(userId, month),
    listAccountChoices(userId),
  ]);

  return { transfers, accounts };
};
```

`app/dashboard/transfers/loadTransfersView.ts`:

```ts
import { toTransferRows } from "@/components/Transfers/utils";
import { loadTransfersPageData } from "@/core/transfers/pageData";

// Starts loading everything the page needs and returns immediately, without awaiting it: one promise
// per section, both derived from the same single load. The page hands them straight to the client
// component, so the page's structure renders at once and the table and the account selects wait for
// just their own piece.
//
// The promises are created here, once per request, so their identity is stable: a client component
// that waits on one gets the same promise on every render.
export const loadTransfersView = (userId: string, month: string) => {
  const data = loadTransfersPageData(userId, month);

  return {
    table: data.then(({ transfers }) => ({ rows: toTransferRows(transfers) })),
    accounts: data.then(({ accounts }) => accounts),
  };
};
```

`app/dashboard/transfers/page.tsx`:

```tsx
import { Transfers } from "@/components/Transfers";
import { MONTH_PARAM } from "@/components/Summary/consts";
import { todayIso } from "@/core/incomes/dates";
import { formatMonth, monthOf, parseMonthParam } from "@/core/summary/month";
import { requireUserId } from "@/lib/auth/requireUserId";

import { loadTransfersView } from "./loadTransfersView";

export default async function TransfersPage({
  searchParams,
}: PageProps<"/dashboard/transfers">) {
  const userId = await requireUserId();

  // The month in course, by the Argentine calendar: what the page shows when the address asks for no
  // month, and what an address with a bad month falls back to.
  const currentMonth = monthOf(todayIso());
  const month = parseMonthParam(
    (await searchParams)[MONTH_PARAM],
    currentMonth,
  );

  // Not awaited on purpose: the database work starts here and streams in behind the page, so its
  // structure is on screen at once and only the table waits for its data.
  const view = loadTransfersView(userId, month);

  return (
    <Transfers
      month={month}
      currentMonth={currentMonth}
      monthLabel={formatMonth(month)}
      {...view}
    />
  );
}
```

If `npx tsc --noEmit` reports that `PageProps<"/dashboard/transfers">` does not exist, the typed-route declarations have not been regenerated: run `npx next typegen` (it only writes `.next/types`, no database, no dev server involved) and run tsc again.

Append to `components/Transfers/types.ts`:

```ts
import type { Source } from "@/components/shared/Await";
import type { AccountChoice } from "@/core/accounts/types";

// Every piece of data is a `Source`: the value itself, or a promise of it while it loads. The page
// renders its structure at once and each section waits only for its own piece.
export interface TransfersProps {
  // The month the list belongs to, "YYYY-MM", and the month in course (where "Mes actual" goes).
  month: string;
  currentMonth: string;
  // The month written out ("Octubre de 2026").
  monthLabel: string;
  table: Source<TransfersTableData>;
  // Every account of the user, for the form and the filters.
  accounts: Source<readonly AccountChoice[]>;
}
```

(put the two new `import type` lines at the top of the file with the existing import, keeping imports first.)

`components/Transfers/index.ts`:

```ts
export { Transfers } from "./Transfers";
```

`components/Transfers/Transfers.tsx`:

```tsx
"use client";

import { useOverlayState } from "@heroui/react";
import { useState } from "react";

import { BulkDeleteDialog } from "@/components/Entries/components/BulkDeleteDialog";
import { PageHeader } from "@/components/Entries/components/PageHeader";
import { SelectionBar } from "@/components/Entries/components/SelectionBar";
import { ROOT_CLASS_NAME } from "@/components/Entries/styles";
import { useDeletingRows } from "@/components/Entries/useDeletingRows";
import { useRowSelection } from "@/components/Entries/useRowSelection";
import { Await } from "@/components/shared/Await";
import { MonthSelector } from "@/components/Summary/components/MonthSelector";
import { todayIso } from "@/core/incomes/dates";
import { deleteTransfersAction } from "@/core/transfers/actions";
import { TRANSFERS_PATH } from "@/core/transfers/consts";

import { DeleteTransferDialog } from "./components/DeleteTransferDialog";
import { TransferFormDrawer } from "./components/TransferFormDrawer";
import { TransfersFilters } from "./components/TransfersFilters";
import { TransfersTable } from "./components/TransfersTable";
import {
  ACTION_ITEMS,
  ACTIONS_LABEL,
  ADD_TRANSFER_ACTION,
  BULK_DELETE_COPY,
  INITIAL_FORM_TARGET,
  NO_FILTERS,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
} from "./consts";
import type {
  FormTarget,
  TransferFilters,
  TransferRow,
  TransfersProps,
  TransfersTableData,
} from "./types";
import { filterTransfers, hasActiveFilters } from "./utils";

export function Transfers({
  month,
  currentMonth,
  monthLabel,
  table,
  accounts,
}: TransfersProps) {
  // The rows ticked, and the rows a delete is working on until the refreshed rows arrive.
  const selection = useRowSelection();
  const { deletingIds, markDeleting } = useDeletingRows();
  const formState = useOverlayState();
  const deleteState = useOverlayState();
  const bulkDeleteState = useOverlayState();
  // The ids the bulk dialog was opened with: the selection may change while it is open.
  const [bulkIds, setBulkIds] = useState<readonly string[]>([]);
  const [formTarget, setFormTarget] = useState<FormTarget>(INITIAL_FORM_TARGET);
  const [transferToDelete, setTransferToDelete] = useState<TransferRow | null>(
    null,
  );
  const [filters, setFilters] = useState<TransferFilters>(NO_FILTERS);

  const openForm = (transfer: TransferRow | null) => {
    setFormTarget((current) => ({
      key: current.key + 1,
      transfer,
      defaultDate: todayIso(),
    }));
    formState.open();
  };

  const openDelete = (transfer: TransferRow) => {
    setTransferToDelete(transfer);
    deleteState.open();
  };

  const openBulkDelete = (ids: ReadonlySet<string>) => {
    setBulkIds([...ids]);
    bulkDeleteState.open();
  };

  const handleHeaderAction = (key: string) => {
    if (key === ADD_TRANSFER_ACTION) {
      openForm(null);
    }
  };

  const canClear = hasActiveFilters(filters);
  const clearFilters = () => setFilters(NO_FILTERS);

  // The same table is the loading state (skeleton rows) and the loaded one, so nothing shifts when the
  // rows arrive. The filters narrow the month's rows on the client.
  const renderTable = (data: TransfersTableData | null) => {
    const rows = filterTransfers(data?.rows ?? [], filters);
    // Only the selected rows that are still shown count.
    const selectedIds = selection.among(rows.map((row) => row.id));

    return (
      <>
        {selectedIds.size > 0 ? (
          <SelectionBar
            count={selectedIds.size}
            isDisabled={deletingIds.size > 0}
            onClear={selection.clear}
            onDelete={() => openBulkDelete(selectedIds)}
          />
        ) : null}

        <TransfersTable
          rows={rows}
          isLoading={data === null}
          isFiltered={canClear}
          onAdd={() => openForm(null)}
          onClearFilters={canClear ? clearFilters : undefined}
          onEdit={openForm}
          onDelete={openDelete}
          selectedIds={selectedIds}
          onSelectionChange={selection.select}
          deletingIds={deletingIds}
        />
      </>
    );
  };

  return (
    <main className={ROOT_CLASS_NAME}>
      <PageHeader
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        actionsLabel={ACTIONS_LABEL}
        actions={ACTION_ITEMS}
        onAction={handleHeaderAction}
        aside={
          <MonthSelector
            month={month}
            label={monthLabel}
            currentMonth={currentMonth}
            basePath={TRANSFERS_PATH}
          />
        }
      />

      <TransfersFilters
        filters={filters}
        accounts={accounts}
        canClear={canClear}
        onChange={(patch) =>
          setFilters((current) => ({ ...current, ...patch }))
        }
        onClear={clearFilters}
      />

      {/* Keyed by the month: another month is another list, so it gets a fresh boundary that shows
          the loading rows at once, instead of keeping the previous month's rows under the new name. */}
      <Await key={month} source={table} fallback={renderTable(null)}>
        {renderTable}
      </Await>

      {/* The form mounts once the accounts it offers are here; until then there is nothing to show in it. */}
      <Await source={accounts} fallback={null}>
        {(loadedAccounts) => (
          <TransferFormDrawer
            isOpen={formState.isOpen}
            onOpenChange={formState.setOpen}
            onClose={formState.close}
            target={formTarget}
            accounts={loadedAccounts}
          />
        )}
      </Await>

      <DeleteTransferDialog
        isOpen={deleteState.isOpen}
        onOpenChange={deleteState.setOpen}
        onClose={deleteState.close}
        onDeleting={markDeleting}
        transfer={transferToDelete}
      />

      <BulkDeleteDialog
        isOpen={bulkDeleteState.isOpen}
        onOpenChange={bulkDeleteState.setOpen}
        onClose={bulkDeleteState.close}
        ids={bulkIds}
        copy={BULK_DELETE_COPY}
        action={deleteTransfersAction}
        onDeleting={markDeleting}
        onDeleted={selection.clear}
      />
    </main>
  );
}
```

`components/Sidebar/consts.ts` — add `ArrowsRightLeftIcon` to the heroicons import (alphabetical: first) and the item right after Bancos:

```ts
  { label: "Bancos", href: "/dashboard/banks", icon: BuildingLibraryIcon },
  {
    label: "Transferencias",
    href: "/dashboard/transfers",
    icon: ArrowsRightLeftIcon,
  },
  { label: "Hoja de ruta", href: "/dashboard/roadmap", icon: ViewColumnsIcon },
```

`components/Navbar/components/NavbarBreadcrumbs/consts.ts` — add after `banks`:

```ts
  transfers: "Transferencias",
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run core/transfers app/dashboard/transfers components/Transfers components/Sidebar components/Navbar lib/auth/routeProtection.test.ts`
Expected: PASS (the route-protection guard finds the new page and its `requireUserId`).

- [ ] **Step 6: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts components/shared/PendingButton/pendingButtonUsage.test.ts lib/auth/routeProtection.test.ts`, `npx prettier --check core/transfers app/dashboard/transfers components/Transfers components/Sidebar components/Navbar`.
Expected: all green.

- [ ] **Step 7: Do NOT commit (the user commits only when asked); the snapshot is taken by the controller**

---

### Task 9: The "Por cuenta" card in the summary

**Read first:** `.heroui-docs/react/components/(layout)/card.mdx`, `(feedback)/skeleton.mdx`; the working components this task copies: `components/shared/MetricCard/*`, `components/Summary/components/CardRow/*`, `components/Summary/components/CurrencySection/*`, `components/Banks/components/BanksBoard/components/BankRow/components/AccountTile/*` (the red negative balance).

**Files:**

- Create: `core/summary/groupAccounts.ts`, `core/summary/byAccount.ts`
- Test: `core/summary/groupAccounts.test.ts`, `core/summary/byAccount.test.ts`
- Modify: `components/Summary/types.ts`, `consts.ts`, `styles.ts`, `utils.ts`, `Summary.tsx`
- Test: `components/Summary/utils.test.ts`, `components/Summary/Summary.test.tsx`
- Create: `components/Summary/components/AccountsSection/{AccountsSection.tsx, consts.ts, styles.ts, types.ts, index.ts}`
- Create: `components/Summary/components/AccountsSection/components/CurrencyAccountsCard/{CurrencyAccountsCard.tsx, consts.ts, styles.ts, types.ts, index.ts}`
- Create: `components/Summary/components/AccountsSection/components/CurrencyAccountsCard/components/BankBalances/{BankBalances.tsx, consts.ts, styles.ts, types.ts, index.ts}`
- Test: `components/Summary/components/AccountsSection/AccountsSection.test.tsx`
- Modify: `app/dashboard/overview/loadSummaryView.ts`, `app/dashboard/overview/page.tsx`, `app/dashboard/overview/loadSummaryView.test.ts`

**Interfaces:**

- Consumes: `readAccountBalances(prisma, userId)` (Task 3; "now", every settled movement including transfers); `formatMoney`; the existing `Source`/`Await`.
- Produces:
  - `core/summary/byAccount.ts`: `interface AccountBalanceRow { accountId: string; accountName: string; bankId: string; bankName: string; currency: string; balance: number; archived: boolean }`; `listAccountBalanceRows(userId: string): Promise<AccountBalanceRow[]>` (every account of the user in the Banks board's order, with its balance, 0 when it has none).
  - `core/summary/groupAccounts.ts`: `interface BankAccounts { bankId: string; bankName: string; accounts: AccountBalanceRow[] }`; `interface CurrencyAccounts { currency: string; total: number; banks: BankAccounts[] }`; `groupAccountBalances(rows: readonly AccountBalanceRow[]): CurrencyAccounts[]` (archived accounts only while their balance is not zero; currencies A to Z, never added together; a bank's accounts in the order given).
  - `components/Summary/types.ts`: `AccountLine { accountId: string; name: string; balanceLabel: string; isNegative: boolean; isArchived: boolean }`, `BankLines { bankId: string; bankName: string; accounts: AccountLine[] }`, `CurrencyAccountsRow { currency: string; totalLabel: string; isTotalNegative: boolean; banks: BankLines[] }`; `SummaryProps.accountBalances: Source<readonly CurrencyAccountsRow[]>`.
  - `toAccountRows(groups: readonly CurrencyAccounts[]): CurrencyAccountsRow[]` in `components/Summary/utils.ts`.
  - `loadSummaryView(userId, month)` returns one more promise, `accountBalances`.

- [ ] **Step 1: Write the failing core tests**

Create `core/summary/groupAccounts.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { groupAccountBalances } from "./groupAccounts";
import type { AccountBalanceRow } from "./byAccount";

const row = (patch: Partial<AccountBalanceRow>): AccountBalanceRow => ({
  accountId: "acc_1",
  accountName: "Caja de ahorro",
  bankId: "bank_1",
  bankName: "Galicia",
  currency: "ARS",
  balance: 0,
  archived: false,
  ...patch,
});

describe("groupAccountBalances", () => {
  it("groups the accounts by currency and then by bank, keeping the order given, with the total of each currency", () => {
    const groups = groupAccountBalances([
      row({
        accountId: "a1",
        bankId: "b1",
        bankName: "Efectivo",
        accountName: "Efectivo",
        balance: 1000,
      }),
      row({
        accountId: "a2",
        bankId: "b2",
        bankName: "Galicia",
        accountName: "Caja",
        balance: 5000,
      }),
      row({
        accountId: "a3",
        bankId: "b2",
        bankName: "Galicia",
        accountName: "Dólares",
        currency: "USD",
        balance: 700,
      }),
      row({
        accountId: "a4",
        bankId: "b2",
        bankName: "Galicia",
        accountName: "Plazo",
        balance: 2500,
      }),
    ]);

    expect(groups).toEqual([
      {
        currency: "ARS",
        total: 8500,
        banks: [
          {
            bankId: "b1",
            bankName: "Efectivo",
            accounts: [expect.objectContaining({ accountId: "a1" })],
          },
          {
            bankId: "b2",
            bankName: "Galicia",
            accounts: [
              expect.objectContaining({ accountId: "a2" }),
              expect.objectContaining({ accountId: "a4" }),
            ],
          },
        ],
      },
      {
        currency: "USD",
        total: 700,
        banks: [
          {
            bankId: "b2",
            bankName: "Galicia",
            accounts: [expect.objectContaining({ accountId: "a3" })],
          },
        ],
      },
    ]);
  });

  it("never adds two currencies together", () => {
    const groups = groupAccountBalances([
      row({ accountId: "a1", balance: 100 }),
      row({ accountId: "a2", currency: "USD", balance: 100 }),
    ]);

    expect(groups.map(({ currency, total }) => [currency, total])).toEqual([
      ["ARS", 100],
      ["USD", 100],
    ]);
  });

  it("sorts the currencies A to Z whatever the order of the accounts", () => {
    const groups = groupAccountBalances([
      row({ accountId: "a1", currency: "USD" }),
      row({ accountId: "a2", currency: "ARS" }),
      row({ accountId: "a3", currency: "EUR" }),
    ]);

    expect(groups.map(({ currency }) => currency)).toEqual([
      "ARS",
      "EUR",
      "USD",
    ]);
  });

  it("keeps an active account at zero (a card with no money is still a card) and a negative one", () => {
    const [ars] = groupAccountBalances([
      row({ accountId: "a1", balance: 0 }),
      row({ accountId: "a2", balance: -300 }),
    ]);

    expect(ars.banks[0].accounts.map((a) => a.accountId)).toEqual(["a1", "a2"]);
    expect(ars.total).toBe(-300);
  });

  it("shows an archived account only while it still holds something, in either direction", () => {
    const [ars] = groupAccountBalances([
      row({ accountId: "gone", archived: true, balance: 0 }),
      row({ accountId: "rich", archived: true, balance: 900 }),
      row({ accountId: "debt", archived: true, balance: -50 }),
      row({ accountId: "live", balance: 10 }),
    ]);

    expect(ars.banks[0].accounts.map((a) => a.accountId)).toEqual([
      "rich",
      "debt",
      "live",
    ]);
  });

  it("drops a currency whose only accounts are archived and empty", () => {
    expect(
      groupAccountBalances([
        row({ archived: true, balance: 0, currency: "EUR" }),
      ]),
    ).toEqual([]);
  });

  it("is empty without accounts", () => {
    expect(groupAccountBalances([])).toEqual([]);
  });

  it("does not change the rows it is given", () => {
    const rows = [
      row({ accountId: "a1", currency: "USD" }),
      row({ accountId: "a2" }),
    ];
    const copy = rows.map((r) => ({ ...r }));

    groupAccountBalances(rows);

    expect(rows).toEqual(copy);
  });

  it("keeps a currency's total equal to the sum of its accounts when a transfer moves money between two of them", () => {
    const before = groupAccountBalances([
      row({ accountId: "a1", balance: 10000 }),
      row({ accountId: "a2", bankId: "b2", balance: 2000 }),
    ]);
    const after = groupAccountBalances([
      row({ accountId: "a1", balance: 6000 }),
      row({ accountId: "a2", bankId: "b2", balance: 6000 }),
    ]);

    expect(after[0].total).toBe(before[0].total);
  });
});
```

Create `core/summary/byAccount.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ account: { findMany: vi.fn() } }));
const balances = vi.hoisted(() => ({ readAccountBalances: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/balances/accountBalances", () => balances);

import { listAccountBalanceRows } from "./byAccount";

const USER_ID = "user_123";

const account = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  userId: USER_ID,
  bankId: "bank_1",
  name: `Cuenta ${id}`,
  currency: "ARS",
  archivedAt: null,
  bank: { name: "Galicia" },
  ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
  db.account.findMany.mockResolvedValue([]);
  balances.readAccountBalances.mockResolvedValue([]);
});

describe("listAccountBalanceRows", () => {
  it("reads the user's accounts in the Banks board's order, and their balances as they are now (every settled movement, transfers included)", async () => {
    await listAccountBalanceRows(USER_ID);

    expect(db.account.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      include: { bank: { select: { name: true } } },
      orderBy: [
        { bank: { createdAt: "asc" } },
        { bank: { id: "asc" } },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });
    expect(balances.readAccountBalances).toHaveBeenCalledWith(db, USER_ID);
  });

  it("gives each account its balance, 0 for one that has no movement, and flags the archived ones", async () => {
    db.account.findMany.mockResolvedValue([
      account("a1"),
      account("a2", {
        archivedAt: new Date("2026-09-01T00:00:00.000Z"),
        currency: "USD",
      }),
    ]);
    balances.readAccountBalances.mockResolvedValue([
      { accountId: "a1", currency: "ARS", balance: -250 },
    ]);

    expect(await listAccountBalanceRows(USER_ID)).toEqual([
      {
        accountId: "a1",
        accountName: "Cuenta a1",
        bankId: "bank_1",
        bankName: "Galicia",
        currency: "ARS",
        balance: -250,
        archived: false,
      },
      {
        accountId: "a2",
        accountName: "Cuenta a2",
        bankId: "bank_1",
        bankName: "Galicia",
        currency: "USD",
        balance: 0,
        archived: true,
      },
    ]);
  });
});
```

- [ ] **Step 2: Write the failing UI tests**

Append to `components/Summary/utils.test.ts` (extend the imports with `toAccountRows`):

```ts
describe("toAccountRows", () => {
  it("formats every balance in the currency of its account and flags the negative ones", () => {
    const rows = toAccountRows([
      {
        currency: "USD",
        total: -300,
        banks: [
          {
            bankId: "b1",
            bankName: "Galicia",
            accounts: [
              {
                accountId: "a1",
                accountName: "Dólares",
                bankId: "b1",
                bankName: "Galicia",
                currency: "USD",
                balance: -300,
                archived: false,
              },
            ],
          },
        ],
      },
    ]);

    expect(rows).toEqual([
      {
        currency: "USD",
        totalLabel: formatMoney(-300, "USD"),
        isTotalNegative: true,
        banks: [
          {
            bankId: "b1",
            bankName: "Galicia",
            accounts: [
              {
                accountId: "a1",
                name: "Dólares",
                balanceLabel: formatMoney(-300, "USD"),
                isNegative: true,
                isArchived: false,
              },
            ],
          },
        ],
      },
    ]);
  });

  it("does not flag zero or positive balances", () => {
    const [ars] = toAccountRows([
      {
        currency: "ARS",
        total: 0,
        banks: [
          {
            bankId: "b1",
            bankName: "Efectivo",
            accounts: [
              {
                accountId: "a1",
                accountName: "Efectivo",
                bankId: "b1",
                bankName: "Efectivo",
                currency: "ARS",
                balance: 0,
                archived: false,
              },
            ],
          },
        ],
      },
    ]);

    expect(ars.isTotalNegative).toBe(false);
    expect(ars.banks[0].accounts[0].isNegative).toBe(false);
  });
});
```

(add `import { formatMoney } from "@/core/incomes/money";` if absent.)

Create `components/Summary/components/AccountsSection/AccountsSection.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CurrencyAccountsRow } from "../../types";
import { AccountsSection } from "./AccountsSection";

const ARS: CurrencyAccountsRow = {
  currency: "ARS",
  totalLabel: "$ 8.500,00",
  isTotalNegative: false,
  banks: [
    {
      bankId: "b1",
      bankName: "Efectivo",
      accounts: [
        {
          accountId: "a1",
          name: "Efectivo",
          balanceLabel: "$ 1.000,00",
          isNegative: false,
          isArchived: false,
        },
      ],
    },
    {
      bankId: "b2",
      bankName: "Galicia",
      accounts: [
        {
          accountId: "a2",
          name: "Caja de ahorro",
          balanceLabel: "$ 5.000,00",
          isNegative: false,
          isArchived: false,
        },
        {
          accountId: "a3",
          name: "Vieja",
          balanceLabel: "-$ 300,00",
          isNegative: true,
          isArchived: true,
        },
      ],
    },
  ],
};
const USD: CurrencyAccountsRow = {
  currency: "USD",
  totalLabel: "US$ 700,00",
  isTotalNegative: false,
  banks: [
    {
      bankId: "b2",
      bankName: "Galicia",
      accounts: [
        {
          accountId: "a4",
          name: "Dólares",
          balanceLabel: "US$ 700,00",
          isNegative: false,
          isArchived: false,
        },
      ],
    },
  ],
};

describe("AccountsSection", () => {
  it("is the 'Por cuenta' section and says it shows today's balances", () => {
    render(<AccountsSection rows={[ARS, USD]} />);

    expect(
      screen.getByRole("heading", { name: "Por cuenta" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Saldos de hoy/)).toBeVisible();
  });

  it("has one card per currency, never mixing them, each with its total", () => {
    render(<AccountsSection rows={[ARS, USD]} />);

    const ars = screen.getByRole("region", { name: "Por cuenta en ARS" });
    const usd = screen.getByRole("region", { name: "Por cuenta en USD" });

    expect(within(ars).getByText("$ 8.500,00")).toBeVisible();
    expect(within(ars).queryByText("US$ 700,00")).toBeNull();
    expect(within(usd).getByText("US$ 700,00")).toBeVisible();
  });

  it("groups the accounts of a currency under their bank, each with its balance", () => {
    render(<AccountsSection rows={[ARS]} />);

    const ars = screen.getByRole("region", { name: "Por cuenta en ARS" });
    const galicia = within(ars).getByRole("group", { name: "Galicia" });

    expect(within(galicia).getByText("Caja de ahorro")).toBeVisible();
    expect(within(galicia).getByText("$ 5.000,00")).toBeVisible();
    expect(
      within(ars).getByRole("group", { name: "Efectivo" }),
    ).toBeInTheDocument();
  });

  it("shows a negative balance as a danger text and marks an archived account", () => {
    render(<AccountsSection rows={[ARS]} />);

    const negative = screen.getByText("-$ 300,00");

    expect(negative.className).toMatch(/text-danger/);
    expect(screen.getByText("$ 5.000,00").className).not.toMatch(/text-danger/);
    expect(screen.getByText(/Vieja/)).toHaveTextContent("Vieja (archivada)");
  });

  it("shows a negative total as a danger text too", () => {
    render(
      <AccountsSection
        rows={[{ ...ARS, totalLabel: "-$ 10,00", isTotalNegative: true }]}
      />,
    );

    expect(screen.getByText("-$ 10,00").className).toMatch(/text-danger/);
  });

  it("renders nothing without accounts", () => {
    const { container } = render(<AccountsSection rows={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
```

In `components/Summary/Summary.test.tsx`, give the `renderSummary` helper a fifth optional parameter and pass it through (so every existing test keeps rendering):

```tsx
  accountBalances: Parameters<typeof Summary>[0]["accountBalances"] = [],
```

with `accountBalances={accountBalances}` on the `<Summary …/>` it renders, define `ACCOUNTS_ROW` (a `CurrencyAccountsRow` for ARS like `ARS` in the section test below, imported from `./types`), and add:

```tsx
it("shows the 'Por cuenta' section under the currency sections, once its numbers arrive", () => {
  renderSummary([ARS], "2026-09", OPENING, true, [ACCOUNTS_ROW]);

  expect(
    screen.getByRole("heading", { name: "Por cuenta" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Por cuenta en ARS" }),
  ).toBeInTheDocument();
});

it("keeps the shape of the page while the accounts load", () => {
  renderSummary([ARS], "2026-09", OPENING, true, new Promise(() => {}));

  expect(screen.queryByRole("heading", { name: "Por cuenta" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Resumen" })).toBeInTheDocument();
});
```

In `app/dashboard/overview/loadSummaryView.test.ts`: the loader will import `@/core/summary/byAccount`, which pulls in the real database client, so mock it like the other services: add `const accounts = vi.hoisted(() => ({ listAccountBalanceRows: vi.fn() }));` and `vi.mock("@/core/summary/byAccount", () => accounts);` next to the existing mocks, reset it in `beforeEach` and make it resolve `[]` by default (`accounts.listAccountBalanceRows.mockReset(); accounts.listAccountBalanceRows.mockResolvedValue([]);`). If the file has a test that pins the returned keys, update it to `["accountBalances", "includeExpectedIncomes", "openingBalance", "summary"]`. Then add (inside the existing `describe("loadSummaryView", …)`):

```ts
it("reads the accounts' balances for the 'Por cuenta' card, grouped and formatted, independently of the month", async () => {
  accounts.listAccountBalanceRows.mockResolvedValue([
    {
      accountId: "a1",
      accountName: "Efectivo",
      bankId: "b1",
      bankName: "Efectivo",
      currency: "ARS",
      balance: 1000,
      archived: false,
    },
  ]);

  const view = loadSummaryView("user_1", "2026-03");

  await expect(view.accountBalances).resolves.toEqual([
    expect.objectContaining({
      currency: "ARS",
      banks: [expect.objectContaining({ bankName: "Efectivo" })],
    }),
  ]);
  expect(accounts.listAccountBalanceRows).toHaveBeenCalledWith("user_1");
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run core/summary components/Summary app/dashboard/overview`
Expected: FAIL (modules and props missing).

- [ ] **Step 4: Write the core implementation**

`core/summary/byAccount.ts`:

```ts
import { readAccountBalances } from "@/core/balances/accountBalances";
import { prisma } from "@/infrastructure/db/client";

// One account with what it holds now, for the "Por cuenta" card.
export interface AccountBalanceRow {
  accountId: string;
  accountName: string;
  bankId: string;
  bankName: string;
  currency: string;
  // Minor units of `currency`; negative when the account owes.
  balance: number;
  archived: boolean;
}

// Every account of the user, in the order of the Banks board (bank, then account, by creation), with
// its balance as it is now: every settled movement, incomes, expenses and transfers alike, through the
// same reader the Banks board and the archive rule use, so the three always agree. An account without
// movements holds 0. Scoped by userId; the two reads are independent, so they run together.
export const listAccountBalanceRows = async (
  userId: string,
): Promise<AccountBalanceRow[]> => {
  const [accounts, balances] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      include: { bank: { select: { name: true } } },
      orderBy: [
        { bank: { createdAt: "asc" } },
        { bank: { id: "asc" } },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    }),
    readAccountBalances(prisma, userId),
  ]);
  const balanceOf = new Map(
    balances.map(({ accountId, balance }) => [accountId, balance]),
  );

  return accounts.map((account) => ({
    accountId: account.id,
    accountName: account.name,
    bankId: account.bankId,
    bankName: account.bank.name,
    currency: account.currency,
    balance: balanceOf.get(account.id) ?? 0,
    archived: account.archivedAt !== null,
  }));
};
```

`core/summary/groupAccounts.ts`:

```ts
import type { AccountBalanceRow } from "./byAccount";

export interface BankAccounts {
  bankId: string;
  bankName: string;
  accounts: AccountBalanceRow[];
}

// One currency's accounts, grouped by bank, with their total. Currencies are never added together.
export interface CurrencyAccounts {
  currency: string;
  total: number;
  banks: BankAccounts[];
}

// What the "Por cuenta" card shows: the accounts per currency and then per bank, in the order given
// (the Banks board's). An active account always shows, even at zero; an archived one only while it
// still holds something (in either direction), so it never hides money. A currency's total is the sum
// of the accounts shown, which is the sum of all of them (the archived ones left out hold nothing).
// The input is never changed.
export const groupAccountBalances = (
  rows: readonly AccountBalanceRow[],
): CurrencyAccounts[] => {
  const byCurrency = new Map<string, CurrencyAccounts>();

  for (const row of rows) {
    if (row.archived && row.balance === 0) {
      continue;
    }

    const currency = byCurrency.get(row.currency) ?? {
      currency: row.currency,
      total: 0,
      banks: [],
    };
    let bank = currency.banks.find(({ bankId }) => bankId === row.bankId);

    if (!bank) {
      bank = { bankId: row.bankId, bankName: row.bankName, accounts: [] };
      currency.banks.push(bank);
    }

    bank.accounts.push(row);
    currency.total += row.balance;
    byCurrency.set(row.currency, currency);
  }

  return [...byCurrency.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
};
```

- [ ] **Step 5: Write the UI implementation**

`components/Summary/types.ts` — add (keeping the file's existing content):

```ts
// One account of the "Por cuenta" card, its balance already formatted in its currency.
export interface AccountLine {
  accountId: string;
  name: string;
  balanceLabel: string;
  // Negative balances are shown in red, never blocked.
  isNegative: boolean;
  isArchived: boolean;
}

export interface BankLines {
  bankId: string;
  bankName: string;
  accounts: AccountLine[];
}

// One currency's card: its total and its banks.
export interface CurrencyAccountsRow {
  currency: string;
  totalLabel: string;
  isTotalNegative: boolean;
  banks: BankLines[];
}
```

and in `SummaryProps` add:

```ts
// What each account holds today, per currency and bank, or a promise of it while it loads.
accountBalances: Source<readonly CurrencyAccountsRow[]>;
```

`components/Summary/utils.ts` — add the import and the function:

```ts
import type { CurrencyAccounts } from "@/core/summary/groupAccounts";
```

and extend the `./types` import with `CurrencyAccountsRow`, then:

```ts
// The "Por cuenta" card's rows: money formatted on the server, in each account's own currency, so the
// client only places text.
export const toAccountRows = (
  groups: readonly CurrencyAccounts[],
): CurrencyAccountsRow[] =>
  groups.map(({ currency, total, banks }) => ({
    currency,
    totalLabel: formatMoney(total, currency),
    isTotalNegative: total < 0,
    banks: banks.map(({ bankId, bankName, accounts }) => ({
      bankId,
      bankName,
      accounts: accounts.map((account) => ({
        accountId: account.accountId,
        name: account.accountName,
        balanceLabel: formatMoney(account.balance, currency),
        isNegative: account.balance < 0,
        isArchived: account.archived,
      })),
    })),
  }));
```

`components/Summary/styles.ts` — add:

```ts
// Where the "Por cuenta" section will be, while its balances are on their way: roughly its height, so
// the page does not jump when it arrives.
export const ACCOUNTS_SKELETON_CLASS_NAME = "h-40 w-full max-w-xl rounded-2xl";
```

`components/Summary/components/AccountsSection/consts.ts`:

```ts
export const SECTION_TITLE = "Por cuenta";
export const SECTION_HINT =
  "Saldos de hoy, cuenta por cuenta y agrupados por banco, sin importar el mes que estás viendo.";
```

`components/Summary/components/AccountsSection/styles.ts`:

```ts
export const ROOT_CLASS_NAME = "flex flex-col gap-3";

export const HEADING_CLASS_NAME = "text-lg font-semibold";

export const HINT_CLASS_NAME = "text-sm text-muted";

export const LIST_CLASS_NAME = "flex flex-wrap gap-3";
```

`components/Summary/components/AccountsSection/types.ts`:

```ts
import type { CurrencyAccountsRow } from "../../types";

export interface AccountsSectionProps {
  // One row per currency that has accounts to show. Nothing renders without any.
  rows: readonly CurrencyAccountsRow[];
}
```

`components/Summary/components/AccountsSection/index.ts`:

```ts
export { AccountsSection } from "./AccountsSection";
```

`components/Summary/components/AccountsSection/AccountsSection.tsx`:

```tsx
import { CurrencyAccountsCard } from "./components/CurrencyAccountsCard";
import { SECTION_HINT, SECTION_TITLE } from "./consts";
import {
  HEADING_CLASS_NAME,
  HINT_CLASS_NAME,
  LIST_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { AccountsSectionProps } from "./types";

// The balance of each account, grouped by bank, one card per currency (currencies are never added
// together). It is the same figure the Banks board shows, as of today.
export function AccountsSection({ rows }: AccountsSectionProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className={ROOT_CLASS_NAME} aria-labelledby="accounts-heading">
      <h2 id="accounts-heading" className={HEADING_CLASS_NAME}>
        {SECTION_TITLE}
      </h2>
      <p className={HINT_CLASS_NAME}>{SECTION_HINT}</p>
      <div className={LIST_CLASS_NAME}>
        {rows.map((row) => (
          <CurrencyAccountsCard key={row.currency} row={row} />
        ))}
      </div>
    </section>
  );
}
```

`components/Summary/components/AccountsSection/components/CurrencyAccountsCard/consts.ts`:

```ts
export const TOTAL_LABEL = "Total";

// "Por cuenta en ARS": names the card for a reader that hears only its list.
export const cardLabel = (currency: string): string =>
  `Por cuenta en ${currency}`;
```

`components/Summary/components/AccountsSection/components/CurrencyAccountsCard/styles.ts`:

```ts
// A flat card like the metric cards: a ring instead of a shadow, tight padding.
export const ROOT_CLASS_NAME =
  "w-full min-w-64 max-w-md gap-3 rounded-2xl px-4 py-3 shadow-none ring-1 ring-inset ring-border sm:w-auto";

export const HEADER_CLASS_NAME = "flex items-baseline justify-between gap-3";

export const CURRENCY_CLASS_NAME = "text-sm font-semibold";

export const TOTAL_CLASS_NAME = "text-sm text-muted";

export const TOTAL_VALUE_CLASS_NAME = "tabular-nums";

// A negative total is shown in red, never blocked.
export const NEGATIVE_TOTAL_VALUE_CLASS_NAME = "tabular-nums text-danger";

export const BANKS_CLASS_NAME = "flex flex-col gap-3";
```

`components/Summary/components/AccountsSection/components/CurrencyAccountsCard/types.ts`:

```ts
import type { CurrencyAccountsRow } from "../../../../types";

export interface CurrencyAccountsCardProps {
  row: CurrencyAccountsRow;
}
```

`components/Summary/components/AccountsSection/components/CurrencyAccountsCard/index.ts`:

```ts
export { CurrencyAccountsCard } from "./CurrencyAccountsCard";
```

`components/Summary/components/AccountsSection/components/CurrencyAccountsCard/CurrencyAccountsCard.tsx`:

```tsx
import { Card } from "@heroui/react";

import { BankBalances } from "./components/BankBalances";
import { cardLabel, TOTAL_LABEL } from "./consts";
import {
  BANKS_CLASS_NAME,
  CURRENCY_CLASS_NAME,
  HEADER_CLASS_NAME,
  NEGATIVE_TOTAL_VALUE_CLASS_NAME,
  ROOT_CLASS_NAME,
  TOTAL_CLASS_NAME,
  TOTAL_VALUE_CLASS_NAME,
} from "./styles";
import type { CurrencyAccountsCardProps } from "./types";

// One currency of the "Por cuenta" section: its total in the header and its banks under it.
export function CurrencyAccountsCard({ row }: CurrencyAccountsCardProps) {
  return (
    <Card
      className={ROOT_CLASS_NAME}
      role="region"
      aria-label={cardLabel(row.currency)}
    >
      <Card.Header className={HEADER_CLASS_NAME}>
        <span className={CURRENCY_CLASS_NAME}>{row.currency}</span>
        <span className={TOTAL_CLASS_NAME}>
          {TOTAL_LABEL}{" "}
          <span
            className={
              row.isTotalNegative
                ? NEGATIVE_TOTAL_VALUE_CLASS_NAME
                : TOTAL_VALUE_CLASS_NAME
            }
          >
            {row.totalLabel}
          </span>
        </span>
      </Card.Header>
      <Card.Content className={BANKS_CLASS_NAME}>
        {row.banks.map((bank) => (
          <BankBalances key={bank.bankId} bank={bank} />
        ))}
      </Card.Content>
    </Card>
  );
}
```

`components/Summary/components/AccountsSection/components/CurrencyAccountsCard/components/BankBalances/consts.ts`:

```ts
export const ARCHIVED_SUFFIX = " (archivada)";
```

`components/Summary/components/AccountsSection/components/CurrencyAccountsCard/components/BankBalances/styles.ts`:

```ts
export const ROOT_CLASS_NAME = "flex flex-col gap-1";

export const BANK_CLASS_NAME = "text-xs font-medium text-muted";

export const LIST_CLASS_NAME = "flex flex-col gap-1";

export const ROW_CLASS_NAME =
  "flex items-baseline justify-between gap-3 text-sm";

export const NAME_CLASS_NAME = "truncate";

export const BALANCE_CLASS_NAME = "shrink-0 font-medium tabular-nums";

// A negative balance is shown in red, never blocked.
export const NEGATIVE_BALANCE_CLASS_NAME = `${BALANCE_CLASS_NAME} text-danger`;
```

`components/Summary/components/AccountsSection/components/CurrencyAccountsCard/components/BankBalances/types.ts`:

```ts
import type { BankLines } from "../../../../../../types";

export interface BankBalancesProps {
  bank: BankLines;
}
```

`components/Summary/components/AccountsSection/components/CurrencyAccountsCard/components/BankBalances/index.ts`:

```ts
export { BankBalances } from "./BankBalances";
```

`components/Summary/components/AccountsSection/components/CurrencyAccountsCard/components/BankBalances/BankBalances.tsx`:

```tsx
import { ARCHIVED_SUFFIX } from "./consts";
import {
  BALANCE_CLASS_NAME,
  BANK_CLASS_NAME,
  LIST_CLASS_NAME,
  NAME_CLASS_NAME,
  NEGATIVE_BALANCE_CLASS_NAME,
  ROOT_CLASS_NAME,
  ROW_CLASS_NAME,
} from "./styles";
import type { BankBalancesProps } from "./types";

// A bank and the accounts it holds in the card's currency, each with its balance.
export function BankBalances({ bank }: BankBalancesProps) {
  return (
    <div className={ROOT_CLASS_NAME} role="group" aria-label={bank.bankName}>
      <span className={BANK_CLASS_NAME} aria-hidden="true">
        {bank.bankName}
      </span>
      <ul className={LIST_CLASS_NAME}>
        {bank.accounts.map((account) => (
          <li key={account.accountId} className={ROW_CLASS_NAME}>
            <span className={NAME_CLASS_NAME}>
              {account.isArchived
                ? `${account.name}${ARCHIVED_SUFFIX}`
                : account.name}
            </span>
            <span
              className={
                account.isNegative
                  ? NEGATIVE_BALANCE_CLASS_NAME
                  : BALANCE_CLASS_NAME
              }
            >
              {account.balanceLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`components/Summary/Summary.tsx` — import `Skeleton` is already imported; add the `AccountsSection` import, the skeleton style import and the new prop, and render the section after the currency sections `Await`:

```tsx
import { AccountsSection } from "./components/AccountsSection";
```

add `ACCOUNTS_SKELETON_CLASS_NAME` to the `./styles` import, `accountBalances` to the destructured props, and after the `<Await key={month} source={summary} …>` block:

```tsx
{
  /* Today's balance of each account: it does not depend on the month shown, so it has its own
          promise and its own boundary, and stays put when the month changes. */
}
<Await
  source={accountBalances}
  fallback={<Skeleton className={ACCOUNTS_SKELETON_CLASS_NAME} />}
>
  {(rows) => <AccountsSection rows={rows} />}
</Await>;
```

`app/dashboard/overview/loadSummaryView.ts` — add the imports and the promise:

```ts
import { toAccountRows } from "@/components/Summary/utils";
import { listAccountBalanceRows } from "@/core/summary/byAccount";
import { groupAccountBalances } from "@/core/summary/groupAccounts";
```

(merge `toAccountRows` into the existing `@/components/Summary/utils` import) and in the returned object:

```ts
    // What each account holds today, for the "Por cuenta" card: independent of the month and of the
    // settings, so it starts at once.
    accountBalances: listAccountBalanceRows(userId)
      .then(groupAccountBalances)
      .then(toAccountRows),
```

`app/dashboard/overview/page.tsx` — destructure and pass it:

```tsx
const { summary, openingBalance, includeExpectedIncomes, accountBalances } =
  loadSummaryView(userId, month);
```

and `accountBalances={accountBalances}` on `<Summary …/>`.

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run core/summary components/Summary app/dashboard/overview`
Expected: PASS. (HeroUI's `Card` may not forward `role`/`aria-label`; if the `region` queries fail, put the `role="region"` and `aria-label` on a plain wrapper `div` inside `CurrencyAccountsCard` instead and keep the assertions.)

- [ ] **Step 7: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts lib/auth/routeProtection.test.ts`, `npx prettier --check core/summary components/Summary app/dashboard/overview`.
Expected: all green.

- [ ] **Step 8: Do NOT commit (the user commits only when asked); the snapshot is taken by the controller**

---

### Task 10: Close the opening-balance save window with `FOR SHARE` (deferred item absorbed)

**Files:**

- Modify: `core/accounts/locks.ts` (add `lockAccountsShared`)
- Test: `core/accounts/locks.test.ts`
- Modify: `core/balances/service.ts` (`saveOpeningBalances` takes the shared locks first; the comment is rewritten)
- Test: `core/balances/service.test.ts`

**Interfaces:**

- Consumes: `inLockOrder` (Task 4).
- Produces: `lockAccountsShared(tx, userId, accountIds: readonly string[]): Promise<void>` — `SELECT "id" FROM "Account" WHERE "id" = ${id} AND "userId" = ${userId} FOR SHARE`, one account at a time in `inLockOrder`. `saveOpeningBalances` calls it with the payload's account ids before reading them.

- [ ] **Step 1: Write the failing tests**

Append to `core/accounts/locks.test.ts` (extend the import with `lockAccountsShared`):

```ts
describe("lockAccountsShared", () => {
  const sqlOf = (call: unknown[]): string =>
    (call[0] as TemplateStringsArray).join("?").replace(/\s+/g, " ").trim();

  it("takes a shared lock on each account, one after the other, in ascending id order, ids as parameters", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };

    await lockAccountsShared(tx, USER_ID, ["acc_b", "acc_a", "acc_b"]);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw.mock.calls.map((call) => call[1])).toEqual([
      "acc_a",
      "acc_b",
    ]);
    for (const call of tx.$queryRaw.mock.calls) {
      expect(sqlOf(call)).toContain('FROM "Account"');
      expect(sqlOf(call)).toMatch(/FOR SHARE$/);
      expect(call[2]).toBe(USER_ID);
    }
  });

  it("locks nothing for no accounts", async () => {
    const tx = { $queryRaw: vi.fn() };

    await lockAccountsShared(tx, USER_ID, []);

    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
```

In `core/balances/service.test.ts`, add `$queryRaw: vi.fn()` to the hoisted `db`, and (in `beforeEach`, after `vi.resetAllMocks()`) `db.$queryRaw.mockResolvedValue([]);`. Add inside `describe("saveOpeningBalances", …)`:

```ts
it("takes a shared lock on the payload's accounts, in ascending id order, before it reads them", async () => {
  const order: string[] = [];

  db.$queryRaw.mockImplementation(
    async (_strings: TemplateStringsArray, id: string) => {
      order.push(`lock ${id}`);

      return [];
    },
  );
  account.findMany.mockImplementation(async () => {
    order.push("read accounts");

    return [
      { id: "acc_a", currency: "ARS" },
      { id: "acc_b", currency: "ARS" },
    ];
  });

  await saveOpeningBalances(USER_ID, {
    month: "2026-06",
    amounts: [
      { accountId: "acc_b", currency: "ARS", amount: 1 },
      { accountId: "acc_a", currency: "ARS", amount: 2 },
    ],
  });

  expect(order).toEqual(["lock acc_a", "lock acc_b", "read accounts"]);
});

it("locks nothing when it only clears the opening balance", async () => {
  await saveOpeningBalances(USER_ID, { month: "2026-06", amounts: [] });

  expect(db.$queryRaw).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run core/accounts/locks.test.ts core/balances/service.test.ts`
Expected: FAIL (`lockAccountsShared` does not exist; no lock is taken).

- [ ] **Step 3: Write the implementation**

Append to `core/accounts/locks.ts`:

```ts
// A shared lock on the user's accounts until the surrounding transaction ends, in lock order. It lets
// other readers in but makes a writer that needs the exclusive lock (archiving the account, changing
// its currency, moving money through a transfer) wait for this transaction, and the other way round:
// what the transaction read about the accounts stays true until it commits. Ids and userId travel as
// parameters. An id that is not the user's simply locks nothing.
export const lockAccountsShared = async (
  tx: Locker,
  userId: string,
  accountIds: readonly string[],
): Promise<void> => {
  for (const id of inLockOrder(accountIds)) {
    await tx.$queryRaw`
      SELECT "id" FROM "Account"
      WHERE "id" = ${id} AND "userId" = ${userId}
      FOR SHARE
    `;
  }
};
```

`core/balances/service.ts` — add the import `import { lockAccountsShared } from "@/core/accounts/locks";`, replace the "Residual window" paragraph of the comment of `saveOpeningBalances` with:

```ts
// The payload's accounts are locked FOR SHARE before they are read, in ascending id order (the order
// every multi-account writer uses), so a concurrent `updateAccount` (which takes the row FOR UPDATE to
// count movements and change the currency) cannot slip between the currency check below and the
// writes: it waits for this transaction, or this one waits for it and then reads the new currency and
// refuses the stale row.
```

and, inside the transaction, right after `const accountIds = amounts.map(({ accountId }) => accountId);`:

```ts
await lockAccountsShared(tx, userId, accountIds);
```

(the existing `if (accountIds.length > 0)` block stays as it is; an empty list locks nothing).

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run core/accounts core/balances`
Expected: PASS.

- [ ] **Step 5: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check core/accounts/locks.ts core/accounts/locks.test.ts core/balances/service.ts core/balances/service.test.ts`.
Expected: all green.

- [ ] **Step 6: Do NOT commit (the user commits only when asked); the snapshot is taken by the controller**

---

### Task 11: Whole-stage verification, browser pass and handoff

**Files:** none are created for the product. The controller (not an implementer) runs this task; if a check fails, the failing task's implementer fixes it.

**Interfaces:**

- Consumes: everything above; the migration applied and `next dev` restarted at the gate after Task 1.
- Produces: a verified stage and the numbers to report.

- [ ] **Step 1: Static and unit checks**

Run, in this order, and write the results down:

1. `npx vitest run` — all green; record files and tests, compare with the baseline of Task 1 (the difference is exactly the new test files and cases).
2. `npx tsc --noEmit` — clean (if `PageProps<"/dashboard/transfers">` is not found, `npx next typegen` once).
3. `npm run lint` — clean.
4. `npx vitest run components/componentStructure.test.ts components/shared/PendingButton/pendingButtonUsage.test.ts lib/auth/routeProtection.test.ts prisma/schema.test.ts scripts/clearData` — green.
5. `npx prettier --check core/transfers core/balances core/summary core/accounts components/Transfers components/Summary components/Entries/components/AccountField components/Sidebar components/Navbar app/dashboard/transfers app/dashboard/overview prisma/schema.test.ts scripts/clearData` — clean.

- [ ] **Step 2: Confirm the migration state (read-only)**

Run `npx prisma migrate status`. Expected: the database is up to date and `20261007120000_transfers` is applied. If it is not, STOP and ask the user to run `npx prisma migrate deploy`; do not apply it yourself. If the browser pass below fails with `Cannot read properties of undefined (reading 'groupBy')` or `The table ... Transfer does not exist`, the dev server still holds the old Prisma client or the migration is missing: ask the user to restart `next dev` (it caches the client on `globalThis`) and do not restart it yourself.

- [ ] **Step 3: Ask once before the live writes**

The dev database holds the user's real data. Ask the user (one question): "I will verify the transfers in the browser by creating one small transfer (1,00) between two of your ARS accounts and then deleting it, so every balance ends where it started. Can I?" Wait for the answer. Without a yes, verify only the read-only items (1, 2, 8, 11 below).

- [ ] **Step 4: Browser verification (Playwright MCP; reuse the signed-in session, do not close the browser, check port 3000 first and never restart the server)**

Record every number before touching anything: the Banks tiles of the two accounts, and the summary's Ingresos, Gastos, Saldo previo, Actual and Objetivo for ARS, and the "Por cuenta" total for ARS. Then check each item and note pass or fail:

1. The sidebar shows "Transferencias" right after "Bancos"; its page opens at `/dashboard/transfers`, the breadcrumb says "Transferencias", the header shows the month selector (previous, name, next, "Mes actual") and an Actions menu with only "Crear transferencia".
2. The summary page has the "Por cuenta" section under the currency sections: one card per currency, banks as groups, accounts with balances, a "Total" per currency; its numbers equal the Banks tiles; a negative balance (if any) is red.
3. "Crear transferencia" opens the drawer: the destination never offers the chosen source; changing the currency clears both accounts; with a single account in a currency the destination says "Necesitás otra cuenta en … " with the "Creá una en Bancos" link; the date defaults to today.
4. A transfer larger than the source's balance is refused with the "no tiene fondos suficientes" message under "Monto" and nothing is saved.
5. A transfer dated tomorrow is refused ("La fecha no puede ser posterior a hoy.") and a date before the opening month is refused for funds.
6. The 1,00 transfer saves, the drawer closes, the row appears (date, "Banco · Cuenta" both sides, amount, currency, notes) and the Banks tiles move by exactly 1,00 in opposite directions.
7. The summary's Ingresos, Gastos, Saldo previo, Actual and Objetivo are identical to the "before" numbers; the "Por cuenta" card shows the two accounts moved by 1,00 and its ARS total is unchanged; the Incomes and Expenses pages do not list the transfer.
8. Filters: search by an account or note text, the account filter (either side), the currency filter, "Limpiar filtros", the empty states ("No hay transferencias en este mes" / "Ninguna transferencia coincide con estos filtros"), the previous/next month.
9. Edit: changing only the notes saves; raising the amount above the source's balance is refused; the edit drawer shows the stored accounts.
10. An account that has the transfer: its drawer in Bancos locks the currency ("ya tiene movimientos") and archiving it is refused while its balance is not zero.
11. Narrow screen (resize to about 390px): the table scrolls horizontally, the drawer is full width, the filters wrap, no horizontal page scroll.
12. Delete: the trash of the row (the dialog names both accounts and says the destination has to still hold the money) and a bulk delete with two selected rows, both allowed because the destination still holds the amount; afterwards every Banks tile and every summary and "Por cuenta" number is back to the recorded "before" value.
    12b. Only if the user agrees to the extra writes (ask once): the refusal on delete. Create a temporary ARS account "Prueba" in Bancos, transfer 1,00 from one of your accounts into it, record a 1,00 expense on it, then try to delete the transfer: it is refused with "No se puede deshacer: … Prueba tiene $ 0,00 y tendría que devolver $ 1,00." shown in the dialog, which stays open and deletes nothing; also try lowering the transfer's amount in the edit drawer (refused under "Monto" with the same kind of message). Then delete the expense, delete the transfer (now allowed), and archive the temporary account, so everything ends where it started.
13. The browser console shows no errors during the pass.

Clean the `.playwright-mcp` scratch files by hand when done; leave the browser open.

- [ ] **Step 5: Handoff to the user**

Report: the final numbers (files, tests), the state of the migration (applied by the user), and that `next dev` was restarted at the gate. Mention the decisions in "Decisions taken" that the browser pass exercised, and the "Deferred (not in stage 3)" items below. Do NOT commit (the user commits only when asked); the snapshot is taken by the controller.

---

## Deferred (not in stage 3)

- Planners (installment and repayment) do not pass `errorMessage` to `AccountField`, so a server-side account refusal there shows only as the ticket's generic error (stage 2a ledger, Task 10). Unrelated to transfers.
- `getMonthlySummary`'s own copy of the settled-flow grouping (`toFlows`) is not unified with `readAccountBalances`: the summary deliberately does not read transfers (they cancel inside a currency), so only the `asOf` part of the shared reader was needed.
- Entry writes (incomes, expenses, templates, plans) still do not take the account row lock; a movement saved in the same instant as an archive or a transfer can still land (the balance then shows it, in red if negative). Documented in `assertUsableAccount` and `archiveAccount`.
- "Por cuenta" shows today's balances, not each account's balance at the end of the viewed month; a per-account "saldo previo" per month would need the per-account previous balance in the summary service.
- A transfer dated before the opening month is not counted by balances (the opening balance month moved past it), yet delete/edit still ask the destination to hold its amount; a future change may skip such transfers in the give-back claim.
- Pagination, column sorting and server-side search of the transfers table (a month is read whole, capped at 500).
- Scheduled/future transfers (a later stage; the spec lists them as out of scope too, and the user confirmed it): a transfer dated after today is refused, and there is no "planned" status for transfers.
- Everything in the spec's "Out of scope": cross-currency transfers, transfer fees, planned/future transfers, linking credit cards to a bank or account, per-account benefits/notes, importing statements.
- Minor review leftovers recorded in the stage 2a/2b ledgers (prettier churn in older files, test-fixture duplication, `tx === db` in the transaction mocks): not touched here.
