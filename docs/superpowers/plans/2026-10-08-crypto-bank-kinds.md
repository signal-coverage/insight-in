# Crypto Currencies and Bank Kinds — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A crypto currency (USDC, USDT, DAI, BTC, ETH, XMR, SOL, BNB, LTC, TRX, 6 decimals each) becomes one more currency of the app: a wallet account can hold it, and incomes, expenses, transfers, opening balances and reimbursements in it follow the same rules (funds checks, balances, one summary section per currency). Every bank gets a kind: `ENTITY` ("Entidad bancaria", legal tender only) or `WALLET` ("Billetera virtual", legal tender and crypto). Credit card caps and installment plans stay legal tender only.

**Architecture:** One additive migration adds `enum BankKind { ENTITY WALLET }` and `Bank.kind @default(ENTITY)`. `core/incomes/money.ts` becomes the single module that knows both kinds of currency: it builds the Dinero currency objects of the crypto assets from the registry in `core/currencies`, recognises crypto in `currencyExponent`, `toMinorUnits`, `toDecimalString` and `formatMoney` (a plain es-AR number followed by the code, never `Intl` with a crypto code), and exposes two predicates, `isLegalTenderCode` and `isSupportedCurrencyCode`. The origin helpers of `core/currencies/origin.ts` delegate to it. The boundary splits in two Zod fields: `currencyField` (legal tender + crypto: accounts, opening balances, incomes, expenses, recurring templates, transfers, the list filter) and `legalTenderCurrencyField` (credit card caps, installment plans). The per-kind rule lives in the services under the bank row lock: `createAccount` reads the kind in the same `FOR UPDATE` that already serialises it, `updateAccount` now takes the bank lock before the account lock, and `updateBank` runs in a transaction that refuses `ENTITY` while the bank has any crypto account (archived ones included). Every per-currency list (summary, "Por cuenta", balance totals, entry totals, pending reimbursements, the currency filter) sorts with one comparator: legal tender by code first (as today), then crypto in registry order. The UI gets a "Tipo" radio group in the bank drawer, a "Billetera" chip on wallet banks, and one shared `CurrencyListBox` that renders the legal-tender list and, where crypto is allowed, a "Criptomonedas" group after it.

**Tech Stack:** Next.js 16.3.6 (App Router, server actions), React 19.2, TypeScript, Prisma 7.10 + Neon, zod 4, dinero.js, HeroUI v3 (`@heroui/react`), Tailwind 4, Vitest 4 + Testing Library (jsdom per file), Clerk.

**Spec:** docs/superpowers/specs/2026-10-08-crypto-currencies-bank-kinds-design.md (all sections; its two "Open items to settle in the plan" are settled in D5 and D6 below). Depends on the cards stage being done and applied (`20261007180000_card_kinds_and_limits` is the latest migration).

## Decisions taken

The spec is silent, ambiguous or self-contradictory on these; each one is the safest default. The user may veto any of them before or during the build.

- **D1 Order around the migration.** Task 1 only WRITES the schema and the SQL and does NOT run `prisma generate`. Tasks 2 and 3 are pure code (money, lists, ordering) and never read `Bank.kind`. Task 4 runs `prisma generate` and is the first and only task whose code reads `Bank.kind` (the bank lock SQL, the bank create/update data, the bank mapper). The controller GATE sits right after Task 4: the user applies the migration and restarts `next dev` before Task 5 is dispatched. The migration is additive (a new type and a NOT NULL column with a default), so the old client keeps working against the migrated database; only the window between Task 4's `prisma generate` and the restart can make bank writes fail in the running app.
- **D2 The kind is required on every bank form submission**, create and edit (`bankInputSchema.kind` is a required enum). The drawer always sends it (a new bank defaults to "Entidad bancaria"). A request without it is refused under "Tipo" ("Elegí el tipo de banco.") instead of silently turning a wallet into an entity.
- **D3 The kind-change refusal message.** The spec's text ("archivalas o eliminalas antes de pasarlo a entidad bancaria") contradicts its own rule (Decision 4: archived crypto accounts still count, so archiving does not unblock the change). The rule wins and the message says what works: "Este banco tiene cuentas cripto (archivadas incluidas). Eliminalas antes de pasarlo a entidad bancaria." (under "Tipo"). A crypto account with movements cannot be deleted, so such a wallet stays a wallet: that is the spec's rule, now stated honestly. Veto option: count only active crypto accounts and keep the spec's text.
- **D4 Locks.** `updateBank` runs in one transaction under `lockBank` (FOR UPDATE); the crypto-account count is read under it. `createAccount` reads the kind from the `lockBank` it already takes. `updateAccount` now takes `lockBankOfAccount` FIRST and `lockAccount` second (bank → account, the same order as `unarchiveAccount`; nothing locks an account and then its bank), so a kind change and a currency change to crypto never interleave. The "entity has no crypto" count runs whenever the requested kind is `ENTITY` (also entity → entity: an entity never holds crypto, so it costs one count and guards any legacy row).
- **D5 (spec open item 1) Where each list goes.** Legal tender + crypto (`currencyField`, `isSupportedCurrencyCode`, the "Criptomonedas" group): account currency (only a wallet passes the service), opening balances (no selector: the rows carry the account's currency), incomes, expenses, recurring income and recurring expense templates, transfers, the expected reimbursement, the origin ("quoted in"), and the entries list currency filter (`?currency=USDC`). Legal tender only (`legalTenderCurrencyField`, `isLegalTenderCode`, `CURRENCY_OPTIONS`): credit card caps (`LimitsField`), installment purchases and repayments (`installmentPlanSchema`, `incomeInstallmentPlanSchema`, `AmountCurrencyFields` used only by the two planners). Debit/prepaid cards need nothing: their currencies are their bank's active accounts. A credit-card expense in crypto is refused by the existing `limitIn` check (no crypto cap can exist). Recurring templates get crypto because a monthly salary in USDC to a wallet is the user's own case; veto option: keep templates legal tender only.
- **D6 (spec open item 2) The chip.** A "Billetera" chip (`Chip size="sm" variant="soft"`, theme default colour, never blue) goes in the bank card of the sticky column (`BankCell`), in one wrapping row with the existing "Archivado" chip, under the name. The account tiles are untouched (their sizing fix stays as it is). The card's accessible name gains ", billetera virtual" (before ", archivado").
- **D7 Crypto format.** The spec's rule ("at least 2 and at most 6 decimals") and its example ("1.250,5 USDC") disagree; the rule wins and matches today's origin formatter: "1.250,50 USDC", "0,000001 BTC", "-1,50 USDC" for a negative balance, "0,00 USDC" for zero. `toDecimalString` (the plain decimal that prefills inputs) gives a crypto amount at least 2 and at most 6 decimals ("1250.50", "0.000001").
- **D8 Ordering.** One comparator, `compareCurrencyCodes`: legal tender alphabetically by code (exactly today's `localeCompare` order), then crypto in registry order (USDC, USDT, DAI, BTC, ETH, XMR, SOL, BNB, LTC, TRX). Applied to the summary sections, the "Por cuenta" card, `totalsByCurrency`, `foldCurrencyTotals` (entry totals), `pendingByCurrency` and the entries currency filter options. Left alone: the transfers filter (accounts order), the conversions page (pairs by code), card caps (legal tender only).
- **D9 Rates whose net currency is crypto.** `formatRateMoney` cannot use `Intl` for a crypto net currency, so it writes the rate then the code ("0,0008 USDC"); the form line reads "1 ARS = 0,0008 USDC".
- **D10 The account drawer.** The "Criptomonedas" group is offered when the chosen bank is a wallet, or when the account being edited already holds a crypto currency (so its value always shows). Changing the bank of a new account from a wallet to an entity while a crypto currency is chosen puts the currency back to ARS. An account under an archived bank (not in the drawer's bank list) is treated as an entity unless it already holds crypto. The server rule (D4) decides anyway.
- **D11 The origin of a crypto entry.** The origin's crypto group leaves the net currency out, like the legal-tender group already does (a USDC income cannot come "from USDC"); this matches `isOriginCurrencyCode`.
- **D12 The user's banks.** The migration makes every existing bank an entity ("Efectivo" included). Nothing in the build or the browser pass switches the user's real banks: the user turns Mercado Pago, AstroPay and Fiwind into wallets by editing them. The browser pass uses a throwaway wallet and deletes it.

## Global Constraints

- Copy language: all UI copy (labels, buttons, errors, empty states, hints) in Spanish es-AR, neutral/professional, voseo as in Cards/Roadmap/Banks ("Eliminalas", "Usá una billetera virtual"). Code, identifiers, comments and tests in English. Route slugs stay English (`/dashboard/banks`).
- Component layout is enforced by `components/componentStructure.test.ts` (scans `components/` and `app/`, `.tsx` files that are not tests): no `type`/`interface`/`enum` declarations in a component file, no `const`/helper function at column 0 (only the component itself), exactly one component per file, no props typed inline (`}: {`), no inline `className="..."` of 40+ characters (move it to `styles.ts`), a sub-component is never a bare file under a nested `components/` folder (it gets its own folder `Name/Name.tsx` plus `index.ts`). Types go in `types.ts`, constants in `consts.ts`, styles in `styles.ts`, helpers in `utils.ts`, hooks in `useX.ts`.
- Strict TDD with Vitest: every behaviour gets a failing test first; run it and see it fail for the stated reason before writing the implementation (RED), then see it pass (GREEN). A test that pins behaviour another task already delivered (a characterization) is marked as such and expected to pass at once. Component tests start with `// @vitest-environment jsdom`. Unit tests never need the database: services are tested against the Prisma mock (`vi.mock("@/infrastructure/db/client", …)`), exactly like `core/accounts/service.test.ts`.
- Tests that cannot fail are defects: every negative assertion (`not.toHaveBeenCalled`, `toBeNull`, `queryBy… not in the document`, `not.toContain`) has a positive twin in the same `describe` that proves the thing does happen in the other case; never a loop that asserts nothing when its list is empty (assert the length first); BigInt literals (`5000n`) do not compile (target ES2017): always `BigInt(5000)`; never index a typed mock tuple beyond its length; a HeroUI `Select` trigger's accessible name is "<value or placeholder> <label>", so query it with a regex that ends in the label (`/Banco$/`, `/Moneda$/`); an option query must not match a crypto label by accident (`/^USD - /`, never `/USD/` or `/^USD/`, which also match "USDC - USD Coin" and "USDT - Tether"). Never delete a test of unchanged behaviour when editing a test file.
- Money convention: minor units, `BigInt` in the database, `number` in the app (`minorUnitsToNumber` at the boundary); money is formatted on the server with `formatMoney(minorUnits, currency)` (es-AR), the client only places text. Amounts in different currencies are never added. A crypto amount has 6 decimals (`CRYPTO_EXPONENT`), so its minor units are millionths; the safe-integer cap (`MAX_MINOR_UNITS`) allows about 9,007 million units. `Intl.NumberFormat` is never given a crypto code as `currency` (it rejects "USDC" and silently formats "BTC" as if it were ISO).
- Balance rule (binding, from stage 2/3): `balance(account, date) = opening (if the opening month has started) + settled incomes − settled expenses − transfers out + transfers in`. `PLANNED` and `COVERED` entries never move money. A crypto account adds no new kind of flow.
- Bank kinds (binding, from the spec): `ENTITY` accounts take legal tender only; `WALLET` accounts take legal tender and the crypto registry. Checked in the service when an account is created and when its currency changes (already only possible without movements). `ENTITY` → `WALLET` always allowed; `WALLET` → `ENTITY` refused while the bank has any crypto account, archived ones included. A new bank starts as `ENTITY`.
- Errors (binding, from the spec): "Las entidades bancarias solo admiten monedas de curso legal. Usá una billetera virtual." under "Moneda" for a crypto account in an entity; the kind refusal under "Tipo" (D3); a crypto currency where only legal tender is allowed (a credit card cap, an installment plan) is the existing "Selecciona una moneda compatible." on its field. Services stay scoped by `userId`.
- Out of scope (binding, from the spec): prices or exchange rates for crypto, on-chain addresses or live balances, fiat value of crypto holdings, converting between currencies, network fees, more than 6 decimals, crypto credit limits, crypto installments.
- Every record is scoped by the Clerk `userId` that comes from the session (`runAuthenticated`), never from client input; another user's bank or account id behaves as not found and nothing is written. Server actions export only async functions and refuse a missing or non-text id BEFORE calling the service (`isUsableId`; an `undefined` id makes Prisma drop it from a `where`).
- Colors: never blue buttons; only theme tokens (`text-muted`, `text-danger`, `bg-surface-secondary`, `ring-border`, …). Async buttons use `PendingButton` (guard `components/shared/PendingButton/pendingButtonUsage.test.ts`). This stage adds no async button.
- Next.js (this repo runs 16.3.6, see AGENTS.md: it differs from what you remember): pages are async Server Components that call `requireUserId()` (guard `lib/auth/routeProtection.test.ts`); `"use server"` files export only async functions; `revalidatePath` only after a successful write. Before touching an action file, read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`.
- HeroUI v3 differs from what you remember (AGENTS.md: "STOP. What you remember about HeroUI React v3 is WRONG for this project"). Every UI task starts by reading the HeroUI docs it uses under `C:\Users\Nico\Desktop\insight-in\.heroui-docs\react\components\` (named in each task) and then copies the markup of the components that already work in this repo (named in each task). If `.heroui-docs` is missing, run `heroui agents-md --react --output AGENTS.md` first.
- Row locks: `lockBank` / `lockBankOfAccount` (`SELECT … FOR UPDATE`, `core/banks/locks.ts`) and `lockAccount` (`FOR NO KEY UPDATE`, `core/accounts/locks.ts`), inside `prisma.$transaction(async (tx) => …)`; ids and userId travel as parameters; inside one interactive transaction the queries run one after another (no `Promise.all` on `tx`); a bank is always locked before any of its accounts.
- Database: the dev database holds the user's REAL data. The only migration is additive. Migrations are written by hand into `prisma/migrations/<timestamp>_<name>/migration.sql`. The implementer runs `npx prisma validate`, `npx prisma format` and (Task 4 only) `npx prisma generate`, and nothing else against Prisma: NEVER `prisma migrate dev|deploy|reset|resolve`, `prisma db push`, `prisma db execute` or any command that opens a database connection, and NEVER `npm install`/`npm update` of any Prisma package (the CLI stays 7.10). Applying the migration is the USER's action (`npx prisma migrate deploy`), requested by the controller at the gate after Task 4. No test may need the database.
- Do not start, stop or restart `next dev`, and do not close the Playwright browser. No git commit/add/stash steps anywhere: the user commits only when asked; the snapshot is taken by the controller.
- Use Read/Glob/Grep or `rg` to look at files (never `cat`/`grep`/`find`/`ls` in a shell).
- Every task ends with a verify step that runs, in this order: that task's tests, `npx vitest run` (the whole suite), `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, and `npx prettier --check --end-of-line auto <the files the task created or changed>` (never `npm run format`: it rewrites the whole repo; some files are CRLF, hence `--end-of-line auto`). If the check fails, format exactly those files with `npx prettier --write --end-of-line auto <files>` and re-run the check. A task boundary is only reached with all of them green.

## Review Focus

The inputs and conditions the spec implies but no obvious test exercises, the ones most likely to bite a person using this, most likely first. Each one is pinned by a test in the task named at the end of the line.

1. **A crypto amount that slips past validation.** Once `currencyField` accepts "USDC", every helper that used to return early on "not an ISO currency" (`checkAmount`, `checkOrigin`, `checkExpectedReimbursement`) would skip the amount and `toAmount` would store `null`. A USDC amount with 7 decimals, a USDC reimbursement with 7 decimals and an ARS origin with 3 decimals on a USDC income must each be refused on their own field, and "1.5" USDC must become 1500000. Pinned in Task 5 (`core/entries/currencyFields.test.ts`, `core/expenses/schema.reimbursement.test.ts`, `core/incomes/schema.origin.test.ts`, the transfers/balances/accounts schema tests and the transfers action test).
2. **Crypto formatted as if it were ISO, or not formatted at all.** A three-letter crypto code ("BTC", "BNB", "DAI") handed to `Intl` as a currency does not throw: it prints "BTC 1,50". Every crypto code must print "1,50 CODE", a negative balance "-1,50 USDC", and a rate on a crypto net currency "0,0008 USDC"; the board tile, the origin line and the insufficient-funds messages must show the same. Pinned in Task 2 (`money.test.ts` "every crypto code, three letters or four", negative and zero; `origin.test.ts` `formatRateMoney`; `boardAccounts.test.ts`; `components/Entries/utils.test.ts`) and Task 5 (transfers and expenses action messages in USDC).
3. **An entity bank that ends up holding crypto.** Creating a USDC account in an entity, changing an entity account's currency to USDC, and turning a wallet that has a crypto account (even an archived one) into an entity are each refused and write nothing, while a wallet takes USDC and an entity → wallet change always passes. The kind is read under the bank lock, and `updateAccount` takes the bank lock before the account lock. Pinned in Task 4 (`createAccount` / `updateAccount` / `updateBank` service tests with the lock-order assertions, `bankAcceptsCurrency`, the action mappings under "Moneda" and "Tipo").
4. **Crypto where only legal tender belongs.** A USDC credit card cap, a USDC installment purchase and a USDC repayment plan are refused with "Selecciona una moneda compatible." on the currency only; a credit card never covers a USDC expense (`limitIn`); the planner's and the caps' currency lists never offer a crypto asset while they do offer USD. Pinned in Task 5 (`core/cards/schema.test.ts`, `core/installments/schema.test.ts`, `core/cards/kinds.test.ts`) and Task 7 (`AmountCurrencyFields.test.tsx`, `LimitsField/utils.test.ts`).
5. **The account drawer offering the wrong list.** An entity bank's account drawer lists no crypto (but lists USD), a wallet's lists the "Criptomonedas" group, choosing USDC and then switching the bank to an entity puts the currency back to ARS (while a legal-tender choice survives the switch), and editing an existing USDC account shows "USDC - USD Coin". Pinned in Task 6 (`AccountFormDrawer.test.tsx`, `AccountFormDrawer/utils.test.ts`).

## Execution notes for the controller

- Work in place on branch `develop`, no worktree (node_modules, `.env.local`, the generated Prisma client and the user's running `next dev` live in this directory), no commits.
- Task 1 records the baseline numbers (test files and tests); Task 8 compares against them.
- Tasks 1, 2 and 3 are runtime-safe: Task 1 adds no generated code, Tasks 2 and 3 are pure code that the running app picks up harmlessly (formatting and ordering, plus 7 more crypto assets offered as the "quoted in" origin, which already accepted crypto).
- Task 4 runs `npx prisma generate` and switches every reader and writer of `Bank` to the kind. **GATE right after Task 4**, before dispatching Task 5:
  1. Ask the user (one message, one question): "Apply the migration `20261008120000_bank_kinds` with `npx prisma migrate deploy` (it creates the `BankKind` type and adds `Bank.kind`, NOT NULL with default `ENTITY`: every existing bank, Efectivo included, becomes an entity; nothing is removed or rewritten) and restart `next dev` (it caches the Prisma client on `globalThis`)." Do not apply it yourself.
  2. After the answer, `npx prisma migrate status` (read-only) may be used to confirm it. Nothing about the data needs re-checking: the migration is additive.
  3. Between Task 4's `prisma generate` and the restart, creating or editing a bank or an account in the running app may fail; nothing else is run in between. Tell the user if they ask.
- Unit tests of every task mock the database; browser verification happens only in Task 8, after the gate, and its live writes need the user's yes (Task 8, Step 3).

---

### Task 1: The bank kind in the schema and its additive migration (no client generation)

**Files:**

- Modify: `prisma/schema.prisma` (new `enum BankKind`, field `kind` on `model Bank`)
- Create: `prisma/migrations/20261008120000_bank_kinds/migration.sql`
- Modify: `prisma/schema.test.ts`

**Interfaces:**

- Consumes: the existing `model Bank` of `prisma/schema.prisma`; `SCHEMA`, `modelBlock`, `enumBlock`, `withoutComments`, `readFileSync`, `join` of `prisma/schema.test.ts`.
- Produces: `enum BankKind { ENTITY WALLET }`; `Bank.kind BankKind @default(ENTITY)`; the migration folder `20261008120000_bank_kinds`. The generated client is NOT regenerated here (D1): Task 4 does it.

- [ ] **Step 1: Record the baseline**

Run: `npx vitest run` then `npx tsc --noEmit` then `npm run lint`.
Expected: all green. Write down the numbers of test files and tests (Task 8 compares against them).

- [ ] **Step 2: Write the failing schema and migration tests**

Append to `prisma/schema.test.ts` (it already has `SCHEMA`, `modelBlock`, `enumBlock`, `withoutComments`, `readFileSync` and `join`):

```ts
describe("enum BankKind", () => {
  it("has exactly the two kinds: a bank entity and a virtual wallet", () => {
    expect(
      withoutComments(enumBlock("BankKind")).split(/\s+/).filter(Boolean),
    ).toEqual(["ENTITY", "WALLET"]);
  });
});

describe("model Bank and its kind", () => {
  it("has a kind, and a bank starts as an entity", () => {
    expect(withoutComments(modelBlock("Bank"))).toMatch(
      /kind\s+BankKind\s+@default\(ENTITY\)/,
    );
  });
});

describe("the bank kinds migration", () => {
  const MIGRATION = readFileSync(
    join(__dirname, "migrations", "20261008120000_bank_kinds", "migration.sql"),
    "utf8",
  );

  it("only adds: nothing that exists is dropped, renamed, truncated, updated or deleted", () => {
    expect(MIGRATION).not.toMatch(/\b(DROP|TRUNCATE|RENAME)\b/i);
    expect(MIGRATION).not.toMatch(/^\s*(UPDATE|DELETE|INSERT)\b/im);
  });

  it("alters the bank and nothing else", () => {
    const altered = [...MIGRATION.matchAll(/ALTER TABLE "(\w+)"/g)].map(
      (match) => match[1],
    );

    expect(altered).toEqual(["Bank"]);
  });

  it("creates the kind type and fills every existing bank as an entity through the column default", () => {
    expect(MIGRATION).toContain(
      `CREATE TYPE "BankKind" AS ENUM ('ENTITY', 'WALLET');`,
    );
    expect(MIGRATION).toContain(
      `ADD COLUMN     "kind" "BankKind" NOT NULL DEFAULT 'ENTITY'`,
    );
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run prisma/schema.test.ts`
Expected: FAIL (`enum BankKind is not in schema.prisma`, the `kind` field is missing, and the migration file does not exist: `ENOENT`).

- [ ] **Step 4: Write the schema**

In `prisma/schema.prisma`, right above the comment of `model Bank` (keep the file's alignment), add:

```prisma
// ENTITY: a bank (or the cash), which holds legal tender only. WALLET: a virtual wallet (Mercado Pago,
// AstroPay...), which may also hold the crypto assets the app knows. The services enforce both.
enum BankKind {
  ENTITY
  WALLET
}
```

and in `model Bank`, right after `name       String`, add:

```prisma
  // Decides which currencies its accounts can hold. Every bank starts as an entity.
  kind       BankKind  @default(ENTITY)
```

- [ ] **Step 5: Write the migration**

Create `prisma/migrations/20261008120000_bank_kinds/migration.sql`:

```sql
-- The kind of each bank: an entity (legal tender only) or a virtual wallet (crypto too). Additive only:
-- the column default fills every existing bank as an entity, the cash bank included.

-- CreateEnum
CREATE TYPE "BankKind" AS ENUM ('ENTITY', 'WALLET');

-- AlterTable
ALTER TABLE "Bank" ADD COLUMN     "kind" "BankKind" NOT NULL DEFAULT 'ENTITY';
```

- [ ] **Step 6: Validate the schema (no client generation, no database)**

Run: `npx prisma validate`.
Expected: "The schema … is valid". If it fails only because `DATABASE_URL` is missing, run `npx prisma format` instead (it only rewrites whitespace in `schema.prisma`) and check that it succeeds. If `npx prisma format` realigns `model Bank`, keep its output (the test regex tolerates any spacing). Do NOT run `npx prisma generate` in this task (D1).

- [ ] **Step 7: Run the task's tests to see them pass**

Run: `npx vitest run prisma/schema.test.ts`
Expected: PASS.

- [ ] **Step 8: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto prisma/schema.test.ts`.
Expected: all green (tsc and the app are unchanged: the generated client is still the old one).

- [ ] **Step 9: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 2: One money module for both kinds of currency (registry, lists, format, origin)

Behaviour-neutral for validation: every consumer that used `SUPPORTED_CURRENCY_CODES` keeps accepting exactly what it accepted (legal tender) through `isLegalTenderCode`; Task 5 decides which of them open to crypto. What changes now: the registry has 10 assets, and every money helper understands them.

**Files:**

- Modify: `core/currencies/consts.ts`, `core/currencies/crypto.test.ts`
- Modify: `core/incomes/consts.ts`
- Rewrite: `core/incomes/money.ts`; modify `core/incomes/money.test.ts`
- Rewrite: `core/currencies/origin.ts`; modify `core/currencies/origin.test.ts`
- Modify (rename only, same behaviour): `core/entries/fields.ts`, `core/entries/query.ts`, `core/entries/originFields.ts`, `core/reimbursements/fields.ts`, `core/installments/schema.ts`, `components/Entries/currencyOptions.ts`
- Modify: `components/Entries/components/OriginSection/utils.ts`, `components/Entries/components/OriginSection/utils.test.ts`
- Modify (tests pinned to the 3-asset registry): `components/Incomes/components/IncomeFormDrawer/IncomeFormDrawer.test.tsx`, `components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.origin.test.tsx`
- Modify (consumer formatting tests): `core/banks/boardAccounts.test.ts`, `components/Entries/utils.test.ts`

**Interfaces:**

- Consumes: `CryptoCurrency` (`core/currencies/types.ts`), `isCryptoCode`, `cryptoCurrency`, `cryptoExponent` (`core/currencies/crypto.ts`), `CRYPTO_MIN_FRACTION_DIGITS`, `RATE_FRACTION_DIGITS`, `SMALL_RATE_FRACTION_DIGITS` (`core/currencies/consts.ts`), `DISPLAY_LOCALE`, `MAX_MINOR_UNITS`, `PRIORITY_CURRENCY_CODES` (`core/incomes/consts.ts`), `CURRENCY_NAME_LOCALE` (`components/Entries/formConsts.ts`).
- Produces:
  - `core/currencies/consts.ts`: `CRYPTO_CURRENCIES` (10 assets, in this order: USDC, USDT, DAI, BTC, ETH, XMR, SOL, BNB, LTC, TRX), `CRYPTO_CURRENCY_CODES: readonly string[]`.
  - `core/incomes/consts.ts`: `LEGAL_TENDER_CURRENCIES: readonly DineroCurrency<number>[]` and `LEGAL_TENDER_CURRENCY_CODES: readonly string[]` (the former `SUPPORTED_CURRENCIES` / `SUPPORTED_CURRENCY_CODES`, which are removed), `ALL_CURRENCY_CODES: readonly string[]` (legal tender then crypto).
  - `core/incomes/money.ts`: `isLegalTenderCode(code: string): boolean`, `isSupportedCurrencyCode(code: string): boolean`, `currencyExponent(code: string): number | null` (6 for crypto), `minorUnitsToNumber` (unchanged), `toMinorUnits(input: string, currencyCode: string): number | null` (crypto too), `toTrimmedDecimal(minorUnits: number | bigint, exponent: number, minimum: number): string`, `toDecimalString(minorUnits: number | bigint, currencyCode: string): string`, `formatDecimal(decimal: string, minimumFractionDigits: number, maximumFractionDigits: number, locale?: string): string`, `formatMoney(minorUnits: number | bigint, currencyCode: string, locale?: string): string`.
  - `core/currencies/origin.ts`: same exports and signatures as today (`originExponent`, `isOriginCurrencyCode`, `toOriginMinorUnits`, `toOriginDecimalString`, `formatOrigin`, `formatOriginLabel`, `impliedRate`, `formatRate`, `formatRateMoney`), now delegating to money.ts; `formatRateMoney` handles a crypto net currency (D9).
  - `components/Entries/currencyOptions.ts`: `CURRENCY_OPTIONS` (legal tender, unchanged), new `CRYPTO_CURRENCY_OPTIONS: readonly CurrencyOption[]` (registry order, label `"CODE - Name"`).
  - `originCurrencyGroups(netCurrency)` leaves the net currency out of the crypto group too (D11).

- [ ] **Step 1: Write the failing registry tests**

Replace the whole of `core/currencies/crypto.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import {
  CRYPTO_CURRENCIES,
  CRYPTO_CURRENCY_CODES,
  CRYPTO_EXPONENT,
} from "./consts";
import { cryptoCurrency, cryptoExponent, isCryptoCode } from "./crypto";

const CODES = [
  "USDC",
  "USDT",
  "DAI",
  "BTC",
  "ETH",
  "XMR",
  "SOL",
  "BNB",
  "LTC",
  "TRX",
];

describe("CRYPTO_CURRENCIES", () => {
  it("lists the ten assets in the order the pickers show them, each with its English name", () => {
    expect(CRYPTO_CURRENCIES.map(({ code }) => code)).toEqual(CODES);
    expect(CRYPTO_CURRENCIES.map(({ name }) => name)).toEqual([
      "USD Coin",
      "Tether",
      "Dai",
      "Bitcoin",
      "Ethereum",
      "Monero",
      "Solana",
      "BNB",
      "Litecoin",
      "TRON",
    ]);
  });

  it("caps every asset at 6 decimals, which is what a safe integer can hold", () => {
    expect(CRYPTO_EXPONENT).toBe(6);
    expect(CRYPTO_CURRENCIES).toHaveLength(10);
    CRYPTO_CURRENCIES.forEach(({ exponent }) => expect(exponent).toBe(6));
  });

  it("exposes the codes in the same order", () => {
    expect(CRYPTO_CURRENCY_CODES).toEqual(CODES);
  });
});

describe("isCryptoCode", () => {
  it.each(CODES)("recognises %s", (code) => {
    expect(isCryptoCode(code)).toBe(true);
  });

  it.each(["USD", "ARS", "usdc", "XRP", ""])("rejects %j", (code) => {
    expect(isCryptoCode(code)).toBe(false);
  });
});

describe("cryptoExponent", () => {
  it("is 6 for every registered asset", () => {
    expect(cryptoExponent("USDC")).toBe(6);
    expect(cryptoExponent("BTC")).toBe(6);
  });

  it("refuses a code that is not in the registry", () => {
    expect(() => cryptoExponent("USD")).toThrow(RangeError);
  });
});

describe("cryptoCurrency", () => {
  it("returns the descriptor of a registered asset", () => {
    expect(cryptoCurrency("XMR")).toEqual({
      code: "XMR",
      name: "Monero",
      exponent: 6,
    });
  });

  it("returns null for anything else", () => {
    expect(cryptoCurrency("EUR")).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing money tests**

In `core/incomes/money.test.ts`:

Replace the import block and the `describe("SUPPORTED_CURRENCY_CODES", …)` block with:

```ts
import { describe, expect, it } from "vitest";

import { CRYPTO_CURRENCY_CODES } from "@/core/currencies/consts";

import { ALL_CURRENCY_CODES, LEGAL_TENDER_CURRENCY_CODES } from "./consts";
import {
  currencyExponent,
  formatMoney,
  isLegalTenderCode,
  isSupportedCurrencyCode,
  minorUnitsToNumber,
  toDecimalString,
  toMinorUnits,
} from "./money";

describe("LEGAL_TENDER_CURRENCY_CODES", () => {
  it("includes the currencies the app targets first", () => {
    expect(LEGAL_TENDER_CURRENCY_CODES).toEqual(
      expect.arrayContaining(["ARS", "USD", "EUR"]),
    );
  });

  it("does not include unknown codes nor any crypto asset", () => {
    expect(LEGAL_TENDER_CURRENCY_CODES).not.toContain("ZZZ");
    expect(LEGAL_TENDER_CURRENCY_CODES).not.toContain("USDC");
    expect(LEGAL_TENDER_CURRENCY_CODES).not.toContain("BTC");
  });
});

describe("ALL_CURRENCY_CODES", () => {
  it("is the legal tender and then the crypto assets, each once", () => {
    expect(ALL_CURRENCY_CODES).toEqual([
      ...LEGAL_TENDER_CURRENCY_CODES,
      ...CRYPTO_CURRENCY_CODES,
    ]);
    expect(new Set(ALL_CURRENCY_CODES).size).toBe(ALL_CURRENCY_CODES.length);
  });
});

describe("isLegalTenderCode and isSupportedCurrencyCode", () => {
  it("tell a legal tender currency, a crypto asset and an unknown code apart", () => {
    expect(isLegalTenderCode("ARS")).toBe(true);
    expect(isSupportedCurrencyCode("ARS")).toBe(true);
    expect(isLegalTenderCode("USDC")).toBe(false);
    expect(isSupportedCurrencyCode("USDC")).toBe(true);
    expect(isLegalTenderCode("ZZZ")).toBe(false);
    expect(isSupportedCurrencyCode("ZZZ")).toBe(false);
  });
});
```

In `describe("currencyExponent", …)`, replace the test `"is null for an unsupported currency"` with:

```ts
it("is 6 for every crypto asset of the registry", () => {
  expect(currencyExponent("USDC")).toBe(6);
  expect(currencyExponent("BTC")).toBe(6);
});

it("is null for an unsupported currency", () => {
  expect(currencyExponent("ZZZ")).toBeNull();
  expect(currencyExponent("usdc")).toBeNull();
});
```

Append at the end of the file:

```ts
describe("toMinorUnits with a crypto asset", () => {
  it("parses up to 6 decimals into millionths", () => {
    expect(toMinorUnits("1250.5", "USDC")).toBe(1250500000);
    expect(toMinorUnits("0.000001", "BTC")).toBe(1);
    expect(toMinorUnits("42", "ETH")).toBe(42000000);
  });

  it("refuses a seventh decimal", () => {
    expect(toMinorUnits("1.1234567", "USDC")).toBeNull();
  });

  it("refuses an amount beyond the safe integer range", () => {
    expect(toMinorUnits("9007199255", "USDT")).toBeNull();
    expect(toMinorUnits("9007199254", "USDT")).toBe(9007199254000000);
  });
});

describe("toDecimalString with a crypto asset", () => {
  it("keeps at least 2 decimals and at most 6, without trailing zeros", () => {
    expect(toDecimalString(1250500000, "USDC")).toBe("1250.50");
    expect(toDecimalString(1000000, "USDC")).toBe("1.00");
    expect(toDecimalString(1, "BTC")).toBe("0.000001");
    expect(toDecimalString(BigInt(1234567890), "DAI")).toBe("1234.56789");
  });

  it("keeps the sign of a negative amount", () => {
    expect(toDecimalString(-1500000, "USDC")).toBe("-1.50");
  });

  it("round-trips with toMinorUnits", () => {
    const minor = toMinorUnits("12.345678", "SOL") as number;

    expect(toDecimalString(minor, "SOL")).toBe("12.345678");
  });
});

describe("formatMoney with a crypto asset", () => {
  it("writes the amount with Argentine grouping and the code at the end", () => {
    expect(formatMoney(1250500000, "USDC")).toBe("1.250,50 USDC");
    expect(formatMoney(1234567, "ETH")).toBe("1,234567 ETH");
    expect(formatMoney(1, "BTC")).toBe("0,000001 BTC");
  });

  // Intl accepts any three letters as a currency and would print "BTC 1,50": a crypto code is never
  // handed to it as one, whether it has three letters or four.
  it.each([
    "USDC",
    "USDT",
    "DAI",
    "BTC",
    "ETH",
    "XMR",
    "SOL",
    "BNB",
    "LTC",
    "TRX",
  ])("never formats %s as an ISO currency", (code) => {
    expect(formatMoney(1500000, code)).toBe(`1,50 ${code}`);
  });

  it("keeps formatting legal tender as a currency", () => {
    expect(formatMoney(150, "USD")).toMatch(/^US\$\s1,50$/);
  });

  it("shows zero and a negative balance", () => {
    expect(formatMoney(0, "USDC")).toBe("0,00 USDC");
    expect(formatMoney(-1500000, "USDC")).toBe("-1,50 USDC");
  });

  it("accepts a bigint and honours a custom locale", () => {
    expect(formatMoney(BigInt(1250500000), "USDC")).toBe("1.250,50 USDC");
    expect(formatMoney(1250500000, "USDC", "en-US")).toBe("1,250.50 USDC");
  });
});
```

- [ ] **Step 3: Write the failing origin tests**

In `core/currencies/origin.test.ts` (BTC is a registered asset now, so the "unknown code" cases use codes that are not):

- In `describe("originExponent", …)`, replace the test `"is null for an unknown code"` with:

```ts
it("is 6 for every registered asset", () => {
  expect(originExponent("BTC")).toBe(6);
});

it("is null for an unknown code", () => {
  expect(originExponent("ZZZ")).toBeNull();
});
```

- In `describe("isOriginCurrencyCode", …)`, change `it.each(["BTC", "", "usdc", "ZZZ"])` to `it.each(["XRP", "", "usdc", "ZZZ"])`, and add:

```ts
it("accepts any registered asset, and an ISO origin for a crypto net amount", () => {
  expect(isOriginCurrencyCode("BTC", "ARS")).toBe(true);
  expect(isOriginCurrencyCode("ARS", "USDC")).toBe(true);
});

it("rejects a crypto origin equal to a crypto net currency", () => {
  expect(isOriginCurrencyCode("USDC", "USDC")).toBe(false);
});
```

- In `describe("toOriginMinorUnits", …)`, change `expect(toOriginMinorUnits("10", "BTC")).toBeNull();` to `expect(toOriginMinorUnits("10", "ZZZ")).toBeNull();` and add:

```ts
it("parses any registered asset", () => {
  expect(toOriginMinorUnits("0.5", "BTC")).toBe(500000);
});
```

- In `describe("impliedRate", …)`, change `expect(impliedRate(1200, "ARS", 1000000, "BTC")).toBeNull();` to `expect(impliedRate(1200, "ARS", 1000000, "ZZZ")).toBeNull();` and add:

```ts
it("works with a crypto net amount", () => {
  // 1,00 USDC net out of $ 1.250,00.
  expect(impliedRate(1000000, "USDC", 125000, "ARS")).toBe(0.0008);
});
```

- Append to `describe("formatRateMoney", …)`:

```ts
it("writes the rate and then the code for a crypto net currency, never through Intl", () => {
  expect(formatRateMoney(0.0008, "USDC")).toBe("0,0008 USDC");
  expect(formatRateMoney(1200, "BTC")).toBe("1.200,00 BTC");
});

it("keeps the currency prefix for a legal tender net currency", () => {
  expect(formatRateMoney(1200, "USD")).toMatch(/^US\$\s1\.200,00$/);
});
```

- [ ] **Step 4: Write the failing consumer tests**

Replace the whole of `components/Entries/components/OriginSection/utils.test.ts`'s `describe("originCurrencyGroups", …)` block with (keep `describe("originRateLine", …)` as it is):

```ts
describe("originCurrencyGroups", () => {
  it("lists every crypto asset first, in registry order, named after the asset", () => {
    const { crypto } = originCurrencyGroups("ARS");

    expect(crypto).toEqual([
      { code: "USDC", label: "USDC - USD Coin" },
      { code: "USDT", label: "USDT - Tether" },
      { code: "DAI", label: "DAI - Dai" },
      { code: "BTC", label: "BTC - Bitcoin" },
      { code: "ETH", label: "ETH - Ethereum" },
      { code: "XMR", label: "XMR - Monero" },
      { code: "SOL", label: "SOL - Solana" },
      { code: "BNB", label: "BNB - BNB" },
      { code: "LTC", label: "LTC - Litecoin" },
      { code: "TRX", label: "TRX - TRON" },
    ]);
  });

  it("leaves a crypto net currency out of the crypto group, and keeps the others", () => {
    const codes = originCurrencyGroups("USDC").crypto.map(({ code }) => code);

    expect(codes).toHaveLength(9);
    expect(codes).toContain("USDT");
    expect(codes).not.toContain("USDC");
  });

  it("lists every ISO currency except the net one, in the order of the currency picker", () => {
    const { fiat } = originCurrencyGroups("ARS");

    expect(fiat.map(({ code }) => code)).toEqual(
      CURRENCY_OPTIONS.filter(({ code }) => code !== "ARS").map(
        ({ code }) => code,
      ),
    );
    expect(fiat.map(({ code }) => code)).toContain("USD");
    expect(fiat.map(({ code }) => code)).not.toContain("ARS");
    expect(fiat[0].label).toMatch(/^USD - /);
  });

  it("never offers a crypto asset in the ISO group", () => {
    const { fiat } = originCurrencyGroups("USD");

    expect(fiat.map(({ code }) => code)).not.toContain("USDC");
    expect(fiat.map(({ code }) => code)).not.toContain("USD");
  });
});
```

In `components/Incomes/components/IncomeFormDrawer/IncomeFormDrawer.test.tsx`, in the test `"offers the crypto assets first under 'Cripto', then the currencies but the net one under 'Monedas'"`, replace

```ts
expect(options.slice(0, 3)).toEqual([
  "USDC - USD Coin",
  "USDT - Tether",
  "DAI - Dai",
]);
expect(options[3]).toMatch(/^USD - /);
```

with

```ts
expect(options.slice(0, 10)).toEqual([
  "USDC - USD Coin",
  "USDT - Tether",
  "DAI - Dai",
  "BTC - Bitcoin",
  "ETH - Ethereum",
  "XMR - Monero",
  "SOL - Solana",
  "BNB - BNB",
  "LTC - Litecoin",
  "TRX - TRON",
]);
expect(options[10]).toMatch(/^USD - /);
```

and make the identical replacement in `components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.origin.test.tsx`, test `"offers the crypto assets first, then the currencies but the one of the expense"`.

Append to `core/banks/boardAccounts.test.ts`:

```ts
describe("toBoardBanks with a crypto account", () => {
  const [wallet] = toBoardBanks(
    [
      {
        id: "bank_mp",
        name: "Mercado Pago",
        archived: false,
        accounts: [
          {
            id: "acc_usdc",
            bankId: "bank_mp",
            name: "USDC",
            currency: "USDC",
            archived: false,
          },
        ],
      },
    ],
    [{ accountId: "acc_usdc", currency: "USDC", balance: -1500000 }],
    new Set(["acc_usdc"]),
  );

  it("formats its balance as a number and its code, never as an ISO currency", () => {
    expect(wallet.accounts[0].balance).toBe(-1500000);
    expect(wallet.accounts[0].balanceLabel).toBe("-1,50 USDC");
  });
});
```

Append to `describe("originRate", …)` of `components/Entries/utils.test.ts`:

```ts
it("works when the net amount is in a crypto currency", () => {
  expect(
    rate({
      netAmount: "1",
      netCurrency: "USDC",
      originAmount: "1250",
      originCurrency: "ARS",
    }),
  ).toBe("1 ARS = 0,0008 USDC");
});
```

- [ ] **Step 5: Run the tests to see them fail**

Run: `npx vitest run core/currencies core/incomes/money.test.ts core/banks/boardAccounts.test.ts components/Entries/utils.test.ts components/Entries/components/OriginSection components/Incomes/components/IncomeFormDrawer/IncomeFormDrawer.test.tsx components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.origin.test.tsx`
Expected: FAIL (`CRYPTO_CURRENCY_CODES`, `ALL_CURRENCY_CODES`, `LEGAL_TENDER_CURRENCY_CODES`, `isLegalTenderCode` and `isSupportedCurrencyCode` are not exported; the registry has 3 assets; `formatMoney(…, "USDC")` throws `Unsupported currency: USDC`; `formatMoney(1500000, "BTC")` throws; `formatRateMoney(0.0008, "USDC")` throws `Invalid currency code`; the origin lists stop after DAI).

- [ ] **Step 6: Extend the registry**

In `core/currencies/consts.ts`, replace the comment above `CRYPTO_EXPONENT`, `CRYPTO_EXPONENT` and `CRYPTO_CURRENCIES` with:

```ts
// Every asset is kept with 6 decimals: on chain some have 8 (BTC) or 18 (ETH, DAI), which the
// number-based money helpers cannot hold (a safe integer holds about 9e15), so anything below a
// millionth is dust the app does not track. 6 still leaves about 9,000 million units per amount.
export const CRYPTO_EXPONENT = 6;

// In the order the pickers list them. Adding an asset is one line.
export const CRYPTO_CURRENCIES: readonly CryptoCurrency[] = [
  { code: "USDC", name: "USD Coin", exponent: CRYPTO_EXPONENT },
  { code: "USDT", name: "Tether", exponent: CRYPTO_EXPONENT },
  { code: "DAI", name: "Dai", exponent: CRYPTO_EXPONENT },
  { code: "BTC", name: "Bitcoin", exponent: CRYPTO_EXPONENT },
  { code: "ETH", name: "Ethereum", exponent: CRYPTO_EXPONENT },
  { code: "XMR", name: "Monero", exponent: CRYPTO_EXPONENT },
  { code: "SOL", name: "Solana", exponent: CRYPTO_EXPONENT },
  { code: "BNB", name: "BNB", exponent: CRYPTO_EXPONENT },
  { code: "LTC", name: "Litecoin", exponent: CRYPTO_EXPONENT },
  { code: "TRX", name: "TRON", exponent: CRYPTO_EXPONENT },
];

export const CRYPTO_CURRENCY_CODES: readonly string[] = CRYPTO_CURRENCIES.map(
  ({ code }) => code,
);
```

(Keep `CRYPTO_MIN_FRACTION_DIGITS`, `RATE_FRACTION_DIGITS` and `SMALL_RATE_FRACTION_DIGITS` as they are.)

- [ ] **Step 7: Split the lists**

In `core/incomes/consts.ts`, replace everything from `// Only base-10 currencies are supported` down to and including the `SUPPORTED_CURRENCY_CODES` declaration with:

```ts
// Only base-10 currencies are supported: the decimal <-> minor units conversion in
// money.ts relies on a plain power-of-ten exponent.
const isBase10 = (currency: DineroCurrency<number>): boolean =>
  currency.base === 10;

const DINERO_CURRENCIES = Object.values(
  dineroCurrencies,
) as DineroCurrency<number>[];

// The ISO 4217 currencies the app supports: what an entity bank, a credit card cap or a plan in
// installments can be in.
export const LEGAL_TENDER_CURRENCIES: readonly DineroCurrency<number>[] =
  DINERO_CURRENCIES.filter(isBase10);

export const LEGAL_TENDER_CURRENCY_CODES: readonly string[] =
  LEGAL_TENDER_CURRENCIES.map((currency) => currency.code);

// Every currency an account can hold: the legal tender above, then the crypto assets of the registry
// (a virtual wallet's).
export const ALL_CURRENCY_CODES: readonly string[] = [
  ...LEGAL_TENDER_CURRENCY_CODES,
  ...CRYPTO_CURRENCY_CODES,
];
```

and add `import { CRYPTO_CURRENCY_CODES } from "@/core/currencies/consts";` to its imports (after the `dinero.js/currencies` import; `core/currencies/consts.ts` imports nothing from `core/incomes`, so there is no cycle).

- [ ] **Step 8: Rewrite the money module**

Replace the whole of `core/incomes/money.ts` with:

```ts
import { dinero, toDecimal } from "dinero.js";
import type { Dinero, DineroCurrency } from "dinero.js";

import {
  CRYPTO_CURRENCIES,
  CRYPTO_MIN_FRACTION_DIGITS,
} from "@/core/currencies/consts";
import { isCryptoCode } from "@/core/currencies/crypto";

import {
  DISPLAY_LOCALE,
  LEGAL_TENDER_CURRENCIES,
  MAX_MINOR_UNITS,
} from "./consts";

// The one module that knows both kinds of currency: the legal tender of dinero.js and the crypto
// assets of core/currencies. Amounts are minor units (10^-exponent of the currency) as JS numbers. A
// crypto code is never handed to Intl as a currency: Intl rejects "USDC" and formats any three letters
// ("BTC") as if they were ISO, so crypto is written as a plain number followed by its code.

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

// A crypto asset as Dinero sees a currency: base 10 and the registry's exponent, so the same
// conversions serve both kinds.
const CRYPTO_DINERO_CURRENCIES: readonly DineroCurrency<number>[] =
  CRYPTO_CURRENCIES.map(({ code, exponent }) => ({ code, base: 10, exponent }));

const CURRENCIES_BY_CODE = new Map<string, DineroCurrency<number>>(
  [...LEGAL_TENDER_CURRENCIES, ...CRYPTO_DINERO_CURRENCIES].map((currency) => [
    currency.code,
    currency,
  ]),
);

const LEGAL_TENDER_CODES = new Set(
  LEGAL_TENDER_CURRENCIES.map(({ code }) => code),
);

const requireCurrency = (code: string): DineroCurrency<number> => {
  const currency = CURRENCIES_BY_CODE.get(code);

  if (!currency) {
    throw new RangeError(`Unsupported currency: ${code}`);
  }

  return currency;
};

// An ISO currency the app supports (what an entity bank, a credit card cap or a plan can be in).
export const isLegalTenderCode = (code: string): boolean =>
  LEGAL_TENDER_CODES.has(code);

// Legal tender or a crypto asset of the registry: any currency an account can hold.
export const isSupportedCurrencyCode = (code: string): boolean =>
  CURRENCIES_BY_CODE.has(code);

// How many decimals the currency's minor unit has (2 for USD, 0 for JPY, 6 for every crypto asset),
// or null when the app does not support it.
export const currencyExponent = (code: string): number | null =>
  CURRENCIES_BY_CODE.get(code)?.exponent ?? null;

// BigInt -> number happens only here, at the persistence boundary. Dinero works with
// plain numbers, so anything beyond the safe integer range is rejected instead of being
// silently rounded.
export const minorUnitsToNumber = (value: bigint): number => {
  if (value > MAX_MINOR_UNITS || value < -MAX_MINOR_UNITS) {
    throw new RangeError("Amount is outside the safe integer range");
  }

  return Number(value);
};

const toDinero = (
  minorUnits: number | bigint,
  currencyCode: string,
): Dinero<number> =>
  dinero({
    amount:
      typeof minorUnits === "bigint"
        ? minorUnitsToNumber(minorUnits)
        : minorUnits,
    currency: requireCurrency(currencyCode),
  });

// Parses a plain decimal string ("1234.56") into minor units for the given currency.
// Returns null for malformed input, more fraction digits than the currency allows, an
// unsupported currency or a value beyond the safe integer range.
export const toMinorUnits = (
  input: string,
  currencyCode: string,
): number | null => {
  const currency = CURRENCIES_BY_CODE.get(currencyCode);
  const match = DECIMAL_PATTERN.exec(input.trim());

  if (!currency || !match) {
    return null;
  }

  const [, whole, fraction = ""] = match;

  if (fraction.length > currency.exponent) {
    return null;
  }

  const minorUnits = BigInt(whole + fraction.padEnd(currency.exponent, "0"));

  return minorUnits > MAX_MINOR_UNITS ? null : Number(minorUnits);
};

// "1000.5" as an exact decimal string for a number of minor units, with at least `minimum` and at
// most `exponent` decimals (trailing zeros past the minimum are dropped). A negative amount keeps its
// sign in front.
export const toTrimmedDecimal = (
  minorUnits: number | bigint,
  exponent: number,
  minimum: number,
): string => {
  const value = BigInt(minorUnits);
  const isNegative = value < BigInt(0);
  const absolute = isNegative ? -value : value;
  const scale = BigInt(10) ** BigInt(exponent);
  const whole = (absolute / scale).toString();
  const fraction = (absolute % scale)
    .toString()
    .padStart(exponent, "0")
    .replace(/0+$/, "")
    .padEnd(minimum, "0");

  return `${isNegative ? "-" : ""}${fraction ? `${whole}.${fraction}` : whole}`;
};

// Plain decimal representation ("1234.56"), suitable for prefilling an input. A crypto amount keeps
// at least 2 decimals and at most 6 ("1250.50", "0.000001").
export const toDecimalString = (
  minorUnits: number | bigint,
  currencyCode: string,
): string =>
  isCryptoCode(currencyCode)
    ? toTrimmedDecimal(
        minorUnits,
        requireCurrency(currencyCode).exponent,
        CRYPTO_MIN_FRACTION_DIGITS,
      )
    : toDecimal(toDinero(minorUnits, currencyCode));

// A plain decimal string written with the locale's separators ("1.250,5" in es-AR), never as a
// currency.
export const formatDecimal = (
  decimal: string,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
  locale: string = DISPLAY_LOCALE,
): string =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(decimal as `${number}`);

// "$ 1.234,56" / "US$ 1.234,56" for legal tender; "1.250,50 USDC" for a crypto asset (at least 2
// decimals, at most the asset's, the code last).
export const formatMoney = (
  minorUnits: number | bigint,
  currencyCode: string,
  locale: string = DISPLAY_LOCALE,
): string => {
  if (isCryptoCode(currencyCode)) {
    const { exponent } = requireCurrency(currencyCode);
    const decimal = toTrimmedDecimal(minorUnits, exponent, 0);

    return `${formatDecimal(decimal, CRYPTO_MIN_FRACTION_DIGITS, exponent, locale)} ${currencyCode}`;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(toDecimalString(minorUnits, currencyCode) as `${number}`);
};
```

- [ ] **Step 9: Let the origin helpers delegate**

Replace the whole of `core/currencies/origin.ts` with:

```ts
import { DISPLAY_LOCALE } from "@/core/incomes/consts";
import {
  currencyExponent,
  formatDecimal,
  formatMoney,
  isSupportedCurrencyCode,
  toDecimalString,
  toMinorUnits,
  toTrimmedDecimal,
} from "@/core/incomes/money";

import { RATE_FRACTION_DIGITS, SMALL_RATE_FRACTION_DIGITS } from "./consts";
import { isCryptoCode } from "./crypto";

// The "origin" of an entry: the currency (a crypto asset or any ISO currency) and the amount the net
// amount came from, or was priced in. It is only a reference. Every conversion and format is the money
// module's, which knows both kinds of currency; this file only adds what is specific to an origin.

export const originExponent = (code: string): number | null =>
  currencyExponent(code);

// An origin is any supported currency, and never the currency of the net amount (that would not be
// an origin at all).
export const isOriginCurrencyCode = (
  code: string,
  netCurrency: string,
): boolean => code !== netCurrency && isSupportedCurrencyCode(code);

// Parses a plain decimal string ("1234.56") into minor units of the origin currency. Null for
// malformed input, more decimals than the currency keeps, an unknown code or a value beyond the
// safe integer range.
export const toOriginMinorUnits = (
  input: string,
  code: string,
): number | null => toMinorUnits(input, code);

// Plain decimal representation, suitable for prefilling an input.
export const toOriginDecimalString = (
  minorUnits: number | bigint,
  code: string,
): string => toDecimalString(minorUnits, code);

// "1.000,50 USDC" for a crypto asset, "US$ 1.000,50" for an ISO currency.
export const formatOrigin = (
  minorUnits: number | bigint,
  code: string,
): string => formatMoney(minorUnits, code);

// The short form used as an accessible name: the code last for any currency, and no decimals for a
// whole amount ("1.000 USDC").
export const formatOriginLabel = (
  minorUnits: number | bigint,
  code: string,
): string => {
  const exponent = currencyExponent(code);

  if (exponent === null) {
    throw new RangeError(`Unsupported currency: ${code}`);
  }

  const decimal = toTrimmedDecimal(minorUnits, exponent, 0);
  const isWhole = !decimal.includes(".");
  const minimum = isWhole ? 0 : Math.min(2, exponent);

  return `${formatDecimal(decimal, minimum, exponent)} ${code}`;
};

// How many units of the net currency one unit of the origin cost: the net amount over the origin
// amount, each in whole units. Null when either is not positive or a currency is unknown.
export const impliedRate = (
  netMinorUnits: number,
  netCurrency: string,
  originMinorUnits: number,
  originCode: string,
): number | null => {
  const netExponent = currencyExponent(netCurrency);
  const originExp = currencyExponent(originCode);

  if (
    netExponent === null ||
    originExp === null ||
    netMinorUnits <= 0 ||
    originMinorUnits <= 0
  ) {
    return null;
  }

  return (
    netMinorUnits / 10 ** netExponent / (originMinorUnits / 10 ** originExp)
  );
};

const rateFractionDigits = (rate: number): number =>
  rate < 1 ? SMALL_RATE_FRACTION_DIGITS : RATE_FRACTION_DIGITS;

// "1.200,00"; a rate under 1 keeps 4 decimals so it does not collapse into zero.
export const formatRate = (rate: number): string => {
  const digits = rateFractionDigits(rate);

  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rate);
};

// "$ 1.200,00": the rate as an amount of the net currency. A crypto net currency cannot go through
// Intl, so it reads "0,0008 USDC".
export const formatRateMoney = (rate: number, netCurrency: string): string => {
  if (isCryptoCode(netCurrency)) {
    return `${formatRate(rate)} ${netCurrency}`;
  }

  const digits = rateFractionDigits(rate);

  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: "currency",
    currency: netCurrency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rate);
};
```

- [ ] **Step 10: Move every consumer to the new names (same behaviour)**

Each of these accepted legal tender only and keeps doing so here; Task 5 opens the ones that take crypto.

`core/entries/fields.ts`: remove `SUPPORTED_CURRENCY_CODES` from the `@/core/incomes/consts` import, change `import { toMinorUnits } from "@/core/incomes/money";` to `import { isLegalTenderCode, toMinorUnits } from "@/core/incomes/money";`, delete the line `const SUPPORTED_CURRENCY_SET = new Set(SUPPORTED_CURRENCY_CODES);`, and replace the two uses: `(code) => SUPPORTED_CURRENCY_SET.has(code),` becomes `isLegalTenderCode,` and `if (!SUPPORTED_CURRENCY_SET.has(value.currency)) {` becomes `if (!isLegalTenderCode(value.currency)) {`.

`core/entries/query.ts`: replace `import { SUPPORTED_CURRENCY_CODES } from "@/core/incomes/consts";` with `import { isLegalTenderCode } from "@/core/incomes/money";`, delete `const SUPPORTED_CURRENCY_SET = new Set(SUPPORTED_CURRENCY_CODES);`, and change `.refine((value) => SUPPORTED_CURRENCY_SET.has(value))` to `.refine(isLegalTenderCode)`.

`core/entries/originFields.ts`: remove `SUPPORTED_CURRENCY_CODES` from the `@/core/incomes/consts` import, add `import { isLegalTenderCode } from "@/core/incomes/money";`, delete `const SUPPORTED_CURRENCY_SET = new Set(SUPPORTED_CURRENCY_CODES);`, and change `!SUPPORTED_CURRENCY_SET.has(value.currency)` to `!isLegalTenderCode(value.currency)`.

`core/reimbursements/fields.ts`: delete `import { SUPPORTED_CURRENCY_CODES } from "@/core/incomes/consts";` and the `SUPPORTED_CURRENCY_SET` line, change `import { toMinorUnits } from "@/core/incomes/money";` to `import { isLegalTenderCode, toMinorUnits } from "@/core/incomes/money";`, and change `!SUPPORTED_CURRENCY_SET.has(value.currency)` to `!isLegalTenderCode(value.currency)`.

`core/installments/schema.ts`: change the `@/core/incomes/consts` import to `import { DESCRIPTION_MAX_LENGTH } from "@/core/incomes/consts";`, add `import { isLegalTenderCode } from "@/core/incomes/money";`, delete `const SUPPORTED_CURRENCY_SET = new Set(SUPPORTED_CURRENCY_CODES);`, and change `SUPPORTED_CURRENCY_SET.has(value.currency) &&` to `isLegalTenderCode(value.currency) &&`.

Replace the whole of `components/Entries/currencyOptions.ts` with:

```ts
import { CRYPTO_CURRENCIES } from "@/core/currencies/consts";
import {
  LEGAL_TENDER_CURRENCY_CODES,
  PRIORITY_CURRENCY_CODES,
} from "@/core/incomes/consts";

import { CURRENCY_NAME_LOCALE } from "./formConsts";

export interface CurrencyOption {
  code: string;
  label: string;
}

const priorityRank = (code: string): number => {
  const index = PRIORITY_CURRENCY_CODES.indexOf(code);

  return index === -1 ? PRIORITY_CURRENCY_CODES.length : index;
};

// Priority currencies first (in their declared order), then everything else alphabetically. Legal
// tender only: Intl knows these names.
export const buildCurrencyOptions = (): CurrencyOption[] => {
  const names = new Intl.DisplayNames([CURRENCY_NAME_LOCALE], {
    type: "currency",
  });

  return [...LEGAL_TENDER_CURRENCY_CODES]
    .sort((a, b) => priorityRank(a) - priorityRank(b) || a.localeCompare(b))
    .map((code) => ({ code, label: `${code} - ${names.of(code) ?? code}` }));
};

export const CURRENCY_OPTIONS: readonly CurrencyOption[] =
  buildCurrencyOptions();

// The crypto assets in registry order, named after the asset ("USDC - USD Coin"): Intl has no name
// for them.
export const CRYPTO_CURRENCY_OPTIONS: readonly CurrencyOption[] =
  CRYPTO_CURRENCIES.map(({ code, name }) => ({
    code,
    label: `${code} - ${name}`,
  }));
```

In `components/Entries/components/OriginSection/utils.ts`, change the imports to

```ts
import {
  CRYPTO_CURRENCY_OPTIONS,
  CURRENCY_OPTIONS,
} from "@/components/Entries/currencyOptions";
import type { OriginRateInput } from "@/components/Entries/types";
import { originRate } from "@/components/Entries/utils";
```

(drop the `CRYPTO_CURRENCIES` import) and replace `originCurrencyGroups` with:

```ts
// The origin currencies on offer: the crypto assets first, then every ISO currency, in both cases
// without the one of the net amount (an origin in the same currency would say nothing).
export const originCurrencyGroups = (
  netCurrency: string,
): OriginCurrencyGroups => ({
  crypto: CRYPTO_CURRENCY_OPTIONS.filter(({ code }) => code !== netCurrency),
  fiat: CURRENCY_OPTIONS.filter(({ code }) => code !== netCurrency),
});
```

Then run `rg -n "SUPPORTED_CURRENC" core components app lib scripts` and expect no match.

- [ ] **Step 11: Run the task's tests to see them pass**

Run: `npx vitest run core/currencies core/incomes core/entries core/reimbursements core/installments core/banks/boardAccounts.test.ts components/Entries components/Incomes components/Expenses components/Conversions`
Expected: PASS.

- [ ] **Step 12: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto core/currencies/consts.ts core/currencies/crypto.test.ts core/currencies/origin.ts core/currencies/origin.test.ts core/incomes/consts.ts core/incomes/money.ts core/incomes/money.test.ts core/entries/fields.ts core/entries/query.ts core/entries/originFields.ts core/reimbursements/fields.ts core/installments/schema.ts core/banks/boardAccounts.test.ts components/Entries/currencyOptions.ts components/Entries/utils.test.ts components/Entries/components/OriginSection/utils.ts components/Entries/components/OriginSection/utils.test.ts components/Incomes/components/IncomeFormDrawer/IncomeFormDrawer.test.tsx components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.origin.test.tsx`.
Expected: all green.

- [ ] **Step 13: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 3: Legal tender first, then crypto: one order for every per-currency list

**Files:**

- Modify: `core/currencies/crypto.ts`, `core/currencies/crypto.test.ts`
- Modify: `core/summary/compute.ts`, `core/summary/compute.test.ts`
- Modify: `core/summary/groupAccounts.ts`, `core/summary/groupAccounts.test.ts`
- Modify: `core/balances/accounts.ts`, `core/balances/accounts.test.ts`
- Modify: `core/entries/listing.ts`, `core/entries/listing.test.ts`
- Modify: `core/reimbursements/compute.ts`, `core/reimbursements/compute.test.ts`
- Modify: `components/Entries/components/EntriesFilters/utils.ts`; create `components/Entries/components/EntriesFilters/utils.test.ts`

**Interfaces:**

- Consumes: `CRYPTO_CURRENCIES` (`core/currencies/consts.ts`); `summarize`, `groupAccountBalances`, `totalsByCurrency`, `foldCurrencyTotals`, `pendingByCurrency`, `buildCurrencyOptions` (EntriesFilters) as they are.
- Produces: `compareCurrencyCodes(a: string, b: string): number` in `core/currencies/crypto.ts`; the six functions above sort with it (same output as today for legal tender only).

- [ ] **Step 1: Write the failing tests**

Append to `core/currencies/crypto.test.ts` (and add `compareCurrencyCodes` to its `./crypto` import):

```ts
describe("compareCurrencyCodes", () => {
  it("puts legal tender first, by code as always, then the crypto assets in registry order", () => {
    expect(
      ["BTC", "USD", "USDC", "ARS", "DAI", "EUR", "USDT"].sort(
        compareCurrencyCodes,
      ),
    ).toEqual(["ARS", "EUR", "USD", "USDC", "USDT", "DAI", "BTC"]);
  });

  it("keeps the alphabetical order of legal tender alone", () => {
    expect(["USD", "ARS", "BRL"].sort(compareCurrencyCodes)).toEqual([
      "ARS",
      "BRL",
      "USD",
    ]);
  });
});
```

Append to `describe("summarize", …)` of `core/summary/compute.test.ts`:

```ts
it("lists the crypto sections after the legal tender ones, each on its own", () => {
  const rows = summarize(
    [
      group("USDC", "SETTLED", 1500000),
      group("ARS", "SETTLED", 20),
      group("BTC", "SETTLED", 1),
    ],
    [group("USD", "SETTLED", 5)],
  );

  expect(rows.map((row) => row.currency)).toEqual([
    "ARS",
    "USD",
    "USDC",
    "BTC",
  ]);
  expect(rows[2].current).toBe(1500000);
  expect(rows[1].current).toBe(-5);
});
```

Append to `describe("groupAccountBalances", …)` of `core/summary/groupAccounts.test.ts`:

```ts
it("shows the crypto currencies after the legal tender ones", () => {
  const groups = groupAccountBalances([
    row({ accountId: "a1", currency: "USDC", balance: 1500000 }),
    row({ accountId: "a2", currency: "USD", balance: 700 }),
    row({ accountId: "a3", currency: "ARS", balance: 1000 }),
  ]);

  expect(groups.map(({ currency }) => currency)).toEqual([
    "ARS",
    "USD",
    "USDC",
  ]);
  expect(groups[2].total).toBe(1500000);
});
```

Append to `describe("totalsByCurrency", …)` of `core/balances/accounts.test.ts`:

```ts
it("lists a crypto total after the legal tender ones, never added to them", () => {
  expect(
    totalsByCurrency([
      { accountId: "wallet", currency: "USDC", balance: 1500000 },
      { accountId: "dollars", currency: "USD", balance: 50 },
    ]),
  ).toEqual([
    { currency: "USD", amount: 50 },
    { currency: "USDC", amount: 1500000 },
  ]);
});
```

Append to `describe("foldCurrencyTotals", …)` of `core/entries/listing.test.ts`:

```ts
it("folds a crypto currency on its own, after the legal tender ones", () => {
  expect(
    foldCurrencyTotals([
      { currency: "BTC", status: "SETTLED", _sum: { amount: BigInt(1) } },
      {
        currency: "USDC",
        status: "PLANNED",
        _sum: { amount: BigInt(1500000) },
      },
      { currency: "ARS", status: "SETTLED", _sum: { amount: BigInt(100) } },
    ]).map(({ currency }) => currency),
  ).toEqual(["ARS", "USDC", "BTC"]);
});
```

Append to `describe("pendingByCurrency", …)` of `core/reimbursements/compute.test.ts`:

```ts
it("sorts a crypto currency after the legal tender ones", () => {
  expect(
    pendingByCurrency(
      [
        { id: "x", currency: "USDC", expectedReimbursement: 1 },
        { id: "z", currency: "USD", expectedReimbursement: 1 },
      ],
      [],
    ).map(({ currency }) => currency),
  ).toEqual(["USD", "USDC"]);
});
```

Create `components/Entries/components/EntriesFilters/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildCurrencyOptions } from "./utils";

describe("buildCurrencyOptions", () => {
  it("lists the currencies in use once each, legal tender by code first and then the crypto ones", () => {
    expect(buildCurrencyOptions(["USDC", "USD", "ARS", "BTC"], null)).toEqual([
      { id: "ARS", label: "ARS" },
      { id: "USD", label: "USD" },
      { id: "USDC", label: "USDC" },
      { id: "BTC", label: "BTC" },
    ]);
  });

  it("adds the active currency when no entry uses it, so a shared link never shows an empty field", () => {
    expect(buildCurrencyOptions(["ARS"], "USDT").map(({ id }) => id)).toEqual([
      "ARS",
      "USDT",
    ]);
    expect(
      buildCurrencyOptions(["ARS", "USDT"], "USDT").map(({ id }) => id),
    ).toEqual(["ARS", "USDT"]);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run core/currencies core/summary core/balances/accounts.test.ts core/entries/listing.test.ts core/reimbursements/compute.test.ts components/Entries/components/EntriesFilters`
Expected: FAIL (`compareCurrencyCodes` is not exported; every list puts "BTC" and "DAI" before the legal tender codes that sort after them, and "USDC" between "USD" and anything later).

- [ ] **Step 3: Write the comparator**

Append to `core/currencies/crypto.ts`:

```ts
const CRYPTO_RANK = new Map<string, number>(
  CRYPTO_CURRENCIES.map(({ code }, index) => [code, index]),
);

// The one order of every per-currency list: legal tender first, by code (the order the app always
// had), then the crypto assets in registry order. Unknown codes count as legal tender.
export const compareCurrencyCodes = (a: string, b: string): number => {
  const rankA = CRYPTO_RANK.get(a);
  const rankB = CRYPTO_RANK.get(b);

  if (rankA === undefined && rankB === undefined) {
    return a.localeCompare(b);
  }

  if (rankA === undefined) {
    return -1;
  }

  if (rankB === undefined) {
    return 1;
  }

  return rankA - rankB;
};
```

- [ ] **Step 4: Use it everywhere a list of currencies is sorted**

Each file gains `import { compareCurrencyCodes } from "@/core/currencies/crypto";` (with the other `@/` imports) and changes exactly one sort:

- `core/summary/compute.ts`: `].sort((a, b) => a.localeCompare(b));` → `].sort(compareCurrencyCodes);`
- `core/summary/groupAccounts.ts`: `return [...byCurrency.values()].sort((a, b) =>\n    a.currency.localeCompare(b.currency),\n  );` → `return [...byCurrency.values()].sort((a, b) =>\n    compareCurrencyCodes(a.currency, b.currency),\n  );`
- `core/balances/accounts.ts`: `.sort((a, b) => a.currency.localeCompare(b.currency));` → `.sort((a, b) => compareCurrencyCodes(a.currency, b.currency));`
- `core/entries/listing.ts`: `a.currency.localeCompare(b.currency),` (in `foldCurrencyTotals`) → `compareCurrencyCodes(a.currency, b.currency),`
- `core/reimbursements/compute.ts`: `.sort((a, b) => a.currency.localeCompare(b.currency));` → `.sort((a, b) => compareCurrencyCodes(a.currency, b.currency));`
- `components/Entries/components/EntriesFilters/utils.ts`: `.sort((a, b) => a.localeCompare(b))` → `.sort(compareCurrencyCodes)`

Update the comment above `foldCurrencyTotals`, `totalsByCurrency` and `groupAccountBalances` only if it says "sorted by currency" / "by code": make it "legal tender first, then crypto (compareCurrencyCodes)".

- [ ] **Step 5: Run the task's tests to see them pass**

Run: `npx vitest run core/currencies core/summary core/balances core/entries core/reimbursements components/Entries components/Summary`
Expected: PASS (the existing tests use legal tender only, whose order is unchanged).

- [ ] **Step 6: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto core/currencies/crypto.ts core/currencies/crypto.test.ts core/summary/compute.ts core/summary/compute.test.ts core/summary/groupAccounts.ts core/summary/groupAccounts.test.ts core/balances/accounts.ts core/balances/accounts.test.ts core/entries/listing.ts core/entries/listing.test.ts core/reimbursements/compute.ts core/reimbursements/compute.test.ts components/Entries/components/EntriesFilters/utils.ts components/Entries/components/EntriesFilters/utils.test.ts`.
Expected: all green.

- [ ] **Step 7: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 4: The bank kind in the core (client, banks, accounts, the per-kind currency rule) — GATE after it

This is the one task that makes runtime code read `Bank.kind` (D1). The controller asks the user for the migration right after it.

**Files:**

- Run: `npx prisma generate`
- Modify: `core/banks/consts.ts`, `core/banks/types.ts`, `core/banks/schema.ts`, `core/banks/errors.ts`, `core/banks/locks.ts`, `core/banks/service.ts`, `core/banks/board.ts`, `core/banks/actionHelpers.ts`
- Create: `core/banks/kinds.ts`, `core/banks/kinds.test.ts`
- Modify: `core/accounts/consts.ts`, `core/accounts/errors.ts`, `core/accounts/service.ts`
- Tests (modify): `core/banks/schema.test.ts` (rewrite), `core/banks/locks.test.ts`, `core/banks/service.test.ts`, `core/banks/actions.test.ts`, `core/banks/board.test.ts`, `core/banks/boardAccounts.test.ts`, `core/accounts/service.test.ts`, `core/accounts/actions.test.ts`
- Tests (fixtures only, so `tsc` stays green: every object typed `Bank`, `BankWithAccounts` or `BoardBank` needs `kind`): `app/dashboard/banks/loadBanksView.test.ts`, `components/Banks/Banks.test.tsx`, `components/Banks/components/AccountFormDrawer/AccountFormDrawer.test.tsx`, `components/Banks/components/AccountFormDrawer/utils.test.ts`, `components/Banks/components/BankFormDrawer/BankFormDrawer.test.tsx`, `components/Banks/components/BanksBoard/BanksBoard.test.tsx`, `components/Banks/components/BanksBoard/components/BankRow/BankRow.test.tsx`, `components/Banks/components/BanksBoard/components/BankRow/components/BankCell/BankCell.test.tsx`

**Interfaces:**

- Consumes: `CRYPTO_CURRENCY_CODES` (`core/currencies/consts.ts`), `isLegalTenderCode`, `isSupportedCurrencyCode` (`core/incomes/money.ts`), `lockBank`, `lockBankOfAccount` (`core/banks/locks.ts`), `lockAccount` (`core/accounts/locks.ts`), `countAccountMovements` (`core/accounts/movements.ts`), `fieldFailure`, `failure` (`core/entries/actionHelpers.ts`), the generated `BankKind` enum.
- Produces:
  - `core/banks/consts.ts`: `BANK_KINDS = ["ENTITY", "WALLET"] as const`, `DEFAULT_BANK_KIND: BankKind = "ENTITY"`, `BANK_KIND_NAMES: Readonly<Record<BankKind, string>>`, `BANK_FORM_FIELDS = ["name", "kind"] as const`, `BANK_KIND_REQUIRED_MESSAGE`, `BANK_HAS_CRYPTO_ACCOUNTS_MESSAGE`.
  - `core/banks/types.ts`: `type BankKind = (typeof BANK_KINDS)[number]`; `BankInput { name: string; kind: BankKind }` (so `Bank`, `BankWithAccounts`, `BoardBank` carry `kind`).
  - `core/banks/schema.ts`: `bankInputSchema` with a required `kind`.
  - `core/banks/errors.ts`: `class BankHasCryptoAccountsError extends Error { readonly count: number }`.
  - `core/banks/locks.ts`: `LockedBank { id; archivedAt; kind: BankKind }` read by both lock functions.
  - `core/banks/kinds.ts`: `bankAcceptsCurrency(kind: BankKind, currency: string): boolean`.
  - `core/banks/service.ts`: `createBank` writes the kind; `updateBank(userId, id, input)` transactional with the kind rule; `listBanksWithAccounts` returns the kind.
  - `core/banks/board.ts`: `activeBanks` keeps the kind.
  - `core/accounts/errors.ts`: `class CryptoCurrencyNotAllowedError extends Error { readonly currency: string }`.
  - `core/accounts/consts.ts`: `ENTITY_LEGAL_TENDER_ONLY_MESSAGE`.
  - `core/accounts/service.ts`: `createAccount` and `updateAccount` refuse a currency the bank's kind does not take.
  - `toKnownFailure` maps `BankHasCryptoAccountsError` to `{ kind: [...] }` and `CryptoCurrencyNotAllowedError` to `{ currency: [...] }`.

- [ ] **Step 1: Generate the client**

Run: `npx prisma generate`.
Expected: the client is generated into `lib/generated/prisma` and `Bank` has `kind: $Enums.BankKind`. Do not run any other Prisma command.

- [ ] **Step 2: Write the failing bank tests**

Create `core/banks/kinds.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { bankAcceptsCurrency } from "./kinds";

describe("bankAcceptsCurrency", () => {
  it("lets an entity hold legal tender, and nothing else", () => {
    expect(bankAcceptsCurrency("ENTITY", "ARS")).toBe(true);
    expect(bankAcceptsCurrency("ENTITY", "USD")).toBe(true);
    expect(bankAcceptsCurrency("ENTITY", "USDC")).toBe(false);
    expect(bankAcceptsCurrency("ENTITY", "BTC")).toBe(false);
  });

  it("lets a virtual wallet hold legal tender and every crypto asset of the registry", () => {
    expect(bankAcceptsCurrency("WALLET", "ARS")).toBe(true);
    expect(bankAcceptsCurrency("WALLET", "USDC")).toBe(true);
    expect(bankAcceptsCurrency("WALLET", "TRX")).toBe(true);
  });

  it("refuses an unknown code for either kind", () => {
    expect(bankAcceptsCurrency("WALLET", "ZZZ")).toBe(false);
    expect(bankAcceptsCurrency("ENTITY", "ZZZ")).toBe(false);
  });
});
```

Replace the whole of `core/banks/schema.test.ts` with:

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
  it("trims the name and keeps the kind", () => {
    expect(
      bankInputSchema.parse({ name: "  Banco Galicia  ", kind: "ENTITY" }),
    ).toEqual({ name: "Banco Galicia", kind: "ENTITY" });
  });

  it("keeps the casing the user typed", () => {
    expect(
      bankInputSchema.parse({ name: "mercado PAGO", kind: "WALLET" }),
    ).toEqual({ name: "mercado PAGO", kind: "WALLET" });
  });

  it("refuses an empty name, a name of only spaces and a missing name", () => {
    expect(messages({ name: "", kind: "ENTITY" })).toEqual([
      "El nombre es obligatorio.",
    ]);
    expect(messages({ name: "   ", kind: "ENTITY" })).toEqual([
      "El nombre es obligatorio.",
    ]);
    expect(messages({ kind: "ENTITY" })).toEqual(["El nombre es obligatorio."]);
  });

  it("accepts 40 characters and refuses 41", () => {
    expect(messages({ name: "a".repeat(40), kind: "ENTITY" })).toEqual([]);
    expect(messages({ name: "a".repeat(41), kind: "ENTITY" })).toEqual([
      "El nombre admite como máximo 40 caracteres.",
    ]);
  });

  it("counts the length after trimming", () => {
    expect(messages({ name: ` ${"a".repeat(40)} `, kind: "ENTITY" })).toEqual(
      [],
    );
  });

  it("requires a known kind: a missing one never turns a wallet into an entity", () => {
    expect(messages({ name: "Galicia" })).toEqual(["Elegí el tipo de banco."]);
    expect(messages({ name: "Galicia", kind: "CRYPTO" })).toEqual([
      "Elegí el tipo de banco.",
    ]);
    expect(messages({ name: "Galicia", kind: "WALLET" })).toEqual([]);
  });

  it("strips fields it does not know, so an owner or an archive date can never ride along", () => {
    expect(
      bankInputSchema.parse({
        name: "A",
        kind: "ENTITY",
        userId: "attacker",
        archivedAt: "x",
      }),
    ).toEqual({ name: "A", kind: "ENTITY" });
  });
});
```

In `core/banks/locks.test.ts`:

- in `describe("lockBank", …)`, first test: the fake row becomes `{ id: "bank_1", archivedAt: AT, kind: "WALLET" }`, the expected value `{ id: "bank_1", archivedAt: AT, kind: "WALLET" }`, and add `expect(sql).toContain('"kind"');` after the `FROM "Bank"` assertion; its title becomes `"locks the user's bank row until the transaction ends, and reads whether it is archived and its kind"`.
- in `describe("lockBankOfAccount", …)`, first test: the fake row becomes `{ id: "bank_1", archivedAt: null, kind: "ENTITY" }`, the expected value the same, and add `expect(sql).toContain('b."kind"');`.

In `core/banks/service.test.ts`:

- in `bankRow`, add `kind: "ENTITY",` right after `name: "Banco Galicia",`.
- in `"returns plain banks and accounts: no owner, the archive date as a flag"`, add `kind: "ENTITY",` after `name: "Banco Galicia",` of the first expected bank and change the second to `{ id: "bank_2", name: "Viejo", kind: "ENTITY", archived: true, accounts: [] }`; append a new test to the same `describe`:

```ts
it("returns the kind of each bank", async () => {
  bank.findMany.mockResolvedValue([
    {
      ...bankRow({ id: "bank_mp", name: "Mercado Pago", kind: "WALLET" }),
      accounts: [],
    },
    { ...bankRow(), accounts: [] },
  ]);

  expect(
    (await listBanksWithAccounts(USER_ID)).map(({ kind }) => kind),
  ).toEqual(["WALLET", "ENTITY"]);
});
```

- replace the whole `describe("createBank", …)` with:

```ts
describe("createBank", () => {
  it("looks for a clash among the user's banks ignoring case, then creates with an explicit field list", async () => {
    bank.findFirst.mockResolvedValue(null);
    bank.create.mockResolvedValue(bankRow());

    const created = await createBank(USER_ID, {
      name: "Banco Galicia",
      kind: "ENTITY",
    });

    expect(bank.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        name: { equals: "Banco Galicia", mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(bank.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, name: "Banco Galicia", kind: "ENTITY" },
    });
    expect(created).toEqual({
      id: "bank_1",
      name: "Banco Galicia",
      kind: "ENTITY",
      archived: false,
    });
  });

  it("creates a virtual wallet when asked", async () => {
    bank.findFirst.mockResolvedValue(null);
    bank.create.mockResolvedValue(
      bankRow({ name: "Mercado Pago", kind: "WALLET" }),
    );

    const created = await createBank(USER_ID, {
      name: "Mercado Pago",
      kind: "WALLET",
    });

    expect(bank.create.mock.calls[0][0].data.kind).toBe("WALLET");
    expect(created.kind).toBe("WALLET");
  });

  it("refuses a name that exists with another casing", async () => {
    bank.findFirst.mockResolvedValue({ id: "bank_9" });

    await expect(
      createBank(USER_ID, { name: "BANCO GALICIA", kind: "ENTITY" }),
    ).rejects.toBeInstanceOf(DuplicateBankError);
    expect(bank.create).not.toHaveBeenCalled();
  });

  it("maps the unique constraint (two identical requests at once) to the same error", async () => {
    bank.findFirst.mockResolvedValue(null);
    bank.create.mockRejectedValue(uniqueViolation());

    await expect(
      createBank(USER_ID, { name: "Galicia", kind: "ENTITY" }),
    ).rejects.toBeInstanceOf(DuplicateBankError);
  });

  it("lets any other failure through", async () => {
    bank.findFirst.mockResolvedValue(null);
    bank.create.mockRejectedValue(new Error("db down"));

    await expect(
      createBank(USER_ID, { name: "Galicia", kind: "ENTITY" }),
    ).rejects.toThrow("db down");
  });
});
```

- replace the whole `describe("updateBank", …)` with (every old case is kept, now under the bank lock):

```ts
describe("updateBank", () => {
  const ENTITY_ROW = { id: "bank_1", archivedAt: null, kind: "ENTITY" };
  const WALLET_ROW = { id: "bank_1", archivedAt: null, kind: "WALLET" };
  const input = { name: "Galicia", kind: "ENTITY" as const };

  beforeEach(() => {
    db.$queryRaw.mockResolvedValue([ENTITY_ROW]);
    bank.findFirst.mockResolvedValue(null);
    account.count.mockResolvedValue(0);
    bank.updateMany.mockResolvedValue({ count: 1 });
  });

  it("locks the bank, checks nobody else has the name and that an entity keeps no crypto account, then writes the name and the kind, in one transaction", async () => {
    const order: string[] = [];

    db.$queryRaw.mockImplementation(async () => {
      order.push("lock");

      return [ENTITY_ROW];
    });
    bank.findFirst.mockImplementation(async () => {
      order.push("clash");

      return null;
    });
    account.count.mockImplementation(async () => {
      order.push("crypto");

      return 0;
    });
    bank.updateMany.mockImplementation(async () => {
      order.push("write");

      return { count: 1 };
    });

    await updateBank(USER_ID, "bank_1", input);

    expect(order).toEqual(["lock", "clash", "crypto", "write"]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(bank.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        id: { not: "bank_1" },
        name: { equals: "Galicia", mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(bank.updateMany).toHaveBeenCalledWith({
      where: { id: "bank_1", userId: USER_ID },
      data: { name: "Galicia", kind: "ENTITY" },
    });
  });

  it("lets a bank take another casing of its own name: the clash lookup leaves the bank itself out", async () => {
    await expect(
      updateBank(USER_ID, "bank_1", { ...input, name: "banco galicia" }),
    ).resolves.toBeUndefined();
    expect(bank.findFirst.mock.calls[0][0].where.id).toEqual({
      not: "bank_1",
    });
  });

  it("treats another user's bank (or an unknown id) as not found and writes nothing", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      updateBank(USER_ID, "bank_of_someone_else", input),
    ).rejects.toBeInstanceOf(BankNotFoundError);
    expect(bank.findFirst).not.toHaveBeenCalled();
    expect(bank.updateMany).not.toHaveBeenCalled();
  });

  it("refuses the name of another bank of the user", async () => {
    bank.findFirst.mockResolvedValue({ id: "bank_2" });

    await expect(
      updateBank(USER_ID, "bank_1", { ...input, name: "Mercado Pago" }),
    ).rejects.toBeInstanceOf(DuplicateBankError);
    expect(bank.updateMany).not.toHaveBeenCalled();
  });

  it("maps the unique constraint to the same error", async () => {
    bank.updateMany.mockRejectedValue(uniqueViolation());

    await expect(updateBank(USER_ID, "bank_1", input)).rejects.toBeInstanceOf(
      DuplicateBankError,
    );
  });

  it("is not found when the bank disappears before the write", async () => {
    bank.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateBank(USER_ID, "bank_1", input)).rejects.toBeInstanceOf(
      BankNotFoundError,
    );
  });

  it("always lets an entity become a wallet, without counting anything", async () => {
    await expect(
      updateBank(USER_ID, "bank_1", { ...input, kind: "WALLET" }),
    ).resolves.toBeUndefined();
    expect(account.count).not.toHaveBeenCalled();
    expect(bank.updateMany.mock.calls[0][0].data).toEqual({
      name: "Galicia",
      kind: "WALLET",
    });
  });

  it("refuses to make a wallet an entity while it has crypto accounts, archived ones included, saying how many, and writes nothing", async () => {
    db.$queryRaw.mockResolvedValue([WALLET_ROW]);
    account.count.mockResolvedValue(2);

    const error = await updateBank(USER_ID, "bank_1", input).catch(
      (thrown) => thrown,
    );

    expect(error).toBeInstanceOf(BankHasCryptoAccountsError);
    expect(error.count).toBe(2);
    expect(account.count).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        bankId: "bank_1",
        currency: {
          in: [
            "USDC",
            "USDT",
            "DAI",
            "BTC",
            "ETH",
            "XMR",
            "SOL",
            "BNB",
            "LTC",
            "TRX",
          ],
        },
      },
    });
    expect(bank.updateMany).not.toHaveBeenCalled();
  });

  it("makes a wallet an entity once it has no crypto account left", async () => {
    db.$queryRaw.mockResolvedValue([WALLET_ROW]);

    await expect(updateBank(USER_ID, "bank_1", input)).resolves.toBeUndefined();
    expect(bank.updateMany.mock.calls[0][0].data.kind).toBe("ENTITY");
  });
});
```

and add `BankHasCryptoAccountsError` to the `./errors` import.

In `core/banks/board.test.ts`: add `kind: "ENTITY",` right after the `name:` of each of the three banks of `BANKS`; replace the `describe("activeBanks", …)` with:

```ts
describe("activeBanks", () => {
  it("lists the banks that are not archived as plain banks with their kind, without their accounts", () => {
    expect(activeBanks(BANKS)).toEqual([
      { id: "cash", name: "Efectivo", kind: "ENTITY", archived: false },
      { id: "galicia", name: "Banco Galicia", kind: "ENTITY", archived: false },
    ]);
  });

  it("keeps a wallet a wallet", () => {
    expect(
      activeBanks([{ ...BANKS[0], kind: "WALLET" }]).map(({ kind }) => kind),
    ).toEqual(["WALLET"]);
  });
});
```

In `core/banks/boardAccounts.test.ts`: add `kind: "ENTITY",` after `name: "Banco Galicia",` of `BANKS`, add `kind: "WALLET",` after `name: "Mercado Pago",` of the crypto test's bank (Task 2), and in `"keeps everything else of the bank and its accounts"` add `kind: "ENTITY",` to the `toMatchObject` of the bank.

In `core/banks/actions.test.ts`:

- replace `formOf` with:

```ts
const formOf = (patch: Record<string, string> = {}) => {
  const values: Record<string, string> = {
    name: "Banco Galicia",
    kind: "ENTITY",
    ...patch,
  };
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => formData.set(key, value));

  return formData;
};
```

- change `expect(mocks.createBank).toHaveBeenCalledWith(USER_ID, {\n      name: "Banco Galicia",\n    });` to include `kind: "ENTITY",`, and `expect(mocks.updateBank).toHaveBeenCalledWith(USER_ID, "bank_1", {\n      name: "Galicia",\n    });` likewise.
- add `BankHasCryptoAccountsError` to the `./errors` import and append:

```ts
describe("the kind of a bank", () => {
  it("sends the kind chosen to the service", async () => {
    mocks.createBank.mockResolvedValue({ id: "bank_1" });

    await createBankAction(formOf({ name: "Mercado Pago", kind: "WALLET" }));

    expect(mocks.createBank).toHaveBeenCalledWith(USER_ID, {
      name: "Mercado Pago",
      kind: "WALLET",
    });
  });

  it("refuses a missing or unknown kind under Tipo, without touching the service", async () => {
    const formData = formOf();

    formData.delete("kind");

    const result = await updateBankAction("bank_1", formData);

    expect(result.status === "error" && result.fieldErrors).toEqual({
      kind: ["Elegí el tipo de banco."],
    });
    expect(mocks.updateBank).not.toHaveBeenCalled();
  });

  it("puts the refusal to make a wallet with crypto accounts an entity under Tipo", async () => {
    mocks.updateBank.mockRejectedValue(new BankHasCryptoAccountsError(1));

    const result = await updateBankAction("bank_1", formOf());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      kind: [
        "Este banco tiene cuentas cripto (archivadas incluidas). Eliminalas antes de pasarlo a entidad bancaria.",
      ],
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Write the failing account tests**

In `core/accounts/service.test.ts` add `CryptoCurrencyNotAllowedError` to the `./errors` import. Append to `describe("createAccount", …)`:

```ts
it("refuses a crypto currency in an entity bank, creating nothing", async () => {
  db.$queryRaw.mockResolvedValue([
    { id: "bank_1", archivedAt: null, kind: "ENTITY" },
  ]);

  const error = await createAccount(USER_ID, {
    ...input,
    currency: "USDC",
  }).catch((thrown) => thrown);

  expect(error).toBeInstanceOf(CryptoCurrencyNotAllowedError);
  expect(error.currency).toBe("USDC");
  expect(account.create).not.toHaveBeenCalled();
});

it("creates a crypto account in a virtual wallet, reading the kind from the bank's lock", async () => {
  db.$queryRaw.mockResolvedValue([
    { id: "bank_1", archivedAt: null, kind: "WALLET" },
  ]);
  account.create.mockResolvedValue(accountRow({ currency: "USDC" }));

  await createAccount(USER_ID, { ...input, currency: "USDC" });

  expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  expect(account.create.mock.calls[0][0].data.currency).toBe("USDC");
});

it("lets a virtual wallet hold legal tender too", async () => {
  db.$queryRaw.mockResolvedValue([
    { id: "bank_1", archivedAt: null, kind: "WALLET" },
  ]);

  await createAccount(USER_ID, input);

  expect(account.create.mock.calls[0][0].data.currency).toBe("ARS");
});
```

Replace the whole `describe("updateAccount", …)` with (every old case is kept; only the lock mock and the first test's lock assertion change):

```ts
describe("updateAccount", () => {
  const BANK_ROW = { id: "bank_1", archivedAt: null, kind: "ENTITY" };
  const ACCOUNT_ROW = { id: "acc_1", currency: "ARS", archivedAt: null };

  // The bank lock reads "Bank", the account lock reads "Account".
  const lockRows = (bankRows: unknown[], accountRows: unknown[]) =>
    db.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) =>
      strings.join("?").includes('FROM "Bank"') ? bankRows : accountRows,
    );

  beforeEach(() => {
    lockRows([BANK_ROW], [ACCOUNT_ROW]);
    account.findFirst.mockResolvedValue({ id: "acc_1", bankId: "bank_1" });
    movements.countAccountMovements.mockResolvedValue(0);
    account.updateMany.mockResolvedValue({ count: 1 });
  });

  it("locks the account's bank and then the account, checks the rest of its bank and writes the name and the currency, in one transaction", async () => {
    const order: string[] = [];

    db.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
      const isBank = strings.join("?").includes('FROM "Bank"');

      order.push(isBank ? "lock bank" : "lock account");

      return isBank ? [BANK_ROW] : [ACCOUNT_ROW];
    });
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);

    await updateAccount(USER_ID, "acc_1", { name: "Ahorros", currency: "USD" });

    expect(order).toEqual(["lock bank", "lock account"]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
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
    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      data: { name: "Ahorros", currency: "USD" },
    });
  });

  it("lets an account take another casing of its own name: the clash lookup leaves the account itself out", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);

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

  it("refuses to change the currency of an account with movements, writing nothing", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);
    movements.countAccountMovements.mockResolvedValue(4);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "Caja", currency: "USD" }),
    ).rejects.toBeInstanceOf(AccountCurrencyLockedError);
    expect(movements.countAccountMovements).toHaveBeenCalledWith(
      db,
      USER_ID,
      "acc_1",
    );
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("lets an account with movements be renamed when the currency stays, without counting them", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);
    movements.countAccountMovements.mockResolvedValue(4);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "Caja", currency: "ARS" }),
    ).resolves.toBeUndefined();
    expect(movements.countAccountMovements).not.toHaveBeenCalled();
    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      data: { name: "Caja", currency: "ARS" },
    });
  });

  it("lets an account without movements change its currency", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "Caja", currency: "USD" }),
    ).resolves.toBeUndefined();
    expect(movements.countAccountMovements).toHaveBeenCalledTimes(1);
    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      data: { name: "Caja", currency: "USD" },
    });
  });

  it("refuses a crypto currency for an account of an entity bank, writing nothing", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "Caja", currency: "USDC" }),
    ).rejects.toBeInstanceOf(CryptoCurrencyNotAllowedError);
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("lets an account of a virtual wallet take a crypto currency", async () => {
    lockRows([{ ...BANK_ROW, kind: "WALLET" }], [ACCOUNT_ROW]);
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "USDC", currency: "USDC" }),
    ).resolves.toBeUndefined();
    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      data: { name: "USDC", currency: "USDC" },
    });
  });

  it("treats another user's account (or an unknown id) as not found and writes nothing", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      updateAccount(USER_ID, "acc_of_someone_else", {
        name: "A",
        currency: "ARS",
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("is not found when the locked account has no row for the user", async () => {
    account.findFirst.mockResolvedValue(null);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "A", currency: "ARS" }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
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
});
```

In `core/accounts/actions.test.ts`, add `CryptoCurrencyNotAllowedError` to the `./errors` import and append:

```ts
describe("a crypto currency in an entity bank", () => {
  const MESSAGE =
    "Las entidades bancarias solo admiten monedas de curso legal. Usá una billetera virtual.";

  it("puts the refusal on the currency field of a new account", async () => {
    mocks.createAccount.mockRejectedValue(
      new CryptoCurrencyNotAllowedError("USDC"),
    );

    const result = await createAccountAction(formOf({ currency: "USDC" }));

    expect(result.status === "error" && result.fieldErrors).toEqual({
      currency: [MESSAGE],
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("puts the same refusal on the currency field of an edit", async () => {
    mocks.updateAccount.mockRejectedValue(
      new CryptoCurrencyNotAllowedError("BTC"),
    );

    const result = await updateAccountAction(
      "acc_1",
      formOf({ currency: "BTC" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      currency: [MESSAGE],
    });
  });
});
```

(Until Task 5 opens `currencyField`, "USDC" and "BTC" are refused by the schema before the service; these two tests therefore go green only in Task 5. To keep this task's boundary green, write them now with `currency: "USD"` in `formOf` and the same mocked rejection: the mapping is what they pin. Task 5, Step 1 changes them to "USDC" and "BTC".)

- [ ] **Step 4: Fix the fixtures so the suite compiles**

Add `kind: "ENTITY",` right after the `name:` of every bank object (an object with `name`, `archived` and, for boards, `accounts`; never an account) in:
`app/dashboard/banks/loadBanksView.test.ts` (1 bank), `components/Banks/Banks.test.tsx` (the 3 banks of `BANKS`), `components/Banks/components/AccountFormDrawer/AccountFormDrawer.test.tsx` (`CASH`, `GALICIA`), `components/Banks/components/AccountFormDrawer/utils.test.ts` (`BANK_A`, `BANK_B`), `components/Banks/components/BankFormDrawer/BankFormDrawer.test.tsx` (`WITH_ACTIVE_ACCOUNT`; the other two spread it), `components/Banks/components/BanksBoard/BanksBoard.test.tsx` (the 2 banks of `BANKS`), `components/Banks/components/BanksBoard/components/BankRow/BankRow.test.tsx` (`BANK`), `components/Banks/components/BanksBoard/components/BankRow/components/BankCell/BankCell.test.tsx` (`BANK`). In `core/banks/pageData.test.ts` (an untyped mock value) add `kind: "ENTITY",` too, for consistency. Use `rg -n "archived: (true|false)" <file>` to find them; an account object also has `bankId` and `currency`, a bank does not.

- [ ] **Step 5: Run the tests to see them fail**

Run: `npx vitest run core/banks core/accounts`
Expected: FAIL (`./kinds` does not exist; `bankInputSchema` drops `kind`; `BankHasCryptoAccountsError` and `CryptoCurrencyNotAllowedError` are not exported; `createBank` writes no kind; `updateBank` reads with `bank.findFirst` instead of the lock; `updateAccount` takes only the account lock; `activeBanks` drops the kind).

- [ ] **Step 6: Write the bank language**

In `core/banks/consts.ts`, add at the top `import type { BankKind } from "./types";`, replace `export const BANK_FORM_FIELDS = ["name"] as const;` with:

```ts
// ENTITY: a bank (or the cash), legal tender only. WALLET: a virtual wallet, which may also hold the
// crypto assets of the registry.
export const BANK_KINDS = ["ENTITY", "WALLET"] as const;

// What a new bank is when nobody says otherwise (and what the migration made every existing bank).
export const DEFAULT_BANK_KIND: BankKind = "ENTITY";

export const BANK_KIND_NAMES: Readonly<Record<BankKind, string>> = {
  ENTITY: "Entidad bancaria",
  WALLET: "Billetera virtual",
};

export const BANK_FORM_FIELDS = ["name", "kind"] as const;
```

and append:

```ts
export const BANK_KIND_REQUIRED_MESSAGE = "Elegí el tipo de banco.";

// Said under "Tipo" when a wallet that still has crypto accounts is asked to become an entity. Archived
// accounts count too, so archiving them does not help: they have to be deleted.
export const BANK_HAS_CRYPTO_ACCOUNTS_MESSAGE =
  "Este banco tiene cuentas cripto (archivadas incluidas). Eliminalas antes de pasarlo a entidad bancaria.";
```

In `core/banks/types.ts`, add `import type { BANK_KINDS } from "./consts";` and replace `BankInput` with:

```ts
export type BankKind = (typeof BANK_KINDS)[number];

// Validated bank data.
export interface BankInput {
  name: string;
  kind: BankKind;
}
```

Replace the whole of `core/banks/schema.ts` with:

```ts
import { z } from "zod";

import { requiredText } from "@/core/entries/fields";

import {
  BANK_KIND_REQUIRED_MESSAGE,
  BANK_KINDS,
  BANK_NAME_MAX_LENGTH,
} from "./consts";

// Trimmed, non-empty, at most 40 characters, and a kind the app knows (required on every submit, so a
// request that omits it never turns a wallet into an entity). Fields it does not know (an owner, an
// archive date) are dropped, so they can never reach the database through here.
export const bankInputSchema = z.object({
  name: requiredText("El nombre", BANK_NAME_MAX_LENGTH),
  kind: z.enum(BANK_KINDS, { error: BANK_KIND_REQUIRED_MESSAGE }),
});
```

Append to `core/banks/errors.ts`:

```ts
// A bank becomes an entity only when none of its accounts (archived ones included) is in a crypto
// currency.
export class BankHasCryptoAccountsError extends Error {
  constructor(readonly count: number) {
    super(`The bank still has ${count} crypto account(s)`);
    this.name = "BankHasCryptoAccountsError";
  }
}
```

Create `core/banks/kinds.ts`:

```ts
import {
  isLegalTenderCode,
  isSupportedCurrencyCode,
} from "@/core/incomes/money";

import type { BankKind } from "./types";

// An entity holds legal tender only; a virtual wallet also holds the crypto assets of the registry.
export const bankAcceptsCurrency = (
  kind: BankKind,
  currency: string,
): boolean =>
  kind === "WALLET"
    ? isSupportedCurrencyCode(currency)
    : isLegalTenderCode(currency);
```

In `core/banks/locks.ts`, add `import type { BankKind } from "./types";`, add `kind: BankKind;` to `LockedBank` (after `archivedAt`), change the comment's "and reads whether it is archived" to "and reads whether it is archived and its kind", and change the two SELECT lines to `SELECT "id", "archivedAt", "kind" FROM "Bank"` and `SELECT b."id", b."archivedAt", b."kind" FROM "Bank" AS b`.

In `core/banks/board.ts`, replace `activeBanks` with:

```ts
// The banks an account can be created in, with their kind (it decides the currencies on offer).
export const activeBanks = (banks: readonly BankWithAccounts[]): Bank[] =>
  banks
    .filter((bank) => !bank.archived)
    .map(({ id, name, kind, archived }) => ({ id, name, kind, archived }));
```

- [ ] **Step 7: Write the bank service**

In `core/banks/service.ts`:

- add `import { CRYPTO_CURRENCY_CODES } from "@/core/currencies/consts";` and `BankHasCryptoAccountsError` to the `./errors` import;
- `toBank` gains `kind: row.kind,` after `name: row.name,`;
- in `createBank`, `data: { userId, name: input.name }` becomes `data: { userId, name: input.name, kind: input.kind }`;
- replace the whole `updateBank` (and its comment) with:

```ts
// Renaming to another casing of its own name is fine; clashing with a different bank (ignoring case)
// is not. An entity never holds crypto: becoming one (or staying one) is refused while any account of
// the bank, archived ones included, is in a crypto currency; becoming a wallet is always fine. The bank
// row is locked for the whole check and write, and creating an account in it or changing the currency
// of one of its accounts takes the same lock, so no crypto account can slip in between the count and
// the write.
export const updateBank = async (
  userId: string,
  id: string,
  input: BankInput,
): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
      const locked = await lockBank(tx, userId, id);

      if (!locked) {
        throw new BankNotFoundError();
      }

      const duplicate = await tx.bank.findFirst({
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

      if (input.kind === "ENTITY") {
        const cryptoAccounts = await tx.account.count({
          where: {
            userId,
            bankId: id,
            currency: { in: [...CRYPTO_CURRENCY_CODES] },
          },
        });

        if (cryptoAccounts > 0) {
          throw new BankHasCryptoAccountsError(cryptoAccounts);
        }
      }

      const { count } = await tx.bank.updateMany({
        where: { id, userId },
        data: { name: input.name, kind: input.kind },
      });

      if (count === 0) {
        throw new BankNotFoundError();
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateBankError();
    }

    throw error;
  }
};
```

In `core/banks/actionHelpers.ts`: add `BANK_HAS_CRYPTO_ACCOUNTS_MESSAGE` to the `./consts` import, `BankHasCryptoAccountsError` to the `./errors` import, `ENTITY_LEGAL_TENDER_ONLY_MESSAGE` to the `@/core/accounts/consts` import and `CryptoCurrencyNotAllowedError` to the `@/core/accounts/errors` import, and insert into `toKnownFailure`, right after the `AccountCurrencyLockedError` branch:

```ts
if (error instanceof CryptoCurrencyNotAllowedError) {
  return fieldFailure({ currency: [ENTITY_LEGAL_TENDER_ONLY_MESSAGE] });
}

if (error instanceof BankHasCryptoAccountsError) {
  return fieldFailure({ kind: [BANK_HAS_CRYPTO_ACCOUNTS_MESSAGE] });
}
```

- [ ] **Step 8: Write the account rule**

Append to `core/accounts/consts.ts`:

```ts
// Said under "Moneda" when an entity bank's account is asked for a crypto currency.
export const ENTITY_LEGAL_TENDER_ONLY_MESSAGE =
  "Las entidades bancarias solo admiten monedas de curso legal. Usá una billetera virtual.";
```

Append to `core/accounts/errors.ts`:

```ts
// An entity bank holds legal tender only: a crypto currency needs a virtual wallet.
export class CryptoCurrencyNotAllowedError extends Error {
  constructor(readonly currency: string) {
    super(`An entity bank cannot hold ${currency}`);
    this.name = "CryptoCurrencyNotAllowedError";
  }
}
```

In `core/accounts/service.ts`:

- add `import { bankAcceptsCurrency } from "@/core/banks/kinds";` and `CryptoCurrencyNotAllowedError` to the `./errors` import;
- in `createAccount`, right after the `if (bank.archivedAt !== null) { … }` block, add:

```ts
// The kind is read under the same lock that archiving or retyping the bank takes.
if (!bankAcceptsCurrency(bank.kind, input.currency)) {
  throw new CryptoCurrencyNotAllowedError(input.currency);
}
```

and extend the comment above `createAccount` with: "An entity bank takes legal tender only; a wallet also takes crypto."

- replace the body of `updateAccount`'s transaction, from `const locked = await lockAccount(tx, userId, id);` through the currency check, with:

```ts
// The bank first, then the account: the same order as every other writer, so a change of the
// bank's kind and a change of this account's currency never interleave.
const bank = await lockBankOfAccount(tx, userId, id);

if (!bank) {
  throw new AccountNotFoundError();
}

const locked = await lockAccount(tx, userId, id);

if (!locked) {
  throw new AccountNotFoundError();
}

const current = await tx.account.findFirst({
  where: { id, userId },
  select: { id: true, bankId: true },
});

if (!current) {
  throw new AccountNotFoundError();
}

if (input.currency !== locked.currency) {
  if ((await countAccountMovements(tx, userId, id)) > 0) {
    throw new AccountCurrencyLockedError();
  }

  if (!bankAcceptsCurrency(bank.kind, input.currency)) {
    throw new CryptoCurrencyNotAllowedError(input.currency);
  }
}
```

(the duplicate check and the `updateMany` that follow stay as they are), and extend the comment above `updateAccount` with: "The bank row is locked first (its kind decides whether a crypto currency is allowed), then the account row."

- [ ] **Step 9: Run the task's tests to see them pass**

Run: `npx vitest run core/banks core/accounts app/dashboard/banks components/Banks`
Expected: PASS.

- [ ] **Step 10: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto core/banks core/accounts app/dashboard/banks/loadBanksView.test.ts components/Banks`.
Expected: all green. Then `rg -n '"kind"' core/banks/locks.ts` shows both SELECTs.

- [ ] **Step 11: Do NOT commit (the user commits only when asked); the controller snapshots. The controller now runs the GATE (Execution notes) before Task 5.**

---

### Task 5: Where crypto is allowed and where it is not (the validation boundary)

Runs after the gate. From here a crypto currency reaches the services; the account service (Task 4) keeps it out of entity banks.

**Files:**

- Modify: `core/entries/fields.ts`; create `core/entries/currencyFields.test.ts`
- Modify: `core/entries/query.ts`, `core/entries/query.test.ts`
- Modify: `core/entries/originFields.ts`, `core/incomes/schema.origin.test.ts`
- Modify: `core/reimbursements/fields.ts`, `core/expenses/schema.reimbursement.test.ts`
- Modify: `core/installments/schema.ts`, `core/installments/schema.test.ts`
- Modify: `core/cards/schema.ts`, `core/cards/schema.test.ts`, `core/cards/kinds.test.ts`
- Modify (tests): `core/accounts/schema.test.ts`, `core/balances/schema.test.ts`, `core/transfers/schema.test.ts`, `core/transfers/actions.test.ts`, `core/expenses/actions.test.ts`, `core/accounts/actions.test.ts`

**Interfaces:**

- Consumes: `isLegalTenderCode`, `isSupportedCurrencyCode`, `toMinorUnits`, `formatMoney` (`core/incomes/money.ts`); `insufficientFundsMessage` (`core/transfers/consts.ts`); `TransferInsufficientFundsError`, `ExpenseInsufficientFundsError`; `creditCard`, `debitCard` (`core/cards/testFixtures.ts`); `limitIn`, `cardCurrencies`, `debitAccountIn` (`core/cards/kinds.ts`).
- Produces (`core/entries/fields.ts`): `currencyField` (legal tender + crypto), new `legalTenderCurrencyField` (legal tender only, same messages), `checkAmount` validates every supported currency. `query.ts`, `originFields.ts`, `reimbursements/fields.ts` judge with `isSupportedCurrencyCode`; `installmentPlanSchema`, `incomeInstallmentPlanSchema` and the card caps use `legalTenderCurrencyField`.

- [ ] **Step 1: Write the failing tests**

Create `core/entries/currencyFields.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  checkAmount,
  currencyField,
  legalTenderCurrencyField,
  toAmount,
} from "./fields";

const UNSUPPORTED = "Selecciona una moneda compatible.";

const amountSchema = z
  .object({ amount: z.string(), currency: currencyField })
  .superRefine((value, ctx) => {
    checkAmount(value, ctx);
  })
  .transform(toAmount);

const issuesOf = (input: unknown): string[] => {
  const result = amountSchema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
};

describe("currencyField", () => {
  it.each(["ARS", "USD", "JPY"])("accepts the legal tender %s", (code) => {
    expect(currencyField.safeParse(code).success).toBe(true);
  });

  it.each(["USDC", "BTC", "XMR"])("accepts the crypto asset %s too", (code) => {
    expect(currencyField.safeParse(code).success).toBe(true);
  });

  it.each(["ZZZ", "usdc", "", "XRP"])("refuses %j", (code) => {
    expect(currencyField.safeParse(code).error?.issues[0].message).toBe(
      UNSUPPORTED,
    );
  });
});

describe("legalTenderCurrencyField", () => {
  it("accepts legal tender", () => {
    expect(legalTenderCurrencyField.safeParse("ARS").success).toBe(true);
  });

  it.each(["USDC", "BTC"])(
    "refuses the crypto asset %s with the usual message",
    (code) => {
      expect(
        legalTenderCurrencyField.safeParse(code).error?.issues[0].message,
      ).toBe(UNSUPPORTED);
    },
  );
});

describe("checkAmount with a crypto currency", () => {
  it("turns up to 6 decimals into millionths", () => {
    expect(amountSchema.parse({ amount: "1.5", currency: "USDC" })).toBe(
      1500000,
    );
    expect(amountSchema.parse({ amount: "0.000001", currency: "BTC" })).toBe(1);
  });

  it("refuses a seventh decimal on the amount instead of skipping the check", () => {
    expect(issuesOf({ amount: "1.1234567", currency: "USDC" })).toEqual([
      "amount: Ingresa un monto válido, con dígitos y un punto para los decimales.",
    ]);
  });

  it("refuses zero", () => {
    expect(issuesOf({ amount: "0", currency: "ETH" })).toEqual([
      "amount: El monto debe ser mayor que cero.",
    ]);
  });
});
```

Append to `core/entries/query.test.ts` (inside the `describe` that has the `"ZZZ"` currency test):

```ts
it("keeps a crypto currency filter, upper-cased like any other", () => {
  expect(parseEntriesQuery({ currency: "usdc" }).currency).toBe("USDC");
  expect(parseEntriesQuery({ currency: "BTC" }).currency).toBe("BTC");
});
```

Append to `describe("incomeInputSchema origin", …)` of `core/incomes/schema.origin.test.ts`:

```ts
it("checks the origin of an income in a crypto currency like any other", () => {
  const usdc = { ...validInput, currency: "USDC", amount: "10" };

  expect(
    incomeInputSchema.safeParse({
      ...usdc,
      originCurrency: "ARS",
      originAmount: "12500",
    }).data,
  ).toMatchObject({
    currency: "USDC",
    amount: 10000000,
    originCurrency: "ARS",
    originAmount: 1250000,
  });
  expect(
    fieldErrors({ ...usdc, originCurrency: "ARS", originAmount: "1.234" }),
  ).toEqual({ originAmount: [INVALID_AMOUNT] });
  expect(
    fieldErrors({ ...usdc, originCurrency: "USDC", originAmount: "10" }),
  ).toEqual({ originCurrency: [MISSING_CURRENCY] });
});
```

Append to `describe("expenseInputSchema expected reimbursement", …)` of `core/expenses/schema.reimbursement.test.ts`:

```ts
it("checks a reimbursement in a crypto currency instead of skipping it", () => {
  const usdc = { currency: "USDC", amount: "10" };

  expect(
    parse({ ...usdc, expectedReimbursement: "1.5" }).data
      ?.expectedReimbursement,
  ).toBe(1500000);
  expect(
    messages(
      { ...usdc, expectedReimbursement: "1.1234567" },
      "expectedReimbursement",
    ),
  ).toEqual([EXPECTED_REIMBURSEMENT_MESSAGE]);
});
```

Append to `describe("installmentPlanSchema", …)` of `core/installments/schema.test.ts`:

```ts
it("refuses a purchase in a crypto currency, on the currency only: installments are legal tender", () => {
  expect(errorPaths({ ...validInput, currency: "USDC" })).toEqual(["currency"]);
  expect(errorPaths({ ...validInput, currency: "USD" })).toEqual([]);
});
```

and, inside `describe("incomeInstallmentPlanSchema", …)` (after `repaymentErrorPaths`):

```ts
it("refuses a repayment in a crypto currency, on the currency only", () => {
  expect(repaymentErrorPaths({ ...validRepayment, currency: "BTC" })).toEqual([
    "currency",
  ]);
  expect(repaymentErrorPaths(validRepayment)).toEqual([]);
});
```

Append to `describe("a credit card", …)` of `core/cards/schema.test.ts`:

```ts
it("refuses a cap in a crypto currency, on its row: caps are legal tender", () => {
  expect(
    errorsOf(credit({ limits: [{ currency: "USDC", amount: "10" }] })),
  ).toEqual({ "limits.0.currency": ["Selecciona una moneda compatible."] });
  expect(
    parseCardInput(credit({ limits: [{ currency: "USD", amount: "10" }] }))
      .success,
  ).toBe(true);
});
```

Append to `core/cards/kinds.test.ts` (it already imports `creditCard`, `debitCard`, `limitIn`, `cardCurrencies`; add `debitAccountIn` to the `./kinds` import if it is missing):

```ts
describe("cards and crypto currencies", () => {
  const WALLET_DEBIT = debitCard({
    bankName: "Mercado Pago",
    accounts: [
      { id: "acc_ars", currency: "ARS", label: "Mercado Pago · Pesos" },
      { id: "acc_usdc", currency: "USDC", label: "Mercado Pago · USDC" },
    ],
  });

  it("lets a wallet's debit card pay in the crypto currency of its accounts", () => {
    expect(cardCurrencies(WALLET_DEBIT)).toEqual(["ARS", "USDC"]);
    expect(debitAccountIn(WALLET_DEBIT, "USDC")?.id).toBe("acc_usdc");
  });

  it("never lets a credit card cover a crypto currency: it has no cap in one", () => {
    expect(limitIn(creditCard(), "ARS")).not.toBeNull();
    expect(limitIn(creditCard(), "USDC")).toBeNull();
  });
});
```

(These two are characterizations: Task 2 already made them true; they pin D5.)

Append to `describe("accountInputSchema", …)` of `core/accounts/schema.test.ts`:

```ts
it("accepts a crypto currency: whether the bank may hold it is the service's call", () => {
  expect(accountInputSchema.parse({ name: "USDC", currency: "USDC" })).toEqual({
    name: "USDC",
    currency: "USDC",
  });
});
```

Append to `describe("openingBalanceInputSchema", …)` of `core/balances/schema.test.ts`:

```ts
it("turns the amount of a crypto account into millionths", () => {
  expect(
    openingBalanceInputSchema.parse({
      month: "2026-06",
      balances: [row("acc_usdc", "USDC", "1.5")],
    }).amounts,
  ).toEqual([{ accountId: "acc_usdc", currency: "USDC", amount: 1500000 }]);
});
```

Append to `describe("transferInputSchema", …)` of `core/transfers/schema.test.ts`:

```ts
it("parses a transfer in a crypto currency in millionths", () => {
  expect(parse({ currency: "USDC", amount: "1.5" })).toMatchObject({
    success: true,
    data: { currency: "USDC", amount: 1500000 },
  });
  expect(errorsOf({ currency: "USDC", amount: "1.1234567" }).amount).toEqual([
    "Ingresa un monto válido, con dígitos y un punto para los decimales.",
  ]);
});
```

Append to `core/transfers/actions.test.ts` (it already has `formOf`, `mocks`, `createTransferAction`, `TransferInsufficientFundsError`, `insufficientFundsMessage` and `formatMoney` imported; add any that are missing):

```ts
describe("a transfer in a crypto currency", () => {
  it("hands the service the amount in millionths", async () => {
    mocks.createTransfer.mockResolvedValue(undefined);

    await createTransferAction(formOf({ currency: "USDC", amount: "1.5" }));

    expect(mocks.createTransfer.mock.calls[0][1]).toMatchObject({
      currency: "USDC",
      amount: 1500000,
    });
  });

  it("says what the source held in its own currency", async () => {
    mocks.createTransfer.mockRejectedValue(
      new TransferInsufficientFundsError(1500000, "USDC"),
    );

    expect(
      await createTransferAction(formOf({ currency: "USDC", amount: "2" })),
    ).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { amount: [insufficientFundsMessage("1,50 USDC")] },
    });
  });
});
```

Append to `core/expenses/actions.test.ts`:

```ts
describe("an expense in a crypto currency", () => {
  it("hands the service the amount in millionths", async () => {
    mocks.createExpense.mockResolvedValue({ id: "exp_1" });

    await createExpenseAction(
      buildFormData({ currency: "USDC", amount: "1.5" }),
    );

    expect(mocks.createExpense.mock.calls[0][1]).toMatchObject({
      currency: "USDC",
      amount: 1500000,
    });
  });

  it("says what a wallet's account held when its debit card cannot cover the expense", async () => {
    mocks.createExpense.mockRejectedValue(
      new ExpenseInsufficientFundsError(1500000, "USDC"),
    );

    const result = await createExpenseAction(
      buildFormData({ currency: "USDC", amount: "2" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      amount: [
        "La cuenta no tiene fondos suficientes para este gasto: tenía 1,50 USDC.",
      ],
    });
  });
});
```

In `core/accounts/actions.test.ts`, in the two tests added by Task 4 under `describe("a crypto currency in an entity bank", …)`, change `formOf({ currency: "USD" })` to `formOf({ currency: "USDC" })` in the first and to `formOf({ currency: "BTC" })` in the second.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run core/entries core/incomes/schema.origin.test.ts core/expenses core/installments/schema.test.ts core/cards core/accounts core/balances/schema.test.ts core/transfers`
Expected: FAIL (`legalTenderCurrencyField` is not exported; "USDC", "BTC" and "XMR" are refused as currencies by every schema and by the list filter; the crypto actions return field errors on `currency` instead of reaching the service). The two `core/cards/kinds.test.ts` tests pass already (characterization).

- [ ] **Step 3: Open the boundary where crypto belongs**

In `core/entries/fields.ts`, change the money import to `import { isLegalTenderCode, isSupportedCurrencyCode, toMinorUnits } from "@/core/incomes/money";`, change the header comment to:

```ts
// Field definitions shared by incomes and expenses (and their recurring templates), transfers,
// accounts and opening balances. `currencyField` takes any currency an account can hold (legal tender
// or a crypto asset; whether a given account may is the account service's call);
// `legalTenderCurrencyField` is for what can never be crypto (a credit card cap, a plan in installments).
```

and replace `currencyField` with:

```ts
const UNSUPPORTED_CURRENCY_MESSAGE = "Selecciona una moneda compatible.";

export const currencyField = z
  .string({ error: "La moneda es obligatoria." })
  .refine(isSupportedCurrencyCode, UNSUPPORTED_CURRENCY_MESSAGE);

export const legalTenderCurrencyField = z
  .string({ error: "La moneda es obligatoria." })
  .refine(isLegalTenderCode, UNSUPPORTED_CURRENCY_MESSAGE);
```

and in `checkAmount`, `if (!isLegalTenderCode(value.currency)) {` becomes `if (!isSupportedCurrencyCode(value.currency)) {`.

In `core/entries/query.ts`: `import { isLegalTenderCode } from "@/core/incomes/money";` → `import { isSupportedCurrencyCode } from "@/core/incomes/money";` and `.refine(isLegalTenderCode)` → `.refine(isSupportedCurrencyCode)`.

In `core/entries/originFields.ts`: `isLegalTenderCode` → `isSupportedCurrencyCode` (import and the one use).

In `core/reimbursements/fields.ts`: `isLegalTenderCode` → `isSupportedCurrencyCode` (import and the one use).

- [ ] **Step 4: Keep crypto out of credit caps and installments**

In `core/installments/schema.ts`: in the `@/core/entries/fields` import, replace `currencyField,` with `legalTenderCurrencyField,`; in both `installmentPlanSchema` and `incomeInstallmentPlanSchema`, `currency: currencyField,` becomes `currency: legalTenderCurrencyField,`. (`checkTotalAndLastMonth` keeps `isLegalTenderCode`.)

In `core/cards/schema.ts`: in the `@/core/entries/fields` import, replace `currencyField,` with `legalTenderCurrencyField,`, and in `limitRowField`, `currency: currencyField,` becomes `currency: legalTenderCurrencyField,`; change its comment to `// One cap as the form sends it: a legal-tender currency and the amount typed in it (a credit card never has a crypto cap).`

- [ ] **Step 5: Run the task's tests to see them pass**

Run: `npx vitest run core components/Entries components/Cards components/Expenses components/Incomes components/Transfers`
Expected: PASS.

- [ ] **Step 6: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto core/entries/fields.ts core/entries/currencyFields.test.ts core/entries/query.ts core/entries/query.test.ts core/entries/originFields.ts core/incomes/schema.origin.test.ts core/reimbursements/fields.ts core/expenses/schema.reimbursement.test.ts core/expenses/actions.test.ts core/installments/schema.ts core/installments/schema.test.ts core/cards/schema.ts core/cards/schema.test.ts core/cards/kinds.test.ts core/accounts/schema.test.ts core/accounts/actions.test.ts core/balances/schema.test.ts core/transfers/schema.test.ts core/transfers/actions.test.ts`.
Expected: all green. Then `rg -n "currencyField" core --glob '!*.test.*'` shows `currencyField` only in incomes, expenses (both schemas), transfers, accounts and balances, and `legalTenderCurrencyField` only in installments and cards.

- [ ] **Step 7: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 6: The Banks page: "Tipo" in the bank drawer, the "Billetera" chip, and the account drawer's currencies by kind

**Files:**

- Create: `components/Entries/components/CurrencyListBox/CurrencyListBox.tsx`, `consts.ts`, `types.ts`, `index.ts`, `CurrencyListBox.test.tsx`
- Create: `components/Banks/components/BankFormDrawer/components/KindField/KindField.tsx`, `consts.ts`, `types.ts`, `index.ts`
- Modify: `components/Banks/components/BankFormDrawer/BankFormContent.tsx`, `consts.ts`, `BankFormDrawer.test.tsx`
- Modify: `components/Banks/components/BanksBoard/components/BankRow/components/BankCell/BankCell.tsx`, `consts.ts`, `styles.ts`, `BankCell.test.tsx`
- Modify: `components/Banks/components/AccountFormDrawer/AccountFormContent.tsx`, `utils.ts`, `utils.test.ts`, `AccountFormDrawer.test.tsx`

**Interfaces:**

- Consumes: `CURRENCY_OPTIONS`, `CRYPTO_CURRENCY_OPTIONS` (`components/Entries/currencyOptions.ts`); `BANK_KIND_NAMES`, `DEFAULT_BANK_KIND` (`core/banks/consts.ts`); `Bank`, `BankKind` (`core/banks/types.ts`); `isCryptoCode` (`core/currencies/crypto.ts`); `DEFAULT_CURRENCY_CODE`; `FIELD_CLASS_NAME` (`components/Entries/styles.ts`).
- Produces:
  - `CurrencyListBox({ includeCrypto }: CurrencyListBoxProps)`: the `ListBox` inside a currency `Select.Popover`; legal tender only, or a "Monedas" section plus a "Criptomonedas" section after it.
  - `KindField({ defaultValue }: KindFieldProps)` (bank drawer): radio group "Tipo" submitting `kind`.
  - `editBankLabel({ name, kind, archived })` names a wallet; `WALLET_BANK_LABEL = "Billetera"`.
  - `components/Banks/components/AccountFormDrawer/utils.ts`: `kindOfBank(bankId: string | null, banks: readonly Bank[]): BankKind`, `offersCrypto(kind: BankKind, currency: string): boolean`, `currencyForKind(currency: string, kind: BankKind): string`.

- [ ] **Step 1: Read the HeroUI docs and the components to copy**

Read `.heroui-docs/react/components/(pickers)/select.mdx`, `(collections)/list-box.mdx` (sections), `(forms)/radio-group.mdx` (uncontrolled `defaultValue`, `name`, `FieldError`) and `(data-display)/chip.mdx`. Copy from: the sectioned `ListBox` of `components/Entries/components/OriginSection/OriginSection.tsx`, the radio group of `components/Cards/components/CardFormDrawer/components/KindField/KindField.tsx`, and the `Chip` of `BankCell.tsx`.

- [ ] **Step 2: Write the failing tests**

Create `components/Entries/components/CurrencyListBox/CurrencyListBox.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Label, Select } from "@heroui/react";
import { describe, expect, it } from "vitest";

import { CRYPTO_CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";

import { CurrencyListBox } from "./CurrencyListBox";

const CRYPTO_LABELS = CRYPTO_CURRENCY_OPTIONS.map(({ label }) => label);

const openWith = async (includeCrypto: boolean) => {
  render(
    <Select defaultValue="ARS">
      <Label>Moneda</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <CurrencyListBox includeCrypto={includeCrypto} />
      </Select.Popover>
    </Select>,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: /Moneda$/ }), {
    key: "ArrowDown",
  });

  const listbox = await screen.findByRole("listbox");

  return {
    listbox,
    options: within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? ""),
  };
};

describe("CurrencyListBox", () => {
  it("lists only legal tender when the field takes no crypto", async () => {
    const { listbox, options } = await openWith(false);

    expect(options[0]).toMatch(/^ARS - /);
    expect(options.some((option) => option.startsWith("USD - "))).toBe(true);
    expect(options.some((option) => CRYPTO_LABELS.includes(option))).toBe(
      false,
    );
    expect(within(listbox).queryByText("Criptomonedas")).toBeNull();
  });

  it("adds the crypto currencies after the legal tender ones, under 'Criptomonedas'", async () => {
    const { listbox, options } = await openWith(true);

    expect(within(listbox).getByText("Monedas")).toBeInTheDocument();
    expect(within(listbox).getByText("Criptomonedas")).toBeInTheDocument();
    expect(options[0]).toMatch(/^ARS - /);
    expect(CRYPTO_LABELS).toHaveLength(10);
    expect(options.slice(-CRYPTO_LABELS.length)).toEqual(CRYPTO_LABELS);
    expect(
      options
        .slice(0, -CRYPTO_LABELS.length)
        .some((option) => CRYPTO_LABELS.includes(option)),
    ).toBe(false);
  });
});
```

Replace the whole of `components/Banks/components/AccountFormDrawer/utils.test.ts` with (the old `pickDefaultBankId` cases are kept):

```ts
import { describe, expect, it } from "vitest";

import type { Bank } from "@/core/banks/types";

import {
  currencyForKind,
  kindOfBank,
  offersCrypto,
  pickDefaultBankId,
} from "./utils";

const BANK_A: Bank = {
  id: "a",
  name: "Efectivo",
  kind: "ENTITY",
  archived: false,
};
const BANK_B: Bank = {
  id: "b",
  name: "Banco Galicia",
  kind: "ENTITY",
  archived: false,
};
const WALLET: Bank = {
  id: "w",
  name: "Mercado Pago",
  kind: "WALLET",
  archived: false,
};

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

describe("kindOfBank", () => {
  it("is the kind of the bank chosen", () => {
    expect(kindOfBank("w", [BANK_A, WALLET])).toBe("WALLET");
    expect(kindOfBank("a", [BANK_A, WALLET])).toBe("ENTITY");
  });

  it("is an entity when no bank is chosen or the bank is not among them", () => {
    expect(kindOfBank(null, [WALLET])).toBe("ENTITY");
    expect(kindOfBank("gone", [WALLET])).toBe("ENTITY");
  });
});

describe("offersCrypto", () => {
  it("offers the crypto currencies for a wallet", () => {
    expect(offersCrypto("WALLET", "ARS")).toBe(true);
  });

  it("offers them for an account that already holds one, so its currency always shows", () => {
    expect(offersCrypto("ENTITY", "USDC")).toBe(true);
  });

  it("does not offer them for an entity in legal tender", () => {
    expect(offersCrypto("ENTITY", "ARS")).toBe(false);
  });
});

describe("currencyForKind", () => {
  it("goes back to pesos when a crypto currency was chosen and the bank is an entity", () => {
    expect(currencyForKind("USDC", "ENTITY")).toBe("ARS");
  });

  it("keeps a legal-tender currency for an entity, and anything for a wallet", () => {
    expect(currencyForKind("USD", "ENTITY")).toBe("USD");
    expect(currencyForKind("USDC", "WALLET")).toBe("USDC");
  });
});
```

Append to `components/Banks/components/AccountFormDrawer/AccountFormDrawer.test.tsx`:

```tsx
describe("the currencies by kind of bank", () => {
  const WALLET: Bank = {
    id: "bank_mp",
    name: "Mercado Pago",
    kind: "WALLET",
    archived: false,
  };
  const BANKS_WITH_WALLET = [CASH, GALICIA, WALLET];
  const MESSAGE =
    "Las entidades bancarias solo admiten monedas de curso legal. Usá una billetera virtual.";

  const openCurrencies = async () => {
    fireEvent.keyDown(currencyTrigger(), { key: "ArrowDown" });

    return screen.findByRole("listbox");
  };

  const pickCurrency = async (name: string) => {
    fireEvent.keyDown(currencyTrigger(), { key: "ArrowDown" });

    const option = await screen.findByRole("option", { name });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });
  };

  it("offers only legal tender in an entity bank", async () => {
    renderForm(
      { key: 1, account: null, bankId: "bank_galicia" },
      BANKS_WITH_WALLET,
    );

    const listbox = await openCurrencies();

    expect(
      within(listbox).getByRole("option", { name: /^USD - / }),
    ).toBeInTheDocument();
    expect(
      within(listbox).queryByRole("option", { name: "USDC - USD Coin" }),
    ).toBeNull();
    expect(within(listbox).queryByText("Criptomonedas")).toBeNull();
  });

  it("adds the crypto currencies, in a group of their own, in a virtual wallet", async () => {
    renderForm({ key: 1, account: null, bankId: "bank_mp" }, BANKS_WITH_WALLET);

    const listbox = await openCurrencies();

    expect(within(listbox).getByText("Criptomonedas")).toBeInTheDocument();
    expect(
      within(listbox).getByRole("option", { name: "USDC - USD Coin" }),
    ).toBeInTheDocument();
    expect(
      within(listbox).getByRole("option", { name: /^USD - / }),
    ).toBeInTheDocument();
  });

  it("sends a crypto currency for a wallet's new account", async () => {
    actions.createAccountAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(
      { key: 1, account: null, bankId: "bank_mp" },
      BANKS_WITH_WALLET,
    );

    fireEvent.change(nameInput(), { target: { value: "USDC" } });
    await pickCurrency("USDC - USD Coin");
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentForm(actions.createAccountAction).get("currency")).toBe("USDC");
    expect(sentForm(actions.createAccountAction).get("bankId")).toBe("bank_mp");
  });

  it("goes back to pesos when a crypto currency was chosen and the bank changes to an entity", async () => {
    renderForm({ key: 1, account: null, bankId: "bank_mp" }, BANKS_WITH_WALLET);

    await pickCurrency("USDC - USD Coin");

    expect(currencyTrigger()).toHaveTextContent("USDC - USD Coin");

    await pickBank("Banco Galicia");

    expect(currencyTrigger()).toHaveTextContent("ARS");
    expect(currencyTrigger()).not.toHaveTextContent("USDC");
  });

  it("keeps a legal-tender currency when the bank changes", async () => {
    renderForm({ key: 1, account: null, bankId: "bank_mp" }, BANKS_WITH_WALLET);

    fireEvent.keyDown(currencyTrigger(), { key: "ArrowDown" });

    const dollars = await screen.findByRole("option", { name: /^USD - / });

    fireEvent.keyDown(dollars, { key: "Enter" });
    fireEvent.keyUp(dollars, { key: "Enter" });
    await pickBank("Banco Galicia");

    expect(currencyTrigger()).toHaveTextContent("USD - ");
  });

  it("shows the crypto currency of an account being edited", () => {
    renderForm(
      edit({
        ...ACCOUNT,
        bankId: "bank_mp",
        name: "USDC",
        currency: "USDC",
        balanceLabel: "0,00 USDC",
      }),
      BANKS_WITH_WALLET,
    );

    expect(currencyTrigger()).toHaveTextContent("USDC - USD Coin");
  });

  it("shows the server's refusal of a crypto currency under Moneda, and stays open", async () => {
    actions.createAccountAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { currency: [MESSAGE] },
    });
    const { onClose } = renderForm(
      { key: 1, account: null, bankId: "bank_mp" },
      BANKS_WITH_WALLET,
    );

    fireEvent.change(nameInput(), { target: { value: "USDC" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText(MESSAGE)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

Append to `components/Banks/components/BankFormDrawer/BankFormDrawer.test.tsx`:

```tsx
describe("the kind of bank", () => {
  const MESSAGE =
    "Este banco tiene cuentas cripto (archivadas incluidas). Eliminalas antes de pasarlo a entidad bancaria.";
  const kindGroup = () => screen.getByRole("radiogroup", { name: "Tipo" });

  it("asks whether it is a bank entity or a virtual wallet, and starts a new bank as an entity", () => {
    renderForm(CREATE);

    expect(
      within(kindGroup())
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual([
      expect.stringContaining("Entidad bancaria"),
      expect.stringContaining("Billetera virtual"),
    ]);
    expect(
      screen.getByRole("radio", { name: /Entidad bancaria/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Billetera virtual/ }),
    ).not.toBeChecked();
  });

  it("sends an entity when the kind is left alone", async () => {
    actions.createBankAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CREATE);

    fireEvent.change(nameInput(), { target: { value: "Banco Galicia" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear banco" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentForm(actions.createBankAction).get("kind")).toBe("ENTITY");
  });

  it("sends a virtual wallet when it is chosen", async () => {
    actions.createBankAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CREATE);

    fireEvent.change(nameInput(), { target: { value: "Mercado Pago" } });
    fireEvent.click(screen.getByRole("radio", { name: /Billetera virtual/ }));
    fireEvent.click(screen.getByRole("button", { name: "Crear banco" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentForm(actions.createBankAction).get("kind")).toBe("WALLET");
  });

  it("starts an edit on the bank's own kind", () => {
    renderForm(edit({ ...WITH_ACTIVE_ACCOUNT, kind: "WALLET" }));

    expect(
      screen.getByRole("radio", { name: /Billetera virtual/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Entidad bancaria/ }),
    ).not.toBeChecked();
  });

  it("shows under Tipo the refusal to make a wallet with crypto accounts an entity, and stays open", async () => {
    actions.updateBankAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { kind: [MESSAGE] },
    });
    const { onClose } = renderForm(
      edit({ ...WITH_ACTIVE_ACCOUNT, kind: "WALLET" }),
    );

    fireEvent.click(screen.getByRole("radio", { name: /Entidad bancaria/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(MESSAGE)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    expect(sentForm(actions.updateBankAction, 1).get("kind")).toBe("ENTITY");
  });
});
```

Append to `describe("BankCell", …)` of `components/Banks/components/BanksBoard/components/BankRow/components/BankCell/BankCell.test.tsx`:

```tsx
it("marks a virtual wallet with a chip and in its accessible name, and only a wallet", () => {
  const { rerender } = render(
    <BankCell
      bank={{ ...BANK, name: "Mercado Pago", kind: "WALLET" }}
      onEdit={vi.fn()}
    />,
  );

  expect(
    screen.getByRole("button", {
      name: "Editar banco Mercado Pago, billetera virtual",
    }),
  ).toHaveTextContent("Billetera");

  rerender(<BankCell bank={BANK} onEdit={vi.fn()} />);

  expect(cell()).not.toHaveTextContent("Billetera");
});

it("says both for an archived wallet, with both chips under the name", () => {
  render(
    <BankCell
      bank={{ ...BANK, name: "Mercado Pago", kind: "WALLET", archived: true }}
      onEdit={vi.fn()}
    />,
  );

  const walletCell = screen.getByRole("button", {
    name: "Editar banco Mercado Pago, billetera virtual, archivado",
  });

  expect(
    Array.from(walletCell.children).map((child) => child.textContent),
  ).toEqual(["Mercado Pago", "BilleteraArchivado"]);
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run components/Entries/components/CurrencyListBox components/Banks`
Expected: FAIL (`./CurrencyListBox` does not exist; `kindOfBank`, `offersCrypto`, `currencyForKind` are not exported; the drawer has no "Tipo" group and no crypto group; the cell has no chip).

- [ ] **Step 4: Write `CurrencyListBox`**

Create `components/Entries/components/CurrencyListBox/consts.ts`:

```ts
// The headings of the two groups, when the crypto currencies are on offer.
export const LEGAL_TENDER_SECTION_LABEL = "Monedas";
export const CRYPTO_SECTION_LABEL = "Criptomonedas";
```

Create `components/Entries/components/CurrencyListBox/types.ts`:

```ts
export interface CurrencyListBoxProps {
  // Whether the field takes a crypto currency too (an entry, a transfer, a wallet's account).
  includeCrypto: boolean;
}
```

Create `components/Entries/components/CurrencyListBox/index.ts`:

```ts
export { CurrencyListBox } from "./CurrencyListBox";
```

Create `components/Entries/components/CurrencyListBox/CurrencyListBox.tsx`:

```tsx
import { Header, ListBox, Separator } from "@heroui/react";

import {
  CRYPTO_CURRENCY_OPTIONS,
  CURRENCY_OPTIONS,
} from "@/components/Entries/currencyOptions";

import { CRYPTO_SECTION_LABEL, LEGAL_TENDER_SECTION_LABEL } from "./consts";
import type { CurrencyListBoxProps } from "./types";

// The list inside a currency Select: the legal-tender currencies, and, where the field takes them, the
// crypto assets in a group of their own after them. Credit card caps and the planners never pass
// `includeCrypto`.
export function CurrencyListBox({ includeCrypto }: CurrencyListBoxProps) {
  if (!includeCrypto) {
    return (
      <ListBox>
        {CURRENCY_OPTIONS.map(({ code, label }) => (
          <ListBox.Item key={code} id={code} textValue={label}>
            {label}
            <ListBox.ItemIndicator />
          </ListBox.Item>
        ))}
      </ListBox>
    );
  }

  return (
    <ListBox>
      <ListBox.Section>
        <Header>{LEGAL_TENDER_SECTION_LABEL}</Header>
        {CURRENCY_OPTIONS.map(({ code, label }) => (
          <ListBox.Item key={code} id={code} textValue={label}>
            {label}
            <ListBox.ItemIndicator />
          </ListBox.Item>
        ))}
      </ListBox.Section>
      <Separator />
      <ListBox.Section>
        <Header>{CRYPTO_SECTION_LABEL}</Header>
        {CRYPTO_CURRENCY_OPTIONS.map(({ code, label }) => (
          <ListBox.Item key={code} id={code} textValue={label}>
            {label}
            <ListBox.ItemIndicator />
          </ListBox.Item>
        ))}
      </ListBox.Section>
    </ListBox>
  );
}
```

- [ ] **Step 5: Write the bank drawer's "Tipo"**

Create `components/Banks/components/BankFormDrawer/components/KindField/types.ts`:

```ts
import type { BankKind } from "@/core/banks/types";

export interface KindFieldProps {
  // The kind the radio group starts on: the bank's own on an edit, an entity for a new bank.
  defaultValue: BankKind;
}

export interface KindOption {
  value: BankKind;
  label: string;
  hint: string;
}
```

Create `components/Banks/components/BankFormDrawer/components/KindField/consts.ts`:

```ts
import { BANK_KIND_NAMES } from "@/core/banks/consts";

import type { KindOption } from "./types";

export const KIND_LABEL = "Tipo";

// The field name the form submits the kind under.
export const KIND_FIELD_NAME = "kind";

// In the order the radios appear.
export const KIND_OPTIONS: readonly KindOption[] = [
  {
    value: "ENTITY",
    label: BANK_KIND_NAMES.ENTITY,
    hint: "Un banco o el efectivo: solo monedas de curso legal (ARS, USD, EUR…).",
  },
  {
    value: "WALLET",
    label: BANK_KIND_NAMES.WALLET,
    hint: "Mercado Pago, AstroPay y similares: también criptomonedas (USDC, USDT, BTC…).",
  },
];
```

Create `components/Banks/components/BankFormDrawer/components/KindField/index.ts`:

```ts
export { KindField } from "./KindField";
```

Create `components/Banks/components/BankFormDrawer/components/KindField/KindField.tsx`:

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

// A bank entity or a virtual wallet. Nothing else in the form depends on it, so it is uncontrolled;
// the server's refusal to make a wallet with crypto accounts an entity shows under it.
export function KindField({ defaultValue }: KindFieldProps) {
  return (
    <RadioGroup
      className={FIELD_CLASS_NAME}
      name={KIND_FIELD_NAME}
      variant="secondary"
      defaultValue={defaultValue}
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

In `components/Banks/components/BankFormDrawer/BankFormContent.tsx`: add `import { DEFAULT_BANK_KIND } from "@/core/banks/consts";` (merge with the existing `BANK_NAME_MAX_LENGTH` import) and `import { KindField } from "./components/KindField";` (after the `../ConfirmDeleteDialog` import), and insert, right after the closing `</TextField>` of the name:

```tsx
<KindField defaultValue={bank?.kind ?? DEFAULT_BANK_KIND} />
```

If the test "shows under Tipo the refusal…" stays red because the `RadioGroup` does not pick up the `Form`'s `validationErrors` for `kind`, give `KindField` an `errorMessage?: string` prop (add it to `KindFieldProps`), pass `fieldErrors.kind?.[0]` from `BankFormContent`, and set `isInvalid={Boolean(errorMessage)}` on the `RadioGroup` with `<FieldError>{errorMessage}</FieldError>`, exactly as `components/Cards/components/CardFormDrawer/components/BankField` receives its `errorMessage`.

In `components/Banks/components/BankFormDrawer/consts.ts`, change `EDIT_DESCRIPTION` to `"Actualizá el nombre o el tipo de este banco."`.

- [ ] **Step 6: Write the chip**

In `components/Banks/components/BanksBoard/components/BankRow/components/BankCell/consts.ts`, replace everything below `export const ARCHIVED_BANK_LABEL = "Archivado";` with:

```ts
export const WALLET_BANK_LABEL = "Billetera";

// The accessible name replaces the visible chips, so it carries whether the bank is a virtual wallet
// and whether it is archived.
export const editBankLabel = ({
  name,
  kind,
  archived,
}: Pick<Bank, "name" | "kind" | "archived">): string =>
  `Editar banco ${name}${kind === "WALLET" ? ", billetera virtual" : ""}${archived ? ", archivado" : ""}`;
```

Append to `.../BankCell/styles.ts`:

```ts
// The chips under the name (a wallet, archived), side by side and wrapping on a narrow card.
export const CHIPS_CLASS_NAME = "flex flex-wrap justify-center gap-1";
```

In `.../BankCell/BankCell.tsx`: import `WALLET_BANK_LABEL` and `CHIPS_CLASS_NAME`, and replace the `{bank.archived ? (<Chip …>{ARCHIVED_BANK_LABEL}</Chip>) : null}` block with:

```tsx
{
  bank.kind === "WALLET" || bank.archived ? (
    <span className={CHIPS_CLASS_NAME}>
      {bank.kind === "WALLET" ? (
        <Chip size="sm" variant="soft">
          {WALLET_BANK_LABEL}
        </Chip>
      ) : null}
      {bank.archived ? (
        <Chip size="sm" variant="soft">
          {ARCHIVED_BANK_LABEL}
        </Chip>
      ) : null}
    </span>
  ) : null;
}
```

and change the comment above the component to mention that the card shows a "Billetera" chip for a virtual wallet.

- [ ] **Step 7: Write the account drawer's currencies by kind**

Append to `components/Banks/components/AccountFormDrawer/utils.ts` (and add `import { DEFAULT_BANK_KIND } from "@/core/banks/consts";`, `import type { BankKind } from "@/core/banks/types";` next to the `Bank` import, `import { isCryptoCode } from "@/core/currencies/crypto";` and `import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";`):

```ts
// The kind of the bank an account goes to (or is in). A bank that is not among the drawer's banks (an
// archived one) counts as an entity: the server decides anyway.
export const kindOfBank = (
  bankId: string | null,
  banks: readonly Bank[],
): BankKind =>
  banks.find((bank) => bank.id === bankId)?.kind ?? DEFAULT_BANK_KIND;

// The crypto currencies are offered in a wallet, and to an account that already holds one (so its
// currency always shows in the field).
export const offersCrypto = (kind: BankKind, currency: string): boolean =>
  kind === "WALLET" || isCryptoCode(currency);

// The currency to keep when the bank changes: a crypto currency goes back to pesos in an entity.
export const currencyForKind = (currency: string, kind: BankKind): string =>
  kind === "ENTITY" && isCryptoCode(currency)
    ? DEFAULT_CURRENCY_CODE
    : currency;
```

In `components/Banks/components/AccountFormDrawer/AccountFormContent.tsx`:

- replace `import { CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";` with `import { CurrencyListBox } from "@/components/Entries/components/CurrencyListBox";`, and `import { pickDefaultBankId } from "./utils";` with `import { currencyForKind, kindOfBank, offersCrypto, pickDefaultBankId } from "./utils";`;
- after `const isCurrencyLocked = account?.hasMovements ?? false;`, add:

```tsx
// The bank and the currency are controlled: the bank's kind decides whether the crypto currencies
// are on offer, and a crypto currency goes back to pesos when the bank becomes an entity.
const [selectedBankId, setSelectedBankId] = useState<string | null>(
  pickDefaultBankId(bankId, banks) ?? null,
);
const [currency, setCurrency] = useState(
  account?.currency ?? DEFAULT_CURRENCY_CODE,
);
const bankKind = kindOfBank(account ? account.bankId : selectedBankId, banks);
```

- in the bank `Select`, replace `defaultValue={pickDefaultBankId(bankId, banks)}` with:

```tsx
              value={selectedBankId}
              onChange={(value) => {
                if (typeof value === "string") {
                  setSelectedBankId(value);
                  setCurrency((current) =>
                    currencyForKind(current, kindOfBank(value, banks)),
                  );
                }
              }}
```

- in the currency `Select`, replace `defaultValue={account?.currency ?? DEFAULT_CURRENCY_CODE}` with:

```tsx
            value={currency}
            onChange={(value) => {
              if (typeof value === "string") {
                setCurrency(value);
              }
            }}
```

and replace its `<ListBox>…CURRENCY_OPTIONS…</ListBox>` with `<CurrencyListBox includeCrypto={offersCrypto(bankKind, currency)} />`;

- keep the `ListBox` import (the bank `Select` still uses it).

- [ ] **Step 8: Run the task's tests to see them pass**

Run: `npx vitest run components/Entries/components/CurrencyListBox components/Banks`
Expected: PASS.

- [ ] **Step 9: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto components/Entries/components/CurrencyListBox components/Banks/components/BankFormDrawer components/Banks/components/BanksBoard/components/BankRow/components/BankCell components/Banks/components/AccountFormDrawer`.
Expected: all green.

- [ ] **Step 10: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 7: The entry and transfer forms list the crypto currencies; caps and planners stay legal tender

**Files:**

- Modify: `components/Incomes/components/IncomeFormDrawer/IncomeFormContent.tsx`, `components/Expenses/components/ExpenseFormDrawer/ExpenseFormContent.tsx`, `components/Transfers/components/TransferFormDrawer/TransferFormContent.tsx`, `components/Incomes/components/RecurringFormDrawer/RecurringFormContent.tsx`, `components/Expenses/components/RecurringExpensesDrawer/components/TemplateFormDrawer/TemplateFormContent.tsx`
- Tests (new cases): `components/Incomes/components/IncomeFormDrawer/IncomeFormDrawer.test.tsx`, `components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.test.tsx`, `components/Transfers/components/TransferFormDrawer/TransferFormDrawer.test.tsx`, `components/Incomes/components/RecurringFormDrawer/RecurringFormDrawer.test.tsx`, `components/Expenses/components/RecurringExpensesDrawer/components/TemplateFormDrawer/TemplateFormDrawer.test.tsx`, `components/Entries/components/AmountCurrencyFields/AmountCurrencyFields.test.tsx`, `components/Cards/components/CardFormDrawer/components/LimitsField/utils.test.ts`
- Tests (option queries that would also match "USDC - USD Coin" / "USDT - Tether"): `components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.test.tsx` (lines ~326 and ~348 `pickCurrency(/USD/)`, helper at ~676), `components/Expenses/components/ExpenseFormDrawer/ExpenseFormDrawer.debit.test.tsx` (helper at ~116), `components/Incomes/components/IncomeFormDrawer/IncomeFormDrawer.reimbursement.test.tsx` (~250 `/^USD/`), `components/Transfers/components/TransferFormDrawer/TransferFormDrawer.test.tsx` (~156 `/USD/`, ~400 `/^USD/`)

**Interfaces:**

- Consumes: `CurrencyListBox` (Task 6), `CRYPTO_CURRENCY_OPTIONS`.
- Produces: the five forms render `<CurrencyListBox includeCrypto />` in their currency `Select`; `AmountCurrencyFields` (both planners) and `LimitsField` (credit caps) keep `CURRENCY_OPTIONS`, unchanged.

- [ ] **Step 1: Read the HeroUI docs and the component to copy**

Re-read `.heroui-docs/react/components/(pickers)/select.mdx`. The component to reuse is `CurrencyListBox` (Task 6); nothing else changes in the markup.

- [ ] **Step 2: Make the existing option queries precise (they break as soon as crypto is listed)**

- `ExpenseFormDrawer.test.tsx`: the two `await pickCurrency(/USD/);` become `await pickCurrency(/^USD - /);`; in the `pickCurrency = async (code: string)` helper of `describe("the card", …)`, `name: new RegExp(\`^${code}\`)` becomes `name: new RegExp(\`^${code} - \`)`.
- `ExpenseFormDrawer.debit.test.tsx`: `pick(screen.getByRole("button", { name: /Moneda$/ }), new RegExp(\`^${code}\`));` becomes `pick(screen.getByRole("button", { name: /Moneda$/ }), new RegExp(\`^${code} - \`));`.
- `IncomeFormDrawer.reimbursement.test.tsx`: `await pickCurrency(/^USD/);` becomes `await pickCurrency(/^USD - /);`.
- `TransferFormDrawer.test.tsx`: `await pick(currencyTrigger(), /USD/);` and `await pick(currencyTrigger(), /^USD/);` become `await pick(currencyTrigger(), /^USD - /);`.

Run: `npx vitest run components/Expenses components/Incomes components/Transfers`
Expected: PASS (these queries were already unambiguous with legal tender only; now they stay so).

- [ ] **Step 3: Write the failing tests**

Append to `IncomeFormDrawer.test.tsx` (add `within` to the Testing Library import if it is missing, and `import { CRYPTO_CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";`):

```tsx
describe("the currency and the crypto currencies", () => {
  const CRYPTO_LABELS = CRYPTO_CURRENCY_OPTIONS.map(({ label }) => label);
  const USDC_ACCOUNT = {
    id: "acc_usdc",
    currency: "USDC",
    label: "Mercado Pago · USDC",
    archived: false,
  };
  const currencyButton = () =>
    screen.getByRole("button", { name: /Moneda(?! de origen)/ });

  it("lists the legal-tender currencies first and then the crypto ones, under 'Criptomonedas'", async () => {
    renderForm(null);

    fireEvent.keyDown(currencyButton(), { key: "ArrowDown" });

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(within(listbox).getByText("Criptomonedas")).toBeInTheDocument();
    expect(options[0]).toMatch(/^ARS - /);
    expect(options.slice(-CRYPTO_LABELS.length)).toEqual(CRYPTO_LABELS);
  });

  it("takes a crypto currency and the wallet account in it", async () => {
    renderForm(null, [...ACCOUNTS, USDC_ACCOUNT]);

    fireEvent.keyDown(currencyButton(), { key: "ArrowDown" });

    const option = await screen.findByRole("option", {
      name: "USDC - USD Coin",
    });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });

    expect(currencyButton()).toHaveTextContent("USDC - USD Coin");
    expect(screen.getByRole("button", { name: /Cuenta$/ })).toHaveTextContent(
      "Mercado Pago · USDC",
    );
  });
});
```

Append to `ExpenseFormDrawer.test.tsx` (same imports):

```tsx
describe("the currency and the crypto currencies", () => {
  const CRYPTO_LABELS = CRYPTO_CURRENCY_OPTIONS.map(({ label }) => label);
  const currencyButton = () => screen.getByRole("button", { name: /Moneda$/ });

  it("lists the legal-tender currencies first and then the crypto ones, under 'Criptomonedas'", async () => {
    renderForm(null);

    fireEvent.keyDown(currencyButton(), { key: "ArrowDown" });

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(within(listbox).getByText("Criptomonedas")).toBeInTheDocument();
    expect(options[0]).toMatch(/^ARS - /);
    expect(options.slice(-CRYPTO_LABELS.length)).toEqual(CRYPTO_LABELS);
  });

  it("takes a crypto currency and the wallet account in it", async () => {
    renderForm(
      null,
      [],
      [
        ...ACCOUNTS,
        {
          id: "acc_usdc",
          currency: "USDC",
          label: "Mercado Pago · USDC",
          archived: false,
        },
      ],
    );

    fireEvent.keyDown(currencyButton(), { key: "ArrowDown" });

    const option = await screen.findByRole("option", {
      name: "USDC - USD Coin",
    });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });

    expect(currencyButton()).toHaveTextContent("USDC - USD Coin");
    expect(screen.getByRole("button", { name: /Cuenta$/ })).toHaveTextContent(
      "Mercado Pago · USDC",
    );
  });
});
```

Append to `TransferFormDrawer.test.tsx` (add `within` to the Testing Library import and `import { CRYPTO_CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";`):

```tsx
describe("a transfer in a crypto currency", () => {
  const WALLET_ACCOUNTS: AccountChoice[] = [
    ...ACCOUNTS,
    {
      id: "mp_usdc",
      currency: "USDC",
      label: "Mercado Pago · USDC",
      archived: false,
    },
    {
      id: "astro_usdc",
      currency: "USDC",
      label: "AstroPay · USDC",
      archived: false,
    },
  ];

  it("lists the crypto currencies after the legal-tender ones", async () => {
    renderForm(CREATE);

    fireEvent.keyDown(currencyTrigger(), { key: "ArrowDown" });

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(within(listbox).getByText("Criptomonedas")).toBeInTheDocument();
    expect(options.slice(-CRYPTO_CURRENCY_OPTIONS.length)).toEqual(
      CRYPTO_CURRENCY_OPTIONS.map(({ label }) => label),
    );
  });

  it("moves a crypto currency between two wallet accounts", async () => {
    actions.createTransferAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CREATE, WALLET_ACCOUNTS);

    await pick(currencyTrigger(), "USDC - USD Coin");
    await pick(fromTrigger(), "Mercado Pago · USDC");
    await pick(toTrigger(), "AstroPay · USDC");
    fireEvent.change(amountInput(), { target: { value: "1.5" } });
    fireEvent.click(submit());

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const form = sent(actions.createTransferAction);

    expect(form.get("currency")).toBe("USDC");
    expect(form.get("fromAccountId")).toBe("mp_usdc");
    expect(form.get("toAccountId")).toBe("astro_usdc");
    expect(form.get("amount")).toBe("1.5");
  });
});
```

Append to `RecurringFormDrawer.test.tsx` (add `within` and `CRYPTO_CURRENCY_OPTIONS` imports):

```tsx
describe("the currency of a recurring income", () => {
  it("lists the crypto currencies after the legal-tender ones, and takes one", async () => {
    renderForm(null);

    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
      key: "ArrowDown",
    });

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(options.slice(-CRYPTO_CURRENCY_OPTIONS.length)).toEqual(
      CRYPTO_CURRENCY_OPTIONS.map(({ label }) => label),
    );

    const usdc = within(listbox).getByRole("option", {
      name: "USDC - USD Coin",
    });

    fireEvent.keyDown(usdc, { key: "Enter" });
    fireEvent.keyUp(usdc, { key: "Enter" });

    expect(formValue("currency")).toBe("USDC");
  });
});
```

Append to `TemplateFormDrawer.test.tsx` the same `describe`, titled `"the currency of a recurring expense"`, with `renderForm()` instead of `renderForm(null)` (and the same added imports).

Append to `AmountCurrencyFields.test.tsx`:

```tsx
it("offers only legal tender: a plan in installments never takes a crypto currency", async () => {
  render(<AmountCurrencyFields amount="" currency="ARS" onChange={() => {}} />);
  fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
    key: "ArrowDown",
  });

  expect(
    await screen.findByRole("option", { name: /^USD - / }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "USDC - USD Coin" })).toBeNull();
  expect(screen.queryByText("Criptomonedas")).toBeNull();
});
```

Append to `LimitsField/utils.test.ts`:

```ts
describe("the currencies of a credit card cap", () => {
  it("are legal tender only, never a crypto asset", () => {
    const codes = currencyChoices(
      [{ key: 0, currency: "ARS", amount: "" }],
      0,
    ).map(({ code }) => code);

    expect(codes).toContain("USD");
    expect(codes).not.toContain("USDC");
    expect(codes).not.toContain("BTC");
  });
});
```

(The last two are guards: `AmountCurrencyFields` and `LimitsField` keep `CURRENCY_OPTIONS`, so they pass at once; they pin D5 against a future change.)

- [ ] **Step 4: Run the tests to see them fail**

Run: `npx vitest run components/Incomes components/Expenses components/Transfers components/Entries/components/AmountCurrencyFields components/Cards/components/CardFormDrawer/components/LimitsField`
Expected: FAIL (the five forms list no "Criptomonedas" group and no "USDC - USD Coin" option). The `AmountCurrencyFields` and `LimitsField` guards pass.

- [ ] **Step 5: Give the five forms the crypto currencies**

In each of `IncomeFormContent.tsx`, `ExpenseFormContent.tsx`, `TransferFormContent.tsx`, `RecurringFormContent.tsx` and `TemplateFormContent.tsx`:

- replace `import { CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";` with `import { CurrencyListBox } from "@/components/Entries/components/CurrencyListBox";`;
- inside the currency `Select`'s `<Select.Popover>`, replace the whole `<ListBox>{CURRENCY_OPTIONS.map(…)}</ListBox>` with `<CurrencyListBox includeCrypto />`;
- if `npm run lint` then reports `ListBox` as unused in the file, remove it from the `@heroui/react` import (keep it wherever another `Select` of the form still uses it).

Do NOT touch `AmountCurrencyFields.tsx` (the two planners) nor `LimitsField` (credit card caps): they stay legal tender only (D5).

- [ ] **Step 6: Run the task's tests to see them pass**

Run: `npx vitest run components/Incomes components/Expenses components/Transfers components/Entries components/Cards`
Expected: PASS.

- [ ] **Step 7: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto components/Incomes/components/IncomeFormDrawer components/Incomes/components/RecurringFormDrawer components/Expenses/components/ExpenseFormDrawer components/Expenses/components/RecurringExpensesDrawer/components/TemplateFormDrawer components/Transfers/components/TransferFormDrawer components/Entries/components/AmountCurrencyFields/AmountCurrencyFields.test.tsx components/Cards/components/CardFormDrawer/components/LimitsField/utils.test.ts`.
Expected: all green. Then `rg -n "CURRENCY_OPTIONS" components --glob '!*.test.*'` lists only `currencyOptions.ts`, `CurrencyListBox.tsx`, `OriginSection/utils.ts`, `AmountCurrencyFields.tsx` and `LimitsField/utils.ts`.

- [ ] **Step 8: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 8: Whole-stage verification, browser pass and handoff

**Files:** none are created for the product. The controller (not an implementer) runs this task; if a check fails, the failing task's implementer fixes it.

**Interfaces:**

- Consumes: everything above; the migration applied and `next dev` restarted at the gate after Task 4.
- Produces: a verified stage and the numbers to report.

- [ ] **Step 1: Static and unit checks**

Run, in this order, and write the results down:

1. `npx vitest run` — all green; record files and tests, compare with the baseline of Task 1 (the difference is exactly the new test files and cases).
2. `npx tsc --noEmit` — clean.
3. `npm run lint` — clean.
4. `npx vitest run components/componentStructure.test.ts components/shared/PendingButton/pendingButtonUsage.test.ts lib/auth/routeProtection.test.ts prisma/schema.test.ts` — green.
5. `npx prettier --check --end-of-line auto core/currencies core/incomes/consts.ts core/incomes/money.ts core/incomes/money.test.ts core/incomes/schema.origin.test.ts core/entries core/reimbursements core/installments/schema.ts core/installments/schema.test.ts core/cards/schema.ts core/cards/schema.test.ts core/cards/kinds.test.ts core/banks core/accounts core/balances core/summary core/transfers/schema.test.ts core/transfers/actions.test.ts core/expenses/actions.test.ts core/expenses/schema.reimbursement.test.ts components/Entries components/Banks components/Incomes components/Expenses components/Transfers components/Cards/components/CardFormDrawer/components/LimitsField app/dashboard/banks prisma/schema.test.ts` — clean.
6. `rg -n "SUPPORTED_CURRENC" core components app lib scripts` — no match. `rg -n 'style: "currency"' core components --glob '!*.test.*'` — only `core/incomes/money.ts` (legal-tender branch) and `core/currencies/origin.ts` (`formatRateMoney`, legal-tender branch).

- [ ] **Step 2: Confirm the migration state (read-only)**

Run `npx prisma migrate status`. Expected: up to date, `20261008120000_bank_kinds` applied. If it is not, STOP and ask the user to run `npx prisma migrate deploy`; do not apply it yourself. If the browser pass fails with `column Bank.kind does not exist`, `Unknown argument kind` or similar, the dev server still holds the old Prisma client or the migration is missing: ask the user to restart `next dev`; do not restart it yourself.

- [ ] **Step 3: Ask once before the live writes**

The dev database holds the user's real data. Ask the user (one question): "I will verify crypto in the browser with a throwaway wallet: a bank 'Prueba billetera' (Billetera virtual) with two USDC accounts, one 10 USDC income and one 1 USDC transfer between them, and then I delete all of it with the delete buttons, so every balance ends where it started. None of your real banks is touched. Can I?" Wait for the answer. Without a yes, verify only the read-only items (1, 2, 9, 11, 12 below).

- [ ] **Step 4: Browser verification (Playwright MCP; reuse the signed-in session — never sign in for the user; do not close the browser; check port 3000 first and never restart the server; click HeroUI radios and switches through their label text)**

Record the "Por cuenta" card and the summary sections of `/dashboard/overview` before touching anything. Then check each item and note pass or fail:

1. `/dashboard/banks` renders; every existing bank shows no "Billetera" chip (they are all entities after the migration); "Editar banco …" names carry no ", billetera virtual".
2. Editing an existing bank shows "Tipo" with "Entidad bancaria" checked; close with Cancelar without saving.
3. "Crear banco": "Tipo" starts on "Entidad bancaria"; choose "Billetera virtual", name "Prueba billetera", save: its card shows the "Billetera" chip and the layout of the row is not crowded (the chip sits under the name; no overflow at 390px wide).
4. "+ Nueva cuenta" on "Prueba billetera": the "Moneda" list shows "Monedas" and then "Criptomonedas" (USDC … TRX). Create "Prueba USDC 1" and "Prueba USDC 2" in USDC: each tile shows "0,00 USDC". Switching the drawer's bank to an entity while USDC is chosen puts "ARS" back (then cancel).
5. "+ Nueva cuenta" on an entity bank: the list has no "Criptomonedas" group (cancel without saving).
6. Edit "Prueba billetera" and choose "Entidad bancaria": saving is refused under "Tipo" with "Este banco tiene cuentas cripto (archivadas incluidas). Eliminalas antes de pasarlo a entidad bancaria."; nothing changes (cancel).
7. "Ingresar ingreso" in USDC (the currency list ends with the crypto group), 10 USDC, "Prueba USDC 1", marked "Cobrado": the tile shows "10,00 USDC"; the overview shows a USDC section after the legal-tender ones and the "Por cuenta" card a USDC card after them, never added to anything else.
8. "Transferencias": a transfer of 100 USDC from "Prueba USDC 1" to "Prueba USDC 2" is refused under "Monto" ("…a esa fecha tenía 10,00 USDC."); a transfer of 1 USDC works and the tiles show "9,00 USDC" and "1,00 USDC".
9. "Compra en cuotas" and the credit-card cap form ("Agregar tarjeta" → Crédito): their currency lists show no crypto asset (cancel both without saving).
10. Clean up: delete the transfer, then the income, then both accounts (they have no movements left), then the bank. The banks board, the overview sections and the "Por cuenta" card are back to what was recorded.
11. `/dashboard/expenses`, `/dashboard/incomes`, `/dashboard/cards` and `/dashboard/overview` still render; the browser console shows no errors during the pass.
12. At about 390px wide the banks board scrolls sideways, the drawers are full width, and there is no horizontal page scroll.

Clean the `.playwright-mcp` scratch files by hand when done; leave the browser open.

- [ ] **Step 5: Handoff to the user**

Report: the final numbers (files, tests), the state of the migration (applied by the user) and that `next dev` was restarted at the gate. Mention the decisions in "Decisions taken" that the browser pass exercised (D3, D5, D6, D7, D8, D10, D12), that the user's banks are all entities and Mercado Pago, AstroPay and Fiwind can be switched to "Billetera virtual" by editing them, and the "Deferred" items below. Do NOT commit (the user commits only when asked); the controller snapshots.

---

## Deferred (not in this stage)

- Everything in the spec's "Out of scope": prices or exchange rates for crypto, on-chain addresses or live balances, the fiat value of crypto holdings, converting between currencies, network fees, more than 6 decimals, crypto credit limits, crypto installments.
- A wallet with a crypto account that has movements can never become an entity (D3): archiving does not unblock it, and an account with history cannot be deleted. A later change could allow it once every crypto account is archived and at zero.
- Editing an account under an archived wallet bank (not in the drawer's bank list) offers no crypto currency unless the account already holds one (D10); the server rule still decides.
- The transfers filter keeps the accounts' order for its currencies, and the conversions page keeps sorting its pairs by code (D8).
- The bank kind is not shown on the Cards page nor in the card form's bank list; a credit card can still be created on a wallet bank (its caps are legal tender only).
- The Help page and legends say nothing about wallets or crypto currencies.
- The opening-balance drawer has no currency selector (each row is in its account's currency); nothing there names crypto beyond the account label "(USDC)".
- Copy left as it was: the Banks page and the bank drawer's create description ("Un banco agrupa tus cuentas: una cuenta bancaria, una billetera virtual o el efectivo.") already mention wallets and were not reworded.
