# Cards: Debit/Prepaid and Credit, Tied to Banks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A card is either CREDIT (cycle, limit mode, one cap per currency in a new `CardLimit` table) or DEBIT (covers prepaid: it spends from its bank's active account in the expense's currency), and every card belongs to a bank. A debit/prepaid card on a settled expense moves the money out of that account and is refused when the account would go below zero; credit cards keep their behaviour with the cap of the purchase's currency; the installment planner offers only credit cards.

**Architecture:** `core/cards` gets a discriminated `Card` union (`CreditCard | DebitCard`), a per-kind input parser (`parseCardInput`), pure helpers in `core/cards/kinds.ts` (`isCreditCard`, `limitIn`, `capIn`, `debitAccountIn`, `cardCurrencies`) and a service that reads every card with its caps, its bank's name and its bank's active accounts (one per currency) in one include (`WITH_CARD_DETAILS`). Usage and the recommender keep their pure shape: a credit card becomes one `CardCap` per currency (never added across currencies). The expense service resolves a debit card's account on the server (`debitAccountOf` in `core/expenses/debit.ts`), and when the expense is (or becomes) settled it runs the stage 3 funds pattern inside one `prisma.$transaction`: `lockAccount` (FOR NO KEY UPDATE) → `readAccountBalances` at the expense date and now, excluding the expense itself (new `excludeExpenseId` option) → refuse with `ExpenseInsufficientFundsError` → write. The Cards page gets Tipo/Banco columns, a per-currency caps list and a kind/bank-aware form; the expense form shows "Se descuenta de {Banco · Cuenta}" instead of the "Cuenta" selector for a debit card.

**Tech Stack:** Next.js 16.3.6 (App Router, server actions), React 19.2, TypeScript, Prisma 7 + Neon, zod 4, HeroUI v3 (`@heroui/react`), Tailwind 4, Vitest 4 + Testing Library (jsdom per file), Clerk.

**Spec:** docs/superpowers/specs/2026-10-07-cards-debit-credit-design.md (all sections; its two "Open items to settle in the plan" are settled in D5 and D7 below). Depends on stages 1, 2a, 2b and 3 being done and applied (they are: `20261007120000_transfers` is the latest migration).

## Decisions taken

The spec is silent or ambiguous on these; each one is the safest default. The user may veto any of them before or during the build.

- **D1 Ordering around the one destructive migration.** The spec mandates ONE migration that adds the new columns/table and drops `Card.currency` / `Card.limitAmount`. Applying it while the code still reads those columns breaks the running app (the Prisma client selects every scalar column, so even an empty `Card` table errors), and switching the code first breaks it the other way. So: Task 1 only WRITES the schema and the SQL and does NOT run `prisma generate` (the generated client, `tsc` and the running app stay on the old model); Task 2 runs `prisma generate` and switches every reader of `Card` in one task boundary; the controller GATE sits right after Task 2 (the user applies the migration and restarts `next dev`) and before any later task. Between Task 2 finishing and the gate the cards and expenses pages can error; nothing else is run in between.
- **D2 Constraints Prisma cannot express** (hand-written in the migration, like the Transfer CHECKs): `CardLimit.amount > 0`; and the shape of a card by kind: a CREDIT card has `closingDay`, `dueDay` and `limitMode` set, a DEBIT card has all three null. The day range stays the service's job, as today.
- **D3 Several active accounts of the same currency in one bank.** A debit card uses the OLDEST active account of that currency (the Banks board order: `createdAt` ascending). The form names it ("Se descuenta de …") before saving, so the user sees which one.
- **D4 Date of a debit expense.** There is no cycle: the typed date is the day the money leaves (`date`), `purchaseDate` stays null, and the form keeps calling the field "Fecha" with no charge line.
- **D5 (spec open item 1) Notes-only edit and account resolution.** An edit that keeps the expense's card AND currency keeps the account the money already left (`stored.accountId`, even if that account was archived since); the account is re-resolved only when the card or the currency changes. The funds check re-runs only when the edit asks something new of the account (the same rule as `needsFundsCheck` of transfers): the result is SETTLED and the stored expense was not SETTLED, or was on another account, on another date, or for a higher amount. A notes-only edit therefore reads no balance and can never fail for funds. This slightly narrows the spec sentence "changing its … amount … or date re-runs the resolution": the amount and the date re-run the CHECK, not the resolution (same result unless the bank's accounts changed, and then keeping the account the money left is the correct one).
- **D6 Funds check.** At the expense date AND now, the lower of the two, without the expense's own effect (`excludeExpenseId`), exactly like transfers (D4 of stage 3). A debit expense dated before the opening month began is refused for funds (balance 0 then, no balance is invented). The refusal reuses the existing message `insufficientFundsMessage` of `core/transfers/consts.ts` ("La cuenta de origen no tiene fondos suficientes: a esa fecha tenía {saldo}."), under "Monto" on the form, and as a plain message for the status checkbox.
- **D7 (spec open item 2) Recurring wizard.** No change: templates carry no card and the wizard creates card-less expenses (`core/expenses/recurringService.ts` never writes `cardId`). A debit expense saved with the recurring switch on creates a card-less template in the resolved account (a template is checked with `assertUsableAccount` without the archived exception, as today).
- **D8 Account field rules.** The expense schema requires `accountId` only when there is no card; the service requires it for a credit card (`ExpenseAccountRequiredError` under "Cuenta") and ignores any `accountId` sent with a debit card. `assertUsableAccount` still runs on the account a write ends up with (resolved or kept), so a new template can never point at an archived account.
- **D9 Marking paid from the table.** The checkbox refusal (insufficient funds) is shown as an error alert above the table; `useOptimisticStatus` gains a `refusal` (the optimistic flip already reverts by itself).
- **D10 Bank of a new card.** Must be the user's and active (`BankNotFoundError` / `BankArchivedError` under "Banco"). Kind and bank are immutable: the edit form shows them read-only and sends the stored values; the service refuses a change (`CardKindLockedError` / `CardBankLockedError`). A card keeps its bank if the bank is archived later.
- **D11 Caps.** At least one per credit card, no repeated currency, each amount > 0 in its currency's minor units (`checkAmount`), stored and shown in currency order. An edit replaces the card's caps in the same transaction as the card update.
- **D12 Cards table.** Columns: Acciones, Tarjeta, Tipo, Banco, Cierre, Vencimiento, Tope, Uso, Disponible. A credit card shows one line per currency in Tope / Uso / Disponible (a usage bar per currency, named "Uso de {tarjeta} en {moneda}"); a debit card shows its currencies in Tope ("ARS · USD", or "Sin cuentas activas") and "—" in Cierre, Vencimiento, Uso and Disponible.
- **D13 A new card starts as Crédito**, the bank preselected when the user has exactly one active bank. With no active bank the selector is disabled with "Todavía no tenés bancos activos. Creá uno en Bancos."
- **D14 Planner.** `InstallmentPlannerDrawer` filters credit cards before anything else sees them; the server refuses a debit card with `CardKindNotAllowedError` ("Elegí una tarjeta de crédito.", under "Tarjeta"). Until Task 4 lifts it, the expense service refuses a debit card with the same error (Task 2 interim, replaced in Task 4).
- **D15 The edit form keeps the expense's own card** even when its currency is no longer offered by the card (a debit card whose bank archived that account): `CardField` gains `keepCardId`, the mirror of `AccountField`'s `keepAccountId`, so an edit never drops the card silently.
- **D16 Delete.** Unchanged for both kinds: a card with PLANNED expenses cannot be deleted; otherwise its expenses and plans stay without a card.

## Global Constraints

- Copy language: all UI copy (labels, buttons, errors, empty states, hints) in Spanish es-AR, neutral/professional, voseo as in Cards/Roadmap/Banks ("Dejala en cero", "Reactivala"). Code, identifiers, comments and tests in English. Route slugs stay English (`/dashboard/cards`).
- Component layout is enforced by `components/componentStructure.test.ts` (scans `components/` and `app/`, `.tsx` files that are not tests): no `type`/`interface`/`enum` declarations in a component file, no `const`/helper function at column 0 (only the component itself), exactly one component per file, no props typed inline (`}: {`), no inline `className="..."` of 40+ characters (move it to `styles.ts`), a sub-component is never a bare file under a nested `components/` folder (it gets its own folder `Name/Name.tsx` plus `index.ts`). Types go in `types.ts`, constants in `consts.ts`, styles in `styles.ts`, helpers in `utils.ts`, hooks in `useX.ts`.
- Strict TDD with Vitest: every behaviour gets a failing test first; run it and see it fail for the stated reason before writing the implementation (RED), then see it pass (GREEN). Component tests start with `// @vitest-environment jsdom`. Unit tests never need the database: services are tested against the Prisma mock (`vi.mock("@/infrastructure/db/client", …)`), exactly like `core/accounts/service.test.ts`.
- Tests that cannot fail are defects: every negative assertion (`not.toHaveBeenCalled`, `toBeNull`, `queryBy… not in the document`) has a positive twin in the same `describe` that proves the thing does happen in the other case; never a loop that asserts nothing when its list is empty (assert the length first); BigInt literals (`5000n`) do not compile (target ES2017): always `BigInt(5000)`; never index a typed mock tuple beyond its length; a HeroUI `Select` trigger's accessible name is "<value or placeholder> <label>", so query it with a regex that ends in the label (`/Banco$/`).
- Money convention: minor units, `BigInt` in the database, `number` in the app (`minorUnitsToNumber` at the boundary); money is formatted on the server with `formatMoney(minorUnits, currency)` (es-AR), the client only places text. Amounts in different currencies are never added (a credit card's caps are never summed).
- Balance rule (binding, from stage 2/3): `balance(account, date) = opening (if the opening month has started) + settled incomes − settled expenses − transfers out + transfers in`. `PLANNED` and `COVERED` entries never move money. A debit card adds no new kind of flow: its expense is an ordinary expense in the resolved account.
- Cards (binding, from the spec): one `Card` table with `kind` (CREDIT or DEBIT; DEBIT covers prepaid); every card belongs to a bank (`bankId`, required, `Restrict`); a debit/prepaid card stores no currencies (they are those of its bank's active accounts) and uses the bank's ACTIVE account in the expense's currency (no per-account selection); a credit card has one cap per currency in `CardLimit` and ONE limit mode; kind and bank cannot change after creation; the credit cap stays a warning, never a block; the installment planner offers only credit cards.
- Debit funds (binding, from the spec): "an expense with a debit/prepaid card is refused when its account would go below zero … The check runs only when the expense is SETTLED (paid) or becomes paid; planned and covered expenses move no money and are not checked until then." Moving an expense away from a debit card, or deleting it, takes no check (the account only gains).
- Errors (binding, from the spec): domain errors in Spanish, shown as field errors where they belong: the card's bank without an active account in the currency ("El banco de esta tarjeta no tiene una cuenta activa en {moneda}. Creá una en Bancos.", under "Tarjeta"); insufficient funds (existing message, under "Monto"); kind or bank change attempted; a credit card without at least one cap; a debit card with credit-only fields; a card of another user or another currency behaves as not found. Services stay scoped by `userId`.
- Out of scope (binding, from the spec): credit-card statements and payments of the statement, linking a credit card to the account that pays it, interest and fees, per-account card selection, virtual/extra cards, showing cards on the Bancos board, a hard block on the credit limit, converting between currencies, importing statements.
- Every record is scoped by the Clerk `userId` that comes from the session (`runAuthenticated`), never from client input; another user's card, bank or expense id behaves as not found and nothing is written. Server actions export only async functions and refuse a missing or non-text id BEFORE calling the service (an `undefined` id makes Prisma drop it from a `where`).
- Colors: never blue buttons; only theme tokens (`text-muted`, `text-danger`, `bg-surface-secondary`, `ring-border`, …). Async buttons use `PendingButton` (guard `components/shared/PendingButton/pendingButtonUsage.test.ts`).
- Next.js (this repo runs 16.3.6, see AGENTS.md: it differs from what you remember): pages are async Server Components that call `requireUserId()` (guard `lib/auth/routeProtection.test.ts`); `"use server"` files export only async functions; `revalidatePath` only after a successful write. Before touching the page loader or the actions, read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` and `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`. "Today" is Argentine time: `todayIso()` from `core/incomes/dates.ts`.
- HeroUI v3 differs from what you remember (AGENTS.md: "STOP. What you remember about HeroUI React v3 is WRONG for this project"). Every UI task starts by reading the HeroUI docs it uses under `C:\Users\Nico\Desktop\insight-in\.heroui-docs\react\components\` (named in each task) and then copies the markup of the components that already work in this repo (named in each task). If `.heroui-docs` is missing, run `heroui agents-md --react --output AGENTS.md` first.
- Row locks: `SELECT … FOR NO KEY UPDATE` through `lockAccount(tx, userId, accountId)` of `core/accounts/locks.ts`, inside `prisma.$transaction(async (tx) => …)`; ids and userId travel as parameters; inside one interactive transaction the queries run one after another (no `Promise.all` on `tx`). The balance is read AFTER the lock, and the write happens in the same transaction.
- Database: the dev database holds the user's REAL data. The migration is additive except for the two dropped columns of `Card`, which has 0 rows (the controller re-checks it, read-only, right before asking the user to apply it). Migrations are written by hand into `prisma/migrations/<timestamp>_<name>/migration.sql`. The implementer runs `npx prisma validate`, `npx prisma format` and (Task 2 only) `npx prisma generate`, and nothing else against Prisma: NEVER `prisma migrate dev|deploy|reset|resolve`, `prisma db push`, `prisma db execute` or any command that opens a database connection. Applying the migration is the USER's action (`npx prisma migrate deploy`), requested by the controller at the gate after Task 2. No test may need the database.
- Do not start, stop or restart `next dev`, and do not close the Playwright browser. No git commit/add/stash steps anywhere: the user commits only when asked; the snapshot is taken by the controller.
- Every task ends with a verify step that runs, in this order: that task's tests, `npx vitest run` (the whole suite), `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, and `npx prettier --check --end-of-line auto <the files the task created or changed>` (never `npm run format`: it rewrites the whole repo; some files are CRLF, hence `--end-of-line auto`). If the check fails, format exactly those files with `npx prettier --write --end-of-line auto <files>` and re-run the check. A task boundary is only reached with all of them green.

## Review Focus

The inputs and conditions the spec implies but no obvious test exercises, the ones most likely to bite a person using this, most likely first. Each one is pinned by a test in the task named at the end of the line.

1. **Paying with a debit card the account cannot cover**: a settled debit expense larger than the account's balance (at its date or now) is refused under "Monto" and nothing is written, while a PLANNED or COVERED one with the same card and amount is saved without reading any balance, and the same expense is refused when it is later ticked as paid from the table (the checkbox flips back and the alert says why). Pinned in Task 4 (`needsDebitFundsCheck`; service create/planned/covered/status; action maps the refusal under `amount` and as a plain message for the status) and Task 5 (the alert above the table, with its positive twin).
2. **An edit must not count against itself, and a notes-only edit must never fail**: raising the amount of a settled debit expense on an account that holds exactly the old amount plus the difference works (the balance excludes the expense: `excludeExpenseId`), and editing only the notes of a settled debit expense whose account has since been emptied (or archived) saves without reading balances. Pinned in Task 4 (`readAccountBalances` `excludeExpenseId`; `needsDebitFundsCheck` and `debitAccountOf` keep-rules; service update tests "notes only reads no balance" and "raise counts without itself").
3. **Two debit expenses at once on the same account**: the account row is locked (`lockAccount`, FOR NO KEY UPDATE) BEFORE its balance is read, and the write happens inside the same transaction, so the second waits and sees the first. Pinned in Task 4 (call-order test: lock → read on date → read now → create, all on the transaction client).
4. **Caps per currency**: a credit card with an ARS and a USD cap is offered for an ARS and a USD expense but not a EUR one; changing the expense's currency to one the card has no cap in clears the card; the recommender uses the cap of the purchase's currency (never a sum of caps) and the planner never lists a debit card. Pinned in Task 2 (`cardCurrencies`, `capIn`, `recommendCards` multi-currency and debit tests, `CardField` by `currencies`, planner drawer test with a debit card present) and Task 5 (form clears the card on a currency change).
5. **A bank without the account**: a debit card is offered only in the currencies of its bank's ACTIVE accounts; an expense whose resolved account does not exist (bank has none in that currency, or it was archived between the read and the lock) is refused with the Bancos message under "Tarjeta"; when a bank has two active accounts in one currency the oldest is used and named on the form. Pinned in Task 2 (service `toCard` keeps one account per currency, archived ones excluded by the query) and Task 4 (`debitAccountOf`, lock re-check) and Task 5 (form line names the account; the expense's own card is kept on edit, D15).

## Execution notes for the controller

- Work in place on branch `develop`, no worktree (node_modules, `.env.local`, the generated Prisma client and the user's running `next dev` live in this directory), no commits.
- Before Task 1, record that `Card` is empty with the read-only count of the clear-data tool (it deletes nothing): `npm run db:clear -- --dry-run` (look at the `Card` line; it must be 0). If it is not 0, STOP and ask the user: the migration drops two columns.
- Task 1 is runtime-neutral (no `prisma generate`). Task 2 generates the client and switches every reader of `Card`. **GATE right after Task 2**, before dispatching Task 3:
  1. Re-check, read-only, that `Card` is still empty. `npm run db:clear -- --dry-run` cannot be used any more (its table list now includes `CardLimit`, which does not exist yet), so run this one-liner from the repo root (it only SELECTs):
     `node --input-type=module -e "import { neonConfig, Pool } from '@neondatabase/serverless'; import dotenv from 'dotenv'; import ws from 'ws'; dotenv.config({ path: '.env.local', quiet: true }); dotenv.config({ path: '.env', quiet: true }); neonConfig.webSocketConstructor = ws; const pool = new Pool({ connectionString: process.env.DATABASE_URL }); const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM \"Card\"'); console.log('Card rows:', rows[0].count); await pool.end();"`
     Expected: `Card rows: 0`. Otherwise STOP and ask the user.
  2. Ask the user (one message, one question): "Apply the migration `20261007180000_card_kinds_and_limits` with `npx prisma migrate deploy` (it creates `CardKind` and `CardLimit`, adds `kind`/`bankId` to `Card` and drops `Card.currency`/`Card.limitAmount`; `Card` has 0 rows) and restart `next dev` (it caches the Prisma client on `globalThis`)." Do not apply it yourself. `npx prisma migrate status` (read-only) may be used to confirm it afterwards.
- Between Task 2 and Task 3 the card form still sends the old fields and cannot save (Task 3 rewrites it); the table and every other page work. Tell the user if they ask; they have no cards.
- Unit tests of every task mock the database; browser verification happens only in Task 6, after the gate.

---

### Task 1: The schema and the hand-written migration (no client generation)

**Files:**

- Modify: `prisma/schema.prisma` (enum `CardKind`, model `Card`, new model `CardLimit`, relation field `cards` on `Bank`)
- Create: `prisma/migrations/20261007180000_card_kinds_and_limits/migration.sql`
- Modify: `prisma/schema.test.ts`
- Modify: `scripts/clearData/tables.ts`
- Modify: `scripts/clearData/tables.test.ts`

**Interfaces:**

- Consumes: the existing `Card`, `Bank`, `CardBrand`, `CardLimitMode` of `prisma/schema.prisma`; `CLEAR_ORDER`, `buildDeleteQuery`, `buildCountQuery` of `scripts/clearData/tables.ts`.
- Produces: `schema.prisma` with `enum CardKind { CREDIT DEBIT }`, `Card.kind`, `Card.bankId`/`Card.bank` (`Restrict`), optional `closingDay`/`dueDay`/`limitMode`, `Card.limits CardLimit[]`, no `currency`/`limitAmount`; `model CardLimit { id cardId card currency amount @@unique([cardId, currency]) }` (`Cascade`); `Bank.cards Card[]`. `CLEAR_ORDER` with `"CardLimit"` right before `"Card"`, scoped through its card for `--user`. The generated client is NOT regenerated here (D1): Task 2 does it.

- [ ] **Step 1: Record the baseline**

Run: `npx vitest run` then `npx tsc --noEmit` then `npm run lint`.
Expected: all green. Write down the numbers of test files and tests (Task 6 compares against them).

- [ ] **Step 2: Write the failing schema, migration and clear-data tests**

Append to `prisma/schema.test.ts` (it already has `SCHEMA`, `modelBlock`, `withoutComments`, `readFileSync` and `join`):

```ts
const enumBlock = (name: string): string => {
  const match = SCHEMA.match(
    new RegExp(`^enum ${name} \\{([\\s\\S]*?)^\\}`, "m"),
  );

  if (!match) {
    throw new Error(`enum ${name} is not in schema.prisma`);
  }

  return match[1];
};

describe("enum CardKind", () => {
  it("has exactly the two kinds: credit, and debit (which covers prepaid)", () => {
    expect(
      withoutComments(enumBlock("CardKind")).split(/\s+/).filter(Boolean),
    ).toEqual(["CREDIT", "DEBIT"]);
  });
});

describe("model Card", () => {
  const card = withoutComments(modelBlock("Card"));

  it("has a kind", () => {
    expect(card).toMatch(/kind\s+CardKind\s/);
  });

  it("belongs to a bank that cannot be deleted under it", () => {
    expect(card).toMatch(/bankId\s+String\s/);
    expect(card).toMatch(
      /bank\s+Bank\s+@relation\(fields: \[bankId\], references: \[id\], onDelete: Restrict\)/,
    );
    expect(card).toContain("@@index([bankId])");
  });

  it("keeps the cycle and the limit mode optional: only a credit card has them", () => {
    expect(card).toMatch(/closingDay\s+Int\?/);
    expect(card).toMatch(/dueDay\s+Int\?/);
    expect(card).toMatch(/limitMode\s+CardLimitMode\?/);
  });

  it("has no currency nor cap of its own: the caps are per currency, in CardLimit", () => {
    expect(card).not.toMatch(/\bcurrency\b/);
    expect(card).not.toMatch(/\blimitAmount\b/);
    expect(card).toMatch(/limits\s+CardLimit\[\]/);
  });

  it("keeps one card per brand and last four digits of a user, and its plans and expenses", () => {
    expect(card).toContain("@@unique([userId, last4, brand])");
    expect(card).toMatch(/plans\s+InstallmentPlan\[\]/);
    expect(card).toMatch(/expenses\s+Expense\[\]/);
  });
});

describe("model CardLimit", () => {
  const limit = withoutComments(modelBlock("CardLimit"));

  it("belongs to a card and goes away with it", () => {
    expect(limit).toMatch(
      /card\s+Card\s+@relation\(fields: \[cardId\], references: \[id\], onDelete: Cascade\)/,
    );
  });

  it("is an amount in minor units of one currency, once per currency of a card", () => {
    expect(limit).toMatch(/currency\s+String/);
    expect(limit).toMatch(/amount\s+BigInt/);
    expect(limit).toContain("@@unique([cardId, currency])");
  });
});

describe("model Bank and its cards", () => {
  it("lists the cards that belong to it", () => {
    expect(withoutComments(modelBlock("Bank"))).toMatch(/cards\s+Card\[\]/);
  });
});

describe("the card kinds and limits migration", () => {
  const MIGRATION = readFileSync(
    join(
      __dirname,
      "migrations",
      "20261007180000_card_kinds_and_limits",
      "migration.sql",
    ),
    "utf8",
  );

  it("drops exactly the two columns that moved to CardLimit, and nothing else", () => {
    const dropped = [...MIGRATION.matchAll(/DROP COLUMN "(\w+)"/g)].map(
      (match) => match[1],
    );

    expect(dropped).toEqual(["currency", "limitAmount"]);
    expect(MIGRATION).not.toMatch(/DROP\s+(TABLE|TYPE|INDEX|CONSTRAINT)/i);
    expect(MIGRATION).not.toMatch(/\b(TRUNCATE|RENAME)\b/i);
    expect(MIGRATION).not.toMatch(/^\s*(UPDATE|DELETE|INSERT)\b/im);
  });

  it("alters only the card and its new caps table", () => {
    const altered = [...MIGRATION.matchAll(/ALTER TABLE "(\w+)"/g)].map(
      (match) => match[1],
    );

    expect(altered.length).toBeGreaterThan(0);
    expect(new Set(altered)).toEqual(new Set(["Card", "CardLimit"]));
  });

  it("restricts the bank and cascades the caps", () => {
    expect(MIGRATION).toMatch(
      /"Card_bankId_fkey" FOREIGN KEY \("bankId"\) REFERENCES "Bank"\("id"\) ON DELETE RESTRICT/,
    );
    expect(MIGRATION).toMatch(
      /"CardLimit_cardId_fkey" FOREIGN KEY \("cardId"\) REFERENCES "Card"\("id"\) ON DELETE CASCADE/,
    );
  });

  it("checks what Prisma cannot express: a positive cap and the fields of each kind", () => {
    expect(MIGRATION).toContain('CHECK ("amount" > 0)');
    expect(MIGRATION).toContain(
      `("kind" = 'CREDIT' AND "closingDay" IS NOT NULL AND "dueDay" IS NOT NULL AND "limitMode" IS NOT NULL)`,
    );
    expect(MIGRATION).toContain(
      `("kind" = 'DEBIT' AND "closingDay" IS NULL AND "dueDay" IS NULL AND "limitMode" IS NULL)`,
    );
  });
});
```

In `scripts/clearData/tables.test.ts`, change `Card: [],` to `Card: ["Bank"],` and add, right after it:

```ts
  CardLimit: ["Card"],
```

and append inside `describe("buildDeleteQuery", …)`:

```ts
it("scopes the caps of a card through the card, which owns the userId", () => {
  expect(buildDeleteQuery("CardLimit", "user_1")).toEqual({
    text: 'DELETE FROM "CardLimit" WHERE "cardId" IN (SELECT "id" FROM "Card" WHERE "userId" = $1)',
    values: ["user_1"],
  });
  expect(buildDeleteQuery("CardLimit", null)).toEqual({
    text: 'DELETE FROM "CardLimit"',
    values: [],
  });
});
```

and inside `describe("buildCountQuery", …)`:

```ts
it("scopes the caps of a card through the card", () => {
  expect(buildCountQuery("CardLimit", "user_1").text).toContain(
    'IN (SELECT "id" FROM "Card" WHERE "userId" = $1)',
  );
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run prisma/schema.test.ts scripts/clearData/tables.test.ts`
Expected: FAIL (`enum CardKind is not in schema.prisma`, `model CardLimit is not in schema.prisma`, the migration file does not exist, `CLEAR_ORDER` lacks `CardLimit`, and `"CardLimit"` is not a `ClearTable`).

- [ ] **Step 4: Write the schema**

In `prisma/schema.prisma`, right after `enum CardLimitMode { … }`, add:

```prisma
// CREDIT: bought now and paid with the statement, bounded by a cap per currency the user chooses.
// DEBIT (prepaid cards too): spends money that is already in an account of its bank.
enum CardKind {
  CREDIT
  DEBIT
}
```

Replace the whole `model Card { … }` (and the comment above it) with:

```prisma
// A card, only as a reference: no sensitive data is stored, just the last 4 digits and the brand
// (illustrative). Every card belongs to a bank. A credit card also has the day its statement closes,
// the day it is paid, one limit mode and one cap per currency (CardLimit); a debit card has none of
// them (a CHECK constraint of the migration enforces both shapes) and spends from the bank's active
// account in the currency of the purchase.
model Card {
  id         String            @id @default(cuid())
  // Clerk user id — cards are private to their owner.
  userId     String
  kind       CardKind
  bankId     String
  bank       Bank              @relation(fields: [bankId], references: [id], onDelete: Restrict)
  // Exactly 4 digits.
  last4      String
  brand      CardBrand
  // Credit only. 1..31: the day the statement closes; a shorter month uses its last day.
  closingDay Int?
  // Credit only. 1..31: the day the statement is paid; a shorter month uses its last day.
  dueDay     Int?
  // Credit only.
  limitMode  CardLimitMode?
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt
  limits     CardLimit[]
  plans      InstallmentPlan[]
  expenses   Expense[]

  @@unique([userId, last4, brand])
  @@index([userId])
  @@index([bankId])
}

// The cap of a credit card in one currency: the most the user wants to respect (the real limit or
// something lower). Caps in different currencies are never added together.
model CardLimit {
  id       String @id @default(cuid())
  cardId   String
  card     Card   @relation(fields: [cardId], references: [id], onDelete: Cascade)
  // ISO 4217 code.
  currency String
  // Minor units of `currency`. Always positive (a CHECK constraint of the migration enforces it).
  amount   BigInt

  @@unique([cardId, currency])
}
```

In `model Bank`, after `accounts   Account[]`, add (keep the file's alignment):

```prisma
  // The cards issued by the bank. The foreign key restricts, so a bank with cards is never deleted.
  cards      Card[]
```

- [ ] **Step 5: Write the migration**

Create `prisma/migrations/20261007180000_card_kinds_and_limits/migration.sql`:

```sql
-- Cards of two kinds, tied to a bank, with one cap per currency. The "Card" table has no rows (the
-- controller re-checks it right before the user applies this), so the two dropped columns lose
-- nothing and the new NOT NULL columns need no default. Everything else is additive.

-- CreateEnum
CREATE TYPE "CardKind" AS ENUM ('CREDIT', 'DEBIT');

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "currency",
DROP COLUMN "limitAmount",
ADD COLUMN     "kind" "CardKind" NOT NULL,
ADD COLUMN     "bankId" TEXT NOT NULL,
ALTER COLUMN "closingDay" DROP NOT NULL,
ALTER COLUMN "dueDay" DROP NOT NULL,
ALTER COLUMN "limitMode" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CardLimit" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "CardLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Card_bankId_idx" ON "Card"("bankId");

-- CreateIndex
CREATE UNIQUE INDEX "CardLimit_cardId_currency_key" ON "CardLimit"("cardId", "currency");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardLimit" ADD CONSTRAINT "CardLimit_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A cap is a positive amount, and each kind of card has exactly its own fields. Prisma cannot express
-- these, so they are written by hand (both tables are empty, so they already comply).
ALTER TABLE "CardLimit" ADD CONSTRAINT "CardLimit_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "Card" ADD CONSTRAINT "Card_kind_fields_check" CHECK (
    ("kind" = 'CREDIT' AND "closingDay" IS NOT NULL AND "dueDay" IS NOT NULL AND "limitMode" IS NOT NULL)
    OR ("kind" = 'DEBIT' AND "closingDay" IS NULL AND "dueDay" IS NULL AND "limitMode" IS NULL)
);
```

- [ ] **Step 6: Teach the clear-data tool the new table**

In `scripts/clearData/tables.ts`, replace the header lines

```ts
 *   Expense / Income -> categories (Restrict), templates and plans (SetNull), Card (SetNull)
 *   InstallmentPlan -> categories (Restrict), Card (SetNull)
```

with

```ts
 *   Expense / Income -> categories (Restrict), templates and plans (SetNull), Card (SetNull)
 *   InstallmentPlan -> categories (Restrict), Card (SetNull)
 *   CardLimit -> Card (Cascade); Card -> Bank (Restrict), so cards go before the banks
```

in `CLEAR_ORDER`, replace `"Card",` with

```ts
  "CardLimit",
  "Card",
```

and replace `whereClause` with:

```ts
// A decision has no userId of its own: it belongs to whoever owns its template; a cap belongs to
// whoever owns its card.
function whereClause(table: ClearTable, userId: string | null): string {
  if (userId === null) return "";
  if (table === "RecurringExpenseDecision") {
    return ' WHERE "recurringExpenseId" IN (SELECT "id" FROM "RecurringExpense" WHERE "userId" = $1)';
  }
  if (table === "CardLimit") {
    return ' WHERE "cardId" IN (SELECT "id" FROM "Card" WHERE "userId" = $1)';
  }
  return ' WHERE "userId" = $1';
}
```

- [ ] **Step 7: Validate the schema (no client generation, no database)**

Run: `npx prisma validate`.
Expected: "The schema … is valid". If it fails only because `DATABASE_URL` is missing, run `npx prisma format` instead (it only rewrites whitespace in `schema.prisma`) and check that it succeeds. If `npx prisma format` realigns the models, keep its output. Do NOT run `npx prisma generate` in this task (D1): the generated client must stay on the old model until Task 2.

- [ ] **Step 8: Run the task's tests to see them pass**

Run: `npx vitest run prisma/schema.test.ts scripts/clearData`
Expected: PASS.

- [ ] **Step 9: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto prisma/schema.test.ts scripts/clearData/tables.ts scripts/clearData/tables.test.ts`.
Expected: all green (tsc and the app are unchanged: the generated client is still the old one).

- [ ] **Step 10: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 2: Cards on the new model (client, card core, every reader of `Card`, the Cards table)

This is the one task boundary where the generated client and every piece of code that reads `Card` switch together (D1). It is long but mechanical outside `core/cards`; follow the steps in order and run the listed tests after each part.

**Files:**

- Run: `npx prisma generate`
- Modify: `core/cards/consts.ts`, `core/cards/types.ts`, `core/cards/errors.ts`, `core/cards/usage.ts`, `core/cards/recommend.ts`, `core/cards/service.ts`, `core/cards/actions.ts`
- Rewrite: `core/cards/schema.ts`
- Create: `core/cards/kinds.ts`, `core/cards/formLimits.ts`, `core/cards/testFixtures.ts`
- Tests (rewrite): `core/cards/schema.test.ts`, `core/cards/service.test.ts`, `core/cards/actions.test.ts`; (create) `core/cards/kinds.test.ts`, `core/cards/formLimits.test.ts`; (modify) `core/cards/recommend.test.ts` (`core/cards/usage.test.ts` is unchanged: `CardCap` keeps the shape it builds)
- Modify: `core/entries/actionHelpers.ts`, `core/entries/actionHelpers.test.ts`
- Modify: `core/expenses/service.ts`, `core/expenses/service.test.ts`
- Modify: `core/installments/service.ts`, `core/installments/service.test.ts`
- Modify: `components/Entries/components/CardField/types.ts`, `CardField.tsx`, `CardField.test.tsx`
- Modify: `components/Expenses/types.ts`, `components/Expenses/utils.ts`; Create: `components/Expenses/testCards.ts`
- Modify: `components/Expenses/components/ExpenseFormDrawer/utils.ts`, `ExpenseFormContent.tsx`, `ExpenseFormDrawer.test.tsx`, `ExpenseFormDrawer.origin.test.tsx`
- Modify: `components/Expenses/components/InstallmentPlannerDrawer/types.ts`, `utils.ts`, `InstallmentPlannerDrawer.tsx`, `utils.test.ts`, `InstallmentPlannerDrawer.test.tsx`
- Modify: `components/Cards/types.ts`, `components/Cards/consts.ts`, `components/Cards/utils.ts`; Create: `components/Cards/testRows.ts`
- Modify: `components/Cards/components/CardsTable/CardsTable.tsx`, `consts.ts`, `styles.ts`; `components/Cards/components/CardsTable/components/UsageCell/UsageCell.tsx`, `types.ts`, `consts.ts`
- Create: `components/Cards/components/CardsTable/components/CellLines/CellLines.tsx`, `index.ts`, `types.ts`, `styles.ts`
- Modify: `components/Cards/components/CardFormDrawer/CardFormContent.tsx` (two interim lines; Task 3 rewrites the form)
- Tests (rewrite): `components/Cards/utils.test.ts`, `components/Cards/components/CardsTable/CardsTable.test.tsx`; (fixture swaps) `components/Cards/Cards.test.tsx`, `components/Cards/Cards.bulkDelete.test.tsx`, `components/Cards/components/CardsTable/CardsTable.selection.test.tsx`, `components/Cards/components/DeleteCardDialog/DeleteCardDialog.test.tsx`, `components/Cards/components/CardFormDrawer/CardFormDrawer.test.tsx`, `components/Help/markerAudit.test.tsx`, `app/dashboard/cards/loadCardsView.test.ts`, `app/dashboard/expenses/loadExpensesView.test.ts`

Every test or fixture that builds a `Card` with `currency`/`limitAmount` (from `rg -l "limitAmount|limitMode|closingDay"` over the repo) is in this list. `core/expenses/pageData.test.ts` also has such a literal (`const CARD = { … currency, limitAmount … }`) but it is untyped and only forwarded through a mock, so it keeps passing and is left alone; `core/cards/cycle.test.ts` and `core/cards/usage.test.ts` only use days and `{ currency, limitMode, limitAmount }` caps, which `CardCap` keeps.

**Interfaces:**

- Consumes: the schema of Task 1; `accountLabel` (`@/core/accounts/label`); `BankNotFoundError`, `BankArchivedError` (`@/core/banks/errors`); `checkAmount`, `currencyField`, `toAmount` (`@/core/entries/fields`); `readForm`, `fieldFailure`, `failure`, `runAuthenticated` (`@/core/entries/actionHelpers`); `firstInstallmentDate` (`@/core/cards/cycle`); `isUniqueConstraintError` (`@/core/entries/dbErrors`); `minorUnitsToNumber`, `formatMoney`, `toDecimalString` (`@/core/incomes/money`).
- Produces (later tasks rely on these exact names):
  - `core/cards/types.ts`: `CardKind`, `CardBrand`, `CardLimitMode`, `CardLimit { currency: string; amount: number }`, `CreditCardInput`, `DebitCardInput`, `CardInput = CreditCardInput | DebitCardInput`, `DebitAccount { id: string; currency: string; label: string }`, `CreditCard`, `DebitCard` (with `accounts: DebitAccount[]`), `Card = CreditCard | DebitCard`, `CardCap { currency: string; limitMode: CardLimitMode; limitAmount: number }`, `CardLimitUsage extends CardLimit, CardUsage`, `CardWithUsage = Card & { usage: CardLimitUsage[] }`, `CardWithCharges = Card & { charges: CardCharge[] }`, `CreditCardWithCharges = Extract<CardWithCharges, { kind: "CREDIT" }>`, plus the unchanged `CardCharge`, `CardUsage`, `CardTier`, `PurchaseProjection`, `CardFit`, `PurchaseDraft`, `CardVerdict`, `CardRecommendation`, `CardFieldErrors`, `CardActionResult`, `CardsDeleteResult`.
  - `core/cards/consts.ts`: `CARD_KINDS`, `KIND_NAMES`, `CARD_FORM_FIELDS` (single-value fields), `LIMIT_CURRENCY_FIELD = "limitCurrency"`, `LIMIT_AMOUNT_FIELD = "limitAmount"`, `DEFAULT_CARD_KIND`, and the messages `CARD_KIND_REQUIRED_MESSAGE`, `CARD_BANK_REQUIRED_MESSAGE`, `LIMITS_REQUIRED_MESSAGE`, `DUPLICATE_LIMIT_CURRENCY_MESSAGE`, `DEBIT_CREDIT_FIELDS_MESSAGE`, `CARD_KIND_LOCKED_MESSAGE`, `CARD_BANK_LOCKED_MESSAGE`, `CARD_BANK_NOT_FOUND_MESSAGE`, `CARD_BANK_ARCHIVED_MESSAGE`, `CARD_KIND_NOT_ALLOWED_MESSAGE`.
  - `core/cards/errors.ts`: adds `CardKindLockedError`, `CardBankLockedError`, `CardKindNotAllowedError`.
  - `core/cards/kinds.ts`: `isCreditCard<C extends { kind: CardKind }>(card: C): card is Extract<C, { kind: "CREDIT" }>`, `isDebitCard` (same shape), `limitIn(card: Pick<CreditCard, "limits">, currency: string): CardLimit | null`, `capIn(card: Pick<CreditCard, "limits" | "limitMode">, currency: string): CardCap | null`, `debitAccountIn(card: Pick<DebitCard, "accounts">, currency: string): DebitAccount | null`, `cardCurrencies(card: Card): string[]`.
  - `core/cards/schema.ts`: `parseCardInput(values: Record<string, unknown>): CardParseResult` (`{ success: true; data: CardInput } | { success: false; fieldErrors: CardFieldErrors }`), `toCardFieldErrors(error: z.ZodError): CardFieldErrors` (path joined with "."; a cap row's error is `limits.<index>.amount` / `limits.<index>.currency`).
  - `core/cards/formLimits.ts`: `readLimitRows(formData: FormData): { currency: string; amount: string }[]`.
  - `core/cards/service.ts`: `WITH_CARD_DETAILS` (the include), `listCards(userId, month?) : Promise<CardWithUsage[]>`, `listCardsWithCharges(userId): Promise<CardWithCharges[]>`, `findOwnedCard(userId, cardId): Promise<Card>`, `createCard(userId, input: CardInput): Promise<Card>`, `updateCard(userId, id, input: CardInput): Promise<void>`, `deleteCard`, `deleteCards` (unchanged).
  - `core/cards/testFixtures.ts` (test support): `creditCard(patch?: CreditCardPatch): CreditCard`, `debitCard(patch?: Partial<DebitCard>): DebitCard`, `creditCardRecord(patch?)`, `debitCardRecord(patch?)` (database rows with `WITH_CARD_DETAILS`), `type CreditCardPatch = Partial<CreditCard> & { currency?: string; limitAmount?: number }`.
  - `components/Expenses/types.ts`: `CardOption = CardWithCharges & { title: string; currencies: string[] }`, `CreditCardOption = Extract<CardOption, { kind: "CREDIT" }>`; `components/Expenses/testCards.ts`: `creditOption(patch?)`, `debitOption(patch?)`.
  - `components/Entries/components/CardField`: `CardChoice { id: string; title: string; currencies: readonly string[] }`.
  - `components/Cards/types.ts`: `CardLimitRow`, `CardRow` (see Step 14); `components/Cards/testRows.ts`: `limitRow(patch?)`, `creditCardRow(patch?)`, `debitCardRow(patch?)`.

#### Part A — the card language (pure)

- [ ] **Step 1: Generate the client for the new schema**

Run: `npx prisma generate`.
Expected: success; `lib/generated/prisma` now has `CardKind`, `CardLimit` and the new `Card`. From here `npx tsc --noEmit` reports the readers of the old columns; the steps below fix all of them. (No database access; never `migrate`.)

- [ ] **Step 2: Write the failing tests of the pure card language**

Create `core/cards/kinds.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  capIn,
  cardCurrencies,
  debitAccountIn,
  isCreditCard,
  isDebitCard,
  limitIn,
} from "./kinds";
import { creditCard, debitCard } from "./testFixtures";

const BOTH = creditCard({
  limits: [
    { currency: "ARS", amount: 30000000 },
    { currency: "USD", amount: 100000 },
  ],
});
const ASTROPAY = debitCard({
  bankName: "AstroPay",
  accounts: [
    { id: "acc_ars", currency: "ARS", label: "AstroPay · Pesos" },
    { id: "acc_usd", currency: "USD", label: "AstroPay · Dólares" },
  ],
});

describe("isCreditCard / isDebitCard", () => {
  it("tells the kinds apart", () => {
    const cards = [BOTH, ASTROPAY];

    expect(cards.filter(isCreditCard).map(({ id }) => id)).toEqual(["card_1"]);
    expect(cards.filter(isDebitCard).map(({ id }) => id)).toEqual(["card_9"]);
  });
});

describe("limitIn and capIn", () => {
  it("find the cap of the currency asked for, never another one", () => {
    expect(limitIn(BOTH, "USD")).toEqual({ currency: "USD", amount: 100000 });
    expect(capIn(BOTH, "USD")).toEqual({
      currency: "USD",
      limitMode: "MONTHLY",
      limitAmount: 100000,
    });
  });

  it("find nothing for a currency the card has no cap in", () => {
    expect(limitIn(BOTH, "EUR")).toBeNull();
    expect(capIn(BOTH, "EUR")).toBeNull();
  });
});

describe("debitAccountIn", () => {
  it("is the account of the bank in that currency", () => {
    expect(debitAccountIn(ASTROPAY, "USD")).toEqual({
      id: "acc_usd",
      currency: "USD",
      label: "AstroPay · Dólares",
    });
  });

  it("is nothing when the bank has no active account in it", () => {
    expect(debitAccountIn(ASTROPAY, "EUR")).toBeNull();
  });
});

describe("cardCurrencies", () => {
  it("is the currencies of a credit card's caps", () => {
    expect(cardCurrencies(BOTH)).toEqual(["ARS", "USD"]);
  });

  it("is the currencies of a debit card's accounts, and none when its bank has no active account", () => {
    expect(cardCurrencies(ASTROPAY)).toEqual(["ARS", "USD"]);
    expect(cardCurrencies(debitCard({ accounts: [] }))).toEqual([]);
  });
});
```

Create `core/cards/formLimits.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { readLimitRows } from "./formLimits";

const formWith = (currencies: string[], amounts: string[]): FormData => {
  const formData = new FormData();

  currencies.forEach((currency) => formData.append("limitCurrency", currency));
  amounts.forEach((amount) => formData.append("limitAmount", amount));

  return formData;
};

describe("readLimitRows", () => {
  it("pairs each currency with the amount sent in the same position", () => {
    expect(readLimitRows(formWith(["ARS", "USD"], ["300000", "1000"]))).toEqual(
      [
        { currency: "ARS", amount: "300000" },
        { currency: "USD", amount: "1000" },
      ],
    );
  });

  it("gives a row with a missing half an empty value, for the schema to refuse", () => {
    expect(readLimitRows(formWith(["ARS", "USD"], ["300000"]))).toEqual([
      { currency: "ARS", amount: "300000" },
      { currency: "USD", amount: "" },
    ]);
  });

  it("is empty when the form sends no cap (a debit card)", () => {
    expect(readLimitRows(new FormData())).toEqual([]);
  });
});
```

Replace the whole content of `core/cards/schema.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { parseCardInput } from "./schema";

const credit = (patch: Record<string, unknown> = {}) => ({
  kind: "CREDIT",
  bankId: "bank_1",
  last4: "1234",
  brand: "VISA",
  closingDay: "25",
  dueDay: "5",
  limitMode: "MONTHLY",
  limits: [{ currency: "ARS", amount: "300000" }],
  ...patch,
});

const debit = (patch: Record<string, unknown> = {}) => ({
  kind: "DEBIT",
  bankId: "bank_1",
  last4: "9999",
  brand: "MASTERCARD",
  limits: [],
  ...patch,
});

const errorsOf = (values: Record<string, unknown>) => {
  const result = parseCardInput(values);

  if (result.success) {
    throw new Error("expected the form to be rejected");
  }

  return result.fieldErrors;
};

const DEBIT_FIELDS =
  "Una tarjeta de débito o prepaga no tiene cierre, vencimiento ni tope.";

describe("parseCardInput", () => {
  it("asks for the kind before anything else", () => {
    expect(errorsOf(credit({ kind: "GOLD" }))).toEqual({
      kind: ["Elegí el tipo de tarjeta."],
    });
    expect(errorsOf(credit({ kind: undefined }))).toEqual({
      kind: ["Elegí el tipo de tarjeta."],
    });
  });

  describe("a credit card", () => {
    it("turns a valid form into the stored shape, each cap in minor units of its currency, by currency", () => {
      expect(
        parseCardInput(
          credit({
            limits: [
              { currency: "USD", amount: "1000.50" },
              { currency: "ARS", amount: "300000" },
            ],
          }),
        ),
      ).toEqual({
        success: true,
        data: {
          kind: "CREDIT",
          bankId: "bank_1",
          last4: "1234",
          brand: "VISA",
          closingDay: 25,
          dueDay: 5,
          limitMode: "MONTHLY",
          limits: [
            { currency: "ARS", amount: 30000000 },
            { currency: "USD", amount: 100050 },
          ],
        },
      });
    });

    it("needs at least one cap", () => {
      expect(errorsOf(credit({ limits: [] }))).toEqual({
        limits: ["Agregá al menos un tope."],
      });
    });

    it("refuses a second cap in the same currency, on that row", () => {
      expect(
        errorsOf(
          credit({
            limits: [
              { currency: "ARS", amount: "1" },
              { currency: "ARS", amount: "2" },
            ],
          }),
        ),
      ).toEqual({ "limits.1.currency": ["Ya hay un tope en esa moneda."] });
    });

    it("checks each cap's amount on its own row", () => {
      expect(
        errorsOf(
          credit({
            limits: [
              { currency: "ARS", amount: "10" },
              { currency: "USD", amount: "0" },
            ],
          }),
        ),
      ).toEqual({ "limits.1.amount": ["El monto debe ser mayor que cero."] });
      expect(
        errorsOf(credit({ limits: [{ currency: "ARS", amount: "abc" }] })),
      ).toEqual({
        "limits.0.amount": [
          "Ingresa un monto válido, con dígitos y un punto para los decimales.",
        ],
      });
    });

    it("refuses a currency the app does not support, on its row", () => {
      expect(
        errorsOf(credit({ limits: [{ currency: "XXX", amount: "10" }] })),
      ).toEqual({ "limits.0.currency": ["Selecciona una moneda compatible."] });
    });

    it("keeps the rules of the last four digits, the brand, the days and the mode", () => {
      expect(
        errorsOf(
          credit({
            last4: "12",
            brand: "AMEX",
            closingDay: "40",
            limitMode: "SOMETIMES",
          }),
        ),
      ).toEqual({
        last4: ["Ingresá exactamente 4 dígitos."],
        brand: ["Seleccioná una marca válida."],
        closingDay: [
          "El día de cierre debe ser un número entero entre 1 y 31.",
        ],
        limitMode: ["Seleccioná el tipo de tope."],
      });
    });

    it("requires the bank", () => {
      expect(errorsOf(credit({ bankId: "  " }))).toEqual({
        bankId: ["Elegí el banco de la tarjeta."],
      });
      expect(errorsOf(credit({ bankId: undefined }))).toEqual({
        bankId: ["Elegí el banco de la tarjeta."],
      });
    });

    it("keeps only its own fields: an owner or an id never gets through", () => {
      const result = parseCardInput(credit({ userId: "attacker", id: "x" }));

      expect(result.success && Object.keys(result.data).sort()).toEqual([
        "bankId",
        "brand",
        "closingDay",
        "dueDay",
        "kind",
        "last4",
        "limitMode",
        "limits",
      ]);
    });
  });

  describe("a debit or prepaid card", () => {
    it("is only the kind, the bank, the last four digits and the brand", () => {
      expect(parseCardInput(debit({ userId: "attacker" }))).toEqual({
        success: true,
        data: {
          kind: "DEBIT",
          bankId: "bank_1",
          last4: "9999",
          brand: "MASTERCARD",
        },
      });
    });

    it("refuses any field only a credit card has", () => {
      expect(
        errorsOf(
          debit({
            closingDay: "25",
            dueDay: "5",
            limitMode: "MONTHLY",
            limits: [{ currency: "ARS", amount: "1" }],
          }),
        ),
      ).toEqual({
        closingDay: [DEBIT_FIELDS],
        dueDay: [DEBIT_FIELDS],
        limitMode: [DEBIT_FIELDS],
        limits: [DEBIT_FIELDS],
      });
    });
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run core/cards/kinds.test.ts core/cards/formLimits.test.ts core/cards/schema.test.ts`
Expected: FAIL (`./kinds`, `./formLimits` and `./testFixtures` do not exist; `parseCardInput` is not exported).

- [ ] **Step 4: Write the constants, the types and the errors**

In `core/cards/consts.ts`, change the first import to `import type { CardBrand, CardKind } from "./types";`, replace `CARD_FORM_FIELDS` with the block below, and append the rest:

```ts
// CREDIT: bought now and paid with the statement, with a cap per currency. DEBIT covers prepaid cards
// too: it spends from an account of its bank.
export const CARD_KINDS = ["CREDIT", "DEBIT"] as const;

// What a new card starts as in the form.
export const DEFAULT_CARD_KIND: CardKind = "CREDIT";

// How each kind is written in the form, the table and the messages.
export const KIND_NAMES: Readonly<Record<CardKind, string>> = {
  CREDIT: "Crédito",
  DEBIT: "Débito o prepago",
};

// The single-value fields of the card form. The caps travel as repeated pairs (see formLimits.ts).
export const CARD_FORM_FIELDS = [
  "kind",
  "bankId",
  "last4",
  "brand",
  "closingDay",
  "dueDay",
  "limitMode",
] as const;

export const LIMIT_CURRENCY_FIELD = "limitCurrency";
export const LIMIT_AMOUNT_FIELD = "limitAmount";
```

```ts
export const CARD_KIND_REQUIRED_MESSAGE = "Elegí el tipo de tarjeta.";
export const CARD_BANK_REQUIRED_MESSAGE = "Elegí el banco de la tarjeta.";
export const LIMITS_REQUIRED_MESSAGE = "Agregá al menos un tope.";
export const DUPLICATE_LIMIT_CURRENCY_MESSAGE = "Ya hay un tope en esa moneda.";
export const DEBIT_CREDIT_FIELDS_MESSAGE =
  "Una tarjeta de débito o prepaga no tiene cierre, vencimiento ni tope.";
export const CARD_KIND_LOCKED_MESSAGE =
  "El tipo de una tarjeta no se puede cambiar.";
export const CARD_BANK_LOCKED_MESSAGE =
  "El banco de una tarjeta no se puede cambiar.";
export const CARD_BANK_NOT_FOUND_MESSAGE = "Elegí un banco válido.";
export const CARD_BANK_ARCHIVED_MESSAGE =
  "Este banco está archivado. Elegí otro o reactivalo en Bancos.";
// A purchase in installments (and, until debit expenses are wired, an expense) only takes a credit card.
export const CARD_KIND_NOT_ALLOWED_MESSAGE = "Elegí una tarjeta de crédito.";
```

Replace the whole content of `core/cards/types.ts` with:

```ts
import type { EntryStatus } from "@/core/entries/status";

import type { CARD_BRANDS, CARD_KINDS, CARD_LIMIT_MODES } from "./consts";

// The database enums have the same values.
export type CardBrand = (typeof CARD_BRANDS)[number];
export type CardLimitMode = (typeof CARD_LIMIT_MODES)[number];
export type CardKind = (typeof CARD_KINDS)[number];

// The cap of a credit card in one currency, in minor units of it. Caps in different currencies are
// never added together.
export interface CardLimit {
  currency: string;
  amount: number;
}

interface CardBaseInput {
  // The bank that issued the card: the user's. It never changes once the card exists.
  bankId: string;
  // Exactly 4 digits: the only part of the number that is ever stored.
  last4: string;
  brand: CardBrand;
}

export interface CreditCardInput extends CardBaseInput {
  kind: "CREDIT";
  // The day the statement closes, and the day it is paid (1..31).
  closingDay: number;
  dueDay: number;
  limitMode: CardLimitMode;
  // At least one, never two in the same currency, in currency order.
  limits: CardLimit[];
}

export interface DebitCardInput extends CardBaseInput {
  kind: "DEBIT";
}

// Validated card data, by kind.
export type CardInput = CreditCardInput | DebitCardInput;

// An active account of the bank of a debit card: the one it spends from in that currency.
export interface DebitAccount {
  id: string;
  currency: string;
  // "Banco · Cuenta".
  label: string;
}

interface CardIdentity {
  id: string;
  // The name of the bank, for the table and the forms.
  bankName: string;
}

export interface CreditCard extends CreditCardInput, CardIdentity {}

export interface DebitCard extends DebitCardInput, CardIdentity {
  // The bank's active accounts, one per currency (the oldest of a currency when there are several),
  // in the order of the Banks board. The card's currencies are theirs.
  accounts: DebitAccount[];
}

export type Card = CreditCard | DebitCard;

// One cap as the usage and the recommender read it: a currency, the card's mode and its amount there.
export interface CardCap {
  currency: string;
  limitMode: CardLimitMode;
  limitAmount: number;
}

// How close the card is to its cap: "available" up to 80% of it, "near" up to the cap itself and
// "exceeded" beyond it.
export type CardTier = "available" | "near" | "exceeded";

// A charge on the card, as the usage reads it: an installment of a purchase or a purchase in one
// payment, it makes no difference. A MONTHLY cap counts the PLANNED and the SETTLED ones of the month
// (a paid one was spent against the cap too); a TOTAL cap counts only the PLANNED ones (what is still
// owed). A COVERED one (paid by somebody else) never counts.
export interface CardCharge {
  // Minor units.
  amount: number;
  // "YYYY-MM-DD".
  date: string;
  currency: string;
  status: EntryStatus;
}

// What a card has used of one cap, in the currency of that cap.
export interface CardUsage {
  // Everything still to pay on the card, whatever month it falls in.
  committedTotal: number;
  // What the card was charged in the current month, paid or still to pay.
  monthUsed: number;
  // What counts against the cap, by the card's mode: the committed total (TOTAL) or the current
  // month's (MONTHLY).
  used: number;
  // The cap minus what was used. Negative when the cap is exceeded.
  available: number;
  tier: CardTier;
}

export interface CardLimitUsage extends CardLimit, CardUsage {}

// A card with what it has used of each of its caps (one per currency; none for a debit card).
export type CardWithUsage = Card & { usage: CardLimitUsage[] };

// A card with every charge made with it, which is all a projection of a new purchase needs.
export type CardWithCharges = Card & { charges: CardCharge[] };

export type CreditCardWithCharges = Extract<
  CardWithCharges,
  { kind: "CREDIT" }
>;

// A purchase the user is thinking about, as the card's cap sees it: the installments it will add and
// the month each one falls in.
export interface PurchaseProjection {
  currency: string;
  // Minor units: the sum of its installments.
  totalAmount: number;
  installments: readonly { month: string; amount: number }[];
}

// Whether a purchase fits a cap, and by how much. `margin` is what would be left of the cap after it
// (of the month with the least room, for a MONTHLY card); `excess` is how far over the cap it would go
// (in the month with the most excess). A cap in another currency never fits.
export type CardFit =
  | { fits: true; margin: number; month?: string }
  | { fits: false; reason: "currency" }
  | { fits: false; reason: "limit"; excess: number; month?: string };

// The purchase in installments the planner is working on, before any card is chosen: each card turns
// it into a projection with its own cycle.
export interface PurchaseDraft {
  currency: string;
  // Minor units.
  totalAmount: number;
  totalCuotas: number;
  // The day the purchase was made, "YYYY-MM-DD".
  purchaseDate: string;
}

// How a card suits a purchase: it fits with room to spare ("fits"), it fits but leaves less than a
// fifth of the cap ("near"), or it goes over the cap ("exceeded").
export type CardVerdict = "fits" | "near" | "exceeded";

export interface CardRecommendation {
  cardId: string;
  verdict: CardVerdict;
  // What is left of the cap after the purchase (of the tightest month on a MONTHLY card). Set when
  // the purchase fits.
  margin?: number;
  // How far over the cap the purchase goes. Set when it does not fit.
  excess?: number;
  // True for the best card that fits: the most room left, a tie going to the earlier closing day.
  recommended: boolean;
}

export type CardFieldErrors = Record<string, string[]>;

export type CardActionResult =
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: CardFieldErrors };

// What deleting several cards at once answers: how many went away and how many were left out
// because they still have pending expenses (a card with something still to pay is never deleted).
export type CardsDeleteResult =
  | { status: "success"; deleted: number; skipped: number }
  | { status: "error"; message: string };
```

Append to `core/cards/errors.ts`:

```ts
// A card never changes kind: a credit card may have plans hanging from it.
export class CardKindLockedError extends Error {
  constructor() {
    super("The kind of a card cannot change");
    this.name = "CardKindLockedError";
  }
}

// A card never moves to another bank.
export class CardBankLockedError extends Error {
  constructor() {
    super("The bank of a card cannot change");
    this.name = "CardBankLockedError";
  }
}

// Only a credit card can pay this (a purchase in installments).
export class CardKindNotAllowedError extends Error {
  constructor() {
    super("Only a credit card can be used here");
    this.name = "CardKindNotAllowedError";
  }
}
```

- [ ] **Step 5: Write the pure helpers, the test builders, the limit rows and the schema**

Create `core/cards/kinds.ts`:

```ts
import type {
  Card,
  CardCap,
  CardKind,
  CardLimit,
  CreditCard,
  DebitAccount,
  DebitCard,
} from "./types";

// Pure rules about the two kinds of card, shared by the services and the forms.

// Narrows any card-like value (a card, a card with its charges, a form's option) by its kind.
export const isCreditCard = <C extends { kind: CardKind }>(
  card: C,
): card is Extract<C, { kind: "CREDIT" }> => card.kind === "CREDIT";

export const isDebitCard = <C extends { kind: CardKind }>(
  card: C,
): card is Extract<C, { kind: "DEBIT" }> => card.kind === "DEBIT";

// The cap of a credit card in `currency`, if it has one.
export const limitIn = (
  card: Pick<CreditCard, "limits">,
  currency: string,
): CardLimit | null =>
  card.limits.find((limit) => limit.currency === currency) ?? null;

// The cap of a credit card in `currency` as the usage reads it. Never a sum of currencies.
export const capIn = (
  card: Pick<CreditCard, "limits" | "limitMode">,
  currency: string,
): CardCap | null => {
  const limit = limitIn(card, currency);

  return limit
    ? { currency, limitMode: card.limitMode, limitAmount: limit.amount }
    : null;
};

// The account a debit card spends from in `currency`: its bank's active one, if any.
export const debitAccountIn = (
  card: Pick<DebitCard, "accounts">,
  currency: string,
): DebitAccount | null =>
  card.accounts.find((account) => account.currency === currency) ?? null;

// The currencies a card can pay in: a credit card's caps, a debit card's accounts.
export const cardCurrencies = (card: Card): string[] =>
  card.kind === "CREDIT"
    ? card.limits.map(({ currency }) => currency)
    : card.accounts.map(({ currency }) => currency);
```

Create `core/cards/testFixtures.ts`:

```ts
import type { CreditCard, DebitCard } from "./types";

// Builders for the tests: a card as the services return it, and as the database returns it with
// what every read includes (see WITH_CARD_DETAILS). `currency` and `limitAmount` are a shortcut for a
// card with a single cap.

export type CreditCardPatch = Partial<CreditCard> & {
  currency?: string;
  limitAmount?: number;
};

export const creditCard = ({
  currency = "ARS",
  limitAmount = 30000000,
  ...patch
}: CreditCardPatch = {}): CreditCard => ({
  kind: "CREDIT",
  id: "card_1",
  bankId: "bank_1",
  bankName: "Banco Galicia",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  limitMode: "MONTHLY",
  limits: [{ currency, amount: limitAmount }],
  ...patch,
});

export const debitCard = (patch: Partial<DebitCard> = {}): DebitCard => ({
  kind: "DEBIT",
  id: "card_9",
  bankId: "bank_1",
  bankName: "Banco Galicia",
  last4: "9999",
  brand: "VISA",
  accounts: [
    { id: "acc_1", currency: "ARS", label: "Banco Galicia · Caja de ahorro" },
  ],
  ...patch,
});

const AT = new Date("2026-09-01T00:00:00.000Z");

export const creditCardRecord = ({
  currency = "ARS",
  limitAmount = 30000000,
  ...patch
}: Record<string, unknown> & {
  currency?: string;
  limitAmount?: number;
} = {}) => ({
  id: "card_1",
  userId: "user_123",
  kind: "CREDIT",
  bankId: "bank_1",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  limitMode: "MONTHLY",
  createdAt: AT,
  updatedAt: AT,
  limits: [
    { id: "lim_1", cardId: "card_1", currency, amount: BigInt(limitAmount) },
  ],
  bank: {
    name: "Banco Galicia",
    accounts: [] as { id: string; name: string; currency: string }[],
  },
  ...patch,
});

export const debitCardRecord = (patch: Record<string, unknown> = {}) => ({
  id: "card_9",
  userId: "user_123",
  kind: "DEBIT",
  bankId: "bank_1",
  last4: "9999",
  brand: "VISA",
  closingDay: null,
  dueDay: null,
  limitMode: null,
  createdAt: AT,
  updatedAt: AT,
  limits: [],
  bank: {
    name: "Banco Galicia",
    accounts: [{ id: "acc_1", name: "Caja de ahorro", currency: "ARS" }],
  },
  ...patch,
});
```

Create `core/cards/formLimits.ts`:

```ts
import { LIMIT_AMOUNT_FIELD, LIMIT_CURRENCY_FIELD } from "./consts";

const text = (value: FormDataEntryValue | undefined): string =>
  typeof value === "string" ? value : "";

// The caps of a card form: one currency and one amount per row, sent as two repeated fields in the
// same order. A value that is not text, or the missing half of a row, counts as empty, which the
// schema refuses.
export const readLimitRows = (
  formData: FormData,
): { currency: string; amount: string }[] => {
  const currencies = formData.getAll(LIMIT_CURRENCY_FIELD);
  const amounts = formData.getAll(LIMIT_AMOUNT_FIELD);

  return Array.from(
    { length: Math.max(currencies.length, amounts.length) },
    (_, index) => ({
      currency: text(currencies[index]),
      amount: text(amounts[index]),
    }),
  );
};
```

Replace the whole content of `core/cards/schema.ts` with:

```ts
import { z } from "zod";

import {
  amountField,
  checkAmount,
  currencyField,
  toAmount,
} from "@/core/entries/fields";

import {
  CARD_BANK_REQUIRED_MESSAGE,
  CARD_BRANDS,
  CARD_KIND_REQUIRED_MESSAGE,
  CARD_KINDS,
  CARD_LIMIT_MODES,
  DEBIT_CREDIT_FIELDS_MESSAGE,
  DUPLICATE_LIMIT_CURRENCY_MESSAGE,
  LIMITS_REQUIRED_MESSAGE,
  MAX_CARD_DAY,
  MIN_CARD_DAY,
} from "./consts";
import type {
  CardFieldErrors,
  CardInput,
  CreditCardInput,
  DebitCardInput,
} from "./types";

const DAY_PATTERN = /^\d{1,2}$/;

const isCardDay = (value: string): boolean =>
  DAY_PATTERN.test(value) &&
  Number(value) >= MIN_CARD_DAY &&
  Number(value) <= MAX_CARD_DAY;

// A form can only send text, so a day arrives as digits and leaves as a number.
const dayField = (label: string) =>
  z
    .string({ error: `${label} es obligatorio.` })
    .trim()
    .refine(
      isCardDay,
      `${label} debe ser un número entero entre ${MIN_CARD_DAY} y ${MAX_CARD_DAY}.`,
    )
    .transform(Number);

const kindField = z.enum(CARD_KINDS, { error: CARD_KIND_REQUIRED_MESSAGE });

const bankIdField = z
  .string({ error: CARD_BANK_REQUIRED_MESSAGE })
  .trim()
  .min(1, CARD_BANK_REQUIRED_MESSAGE);

const last4Field = z
  .string({ error: "Los últimos 4 dígitos son obligatorios." })
  .trim()
  .regex(/^\d{4}$/, "Ingresá exactamente 4 dígitos.");

const brandField = z.enum(CARD_BRANDS, {
  error: "Seleccioná una marca válida.",
});

const limitModeField = z.enum(CARD_LIMIT_MODES, {
  error: "Seleccioná el tipo de tope.",
});

// One cap as the form sends it: a currency and the amount typed in it.
const limitRowField = z.object({
  currency: currencyField,
  amount: amountField,
});

// At least one cap, never two in the same currency, each amount positive in its own currency. The
// amount helper reports on `amount`, so its issues are moved onto the row they are about.
const creditCardSchema = z
  .object({
    kind: z.literal("CREDIT"),
    bankId: bankIdField,
    last4: last4Field,
    brand: brandField,
    closingDay: dayField("El día de cierre"),
    dueDay: dayField("El día de vencimiento"),
    limitMode: limitModeField,
    limits: z.array(limitRowField),
  })
  .superRefine((value, ctx) => {
    if (value.limits.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["limits"],
        message: LIMITS_REQUIRED_MESSAGE,
      });
    }

    const seen = new Set<string>();

    value.limits.forEach((limit, index) => {
      if (seen.has(limit.currency)) {
        ctx.addIssue({
          code: "custom",
          path: ["limits", index, "currency"],
          message: DUPLICATE_LIMIT_CURRENCY_MESSAGE,
        });
      }

      seen.add(limit.currency);
      checkAmount(limit, {
        addIssue: (issue) =>
          ctx.addIssue({ ...issue, path: ["limits", index, "amount"] }),
      });
    });
  })
  .transform((value): CreditCardInput => ({
    ...value,
    limits: value.limits
      .map((limit) => ({ currency: limit.currency, amount: toAmount(limit) }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  }));

// A debit or prepaid card has none of the credit fields: a request that sends any is refused.
const absentField = z.undefined({ error: DEBIT_CREDIT_FIELDS_MESSAGE });

const debitCardSchema = z
  .object({
    kind: z.literal("DEBIT"),
    bankId: bankIdField,
    last4: last4Field,
    brand: brandField,
    closingDay: absentField,
    dueDay: absentField,
    limitMode: absentField,
    limits: z.array(z.unknown()).max(0, DEBIT_CREDIT_FIELDS_MESSAGE),
  })
  .transform(({ kind, bankId, last4, brand }): DebitCardInput => ({
    kind,
    bankId,
    last4,
    brand,
  }));

export type CardParseResult =
  | { success: true; data: CardInput }
  | { success: false; fieldErrors: CardFieldErrors };

// Every issue under the full path of its field: "limits.1.amount" for the amount of the second cap.
export const toCardFieldErrors = (error: z.ZodError): CardFieldErrors => {
  const errors: CardFieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");

    errors[key] = [...(errors[key] ?? []), issue.message];
  }

  return errors;
};

// Validates the raw values of a card form (text, and the caps as rows of text) by kind, and outputs
// the persisted shape: the days as numbers and each cap in minor units of its currency.
export const parseCardInput = (
  values: Record<string, unknown>,
): CardParseResult => {
  const kind = kindField.safeParse(values.kind);

  if (!kind.success) {
    return {
      success: false,
      fieldErrors: { kind: [CARD_KIND_REQUIRED_MESSAGE] },
    };
  }

  const result =
    kind.data === "CREDIT"
      ? creditCardSchema.safeParse(values)
      : debitCardSchema.safeParse(values);

  return result.success
    ? { success: true, data: result.data }
    : { success: false, fieldErrors: toCardFieldErrors(result.error) };
};
```

- [ ] **Step 6: Run the pure tests to see them pass**

Run: `npx vitest run core/cards/kinds.test.ts core/cards/formLimits.test.ts core/cards/schema.test.ts`
Expected: PASS.

- [ ] **Step 7: Usage and the recommender read one cap per currency (tests first)**

In `core/cards/recommend.test.ts`, replace the imports and the `card` builder (lines 1-17) with:

```ts
import { describe, expect, it } from "vitest";

import { projectionOf, recommendCards } from "./recommend";
import { creditCard, debitCard } from "./testFixtures";
import type { CreditCardPatch } from "./testFixtures";
import type {
  CardCharge,
  CardWithCharges,
  CreditCardWithCharges,
} from "./types";

const card = ({
  charges = [],
  ...patch
}: CreditCardPatch & {
  charges?: CardCharge[];
} = {}): CreditCardWithCharges => ({
  ...creditCard({ limitMode: "TOTAL", limitAmount: 100000, ...patch }),
  charges,
});
```

and append inside `describe("recommendCards", …)`, right after the test "lists nothing when no card is in that currency":

```ts
it("never lists a debit card, whatever accounts it has", () => {
  const debit: CardWithCharges = { ...debitCard(), charges: [] };

  expect(
    recommendCards([debit, card()], PURCHASE).map(({ cardId }) => cardId),
  ).toEqual(["card_1"]);
});

it("weighs a card with several caps only against the cap of the purchase's currency, never their sum", () => {
  const both = card({
    limits: [
      { currency: "ARS", amount: 37499 },
      { currency: "USD", amount: 1000000 },
    ],
  });

  expect(recommendCards([both], PURCHASE)[0]).toMatchObject({
    verdict: "near",
    margin: 7499,
  });
  expect(
    recommendCards([both], { ...PURCHASE, currency: "USD" })[0],
  ).toMatchObject({ verdict: "fits", margin: 970000 });
});

it("leaves out a credit card that has no cap in the purchase's currency", () => {
  expect(
    recommendCards(
      [card({ limits: [{ currency: "USD", amount: 1000000 }] })],
      PURCHASE,
    ),
  ).toEqual([]);
});
```

Run: `npx vitest run core/cards/recommend.test.ts`
Expected: FAIL (type errors aside, `recommendCards` still filters by `card.currency`, so the debit card and the multi-cap card are handled wrongly).

In `core/cards/usage.ts`, replace

```ts
import type {
  Card,
  CardCharge,
  CardFit,
  CardTier,
  CardUsage,
  PurchaseProjection,
} from "./types";
```

with

```ts
import type {
  CardCap,
  CardCharge,
  CardFit,
  CardTier,
  CardUsage,
  PurchaseProjection,
} from "./types";
```

delete the line `type CapOf = Pick<Card, "currency" | "limitMode" | "limitAmount">;` and replace the two remaining `CapOf` with `CardCap`. Also change the comment above `fitOf` from "A card in another currency than the purchase never fits." to "A cap in another currency than the purchase never fits."

In `core/cards/recommend.ts`, replace everything from `type CycleOf` to the end of the file with:

```ts
type CycleOf = Pick<CreditCard, "closingDay" | "dueDay">;

// The purchase as one card sees it: its first installment is paid on the due date of the statement
// the purchase lands in, which depends on the card's own cycle, and one more every month after.
export const projectionOf = (
  card: CycleOf,
  { currency, totalAmount, totalCuotas, purchaseDate }: PurchaseDraft,
): PurchaseProjection => {
  const firstDate = firstInstallmentDate(
    purchaseDate,
    card.closingDay,
    card.dueDay,
  );
  const amounts = splitAmount(totalAmount, totalCuotas);

  return {
    currency,
    totalAmount,
    installments: installmentDates(firstDate, totalCuotas).map(
      (date, index) => ({ month: monthOf(date), amount: amounts[index] }),
    ),
  };
};

// Whether what is left of the cap is less than NEAR_MARGIN_PERCENT of it. Compared in BigInt so a
// huge cap does not lose precision.
const isTight = (margin: number, limit: number): boolean =>
  BigInt(margin) * BigInt(100) < BigInt(limit) * BigInt(NEAR_MARGIN_PERCENT);

const verdictOf = (
  card: CreditCardWithCharges,
  cap: CardCap,
  purchase: PurchaseDraft,
): Omit<CardRecommendation, "recommended"> => {
  const fit = fitOf(cap, card.charges, projectionOf(card, purchase));

  if (fit.fits) {
    return {
      cardId: card.id,
      verdict: isTight(fit.margin, cap.limitAmount) ? "near" : "fits",
      margin: fit.margin,
    };
  }

  // The cap is in the currency of the purchase (the others were left out), so a failure can only be
  // about the cap.
  return {
    cardId: card.id,
    verdict: "exceeded",
    excess: fit.reason === "limit" ? fit.excess : 0,
  };
};

// The credit cards with a cap in the currency of the purchase, with a verdict each against that cap
// (a debit card is paid on the spot, so it is never one of them): it fits, it fits but leaves less
// than a fifth of the cap, or it goes over the cap. The ones that fit come first, the one with the
// most room on top (a tie goes to the card that closes earlier), then the ones that do not, the least
// over first. The top card, when it fits, is the recommended one.
export const recommendCards = (
  cards: readonly CardWithCharges[],
  purchase: PurchaseDraft,
): CardRecommendation[] => {
  const credit = cards.filter(isCreditCard);
  const closingOf = new Map(
    credit.map(({ id, closingDay }) => [id, closingDay]),
  );
  const verdicts = credit.flatMap((card) => {
    const cap = capIn(card, purchase.currency);

    return cap ? [verdictOf(card, cap, purchase)] : [];
  });

  const byRoom = (a: CardRecommendation, b: CardRecommendation): number => {
    if (a.verdict === "exceeded" || b.verdict === "exceeded") {
      if (a.verdict !== b.verdict) {
        return a.verdict === "exceeded" ? 1 : -1;
      }

      return (a.excess ?? 0) - (b.excess ?? 0);
    }

    return (
      (b.margin ?? 0) - (a.margin ?? 0) ||
      (closingOf.get(a.cardId) ?? 0) - (closingOf.get(b.cardId) ?? 0)
    );
  };

  const sorted = verdicts
    .map((verdict) => ({ ...verdict, recommended: false }))
    .sort(byRoom);

  if (sorted.length > 0 && sorted[0].verdict !== "exceeded") {
    sorted[0].recommended = true;
  }

  return sorted;
};
```

and replace its imports with:

```ts
import { installmentDates, splitAmount } from "@/core/installments/plan";
import { monthOf } from "@/core/summary/month";

import { NEAR_MARGIN_PERCENT } from "./consts";
import { firstInstallmentDate } from "./cycle";
import { capIn, isCreditCard } from "./kinds";
import type {
  CardCap,
  CardRecommendation,
  CardWithCharges,
  CreditCard,
  CreditCardWithCharges,
  PurchaseDraft,
  PurchaseProjection,
} from "./types";
import { fitOf } from "./usage";
```

Run: `npx vitest run core/cards/recommend.test.ts core/cards/usage.test.ts core/cards/cycle.test.ts`
Expected: PASS.

#### Part B — the card service and actions

- [ ] **Step 8: Write the failing service tests**

Replace the whole content of `core/cards/service.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are observed on
  // the same mocks.
  $transaction: vi.fn(),
  card: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  cardLimit: { deleteMany: vi.fn(), createMany: vi.fn() },
  bank: { findFirst: vi.fn() },
  expense: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { BankArchivedError, BankNotFoundError } from "@/core/banks/errors";

import {
  CardBankLockedError,
  CardHasPendingExpensesError,
  CardKindLockedError,
  CardNotFoundError,
  DuplicateCardError,
} from "./errors";
import {
  createCard,
  deleteCard,
  findOwnedCard,
  listCards,
  listCardsWithCharges,
  updateCard,
  WITH_CARD_DETAILS,
} from "./service";
import { creditCardRecord, debitCardRecord } from "./testFixtures";
import type { CreditCardInput, DebitCardInput } from "./types";

const { bank, card, cardLimit, expense } = db;

const USER_ID = "user_123";

const creditInput: CreditCardInput = {
  kind: "CREDIT",
  bankId: "bank_1",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  limitMode: "MONTHLY",
  limits: [
    { currency: "ARS", amount: 30000000 },
    { currency: "USD", amount: 100000 },
  ],
};

const debitInput: DebitCardInput = {
  kind: "DEBIT",
  bankId: "bank_1",
  last4: "9999",
  brand: "MASTERCARD",
};

const TWO_LIMITS = [
  { id: "lim_1", cardId: "card_1", currency: "ARS", amount: BigInt(30000000) },
  { id: "lim_2", cardId: "card_1", currency: "USD", amount: BigInt(100000) },
];

// An expense charged to a card: an installment of a plan or a purchase in one payment.
const installmentRow = (patch: Record<string, unknown> = {}) => ({
  amount: BigInt(1000000),
  date: new Date("2026-10-05T00:00:00.000Z"),
  currency: "ARS",
  status: "PLANNED",
  cardId: "card_1",
  ...patch,
});

const uniqueViolation = () =>
  Object.assign(new Error("unique"), { code: "P2002" });

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
});

describe("WITH_CARD_DETAILS", () => {
  it("brings the caps by currency, the bank's name and only its active accounts, oldest first", () => {
    expect(WITH_CARD_DETAILS).toEqual({
      limits: { orderBy: { currency: "asc" } },
      bank: {
        select: {
          name: true,
          accounts: {
            where: { archivedAt: null },
            select: { id: true, name: true, currency: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    });
  });
});

describe("listCards", () => {
  beforeEach(() => {
    card.findMany.mockResolvedValue([creditCardRecord()]);
    expense.findMany.mockResolvedValue([]);
  });

  it("reads only the user's cards, in the order they were added, with their details", async () => {
    await listCards(USER_ID, "2026-10");

    expect(card.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: WITH_CARD_DETAILS,
    });
  });

  it("reads the user's pending and paid expenses that have a card, in one query for every card", async () => {
    await listCards(USER_ID, "2026-10");

    expect(expense.findMany).toHaveBeenCalledTimes(1);
    expect(expense.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        cardId: { not: null },
        status: { in: ["PLANNED", "SETTLED"] },
      },
      select: {
        amount: true,
        date: true,
        currency: true,
        status: true,
        cardId: true,
      },
    });
  });

  it("returns a credit card as a plain card, its caps as numbers, with one usage per cap", async () => {
    card.findMany.mockResolvedValue([creditCardRecord({ limits: TWO_LIMITS })]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first).toMatchObject({
      kind: "CREDIT",
      id: "card_1",
      bankId: "bank_1",
      bankName: "Banco Galicia",
      last4: "1234",
      brand: "VISA",
      closingDay: 25,
      dueDay: 5,
      limitMode: "MONTHLY",
      limits: [
        { currency: "ARS", amount: 30000000 },
        { currency: "USD", amount: 100000 },
      ],
    });
    expect(
      first.usage.map(({ currency, amount }) => [currency, amount]),
    ).toEqual([
      ["ARS", 30000000],
      ["USD", 100000],
    ]);
    expect(first).not.toHaveProperty("userId");
  });

  it("measures each cap only with the charges in its own currency, never adding currencies", async () => {
    card.findMany.mockResolvedValue([creditCardRecord({ limits: TWO_LIMITS })]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(1000000) }),
      installmentRow({ amount: BigInt(5000), currency: "USD" }),
    ]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first.usage).toEqual([
      expect.objectContaining({
        currency: "ARS",
        used: 1000000,
        available: 29000000,
      }),
      expect.objectContaining({
        currency: "USD",
        used: 5000,
        available: 95000,
      }),
    ]);
  });

  it("measures a MONTHLY card by what falls in the month asked for", async () => {
    expense.findMany.mockResolvedValue([
      installmentRow({
        amount: BigInt(1000000),
        date: new Date("2026-10-05T00:00:00.000Z"),
      }),
      installmentRow({
        amount: BigInt(2500000),
        date: new Date("2026-10-28T00:00:00.000Z"),
      }),
      installmentRow({
        amount: BigInt(4000000),
        date: new Date("2026-11-05T00:00:00.000Z"),
      }),
    ]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first.usage[0]).toMatchObject({
      committedTotal: 7500000,
      monthUsed: 3500000,
      used: 3500000,
      available: 26500000,
      tier: "available",
    });
  });

  it("measures a TOTAL card by everything it has committed", async () => {
    card.findMany.mockResolvedValue([
      creditCardRecord({ limitMode: "TOTAL", limitAmount: 10000000 }),
    ]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(1000000) }),
      installmentRow({
        amount: BigInt(8500000),
        date: new Date("2027-02-05T00:00:00.000Z"),
      }),
    ]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first.usage[0]).toMatchObject({
      used: 9500000,
      available: 500000,
      tier: "near",
    });
  });

  it("gives each card only the expenses charged to it", async () => {
    card.findMany.mockResolvedValue([
      creditCardRecord(),
      creditCardRecord({ id: "card_2", last4: "9999", limitMode: "TOTAL" }),
    ]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(100) }),
      installmentRow({ amount: BigInt(200), cardId: "card_2" }),
      installmentRow({ amount: BigInt(400), cardId: "card_2" }),
      installmentRow({ amount: BigInt(800), cardId: "someone_elses" }),
    ]);

    const [first, second] = await listCards(USER_ID, "2026-10");

    expect(first.usage[0].committedTotal).toBe(100);
    expect(second.usage[0].committedTotal).toBe(600);
  });

  it("counts a MONTHLY card's paid expenses of the month, but not a TOTAL card's", async () => {
    card.findMany.mockResolvedValue([
      creditCardRecord(),
      creditCardRecord({ id: "card_2", last4: "9999", limitMode: "TOTAL" }),
    ]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(300), status: "SETTLED" }),
      installmentRow({ amount: BigInt(100) }),
      installmentRow({
        amount: BigInt(300),
        status: "SETTLED",
        cardId: "card_2",
      }),
      installmentRow({ amount: BigInt(100), cardId: "card_2" }),
    ]);

    const [monthly, total] = await listCards(USER_ID, "2026-10");

    expect(monthly.usage[0]).toMatchObject({ used: 400, committedTotal: 100 });
    expect(total.usage[0]).toMatchObject({ used: 100, committedTotal: 100 });
  });

  it("returns a debit card with one active account per currency of its bank (the oldest), and no usage", async () => {
    card.findMany.mockResolvedValue([
      debitCardRecord({
        bank: {
          name: "AstroPay",
          accounts: [
            { id: "acc_ars", name: "Pesos", currency: "ARS" },
            { id: "acc_usd", name: "Dólares", currency: "USD" },
            { id: "acc_ars_2", name: "Pesos 2", currency: "ARS" },
          ],
        },
      }),
    ]);

    await expect(listCards(USER_ID, "2026-10")).resolves.toEqual([
      {
        kind: "DEBIT",
        id: "card_9",
        bankId: "bank_1",
        bankName: "AstroPay",
        last4: "9999",
        brand: "VISA",
        accounts: [
          { id: "acc_ars", currency: "ARS", label: "AstroPay · Pesos" },
          { id: "acc_usd", currency: "USD", label: "AstroPay · Dólares" },
        ],
        usage: [],
      },
    ]);
  });

  it("returns no cards for a user who has none", async () => {
    card.findMany.mockResolvedValue([]);

    await expect(listCards(USER_ID, "2026-10")).resolves.toEqual([]);
  });

  it("defaults to the current month in Argentina", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(100) }),
    ]);

    try {
      const [first] = await listCards(USER_ID);

      expect(first.usage[0].monthUsed).toBe(100);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createCard", () => {
  beforeEach(() => {
    bank.findFirst.mockResolvedValue({ archivedAt: null });
    card.create.mockResolvedValue(creditCardRecord());
  });

  it("checks the bank is the user's before writing", async () => {
    await createCard(USER_ID, creditInput);

    expect(bank.findFirst).toHaveBeenCalledWith({
      where: { id: "bank_1", userId: USER_ID },
      select: { archivedAt: true },
    });
    expect(card.create).toHaveBeenCalledTimes(1);
  });

  it("writes nothing for a bank that is not the user's", async () => {
    bank.findFirst.mockResolvedValue(null);

    await expect(createCard(USER_ID, creditInput)).rejects.toBeInstanceOf(
      BankNotFoundError,
    );
    expect(card.create).not.toHaveBeenCalled();
  });

  it("writes nothing for an archived bank", async () => {
    bank.findFirst.mockResolvedValue({ archivedAt: new Date() });

    await expect(createCard(USER_ID, debitInput)).rejects.toBeInstanceOf(
      BankArchivedError,
    );
    expect(card.create).not.toHaveBeenCalled();
  });

  it("stores a credit card with its cycle, its mode and its caps as BigInt", async () => {
    await createCard(USER_ID, creditInput);

    expect(card.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        kind: "CREDIT",
        bankId: "bank_1",
        last4: "1234",
        brand: "VISA",
        closingDay: 25,
        dueDay: 5,
        limitMode: "MONTHLY",
        limits: {
          create: [
            { currency: "ARS", amount: BigInt(30000000) },
            { currency: "USD", amount: BigInt(100000) },
          ],
        },
      },
      include: WITH_CARD_DETAILS,
    });
  });

  it("stores a debit card with none of the credit fields and no caps", async () => {
    card.create.mockResolvedValue(debitCardRecord());

    await createCard(USER_ID, debitInput);

    expect(card.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        kind: "DEBIT",
        bankId: "bank_1",
        last4: "9999",
        brand: "MASTERCARD",
        closingDay: null,
        dueDay: null,
        limitMode: null,
        limits: { create: [] },
      },
      include: WITH_CARD_DETAILS,
    });
  });

  it("returns the card it stored", async () => {
    await expect(createCard(USER_ID, creditInput)).resolves.toMatchObject({
      id: "card_1",
      kind: "CREDIT",
      limits: [{ currency: "ARS", amount: 30000000 }],
    });
  });

  it("says so when the user already has that brand ending in those digits", async () => {
    card.create.mockRejectedValue(uniqueViolation());

    await expect(createCard(USER_ID, creditInput)).rejects.toEqual(
      new DuplicateCardError("VISA", "1234"),
    );
  });

  it("lets any other failure through", async () => {
    card.create.mockRejectedValue(new Error("db down"));

    await expect(createCard(USER_ID, creditInput)).rejects.toThrow("db down");
  });
});

describe("updateCard", () => {
  beforeEach(() => {
    card.findFirst.mockResolvedValue({ kind: "CREDIT", bankId: "bank_1" });
    card.updateMany.mockResolvedValue({ count: 1 });
    cardLimit.deleteMany.mockResolvedValue({ count: 1 });
    cardLimit.createMany.mockResolvedValue({ count: 2 });
  });

  it("reads the card among the user's own, inside the transaction", async () => {
    await updateCard(USER_ID, "card_1", creditInput);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(card.findFirst).toHaveBeenCalledWith({
      where: { id: "card_1", userId: USER_ID },
      select: { kind: true, bankId: true },
    });
  });

  it("changes the fields (never the kind, the bank or the owner) and replaces the caps", async () => {
    await updateCard(USER_ID, "card_1", creditInput);

    expect(card.updateMany).toHaveBeenCalledWith({
      where: { id: "card_1", userId: USER_ID },
      data: {
        last4: "1234",
        brand: "VISA",
        closingDay: 25,
        dueDay: 5,
        limitMode: "MONTHLY",
      },
    });
    expect(cardLimit.deleteMany).toHaveBeenCalledWith({
      where: { cardId: "card_1" },
    });
    expect(cardLimit.createMany).toHaveBeenCalledWith({
      data: [
        { cardId: "card_1", currency: "ARS", amount: BigInt(30000000) },
        { cardId: "card_1", currency: "USD", amount: BigInt(100000) },
      ],
    });
  });

  it("keeps a debit card without credit fields or caps", async () => {
    card.findFirst.mockResolvedValue({ kind: "DEBIT", bankId: "bank_1" });

    await updateCard(USER_ID, "card_9", debitInput);

    expect(card.updateMany).toHaveBeenCalledWith({
      where: { id: "card_9", userId: USER_ID },
      data: {
        last4: "9999",
        brand: "MASTERCARD",
        closingDay: null,
        dueDay: null,
        limitMode: null,
      },
    });
    expect(cardLimit.deleteMany).toHaveBeenCalledWith({
      where: { cardId: "card_9" },
    });
    expect(cardLimit.createMany).not.toHaveBeenCalled();
  });

  it("is not found, and writes nothing, when the card is not the user's", async () => {
    card.findFirst.mockResolvedValue(null);

    await expect(
      updateCard(USER_ID, "card_9", creditInput),
    ).rejects.toBeInstanceOf(CardNotFoundError);
    expect(card.updateMany).not.toHaveBeenCalled();
  });

  it("is not found when the card disappears before the write", async () => {
    card.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateCard(USER_ID, "card_1", creditInput),
    ).rejects.toBeInstanceOf(CardNotFoundError);
    expect(cardLimit.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses to change the kind, writing nothing", async () => {
    await expect(
      updateCard(USER_ID, "card_1", { ...debitInput }),
    ).rejects.toBeInstanceOf(CardKindLockedError);
    expect(card.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to move the card to another bank, writing nothing", async () => {
    await expect(
      updateCard(USER_ID, "card_1", { ...creditInput, bankId: "bank_2" }),
    ).rejects.toBeInstanceOf(CardBankLockedError);
    expect(card.updateMany).not.toHaveBeenCalled();
  });

  it("says so when it would clash with another card of the user", async () => {
    card.updateMany.mockRejectedValue(uniqueViolation());

    await expect(updateCard(USER_ID, "card_1", creditInput)).rejects.toEqual(
      new DuplicateCardError("VISA", "1234"),
    );
  });

  it("lets any other failure through", async () => {
    card.updateMany.mockRejectedValue(new Error("db down"));

    await expect(updateCard(USER_ID, "card_1", creditInput)).rejects.toThrow(
      "db down",
    );
  });
});

describe("deleteCard", () => {
  beforeEach(() => {
    card.findFirst.mockResolvedValue({ id: "card_1" });
    expense.count.mockResolvedValue(0);
    card.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("looks for the card among the user's own", async () => {
    await deleteCard(USER_ID, "card_1");

    expect(card.findFirst).toHaveBeenCalledWith({
      where: { id: "card_1", userId: USER_ID },
      select: { id: true },
    });
  });

  it("is not found, and deletes nothing, when the card is not the user's", async () => {
    card.findFirst.mockResolvedValue(null);

    await expect(deleteCard(USER_ID, "card_9")).rejects.toBeInstanceOf(
      CardNotFoundError,
    );
    expect(card.deleteMany).not.toHaveBeenCalled();
  });

  it("is blocked while an expense charged to the card is still pending", async () => {
    expense.count.mockResolvedValue(3);

    await expect(deleteCard(USER_ID, "card_1")).rejects.toBeInstanceOf(
      CardHasPendingExpensesError,
    );
    expect(card.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes the card once nothing is pending, for the user only", async () => {
    await deleteCard(USER_ID, "card_1");

    expect(expense.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, status: "PLANNED", cardId: "card_1" },
    });
    expect(card.deleteMany).toHaveBeenCalledWith({
      where: { id: "card_1", userId: USER_ID },
    });
  });
});

describe("findOwnedCard", () => {
  it("returns a credit card of the user, with its details", async () => {
    card.findFirst.mockResolvedValue(creditCardRecord());

    const found = await findOwnedCard(USER_ID, "card_1");

    expect(card.findFirst).toHaveBeenCalledWith({
      where: { id: "card_1", userId: USER_ID },
      include: WITH_CARD_DETAILS,
    });
    expect(found).toMatchObject({
      kind: "CREDIT",
      id: "card_1",
      closingDay: 25,
      dueDay: 5,
      limits: [{ currency: "ARS", amount: 30000000 }],
    });
    expect(found).not.toHaveProperty("userId");
  });

  it("returns a debit card of the user with its bank's active accounts", async () => {
    card.findFirst.mockResolvedValue(debitCardRecord());

    await expect(findOwnedCard(USER_ID, "card_9")).resolves.toEqual({
      kind: "DEBIT",
      id: "card_9",
      bankId: "bank_1",
      bankName: "Banco Galicia",
      last4: "9999",
      brand: "VISA",
      accounts: [
        {
          id: "acc_1",
          currency: "ARS",
          label: "Banco Galicia · Caja de ahorro",
        },
      ],
    });
  });

  it("throws for a card that is not the user's", async () => {
    card.findFirst.mockResolvedValue(null);

    await expect(findOwnedCard(USER_ID, "card_9")).rejects.toBeInstanceOf(
      CardNotFoundError,
    );
  });
});

describe("listCardsWithCharges", () => {
  it("gives each of the user's cards the charges made with it", async () => {
    card.findMany.mockResolvedValue([creditCardRecord(), debitCardRecord()]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(100) }),
      installmentRow({
        amount: BigInt(300),
        status: "SETTLED",
        date: new Date("2026-11-05T00:00:00.000Z"),
      }),
    ]);

    const [first, second] = await listCardsWithCharges(USER_ID);

    expect(first.charges).toEqual([
      { amount: 100, date: "2026-10-05", currency: "ARS", status: "PLANNED" },
      { amount: 300, date: "2026-11-05", currency: "ARS", status: "SETTLED" },
    ]);
    expect(second).toMatchObject({ kind: "DEBIT", charges: [] });
    expect(first).not.toHaveProperty("userId");
  });
});
```

Run: `npx vitest run core/cards/service.test.ts`
Expected: FAIL (`WITH_CARD_DETAILS` is not exported; the old `toCard` reads `row.currency`).

- [ ] **Step 9: Write the service**

Replace the whole content of `core/cards/service.ts` with:

```ts
import { accountLabel } from "@/core/accounts/label";
import { BankArchivedError, BankNotFoundError } from "@/core/banks/errors";
import { isUniqueConstraintError } from "@/core/entries/dbErrors";
import { dateToIsoDate, todayIso } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { monthOf } from "@/core/summary/month";
import { prisma } from "@/infrastructure/db/client";
import type { Card as CardRow } from "@/lib/generated/prisma/client";

import {
  CardBankLockedError,
  CardHasPendingExpensesError,
  CardKindLockedError,
  CardNotFoundError,
  DuplicateCardError,
} from "./errors";
import type {
  Card,
  CardCharge,
  CardInput,
  CardWithCharges,
  CardWithUsage,
  DebitAccount,
} from "./types";
import { usageOf } from "./usage";

// What every read of a card brings along: its caps by currency, the name of its bank, and the bank's
// active accounts (a debit card spends from them), oldest first like the Banks board.
export const WITH_CARD_DETAILS = {
  limits: { orderBy: { currency: "asc" } },
  bank: {
    select: {
      name: true,
      accounts: {
        where: { archivedAt: null },
        select: { id: true, name: true, currency: true },
        orderBy: { createdAt: "asc" },
      },
    },
  },
} as const;

type CardRecord = Pick<
  CardRow,
  | "id"
  | "kind"
  | "bankId"
  | "last4"
  | "brand"
  | "closingDay"
  | "dueDay"
  | "limitMode"
> & {
  limits: { currency: string; amount: bigint }[];
  bank: {
    name: string;
    accounts: { id: string; name: string; currency: string }[];
  };
};

// One account per currency: the first of each in the order read (the oldest), as "Banco · Cuenta".
const firstPerCurrency = (
  bankName: string,
  accounts: CardRecord["bank"]["accounts"],
): DebitAccount[] => {
  const seen = new Set<string>();

  return accounts.flatMap((account) => {
    if (seen.has(account.currency)) {
      return [];
    }

    seen.add(account.currency);

    return [
      {
        id: account.id,
        currency: account.currency,
        label: accountLabel(bankName, account.name),
      },
    ];
  });
};

const toCard = (row: CardRecord): Card => {
  const identity = {
    id: row.id,
    bankId: row.bankId,
    bankName: row.bank.name,
    last4: row.last4,
    brand: row.brand,
  };

  if (row.kind === "DEBIT") {
    return {
      ...identity,
      kind: "DEBIT",
      accounts: firstPerCurrency(row.bank.name, row.bank.accounts),
    };
  }

  // A CHECK constraint of the table keeps the cycle and the mode of a credit card set.
  if (
    row.closingDay === null ||
    row.dueDay === null ||
    row.limitMode === null
  ) {
    throw new Error(`The credit card ${row.id} has no cycle`);
  }

  return {
    ...identity,
    kind: "CREDIT",
    closingDay: row.closingDay,
    dueDay: row.dueDay,
    limitMode: row.limitMode,
    limits: row.limits.map(({ currency, amount }) => ({
      currency,
      amount: minorUnitsToNumber(amount),
    })),
  };
};

// Explicit field list: the owner, the id, the kind and the bank are never part of an update. A debit
// card writes nulls, which the table's CHECK constraint requires.
const toCardData = (input: CardInput) =>
  input.kind === "CREDIT"
    ? {
        last4: input.last4,
        brand: input.brand,
        closingDay: input.closingDay,
        dueDay: input.dueDay,
        limitMode: input.limitMode,
      }
    : {
        last4: input.last4,
        brand: input.brand,
        closingDay: null,
        dueDay: null,
        limitMode: null,
      };

const toLimitData = (input: CardInput) =>
  input.kind === "CREDIT"
    ? input.limits.map(({ currency, amount }) => ({
        currency,
        amount: BigInt(amount),
      }))
    : [];

// The charges of every card of the user, one read for all the cards: every expense that has a card,
// installments and purchases in one payment alike. The ones somebody else covered are not read, they
// never weigh on a cap; the pure usage functions decide, by the card's mode, which of the PLANNED and
// SETTLED ones count.
const findChargesByCard = async (
  userId: string,
): Promise<Map<string, CardCharge[]>> => {
  const rows = await prisma.expense.findMany({
    where: {
      userId,
      cardId: { not: null },
      status: { in: ["PLANNED", "SETTLED"] },
    },
    select: {
      amount: true,
      date: true,
      currency: true,
      status: true,
      cardId: true,
    },
  });
  const byCard = new Map<string, CardCharge[]>();

  for (const row of rows) {
    if (!row.cardId) {
      continue;
    }

    byCard.set(row.cardId, [
      ...(byCard.get(row.cardId) ?? []),
      {
        amount: minorUnitsToNumber(row.amount),
        date: dateToIsoDate(row.date),
        currency: row.currency,
        status: row.status,
      },
    ]);
  }

  return byCard;
};

const findCardsWithCharges = async (
  userId: string,
): Promise<CardWithCharges[]> => {
  const [rows, charges] = await Promise.all([
    prisma.card.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: WITH_CARD_DETAILS,
    }),
    findChargesByCard(userId),
  ]);

  return rows.map((row) => ({
    ...toCard(row),
    charges: charges.get(row.id) ?? [],
  }));
};

// The user's cards with what each credit card has used of each of its caps in `month` (the current
// month in Argentina by default); a debit card has no cap, so no usage. Every read is scoped by
// userId, so one user can never see another user's cards.
export const listCards = async (
  userId: string,
  month: string = monthOf(todayIso()),
): Promise<CardWithUsage[]> => {
  const cards = await findCardsWithCharges(userId);

  return cards.map(({ charges, ...card }) => {
    if (card.kind === "DEBIT") {
      return { ...card, usage: [] };
    }

    return {
      ...card,
      usage: card.limits.map((limit) => ({
        ...limit,
        ...usageOf(
          {
            currency: limit.currency,
            limitMode: card.limitMode,
            limitAmount: limit.amount,
          },
          charges,
          month,
        ),
      })),
    };
  });
};

// The user's cards with the charges made with each, which is what the planner needs to project a
// purchase on every card and see whether it fits, and what the expense form needs to offer them.
export const listCardsWithCharges = (
  userId: string,
): Promise<CardWithCharges[]> => findCardsWithCharges(userId);

// A card id that comes from the client is never trusted: it must belong to the user. Returns the
// card: its cycle decides a credit charge's date, its bank's accounts a debit expense's account.
export const findOwnedCard = async (
  userId: string,
  cardId: string,
): Promise<Card> => {
  const found = await prisma.card.findFirst({
    where: { id: cardId, userId },
    include: WITH_CARD_DETAILS,
  });

  if (!found) {
    throw new CardNotFoundError();
  }

  return toCard(found);
};

// The bank of a new card must be the user's and active. (An archive in the same instant can still
// land; the card then keeps its bank, like every card of a bank archived later.)
const assertUsableBank = async (
  userId: string,
  bankId: string,
): Promise<void> => {
  const bank = await prisma.bank.findFirst({
    where: { id: bankId, userId },
    select: { archivedAt: true },
  });

  if (!bank) {
    throw new BankNotFoundError();
  }

  if (bank.archivedAt !== null) {
    throw new BankArchivedError();
  }
};

export const createCard = async (
  userId: string,
  input: CardInput,
): Promise<Card> => {
  await assertUsableBank(userId, input.bankId);

  try {
    const row = await prisma.card.create({
      data: {
        userId,
        kind: input.kind,
        bankId: input.bankId,
        ...toCardData(input),
        limits: { create: toLimitData(input) },
      },
      include: WITH_CARD_DETAILS,
    });

    return toCard(row);
  } catch (error) {
    // A user has one card per brand and last four digits; the constraint is what decides.
    if (isUniqueConstraintError(error)) {
      throw new DuplicateCardError(input.brand, input.last4);
    }

    throw error;
  }
};

// The kind and the bank never change (a credit card may have plans hanging from it); everything else
// does, and the caps are replaced as a whole, in the same transaction as the card.
export const updateCard = async (
  userId: string,
  id: string,
  input: CardInput,
): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.card.findFirst({
        where: { id, userId },
        select: { kind: true, bankId: true },
      });

      if (!current) {
        throw new CardNotFoundError();
      }

      if (current.kind !== input.kind) {
        throw new CardKindLockedError();
      }

      if (current.bankId !== input.bankId) {
        throw new CardBankLockedError();
      }

      const { count } = await tx.card.updateMany({
        where: { id, userId },
        data: toCardData(input),
      });

      if (count === 0) {
        throw new CardNotFoundError();
      }

      await tx.cardLimit.deleteMany({ where: { cardId: id } });

      const limits = toLimitData(input);

      if (limits.length > 0) {
        await tx.cardLimit.createMany({
          data: limits.map((limit) => ({ cardId: id, ...limit })),
        });
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateCardError(input.brand, input.last4);
    }

    throw error;
  }
};
```

Then append the unchanged `deleteCard` and `deleteCards` (copy them as they are now, with their comments, from the old file).

Run: `npx vitest run core/cards/service.test.ts core/cards/service.bulkDelete.test.ts`
Expected: PASS.

- [ ] **Step 10: Write the failing action tests, then the actions**

Replace the whole content of `core/cards/actions.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  createCard: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createCard: mocks.createCard,
  updateCard: mocks.updateCard,
  deleteCard: mocks.deleteCard,
}));

import { BankArchivedError, BankNotFoundError } from "@/core/banks/errors";

import {
  CardBankLockedError,
  CardHasPendingExpensesError,
  CardKindLockedError,
  CardNotFoundError,
  DuplicateCardError,
} from "./errors";
import {
  createCardAction,
  deleteCardAction,
  updateCardAction,
} from "./actions";

const USER_ID = "user_123";

const formOf = (
  patch: Record<string, string | undefined> = {},
  limits: [string, string][] = [["ARS", "300000"]],
): FormData => {
  const values: Record<string, string | undefined> = {
    kind: "CREDIT",
    bankId: "bank_1",
    last4: "1234",
    brand: "VISA",
    closingDay: "25",
    dueDay: "5",
    limitMode: "MONTHLY",
    ...patch,
  };
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) {
      formData.set(key, value);
    }
  });
  limits.forEach(([currency, amount]) => {
    formData.append("limitCurrency", currency);
    formData.append("limitAmount", amount);
  });

  return formData;
};

const debitForm = () =>
  formOf(
    {
      kind: "DEBIT",
      last4: "9999",
      brand: "MASTERCARD",
      closingDay: undefined,
      dueDay: undefined,
      limitMode: undefined,
    },
    [],
  );

const STORED = {
  kind: "CREDIT",
  bankId: "bank_1",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  limitMode: "MONTHLY",
  limits: [{ currency: "ARS", amount: 30000000 }],
};

const INVALID = "Corrige los campos resaltados.";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("createCardAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await createCardAction(formOf())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createCard).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await createCardAction(
      formOf({ last4: "12", closingDay: "40" }),
    );

    expect(result).toEqual({
      status: "error",
      message: INVALID,
      fieldErrors: {
        last4: ["Ingresá exactamente 4 dígitos."],
        closingDay: [
          "El día de cierre debe ser un número entero entre 1 y 31.",
        ],
      },
    });
    expect(mocks.createCard).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("puts an invalid cap on its own row", async () => {
    const result = await createCardAction(
      formOf({}, [
        ["ARS", "300000"],
        ["USD", "abc"],
      ]),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      "limits.1.amount": [
        "Ingresa un monto válido, con dígitos y un punto para los decimales.",
      ],
    });
    expect(mocks.createCard).not.toHaveBeenCalled();
  });

  it("refuses a credit card without caps", async () => {
    const result = await createCardAction(formOf({}, []));

    expect(result.status === "error" && result.fieldErrors).toEqual({
      limits: ["Agregá al menos un tope."],
    });
    expect(mocks.createCard).not.toHaveBeenCalled();
  });

  it("refuses a debit card that brings credit fields", async () => {
    const result = await createCardAction(formOf({ kind: "DEBIT" }));

    expect(
      result.status === "error" && Object.keys(result.fieldErrors ?? {}),
    ).toEqual(["closingDay", "dueDay", "limitMode", "limits"]);
    expect(mocks.createCard).not.toHaveBeenCalled();
  });

  it("creates a credit card for the authenticated user, each cap in minor units", async () => {
    mocks.createCard.mockResolvedValue({ id: "card_1", ...STORED });

    expect(
      await createCardAction(
        formOf({}, [
          ["USD", "1000"],
          ["ARS", "300000"],
        ]),
      ),
    ).toEqual({ status: "success" });
    expect(mocks.createCard).toHaveBeenCalledWith(USER_ID, {
      ...STORED,
      limits: [
        { currency: "ARS", amount: 30000000 },
        { currency: "USD", amount: 100000 },
      ],
    });
  });

  it("creates a debit card with only its kind, bank, digits and brand", async () => {
    mocks.createCard.mockResolvedValue({ id: "card_9" });

    expect(await createCardAction(debitForm())).toEqual({ status: "success" });
    expect(mocks.createCard).toHaveBeenCalledWith(USER_ID, {
      kind: "DEBIT",
      bankId: "bank_1",
      last4: "9999",
      brand: "MASTERCARD",
    });
  });

  it("ignores a userId in the form", async () => {
    const formData = formOf();

    formData.set("userId", "attacker");
    mocks.createCard.mockResolvedValue({ id: "card_1", ...STORED });

    await createCardAction(formData);

    expect(mocks.createCard.mock.calls[0][0]).toBe(USER_ID);
    expect(mocks.createCard.mock.calls[0][1]).not.toHaveProperty("userId");
  });

  it("revalidates the cards page", async () => {
    mocks.createCard.mockResolvedValue({ id: "card_1", ...STORED });

    await createCardAction(formOf());

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/cards");
  });

  it("puts a duplicate card on the last four digits field", async () => {
    mocks.createCard.mockRejectedValue(new DuplicateCardError("VISA", "1234"));

    expect(await createCardAction(formOf())).toEqual({
      status: "error",
      message: INVALID,
      fieldErrors: { last4: ["Ya tenés una tarjeta Visa terminada en 1234."] },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("puts a bank that is not the user's, or archived, on the bank field", async () => {
    mocks.createCard.mockRejectedValueOnce(new BankNotFoundError());
    mocks.createCard.mockRejectedValueOnce(new BankArchivedError());

    expect(await createCardAction(formOf())).toEqual({
      status: "error",
      message: INVALID,
      fieldErrors: { bankId: ["Elegí un banco válido."] },
    });
    expect(await createCardAction(formOf())).toEqual({
      status: "error",
      message: INVALID,
      fieldErrors: {
        bankId: [
          "Este banco está archivado. Elegí otro o reactivalo en Bancos.",
        ],
      },
    });
  });

  it("returns a generic error when the service fails", async () => {
    mocks.createCard.mockRejectedValue(new Error("db down"));

    expect(await createCardAction(formOf())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});

describe("updateCardAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await updateCardAction("card_1", formOf())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.updateCard).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a text without touching the service", async () => {
    expect(await updateCardAction(undefined as never, formOf())).toEqual({
      status: "error",
      message: "No se encontró la tarjeta.",
    });
    expect(mocks.updateCard).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await updateCardAction("card_1", formOf({ brand: "AMEX" }));

    expect(result.status === "error" && result.fieldErrors).toEqual({
      brand: ["Seleccioná una marca válida."],
    });
    expect(mocks.updateCard).not.toHaveBeenCalled();
  });

  it("updates the card of the authenticated user and revalidates the page", async () => {
    mocks.updateCard.mockResolvedValue(undefined);

    expect(
      await updateCardAction("card_1", formOf({ limitMode: "TOTAL" })),
    ).toEqual({ status: "success" });
    expect(mocks.updateCard).toHaveBeenCalledWith(USER_ID, "card_1", {
      ...STORED,
      limitMode: "TOTAL",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/cards");
  });

  it("says the card was not found when it is not the user's", async () => {
    mocks.updateCard.mockRejectedValue(new CardNotFoundError());

    expect(await updateCardAction("card_9", formOf())).toEqual({
      status: "error",
      message: "No se encontró la tarjeta.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("puts a change of kind on the kind field and a change of bank on the bank field", async () => {
    mocks.updateCard.mockRejectedValueOnce(new CardKindLockedError());
    mocks.updateCard.mockRejectedValueOnce(new CardBankLockedError());

    expect(await updateCardAction("card_1", formOf())).toEqual({
      status: "error",
      message: INVALID,
      fieldErrors: { kind: ["El tipo de una tarjeta no se puede cambiar."] },
    });
    expect(await updateCardAction("card_1", formOf())).toEqual({
      status: "error",
      message: INVALID,
      fieldErrors: { bankId: ["El banco de una tarjeta no se puede cambiar."] },
    });
  });

  it("puts a duplicate card on the last four digits field", async () => {
    mocks.updateCard.mockRejectedValue(new DuplicateCardError("OTHER", "4321"));

    const result = await updateCardAction("card_1", formOf());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      last4: ["Ya tenés una tarjeta Otra terminada en 4321."],
    });
  });
});

describe("deleteCardAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await deleteCardAction("card_1")).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.deleteCard).not.toHaveBeenCalled();
  });

  it("deletes the card of the authenticated user and revalidates the page", async () => {
    mocks.deleteCard.mockResolvedValue(undefined);

    expect(await deleteCardAction("card_1")).toEqual({ status: "success" });
    expect(mocks.deleteCard).toHaveBeenCalledWith(USER_ID, "card_1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/cards");
  });

  it("explains why a card with pending installments cannot be deleted", async () => {
    mocks.deleteCard.mockRejectedValue(new CardHasPendingExpensesError());

    expect(await deleteCardAction("card_1")).toEqual({
      status: "error",
      message:
        "Esta tarjeta tiene gastos pendientes. Terminá de pagarlos o cambiá su tarjeta antes de eliminarla.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a text without touching the service", async () => {
    expect(await deleteCardAction(undefined as never)).toEqual({
      status: "error",
      message: "No se encontró la tarjeta.",
    });
    expect(mocks.deleteCard).not.toHaveBeenCalled();
  });
});
```

Run: `npx vitest run core/cards/actions.test.ts`
Expected: FAIL (the action still parses the old flat form; the new errors are not mapped).

In `core/cards/actions.ts`:

- replace the imports of `./consts`, `./errors`, `./schema` and the `import { z } from "zod";` line with:

```ts
import { BankArchivedError, BankNotFoundError } from "@/core/banks/errors";

import {
  CARD_BANK_ARCHIVED_MESSAGE,
  CARD_BANK_LOCKED_MESSAGE,
  CARD_BANK_NOT_FOUND_MESSAGE,
  CARD_FORM_FIELDS,
  CARD_HAS_PENDING_MESSAGE,
  CARD_KIND_LOCKED_MESSAGE,
  CARD_NOT_FOUND_MESSAGE,
  CARDS_NOT_FOUND_MESSAGE,
  CARDS_PATH,
  duplicateCardMessage,
} from "./consts";
import {
  CardBankLockedError,
  CardHasPendingExpensesError,
  CardKindLockedError,
  CardNotFoundError,
  DuplicateCardError,
} from "./errors";
import { readLimitRows } from "./formLimits";
import { parseCardInput } from "./schema";
```

(keep the `./service` import, and keep `CardActionResult`, `CardInput`, `CardsDeleteResult` in the `./types` import; drop `CardFieldErrors` from it);

- replace `parseCardForm` with:

```ts
// The single-value fields plus the caps, which travel as repeated pairs.
const parseCardForm = (formData: FormData): ParsedForm => {
  const result = parseCardInput({
    ...readForm(formData, CARD_FORM_FIELDS),
    limits: readLimitRows(formData),
  });

  return result.success
    ? { data: result.data }
    : { error: fieldFailure(result.fieldErrors) };
};
```

- in `toKnownFailure`, add before `return undefined;`:

```ts
if (error instanceof CardKindLockedError) {
  return fieldFailure({ kind: [CARD_KIND_LOCKED_MESSAGE] });
}

if (error instanceof CardBankLockedError) {
  return fieldFailure({ bankId: [CARD_BANK_LOCKED_MESSAGE] });
}

if (error instanceof BankNotFoundError) {
  return fieldFailure({ bankId: [CARD_BANK_NOT_FOUND_MESSAGE] });
}

if (error instanceof BankArchivedError) {
  return fieldFailure({ bankId: [CARD_BANK_ARCHIVED_MESSAGE] });
}
```

- in `updateCardAction`, add at the top of the `runAuthenticated` callback, before parsing:

```ts
// An id that is not text cannot be a card of the user (and undefined would vanish from a where).
if (typeof id !== "string" || id.length === 0) {
  return failure(CARD_NOT_FOUND_MESSAGE);
}
```

Run: `npx vitest run core/cards`
Expected: PASS (all card files).

#### Part C — the other readers of `Card`

- [ ] **Step 11: The planner's and the expense's card checks, and the error mapping (tests first)**

In `core/entries/actionHelpers.test.ts`, add `import { CardKindNotAllowedError } from "@/core/cards/errors";` and append:

```ts
describe("runAuthenticated and the card of a purchase", () => {
  it("puts a card of the wrong kind on the Tarjeta field", async () => {
    expect(await failWith(new CardKindNotAllowedError())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { cardId: ["Elegí una tarjeta de crédito."] },
    });
  });
});
```

In `core/installments/service.test.ts`:

- add the imports `import { CardKindNotAllowedError } from "@/core/cards/errors";`, `import { WITH_CARD_DETAILS } from "@/core/cards/service";` and `import { creditCardRecord, debitCardRecord } from "@/core/cards/testFixtures";`;
- delete the local `cardRow` builder (inside `describe("with a card and the day of the purchase")`) and replace `cardRow()` with `creditCardRecord()` and `cardRow({ currency: "USD" })` with `creditCardRecord({ currency: "USD" })`;
- in "verifies the card belongs to the user before writing anything", expect `{ where: { id: "card_1", userId: USER_ID }, include: WITH_CARD_DETAILS }`;
- append inside the same `describe`:

```ts
it("writes nothing when the card is a debit card: installments are paid with a credit card", async () => {
  db.card.findFirst.mockResolvedValue(debitCardRecord({ id: "card_1" }));

  await expect(createInstallmentPlan(USER_ID, withCard)).rejects.toBeInstanceOf(
    CardKindNotAllowedError,
  );
  expect(db.$transaction).not.toHaveBeenCalled();
});

it("takes a credit card that has a cap in the currency of the purchase among others", async () => {
  db.card.findFirst.mockResolvedValue(
    creditCardRecord({
      limits: [
        { id: "l1", cardId: "card_1", currency: "ARS", amount: BigInt(1) },
        { id: "l2", cardId: "card_1", currency: "USD", amount: BigInt(1) },
      ],
    }),
  );

  await createInstallmentPlan(USER_ID, withCard);

  expect(db.$transaction).toHaveBeenCalledTimes(1);
});
```

In `core/expenses/service.test.ts`:

- add the imports `import { CardKindNotAllowedError } from "@/core/cards/errors";` (into the existing `@/core/cards/errors` import), `import { WITH_CARD_DETAILS } from "@/core/cards/service";` and `import { creditCardRecord, debitCardRecord } from "@/core/cards/testFixtures";`;
- delete the local `cardRow` builder and move its comment ("Closes on the 25th and is paid on the 5th: …") above `const cardInput`, since `creditCardRecord()` has the same cycle; replace every `cardRow()` with `creditCardRecord()` and every `cardRow({ currency: "USD" })` with `creditCardRecord({ currency: "USD" })`;
- in the two tests that assert `card.findFirst` was called (`"looks the card up among the user's own"` and `"recomputes the charge date from the card, …"`), expect `{ where: { id: "card_1", userId: USER_ID }, include: WITH_CARD_DETAILS }`;
- append inside `describe("createExpense") > describe("with a card")`:

```ts
it("refuses a debit card for now, writing nothing", async () => {
  card.findFirst.mockResolvedValue(debitCardRecord({ id: "card_1" }));

  await expect(createExpense(USER_ID, cardInput)).rejects.toBeInstanceOf(
    CardKindNotAllowedError,
  );
  expect(expense.create).not.toHaveBeenCalled();
});
```

(Task 4 replaces this test: a debit card is then resolved to its bank's account.)

Run: `npx vitest run core/entries/actionHelpers.test.ts core/installments/service.test.ts core/expenses/service.test.ts`
Expected: FAIL (`CardKindNotAllowedError` is not mapped; the services still read `card.currency`, which no longer exists, so the currency checks misbehave).

In `core/entries/actionHelpers.ts`, add `CARD_KIND_NOT_ALLOWED_MESSAGE` to the `@/core/cards/consts` import and `CardKindNotAllowedError` to the `@/core/cards/errors` import, and add after the `CardCurrencyMismatchError` branch:

```ts
if (error instanceof CardKindNotAllowedError) {
  return fieldFailure({ cardId: [CARD_KIND_NOT_ALLOWED_MESSAGE] });
}
```

In `core/installments/service.ts`, add the imports `import { CardKindNotAllowedError } from "@/core/cards/errors";` (into the existing `@/core/cards/errors` import, next to `CardCurrencyMismatchError`) and `import { isCreditCard, limitIn } from "@/core/cards/kinds";`, and replace

```ts
const card = await findOwnedCard(userId, input.cardId);

if (card.currency !== input.currency) {
  throw new CardCurrencyMismatchError();
}
```

with

```ts
const card = await findOwnedCard(userId, input.cardId);

// A purchase in installments is paid with a credit card that has a cap in its currency.
if (!isCreditCard(card)) {
  throw new CardKindNotAllowedError();
}

if (!limitIn(card, input.currency)) {
  throw new CardCurrencyMismatchError();
}
```

and change the comment above `resolveSchedule` from "the card must be the user's and in the currency of the purchase" to "the card must be the user's, a credit card, and have a cap in the currency of the purchase".

In `core/expenses/service.ts`, add `CardKindNotAllowedError` to the `@/core/cards/errors` import and `import { isCreditCard, limitIn } from "@/core/cards/kinds";`, and replace inside `resolveCharge`

```ts
const card = await findOwnedCard(userId, input.cardId);

if (card.currency !== input.currency) {
  throw new CardCurrencyMismatchError();
}
```

with

```ts
const card = await findOwnedCard(userId, input.cardId);

// Only a credit card has a billing cycle; a debit card on an expense is refused for now.
if (!isCreditCard(card)) {
  throw new CardKindNotAllowedError();
}

if (!limitIn(card, input.currency)) {
  throw new CardCurrencyMismatchError();
}
```

Run: `npx vitest run core/entries core/installments core/expenses`
Expected: PASS.

- [ ] **Step 12: The card field and the form options offer a card in each of its currencies (tests first)**

In `components/Entries/components/CardField/CardField.test.tsx`, replace `CARDS` with:

```ts
const CARDS = [
  { id: "visa", title: "Visa •••• 1234", currencies: ["ARS"] },
  { id: "master", title: "Mastercard •••• 9999", currencies: ["ARS"] },
  { id: "dollars", title: "Visa •••• 4321", currencies: ["USD"] },
  { id: "both", title: "Visa •••• 5555", currencies: ["EUR", "USD"] },
];
```

change the expectation of "follows the currency: other currency, other cards" to `["Sin tarjeta", "Visa •••• 4321", "Visa •••• 5555"]`, and append inside `describe("CardField")`:

```ts
it("offers a card in every currency it can pay in, and in no other", async () => {
  renderField({ currency: "EUR" });

  const options = await open();

  expect(options.map((option) => option.textContent)).toEqual([
    "Sin tarjeta",
    "Visa •••• 5555",
  ]);
});
```

Run: `npx vitest run components/Entries/components/CardField`
Expected: FAIL (the field still filters by `card.currency`).

In `components/Entries/components/CardField/types.ts`, replace `currency: string;` inside `CardChoice` with:

```ts
  // The currencies the card can pay in: a credit card's caps, a debit card's accounts.
  currencies: readonly string[];
```

and in `CardField.tsx` replace `const options = cards.filter((card) => card.currency === currency);` with `const options = cards.filter((card) => card.currencies.includes(currency));`, and the comment line "Only the cards in the currency of the purchase are listed." with "Only the cards that can pay in the currency of the purchase are listed."

In `components/Expenses/types.ts`, replace the `CardOption` interface (and its comment) with:

```ts
// A card the forms can pay with: the card with its charges (the planner projects a purchase against
// them), its title ("Visa •••• 1234") and the currencies it can pay in.
export type CardOption = CardWithCharges & {
  title: string;
  currencies: string[];
};

export type CreditCardOption = Extract<CardOption, { kind: "CREDIT" }>;
```

In `components/Expenses/utils.ts`, add `import { cardCurrencies } from "@/core/cards/kinds";` and replace `toCardOptions` with:

```ts
// The cards the forms offer, titled like the cards page does, with the currencies each can pay in.
export const toCardOptions = (
  cards: readonly CardWithCharges[],
): CardOption[] =>
  cards.map((card) => ({
    ...card,
    title: cardTitle(BRAND_NAMES[card.brand], card.last4),
    currencies: cardCurrencies(card),
  }));
```

Create `components/Expenses/testCards.ts`:

```ts
import { creditCard, debitCard } from "@/core/cards/testFixtures";
import type { CreditCardPatch } from "@/core/cards/testFixtures";
import type { CardCharge, DebitCard } from "@/core/cards/types";

import type { CardOption, CreditCardOption } from "./types";

interface OptionExtras {
  title?: string;
  charges?: CardCharge[];
}

// Builders for the tests of the forms: a card as toCardOptions hands it to them.
export const creditOption = ({
  title = "Visa •••• 1234",
  charges = [],
  ...patch
}: CreditCardPatch & OptionExtras = {}): CreditCardOption => {
  const card = creditCard(patch);

  return {
    ...card,
    title,
    charges,
    currencies: card.limits.map(({ currency }) => currency),
  };
};

export const debitOption = ({
  title = "Visa •••• 9999",
  charges = [],
  ...patch
}: Partial<DebitCard> & OptionExtras = {}): CardOption => {
  const card = debitCard(patch);

  return {
    ...card,
    title,
    charges,
    currencies: card.accounts.map(({ currency }) => currency),
  };
};
```

In `app/dashboard/expenses/loadExpensesView.test.ts`:

- add `import { creditCard } from "@/core/cards/testFixtures";`;
- replace the `cards: [ { id: "card_1", … charges: [ … ] } ]` entry of the loaded fixture with:

```ts
  cards: [
    {
      ...creditCard(),
      charges: [
        {
          amount: 1000,
          date: "2026-09-05",
          currency: "ARS",
          status: "PLANNED" as const,
        },
      ],
    },
  ],
```

- in "gives the forms the user's cards titled like 'Visa •••• 1234', …", replace the `toMatchObject` with:

```ts
expect(card).toMatchObject({
  id: "card_1",
  kind: "CREDIT",
  title: "Visa •••• 1234",
  currencies: ["ARS"],
  closingDay: 25,
  dueDay: 5,
  limitMode: "MONTHLY",
  limits: [{ currency: "ARS", amount: 30000000 }],
});
```

In `components/Expenses/components/ExpenseFormDrawer/utils.ts`, replace the body's first check with:

```ts
// Only a credit card has a cycle; a debit card takes the money the same day.
if (!card || card.kind !== "CREDIT" || !purchaseDate) {
  return null;
}
```

In `ExpenseFormContent.tsx`:

- replace the `card` lookup with:

```tsx
const card = isInstallment
  ? undefined
  : cards.find(
      (option) => option.id === cardId && option.currencies.includes(currency),
    );
```

- in `handleCurrencyChange`, replace `if (card && card.currency !== next) {` with `if (card && !card.currencies.includes(next)) {`;
- in the date field, replace `label={card ? PURCHASE_DATE_LABEL : DATE_LABEL}` with `label={card?.kind === "CREDIT" ? PURCHASE_DATE_LABEL : DATE_LABEL}` and the comment above it with "With a credit card the date is the purchase day, and the card works out when it charges it.";
- update the comment "Only the cards in the currency of the expense are offered" to "Only the cards that can pay in the currency of the expense are offered".

In `ExpenseFormDrawer.test.tsx`, add `import { creditOption } from "../../testCards";` and replace the two fixtures with:

```ts
// Closes on the 25th and is paid on the 5th.
const CARD: CardOption = creditOption();

const DOLLAR_CARD: CardOption = creditOption({
  id: "card_2",
  title: "Mastercard •••• 9999",
  brand: "MASTERCARD",
  last4: "9999",
  currency: "USD",
});
```

In `ExpenseFormDrawer.origin.test.tsx`, add the same import and replace its `CARD` with `const CARD: CardOption = creditOption();`.

Run: `npx vitest run components/Entries/components/CardField components/Expenses app/dashboard/expenses`
Expected: the CardField, expense form and loader tests PASS; the planner tests still FAIL to compile (next step).

- [ ] **Step 13: The planner takes only credit cards (tests first)**

In `components/Expenses/components/InstallmentPlannerDrawer/InstallmentPlannerDrawer.test.tsx`, add `import { creditOption, debitOption } from "../../testCards";` and replace the five fixtures with:

```ts
// Closes on the 25th and is paid on the 5th, with room for a purchase of $ 1.200.000: bought on
// October 1 it goes in the October statement, paid on November 5.
const VISA: CardOption = creditOption({
  id: "visa",
  limitMode: "TOTAL",
  limitAmount: 200000000,
});
// $ 1.300.000 of cap: the purchase fits but leaves less than a fifth of it.
const TIGHT: CardOption = creditOption({
  id: "tight",
  title: "Mastercard •••• 9999",
  brand: "MASTERCARD",
  last4: "9999",
  closingDay: 28,
  limitMode: "TOTAL",
  limitAmount: 130000000,
});
// $ 1.000.000 of cap: the purchase does not fit.
const SMALL: CardOption = creditOption({
  id: "small",
  title: "Visa •••• 5555",
  last4: "5555",
  closingDay: 30,
  limitMode: "TOTAL",
  limitAmount: 100000000,
});
// Closes on the 5th and is paid on the 28th: bought on October 1 it is charged this very month.
const THIS_MONTH: CardOption = creditOption({
  id: "now",
  title: "Visa •••• 7777",
  last4: "7777",
  closingDay: 5,
  dueDay: 28,
  limitMode: "TOTAL",
  limitAmount: 200000000,
});
const DOLLARS: CardOption = creditOption({
  id: "usd",
  title: "Visa •••• 4321",
  last4: "4321",
  currency: "USD",
  limitMode: "TOTAL",
  limitAmount: 200000000,
});
// A debit card of the same currency: the planner must never offer it.
const DEBIT: CardOption = debitOption({ id: "debit", title: "Visa •••• 9999" });
```

and append right after the test "offers only the cards in the currency of the purchase":

```ts
it("never offers a debit card: a purchase in installments is paid with a credit card", async () => {
  renderPlanner([VISA, DEBIT]);

  fireEvent.keyDown(cardButton(), { key: "ArrowDown" });

  const options = await screen.findAllByRole("option");

  expect(options.map((option) => option.textContent)).toEqual([
    "Visa •••• 1234",
  ]);
});

it("treats a user whose only card is a debit card like one with no cards: a borrowed card", () => {
  renderPlanner([DEBIT]);

  expect(screen.getByRole("radio", { name: /Prestada/ })).toBeChecked();
  expect(screen.getByRole("radio", { name: /Propia/ })).not.toBeChecked();
  expect(
    screen.queryByRole("button", { name: /Tarjeta/ }),
  ).not.toBeInTheDocument();
});
```

In `components/Expenses/components/InstallmentPlannerDrawer/utils.test.ts`, replace the import `import type { CardOption } from "../../types";` with

```ts
import type { CreditCardPatch } from "@/core/cards/testFixtures";
import type { CardCharge } from "@/core/cards/types";

import { creditOption } from "../../testCards";
import type { CreditCardOption } from "../../types";
```

and the `card` builder with:

```ts
// $ 2.000.000,00 of TOTAL cap, closing on the 25th and paid on the 5th.
const card = (
  patch: CreditCardPatch & { title?: string; charges?: CardCharge[] } = {},
): CreditCardOption =>
  creditOption({
    id: "visa",
    limitMode: "TOTAL",
    limitAmount: 200000000,
    ...patch,
  });
```

(every other use of `CardOption` in that file becomes `CreditCardOption`).

Run: `npx vitest run components/Expenses/components/InstallmentPlannerDrawer`
Expected: FAIL (the drawer still passes every card to the planner, so the debit card is offered; the utils do not compile with `CreditCardOption` yet).

In `components/Expenses/components/InstallmentPlannerDrawer/types.ts`:

- replace `import type { CardOption } from "../../types";` with `import type { CardOption, CreditCardOption } from "../../types";`;
- replace `InstallmentPlannerContentProps` with:

```ts
// The planner itself only ever sees credit cards: the drawer leaves the debit ones out.
export interface InstallmentPlannerContentProps extends Pick<
  InstallmentPlannerDrawerProps,
  "onClose" | "defaultDate" | "categories" | "accounts"
> {
  cards: readonly CreditCardOption[];
}
```

- in `PurchaseSummary`, change `card: CardOption | null;` to `card: CreditCardOption | null;` (keep `CardOption` for the drawer props).

In `components/Expenses/components/InstallmentPlannerDrawer/utils.ts`, replace `import type { CardOption } from "../../types";` with `import type { CreditCardOption } from "../../types";`, replace every `CardOption` in the file with `CreditCardOption`, and replace `chosenCard` with:

```ts
// The card chosen, if it still exists and has a cap in the currency of the purchase. A card in another
// currency never pays a purchase.
const chosenCard = (
  values: PurchaseValues,
  cards: readonly CreditCardOption[],
): CreditCardOption | null =>
  cards.find(
    ({ id, currencies }) =>
      id === values.cardId && currencies.includes(values.currency),
  ) ?? null;
```

In `InstallmentPlannerDrawer.tsx`, add `import { isCreditCard } from "@/core/cards/kinds";` and replace `cards={cards}` with `cards={cards.filter(isCreditCard)}`, with this comment above the `<InstallmentPlannerContent`: `{/* A purchase in installments is paid with a credit card: the debit ones never reach the planner. */}`.

Run: `npx vitest run components/Expenses`
Expected: PASS.

#### Part D — the Cards table

- [ ] **Step 14: Read the docs, then write the failing row and table tests**

Read `C:\Users\Nico\Desktop\insight-in\.heroui-docs\react\components\(data-display)\table.mdx` and `(feedback)\progress-bar.mdx`, and the current `components/Cards/components/CardsTable/CardsTable.tsx` and `components/UsageCell/UsageCell.tsx`.

Create `components/Cards/testRows.ts`:

```ts
import type { CardLimitRow, CardRow } from "./types";

// Builders for the tests of the Cards page: rows as toCardRows formats them.

export const limitRow = (patch: Partial<CardLimitRow> = {}): CardLimitRow => ({
  currency: "ARS",
  limitLabel: "$ 300.000,00 por mes",
  usedLabel: "$ 75.000,00 de $ 300.000,00",
  availableLabel: "$ 225.000,00",
  limitDecimal: "300000.00",
  percent: 25,
  tier: "available",
  ...patch,
});

export const creditCardRow = (patch: Partial<CardRow> = {}): CardRow => ({
  id: "card_1",
  kind: "CREDIT",
  bankId: "bank_1",
  bankName: "Banco Galicia",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  limitMode: "MONTHLY",
  title: "Visa •••• 1234",
  brandName: "Visa",
  kindLabel: "Crédito",
  closingLabel: "Día 25",
  dueLabel: "Día 5",
  limits: [limitRow()],
  currenciesLabel: null,
  ...patch,
});

export const debitCardRow = (patch: Partial<CardRow> = {}): CardRow => ({
  id: "card_9",
  kind: "DEBIT",
  bankId: "bank_2",
  bankName: "AstroPay",
  last4: "9999",
  brand: "MASTERCARD",
  closingDay: null,
  dueDay: null,
  limitMode: null,
  title: "Mastercard •••• 9999",
  brandName: "Mastercard",
  kindLabel: "Débito o prepago",
  closingLabel: "—",
  dueLabel: "—",
  limits: [],
  currenciesLabel: "ARS · USD",
  ...patch,
});
```

Replace the whole content of `components/Cards/utils.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { creditCard, debitCard } from "@/core/cards/testFixtures";
import type { CardLimitUsage, CardWithUsage } from "@/core/cards/types";

import { toCardRows } from "./utils";

const usage = (patch: Partial<CardLimitUsage> = {}): CardLimitUsage => ({
  currency: "ARS",
  amount: 30000000,
  committedTotal: 90000000,
  monthUsed: 7500000,
  used: 7500000,
  available: 22500000,
  tier: "available",
  ...patch,
});

const CREDIT: CardWithUsage = { ...creditCard(), usage: [usage()] };

const rowOf = (card: CardWithUsage = CREDIT) => toCardRows([card])[0];

describe("toCardRows", () => {
  it("keeps the card's own data, so the edit form can start from it", () => {
    expect(rowOf()).toMatchObject({
      id: "card_1",
      kind: "CREDIT",
      bankId: "bank_1",
      bankName: "Banco Galicia",
      last4: "1234",
      brand: "VISA",
      closingDay: 25,
      dueDay: 5,
      limitMode: "MONTHLY",
    });
  });

  it("writes the brand out next to the last four digits, and the kind in words", () => {
    expect(rowOf().title).toBe("Visa •••• 1234");
    expect(rowOf().brandName).toBe("Visa");
    expect(rowOf().kindLabel).toBe("Crédito");
    expect(
      rowOf({ ...creditCard({ brand: "MASTERCARD" }), usage: [usage()] }).title,
    ).toBe("Mastercard •••• 1234");
  });

  it("writes the closing and due days of a credit card as 'Día N'", () => {
    expect(rowOf().closingLabel).toBe("Día 25");
    expect(rowOf().dueLabel).toBe("Día 5");
  });

  describe("the caps of a credit card", () => {
    it("is one line per currency, each with its amounts in its own currency", () => {
      const [ars, usd] = rowOf({
        ...creditCard(),
        usage: [
          usage(),
          usage({
            currency: "USD",
            amount: 100000,
            used: 25000,
            available: 75000,
          }),
        ],
      }).limits;

      expect(ars.currency).toBe("ARS");
      expect(ars.limitLabel).toMatch(/^\$\s300\.000,00 por mes$/);
      expect(ars.usedLabel).toMatch(/^\$\s75\.000,00 de \$\s300\.000,00$/);
      expect(usd.currency).toBe("USD");
      expect(usd.limitLabel).toMatch(/^US\$\s1\.000,00 por mes$/);
      expect(usd.usedLabel).toMatch(/^US\$\s250,00 de US\$\s1\.000,00$/);
      expect(usd.percent).toBe(25);
    });

    it("describes a total cap as in total", () => {
      expect(
        rowOf({ ...creditCard({ limitMode: "TOTAL" }), usage: [usage()] })
          .limits[0].limitLabel,
      ).toMatch(/^\$\s300\.000,00 en total$/);
    });

    it("shows an exceeded cap as a negative available amount, with its sign", () => {
      const [line] = rowOf({
        ...creditCard(),
        usage: [
          usage({ used: 35000000, available: -5000000, tier: "exceeded" }),
        ],
      }).limits;

      expect(line.availableLabel).toMatch(/^-\$\s50\.000,00$/);
      expect(line.tier).toBe("exceeded");
      expect(line.percent).toBe(100);
    });

    it("gives each cap as plain text, to prefill the form", () => {
      expect(rowOf().limits[0].limitDecimal).toBe("300000.00");
    });

    it("is zero percent with nothing used, and rounds the share", () => {
      expect(
        rowOf({ ...creditCard(), usage: [usage({ used: 0 })] }).limits[0]
          .percent,
      ).toBe(0);
      expect(
        rowOf({ ...creditCard(), usage: [usage({ used: 1, amount: 3 })] })
          .limits[0].percent,
      ).toBe(33);
    });

    it("has no currencies line: that is a debit card's", () => {
      expect(rowOf().currenciesLabel).toBeNull();
    });
  });

  describe("a debit or prepaid card", () => {
    const DEBIT: CardWithUsage = {
      ...debitCard({
        bankName: "AstroPay",
        accounts: [
          { id: "a1", currency: "ARS", label: "AstroPay · Pesos" },
          { id: "a2", currency: "USD", label: "AstroPay · Dólares" },
        ],
      }),
      usage: [],
    };

    it("lists the currencies of its bank's active accounts, without amounts, and no caps", () => {
      expect(rowOf(DEBIT)).toMatchObject({
        kind: "DEBIT",
        kindLabel: "Débito o prepago",
        bankName: "AstroPay",
        currenciesLabel: "ARS · USD",
        limits: [],
      });
    });

    it("says so when its bank has no active account", () => {
      expect(
        rowOf({ ...debitCard({ accounts: [] }), usage: [] }).currenciesLabel,
      ).toBe("Sin cuentas activas");
    });

    it("has no cycle: a dash for the days, and no mode", () => {
      expect(rowOf(DEBIT)).toMatchObject({
        closingDay: null,
        dueDay: null,
        limitMode: null,
        closingLabel: "—",
        dueLabel: "—",
      });
    });
  });

  it("keeps the order of the cards", () => {
    const rows = toCardRows([
      { ...creditCard({ id: "a" }), usage: [usage()] },
      { ...debitCard({ id: "b" }), usage: [] },
    ]);

    expect(rows.map(({ id }) => id)).toEqual(["a", "b"]);
  });
});
```

Replace the whole content of `components/Cards/components/CardsTable/CardsTable.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { creditCardRow, debitCardRow, limitRow } from "../../testRows";
import type { CardRow } from "../../types";
import { CardsTable } from "./CardsTable";

const VISA: CardRow = creditCardRow();

// Two caps: pesos close to the cap, dollars over it.
const MASTERCARD: CardRow = creditCardRow({
  id: "card_2",
  last4: "9876",
  brand: "MASTERCARD",
  limitMode: "TOTAL",
  title: "Mastercard •••• 9876",
  brandName: "Mastercard",
  bankName: "Banco Nación",
  closingLabel: "Día 31",
  dueLabel: "Día 10",
  limits: [
    limitRow({
      limitLabel: "$ 1.200.000,00 en total",
      usedLabel: "$ 1.000.000,00 de $ 1.200.000,00",
      availableLabel: "$ 200.000,00",
      percent: 83,
      tier: "near",
    }),
    limitRow({
      currency: "USD",
      limitLabel: "US$ 1.000,00 en total",
      usedLabel: "US$ 1.100,00 de US$ 1.000,00",
      availableLabel: "-US$ 100,00",
      percent: 100,
      tier: "exceeded",
    }),
  ],
});

const DEBIT: CardRow = debitCardRow();

const renderTable = (rows: CardRow[] = [VISA, MASTERCARD, DEBIT]) => {
  const onAdd = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();

  render(
    <CardsTable
      rows={rows}
      onAdd={onAdd}
      onEdit={onEdit}
      onDelete={onDelete}
    />,
  );

  return { onAdd, onEdit, onDelete };
};

const bodyRows = () => screen.getAllByRole("row").slice(1);
const cellsOf = (row: HTMLElement) =>
  Array.from(row.querySelectorAll<HTMLTableCellElement>("td"));

// 0 Acciones, 1 Tarjeta, 2 Tipo, 3 Banco, 4 Cierre, 5 Vencimiento, 6 Tope, 7 Uso, 8 Disponible.
describe("CardsTable columns", () => {
  it("lists Actions first, then the card, its kind and bank, its cycle, its caps, their use and what is available", () => {
    renderTable();

    expect(
      screen
        .getAllByRole("columnheader")
        .map((header) => header.textContent?.trim()),
    ).toEqual([
      "Acciones",
      "Tarjeta",
      "Tipo",
      "Banco",
      "Cierre",
      "Vencimiento",
      "Tope",
      "Uso",
      "Disponible",
    ]);
  });

  it("writes the card with its brand logo and last four digits", () => {
    renderTable();

    expect(bodyRows().map((row) => cellsOf(row)[1].textContent)).toEqual([
      "Visa •••• 1234",
      "Mastercard •••• 9876",
      "Mastercard •••• 9999",
    ]);
    expect(
      bodyRows().map((row) =>
        cellsOf(row)[1]
          .querySelector("[data-brand-logo]")
          ?.getAttribute("data-brand-logo"),
      ),
    ).toEqual(["VISA", "MASTERCARD", "MASTERCARD"]);
  });

  it("names the kind of each card and its bank", () => {
    renderTable();

    expect(bodyRows().map((row) => cellsOf(row)[2].textContent)).toEqual([
      "Crédito",
      "Crédito",
      "Débito o prepago",
    ]);
    expect(bodyRows().map((row) => cellsOf(row)[3].textContent)).toEqual([
      "Banco Galicia",
      "Banco Nación",
      "AstroPay",
    ]);
  });

  it("shows the cycle of a credit card and a dash for a debit card", () => {
    renderTable();

    const [visa, , debit] = bodyRows();

    expect(cellsOf(visa)[4]).toHaveTextContent("Día 25");
    expect(cellsOf(visa)[5]).toHaveTextContent("Día 5");
    expect(cellsOf(debit)[4]).toHaveTextContent("—");
    expect(cellsOf(debit)[5]).toHaveTextContent("—");
  });

  it("shows one cap per currency for a credit card, and the currencies of a debit card without amounts", () => {
    renderTable();

    const [visa, master, debit] = bodyRows();

    expect(cellsOf(visa)[6]).toHaveTextContent("$ 300.000,00 por mes");
    expect(cellsOf(master)[6]).toHaveTextContent("$ 1.200.000,00 en total");
    expect(cellsOf(master)[6]).toHaveTextContent("US$ 1.000,00 en total");
    expect(cellsOf(debit)[6]).toHaveTextContent("ARS · USD");
  });

  it("shows what is available per cap, with its sign when a cap was exceeded, and a dash for a debit card", () => {
    renderTable();

    const [visa, master, debit] = bodyRows();

    expect(cellsOf(visa)[8]).toHaveTextContent("$ 225.000,00");
    expect(cellsOf(master)[8]).toHaveTextContent("$ 200.000,00");
    expect(cellsOf(master)[8]).toHaveTextContent("-US$ 100,00");
    expect(cellsOf(debit)[8]).toHaveTextContent("—");
  });

  it("calls the handlers with the right row", () => {
    const { onEdit, onDelete } = renderTable();

    fireEvent.click(
      screen.getByRole("button", { name: "Editar Visa •••• 1234" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Mastercard •••• 9999" }),
    );

    expect(onEdit).toHaveBeenCalledWith(VISA);
    expect(onDelete).toHaveBeenCalledWith(DEBIT);
  });
});

describe("CardsTable usage", () => {
  it("shows a progress bar per cap, as full as the share used, named by card and currency", () => {
    renderTable();

    const bars = screen.getAllByRole("progressbar");

    expect(bars.map((bar) => bar.getAttribute("aria-valuenow"))).toEqual([
      "25",
      "83",
      "100",
    ]);
    expect(bars.map((bar) => bar.getAttribute("aria-label"))).toEqual([
      "Uso de Visa •••• 1234 en ARS",
      "Uso de Mastercard •••• 9876 en ARS",
      "Uso de Mastercard •••• 9876 en USD",
    ]);
  });

  it("shows no bar for a debit card, which has no cap", () => {
    renderTable();

    const [visa, , debit] = bodyRows();

    expect(
      cellsOf(visa)[7].querySelector("[role='progressbar']"),
    ).not.toBeNull();
    expect(cellsOf(debit)[7].querySelector("[role='progressbar']")).toBeNull();
    expect(cellsOf(debit)[7]).toHaveTextContent("—");
  });

  it("names the tier of each cap in words, gives it its icon and colours the bar", () => {
    renderTable();

    const [visa, master] = bodyRows();

    expect(cellsOf(visa)[7]).toHaveTextContent("Disponible");
    expect(cellsOf(master)[7]).toHaveTextContent("Cerca del tope");
    expect(cellsOf(master)[7]).toHaveTextContent("Excedida");
    expect(
      [...cellsOf(master)[7].querySelectorAll("svg[data-tier]")].map((icon) =>
        icon.getAttribute("data-tier"),
      ),
    ).toEqual(["near", "exceeded"]);

    const [first, second, third] = screen.getAllByRole("progressbar");

    expect(first.className).toContain("--positive");
    expect(second.className).toContain("--warning");
    expect(third.className).toContain("--danger");
  });
});

describe("CardsTable column widths", () => {
  it("uses a fixed layout, so a column's width never depends on what is inside it", () => {
    renderTable();

    expect(screen.getByRole("grid")).toHaveClass("table-fixed");
  });

  it("gives the columns that hold short values a width of their own and leaves the card to take the rest", () => {
    renderTable();

    [
      "Tipo",
      "Banco",
      "Cierre",
      "Vencimiento",
      "Tope",
      "Uso",
      "Disponible",
    ].forEach((name) => {
      expect(screen.getByRole("columnheader", { name }).className).toMatch(
        /\bw-/,
      );
    });
    expect(
      screen.getByRole("columnheader", { name: "Tarjeta" }).className,
    ).not.toMatch(/\bw-/);
  });

  it("aligns the available amount to the end, like the amounts of the other tables", () => {
    renderTable();

    expect(
      screen.getByRole("columnheader", { name: "Disponible" }),
    ).toHaveClass("text-right");
  });
});

describe("CardsTable while the cards are on their way", () => {
  it("sizes its text placeholders relative to their cell, so they can never overflow a fixed column", () => {
    const { container } = render(
      <CardsTable
        rows={[]}
        isLoading
        onAdd={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    const textCells = Array.from(
      container.querySelectorAll("tbody tr:first-child td"),
    ).slice(1);

    expect(textCells).toHaveLength(8);
    textCells.forEach((cell) => {
      expect(cell.querySelector(".skeleton")?.className).toMatch(
        /\bw-(\d+\/\d+|full)\b/,
      );
    });
  });

  it("swaps the rows for skeleton rows", () => {
    render(
      <CardsTable
        rows={[VISA]}
        isLoading
        onAdd={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.queryByText("Visa •••• 1234")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando tarjetas");
  });
});

describe("CardsTable without cards", () => {
  it("invites the user to add the first card", () => {
    const { onAdd } = renderTable([]);

    expect(screen.getByText("Todavía no tenés tarjetas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Agregar tarjeta" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe("CardsTable as a HeroUI table", () => {
  it("is named after what it lists and reads the card as the row's title", () => {
    renderTable();

    expect(screen.getByRole("grid", { name: "Tarjetas" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("rowheader").map((cell) => cell.textContent),
    ).toEqual([
      "Visa •••• 1234",
      "Mastercard •••• 9876",
      "Mastercard •••• 9999",
    ]);
  });
});

describe("CardsTable tooltips", () => {
  // A keyboard user tabs into the table first, then on to what is in its cells.
  const focusWithKeyboard = (element: HTMLElement) => {
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => screen.getByRole("grid").focus());
    act(() => element.focus());
  };

  it("shows the whole card title as a tooltip, instead of a title", () => {
    renderTable();

    const title = screen.getByText("Visa •••• 1234");

    expect(title).not.toHaveAttribute("title");
    focusWithKeyboard(title);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Visa •••• 1234");
  });

  it("shows the whole used-of-cap text of a cap as a tooltip", () => {
    renderTable();

    const used = screen.getByText("$ 75.000,00 de $ 300.000,00");

    focusWithKeyboard(used);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "$ 75.000,00 de $ 300.000,00",
    );
  });
});
```

Swap the fixtures of the other Cards tests to the builders (their assertions only use ids and titles):

- `components/Cards/Cards.test.tsx`: add `import { creditCardRow } from "./testRows";` and replace the `ROW` literal with `const ROW: CardRow = creditCardRow();`.
- `components/Cards/Cards.bulkDelete.test.tsx`: add `import { creditCardRow } from "./testRows";` and replace the three literals with:

```ts
const VISA: CardRow = creditCardRow();

const MASTERCARD: CardRow = creditCardRow({
  id: "card_2",
  last4: "9876",
  brand: "MASTERCARD",
  title: "Mastercard •••• 9876",
  brandName: "Mastercard",
});

const AMEX: CardRow = creditCardRow({
  id: "card_3",
  last4: "0007",
  brand: "OTHER",
  title: "Otra •••• 0007",
  brandName: "Otra",
});
```

- `components/Cards/components/CardsTable/CardsTable.selection.test.tsx`: add `import { creditCardRow } from "../../testRows";` and replace `VISA` and `MASTERCARD` with the same two `creditCardRow(…)` calls as above.
- `components/Cards/components/DeleteCardDialog/DeleteCardDialog.test.tsx`: add `import { creditCardRow } from "../../testRows";` and replace the `CARD` literal with `const CARD: CardRow = creditCardRow();`.
- `components/Cards/components/CardFormDrawer/CardFormDrawer.test.tsx`: add `import { creditCardRow, limitRow } from "../../testRows";` and replace the `CARD` literal with:

```ts
const CARD: CardRow = creditCardRow({
  brand: "MASTERCARD",
  title: "Mastercard •••• 1234",
  brandName: "Mastercard",
  limitMode: "TOTAL",
  limits: [
    limitRow({
      currency: "USD",
      limitLabel: "US$ 1.200,50 en total",
      usedLabel: "US$ 0,00 de US$ 1.200,50",
      availableLabel: "US$ 1.200,50",
      limitDecimal: "1200.50",
      percent: 0,
    }),
  ],
});
```

- `components/Help/markerAudit.test.tsx`: add `import { creditCardRow, limitRow } from "@/components/Cards/testRows";` and replace `CARD` and `CARDS` with:

```ts
const CARD: CardRow = creditCardRow();

const CARDS: CardRow[] = [
  CARD,
  creditCardRow({
    id: "card_2",
    title: "Visa •••• 2222",
    limits: [limitRow({ tier: "near", percent: 90 })],
  }),
  creditCardRow({
    id: "card_3",
    title: "Visa •••• 3333",
    limits: [limitRow({ tier: "exceeded", percent: 100 })],
  }),
];
```

- `app/dashboard/cards/loadCardsView.test.ts`: add `import { creditCard } from "@/core/cards/testFixtures";`, replace `CARD` with

```ts
const CARD: CardWithUsage = {
  ...creditCard({ limitMode: "TOTAL", limitAmount: 120000000 }),
  usage: [
    {
      currency: "ARS",
      amount: 120000000,
      committedTotal: 30000000,
      monthUsed: 5000000,
      used: 30000000,
      available: 90000000,
      tier: "available",
    },
  ],
};
```

and in "gives the table its formatted rows" replace the two assertions with:

```ts
expect(rows[0]).toMatchObject({
  id: "card_1",
  title: "Visa •••• 1234",
  kindLabel: "Crédito",
});
expect(rows[0].limits[0].percent).toBe(25);
expect(rows[0].limits[0].limitLabel).toMatch(/1\.200\.000,00 en total/);
```

Run: `npx vitest run components/Cards components/Help app/dashboard/cards`
Expected: FAIL (`CardRow` has none of the new fields; `toCardRows` still reads `card.limitAmount`; the table has seven columns).

- [ ] **Step 15: Write the rows, the table and the usage cell**

Replace `CardRow` in `components/Cards/types.ts` (and its imports) with:

```ts
import type { Source } from "@/components/shared/Await";
import type {
  CardBrand,
  CardKind,
  CardLimitMode,
  CardTier,
} from "@/core/cards/types";

// One cap of a credit card, formatted on the server.
export interface CardLimitRow {
  currency: string;
  // "$ 300.000,00 por mes" or "$ 1.200.000,00 en total".
  limitLabel: string;
  // "$ 75.000,00 de $ 300.000,00": what the mode counts, against the cap.
  usedLabel: string;
  // The cap minus what was used; negative once the cap is exceeded.
  availableLabel: string;
  // The cap as plain text ("300000.00"), to prefill the form.
  limitDecimal: string;
  // 0..100: the share of the cap that was used, for the progress bar.
  percent: number;
  tier: CardTier;
}

// A card plus the strings the UI needs, formatted on the server so the client never has to
// re-derive money or presentation.
export interface CardRow {
  id: string;
  kind: CardKind;
  bankId: string;
  bankName: string;
  last4: string;
  brand: CardBrand;
  // Null for a debit card, which has no statement and no cap.
  closingDay: number | null;
  dueDay: number | null;
  limitMode: CardLimitMode | null;
  // "Visa •••• 1234".
  title: string;
  // "Visa", "Mastercard" or "Otra".
  brandName: string;
  // "Crédito" or "Débito o prepago".
  kindLabel: string;
  // "Día 25" and "Día 5"; a dash for a debit card.
  closingLabel: string;
  dueLabel: string;
  // One per cap of a credit card, in currency order; none for a debit card.
  limits: CardLimitRow[];
  // What a debit card's Tope cell says ("ARS · USD", or that its bank has no active account); null
  // for a credit card.
  currenciesLabel: string | null;
}
```

(keep `CardsTableData`, `CardsProps` and `FormTarget` as they are).

In `components/Cards/consts.ts` append:

```ts
// What a cell says when the card has nothing there (a debit card's cycle, use and availability).
export const NO_VALUE_LABEL = "—";

// The Tope cell of a debit card whose bank has no active account.
export const NO_ACTIVE_ACCOUNTS_LABEL = "Sin cuentas activas";

// Between the currencies of a debit card: "ARS · USD".
export const CURRENCIES_SEPARATOR = " · ";
```

Replace the whole content of `components/Cards/utils.ts` with:

```ts
import { BRAND_NAMES, KIND_NAMES } from "@/core/cards/consts";
import type {
  CardLimitMode,
  CardLimitUsage,
  CardWithUsage,
} from "@/core/cards/types";
import { formatMoney, toDecimalString } from "@/core/incomes/money";

import {
  CURRENCIES_SEPARATOR,
  LIMIT_MODE_SUFFIXES,
  NO_ACTIVE_ACCOUNTS_LABEL,
  NO_VALUE_LABEL,
  cardTitle,
  dayLabel,
} from "./consts";
import type { CardLimitRow, CardRow } from "./types";

// The share of the cap that was used, 0..100. It stops at 100 when the cap is exceeded: the bar
// is full, and the tier says the rest.
const percentOf = (used: number, limit: number): number =>
  limit <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((used / limit) * 100)));

// One cap, in its own currency.
const toLimitRow = (
  usage: CardLimitUsage,
  limitMode: CardLimitMode,
): CardLimitRow => {
  const limit = formatMoney(usage.amount, usage.currency);

  return {
    currency: usage.currency,
    limitLabel: `${limit} ${LIMIT_MODE_SUFFIXES[limitMode]}`,
    usedLabel: `${formatMoney(usage.used, usage.currency)} de ${limit}`,
    availableLabel: formatMoney(usage.available, usage.currency),
    limitDecimal: toDecimalString(usage.amount, usage.currency),
    percent: percentOf(usage.used, usage.amount),
    tier: usage.tier,
  };
};

// Money and labels are formatted on the server so the client never re-derives presentation.
export const toCardRows = (cards: readonly CardWithUsage[]): CardRow[] =>
  cards.map((card) => {
    const brandName = BRAND_NAMES[card.brand];
    const identity = {
      id: card.id,
      kind: card.kind,
      bankId: card.bankId,
      bankName: card.bankName,
      last4: card.last4,
      brand: card.brand,
      title: cardTitle(brandName, card.last4),
      brandName,
      kindLabel: KIND_NAMES[card.kind],
    };

    if (card.kind === "DEBIT") {
      const currencies = card.accounts.map(({ currency }) => currency);

      return {
        ...identity,
        closingDay: null,
        dueDay: null,
        limitMode: null,
        closingLabel: NO_VALUE_LABEL,
        dueLabel: NO_VALUE_LABEL,
        limits: [],
        currenciesLabel:
          currencies.length > 0
            ? currencies.join(CURRENCIES_SEPARATOR)
            : NO_ACTIVE_ACCOUNTS_LABEL,
      };
    }

    return {
      ...identity,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      limitMode: card.limitMode,
      closingLabel: dayLabel(card.closingDay),
      dueLabel: dayLabel(card.dueDay),
      limits: card.usage.map((usage) => toLimitRow(usage, card.limitMode)),
      currenciesLabel: null,
    };
  });
```

Create `components/Cards/components/CardsTable/components/CellLines/types.ts`:

```ts
export interface CellLine {
  key: string;
  text: string;
}

export interface CellLinesProps {
  lines: readonly CellLine[];
}
```

`styles.ts`:

```ts
// One short value per line, stacked in the cell.
export const ROOT_CLASS_NAME = "flex w-full flex-col gap-1";

export const LINE_CLASS_NAME = "block truncate";
```

`CellLines.tsx`:

```tsx
import { LINE_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";
import type { CellLinesProps } from "./types";

// Several short values in one cell, one per line: the caps of a credit card, one per currency.
export function CellLines({ lines }: CellLinesProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      {lines.map(({ key, text }) => (
        <span key={key} className={LINE_CLASS_NAME}>
          {text}
        </span>
      ))}
    </div>
  );
}
```

`index.ts`:

```ts
export { CellLines } from "./CellLines";
```

In `components/Cards/components/CardsTable/components/UsageCell/types.ts`, replace the content with:

```ts
import type { CardLimitRow } from "../../../../types";

export interface UsageCellProps {
  // The card's title, to name the bar.
  title: string;
  limit: CardLimitRow;
}
```

In `UsageCell/consts.ts`, replace `usageAriaLabel` with:

```ts
// The accessible name of the progress bar of one cap of a card.
export const usageAriaLabel = (title: string, currency: string): string =>
  `Uso de ${title} en ${currency}`;
```

In `UsageCell.tsx`, change the signature to `export function UsageCell({ title, limit }: UsageCellProps) {`, the comment to "What a card has used of one of its caps: the amounts, a bar as full as that share, and the tier in words.", and replace `row.usedLabel` → `limit.usedLabel`, `usageAriaLabel(row.title)` → `usageAriaLabel(title, limit.currency)`, `row.percent` → `limit.percent`, both `row.tier` → `limit.tier`.

In `components/Cards/components/CardsTable/consts.ts` append:

```ts
export const KIND_HEADER = "Tipo";
export const BANK_HEADER = "Banco";
```

In `components/Cards/components/CardsTable/styles.ts`, change `FIXED_TABLE_CLASS_NAME` to `"table-fixed min-w-[83rem]"` and append:

```ts
export const KIND_COLUMN_CLASS_NAME = "w-36";
export const BANK_COLUMN_CLASS_NAME = "w-40";

// The usage of each cap of a credit card, one under the other.
export const USAGE_LIST_CLASS_NAME = "flex w-full flex-col gap-3";
```

In `CardsTable.tsx`:

- import `CellLines` from `./components/CellLines`, `NO_VALUE_LABEL` with `EMPTY_COPY` from `../../consts`, `BANK_HEADER` and `KIND_HEADER` from `./consts`, and `BANK_COLUMN_CLASS_NAME`, `KIND_COLUMN_CLASS_NAME`, `USAGE_LIST_CLASS_NAME` from `./styles`;
- insert after the `card` column:

```tsx
    {
      key: "kind",
      header: KIND_HEADER,
      className: KIND_COLUMN_CLASS_NAME,
      cell: (row) => row.kindLabel,
      loadingCell: <Skeleton className="h-4 w-3/4" />,
    },
    {
      key: "bank",
      header: BANK_HEADER,
      className: BANK_COLUMN_CLASS_NAME,
      cell: (row) => (
        <TruncatedText className={DESCRIPTION_CLASS_NAME}>
          {row.bankName}
        </TruncatedText>
      ),
      loadingCell: <Skeleton className="h-4 w-4/5" />,
    },
```

- replace the `cell` of the `limit`, `usage` and `available` columns with:

```tsx
      cell: (row) =>
        row.kind === "CREDIT" ? (
          <CellLines
            lines={row.limits.map(({ currency, limitLabel }) => ({
              key: currency,
              text: limitLabel,
            }))}
          />
        ) : (
          (row.currenciesLabel ?? NO_VALUE_LABEL)
        ),
```

```tsx
      cell: (row) =>
        row.kind === "CREDIT" ? (
          <div className={USAGE_LIST_CLASS_NAME}>
            {row.limits.map((limit) => (
              <UsageCell key={limit.currency} title={row.title} limit={limit} />
            ))}
          </div>
        ) : (
          NO_VALUE_LABEL
        ),
```

```tsx
      cell: (row) =>
        row.kind === "CREDIT" ? (
          <CellLines
            lines={row.limits.map(({ currency, availableLabel }) => ({
              key: currency,
              text: availableLabel,
            }))}
          />
        ) : (
          NO_VALUE_LABEL
        ),
```

The tooltip test asks for the used text of a cap as a tooltip: `UsageCell` already renders `usedLabel` inside `TruncatedText`, so it keeps working.

In `components/Cards/components/CardFormDrawer/CardFormContent.tsx` (interim until Task 3 rewrites the form), replace `defaultValue={card?.currency ?? DEFAULT_CURRENCY_CODE}` with `defaultValue={card?.limits[0]?.currency ?? DEFAULT_CURRENCY_CODE}` and `defaultValue={card?.limitDecimal}` with `defaultValue={card?.limits[0]?.limitDecimal}`. (`useCardDraft` keeps compiling: `card?.closingDay ?? DEFAULT_CLOSING_DAY` also covers `null`.)

Run: `npx vitest run components/Cards components/Help app/dashboard/cards`
Expected: PASS.

- [ ] **Step 16: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto core/cards core/entries/actionHelpers.ts core/entries/actionHelpers.test.ts core/expenses/service.ts core/expenses/service.test.ts core/installments/service.ts core/installments/service.test.ts components/Entries/components/CardField components/Expenses/types.ts components/Expenses/utils.ts components/Expenses/testCards.ts components/Expenses/components/ExpenseFormDrawer components/Expenses/components/InstallmentPlannerDrawer components/Cards components/Help/markerAudit.test.tsx app/dashboard/cards app/dashboard/expenses/loadExpensesView.test.ts`.
Expected: all green. If `tsc` still names a reader of `card.currency` / `card.limitAmount` that this task did not list, fix it the same way (credit: `limitIn`/`capIn`; options: `currencies`) and add it to the report.

- [ ] **Step 17: Do NOT commit (the user commits only when asked); the controller snapshots.**

**GATE (controller):** re-check that `Card` has 0 rows (see "Execution notes"), then ask the user to run `npx prisma migrate deploy` and to restart `next dev`. Wait for the answer before dispatching Task 3.

---

### Task 3: The card form — kind, bank and caps per currency

**Files:**

- Modify: `core/banks/types.ts`; Create: `core/banks/choices.ts`, `core/banks/choices.test.ts`
- Modify: `core/cards/pageData.ts`, `core/cards/pageData.test.ts`
- Modify: `app/dashboard/cards/loadCardsView.ts`, `app/dashboard/cards/loadCardsView.test.ts`
- Modify: `components/Cards/types.ts`, `components/Cards/Cards.tsx`, `components/Cards/Cards.test.tsx`, `components/Cards/Cards.bulkDelete.test.tsx`
- Modify: `components/Cards/components/CardFormDrawer/CardFormDrawer.tsx`, `CardFormContent.tsx`, `consts.ts`, `types.ts`, `useCardDraft.ts`, `CardFormDrawer.test.tsx` (rewrite)
- Modify: `components/Cards/components/CardFormDrawer/components/CardPreview/CardPreview.tsx`, `types.ts`, `consts.ts`
- Create: `components/Cards/components/CardFormDrawer/components/KindField/{KindField.tsx,index.ts,types.ts,consts.ts}`
- Create: `components/Cards/components/CardFormDrawer/components/BankField/{BankField.tsx,index.ts,types.ts,consts.ts,styles.ts}`
- Create: `components/Cards/components/CardFormDrawer/components/CardIdentity/{CardIdentity.tsx,index.ts,types.ts,consts.ts,styles.ts}`
- Create: `components/Cards/components/CardFormDrawer/components/LimitsField/{LimitsField.tsx,index.ts,types.ts,consts.ts,styles.ts,utils.ts,utils.test.ts,useLimitRows.ts}`
- Create: `components/Cards/components/CardFormDrawer/components/LimitsField/components/LimitRow/{LimitRow.tsx,index.ts,types.ts,styles.ts}`

**Interfaces:**

- Consumes (Task 2): `CardRow`, `CardLimitRow`, `creditCardRow`, `debitCardRow`, `limitRow`, `CardKind`, `CardFieldErrors`, `KIND_NAMES`, `DEFAULT_CARD_KIND`, `LIMIT_CURRENCY_FIELD`, `LIMIT_AMOUNT_FIELD`, `createCardAction(formData)`, `updateCardAction(id, formData)`, `listCards`; existing `CURRENCY_OPTIONS`/`CurrencyOption` (`@/components/Entries/currencyOptions`), `CURRENCY_PLACEHOLDER`, `CANCEL_LABEL` (`@/components/Entries/formConsts`), `FIELD_CLASS_NAME`, `FIELD_VARIANT`, `FIELD_HEIGHT_CLASS_NAME`, `SELECT_TRIGGER_CLASS_NAME`, `AMOUNT_ROW_CLASS_NAME`, `FORM_CLASS_NAME`, `DRAWER_DESCRIPTION_CLASS_NAME` (`@/components/Entries/styles`), `BANKS_PATH`, `DEFAULT_CURRENCY_CODE`, `Await`/`Source`.
- Produces: `BankChoice { id: string; name: string }` (`core/banks/types.ts`); `listBankChoices(userId): Promise<BankChoice[]>` (`core/banks/choices.ts`); `loadCardsPageData(userId): Promise<{ cards: CardWithUsage[]; banks: BankChoice[] }>`; `loadCardsView(userId): { table: Promise<CardsTableData>; banks: Promise<BankChoice[]> }`; `CardsProps { table: Source<CardsTableData>; banks: Source<readonly BankChoice[]> }`; `CardFormDrawerProps` gains `banks: readonly BankChoice[]`; the form posts `kind`, `bankId`, `last4`, `brand` and, for a credit card, `closingDay`, `dueDay`, `limitMode` and the repeated `limitCurrency`/`limitAmount` pairs.

- [ ] **Step 1: Read the docs and the components to copy**

Read under `C:\Users\Nico\Desktop\insight-in\.heroui-docs\react\components\`: `(forms)\radio-group.mdx`, `(pickers)\select.mdx`, `(forms)\text-field.mdx`, `(buttons)\button.mdx`, `(navigation)\link.mdx`, `(forms)\fieldset.mdx`, `(overlays)\drawer.mdx`. Then read the markup to copy: `components/Cards/components/CardFormDrawer/components/LimitModeField/LimitModeField.tsx` (radio group), `components/Expenses/components/InstallmentPlannerDrawer/components/PurchaseForm/components/CardOwnershipFields/CardOwnershipFields.tsx` (controlled radio group), `components/Entries/components/AccountField/AccountField.tsx` (select with a hint and a link to Bancos), and the currency `Select` and the amount `TextField` of the current `CardFormContent.tsx`.

- [ ] **Step 2: The banks a card can belong to (tests first)**

Create `core/banks/choices.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ bank: { findMany: vi.fn() } }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { listBankChoices } from "./choices";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listBankChoices", () => {
  it("reads only the user's active banks, in the order of the Banks board", async () => {
    db.bank.findMany.mockResolvedValue([]);

    await listBankChoices("user_123");

    expect(db.bank.findMany).toHaveBeenCalledWith({
      where: { userId: "user_123", archivedAt: null },
      select: { id: true, name: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });

  it("returns each bank as its id and name", async () => {
    db.bank.findMany.mockResolvedValue([
      { id: "bank_1", name: "Banco Galicia" },
      { id: "bank_2", name: "AstroPay" },
    ]);

    await expect(listBankChoices("user_123")).resolves.toEqual([
      { id: "bank_1", name: "Banco Galicia" },
      { id: "bank_2", name: "AstroPay" },
    ]);
  });
});
```

Replace the content of `core/cards/pageData.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ listCards: vi.fn() }));
const banks = vi.hoisted(() => ({ listBankChoices: vi.fn() }));

vi.mock("./service", () => service);
vi.mock("@/core/banks/choices", () => banks);

import { loadCardsPageData } from "./pageData";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("loadCardsPageData", () => {
  it("reads the cards of the user, with their usage, and the banks a new card can belong to", async () => {
    const cards = [{ id: "card_1" }];
    const choices = [{ id: "bank_1", name: "Banco Galicia" }];

    service.listCards.mockResolvedValue(cards);
    banks.listBankChoices.mockResolvedValue(choices);

    await expect(loadCardsPageData("user_1")).resolves.toEqual({
      cards,
      banks: choices,
    });
    expect(service.listCards).toHaveBeenCalledWith("user_1");
    expect(banks.listBankChoices).toHaveBeenCalledWith("user_1");
  });
});
```

In `app/dashboard/cards/loadCardsView.test.ts`:

- in "returns at once …", expect `Object.keys(view)` to equal `["table", "banks"]` and add `expect(view.banks).toBeInstanceOf(Promise);`;
- make every `mockResolvedValue({ cards: … })` also carry `banks: []` (`{ cards: [CARD], banks: [] }`, `{ cards: [], banks: [] }`);
- replace "rejects the table when the load fails, …" with:

```ts
it("rejects every section when the load fails, so each reaches the error boundary", async () => {
  pageData.loadCardsPageData.mockRejectedValue(new Error("database down"));

  const view = loadCardsView("user_1");

  await expect(view.table).rejects.toThrow("database down");
  await expect(view.banks).rejects.toThrow("database down");
});
```

- append:

```ts
it("hands the form the user's active banks as they were read", async () => {
  const banks = [{ id: "bank_1", name: "Banco Galicia" }];

  pageData.loadCardsPageData.mockResolvedValue({ cards: [], banks });

  await expect(loadCardsView("user_1").banks).resolves.toEqual(banks);
});
```

Run: `npx vitest run core/banks/choices.test.ts core/cards/pageData.test.ts app/dashboard/cards`
Expected: FAIL (`./choices` does not exist; the page data has no banks; the view has no `banks`).

Append to `core/banks/types.ts`:

```ts
// A bank a new card can belong to: an active bank of the user.
export interface BankChoice {
  id: string;
  name: string;
}
```

Create `core/banks/choices.ts`:

```ts
import { prisma } from "@/infrastructure/db/client";

import type { BankChoice } from "./types";

// The user's active banks, in the order of the Banks board: the ones a new card can belong to (an
// archived bank takes no new card). Scoped by userId.
export const listBankChoices = async (userId: string): Promise<BankChoice[]> =>
  prisma.bank.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, name: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
```

Replace the content of `core/cards/pageData.ts` with:

```ts
import { listBankChoices } from "@/core/banks/choices";

import { listCards } from "./service";

// Everything the cards page needs: the user's cards with what each has used of its caps this month,
// and the active banks a new card can belong to. Both reads start together.
export const loadCardsPageData = async (userId: string) => {
  const [cards, banks] = await Promise.all([
    listCards(userId),
    listBankChoices(userId),
  ]);

  return { cards, banks };
};
```

In `app/dashboard/cards/loadCardsView.ts`, return:

```ts
return {
  table: data.then(({ cards }) => ({ rows: toCardRows(cards) })),
  banks: data.then(({ banks }) => banks),
};
```

Run: `npx vitest run core/banks/choices.test.ts core/cards/pageData.test.ts app/dashboard/cards`
Expected: PASS.

- [ ] **Step 3: The pure helpers of the caps list (tests first)**

Create `components/Cards/components/CardFormDrawer/components/LimitsField/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { currencyChoices, firstFreeCurrency, initialRows } from "./utils";

describe("initialRows", () => {
  it("starts a new card with one empty cap in the default currency", () => {
    expect(initialRows([])).toEqual([{ key: 0, currency: "ARS", amount: "" }]);
  });

  it("starts an edit from the stored caps, as plain text", () => {
    expect(
      initialRows([
        { currency: "ARS", limitDecimal: "300000.00" },
        { currency: "USD", limitDecimal: "1200.50" },
      ]),
    ).toEqual([
      { key: 0, currency: "ARS", amount: "300000.00" },
      { key: 1, currency: "USD", amount: "1200.50" },
    ]);
  });
});

describe("firstFreeCurrency", () => {
  it("is the first currency of the list that no cap uses yet", () => {
    expect(firstFreeCurrency(["ARS"])).toBe("USD");
    expect(firstFreeCurrency(["ARS", "USD"])).toBe("EUR");
  });
});

describe("currencyChoices", () => {
  const ROWS = [
    { key: 0, currency: "ARS", amount: "" },
    { key: 1, currency: "USD", amount: "" },
  ];

  it("offers a row its own currency and every currency no other row uses", () => {
    const codes = currencyChoices(ROWS, 1).map(({ code }) => code);

    expect(codes).toContain("USD");
    expect(codes).toContain("EUR");
    expect(codes).not.toContain("ARS");
  });
});
```

Run: `npx vitest run components/Cards/components/CardFormDrawer/components/LimitsField`
Expected: FAIL (`./utils` does not exist).

Create `LimitsField/types.ts`:

```ts
import type { CardFieldErrors } from "@/core/cards/types";

// One cap while the form is open: the currency chosen and the amount as typed. `key` keeps each row's
// identity while rows are added and removed.
export interface LimitDraft {
  key: number;
  currency: string;
  amount: string;
}

export interface LimitsFieldProps {
  // The stored caps on edit (none for a new card).
  defaultLimits: readonly { currency: string; limitDecimal: string }[];
  // What the server said, keyed "limits", "limits.<index>.currency" and "limits.<index>.amount".
  fieldErrors: CardFieldErrors;
}
```

`LimitsField/consts.ts`:

```ts
export const LIMITS_LABEL = "Topes por moneda";
export const LIMITS_HINT =
  "Cada tope puede ser el límite real de la tarjeta o uno menor que quieras respetar. Los topes de distintas monedas nunca se suman.";
export const ADD_LIMIT_LABEL = "Agregar un tope en otra moneda";
export const LIMIT_CURRENCY_LABEL = "Moneda del tope";
export const LIMIT_AMOUNT_LABEL = "Monto del tope";
export const LIMIT_AMOUNT_PLACEHOLDER = "0.00";

export const removeLimitLabel = (currency: string): string =>
  `Quitar el tope en ${currency}`;
```

`LimitsField/styles.ts`:

```ts
export const ROOT_CLASS_NAME = "flex w-full flex-col gap-3";
export const LEGEND_CLASS_NAME = "text-sm font-medium";
export const HINT_CLASS_NAME = "text-sm text-muted";
export const ERROR_CLASS_NAME = "text-sm text-danger";
export const ICON_CLASS_NAME = "size-4";
```

`LimitsField/utils.ts`:

```ts
import { CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";
import type { CurrencyOption } from "@/components/Entries/currencyOptions";
import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";

import type { LimitDraft, LimitsFieldProps } from "./types";

// The rows the list starts with: the stored caps on edit, one empty cap in the default currency for a
// new card.
export const initialRows = (
  defaults: LimitsFieldProps["defaultLimits"],
): LimitDraft[] =>
  defaults.length > 0
    ? defaults.map((limit, index) => ({
        key: index,
        currency: limit.currency,
        amount: limit.limitDecimal,
      }))
    : [{ key: 0, currency: DEFAULT_CURRENCY_CODE, amount: "" }];

// The currency a new row starts in: the first of the list that no cap uses yet.
export const firstFreeCurrency = (used: readonly string[]): string | null =>
  CURRENCY_OPTIONS.find(({ code }) => !used.includes(code))?.code ?? null;

// The currencies a row can pick: its own and every one no other row uses, so a currency never gets
// two caps.
export const currencyChoices = (
  rows: readonly LimitDraft[],
  index: number,
): CurrencyOption[] =>
  CURRENCY_OPTIONS.filter(
    ({ code }) =>
      code === rows[index]?.currency ||
      !rows.some((row) => row.currency === code),
  );
```

`LimitsField/useLimitRows.ts`:

```ts
import { useState } from "react";

import type { LimitDraft, LimitsFieldProps } from "./types";
import { firstFreeCurrency, initialRows } from "./utils";

// The rows of the caps list: added in the next free currency, removed (never the last one), and
// changed as the user picks a currency or types an amount.
export function useLimitRows(defaults: LimitsFieldProps["defaultLimits"]) {
  const [rows, setRows] = useState<LimitDraft[]>(() => initialRows(defaults));
  const [nextKey, setNextKey] = useState(() => Math.max(defaults.length, 1));
  const freeCurrency = firstFreeCurrency(rows.map(({ currency }) => currency));

  const add = () => {
    if (freeCurrency === null) {
      return;
    }

    setRows((current) => [
      ...current,
      { key: nextKey, currency: freeCurrency, amount: "" },
    ]);
    setNextKey((key) => key + 1);
  };

  const remove = (key: number) =>
    setRows((current) =>
      current.length > 1 ? current.filter((row) => row.key !== key) : current,
    );

  const change = (
    key: number,
    patch: Partial<Pick<LimitDraft, "currency" | "amount">>,
  ) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  return { rows, add, remove, change, canAdd: freeCurrency !== null };
}
```

Run: `npx vitest run components/Cards/components/CardFormDrawer/components/LimitsField`
Expected: PASS.

- [ ] **Step 4: Rewrite the form test (it fails)**

Replace the whole content of `components/Cards/components/CardFormDrawer/CardFormDrawer.test.tsx` with:

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

const actions = vi.hoisted(() => ({
  createCardAction: vi.fn(),
  updateCardAction: vi.fn(),
}));

vi.mock("@/core/cards/actions", () => actions);

import type { BankChoice } from "@/core/banks/types";

import { creditCardRow, debitCardRow, limitRow } from "../../testRows";
import type { CardRow, FormTarget } from "../../types";
import { CardFormDrawer } from "./CardFormDrawer";

const BANKS: BankChoice[] = [
  { id: "bank_1", name: "Banco Galicia" },
  { id: "bank_2", name: "AstroPay" },
];

const CARD: CardRow = creditCardRow({
  brand: "MASTERCARD",
  title: "Mastercard •••• 1234",
  brandName: "Mastercard",
  limitMode: "TOTAL",
  limits: [
    limitRow({ currency: "ARS", limitDecimal: "300000.00" }),
    limitRow({ currency: "USD", limitDecimal: "1200.50" }),
  ],
});

const DEBIT: CardRow = debitCardRow();

const renderForm = (
  card: CardRow | null,
  banks: readonly BankChoice[] = BANKS,
) => {
  const onClose = vi.fn();
  const target: FormTarget = { key: 1, card };

  render(
    <CardFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
      banks={banks}
    />,
  );

  return { onClose };
};

const last4Input = () =>
  screen.getByRole("textbox", { name: /Últimos 4 dígitos/ });
const closingInput = () =>
  screen.getByRole("textbox", { name: /Día de cierre/ });
const dueInput = () =>
  screen.getByRole("textbox", { name: /Día de vencimiento/ });
const amountInputs = () =>
  screen.getAllByRole("textbox", { name: /Monto del tope/ });
const currencyButtons = () =>
  screen.getAllByRole("button", { name: /Moneda del tope$/ });
const bankButton = () => screen.getByRole("button", { name: /Banco$/ });
const submitButton = (name: string) => screen.getByRole("button", { name });
const addLimitButton = () =>
  screen.getByRole("button", { name: "Agregar un tope en otra moneda" });

// A number field commits what was typed when it loses focus.
const typeDay = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

const pickOption = async (trigger: HTMLElement, name: string | RegExp) => {
  fireEvent.keyDown(trigger, { key: "ArrowDown" });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

const fillCredit = async () => {
  fireEvent.change(last4Input(), { target: { value: "4321" } });
  await pickOption(bankButton(), "Banco Galicia");
  fireEvent.change(amountInputs()[0], { target: { value: "300000" } });
};

const createdForm = (): FormData =>
  actions.createCardAction.mock.calls[0][0] as FormData;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("is titled 'Agregar tarjeta' and says no sensitive data is asked", () => {
    renderForm(null);

    expect(
      screen.getByRole("heading", { name: "Agregar tarjeta" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no pedimos el número completo/i)).toBeVisible();
  });

  it("has an add button with the plus icon, and a Cancel", () => {
    renderForm(null);

    const button = submitButton("Agregar tarjeta");

    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("starts as a credit card, offering Crédito and Débito o prepago", () => {
    renderForm(null);

    const group = screen.getByRole("radiogroup", { name: "Tipo" });

    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual([
      expect.stringContaining("Crédito"),
      expect.stringContaining("Débito o prepago"),
    ]);
    expect(screen.getByRole("radio", { name: /Crédito/ })).toBeChecked();
  });

  it("asks a credit card for the bank, the digits, the brand, the two days, the kind of cap and one cap to start with", () => {
    renderForm(null);

    expect(bankButton()).toBeVisible();
    expect(last4Input()).toBeVisible();
    expect(screen.getByRole("radiogroup", { name: "Marca" })).toBeVisible();
    expect(closingInput()).toBeVisible();
    expect(dueInput()).toBeVisible();
    expect(
      screen.getByRole("radiogroup", { name: "Tipo de tope" }),
    ).toBeVisible();
    expect(amountInputs()).toHaveLength(1);
    expect(currencyButtons()[0]).toHaveTextContent("ARS");
  });

  it("asks a debit or prepaid card only for the bank, the digits and the brand", () => {
    renderForm(null);

    fireEvent.click(screen.getByRole("radio", { name: /Débito o prepago/ }));

    expect(bankButton()).toBeVisible();
    expect(last4Input()).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: /Día de cierre/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Tipo de tope" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /Monto del tope/ }),
    ).not.toBeInTheDocument();
  });

  describe("the bank", () => {
    it("starts with none chosen when the user has several", () => {
      renderForm(null);

      expect(bankButton()).toHaveTextContent("Elegí un banco");
    });

    it("is preselected when the user has only one active bank", () => {
      renderForm(null, [BANKS[0]]);

      expect(bankButton()).toHaveTextContent("Banco Galicia");
    });

    it("says so, and links to Bancos, when the user has no active bank", () => {
      renderForm(null, []);

      expect(
        screen.getByText(/Todavía no tenés bancos activos\./),
      ).toBeVisible();
      expect(
        screen.getByRole("link", { name: "Creá uno en Bancos" }),
      ).toHaveAttribute("href", "/dashboard/banks");
    });

    it("has no such notice when there are banks", () => {
      renderForm(null);

      expect(
        screen.queryByText(/Todavía no tenés bancos activos\./),
      ).not.toBeInTheDocument();
    });
  });

  describe("the caps", () => {
    it("adds a cap in the next free currency, and never offers a currency twice", async () => {
      renderForm(null);

      fireEvent.click(addLimitButton());

      expect(amountInputs()).toHaveLength(2);
      expect(currencyButtons()[1]).toHaveTextContent("USD");

      fireEvent.keyDown(currencyButtons()[1], { key: "ArrowDown" });

      const options = await screen.findAllByRole("option");
      const codes = options.map((option) => option.textContent?.slice(0, 3));

      expect(codes).toContain("USD");
      expect(codes).toContain("EUR");
      expect(codes).not.toContain("ARS");
    });

    it("removes a cap, but never the last one", () => {
      renderForm(null);

      expect(
        screen.getByRole("button", { name: "Quitar el tope en ARS" }),
      ).toBeDisabled();

      fireEvent.click(addLimitButton());
      fireEvent.click(
        screen.getByRole("button", { name: "Quitar el tope en USD" }),
      );

      expect(amountInputs()).toHaveLength(1);
    });

    it("says what a cap means", () => {
      renderForm(null);

      expect(
        screen.getByText(
          "Cada tope puede ser el límite real de la tarjeta o uno menor que quieras respetar. Los topes de distintas monedas nunca se suman.",
        ),
      ).toBeVisible();
    });
  });

  it("sends a credit card with its kind, bank, days, mode and caps as pairs, in the order shown, and closes", async () => {
    actions.createCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    await fillCredit();
    fireEvent.click(addLimitButton());
    fireEvent.change(amountInputs()[1], { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("radio", { name: /Total/ }));
    fireEvent.click(submitButton("Agregar tarjeta"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = createdForm();

    expect(sent.get("kind")).toBe("CREDIT");
    expect(sent.get("bankId")).toBe("bank_1");
    expect(sent.get("last4")).toBe("4321");
    expect(sent.get("brand")).toBe("VISA");
    expect(sent.get("closingDay")).toBe("1");
    expect(sent.get("dueDay")).toBe("15");
    expect(sent.get("limitMode")).toBe("TOTAL");
    expect(sent.getAll("limitCurrency")).toEqual(["ARS", "USD"]);
    expect(sent.getAll("limitAmount")).toEqual(["300000", "1000"]);
  });

  it("sends a debit card with no field only a credit card has", async () => {
    actions.createCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    fireEvent.click(screen.getByRole("radio", { name: /Débito o prepago/ }));
    fireEvent.change(last4Input(), { target: { value: "9999" } });
    await pickOption(bankButton(), "AstroPay");
    fireEvent.click(submitButton("Agregar tarjeta"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = createdForm();

    expect(sent.get("kind")).toBe("DEBIT");
    expect(sent.get("bankId")).toBe("bank_2");
    expect(sent.get("last4")).toBe("9999");
    expect(sent.get("closingDay")).toBeNull();
    expect(sent.get("limitMode")).toBeNull();
    expect(sent.getAll("limitCurrency")).toEqual([]);
  });

  it("does not send the form while a cap amount is missing", async () => {
    renderForm(null);

    fireEvent.change(last4Input(), { target: { value: "4321" } });
    await pickOption(bankButton(), "Banco Galicia");
    fireEvent.click(submitButton("Agregar tarjeta"));

    await waitFor(() => expect(amountInputs()[0]).toBeInvalid());
    expect(actions.createCardAction).not.toHaveBeenCalled();
  });

  it("shows the server's error on the cap it is about, and on the list", async () => {
    actions.createCardAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        "limits.0.amount": ["El monto debe ser mayor que cero."],
      },
    });
    const { onClose } = renderForm(null);

    await fillCredit();
    fireEvent.click(submitButton("Agregar tarjeta"));

    expect(
      await screen.findByText("El monto debe ser mayor que cero."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the server's error on the bank and on the last four digits", async () => {
    actions.createCardAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        bankId: ["Elegí un banco válido."],
        last4: ["Ya tenés una tarjeta Visa terminada en 4321."],
      },
    });
    renderForm(null);

    await fillCredit();
    fireEvent.click(submitButton("Agregar tarjeta"));

    expect(
      await screen.findByText("Elegí un banco válido."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ya tenés una tarjeta Visa terminada en 4321."),
    ).toBeInTheDocument();
  });

  it("shows a general error when there are no field errors", async () => {
    actions.createCardAction.mockResolvedValue({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    renderForm(null);

    await fillCredit();
    fireEvent.click(submitButton("Agregar tarjeta"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo salió mal. Inténtalo de nuevo.",
    );
  });

  it("shows 'Agregando tarjeta…' with a spinner, and locks Cancel, while it saves", async () => {
    const save = deferred<{ status: "success" }>();

    actions.createCardAction.mockReturnValue(save.promise);
    renderForm(null);

    await fillCredit();
    fireEvent.click(submitButton("Agregar tarjeta"));

    const pending = await screen.findByRole("button", {
      name: /Agregando tarjeta/,
    });

    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Agregando tarjeta/ }),
      ).not.toBeInTheDocument(),
    );
  });

  describe("the last four digits", () => {
    it("takes four digits at most, and a numeric keyboard", () => {
      renderForm(null);

      expect(last4Input()).toHaveAttribute("maxlength", "4");
      expect(last4Input()).toHaveAttribute("inputmode", "numeric");
    });

    it("keeps only digits, leading zeros included", () => {
      renderForm(null);

      fireEvent.change(last4Input(), { target: { value: "0a4-b2" } });

      expect(last4Input()).toHaveValue("042");
    });
  });

  it("keeps the days between 1 and 31, starting on day 1 and day 15", () => {
    renderForm(null);

    expect(closingInput()).toHaveValue("1");
    expect(dueInput()).toHaveValue("15");

    typeDay(closingInput(), "45");
    typeDay(dueInput(), "0");

    expect(closingInput()).toHaveValue("31");
    expect(dueInput()).toHaveValue("1");
  });
});

const preview = () =>
  screen.getByRole("group", { name: "Vista previa de la tarjeta" });

describe("the card preview", () => {
  it("shows the Visa logo and the cycle of a new credit card", () => {
    renderForm(null);

    expect(
      preview()
        .querySelector("[data-brand-logo]")
        ?.getAttribute("data-brand-logo"),
    ).toBe("VISA");
    expect(preview()).toHaveTextContent("Cierra el día 1 · Vence el día 15");
  });

  it("follows the digits and the days as they are typed", () => {
    renderForm(null);

    fireEvent.change(last4Input(), { target: { value: "12" } });
    typeDay(closingInput(), "25");
    typeDay(dueInput(), "5");

    expect(preview()).toHaveTextContent("•••• •••• •••• 12••");
    expect(preview()).toHaveTextContent("Cierra el día 25 · Vence el día 5");
  });

  it("says Débito o prepago instead of a cycle for a debit card", () => {
    renderForm(null);

    fireEvent.click(screen.getByRole("radio", { name: /Débito o prepago/ }));

    expect(preview()).toHaveTextContent("Débito o prepago");
    expect(preview()).not.toHaveTextContent("Cierra el día");
  });
});

describe("edit mode", () => {
  it("is titled 'Editar tarjeta', with a plain Guardar cambios button", () => {
    renderForm(CARD);

    expect(
      screen.getByRole("heading", { name: "Editar tarjeta" }),
    ).toBeInTheDocument();
    expect(submitButton("Guardar cambios").querySelector("svg")).toBeNull();
  });

  it("shows the kind and the bank, which cannot change, instead of choosing them", () => {
    renderForm(CARD);

    expect(screen.getByText("Crédito · Banco Galicia")).toBeVisible();
    expect(
      screen.getByText(
        "El tipo y el banco de una tarjeta no se pueden cambiar.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("radiogroup", { name: "Tipo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Banco$/ }),
    ).not.toBeInTheDocument();
  });

  it("prefills every field from the card, one row per cap", () => {
    renderForm(CARD);

    expect(last4Input()).toHaveValue("1234");
    expect(screen.getByRole("radio", { name: "Mastercard" })).toBeChecked();
    expect(closingInput()).toHaveValue("25");
    expect(dueInput()).toHaveValue("5");
    expect(screen.getByRole("radio", { name: /Total/ })).toBeChecked();
    expect(
      currencyButtons().map((button) => button.textContent?.slice(0, 3)),
    ).toEqual(["ARS", "USD"]);
    expect(
      amountInputs().map((input) => (input as HTMLInputElement).value),
    ).toEqual(["300000.00", "1200.50"]);
  });

  it("saves through the update action with the stored kind and bank, and closes", async () => {
    actions.updateCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CARD);

    fireEvent.click(submitButton("Guardar cambios"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const [id, sent] = actions.updateCardAction.mock.calls[0] as [
      string,
      FormData,
    ];

    expect(id).toBe("card_1");
    expect(sent.get("kind")).toBe("CREDIT");
    expect(sent.get("bankId")).toBe("bank_1");
    expect(sent.get("limitMode")).toBe("TOTAL");
    expect(sent.getAll("limitCurrency")).toEqual(["ARS", "USD"]);
    expect(sent.getAll("limitAmount")).toEqual(["300000.00", "1200.50"]);
    expect(actions.createCardAction).not.toHaveBeenCalled();
  });

  it("edits a debit card with only its digits and brand", async () => {
    actions.updateCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(DEBIT);

    expect(screen.getByText("Débito o prepago · AstroPay")).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: /Día de cierre/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(submitButton("Guardar cambios"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = actions.updateCardAction.mock.calls[0][1] as FormData;

    expect(sent.get("kind")).toBe("DEBIT");
    expect(sent.get("bankId")).toBe("bank_2");
    expect(sent.getAll("limitCurrency")).toEqual([]);
  });

  it("shows the server's refusal of a change of kind", async () => {
    actions.updateCardAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { kind: ["El tipo de una tarjeta no se puede cambiar."] },
    });
    renderForm(CARD);

    fireEvent.click(submitButton("Guardar cambios"));

    expect(
      await screen.findByText("El tipo de una tarjeta no se puede cambiar."),
    ).toBeInTheDocument();
  });

  it("shows a general error when the card was not found", async () => {
    actions.updateCardAction.mockResolvedValue({
      status: "error",
      message: "No se encontró la tarjeta.",
    });
    renderForm(CARD);

    fireEvent.click(submitButton("Guardar cambios"));

    expect(
      await screen.findByText("No se encontró la tarjeta."),
    ).toBeInTheDocument();
  });
});
```

Run: `npx vitest run components/Cards/components/CardFormDrawer/CardFormDrawer.test.tsx`
Expected: FAIL (the drawer has no `banks` prop, no "Tipo" radio group, no bank select and no caps list).

- [ ] **Step 5: Write the new fields**

`KindField/types.ts`:

```ts
import type { CardKind } from "@/core/cards/types";

export interface KindFieldProps {
  value: CardKind;
  onChange: (kind: CardKind) => void;
}

export interface KindOption {
  value: CardKind;
  label: string;
  hint: string;
}
```

`KindField/consts.ts`:

```ts
import { KIND_NAMES } from "@/core/cards/consts";

import type { KindOption } from "./types";

export const KIND_LABEL = "Tipo";

// The field name the form submits the kind under.
export const KIND_FIELD_NAME = "kind";

// In the order the radios appear.
export const KIND_OPTIONS: readonly KindOption[] = [
  {
    value: "CREDIT",
    label: KIND_NAMES.CREDIT,
    hint: "Se paga con el resumen, con un tope por moneda.",
  },
  {
    value: "DEBIT",
    label: KIND_NAMES.DEBIT,
    hint: "Descuenta en el momento de la cuenta de su banco en la moneda de la compra.",
  },
];
```

`KindField/KindField.tsx`:

```tsx
import {
  Description,
  FieldError,
  Label,
  Radio,
  RadioGroup,
} from "@heroui/react";

import { FIELD_CLASS_NAME } from "@/components/Entries/styles";

import { KIND_FIELD_NAME, KIND_LABEL, KIND_OPTIONS } from "./consts";
import type { KindFieldProps } from "./types";

// Credit or debit/prepaid, chosen once when the card is added. The form shows only the fields of the
// kind chosen, so the choice is controlled; the radio group also submits it.
export function KindField({ value, onChange }: KindFieldProps) {
  return (
    <RadioGroup
      className={FIELD_CLASS_NAME}
      name={KIND_FIELD_NAME}
      variant="secondary"
      value={value}
      onChange={(next) => {
        const option = KIND_OPTIONS.find(
          (candidate) => candidate.value === next,
        );

        if (option) {
          onChange(option.value);
        }
      }}
    >
      <Label>{KIND_LABEL}</Label>
      {KIND_OPTIONS.map((option) => (
        <Radio key={option.value} value={option.value}>
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {option.label}
          </Radio.Content>
          <Description>{option.hint}</Description>
        </Radio>
      ))}
      <FieldError />
    </RadioGroup>
  );
}
```

`KindField/index.ts`: `export { KindField } from "./KindField";`

`BankField/types.ts`:

```ts
import type { BankChoice } from "@/core/banks/types";

export interface BankFieldProps {
  // The user's active banks, in the order of the Banks board.
  banks: readonly BankChoice[];
}
```

`BankField/consts.ts`:

```ts
export const BANK_LABEL = "Banco";
export const BANK_PLACEHOLDER = "Elegí un banco";

// The field name the form submits the bank under.
export const BANK_FIELD_NAME = "bankId";

export const NO_BANKS_HINT = "Todavía no tenés bancos activos.";
export const CREATE_BANK_LINK_LABEL = "Creá uno en Bancos";
```

`BankField/styles.ts`:

```ts
// Keeps the select and the line under it together, whatever gap the form puts between fields.
export const ROOT_CLASS_NAME = "flex w-full flex-col gap-1";

// The line under the field when the user has no active bank.
export const HINT_CLASS_NAME = "text-sm text-muted";
```

`BankField/BankField.tsx`:

```tsx
import { FieldError, Label, Link, ListBox, Select } from "@heroui/react";

import {
  FIELD_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { BANKS_PATH } from "@/core/banks/consts";

import {
  BANK_FIELD_NAME,
  BANK_LABEL,
  BANK_PLACEHOLDER,
  CREATE_BANK_LINK_LABEL,
  NO_BANKS_HINT,
} from "./consts";
import { HINT_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";
import type { BankFieldProps } from "./types";

// The bank of a new card, among the user's active banks; the only one is preselected. With none, the
// field is disabled and a line links to Bancos. The line sits outside the select: HeroUI hides the
// description slot of an invalid select.
export function BankField({ banks }: BankFieldProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <Select
        isRequired
        variant={FIELD_VARIANT}
        className={FIELD_CLASS_NAME}
        name={BANK_FIELD_NAME}
        placeholder={BANK_PLACEHOLDER}
        defaultValue={banks.length === 1 ? banks[0].id : undefined}
        isDisabled={banks.length === 0}
      >
        <Label>{BANK_LABEL}</Label>
        <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {banks.map(({ id, name }) => (
              <ListBox.Item key={id} id={id} textValue={name}>
                {name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        <FieldError />
      </Select>
      {banks.length === 0 ? (
        <p className={HINT_CLASS_NAME}>
          {NO_BANKS_HINT}{" "}
          <Link href={BANKS_PATH}>{CREATE_BANK_LINK_LABEL}</Link>
        </p>
      ) : null}
    </div>
  );
}
```

`BankField/index.ts`: `export { BankField } from "./BankField";`

`CardIdentity/types.ts`:

```ts
import type { CardKind } from "@/core/cards/types";

export interface CardIdentityProps {
  kind: CardKind;
  bankId: string;
  bankName: string;
  // What the server said about the kind or the bank (only a forged request can change them).
  errorMessage?: string;
}
```

`CardIdentity/consts.ts`:

```ts
export const IDENTITY_LABEL = "Tipo y banco";
export const LOCKED_HINT =
  "El tipo y el banco de una tarjeta no se pueden cambiar.";

// "Crédito · Banco Galicia".
export const identityText = (kindName: string, bankName: string): string =>
  `${kindName} · ${bankName}`;
```

`CardIdentity/styles.ts`:

```ts
export const ROOT_CLASS_NAME = "flex w-full flex-col gap-1";
export const LABEL_CLASS_NAME = "text-sm font-medium";
export const VALUE_CLASS_NAME = "text-sm";
export const HINT_CLASS_NAME = "text-sm text-muted";
export const ERROR_CLASS_NAME = "text-sm text-danger";
```

`CardIdentity/CardIdentity.tsx`:

```tsx
import { KIND_NAMES } from "@/core/cards/consts";

import { IDENTITY_LABEL, LOCKED_HINT, identityText } from "./consts";
import {
  ERROR_CLASS_NAME,
  HINT_CLASS_NAME,
  LABEL_CLASS_NAME,
  ROOT_CLASS_NAME,
  VALUE_CLASS_NAME,
} from "./styles";
import type { CardIdentityProps } from "./types";

// The kind and the bank of a card being edited: shown, never chosen again, and sent back as they are
// (the server refuses a change).
export function CardIdentity({
  kind,
  bankId,
  bankName,
  errorMessage,
}: CardIdentityProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <p className={LABEL_CLASS_NAME}>{IDENTITY_LABEL}</p>
      <p className={VALUE_CLASS_NAME}>
        {identityText(KIND_NAMES[kind], bankName)}
      </p>
      <p className={HINT_CLASS_NAME}>{LOCKED_HINT}</p>
      {errorMessage ? (
        <p role="alert" className={ERROR_CLASS_NAME}>
          {errorMessage}
        </p>
      ) : null}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="bankId" value={bankId} />
    </div>
  );
}
```

`CardIdentity/index.ts`: `export { CardIdentity } from "./CardIdentity";`

`LimitsField/components/LimitRow/types.ts`:

```ts
import type { CurrencyOption } from "@/components/Entries/currencyOptions";

import type { LimitDraft } from "../../types";

export interface LimitRowProps {
  row: LimitDraft;
  // The currencies this row may pick (never one another row uses).
  currencies: readonly CurrencyOption[];
  canRemove: boolean;
  currencyError?: string;
  amountError?: string;
  onChange: (patch: Partial<Pick<LimitDraft, "currency" | "amount">>) => void;
  onRemove: () => void;
}
```

`LimitRow/styles.ts`:

```ts
// The currency, the amount and the remove button on one line; the fields share what the button leaves.
export const ROOT_CLASS_NAME = "flex w-full items-end gap-3";
export const CURRENCY_CLASS_NAME = "min-w-0 flex-1";
export const AMOUNT_CLASS_NAME = "min-w-0 flex-1";
export const ICON_CLASS_NAME = "size-4";
```

`LimitRow/LimitRow.tsx`:

```tsx
import { TrashIcon } from "@heroicons/react/24/outline";
import {
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";

import { CURRENCY_PLACEHOLDER } from "@/components/Entries/formConsts";
import {
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { LIMIT_AMOUNT_FIELD, LIMIT_CURRENCY_FIELD } from "@/core/cards/consts";

import {
  LIMIT_AMOUNT_LABEL,
  LIMIT_AMOUNT_PLACEHOLDER,
  LIMIT_CURRENCY_LABEL,
  removeLimitLabel,
} from "../../consts";
import {
  AMOUNT_CLASS_NAME,
  CURRENCY_CLASS_NAME,
  ICON_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { LimitRowProps } from "./types";

// One cap of a credit card: a currency and an amount typed in it. Both submit with the form as one
// more pair of the repeated fields, in the order the rows are shown.
export function LimitRow({
  row,
  currencies,
  canRemove,
  currencyError,
  amountError,
  onChange,
  onRemove,
}: LimitRowProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <Select
        isRequired
        variant={FIELD_VARIANT}
        className={CURRENCY_CLASS_NAME}
        name={LIMIT_CURRENCY_FIELD}
        placeholder={CURRENCY_PLACEHOLDER}
        value={row.currency}
        isInvalid={currencyError !== undefined}
        onChange={(key) => {
          if (typeof key === "string") {
            onChange({ currency: key });
          }
        }}
      >
        <Label>{LIMIT_CURRENCY_LABEL}</Label>
        <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {currencies.map(({ code, label }) => (
              <ListBox.Item key={code} id={code} textValue={label}>
                {label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        {currencyError ? <FieldError>{currencyError}</FieldError> : null}
      </Select>

      <TextField
        isRequired
        className={AMOUNT_CLASS_NAME}
        name={LIMIT_AMOUNT_FIELD}
        inputMode="decimal"
        value={row.amount}
        isInvalid={amountError !== undefined}
        onChange={(amount) => onChange({ amount })}
      >
        <Label>{LIMIT_AMOUNT_LABEL}</Label>
        <Input
          variant={FIELD_VARIANT}
          className={FIELD_HEIGHT_CLASS_NAME}
          placeholder={LIMIT_AMOUNT_PLACEHOLDER}
        />
        {amountError ? <FieldError>{amountError}</FieldError> : null}
      </TextField>

      <Button
        isIconOnly
        size="sm"
        variant="danger-soft"
        aria-label={removeLimitLabel(row.currency)}
        isDisabled={!canRemove}
        onPress={onRemove}
      >
        <TrashIcon className={ICON_CLASS_NAME} aria-hidden="true" />
      </Button>
    </div>
  );
}
```

`LimitRow/index.ts`: `export { LimitRow } from "./LimitRow";`

`LimitsField/LimitsField.tsx`:

```tsx
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";

import { LimitRow } from "./components/LimitRow";
import { ADD_LIMIT_LABEL, LIMITS_HINT, LIMITS_LABEL } from "./consts";
import {
  ERROR_CLASS_NAME,
  HINT_CLASS_NAME,
  ICON_CLASS_NAME,
  LEGEND_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { LimitsFieldProps } from "./types";
import { useLimitRows } from "./useLimitRows";
import { currencyChoices } from "./utils";

// The caps of a credit card, one per currency: at least one (the last one cannot be removed), never
// two in the same currency (a row only offers the currencies no other row uses). The server's errors
// land on the row they are about, by position, or under the list.
export function LimitsField({ defaultLimits, fieldErrors }: LimitsFieldProps) {
  const { rows, add, remove, change, canAdd } = useLimitRows(defaultLimits);
  const listError = fieldErrors.limits?.[0];

  return (
    <fieldset className={ROOT_CLASS_NAME}>
      <legend className={LEGEND_CLASS_NAME}>{LIMITS_LABEL}</legend>
      <p className={HINT_CLASS_NAME}>{LIMITS_HINT}</p>
      {rows.map((row, index) => (
        <LimitRow
          key={row.key}
          row={row}
          currencies={currencyChoices(rows, index)}
          canRemove={rows.length > 1}
          currencyError={fieldErrors[`limits.${index}.currency`]?.[0]}
          amountError={fieldErrors[`limits.${index}.amount`]?.[0]}
          onChange={(patch) => change(row.key, patch)}
          onRemove={() => remove(row.key)}
        />
      ))}
      {listError ? (
        <p role="alert" className={ERROR_CLASS_NAME}>
          {listError}
        </p>
      ) : null}
      <Button variant="secondary" size="sm" isDisabled={!canAdd} onPress={add}>
        <PlusIcon className={ICON_CLASS_NAME} aria-hidden="true" />
        {ADD_LIMIT_LABEL}
      </Button>
    </fieldset>
  );
}
```

`LimitsField/index.ts`: `export { LimitsField } from "./LimitsField";`

- [ ] **Step 6: The preview, the draft, the drawer and the form**

In `CardPreview/types.ts`, replace `closingDay`/`dueDay` with:

```ts
  // The days typed so far (NaN while a field is empty), or null for a debit card, which has no cycle.
  cycle: { closingDay: number; dueDay: number } | null;
```

In `CardPreview/consts.ts` append:

```ts
// Said instead of the cycle on a debit or prepaid card.
export const NO_CYCLE_TEXT = "Débito o prepago";
```

In `CardPreview.tsx`, destructure `{ brand, last4, cycle }`, import `NO_CYCLE_TEXT`, and replace the cycle paragraph with:

```tsx
<p className={CYCLE_CLASS_NAME}>
  {cycle ? cycleText(cycle.closingDay, cycle.dueDay) : NO_CYCLE_TEXT}
</p>
```

In `CardFormDrawer/types.ts`:

```ts
import type { BankChoice } from "@/core/banks/types";
import type { CardBrand, CardKind } from "@/core/cards/types";

import type { FormTarget } from "../../types";

export interface CardFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: FormTarget;
  // The user's active banks: a new card belongs to one of them.
  banks: readonly BankChoice[];
}

// What the form holds while it is open, shared by the fields and the card preview.
export interface CardDraft {
  kind: CardKind;
  last4: string;
  brand: CardBrand;
  // NaN while a day field is empty.
  closingDay: number;
  dueDay: number;
  setKind: (kind: CardKind) => void;
  setLast4: (last4: string) => void;
  setBrand: (brand: CardBrand) => void;
  setClosingDay: (day: number) => void;
  setDueDay: (day: number) => void;
}

export type CardFormContentProps = Pick<
  CardFormDrawerProps,
  "onClose" | "target" | "banks"
>;
```

In `useCardDraft.ts`, import `DEFAULT_CARD_KIND` from `@/core/cards/consts` and `CardKind` from `@/core/cards/types`, add `const [kind, setKind] = useState<CardKind>(card?.kind ?? DEFAULT_CARD_KIND);`, and return `kind` and `setKind` with the rest.

In `CardFormDrawer.tsx`, destructure `banks` and pass it: `<CardFormContent key={target.key} target={target} banks={banks} onClose={onClose} />`.

In `CardFormDrawer/consts.ts`, delete `LIMIT_AMOUNT_FIELD_NAME`, `LIMIT_AMOUNT_LABEL` and `LIMIT_AMOUNT_HINT` (they moved to `LimitsField/consts.ts`).

Replace the whole content of `CardFormContent.tsx` with:

```tsx
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button, Drawer, Form } from "@heroui/react";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { CANCEL_LABEL } from "@/components/Entries/formConsts";
import {
  AMOUNT_ROW_CLASS_NAME,
  DRAWER_DESCRIPTION_CLASS_NAME,
  FORM_CLASS_NAME,
} from "@/components/Entries/styles";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { createCardAction, updateCardAction } from "@/core/cards/actions";
import type { CardFieldErrors } from "@/core/cards/types";

import { BankField } from "./components/BankField";
import { BrandField } from "./components/BrandField";
import { CardIdentity } from "./components/CardIdentity";
import { CardPreview } from "./components/CardPreview";
import { DayField } from "./components/DayField";
import { KindField } from "./components/KindField";
import { Last4Field } from "./components/Last4Field";
import { LimitModeField } from "./components/LimitModeField";
import { LimitsField } from "./components/LimitsField";
import {
  CLOSING_DAY_FIELD_NAME,
  CLOSING_DAY_HINT,
  CLOSING_DAY_LABEL,
  CREATE_DESCRIPTION,
  CREATE_HEADING,
  CREATE_PENDING_LABEL,
  CREATE_SUBMIT_LABEL,
  DEFAULT_LIMIT_MODE,
  DUE_DAY_FIELD_NAME,
  DUE_DAY_HINT,
  DUE_DAY_LABEL,
  EDIT_DESCRIPTION,
  EDIT_HEADING,
  EDIT_PENDING_LABEL,
  EDIT_SUBMIT_LABEL,
  FORM_ID,
} from "./consts";
import type { CardFormContentProps } from "./types";
import { useCardDraft } from "./useCardDraft";

// Mounted with a fresh key on every opening, so field defaults and errors always reset. A new card
// chooses its kind and bank; an edit shows them and sends them back unchanged. Only a credit card has
// the cycle, the kind of cap and the caps per currency.
export function CardFormContent({
  target,
  banks,
  onClose,
}: CardFormContentProps) {
  const { card } = target;
  const draft = useCardDraft(card);
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<CardFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const isCredit = draft.kind === "CREDIT";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = card
        ? await updateCardAction(card.id, formData)
        : await createCardAction(formData);

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
        <Drawer.Heading>{card ? EDIT_HEADING : CREATE_HEADING}</Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
          {card ? EDIT_DESCRIPTION : CREATE_DESCRIPTION}
        </p>
      </Drawer.Header>
      <Drawer.Body>
        <Form
          id={FORM_ID}
          className={FORM_CLASS_NAME}
          validationErrors={fieldErrors}
          onSubmit={handleSubmit}
        >
          <CardPreview
            brand={draft.brand}
            last4={draft.last4}
            cycle={
              isCredit
                ? { closingDay: draft.closingDay, dueDay: draft.dueDay }
                : null
            }
          />

          {card ? (
            <CardIdentity
              kind={card.kind}
              bankId={card.bankId}
              bankName={card.bankName}
              errorMessage={fieldErrors.kind?.[0] ?? fieldErrors.bankId?.[0]}
            />
          ) : (
            <>
              <KindField value={draft.kind} onChange={draft.setKind} />
              <BankField banks={banks} />
            </>
          )}

          <Last4Field value={draft.last4} onChange={draft.setLast4} />

          <BrandField value={draft.brand} onChange={draft.setBrand} />

          {isCredit ? (
            <>
              <div className={AMOUNT_ROW_CLASS_NAME}>
                <DayField
                  name={CLOSING_DAY_FIELD_NAME}
                  label={CLOSING_DAY_LABEL}
                  hint={CLOSING_DAY_HINT}
                  value={draft.closingDay}
                  onChange={draft.setClosingDay}
                />
                <DayField
                  name={DUE_DAY_FIELD_NAME}
                  label={DUE_DAY_LABEL}
                  hint={DUE_DAY_HINT}
                  value={draft.dueDay}
                  onChange={draft.setDueDay}
                />
              </div>

              <LimitModeField
                defaultMode={card?.limitMode ?? DEFAULT_LIMIT_MODE}
              />

              <LimitsField
                defaultLimits={card?.limits ?? []}
                fieldErrors={fieldErrors}
              />
            </>
          ) : null}

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
          Icon={card ? undefined : PlusIcon}
          label={card ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL}
          pendingLabel={card ? EDIT_PENDING_LABEL : CREATE_PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
```

- [ ] **Step 7: The page hands the banks to the form (tests first)**

In `components/Cards/Cards.test.tsx` and `components/Cards/Cards.bulkDelete.test.tsx`, add `import type { BankChoice } from "@/core/banks/types";` and, after the fixtures, `const BANKS: BankChoice[] = [{ id: "bank_1", name: "Banco Galicia" }];`, and add `banks={BANKS}` to every `<Cards …/>` element (every `render(<Cards table={…} />)` and `rerender(<Cards table={…} />)`, the never-settling `table={new Promise(() => {})}` one included). Append to `describe("Cards page")` of `components/Cards/Cards.test.tsx`, right after "opens the form to add a card from the empty state":

```tsx
it("offers the user's banks in the form, the only one preselected", async () => {
  render(<Cards table={NO_CARDS} banks={BANKS} />);

  fireEvent.click(screen.getByRole("button", { name: "Agregar tarjeta" }));

  expect(
    await screen.findByRole("button", { name: /Banco Galicia Banco$/ }),
  ).toBeInTheDocument();
});
```

Run: `npx vitest run components/Cards`
Expected: FAIL (`Cards` has no `banks` prop).

In `components/Cards/types.ts`, import `BankChoice` from `@/core/banks/types` and change `CardsProps` to:

```ts
export interface CardsProps {
  table: Source<CardsTableData>;
  // The user's active banks, which the form offers for a new card.
  banks: Source<readonly BankChoice[]>;
}
```

In `components/Cards/Cards.tsx`, destructure `{ table, banks }` and wrap the drawer:

```tsx
{
  /* The form mounts once the banks it offers are here. */
}
<Await source={banks} fallback={null}>
  {(loadedBanks) => (
    <CardFormDrawer
      isOpen={formState.isOpen}
      onOpenChange={formState.setOpen}
      onClose={formState.close}
      target={formTarget}
      banks={loadedBanks}
    />
  )}
</Await>;
```

(`app/dashboard/cards/page.tsx` already spreads the view into `<Cards {...view} />`, so it passes `banks` with no change.)

Run: `npx vitest run components/Cards app/dashboard/cards core/cards core/banks`
Expected: PASS.

- [ ] **Step 8: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts components/shared/PendingButton/pendingButtonUsage.test.ts`, `npx prettier --check --end-of-line auto core/banks core/cards/pageData.ts core/cards/pageData.test.ts app/dashboard/cards components/Cards`.
Expected: all green.

- [ ] **Step 9: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 4: A debit expense takes its bank's account and checks its funds (core)

**Files:**

- Modify: `core/balances/accountBalances.ts`, `core/balances/accountBalances.test.ts`
- Modify: `core/cards/consts.ts`, `core/cards/errors.ts`
- Modify: `core/expenses/types.ts`, `core/expenses/errors.ts`, `core/expenses/schema.ts`, `core/expenses/schema.test.ts`
- Create: `core/expenses/debit.ts`, `core/expenses/debit.test.ts`
- Modify: `core/expenses/service.ts`, `core/expenses/service.test.ts`
- Create: `core/expenses/service.debit.test.ts`
- Modify: `core/expenses/actions.ts`, `core/expenses/actions.test.ts`

**Interfaces:**

- Consumes: `findOwnedCard` (returns a `DebitCard` with `accounts`), `limitIn`, `debitAccountIn`, `CardCurrencyMismatchError` (Task 2); `lockAccount(tx, userId, accountId): Promise<LockedAccount | null>` (`@/core/accounts/locks`); `readAccountBalances(db, userId, accountIds?, options?)` (`@/core/balances/accountBalances`); `assertUsableAccount` (`@/core/accounts/usable`); `insufficientFundsMessage(available: string)` (`@/core/transfers/consts`); `formatMoney`, `minorUnitsToNumber`; `ACCOUNT_REQUIRED_MESSAGE` (`@/core/accounts/consts`).
- Produces:
  - `BalanceOptions.excludeExpenseId?: string` (leaves one expense out of the expense sums).
  - `CardBankWithoutAccountError(currency: string)` (`core/cards/errors.ts`) and `cardBankWithoutAccountMessage(currency: string): string` (`core/cards/consts.ts`).
  - `ExpenseInsufficientFundsError(available: number, currency: string)` and `ExpenseAccountRequiredError` (`core/expenses/errors.ts`).
  - `core/expenses/debit.ts`: `StoredCharge { cardId: string | null; currency: string; accountId: string; amount: number; date: string; status: EntryStatus }`, `DebitClaim = Pick<StoredCharge, "accountId" | "amount" | "date" | "status">`, `debitAccountOf(card: Pick<DebitCard, "id" | "accounts">, currency: string, stored: Pick<StoredCharge, "cardId" | "currency" | "accountId"> | null): string`, `needsDebitFundsCheck(stored: DebitClaim | null, next: DebitClaim): boolean`.
  - `ExpenseInput.accountId: string | null` (the schema requires it only without a card).
  - `createExpense`, `updateExpense`, `setExpenseStatus` keep their signatures; the actions map the new refusals (`amount` / `cardId` / `accountId` on a form, a plain message for the status).

- [ ] **Step 1: The balance reader can leave one expense out (tests first)**

Append to `core/balances/accountBalances.test.ts`, inside `describe("readAccountBalances")`:

```ts
describe("excludeExpenseId", () => {
  it("leaves that expense out of the expenses only, so an edit never counts against itself", async () => {
    await readAccountBalances(db as never, USER_ID, ["acc_bank"], {
      excludeExpenseId: "exp_1",
    });

    expect(db.expense.groupBy.mock.calls[0][0].where.id).toEqual({
      not: "exp_1",
    });
    expect(db.income.groupBy.mock.calls[0][0].where.id).toBeUndefined();
    expect(db.transfer.groupBy).toHaveBeenCalledTimes(2);
    for (const call of db.transfer.groupBy.mock.calls) {
      expect(call[0].where.id).toBeUndefined();
    }
  });

  it("counts every expense when none is left out", async () => {
    await readAccountBalances(db as never, USER_ID, ["acc_bank"]);

    expect(db.expense.groupBy.mock.calls[0][0].where.id).toBeUndefined();
  });
});
```

Run: `npx vitest run core/balances/accountBalances.test.ts`
Expected: FAIL (`excludeExpenseId` is ignored).

In `core/balances/accountBalances.ts`, add to `BalanceOptions`:

```ts
  // An expense left out of the sums: the one an edit (or a change of status) is about to replace, so
  // it never counts against its own funds.
  excludeExpenseId?: string;
```

destructure it (`{ asOf, excludeTransferId, excludeExpenseId }: BalanceOptions = {}`), and replace `const expenses = await db.expense.groupBy(query);` with:

```ts
const expenses = await db.expense.groupBy({
  ...query,
  where: {
    ...query.where,
    ...(excludeExpenseId ? { id: { not: excludeExpenseId } } : {}),
  },
});
```

Run: `npx vitest run core/balances`
Expected: PASS.

- [ ] **Step 2: The pure rules of a debit expense (tests first)**

Create `core/expenses/debit.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { CardBankWithoutAccountError } from "@/core/cards/errors";
import { debitCard } from "@/core/cards/testFixtures";

import { debitAccountOf, needsDebitFundsCheck } from "./debit";
import type { DebitClaim } from "./debit";

const ASTROPAY = debitCard({
  accounts: [
    { id: "acc_ars", currency: "ARS", label: "AstroPay · Pesos" },
    { id: "acc_usd", currency: "USD", label: "AstroPay · Dólares" },
  ],
});

describe("debitAccountOf", () => {
  it("is the bank's active account in the expense's currency for a new expense", () => {
    expect(debitAccountOf(ASTROPAY, "USD", null)).toBe("acc_usd");
  });

  it("refuses a currency the bank has no active account in, naming the currency", () => {
    expect(() => debitAccountOf(ASTROPAY, "EUR", null)).toThrow(
      new CardBankWithoutAccountError("EUR"),
    );
  });

  it("keeps the account the money already left when the edit keeps the card and the currency, even if the bank has none now", () => {
    expect(
      debitAccountOf(debitCard({ accounts: [] }), "ARS", {
        cardId: "card_9",
        currency: "ARS",
        accountId: "acc_archived",
      }),
    ).toBe("acc_archived");
  });

  it("resolves the account again when the edit changes the card or the currency", () => {
    expect(
      debitAccountOf(ASTROPAY, "USD", {
        cardId: "card_9",
        currency: "ARS",
        accountId: "acc_ars",
      }),
    ).toBe("acc_usd");
    expect(
      debitAccountOf(ASTROPAY, "ARS", {
        cardId: "card_other",
        currency: "ARS",
        accountId: "acc_old",
      }),
    ).toBe("acc_ars");
  });
});

describe("needsDebitFundsCheck", () => {
  const PAID: DebitClaim = {
    accountId: "acc_ars",
    amount: 5000,
    date: "2026-10-05",
    status: "SETTLED",
  };

  it("checks a new paid expense, and never a planned or covered one", () => {
    expect(needsDebitFundsCheck(null, PAID)).toBe(true);
    expect(needsDebitFundsCheck(null, { ...PAID, status: "PLANNED" })).toBe(
      false,
    );
    expect(needsDebitFundsCheck(null, { ...PAID, status: "COVERED" })).toBe(
      false,
    );
  });

  it("checks an edit that asks something new of the account: paid now, another account, another day or more money", () => {
    expect(needsDebitFundsCheck({ ...PAID, status: "PLANNED" }, PAID)).toBe(
      true,
    );
    expect(needsDebitFundsCheck({ ...PAID, accountId: "acc_x" }, PAID)).toBe(
      true,
    );
    expect(needsDebitFundsCheck({ ...PAID, date: "2026-10-01" }, PAID)).toBe(
      true,
    );
    expect(needsDebitFundsCheck(PAID, { ...PAID, amount: 5001 })).toBe(true);
  });

  it("does not check an edit that asks nothing more: the same money (the notes), or less of it", () => {
    expect(needsDebitFundsCheck(PAID, PAID)).toBe(false);
    expect(needsDebitFundsCheck(PAID, { ...PAID, amount: 4000 })).toBe(false);
  });
});
```

Run: `npx vitest run core/expenses/debit.test.ts`
Expected: FAIL (`./debit` does not exist; `CardBankWithoutAccountError` is not exported).

Append to `core/cards/errors.ts`:

```ts
// The bank of a debit card has no active account in the currency of the expense (or the one it had was
// archived or changed while the expense was being saved).
export class CardBankWithoutAccountError extends Error {
  constructor(readonly currency: string) {
    super(`The bank of the card has no active account in ${currency}`);
    this.name = "CardBankWithoutAccountError";
  }
}
```

Append to `core/cards/consts.ts`:

```ts
export const cardBankWithoutAccountMessage = (currency: string): string =>
  `El banco de esta tarjeta no tiene una cuenta activa en ${currency}. Creá una en Bancos.`;
```

Create `core/expenses/debit.ts`:

```ts
import { CardBankWithoutAccountError } from "@/core/cards/errors";
import { debitAccountIn } from "@/core/cards/kinds";
import type { DebitCard } from "@/core/cards/types";
import type { EntryStatus } from "@/core/entries/status";

// Pure rules of an expense paid with a debit or prepaid card, apart from the service so they are
// tested without a database.

// What a stored expense already has, as far as its card and its money are concerned.
export interface StoredCharge {
  cardId: string | null;
  currency: string;
  accountId: string;
  // Minor units.
  amount: number;
  // "YYYY-MM-DD".
  date: string;
  status: EntryStatus;
}

// What an expense asks of the account it takes money from.
export type DebitClaim = Pick<
  StoredCharge,
  "accountId" | "amount" | "date" | "status"
>;

// The account a debit card's expense takes its money from. An edit that keeps the card and the
// currency keeps the account the money already left (even if it was archived since, or the bank has
// another one now), so an edit of the notes can never fail on it. Otherwise it is the bank's active
// account in the expense's currency, and a bank without one refuses the expense.
export const debitAccountOf = (
  card: Pick<DebitCard, "id" | "accounts">,
  currency: string,
  stored: Pick<StoredCharge, "cardId" | "currency" | "accountId"> | null,
): string => {
  if (stored && stored.cardId === card.id && stored.currency === currency) {
    return stored.accountId;
  }

  const account = debitAccountIn(card, currency);

  if (!account) {
    throw new CardBankWithoutAccountError(currency);
  }

  return account.id;
};

// Only a paid expense moves money, so only a paid one is checked. An edit is checked again only when it
// asks something new of the account: it becomes paid, or takes from another account, on another day,
// or more money. The same money on the same account and day (an edit of the notes), or less of it,
// keeps the claim the account already honoured.
export const needsDebitFundsCheck = (
  stored: DebitClaim | null,
  next: DebitClaim,
): boolean =>
  next.status === "SETTLED" &&
  (stored === null ||
    stored.status !== "SETTLED" ||
    stored.accountId !== next.accountId ||
    stored.date !== next.date ||
    next.amount > stored.amount);
```

Run: `npx vitest run core/expenses/debit.test.ts`
Expected: PASS.

- [ ] **Step 3: The expense form no longer needs an account with a card (tests first)**

Append to the `describe` of `core/expenses/schema.test.ts` that tests the account:

```ts
it("does not ask for the account when a card is chosen: the server decides or checks it by the card's kind", () => {
  const withCard: Record<string, unknown> = {
    ...validInput,
    cardId: "card_9",
  };

  delete withCard.accountId;

  expect(expenseInputSchema.safeParse(withCard)).toMatchObject({
    success: true,
    data: { accountId: null, cardId: "card_9" },
  });
});
```

Run: `npx vitest run core/expenses/schema.test.ts`
Expected: FAIL (`accountId` is still required).

In `core/expenses/types.ts`, change `accountId: string;` of `ExpenseInput` to:

```ts
// The account the money left (for a credit card, the account that pays the statement): the user's and
// in the currency of the expense (the service checks it). Null when a card is chosen and the form sent
// none: a debit card's account is decided on the server, a credit card's is still required.
accountId: string | null;
```

In `core/expenses/schema.ts`, replace `accountIdField` in the imports with nothing (drop it), add `import { ACCOUNT_REQUIRED_MESSAGE } from "@/core/accounts/consts";`, add:

```ts
// The account the money leaves. Without a card it is required here; with one, the service decides (a
// debit card's account comes from its bank, a credit card's is still required).
const optionalAccountIdField = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null);
```

use `accountId: optionalAccountIdField,` in the object, and add to the `superRefine`:

```ts
if (!value.cardId && !value.accountId) {
  ctx.addIssue({
    code: "custom",
    path: ["accountId"],
    message: ACCOUNT_REQUIRED_MESSAGE,
  });
}
```

Run: `npx vitest run core/expenses/schema.test.ts core/expenses/schema.origin.test.ts core/expenses/schema.reimbursement.test.ts`
Expected: PASS (the existing "rejects a missing or blank account" still holds without a card).

- [ ] **Step 4: Write the failing service tests**

Append to `core/expenses/errors.ts`:

```ts
// The account a debit card takes the money from holds less than the expense, on its date or now
// (`available` is the lower of the two, in minor units of `currency`).
export class ExpenseInsufficientFundsError extends Error {
  constructor(
    readonly available: number,
    readonly currency: string,
  ) {
    super(`The account holds ${available} (${currency})`);
    this.name = "ExpenseInsufficientFundsError";
  }
}

// An expense paid with a credit card still needs the account that pays the statement.
export class ExpenseAccountRequiredError extends Error {
  constructor() {
    super("The expense needs an account");
    this.name = "ExpenseAccountRequiredError";
  }
}
```

In `core/expenses/service.test.ts`:

- delete the test "refuses a debit card for now, writing nothing" added in Task 2 (and `CardKindNotAllowedError` and `debitCardRecord` from its imports if nothing else uses them);
- in `describe("updateExpense")`, make `found` also return `cardId: null`, `amount: BigInt(35000050)`, `date: new Date("2026-09-05T00:00:00.000Z")` and `status: "SETTLED"`, and change the expected `select` of "looks the record up scoped to the user" to:

```ts
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
```

Create `core/expenses/service.debit.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// The transaction gets its own client, so the tests can tell what ran inside it from what did not.
const tx = vi.hoisted(() => ({
  expense: { create: vi.fn(), updateMany: vi.fn() },
  recurringExpense: { create: vi.fn() },
  recurringExpenseDecision: { create: vi.fn() },
}));

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  expense: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  card: { findFirst: vi.fn() },
  expenseCategory: { findFirst: vi.fn() },
}));

const usable = vi.hoisted(() => ({ assertUsableAccount: vi.fn() }));
const locks = vi.hoisted(() => ({ lockAccount: vi.fn() }));
const balances = vi.hoisted(() => ({ readAccountBalances: vi.fn() }));
const reimbursements = vi.hoisted(() => ({
  countLinkedIncomes: vi.fn(),
  listReceivedTotals: vi.fn(),
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/accounts/usable", () => usable);
vi.mock("@/core/accounts/locks", () => locks);
vi.mock("@/core/balances/accountBalances", () => balances);
vi.mock("@/core/reimbursements/service", () => reimbursements);

import { CardBankWithoutAccountError } from "@/core/cards/errors";
import { creditCardRecord, debitCardRecord } from "@/core/cards/testFixtures";

import {
  ExpenseAccountRequiredError,
  ExpenseInsufficientFundsError,
} from "./errors";
import { createExpense, setExpenseStatus, updateExpense } from "./service";
import type { ExpenseInput } from "./types";

const USER_ID = "user_123";
const AT = new Date("2026-10-06T10:00:00.000Z");

// A debit card of Banco Galicia, whose only active account is the ARS "Caja de ahorro" (acc_1).
const input: ExpenseInput = {
  description: "Supermercado",
  amount: 500000,
  currency: "ARS",
  date: "2026-10-05",
  categoryId: "cat_1",
  notes: null,
  status: "SETTLED",
  accountId: null,
  isRecurring: false,
  cardId: "card_9",
  originCurrency: null,
  originAmount: null,
  expectedReimbursement: null,
};

const ROW = {
  id: "exp_1",
  userId: USER_ID,
  description: "Supermercado",
  amount: BigInt(500000),
  currency: "ARS",
  date: new Date("2026-10-05T00:00:00.000Z"),
  categoryId: "cat_1",
  category: { name: "Comida" },
  notes: null,
  status: "SETTLED",
  accountId: "acc_1",
  account: { name: "Caja de ahorro", bank: { name: "Banco Galicia" } },
  isRecurring: false,
  originCurrency: null,
  originAmount: null,
  expectedReimbursement: null,
  recurringExpenseId: null,
  installmentPlanId: null,
  installmentNumber: null,
  cardId: "card_9",
  purchaseDate: null,
  createdAt: AT,
  updatedAt: AT,
};

const LOCKED = { id: "acc_1", currency: "ARS", archivedAt: null };

const balance = (amount: number, accountId = "acc_1") => [
  { accountId, currency: "ARS", balance: amount },
];

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (client: typeof tx) => unknown) =>
    run(tx),
  );
  db.expenseCategory.findFirst.mockResolvedValue({ id: "cat_1" });
  db.card.findFirst.mockResolvedValue(debitCardRecord());
  locks.lockAccount.mockResolvedValue(LOCKED);
  balances.readAccountBalances.mockResolvedValue(balance(1000000));
  reimbursements.countLinkedIncomes.mockResolvedValue(0);
  tx.expense.create.mockResolvedValue(ROW);
  db.expense.create.mockResolvedValue(ROW);
  tx.expense.updateMany.mockResolvedValue({ count: 1 });
  db.expense.updateMany.mockResolvedValue({ count: 1 });
});

describe("createExpense with a debit card", () => {
  it("takes the money from its bank's active account in the expense's currency, whatever account the form sent", async () => {
    await createExpense(USER_ID, { ...input, accountId: "acc_other" });

    expect(tx.expense.create.mock.calls[0][0].data).toMatchObject({
      accountId: "acc_1",
      cardId: "card_9",
      purchaseDate: null,
      date: new Date("2026-10-05T00:00:00.000Z"),
    });
  });

  it("checks the resolved account like any other: the user's, active and in the currency", async () => {
    await createExpense(USER_ID, input);

    expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
      accountId: "acc_1",
      currency: "ARS",
      keepAccountId: null,
    });
  });

  it("locks the account, then reads its balance on the expense's date and now, then writes, all in one transaction", async () => {
    const order: string[] = [];

    locks.lockAccount.mockImplementation(async () => {
      order.push("lock");

      return LOCKED;
    });
    balances.readAccountBalances.mockImplementation(async () => {
      order.push("read");

      return balance(1000000);
    });
    tx.expense.create.mockImplementation(async () => {
      order.push("write");

      return ROW;
    });

    await createExpense(USER_ID, input);

    expect(order).toEqual(["lock", "read", "read", "write"]);
    expect(locks.lockAccount).toHaveBeenCalledWith(tx, USER_ID, "acc_1");
    expect(balances.readAccountBalances.mock.calls).toEqual([
      [
        tx,
        USER_ID,
        ["acc_1"],
        { asOf: "2026-10-05", excludeExpenseId: undefined },
      ],
      [tx, USER_ID, ["acc_1"], { excludeExpenseId: undefined }],
    ]);
    expect(db.expense.create).not.toHaveBeenCalled();
  });

  it("refuses a paid expense the account cannot cover, naming the lower of the two balances, and writes nothing", async () => {
    balances.readAccountBalances
      .mockResolvedValueOnce(balance(800000))
      .mockResolvedValueOnce(balance(300000));

    await expect(createExpense(USER_ID, input)).rejects.toEqual(
      new ExpenseInsufficientFundsError(300000, "ARS"),
    );
    expect(tx.expense.create).not.toHaveBeenCalled();
  });

  it("takes an expense that leaves the account at exactly zero", async () => {
    balances.readAccountBalances.mockResolvedValue(balance(500000));

    await createExpense(USER_ID, input);

    expect(tx.expense.create).toHaveBeenCalledTimes(1);
  });

  it.each(["PLANNED", "COVERED"] as const)(
    "saves a %s one without locking or reading any balance: it moves no money yet",
    async (status) => {
      await createExpense(USER_ID, { ...input, status });

      expect(locks.lockAccount).not.toHaveBeenCalled();
      expect(balances.readAccountBalances).not.toHaveBeenCalled();
      expect(db.expense.create.mock.calls[0][0].data).toMatchObject({
        accountId: "acc_1",
        status,
      });
    },
  );

  it("refuses a currency its bank has no active account in, writing nothing", async () => {
    await expect(
      createExpense(USER_ID, { ...input, currency: "EUR" }),
    ).rejects.toEqual(new CardBankWithoutAccountError("EUR"));
    expect(tx.expense.create).not.toHaveBeenCalled();
    expect(db.expense.create).not.toHaveBeenCalled();
  });

  it("refuses when the account was archived between the read and the lock, reading no balance", async () => {
    locks.lockAccount.mockResolvedValue({ ...LOCKED, archivedAt: AT });

    await expect(createExpense(USER_ID, input)).rejects.toBeInstanceOf(
      CardBankWithoutAccountError,
    );
    expect(balances.readAccountBalances).not.toHaveBeenCalled();
  });

  it("saves a recurring one with its card-less template in the resolved account, in the transaction of the check", async () => {
    tx.recurringExpense.create.mockResolvedValue({ id: "tpl_1" });

    await createExpense(USER_ID, { ...input, isRecurring: true });

    expect(tx.recurringExpense.create.mock.calls[0][0].data).toMatchObject({
      accountId: "acc_1",
    });
    expect(tx.recurringExpense.create.mock.calls[0][0].data).not.toHaveProperty(
      "cardId",
    );
    expect(tx.expense.create.mock.calls[0][0].data).toMatchObject({
      recurringExpenseId: "tpl_1",
      isRecurring: true,
    });
  });
});

describe("createExpense with a credit card", () => {
  beforeEach(() => {
    db.card.findFirst.mockResolvedValue(creditCardRecord());
  });

  it("reads no balance: the account only pays the statement later", async () => {
    await createExpense(USER_ID, {
      ...input,
      cardId: "card_1",
      accountId: "acc_1",
    });

    expect(locks.lockAccount).not.toHaveBeenCalled();
    expect(db.expense.create).toHaveBeenCalledTimes(1);
  });

  it("still needs the account chosen in the form", async () => {
    await expect(
      createExpense(USER_ID, { ...input, cardId: "card_1", accountId: null }),
    ).rejects.toBeInstanceOf(ExpenseAccountRequiredError);
    expect(db.expense.create).not.toHaveBeenCalled();
  });
});

describe("updateExpense with a debit card", () => {
  const stored = (patch: Record<string, unknown> = {}) =>
    db.expense.findFirst.mockResolvedValue({
      recurringExpenseId: null,
      installmentPlanId: null,
      currency: "ARS",
      expectedReimbursement: null,
      accountId: "acc_1",
      cardId: "card_9",
      amount: BigInt(500000),
      date: new Date("2026-10-05T00:00:00.000Z"),
      status: "SETTLED",
      ...patch,
    });

  it("saves an edit of the notes alone without reading any balance, keeping the account even if the bank has none now", async () => {
    stored();
    db.card.findFirst.mockResolvedValue(
      debitCardRecord({ bank: { name: "Banco Galicia", accounts: [] } }),
    );

    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, notes: "Con descuento" }),
    ).resolves.toBe(true);
    expect(locks.lockAccount).not.toHaveBeenCalled();
    expect(balances.readAccountBalances).not.toHaveBeenCalled();
    expect(db.expense.updateMany.mock.calls[0][0].data).toMatchObject({
      accountId: "acc_1",
      notes: "Con descuento",
    });
  });

  it("checks a higher amount against the balance without the expense itself", async () => {
    stored();
    balances.readAccountBalances.mockResolvedValue(balance(600000));

    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, amount: 600000 }),
    ).resolves.toBe(true);
    expect(balances.readAccountBalances.mock.calls).toEqual([
      [
        tx,
        USER_ID,
        ["acc_1"],
        { asOf: "2026-10-05", excludeExpenseId: "exp_1" },
      ],
      [tx, USER_ID, ["acc_1"], { excludeExpenseId: "exp_1" }],
    ]);
    expect(tx.expense.updateMany).toHaveBeenCalledTimes(1);
  });

  it("refuses a higher amount the account cannot cover, writing nothing", async () => {
    stored();
    balances.readAccountBalances.mockResolvedValue(balance(550000));

    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, amount: 600000 }),
    ).rejects.toEqual(new ExpenseInsufficientFundsError(550000, "ARS"));
    expect(tx.expense.updateMany).not.toHaveBeenCalled();
    expect(db.expense.updateMany).not.toHaveBeenCalled();
  });

  it("checks a pending one that is saved as paid, letting the lock keep the account it already has even if archived", async () => {
    stored({ status: "PLANNED" });
    locks.lockAccount.mockResolvedValue({ ...LOCKED, archivedAt: AT });

    await expect(updateExpense(USER_ID, "exp_1", input)).resolves.toBe(true);
    expect(locks.lockAccount).toHaveBeenCalledWith(tx, USER_ID, "acc_1");
    expect(tx.expense.updateMany).toHaveBeenCalledTimes(1);
  });

  it("takes no check when the expense leaves the debit card: the account only gains", async () => {
    stored();

    await updateExpense(USER_ID, "exp_1", {
      ...input,
      cardId: null,
      accountId: "acc_1",
    });

    expect(locks.lockAccount).not.toHaveBeenCalled();
    expect(db.expense.updateMany.mock.calls[0][0].data).toMatchObject({
      cardId: null,
    });
  });

  it("resolves the account again when the currency changes, and checks the new one", async () => {
    stored();
    db.card.findFirst.mockResolvedValue(
      debitCardRecord({
        bank: {
          name: "Banco Galicia",
          accounts: [
            { id: "acc_1", name: "Caja de ahorro", currency: "ARS" },
            { id: "acc_usd", name: "Cuenta en dólares", currency: "USD" },
          ],
        },
      }),
    );
    locks.lockAccount.mockResolvedValue({
      id: "acc_usd",
      currency: "USD",
      archivedAt: null,
    });
    balances.readAccountBalances.mockResolvedValue([
      { accountId: "acc_usd", currency: "USD", balance: 100000 },
    ]);

    await updateExpense(USER_ID, "exp_1", {
      ...input,
      currency: "USD",
      amount: 1000,
    });

    expect(locks.lockAccount).toHaveBeenCalledWith(tx, USER_ID, "acc_usd");
    expect(tx.expense.updateMany.mock.calls[0][0].data).toMatchObject({
      accountId: "acc_usd",
      currency: "USD",
    });
  });
});

describe("setExpenseStatus on a debit expense", () => {
  const pending = (patch: Record<string, unknown> = {}) =>
    db.expense.findFirst.mockResolvedValue({
      status: "PLANNED",
      amount: BigInt(500000),
      currency: "ARS",
      date: new Date("2026-10-05T00:00:00.000Z"),
      accountId: "acc_1",
      card: { kind: "DEBIT" },
      ...patch,
    });

  it("marks it paid only after checking its account, in one transaction", async () => {
    pending();

    await expect(setExpenseStatus(USER_ID, "exp_1", "SETTLED")).resolves.toBe(
      true,
    );
    expect(db.expense.findFirst).toHaveBeenCalledWith({
      where: { id: "exp_1", userId: USER_ID },
      select: {
        status: true,
        amount: true,
        currency: true,
        date: true,
        accountId: true,
        card: { select: { kind: true } },
      },
    });
    expect(locks.lockAccount).toHaveBeenCalledWith(tx, USER_ID, "acc_1");
    expect(balances.readAccountBalances.mock.calls[1]).toEqual([
      tx,
      USER_ID,
      ["acc_1"],
      { excludeExpenseId: "exp_1" },
    ]);
    expect(tx.expense.updateMany).toHaveBeenCalledWith({
      where: { id: "exp_1", userId: USER_ID },
      data: { status: "SETTLED" },
    });
  });

  it("refuses to mark it paid when the account cannot cover it", async () => {
    pending();
    balances.readAccountBalances.mockResolvedValue(balance(100));

    await expect(
      setExpenseStatus(USER_ID, "exp_1", "SETTLED"),
    ).rejects.toBeInstanceOf(ExpenseInsufficientFundsError);
    expect(tx.expense.updateMany).not.toHaveBeenCalled();
  });

  it("marks a credit card's or a card-less expense paid without looking at any account", async () => {
    pending({ card: { kind: "CREDIT" } });
    await setExpenseStatus(USER_ID, "exp_1", "SETTLED");
    pending({ card: null });
    await setExpenseStatus(USER_ID, "exp_1", "SETTLED");

    expect(locks.lockAccount).not.toHaveBeenCalled();
    expect(db.expense.updateMany).toHaveBeenCalledTimes(2);
  });

  it("takes it back to pending with no look-up at all", async () => {
    await setExpenseStatus(USER_ID, "exp_1", "PLANNED");

    expect(db.expense.findFirst).not.toHaveBeenCalled();
    expect(db.expense.updateMany).toHaveBeenCalledWith({
      where: { id: "exp_1", userId: USER_ID },
      data: { status: "PLANNED" },
    });
  });

  it("is false for an expense that is not the user's", async () => {
    db.expense.findFirst.mockResolvedValue(null);

    await expect(setExpenseStatus(USER_ID, "exp_9", "SETTLED")).resolves.toBe(
      false,
    );
    expect(db.expense.updateMany).not.toHaveBeenCalled();
  });
});
```

Run: `npx vitest run core/expenses/service.debit.test.ts core/expenses/service.test.ts`
Expected: FAIL (a debit card is still refused with `CardKindNotAllowedError`; no lock, no funds check; `updateExpense` does not select the new fields).

- [ ] **Step 5: Write the service**

In `core/expenses/service.ts`:

- imports: add `import { lockAccount } from "@/core/accounts/locks";`, `import { readAccountBalances } from "@/core/balances/accountBalances";`, `CardBankWithoutAccountError` to the `@/core/cards/errors` import (and drop `CardKindNotAllowedError` and `isCreditCard` from the Task 2 interim), `import { limitIn } from "@/core/cards/kinds";`, `minorUnitsToNumber` is already imported, `import { debitAccountOf, needsDebitFundsCheck } from "./debit";`, `import type { StoredCharge } from "./debit";`, and `ExpenseAccountRequiredError`, `ExpenseInsufficientFundsError` from `./errors`;
- replace everything from the comment "Where an expense lands once its card is known" down to (and including) `toCardData` with:

```ts
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
```

- replace `toWritableData` with (its comment stays, with "`date` is the date to store, which the card may have moved" extended by "and `accountId` the account the charge resolved"):

```ts
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
```

- change `createTemplateFor`'s signature to `(db: EntryWriter, userId: string, input: ExpenseInput, charge: Pick<Charge, "date" | "accountId">): Promise<string>`, and inside it use `db.` instead of `tx.`, `accountId: charge.accountId` and `charge.date` (in `dayOfMonthOf(charge.date)` and `monthOf(charge.date)`);
- replace `createExpense`, `updateExpense` and `setExpenseStatus` with:

```ts
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

// Returns false when no record with that id belongs to the user. An expense that already belongs
// to a template stays linked and recurring whatever the form says, and its template is never
// touched: stopping the repetition is done from the recurring-expenses wizard. One that does not
// belong to a template yet gets one when the switch is on, except an installment of a plan: it
// never becomes recurring. Any expense may be covered by someone else. The card of an installment is
// the card of its plan (always a credit card): an edit never changes it, and the installment keeps
// the date and the account it is given. Any other expense takes the card of the form (none clears
// it); a debit card re-checks its funds only when the edit asks something new of the account.
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
  await assertUsableAccount(userId, {
    accountId: charge.accountId,
    currency: input.currency,
    keepAccountId: createsTemplate ? null : current.accountId,
  });

  await assertReimbursementsStillValid(userId, id, current, input);

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
      where: { id, userId },
      data: {
        ...toWritableData(input, charge),
        ...cardData,
        isRecurring:
          recurringExpenseId !== null || current.recurringExpenseId !== null,
        ...(recurringExpenseId ? { recurringExpenseId } : {}),
      },
    });

    // A template created for an expense that is gone by now is undone with the transaction.
    if (count === 0 && recurringExpenseId !== null) {
      throw new ExpenseVanishedError();
    }

    return count > 0;
  };

  if (!createsTemplate && !needsFunds) {
    return write(prisma);
  }

  try {
    return await prisma.$transaction(async (tx) => {
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
          current.accountId,
        );
      }

      return write(tx);
    });
  } catch (error) {
    if (error instanceof ExpenseVanishedError) {
      return false;
    }

    throw error;
  }
};

// Changes the status of one expense without touching anything else. Returns false when no record
// with that id belongs to the user. Any expense may be COVERED (paid by someone else). Paying a
// pending debit expense takes its money now, so it goes through the funds check of a save; any other
// change looks at no account.
export const setExpenseStatus = async (
  userId: string,
  id: string,
  status: EntryStatus,
): Promise<boolean> => {
  const update = async (db: EntryWriter): Promise<boolean> => {
    const { count } = await db.expense.updateMany({
      where: { id, userId },
      data: { status },
    });

    return count > 0;
  };

  if (status !== "SETTLED") {
    return update(prisma);
  }

  const current = await prisma.expense.findFirst({
    where: { id, userId },
    select: {
      status: true,
      amount: true,
      currency: true,
      date: true,
      accountId: true,
      card: { select: { kind: true } },
    },
  });

  if (!current) {
    return false;
  }

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
```

Run: `npx vitest run core/expenses core/installments core/balances`
Expected: PASS (`service.test.ts`'s existing card, template, archived-account and status tests keep their meaning: a card-less or credit expense still writes outside a transaction, a recurring one inside one).

- [ ] **Step 6: The actions put each refusal where it belongs (tests first)**

In `core/expenses/actions.test.ts`, add the imports `import { CardBankWithoutAccountError } from "@/core/cards/errors";` (into the existing `@/core/cards/errors` import) and `import { ExpenseAccountRequiredError, ExpenseInsufficientFundsError } from "./errors";`, and append:

```ts
describe("the refusals of a debit card's expense", () => {
  const FUNDS =
    /^La cuenta de origen no tiene fondos suficientes: a esa fecha tenía \$\s300,00\.$/;

  it("puts an account that cannot cover a paid expense under Monto, and refreshes nothing", async () => {
    mocks.createExpense.mockRejectedValue(
      new ExpenseInsufficientFundsError(30000, "ARS"),
    );

    expect(await createExpenseAction(buildFormData())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { amount: [expect.stringMatching(FUNDS)] },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("puts the same refusal under Monto on an edit", async () => {
    mocks.updateExpense.mockRejectedValue(
      new ExpenseInsufficientFundsError(30000, "ARS"),
    );

    const result = await updateExpenseAction("exp_1", buildFormData());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      amount: [expect.stringMatching(FUNDS)],
    });
  });

  it("puts a bank without an account in the currency under Tarjeta, pointing to Bancos", async () => {
    mocks.createExpense.mockRejectedValue(
      new CardBankWithoutAccountError("EUR"),
    );

    const result = await createExpenseAction(buildFormData());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      cardId: [
        "El banco de esta tarjeta no tiene una cuenta activa en EUR. Creá una en Bancos.",
      ],
    });
  });

  it("asks for the account of a credit card's expense under Cuenta", async () => {
    mocks.createExpense.mockRejectedValue(new ExpenseAccountRequiredError());

    const result = await createExpenseAction(buildFormData());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      accountId: ["Elegí una cuenta."],
    });
  });

  it("sends a debit card's expense with no account to the service", async () => {
    const formData = buildFormData({ cardId: "card_9" });

    formData.delete("accountId");
    mocks.createExpense.mockResolvedValue({ id: "exp_1" });

    expect(await createExpenseAction(formData)).toEqual({ status: "success" });
    expect(mocks.createExpense.mock.calls[0][1]).toMatchObject({
      cardId: "card_9",
      accountId: null,
    });
  });

  it("says why a debit expense cannot be marked paid as a plain message, the checkbox having no fields", async () => {
    mocks.setExpenseStatus.mockRejectedValue(
      new ExpenseInsufficientFundsError(30000, "ARS"),
    );

    expect(await setExpenseStatusAction("exp_1", "SETTLED")).toEqual({
      status: "error",
      message: expect.stringMatching(FUNDS),
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("ids that are not text", () => {
  it("are refused by the edit and the status before the service is called", async () => {
    expect(
      await updateExpenseAction(undefined as never, buildFormData()),
    ).toEqual({ status: "error", message: "No se encontró el gasto." });
    expect(await setExpenseStatusAction(undefined as never, "SETTLED")).toEqual(
      { status: "error", message: "No se encontró el gasto." },
    );
    expect(mocks.updateExpense).not.toHaveBeenCalled();
    expect(mocks.setExpenseStatus).not.toHaveBeenCalled();
  });
});
```

Run: `npx vitest run core/expenses/actions.test.ts`
Expected: FAIL (the refusals fall through to the generic error; the ids are not guarded).

In `core/expenses/actions.ts`:

- add the imports `import { ACCOUNT_REQUIRED_MESSAGE } from "@/core/accounts/consts";`, `import { cardBankWithoutAccountMessage } from "@/core/cards/consts";`, `import { CardBankWithoutAccountError } from "@/core/cards/errors";`, `import { formatMoney } from "@/core/incomes/money";`, `import { insufficientFundsMessage } from "@/core/transfers/consts";` and `import { ExpenseAccountRequiredError, ExpenseInsufficientFundsError } from "./errors";`;
- add after `finish`:

```ts
// The refusals of a write that involves a debit card's money or a credit card's account, on the field
// they are about, or as a plain message for the status checkbox (`plain`), which has no fields.
// Anything else is left for runAuthenticated.
const toExpenseFailure = (
  error: unknown,
  plain: boolean,
): ActionFailure | undefined => {
  if (error instanceof ExpenseInsufficientFundsError) {
    const message = insufficientFundsMessage(
      formatMoney(error.available, error.currency),
    );

    return plain ? failure(message) : fieldFailure({ amount: [message] });
  }

  if (error instanceof CardBankWithoutAccountError) {
    const message = cardBankWithoutAccountMessage(error.currency);

    return plain ? failure(message) : fieldFailure({ cardId: [message] });
  }

  if (error instanceof ExpenseAccountRequiredError) {
    return fieldFailure({ accountId: [ACCOUNT_REQUIRED_MESSAGE] });
  }

  return undefined;
};

const attempt = async (
  run: () => Promise<ExpenseActionResult>,
  plain: boolean,
): Promise<ExpenseActionResult> => {
  try {
    return await run();
  } catch (error) {
    const known = toExpenseFailure(error, plain);

    if (known) {
      return known;
    }

    throw error;
  }
};

// An id that is not text cannot be an expense of the user (and undefined would vanish from a where).
const isUsableId = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0;
```

- in `createExpenseAction`, replace `await createExpense(userId, parsed.data); return finish(true);` with:

```ts
return attempt(async () => {
  await createExpense(userId, parsed.data);

  return finish(true);
}, false);
```

- in `updateExpenseAction`, add at the top of the callback `if (!isUsableId(id)) { return failure(EXPENSE_NOT_FOUND_MESSAGE); }` and replace the last line with `return attempt(async () => finish(await updateExpense(userId, id, parsed.data)), false);`;
- in `setExpenseStatusAction`, add the same id guard first and replace the last line with `return attempt(async () => finish(await setExpenseStatus(userId, id, status)), true);`.

Run: `npx vitest run core/expenses`
Expected: PASS.

- [ ] **Step 7: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto core/balances/accountBalances.ts core/balances/accountBalances.test.ts core/cards/consts.ts core/cards/errors.ts core/expenses`.
Expected: all green.

- [ ] **Step 8: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 5: The expense form and the table for a debit card

**Files:**

- Modify: `components/Entries/components/CardField/types.ts`, `CardField.tsx`, `CardField.test.tsx`
- Modify: `components/Expenses/types.ts`
- Modify: `components/Expenses/components/ExpenseFormDrawer/ExpenseFormContent.tsx`, `utils.ts`
- Create: `components/Expenses/components/ExpenseFormDrawer/components/DebitAccountLine/{DebitAccountLine.tsx,index.ts,types.ts,consts.ts,styles.ts}`
- Create: `components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.debit.test.tsx`
- Modify: `components/Entries/useOptimisticStatus.ts`, `components/Entries/useOptimisticStatus.test.tsx`
- Modify: `components/Expenses/Expenses.tsx`, `components/Expenses/Expenses.test.tsx`

**Interfaces:**

- Consumes: `CardOption`, `creditOption`, `debitOption` (Task 2); `debitAccountIn` (`@/core/cards/kinds`); `createExpenseAction`, `updateExpenseAction`, `setExpenseStatusAction` and their refusals (Task 4); `InlineAlert` (`@/components/shared/InlineAlert`).
- Produces: `CardFieldProps.keepCardId?: string | null`; `DebitCardOption = Extract<CardOption, { kind: "DEBIT" }>`; `keepsOwnCard(expense: Pick<ExpenseRow, "cardId" | "currency"> | null, cardId: string, currency: string): boolean` and `debitAccountLabel(card: DebitCardOption, currency: string, expense: Pick<ExpenseRow, "cardId" | "currency" | "accountLabel"> | null): string` (`ExpenseFormDrawer/utils.ts`); `useOptimisticStatus(save)` returns `{ toggle, apply, refusal: string | null }`.

- [ ] **Step 1: Read the docs and the components to copy**

Read `C:\Users\Nico\Desktop\insight-in\.heroui-docs\react\components\(pickers)\select.mdx` and `(feedback)\alert.mdx`, then `components/Entries/components/AccountField/AccountField.tsx` (the line under a field), `components/Expenses/components/ExpenseFormDrawer/ExpenseFormContent.tsx` and `components/shared/InlineAlert/InlineAlert.tsx`.

- [ ] **Step 2: The card field keeps the record's own card (tests first)**

Append to `components/Entries/components/CardField/CardField.test.tsx`:

```ts
it("keeps offering the card the record already has, even in a currency it no longer pays in", async () => {
  renderField({ currency: "ARS", value: "dollars", keepCardId: "dollars" });

  expect(trigger()).toHaveTextContent("Visa •••• 4321");

  const options = await open();

  expect(options.map((option) => option.textContent)).toContain(
    "Visa •••• 4321",
  );
});

it("does not offer that card to any other record", async () => {
  renderField({ currency: "ARS" });

  const options = await open();

  expect(options.map((option) => option.textContent)).not.toContain(
    "Visa •••• 4321",
  );
});
```

Run: `npx vitest run components/Entries/components/CardField`
Expected: FAIL (`keepCardId` is not a prop).

In `CardField/types.ts`, add to `CardFieldProps`:

```ts
  // The card the record being edited already has: offered even if it no longer pays in this currency
  // (a debit card whose bank archived that account), so an edit never drops it silently.
  keepCardId?: string | null;
```

In `CardField.tsx`, destructure `keepCardId = null` and filter with `cards.filter((card) => card.currencies.includes(currency) || card.id === keepCardId)`.

Run: `npx vitest run components/Entries/components/CardField`
Expected: PASS.

- [ ] **Step 3: Write the failing form tests**

Create `components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.debit.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createExpenseAction: vi.fn(),
  updateExpenseAction: vi.fn(),
  createCategoryAction: vi.fn(),
}));

vi.mock("@/core/expenses/actions", () => actions);

import type { AccountChoice } from "@/core/accounts/types";

import { creditOption, debitOption } from "../../testCards";
import type { CardOption, ExpenseRow, FormTarget } from "../../types";
import { ExpenseFormDrawer } from "./ExpenseFormDrawer";

const CATEGORIES = [{ id: "c1", name: "Comida" }];

const ACCOUNTS: AccountChoice[] = [
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

const CREDIT: CardOption = creditOption();

// A debit card of Banco Galicia, which has an active account in ARS and one in USD.
const DEBIT: CardOption = debitOption({
  accounts: [
    { id: "acc_1", currency: "ARS", label: "Banco Galicia · Caja de ahorro" },
    {
      id: "acc_usd",
      currency: "USD",
      label: "Banco Galicia · Cuenta en dólares",
    },
  ],
});

const EXPENSE: ExpenseRow = {
  id: "exp_1",
  description: "Supermercado",
  amount: 500000,
  currency: "ARS",
  date: "2026-10-05",
  categoryId: "c1",
  categoryName: "Comida",
  notes: null,
  status: "SETTLED",
  accountId: "acc_old",
  accountLabel: "Banco Galicia · Caja vieja",
  isRecurring: false,
  installmentPlanId: null,
  installmentNumber: null,
  cardId: "card_9",
  purchaseDate: null,
  originCurrency: null,
  originAmount: null,
  originAmountDecimal: null,
  originLabel: null,
  originTooltip: null,
  expectedReimbursement: null,
  reimbursementReceived: 0,
  expectedReimbursementDecimal: null,
  reimbursementTooltip: null,
  amountLabel: "$ 5.000,00",
  amountDecimal: "5000.00",
  dateLabel: "5 oct 2026",
};

const renderForm = (
  expense: ExpenseRow | null,
  cards: readonly CardOption[] = [CREDIT, DEBIT],
) => {
  const onClose = vi.fn();
  const target: FormTarget = { key: 1, expense, defaultDate: "2026-10-05" };

  render(
    <ExpenseFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
      categories={CATEGORIES}
      cards={cards}
      accounts={ACCOUNTS}
    />,
  );

  return { onClose };
};

const cardButton = () => screen.getByRole("button", { name: /Tarjeta$/ });
const accountButton = () => screen.queryByRole("button", { name: /Cuenta$/ });

const pick = async (trigger: HTMLElement, name: string | RegExp) => {
  fireEvent.keyDown(trigger, { key: "ArrowDown" });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

const pickCurrency = (code: string) =>
  pick(screen.getByRole("button", { name: /Moneda$/ }), new RegExp(`^${code}`));

const fillRequired = async () => {
  fireEvent.change(screen.getByLabelText(/Descripción/), {
    target: { value: "Supermercado" },
  });
  fireEvent.change(screen.getByLabelText(/Monto/), {
    target: { value: "5000" },
  });
  await pick(screen.getByRole("button", { name: /Categoría/ }), "Comida");
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("a debit or prepaid card on an expense", () => {
  it("is offered in the currencies of its bank's active accounts, and a credit card in those of its caps", async () => {
    renderForm(null);

    fireEvent.keyDown(cardButton(), { key: "ArrowDown" });

    expect(
      (await screen.findAllByRole("option")).map(
        (option) => option.textContent,
      ),
    ).toEqual(["Sin tarjeta", "Visa •••• 1234", "Visa •••• 9999"]);
  });

  it("is the only card offered in a currency only its bank has", async () => {
    renderForm(null);

    await pickCurrency("USD");
    fireEvent.keyDown(cardButton(), { key: "ArrowDown" });

    expect(
      (await screen.findAllByRole("option")).map(
        (option) => option.textContent,
      ),
    ).toEqual(["Sin tarjeta", "Visa •••• 9999"]);
  });

  it("replaces the Cuenta selector with the account it takes the money from", async () => {
    renderForm(null);

    expect(accountButton()).toBeInTheDocument();

    await pick(cardButton(), "Visa •••• 9999");

    expect(
      screen.getByText("Se descuenta de Banco Galicia · Caja de ahorro"),
    ).toBeVisible();
    expect(accountButton()).not.toBeInTheDocument();
  });

  it("names the bank's account in the new currency when the currency changes", async () => {
    renderForm(null);

    await pick(cardButton(), "Visa •••• 9999");
    await pickCurrency("USD");

    expect(
      screen.getByText("Se descuenta de Banco Galicia · Cuenta en dólares"),
    ).toBeVisible();
  });

  it("is dropped when the currency changes to one its bank has no account in, and the Cuenta selector comes back", async () => {
    renderForm(null);

    await pick(cardButton(), "Visa •••• 9999");
    await pickCurrency("EUR");

    expect(cardButton()).toHaveTextContent("Sin tarjeta");
    expect(accountButton()).toBeInTheDocument();
  });

  it("keeps the date called 'Fecha', with no charge line: the money leaves that day", async () => {
    renderForm(null);

    await pick(cardButton(), "Visa •••• 9999");

    expect(screen.getByText("Fecha")).toBeInTheDocument();
    expect(screen.queryByText(/Se cobra el/)).not.toBeInTheDocument();
  });

  it("sends the card and no account: the server takes the bank's", async () => {
    actions.createExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    await fillRequired();
    await pick(cardButton(), "Visa •••• 9999");
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = actions.createExpenseAction.mock.calls[0][0] as FormData;

    expect(sent.get("cardId")).toBe("card_9");
    expect(sent.get("accountId")).toBeNull();
  });

  it("shows the refusal for funds under Monto and the Bancos refusal under Tarjeta, and stays open", async () => {
    actions.createExpenseAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        amount: [
          "La cuenta de origen no tiene fondos suficientes: a esa fecha tenía $ 300,00.",
        ],
        cardId: [
          "El banco de esta tarjeta no tiene una cuenta activa en ARS. Creá una en Bancos.",
        ],
      },
    });
    const { onClose } = renderForm(null);

    await fillRequired();
    await pick(cardButton(), "Visa •••• 9999");
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    expect(
      await screen.findByText(
        "La cuenta de origen no tiene fondos suficientes: a esa fecha tenía $ 300,00.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "El banco de esta tarjeta no tiene una cuenta activa en ARS. Creá una en Bancos.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps an edited expense's own card and the account its money left, even when the bank has no account in that currency now", () => {
    renderForm(EXPENSE, [CREDIT, debitOption({ accounts: [] })]);

    expect(cardButton()).toHaveTextContent("Visa •••• 9999");
    expect(
      screen.getByText("Se descuenta de Banco Galicia · Caja vieja"),
    ).toBeVisible();
  });
});
```

Run: `npx vitest run components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.debit.test.tsx`
Expected: FAIL (the form still shows the "Cuenta" selector for a debit card and sends its account; there is no "Se descuenta de" line; the edited card is dropped).

(The labels used here are the current ones: `CREATE_SUBMIT_LABEL = "Agregar gasto"` in `ExpenseFormDrawer/consts.ts`; "Descripción", "Monto", "Moneda", "Fecha" in `components/Entries/formConsts.ts`; "Categoría", "Tarjeta" and "Cuenta" in the field components. A select's trigger is named "<value> <label>", hence the regexes ending in the label.)

- [ ] **Step 4: Write the debit line and wire the form**

In `components/Expenses/types.ts`, append:

```ts
export type DebitCardOption = Extract<CardOption, { kind: "DEBIT" }>;
```

`DebitAccountLine/types.ts`:

```ts
export interface DebitAccountLineProps {
  // "Banco · Cuenta" of the account the expense takes its money from.
  label: string;
  // What the server said about the account (an archived one on a new template).
  errorMessage?: string;
}
```

`DebitAccountLine/consts.ts`:

```ts
export const DEBIT_ACCOUNT_LABEL = "Cuenta";
export const DEBIT_ACCOUNT_HINT =
  "La define la tarjeta: la cuenta de su banco en la moneda del gasto.";

// "Se descuenta de Banco Galicia · Caja de ahorro".
export const debitAccountText = (label: string): string =>
  `Se descuenta de ${label}`;
```

`DebitAccountLine/styles.ts`:

```ts
export const ROOT_CLASS_NAME = "flex w-full flex-col gap-1";
export const LABEL_CLASS_NAME = "text-sm font-medium";
export const VALUE_CLASS_NAME = "text-sm";
export const HINT_CLASS_NAME = "text-sm text-muted";
export const ERROR_CLASS_NAME = "text-sm text-danger";
```

`DebitAccountLine/DebitAccountLine.tsx`:

```tsx
import {
  DEBIT_ACCOUNT_HINT,
  DEBIT_ACCOUNT_LABEL,
  debitAccountText,
} from "./consts";
import {
  ERROR_CLASS_NAME,
  HINT_CLASS_NAME,
  LABEL_CLASS_NAME,
  ROOT_CLASS_NAME,
  VALUE_CLASS_NAME,
} from "./styles";
import type { DebitAccountLineProps } from "./types";

// Where a debit card's expense takes its money from. The server decides it from the card's bank and the
// currency, so the form shows it and sends none.
export function DebitAccountLine({
  label,
  errorMessage,
}: DebitAccountLineProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <p className={LABEL_CLASS_NAME}>{DEBIT_ACCOUNT_LABEL}</p>
      <p className={VALUE_CLASS_NAME}>{debitAccountText(label)}</p>
      <p className={HINT_CLASS_NAME}>{DEBIT_ACCOUNT_HINT}</p>
      {errorMessage ? (
        <p role="alert" className={ERROR_CLASS_NAME}>
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
```

`DebitAccountLine/index.ts`: `export { DebitAccountLine } from "./DebitAccountLine";`

Append to `components/Expenses/components/ExpenseFormDrawer/utils.ts` (add `import { debitAccountIn } from "@/core/cards/kinds";` and import `DebitCardOption`, `ExpenseRow` from `../../types`):

```ts
// Whether the expense being edited already has this card in this currency: then it keeps the card
// (and, for a debit card, the account its money left) even if the card no longer pays in it.
export const keepsOwnCard = (
  expense: Pick<ExpenseRow, "cardId" | "currency"> | null,
  cardId: string,
  currency: string,
): boolean =>
  expense !== null &&
  expense.cardId === cardId &&
  expense.currency === currency;

// The account a debit card's expense takes its money from, as the server will resolve it: the one the
// edited expense already left when it keeps the card and the currency, otherwise the bank's account in
// the currency.
export const debitAccountLabel = (
  card: DebitCardOption,
  currency: string,
  expense: Pick<ExpenseRow, "cardId" | "currency" | "accountLabel"> | null,
): string =>
  expense !== null && keepsOwnCard(expense, card.id, currency)
    ? expense.accountLabel
    : (debitAccountIn(card, currency)?.label ?? "");
```

In `ExpenseFormContent.tsx`:

- import `DebitAccountLine` from `./components/DebitAccountLine` and `debitAccountLabel`, `keepsOwnCard` from `./utils`;
- replace the `card` lookup with:

```tsx
const card = isInstallment
  ? undefined
  : cards.find(
      (option) =>
        option.id === cardId &&
        (option.currencies.includes(currency) ||
          keepsOwnCard(expense, option.id, currency)),
    );
```

- in `handleCurrencyChange`, replace the card condition with `if (card && !card.currencies.includes(next) && !keepsOwnCard(expense, card.id, next)) {`;
- pass `keepCardId={expense && expense.currency === currency ? expense.cardId : null}` to `CardField`;
- replace `<AccountField … />` with:

```tsx
{
  /* A debit card decides the account on the server: the form shows it instead of asking. */
}
{
  card?.kind === "DEBIT" ? (
    <DebitAccountLine
      label={debitAccountLabel(card, currency, expense)}
      errorMessage={fieldErrors.accountId?.[0]}
    />
  ) : (
    <AccountField
      accounts={accounts}
      currency={currency}
      value={account}
      keepAccountId={keepAccountId}
      onChange={setAccountId}
      errorMessage={fieldErrors.accountId?.[0]}
    />
  );
}
```

Run: `npx vitest run components/Expenses/components/ExpenseFormDrawer components/Entries/components/CardField`
Expected: PASS.

- [ ] **Step 5: The checkbox says why it was refused (tests first)**

Append to `components/Entries/useOptimisticStatus.test.tsx` (inside its main `describe`):

```ts
it("keeps what the server said when it refused the change, and forgets it on the next toggle", async () => {
  const save = vi
    .fn()
    .mockResolvedValueOnce({ status: "error", message: "Sin fondos." })
    .mockResolvedValueOnce({ status: "success" });
  const { result } = renderHook(() => useOptimisticStatus(save));

  await act(async () => {
    result.current.toggle("a", true);
  });

  expect(result.current.refusal).toBe("Sin fondos.");

  await act(async () => {
    result.current.toggle("a", true);
  });

  expect(result.current.refusal).toBeNull();
});

it("has no refusal after a save that went through", async () => {
  const save = vi.fn().mockResolvedValue({ status: "success" });
  const { result } = renderHook(() => useOptimisticStatus(save));

  await act(async () => {
    result.current.toggle("a", true);
  });

  expect(save).toHaveBeenCalledWith("a", "SETTLED");
  expect(result.current.refusal).toBeNull();
});
```

Append to `describe("Expenses status toggle")` of `components/Expenses/Expenses.test.tsx`:

```ts
it("says why the server refused, above the table", async () => {
  actions.setExpenseStatusAction.mockResolvedValue({
    status: "error",
    message:
      "La cuenta de origen no tiene fondos suficientes: a esa fecha tenía $ 0,00.",
  });
  renderExpenses();

  await act(async () => {
    fireEvent.click(box());
  });

  expect(
    screen.getByText(
      "La cuenta de origen no tiene fondos suficientes: a esa fecha tenía $ 0,00.",
    ),
  ).toBeVisible();
});

it("shows no such message when the change went through", async () => {
  actions.setExpenseStatusAction.mockResolvedValue({ status: "success" });
  renderExpenses();

  await act(async () => {
    fireEvent.click(box());
  });

  expect(actions.setExpenseStatusAction).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByText(/no tiene fondos suficientes/),
  ).not.toBeInTheDocument();
});
```

Run: `npx vitest run components/Entries/useOptimisticStatus.test.tsx components/Expenses/Expenses.test.tsx`
Expected: FAIL (`refusal` does not exist; the page shows nothing).

In `components/Entries/useOptimisticStatus.ts`:

- change the React import to `import { useOptimistic, useState, useTransition } from "react";`;
- add after `NO_OVERRIDES`:

```ts
// What a save that refused the change says, if anything. The optimistic status goes back by itself;
// this keeps the reason, for the page to show.
const refusalOf = (result: unknown): string | null =>
  typeof result === "object" &&
  result !== null &&
  "status" in result &&
  result.status === "error" &&
  "message" in result &&
  typeof result.message === "string"
    ? result.message
    : null;
```

- inside the hook add `const [refusal, setRefusal] = useState<string | null>(null);`, make `toggle` call `setRefusal(null);` before `startTransition`, and inside the transition replace `await save(id, status);` with:

```ts
const result = await save(id, status);

setRefusal(refusalOf(result));
```

- return `{ toggle, apply, refusal }`.

In `components/Expenses/Expenses.tsx`:

- import `InlineAlert` from `@/components/shared/InlineAlert`;
- destructure `refusal: statusRefusal` from `useOptimisticStatus(setExpenseStatusAction)`;
- right before `<Await source={table} fallback={renderTable(null)}>`, add:

```tsx
{
  /* Why the last tick of a checkbox was refused: a debit card's account without the money. */
}
{
  statusRefusal ? (
    <InlineAlert variant="error">{statusRefusal}</InlineAlert>
  ) : null;
}
```

Run: `npx vitest run components/Entries components/Expenses components/Incomes`
Expected: PASS (Incomes uses the same hook and ignores `refusal`).

- [ ] **Step 6: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto components/Entries/components/CardField components/Entries/useOptimisticStatus.ts components/Entries/useOptimisticStatus.test.tsx components/Expenses/types.ts components/Expenses/Expenses.tsx components/Expenses/Expenses.test.tsx components/Expenses/components/ExpenseFormDrawer`.
Expected: all green.

- [ ] **Step 7: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 6: Whole-stage verification, browser pass and handoff

**Files:** none are created for the product. The controller (not an implementer) runs this task; if a check fails, the failing task's implementer fixes it.

**Interfaces:**

- Consumes: everything above; the migration applied and `next dev` restarted at the gate after Task 2.
- Produces: a verified stage and the numbers to report.

- [ ] **Step 1: Static and unit checks**

Run, in this order, and write the results down:

1. `npx vitest run` — all green; record files and tests, compare with the baseline of Task 1 (the difference is exactly the new test files and cases).
2. `npx tsc --noEmit` — clean.
3. `npm run lint` — clean.
4. `npx vitest run components/componentStructure.test.ts components/shared/PendingButton/pendingButtonUsage.test.ts lib/auth/routeProtection.test.ts prisma/schema.test.ts scripts/clearData` — green.
5. `npx prettier --check --end-of-line auto core/cards core/banks core/expenses core/balances core/installments/service.ts core/installments/service.test.ts core/entries/actionHelpers.ts core/entries/actionHelpers.test.ts components/Cards components/Entries components/Expenses components/Help/markerAudit.test.tsx app/dashboard/cards app/dashboard/expenses prisma/schema.test.ts scripts/clearData` — clean.
6. `rg -n "limitAmount|\.currency !== input\.currency" core components app --glob '!*.test.*'` — the only `limitAmount` left is the `CardCap` field and the form's `LIMIT_AMOUNT_FIELD`; no reader compares a card's currency.

- [ ] **Step 2: Confirm the migration state (read-only)**

Run `npx prisma migrate status`. Expected: up to date, `20261007180000_card_kinds_and_limits` applied. If it is not, STOP and ask the user to run `npx prisma migrate deploy`; do not apply it yourself. If the browser pass fails with `Unknown field limits`, `column Card.kind does not exist` or similar, the dev server still holds the old Prisma client or the migration is missing: ask the user to restart `next dev` (it caches the client on `globalThis`); do not restart it yourself.

- [ ] **Step 3: Ask once before the live writes**

The dev database holds the user's real data. Ask the user (one question): "I will verify the cards in the browser by creating two test cards (a credit card with ARS and USD caps, and a debit card on one of your banks), one $ 1,00 debit expense, and then deleting all of them, so every balance ends where it started. Can I?" Wait for the answer. Without a yes, verify only the read-only items (1, 9, 11 below).

- [ ] **Step 4: Browser verification (Playwright MCP; reuse the signed-in session — the user may need to sign in again, never sign in for them; do not close the browser; check port 3000 first and never restart the server)**

Record the Banks tile of the account the debit card will use before touching anything. Then check each item and note pass or fail:

1. `/dashboard/cards` shows the columns Acciones, Tarjeta, Tipo, Banco, Cierre, Vencimiento, Tope, Uso, Disponible (empty state if there are no cards).
2. "Agregar tarjeta": the form starts on "Crédito", asks Banco (preselected if only one active bank), the digits, the brand, the two days, the kind of cap and one cap in ARS; "Agregar un tope en otra moneda" adds USD and never offers ARS twice; the last cap cannot be removed. Save a credit card "Visa 0001" with $ 1.000,00 ARS and US$ 10,00 USD: the row shows "Crédito", the bank, two cap lines, two bars ("Uso de … en ARS/USD").
3. Switching the form to "Débito o prepago" hides the days, the kind of cap and the caps; the preview says "Débito o prepago". Save a debit card "Mastercard 0002" on a bank with an ARS account: the row shows "Débito o prepago", the bank, its currencies in Tope and dashes elsewhere.
4. Edit each card: the kind and the bank are shown read-only ("Crédito · …", "El tipo y el banco de una tarjeta no se pueden cambiar."); the credit card's caps are prefilled; saving works.
5. "Ingresar gasto": with ARS, the card selector lists both cards; switching the currency to EUR drops both; with the debit card chosen the "Cuenta" selector is replaced by "Se descuenta de {Banco · Cuenta}" and the date stays "Fecha".
6. A debit expense larger than that account's balance, marked "Pagado", is refused with the "no tiene fondos suficientes" message under "Monto", and nothing is saved; the same expense as "Pendiente" saves.
7. Ticking that pending expense as paid from the table is refused (the checkbox flips back and the alert above the table says why). Then lower it to $ 1,00 in the edit drawer and tick it as paid: it saves, and the Banks tile of the account moves by exactly $ 1,00.
8. "Compra en cuotas" lists only the credit card; its recommendation uses the ARS cap for an ARS purchase (cancel without saving).
9. The browser console shows no errors during the pass; at about 390px wide the Cards table scrolls sideways, the drawer is full width, and there is no horizontal page scroll.
10. Clean up: delete the $ 1,00 expense, then both cards; the Banks tile is back to the recorded value.
11. `/dashboard/banks`, `/dashboard/overview` and `/dashboard/transfers` still render (they read accounts and balances, which this stage touched through `excludeExpenseId`).

Clean the `.playwright-mcp` scratch files by hand when done; leave the browser open.

- [ ] **Step 5: Handoff to the user**

Report: the final numbers (files, tests), the state of the migration (applied by the user) and that `next dev` was restarted at the gate. Mention the decisions in "Decisions taken" that the browser pass exercised (D3, D5, D6, D9, D12) and the "Deferred" items below. Do NOT commit (the user commits only when asked); the controller snapshots.

---

## Deferred (not in this stage)

- Everything in the spec's "Out of scope": credit-card statements and payments of the statement, linking a credit card to the account that pays it, interest and fees, per-account card selection (a debit card always uses the bank's oldest active account of the currency, D3), virtual/extra cards, showing cards on the Bancos board, a hard block on the credit limit, converting between currencies, importing statements.
- A debit expense dated before the opening month is refused for funds (no balance is invented before the opening, D6); a later change could check such an expense only "now".
- Only debit expenses lock their account. Incomes, card-less and credit expenses, templates and plans still do not take the row lock (stage 3's deferred item), so one saved in the same instant as a debit expense can still land; the balance then shows it, in red if negative.
- The credit cap stays a warning only in the planner; the expense form does not warn when a one-payment credit purchase goes over the cap of its currency.
- The planner does not pass the server's card refusal to `CardField` (`errorMessage`), so `CardKindNotAllowedError` from a forged request shows only as the ticket's generic error (stage 2a ledger item, still open).
- Switching the card form between Crédito and Débito o prepago drops what was typed in the credit-only fields.
- Copy left as it was: the Cards page description still says "Tus tarjetas de crédito y cuánto querés destinarles.", and `CARD_CURRENCY_MISMATCH_MESSAGE` still says "La tarjeta tiene que estar en la misma moneda que la compra." although a credit card can now have caps in several currencies.
- Expense writes still revalidate only `/dashboard/expenses` (the Banks board and the summary read balances on every request, so a debit expense shows there on the next navigation).
- Bulk status changes do not exist; a bulk delete of expenses takes no funds check (the accounts only gain).
- A past-dated debit expense is checked at its date and now, not on the days in between (same as transfers); recurring templates generated from a debit expense carry no card, so ticking their months paid runs no funds check.
