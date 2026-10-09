# Account Instead of Medium (Stage 2b: balances on accounts, contract) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every balance is computed from accounts: an account's balance is its opening amount (once the opening month has started) plus its settled incomes minus its settled expenses; a currency's total is the sum of its accounts. The summary drops "Billetera" and "Total disponible" and keeps Saldo previo / Actual / Objetivo per currency; the opening balance is entered per account (grouped by bank, one month for all); the Banks board shows each account's balance (red when negative); an account is archived only at zero balance and with nothing pending on it; its currency is locked once it has movements; bank/account writes that race are serialized with row locks. Finally the contract migration makes `accountId` required, drops `medium` and the `PaymentMedium` enum, and every leftover reference goes.

**Architecture:** One pure module, `core/balances/accounts.ts`, owns the balance arithmetic (opening + flows per account, previous balance of a month, totals per currency); the summary, the Banks board and the archive rule all go through it, so "a currency total is the sum of its accounts" holds by construction and stage 3 only has to add transfer flows there. A read service (`readAccountBalances`) feeds it from grouped Prisma queries and accepts a transaction client, so the archive check runs inside the transaction that holds the account's row lock (`SELECT … FOR UPDATE` via `$queryRaw`, like `core/installments/dateMoves.ts` does for its raw statement). The schema follows the expand/contract sequence started in 2a: a small migration relaxes the old opening-balance columns (Task 3), and the contract migration (Task 11) removes them.

**Tech Stack:** Next.js 16.3.6 (App Router, server actions), React 19.2, TypeScript, Prisma 7 + Neon, zod 4, HeroUI v3 (`@heroui/react`), Tailwind 4, Vitest 4 + Testing Library (jsdom per file), Clerk.

**Spec:** docs/superpowers/specs/2026-10-04-accounts-banks-transfers-design.md (Stage 2: "Account balance", "Summary", "Forms, tables and opening balance", "Banks page" rules). Depends on `docs/superpowers/plans/2026-10-05-account-instead-of-medium-stage-2a.md` being done and its expand migration applied. Stage 3 (transfers, "Por cuenta" card) is out of scope.

## Global Constraints

- Copy language: all UI copy (labels, buttons, errors, empty states, hints) in Spanish es-AR, neutral/professional, voseo as in Cards/Roadmap/Banks ("Dejala en cero", "Reactivala"). Code, identifiers, comments and tests in English. Route slugs stay English.
- Component layout is enforced by `components/componentStructure.test.ts` (scans `components/` and `app/`, `.tsx` files that are not tests): no `type`/`interface`/`enum` declarations in a component file, no `const`/helper function at column 0 (only the component itself), exactly one component per file, no props typed inline (`}: {`), no inline `className="..."` of 40+ characters (move it to `styles.ts`), a sub-component is never a bare file under a nested `components/` folder (it gets its own folder `Name/Name.tsx` plus `index.ts`). Types go in `types.ts`, constants in `consts.ts`, styles in `styles.ts`, helpers in `utils.ts`, hooks in `useX.ts`.
- Strict TDD with Vitest: every behaviour gets a failing test first; run it and see it fail for the stated reason before writing the implementation (RED), then see it pass (GREEN). Component tests start with `// @vitest-environment jsdom`. Tests that pin the old `medium`/wallet behaviour are rewritten in the task that changes it (each task names them).
- Money convention: minor units, `BigInt` in the database, `number` in the app (`minorUnitsToNumber` at the boundary); money is formatted on the server with `formatMoney(minorUnits, currency)` (es-AR), the client only places text. Amounts in different currencies are never added.
- Balance rule (binding, from the spec): `balance(account) = opening amount (when the user's opening month has started) + settled incomes − settled expenses`, counting only entries dated from the first day of the opening month when there is an opening balance (all of them otherwise). `PLANNED` and `COVERED` entries never move money. A currency's total is the sum of its accounts' balances. The "current" balance of an account (Banks board, archive rule) counts every settled entry with no upper date (a settled entry is money that moved); the summary's month figures count up to the end of the viewed month.
- Every record is scoped by the Clerk `userId` that comes from the session (`runAuthenticated`), never from client input; another user's id behaves as not found and nothing is written.
- Colors: never blue buttons; only theme tokens (`text-muted`, `text-danger` for a negative balance, `bg-surface-secondary`, `ring-border`, ...). Async buttons use `PendingButton` (guard `components/shared/PendingButton/pendingButtonUsage.test.ts`).
- Raw `<button>` elements (tiles) keep the documented opt-outs `app-button--full-width app-button--row-height` of the global rule in `app/globals.css`.
- Next.js (this repo runs 16.3.6, see AGENTS.md): pages are async Server Components that call `requireUserId()` (guard `lib/auth/routeProtection.test.ts`); `"use server"` files export only async functions; `revalidatePath` only after a successful write. No new Next API is used in this plan.
- HeroUI v3 usage is copied from components that already work in this repo (`CurrencyFields` → `BankFields` keeps `Fieldset`/`FieldGroup`/`TextField`; `AccountFormContent` for the account drawer), checked against `.heroui-docs/react/components/(forms)/fieldset.mdx` and `(pickers)/select.mdx`.
- Row locks: `SELECT … FOR UPDATE` through `tx.$queryRaw` tagged templates inside `prisma.$transaction(async (tx) => …)`; ids and userId travel as parameters, never inside the SQL text (pinned in each lock test, like `core/installments/dateMoves.test.ts`). Inside one interactive transaction the queries run one after another (no `Promise.all` on `tx`).
- No git commit steps (the user commits only when asked). Every task ends with a verify step: that task's tests, `npx tsc --noEmit`, and `npx eslint <the task's paths>`; every task boundary leaves `npx vitest run`, `npx tsc --noEmit` and `npm run lint` fully green, and the last step of every task runs all three.
- Do not start, stop or restart `next dev`. Migrations are written by hand into `prisma/migrations/<timestamp>_<name>/migration.sql`; the controller applies them with `npx prisma migrate deploy` only after the human's OK. The implementer only runs `npx prisma validate`, `npx prisma generate` and the read-only `npx prisma migrate diff --from-schema … --to-schema … --script`.
- `EXPAND` marker: lines that only exist because `accountId` is still nullable carry `// EXPAND` (or go through `core/accounts/expand.ts`); Task 11 removes all of them.

## Review Focus

1. Account balance at an opening-month boundary: in the month before the opening month there is no balance, in the opening month the balance is exactly the opening amount (entries of earlier months ignored, entries of that month not yet "previous"), from the next month on opening + entries since the opening month's first day; an account with only an opening amount of 0 still shows — pinned in Task 1 (pure), Task 4 (summary through accounts), Task 5 (reads respect the window).
2. Summary totals equal the sum of the account balances: Saldo previo of a currency is the sum of its accounts' previous balances, moving money between two accounts of the same currency never changes a currency total, a covered or planned entry never moves a balance — pinned in Task 1 (property tests), Task 2 (summary without mediums), Task 4.
3. Archiving or deleting an account that still holds something: refused with a Spanish message while its balance is not zero, while it has planned entries, or while a recurring template points at it (so a template or plan can never generate into an archived account); deletion is impossible by the `Restrict` foreign keys — pinned in Task 8 and Task 11 (schema test of the required relation).
4. Concurrent writes that used to race: archiving a bank while one of its accounts is reactivated or created, and two archive/reactivate requests at once, are serialized by a lock on the bank row; archiving an account and changing an account's currency lock the account row — pinned in Task 7 (bank lock), Task 8 (archive under the account lock), Task 9 (currency lock under the account lock). Entry writes are not serialized against these (documented residual window, see Task 9).
5. Changing an account's currency once it has movements (entries, templates, plans or an opening amount) is refused, and the drawer shows it locked; an opening balance saved for an account that was deleted, is another user's or changed currency meanwhile is refused as a whole — pinned in Task 9 and Task 3.

## File Structure

Prisma

- Modify `prisma/schema.prisma`, `prisma/schema.test.ts` (Tasks 3 and 11).
- Create `prisma/migrations/20261006120000_opening_balance_per_account/migration.sql` (Task 3) and `prisma/migrations/20261006180000_entries_account_contract/migration.sql` (Task 11).

Core: balances (`core/balances`)

- Create `accounts.ts` (+ `accounts.test.ts`) — pure balance arithmetic.
- Create `accountBalances.ts` (+ `accountBalances.test.ts`) — `readAccountBalances(db, userId, accountIds?)`.
- Modify `types.ts`, `previous.ts` (+ test), `schema.ts` (+ test), `service.ts` (+ test), `actions.ts` (+ test), `consts.ts`.

Core: summary (`core/summary`)

- Modify `types.ts`, `compute.ts` (+ test), `service.ts` (+ test).

Core: accounts and banks

- Create `core/accounts/locks.ts`, `core/banks/locks.ts` (+ tests), `core/accounts/movements.ts` (+ test), `core/banks/boardAccounts.ts` (+ test).
- Modify `core/accounts/{errors,consts,service}.ts` (+ tests), `core/banks/{types,board,service,pageData,actionHelpers,actions}.ts` (+ tests), `core/accounts/actions.ts` (+ test).
- Delete `core/accounts/expand.ts` (+ test) and `core/entries/medium.ts` (+ test) (Tasks 11–12).

Components

- `components/Summary/{types,consts,utils}.ts`, `components/Summary/components/CurrencySection/utils.ts` (+ tests), `components/Summary/Summary.test.tsx`.
- `components/Summary/components/OpeningBalanceDrawer/**` — `CurrencyFields` replaced by `BankFields`.
- `components/Banks/**` — tile balance, board types, account drawer currency lock.

Routes

- `app/dashboard/overview/loadSummaryView.test.ts`, `app/dashboard/banks/loadBanksView.test.ts`.

## Shared fixtures

```ts
// An opening row as getOpeningBalances reads it (Task 3 on).
const openingRow = (
  accountId: string,
  currency: string,
  amount: number,
  month = "2026-06",
) => ({
  id: `ob_${accountId}`,
  userId: "user_123",
  accountId,
  account: { currency },
  amount: BigInt(amount),
  month,
});
```

## Tasks

### Task 1: The account balance arithmetic (pure)

**Files:**

- Test: `core/balances/accounts.test.ts`
- Create: `core/balances/accounts.ts`
- Modify: `core/balances/types.ts`

**Interfaces:**

- Consumes: `priorEntriesWindow(month, openingMonth)` (`./previous`, unchanged).
- Produces in `core/balances/types.ts`:
  - `AccountAmount { accountId: string; currency: string; amount: number }`
  - `AccountOpening { month: string; amounts: readonly AccountAmount[] }`
  - `AccountFlow { accountId: string; currency: string; kind: "income" | "expense"; amount: number }` (settled money, minor units, positive)
  - `AccountBalance { accountId: string; currency: string; balance: number }`
  - `CurrencyBalance { currency: string; amount: number }`
- Produces in `core/balances/accounts.ts`:
  - `sumAccountBalances(amounts: readonly AccountAmount[], flows: readonly AccountFlow[]): AccountBalance[]` (sorted by `accountId`)
  - `previousAccountBalances(month: string, opening: AccountOpening | null, flows: readonly AccountFlow[]): AccountBalance[]`
  - `totalsByCurrency(balances: readonly AccountBalance[]): CurrencyBalance[]` (sorted by currency)

- [ ] **Step 1: Write the failing test** `core/balances/accounts.test.ts`

```ts
import { describe, expect, it } from "vitest";

import {
  previousAccountBalances,
  sumAccountBalances,
  totalsByCurrency,
} from "./accounts";
import type { AccountFlow, AccountOpening } from "./types";

const flow = (
  accountId: string,
  kind: AccountFlow["kind"],
  amount: number,
  currency = "ARS",
): AccountFlow => ({ accountId, currency, kind, amount });

const opening = (
  month: string,
  ...amounts: [string, number, string?][]
): AccountOpening => ({
  month,
  amounts: amounts.map(([accountId, amount, currency = "ARS"]) => ({
    accountId,
    currency,
    amount,
  })),
});

describe("sumAccountBalances", () => {
  it("is the opening amount plus the settled incomes minus the settled expenses, per account", () => {
    expect(
      sumAccountBalances(opening("2026-06", ["bank", 50000]).amounts, [
        flow("bank", "income", 20000),
        flow("bank", "expense", 12000),
      ]),
    ).toEqual([{ accountId: "bank", currency: "ARS", balance: 58000 }]);
  });

  it("keeps two accounts of the same currency apart", () => {
    expect(
      sumAccountBalances(
        [],
        [flow("bank", "income", 1000), flow("cash", "expense", 300)],
      ),
    ).toEqual([
      { accountId: "bank", currency: "ARS", balance: 1000 },
      { accountId: "cash", currency: "ARS", balance: -300 },
    ]);
  });

  it("can be negative: it is shown, never blocked", () => {
    expect(
      sumAccountBalances([], [flow("cash", "expense", 999)])[0].balance,
    ).toBe(-999);
  });

  it("keeps an account that only has an opening amount, even at zero", () => {
    expect(
      sumAccountBalances(opening("2026-06", ["bank", 0]).amounts, []),
    ).toEqual([{ accountId: "bank", currency: "ARS", balance: 0 }]);
  });

  it("knows nothing of an account without opening amount nor movements", () => {
    expect(sumAccountBalances([], [])).toEqual([]);
  });
});

describe("previousAccountBalances", () => {
  const OPENING = opening("2026-06", ["bank", 50000], ["cash", 8000]);

  it("without an opening balance, is the net of everything settled before the month", () => {
    expect(
      previousAccountBalances("2026-09", null, [
        flow("bank", "income", 10000),
        flow("bank", "expense", 3500),
      ]),
    ).toEqual([{ accountId: "bank", currency: "ARS", balance: 6500 }]);
  });

  it("is nothing in a month before the opening month: no balance is invented", () => {
    expect(
      previousAccountBalances("2026-05", OPENING, [
        flow("bank", "income", 999),
      ]),
    ).toEqual([]);
  });

  it("is exactly the opening amounts in the opening month, whatever the flows say", () => {
    expect(
      previousAccountBalances("2026-06", OPENING, [
        flow("bank", "income", 999),
      ]),
    ).toEqual([
      { accountId: "bank", currency: "ARS", balance: 50000 },
      { accountId: "cash", currency: "ARS", balance: 8000 },
    ]);
  });

  it("adds the flows from the month right after the opening month on", () => {
    expect(
      previousAccountBalances("2026-07", OPENING, [
        flow("bank", "income", 20000),
        flow("cash", "expense", 3000),
      ]),
    ).toEqual([
      { accountId: "bank", currency: "ARS", balance: 70000 },
      { accountId: "cash", currency: "ARS", balance: 5000 },
    ]);
  });

  it("brings in an account that has entries but no opening amount", () => {
    expect(
      previousAccountBalances("2026-09", OPENING, [
        flow("new", "income", 300, "USD"),
      ]).find(({ accountId }) => accountId === "new"),
    ).toEqual({ accountId: "new", currency: "USD", balance: 300 });
  });
});

describe("totalsByCurrency", () => {
  it("adds the accounts of each currency and never mixes currencies", () => {
    expect(
      totalsByCurrency([
        { accountId: "bank", currency: "ARS", balance: 1000 },
        { accountId: "cash", currency: "ARS", balance: -300 },
        { accountId: "dollars", currency: "USD", balance: 50 },
      ]),
    ).toEqual([
      { currency: "ARS", amount: 700 },
      { currency: "USD", amount: 50 },
    ]);
  });

  it("is the sum of its accounts: moving money between two accounts of a currency changes the accounts, never the total", () => {
    const before = sumAccountBalances(
      opening("2026-06", ["bank", 1000]).amounts,
      [],
    );
    // The same 400 leaves one account and reaches another (stage 3 models this as a transfer, two
    // more flows of this very function).
    const after = sumAccountBalances(
      opening("2026-06", ["bank", 1000]).amounts,
      [flow("bank", "expense", 400), flow("cash", "income", 400)],
    );

    expect(after).not.toEqual(before);
    expect(totalsByCurrency(after)).toEqual(totalsByCurrency(before));
  });

  it("is empty for no accounts", () => {
    expect(totalsByCurrency([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run core/balances/accounts.test.ts`
Expected: FAIL — `Failed to resolve import "./accounts"`.

- [ ] **Step 3: Add the types.** Append to `core/balances/types.ts`:

```ts
// One amount held in an account at the START of the opening month, in minor units.
export interface AccountAmount {
  accountId: string;
  currency: string;
  amount: number;
}

// The opening balance kept per account: every amount shares the one month it is valid from.
export interface AccountOpening {
  month: string;
  amounts: readonly AccountAmount[];
}

// Settled money that moved in one account, one side at a time (minor units, positive for its side).
// Stage 3 adds transfers as two more flows (out of the source, into the destination).
export interface AccountFlow {
  accountId: string;
  currency: string;
  kind: "income" | "expense";
  amount: number;
}

// What an account holds: its opening amount and every settled movement since.
export interface AccountBalance {
  accountId: string;
  currency: string;
  balance: number;
}

// The sum of the accounts of one currency.
export interface CurrencyBalance {
  currency: string;
  amount: number;
}
```

- [ ] **Step 4: Implement** `core/balances/accounts.ts`

```ts
import { priorEntriesWindow } from "./previous";
import type {
  AccountAmount,
  AccountBalance,
  AccountFlow,
  AccountOpening,
  CurrencyBalance,
} from "./types";

// The one place that turns money into balances. Every balance of the app (the summary, the Banks
// board, the archive rule) is built here, so a currency's total is always the sum of its accounts.
// Stage 3 adds transfers as flows (one out of the source, one into the destination): nothing else
// changes, and a transfer can never alter a currency total.

const signed = ({ kind, amount }: AccountFlow): number =>
  kind === "income" ? amount : -amount;

// Opening amounts plus settled flows, per account. The caller decides which flows count (see
// previousAccountBalances); an account appears when it has an opening amount (even 0) or a flow.
export const sumAccountBalances = (
  amounts: readonly AccountAmount[],
  flows: readonly AccountFlow[],
): AccountBalance[] => {
  const balances = new Map<string, AccountBalance>();
  const add = (accountId: string, currency: string, amount: number) => {
    const current = balances.get(accountId) ?? {
      accountId,
      currency,
      balance: 0,
    };

    balances.set(accountId, { ...current, balance: current.balance + amount });
  };

  for (const { accountId, currency, amount } of amounts) {
    add(accountId, currency, amount);
  }

  for (const flow of flows) {
    add(flow.accountId, flow.currency, signed(flow));
  }

  return [...balances.values()].sort((a, b) =>
    a.accountId.localeCompare(b.accountId),
  );
};

// What each account held at the start of `month`. `flows` are the settled entries of
// priorEntriesWindow(month, opening?.month); they are ignored when that window is empty.
// - no opening balance: the net of every settled entry before the month;
// - a month before the opening one: nothing (no balance is invented);
// - the opening month: the opening amounts;
// - a later month: the opening amounts plus the settled entries since the opening month began.
export const previousAccountBalances = (
  month: string,
  opening: AccountOpening | null,
  flows: readonly AccountFlow[],
): AccountBalance[] => {
  if (opening !== null && month < opening.month) {
    return [];
  }

  const counted =
    priorEntriesWindow(month, opening?.month ?? null) === null ? [] : flows;

  return sumAccountBalances(opening?.amounts ?? [], counted);
};

// The total of each currency: the sum of its accounts. Currencies are never added together.
export const totalsByCurrency = (
  balances: readonly AccountBalance[],
): CurrencyBalance[] => {
  const totals = new Map<string, number>();

  for (const { currency, balance } of balances) {
    totals.set(currency, (totals.get(currency) ?? 0) + balance);
  }

  return [...totals]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
};
```

- [ ] **Step 5: Run and see it pass**

Run: `npx vitest run core/balances`
Expected: PASS (the existing `previous.test.ts` is untouched).

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/balances`, then `npx vitest run` and `npm run lint`
Expected: all green.

### Task 2: The summary without mediums (no Billetera, no Total disponible)

The month's figures stop splitting by medium: Saldo previo, Actual and Objetivo count every account of the currency. The "Saldos" row (Saldo previo, Billetera, Total disponible) goes; Saldo previo joins the Remanentes row.

**Files:**

- Test: `core/balances/previous.test.ts`, `core/summary/compute.test.ts`, `core/summary/service.test.ts`, `components/Summary/utils.test.ts`, `components/Summary/components/CurrencySection/utils.test.ts`, `components/Summary/Summary.test.tsx`, `app/dashboard/overview/loadSummaryView.test.ts`
- Modify: `core/balances/{types,previous}.ts`, `core/summary/{types,compute,service}.ts`, `components/Summary/{types,consts,utils}.ts`, `components/Summary/components/CurrencySection/utils.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `SettledFlow { currency: string; kind: "income" | "expense"; amount: number }` (no `medium`); `PreviousBalance { currency: string; amount: number }`; `previousBalances(month, opening, flows: readonly SettledFlow[]): PreviousBalance[]` sums every opening amount of a currency (whatever its medium).
  - `StatusGroup { currency; status; _sum }` (no `medium`); `CurrencySummary` without `wallet` and `available`; `summarize()`: `current = previous + incomes.settled − expenses.settled`, `target = current + (includeExpectedIncomes ? incomes.pending : 0) − expenses.pending`.
  - `getMonthlySummary` groups the month by `["currency", "status"]` and the earlier settled entries by `["currency"]`.
  - `SummaryRow` without `wallet`/`available`; `SummaryRowSpec.id` is `"incomes" | "expenses" | "remainders"`; `SummaryCardSpec.id` drops `"wallet" | "available"`; the remainders row is Saldo previo, Actual, Objetivo.

- [ ] **Step 1: Write the failing core tests.**

Replace `core/balances/previous.test.ts` from the `flow` helper down to the end of `describe("previousBalances with an opening balance", ...)` (keep `describe("priorEntriesWindow", ...)` as it is) so the helpers and the two `previousBalances` describes read:

```ts
const flow = (
  currency: string,
  kind: SettledFlow["kind"],
  amount: number,
): SettledFlow => ({ currency, kind, amount });

const opening = (
  month: string,
  ...amounts: [string, "DIGITAL" | "CASH", number][]
): OpeningBalances => ({
  month,
  amounts: amounts.map(([currency, medium, amount]) => ({
    currency,
    medium,
    amount,
  })),
});
```

```ts
describe("previousBalances without an opening balance", () => {
  it("is the net of everything settled before the month, income minus expense", () => {
    expect(
      previousBalances("2026-09", null, [
        flow("ARS", "income", 10000),
        flow("ARS", "expense", 3500),
      ]),
    ).toEqual([{ currency: "ARS", amount: 6500 }]);
  });

  it("keeps currencies apart and sorted by code", () => {
    const result = previousBalances("2026-09", null, [
      flow("USD", "income", 100),
      flow("ARS", "income", 200),
    ]);

    expect(result.map((row) => row.currency)).toEqual(["ARS", "USD"]);
  });

  it("can be negative when more went out than came in", () => {
    expect(
      previousBalances("2026-09", null, [
        flow("ARS", "income", 1000),
        flow("ARS", "expense", 4000),
      ])[0].amount,
    ).toBe(-3000);
  });

  it("leaves out a currency whose balance is zero", () => {
    expect(
      previousBalances("2026-09", null, [
        flow("ARS", "income", 1000),
        flow("ARS", "expense", 1000),
      ]),
    ).toEqual([]);
  });

  it("is empty when nothing came before", () => {
    expect(previousBalances("2026-09", null, [])).toEqual([]);
  });
});

describe("previousBalances with an opening balance", () => {
  const OPENING = opening(
    "2026-06",
    ["ARS", "DIGITAL", 50000],
    ["ARS", "CASH", 8000],
  );

  it("is zero before the opening month: it does not apply there, and nothing is invented", () => {
    expect(
      previousBalances("2026-05", OPENING, [flow("ARS", "income", 999)]),
    ).toEqual([]);
  });

  it("is the sum of the opening amounts of the currency in the opening month (cash is just money)", () => {
    expect(
      previousBalances("2026-06", OPENING, [flow("ARS", "income", 999)]),
    ).toEqual([{ currency: "ARS", amount: 58000 }]);
  });

  it("adds the settled entries since the opening month to the opening amounts", () => {
    expect(
      previousBalances("2026-09", OPENING, [
        flow("ARS", "income", 20000),
        flow("ARS", "expense", 15000),
      ]),
    ).toEqual([{ currency: "ARS", amount: 63000 }]);
  });

  it("keeps a currency that only has an opening balance, even at zero in the opening month", () => {
    expect(
      previousBalances(
        "2026-06",
        opening("2026-06", ["USD", "DIGITAL", 0]),
        [],
      ),
    ).toEqual([{ currency: "USD", amount: 0 }]);
  });

  it("brings in a currency that only has entries, on top of the opening ones", () => {
    const result = previousBalances("2026-09", OPENING, [
      flow("EUR", "income", 300),
    ]);

    expect(result).toEqual([
      { currency: "ARS", amount: 58000 },
      { currency: "EUR", amount: 300 },
    ]);
  });

  it("rolls over a year", () => {
    expect(
      previousBalances(
        "2027-02",
        opening("2026-11", ["ARS", "DIGITAL", 1000]),
        [flow("ARS", "income", 500)],
      ),
    ).toEqual([{ currency: "ARS", amount: 1500 }]);
  });
});
```

In `core/summary/compute.test.ts`: change the `group` helper to

```ts
const group = (
  currency: string,
  status: "PLANNED" | "SETTLED" | "COVERED",
  amount: number | null,
) => ({
  currency,
  status,
  _sum: { amount: amount === null ? null : BigInt(amount) },
});
```

replace the whole `describe("summarize with payment mediums", ...)` with

```ts
describe("summarize with the previous balance", () => {
  const previous = [{ currency: "ARS", amount: 5800 }];

  it("adds the previous balance (every account of the currency) to the current remainder", () => {
    const [ars] = summarize(
      [group("ARS", "SETTLED", 1000)],
      [group("ARS", "SETTLED", 300)],
      { previous },
    );

    expect(ars.previous).toBe(5800);
    expect(ars.current).toBe(6500);
  });

  it("builds the target from the current remainder and every pending entry", () => {
    const [ars] = summarize(
      [group("ARS", "PLANNED", 400)],
      [group("ARS", "PLANNED", 200)],
      { previous },
    );

    expect(ars.target).toBe(6000);
  });

  it("can leave the expected incomes out of the target and still carry the previous balance", () => {
    const [ars] = summarize(
      [group("ARS", "PLANNED", 400)],
      [group("ARS", "PLANNED", 200)],
      { previous, includeExpectedIncomes: false },
    );

    expect(ars.target).toBe(5600);
    expect(ars.current).toBe(5800);
  });

  it("gives a currency that only has a previous balance a row of its own", () => {
    const rows = summarize([group("ARS", "SETTLED", 100)], [], {
      previous: [{ currency: "USD", amount: 290 }],
    });

    expect(rows.map((row) => row.currency)).toEqual(["ARS", "USD"]);
    expect(rows[1]).toMatchObject({
      currency: "USD",
      incomes: { total: 0, settled: 0, pending: 0 },
      previous: 290,
      current: 290,
      target: 290,
    });
  });

  it("has no previous balance without any, and no wallet or availability at all", () => {
    const [ars] = summarize([group("ARS", "SETTLED", 100)], []);

    expect(ars.previous).toBe(0);
    expect(ars).not.toHaveProperty("wallet");
    expect(ars).not.toHaveProperty("available");
  });
});
```

and in `describe("summarize with covered installments", ...)` delete the line `    group("ARS", "COVERED", 700, "CASH"),` from `expenses`, rename `"does not touch the remainders, the target, the wallet or the availability"` to `"does not touch the remainders or the target"` and delete its two lines `expect(ars.wallet)...` and `expect(ars.available)...`; in `"is informational: no remainder, wallet or availability moves with it"` rename to `"is informational: no remainder moves with it"`.

Rewrite `core/summary/service.test.ts`'s helpers and the medium-specific tests:

```ts
const monthGroup = (
  currency: string,
  status: "SETTLED" | "PLANNED" | "COVERED",
  amount: number,
) => ({ currency, status, _sum: { amount: BigInt(amount) } });

const priorGroup = (currency: string, amount: number) => ({
  currency,
  _sum: { amount: BigInt(amount) },
});

const openingRow = (
  currency: string,
  medium: "DIGITAL" | "CASH",
  amount: number,
  month: string,
) => ({ currency, medium, amount: BigInt(amount), month });
```

then: delete the `"DIGITAL"`/`"CASH"` argument from every `monthGroup(...)` and `priorGroup(...)` call; in `"groups the user's incomes and expenses of that month by currency, status and medium"` expect `by: ["currency", "status"]` (twice) and rename it `"... by currency and status"`; in `"turns what the database returns into the summary"` and `"leaves the installments covered ..."` delete the expected `wallet: 0,` and `available: 70000,` lines (and the `monthGroup("ARS", "COVERED", 7000)` that was CASH stays as a plain COVERED group); in `"without an opening balance, adds up every settled entry before the month"` expect `by: ["currency"]`; replace `"feeds the remainders with the digital part and the wallet with the cash part"` with

```ts
it("feeds the remainders with every account of the currency, cash included", async () => {
  db.income.groupBy
    .mockResolvedValueOnce([monthGroup("ARS", "SETTLED", 500)])
    .mockResolvedValueOnce([priorGroup("ARS", 12000)]);
  db.expense.groupBy
    .mockResolvedValueOnce([monthGroup("ARS", "SETTLED", 300)])
    .mockResolvedValueOnce([priorGroup("ARS", 4500)]);

  const [row] = await getMonthlySummary(USER_ID, "2026-09");

  expect(row.previous).toBe(7500);
  expect(row.current).toBe(7700);
});
```

in `"starts from the opening amounts and adds what happened since"` change the prior groups to `priorGroup("ARS", 20000)` / `priorGroup("ARS", 3000)` and the expectations to `expect(row.previous).toBe(75000);` (50000 + 8000 + 20000 − 3000) with no `wallet` line; in `"gives a section to a currency that only has a previous balance"` delete `available: 25000,`; in `"gives a section to a currency that only has an opening balance"` expect `toMatchObject([{ currency: "EUR", previous: 900 }])`.

- [ ] **Step 2: Write the failing component tests.**

`components/Summary/utils.test.ts`: delete `wallet: 25000,` and `available: 95000,` from `ARS`, the expected `wallet`/`available` lines, and the test `"formats a negative wallet and a negative total with their sign"`. The `toOpeningBalanceData` tests stay for Task 3.

`components/Summary/components/CurrencySection/utils.test.ts`: delete `wallet: "wallet",` and `available: "available",` from `ROW`; replace the remainders and balances tests and the `SUMMARY_ROWS` tests with:

```ts
  it("gives the remainders row the previous balance and the two remainders", () => {
    expect(values("remainders")).toEqual(["previous", "current", "target"]);
  });
});
```

```ts
describe("SUMMARY_ROWS", () => {
  it("lists incomes, expenses and remainders, in that order", () => {
    expect(SUMMARY_ROWS.map((row) => row.title)).toEqual([
      "Ingresos",
      "Gastos",
      "Remanentes",
    ]);
  });

  it("gives each side its own tone and the remainders the balance one", () => {
    expect(SUMMARY_ROWS.map((row) => row.tone)).toEqual([
      "income",
      "expense",
      "balance",
    ]);
  });

  it("explains every remainder and leaves the obvious cards without a description", () => {
    expect(spec("remainders").cards.every((card) => card.description)).toBe(
      true,
    );
    expect(
      spec("incomes")
        .cards.filter((card) => card.description)
        .map((card) => card.id),
    ).toEqual(["reimbursements"]);
  });

  it("has no wallet nor total available any more", () => {
    const ids = SUMMARY_ROWS.flatMap((row) => row.cards.map((card) => card.id));

    expect(ids).not.toContain("wallet");
    expect(ids).not.toContain("available");
  });
});
```

`components/Summary/Summary.test.tsx`: delete `wallet` and `available` from `ARS` and `USD`; then

- `"titles each row of a currency ..."` and the loading `"is made of the same rows ..."`: expected titles `["Ingresos", "Gastos", "Remanentes"]`.
- `"gives the heading of each row the tone of its cards"` and the loading tone test: delete the `Saldos` expectation.
- Replace `"shows the two remainders, makes them stand out and explains each one"`, `"puts the balances after the remainders"`, `"shows the balances as previous, wallet and total available, in that order"`, `"explains each balance"`, `"makes only the total available stand out among the balances"` and `"keeps each currency's balances apart"` with:

```ts
it("shows Saldo previo, Actual and Objetivo, in that order, and explains each one", () => {
  renderSummary([ARS]);

  const remainders = row("Remanentes en ARS");
  const labels = remainders
    .getAllByRole("listitem")
    .map((item) => item.querySelector("span")?.textContent);

  expect(labels).toEqual(["Saldo previo", "Actual", "Objetivo"]);
  expect(card(remainders, "Saldo previo")).toHaveTextContent("$ 5.000,00");
  expect(card(remainders, "Saldo previo")).toHaveTextContent(
    "Lo que sumaban tus cuentas al empezar el mes.",
  );
  expect(card(remainders, "Actual")).toHaveTextContent("$ 700,00");
  expect(card(remainders, "Actual")).toHaveTextContent(
    "Saldo previo más lo cobrado menos lo pagado en el mes, sumando todas tus cuentas.",
  );
  expect(card(remainders, "Objetivo")).toHaveTextContent("$ 900,00");
  expect(card(remainders, "Objetivo")).toHaveTextContent("terminaría el mes");
});

it("makes Actual and Objetivo stand out, not Saldo previo", () => {
  renderSummary([ARS]);

  const remainders = row("Remanentes en ARS");

  expect(card(remainders, "Actual")).toHaveAttribute("data-emphasis", "true");
  expect(card(remainders, "Objetivo")).toHaveAttribute("data-emphasis", "true");
  expect(card(remainders, "Saldo previo")).not.toHaveAttribute("data-emphasis");
});

it("has no Billetera nor Total disponible", () => {
  renderSummary([ARS]);

  expect(screen.queryByText("Billetera")).not.toBeInTheDocument();
  expect(screen.queryByText("Total disponible")).not.toBeInTheDocument();
});
```

- `"still shows the cards, at zero in the default currency"`: replace the `Total disponible` expectation with `expect(card(row("Remanentes en ARS"), "Saldo previo")).toHaveTextContent(/0,00/);`.
- Loading: replace `"already names the balance cards and says what they mean, while their amounts wait"` with a test that `loading.getByText("Saldo previo")`, `"Actual"`, `"Objetivo"` and `loading.getByText("Lo que sumaban tus cuentas al empezar el mes.")` are present; in `"shows skeleton cards, ..."` change `toBeGreaterThanOrEqual(11)` to `toBeGreaterThanOrEqual(10)` (4 + 3 + 3 cards).

`app/dashboard/overview/loadSummaryView.test.ts`: delete `wallet: 25000,`, `available: 95000,` from `ARS` and the two `expect(row.wallet)` / `expect(row.available)` lines.

- [ ] **Step 3: Run them and see them fail**

Run: `npx vitest run core/balances core/summary components/Summary app/dashboard/overview`
Expected: FAIL — `previousBalances` still returns `digital`/`cash`, `summarize` still has `wallet`, the Saldos row is still there.

- [ ] **Step 4: Implement the core.**

`core/balances/types.ts`: replace `SettledFlow` with

```ts
// The settled money that moved in one currency, one side at a time. Only settled entries count:
// planned and covered ones never moved any money.
export interface SettledFlow {
  currency: string;
  kind: "income" | "expense";
  // Minor units, always positive for the side it belongs to.
  amount: number;
}
```

and `PreviousBalance` with

```ts
// The "saldo previo" of a month in one currency: what its accounts held when the month began.
export interface PreviousBalance {
  currency: string;
  amount: number;
}
```

`core/balances/previous.ts`: delete `emptyBalance` and `MEDIUM_KEYS`; replace `previousBalances` with

```ts
// The "saldo previo" of `month`, per currency: every account of the currency together. `flows` are
// the settled entries of `priorEntriesWindow(month, opening?.month)`; they are ignored when that
// window is empty.
//
// - no opening balance: the net of every settled entry before the month;
// - month before the opening one: nothing (no balance is invented);
// - the opening month: the opening amounts;
// - a later month: the opening amounts plus the net of the settled entries since.
//
// A currency shows up when it has an opening amount or a balance that is not zero.
export const previousBalances = (
  month: string,
  opening: OpeningBalances | null,
  flows: readonly SettledFlow[],
): PreviousBalance[] => {
  if (opening !== null && month < opening.month) {
    return [];
  }

  const balances = new Map<string, number>();
  const keep = new Set<string>();
  const add = (currency: string, amount: number) =>
    balances.set(currency, (balances.get(currency) ?? 0) + amount);

  for (const { currency, amount } of opening?.amounts ?? []) {
    add(currency, amount);
    keep.add(currency);
  }

  if (priorEntriesWindow(month, opening?.month ?? null) !== null) {
    for (const { currency, kind, amount } of flows) {
      add(currency, kind === "income" ? amount : -amount);
    }
  }

  return [...balances]
    .filter(([currency, amount]) => keep.has(currency) || amount !== 0)
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
};
```

`core/summary/types.ts`: delete the `PaymentMedium` import; `StatusGroup` loses `medium` (comment "grouping a month's entries by currency and status"); in `SideSummary` drop the sentence about cash and digital; in `CurrencySummary` replace the comments of `previous`/`current` and delete `wallet` and `available`:

```ts
// "Saldo previo": what the user's accounts in this currency held when the month began.
previous: number;
// What the accounts hold at the end of the month's movements: the previous balance plus the
// incomes collected, minus the expenses paid (every account of the currency).
current: number;
```

`core/summary/compute.ts`: delete `CashAndDigital` and `foldByMedium`; replace the comment and the mapping body of `summarize`:

```ts
// Puts a month's incomes and expenses side by side, per currency (they are never added across
// currencies). A currency that appears on only one side still gets a row, with zero on the other.
// The remainders count every account of the currency: the previous balance, plus what was collected,
// minus what was paid; the target adds what is still pending.
```

```ts
return currencies.map((currency) => {
  const incomeSide = incomes.get(currency) ?? EMPTY_SIDE;
  const expenseSide = expenses.get(currency) ?? EMPTY_SIDE;
  const before = previousByCurrency.get(currency)?.amount ?? 0;
  const current = before + incomeSide.settled - expenseSide.settled;
  const expectedIncomes = includeExpectedIncomes ? incomeSide.pending : 0;

  return {
    currency,
    incomes: incomeSide,
    expenses: expenseSide,
    previous: before,
    current,
    target: current + expectedIncomes - expenseSide.pending,
    pendingReimbursements: pendingByCurrency.get(currency) ?? 0,
  };
});
```

`core/summary/service.ts`: delete the `PaymentMedium` import and the `medium` field of `PriorGroup`; `toFlows` maps `({ currency, _sum })` to `{ currency, kind, amount }`; the month query becomes

```ts
const query = {
  by: ["currency", "status"] as ("currency" | "status")[],
  where,
  _sum: { amount: true as const },
};
```

and the prior query `by: ["currency"] as "currency"[],`; update the header comment ("grouped by currency and status (the month) or by currency (the settled entries before it)").

- [ ] **Step 5: Implement the components.**

`components/Summary/types.ts`: in `SummaryRow` delete `wallet` and `available` (and fix the comments: `previous` "What the accounts held when the month began.", `current` "What the accounts hold after the month's movements."); in `SummaryCardSpec.id` delete `| "wallet"` and `| "available"`; `SummaryRowSpec.id` becomes `"incomes" | "expenses" | "remainders"`.

`components/Summary/consts.ts`: delete `WalletIcon` from the import; replace the `remainders` and `balances` entries of `SUMMARY_ROWS` with:

```ts
  {
    id: "remainders",
    title: "Remanentes",
    tone: "balance",
    Icon: ScaleIcon,
    emphasis: true,
    cards: [
      {
        id: "previous",
        label: "Saldo previo",
        emphasis: false,
        description: "Lo que sumaban tus cuentas al empezar el mes.",
      },
      {
        id: "current",
        label: "Actual",
        description:
          "Saldo previo más lo cobrado menos lo pagado en el mes, sumando todas tus cuentas.",
      },
      {
        id: "target",
        label: "Objetivo",
        description:
          "Cómo terminaría el mes pagando lo pendiente y, si lo sumás, cobrando lo que falta.",
      },
    ],
  },
```

and delete `wallet: ZERO,` and `available: ZERO,` from `EMPTY_ROWS`.

`components/Summary/utils.ts`: in `toSummaryRows` delete `wallet`/`available` from the destructuring and from the returned object.

`components/Summary/components/CurrencySection/utils.ts`: replace the body of `valueFor` after the expenses line with:

```ts
if (card.id === "previous") return summary.previous;

return card.id === "target" ? summary.target : summary.current;
```

and update its comment ("…and the remainders hang directly from the summary row.").

- [ ] **Step 6: Run and see them pass**

Run: `npx vitest run core/balances core/summary components/Summary app/dashboard/overview`
Expected: PASS.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/balances core/summary components/Summary app/dashboard/overview`, then `npx vitest run` and `npm run lint`
Expected: all green. `rg -n "wallet|available|Billetera|Total disponible" core/summary components/Summary` prints nothing.

### Task 3: The opening balance per account

The opening balance moves from (currency, medium) to one amount per account, one month for all. A small migration relaxes the old columns (their removal is the contract's job) and adds the new unique key. The editor lists the user's active accounts (and the archived ones that already have an amount), grouped by bank.

**Files:**

- Test: `prisma/schema.test.ts`, `core/balances/schema.test.ts`, `core/balances/service.test.ts`, `core/balances/actions.test.ts`, `components/Summary/utils.test.ts`, `components/Summary/components/OpeningBalanceDrawer/{utils.test.ts,OpeningBalanceDrawer.test.tsx}`, `components/Summary/Summary.test.tsx`, `app/dashboard/overview/loadSummaryView.test.ts`
- Create: `prisma/migrations/20261006120000_opening_balance_per_account/migration.sql`, `components/Summary/components/OpeningBalanceDrawer/components/BankFields/{BankFields.tsx,styles.ts,index.ts}`
- Modify: `prisma/schema.prisma`, `core/balances/{types,schema,service,actions,consts}.ts`, `components/Summary/utils.ts`, `components/Summary/components/OpeningBalanceDrawer/{types,consts,utils}.ts`, `.../OpeningBalanceContent.tsx`, `.../index.ts`
- Delete: `components/Summary/components/OpeningBalanceDrawer/components/CurrencyFields/` (`CurrencyFields.tsx`, `styles.ts`, `index.ts`)

**Interfaces:**

- Consumes: `AccountAmount`, `AccountOpening` (Task 1), `ensureDefaultCash` (stage 1), `AccountNotFoundError`, `AccountCurrencyMismatchError` (stage 2a Task 2).
- Produces:
  - Prisma: `OpeningBalance.currency String?`, `OpeningBalance.medium PaymentMedium?`, `@@unique([userId, accountId])` (Prisma input `userId_accountId`); the old `@@unique([userId, currency, medium])` stays until Task 11.
  - `core/balances/types.ts`: `type OpeningAmount = AccountAmount`, `type OpeningBalances = AccountOpening` (replacing the old interfaces), `OpeningAccount { accountId; bankName; accountName; currency; archived }`, `OpeningBalanceEditorData { opening: OpeningBalances | null; accounts: OpeningAccount[] }`.
  - `core/balances/schema.ts`: payload `{ month, balances: { accountId, currency, amount }[] }` → `OpeningBalanceInput { month; amounts: OpeningAmount[] }`; error paths `balances.<i>.amount` and `balances.<i>.accountId`.
  - `core/balances/service.ts`: `getOpeningBalances(userId, db = prisma)` (reads the currency through the account), `saveOpeningBalances(userId, input)` (checks every account is the user's and in the row's currency, then replaces the rows), `getOpeningBalanceEditorData(userId)`.
  - `core/balances/consts.ts`: `MAX_OPENING_ACCOUNTS = 200`, `REPEATED_ACCOUNT_MESSAGE = "Esta cuenta está repetida."`, `OPENING_ACCOUNTS_CHANGED_MESSAGE = "Tus cuentas cambiaron mientras editabas. Cerrá el saldo inicial y volvé a abrirlo."` (`MAX_OPENING_CURRENCIES` and `DUPLICATE_CURRENCY_MESSAGE` are deleted).
  - Drawer: `OpeningAccountRow { index; accountId; currency; label; amount }`, `OpeningBankGroup { bankName; rows }`, `OpeningBalanceData { month: string | null; groups: OpeningBankGroup[] }`, `OpeningBalancePayload { month; balances: { accountId; currency; amount }[] }`, `amountFieldName(index): string` (= `balances.<index>.amount`), `openingRowLabel(accountName, currency, archived): string`, `toPayload(formData, groups)`.

- [ ] **Step 1: Write the failing schema test.** Append to `prisma/schema.test.ts`:

```ts
describe("model OpeningBalance per account", () => {
  const opening = modelBlock("OpeningBalance");

  it("keeps one amount per account and user", () => {
    expect(opening).toContain("@@unique([userId, accountId])");
  });

  it("no longer requires a currency or a medium (the account has the currency)", () => {
    expect(opening).toMatch(/currency\s+String\?/);
    expect(opening).toMatch(/medium\s+PaymentMedium\?/);
  });
});
```

Run: `npx vitest run prisma/schema.test.ts` → FAIL (both tests).

- [ ] **Step 2: Migration and schema.** Snapshot: `cp prisma/schema.prisma "${TMPDIR:-/tmp}/schema-before-2b-3.prisma"`. In `model OpeningBalance` change `  currency  String` to `  currency  String?`, `  medium    PaymentMedium` to `  medium    PaymentMedium?`, replace the comment above the model with

```prisma
// The money the user held at the START of `month`, one row per account. Every row of a user shares
// the same month. Earlier months do not count and later ones accumulate on top of it. `currency` and
// `medium` are left over from the per-currency version and are dropped by the contract migration.
```

and add `  @@unique([userId, accountId])` after `  @@unique([userId, currency, medium])`. Run `npx prisma format`.

Create `prisma/migrations/20261006120000_opening_balance_per_account/migration.sql`:

```sql
-- The opening balance moves from (currency, medium) to one row per account. The table is empty (the
-- controller re-checks it right before applying), so nothing is translated. The old columns stay,
-- nullable, until the contract migration drops them.

-- AlterTable
ALTER TABLE "OpeningBalance" ALTER COLUMN "currency" DROP NOT NULL,
ALTER COLUMN "medium" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "OpeningBalance_userId_accountId_key" ON "OpeningBalance"("userId", "accountId");
```

Run: `npx prisma migrate diff --from-schema "${TMPDIR:-/tmp}/schema-before-2b-3.prisma" --to-schema prisma/schema.prisma --script` → the same two statements (spacing may differ). Run `npx prisma validate` and `npx prisma generate`. Run: `npx vitest run prisma/schema.test.ts` → PASS. (`npx tsc --noEmit` now fails in `core/balances/service.ts`: `currency`/`medium` became nullable. The next steps rewrite that file.) Report the migration path to the controller; do not apply it.

- [ ] **Step 3: Write the failing core tests.** Replace `core/balances/schema.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { openingBalanceInputSchema } from "./schema";

const row = (accountId: string, currency: string, amount: string) => ({
  accountId,
  currency,
  amount,
});

const valid = {
  month: "2026-06",
  balances: [row("acc_bank", "ARS", "1500.50"), row("acc_cash", "ARS", "200")],
};

const issuePaths = (input: unknown): string[] => {
  const result = openingBalanceInputSchema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."));
};

describe("openingBalanceInputSchema", () => {
  it("turns each account's amount into minor units of its currency", () => {
    expect(openingBalanceInputSchema.parse(valid)).toEqual({
      month: "2026-06",
      amounts: [
        { accountId: "acc_bank", currency: "ARS", amount: 150050 },
        { accountId: "acc_cash", currency: "ARS", amount: 20000 },
      ],
    });
  });

  it("respects the decimals of each currency", () => {
    expect(
      openingBalanceInputSchema.parse({
        month: "2026-06",
        balances: [row("acc_yen", "JPY", "1500")],
      }).amounts,
    ).toEqual([{ accountId: "acc_yen", currency: "JPY", amount: 1500 }]);
  });

  it("leaves out an amount that is empty or only spaces: it means no amount", () => {
    expect(
      openingBalanceInputSchema.parse({
        month: "2026-06",
        balances: [row("acc_bank", "ARS", "   ")],
      }).amounts,
    ).toEqual([]);
  });

  it("keeps an explicit zero: it is an amount, not a missing one", () => {
    expect(
      openingBalanceInputSchema.parse({
        month: "2026-06",
        balances: [row("acc_bank", "ARS", "0")],
      }).amounts,
    ).toEqual([{ accountId: "acc_bank", currency: "ARS", amount: 0 }]);
  });

  it("accepts no account at all: that clears the opening balance", () => {
    expect(
      openingBalanceInputSchema.parse({ month: "2026-06", balances: [] })
        .amounts,
    ).toEqual([]);
  });

  it("rejects a negative amount, a word and too many decimals, pointing at the field", () => {
    for (const amount of ["-5", "abc", "1.005"]) {
      expect(
        issuePaths({ ...valid, balances: [row("acc_bank", "ARS", amount)] }),
      ).toEqual(["balances.0.amount"]);
    }
  });

  it("says what is wrong with an amount, in Spanish", () => {
    const result = openingBalanceInputSchema.safeParse({
      ...valid,
      balances: [row("acc_bank", "ARS", "x")],
    });

    expect(result.error?.issues[0].message).toBe(
      "Ingresa un monto válido, con dígitos y un punto para los decimales.",
    );
  });

  it.each(["2026-13", "2026-6", "1999-12", "2100-01", "", "junio"])(
    "rejects the month %j",
    (month) => {
      expect(issuePaths({ ...valid, month })).toEqual(["month"]);
    },
  );

  it("rejects a currency that is not supported", () => {
    expect(
      issuePaths({ ...valid, balances: [row("acc_bank", "XXX", "1")] }),
    ).toEqual(["balances.0.currency"]);
  });

  it("rejects the same account twice", () => {
    expect(
      issuePaths({
        ...valid,
        balances: [row("acc_bank", "ARS", "1"), row("acc_bank", "ARS", "2")],
      }),
    ).toEqual(["balances.1.accountId"]);
  });

  it("rejects a row without an account", () => {
    expect(issuePaths({ ...valid, balances: [row("  ", "ARS", "1")] })).toEqual(
      ["balances.0.accountId"],
    );
  });

  it("rejects more rows than any user has accounts", () => {
    expect(
      issuePaths({
        month: "2026-06",
        balances: Array.from({ length: 201 }, (_, index) =>
          row(`acc_${index}`, "ARS", "1"),
        ),
      }),
    ).toEqual(["balances"]);
  });

  it("rejects something that is not a list of balances", () => {
    expect(issuePaths({ ...valid, balances: "nope" })).toEqual(["balances"]);
    expect(issuePaths(null)).not.toEqual([]);
  });
});
```

Replace `core/balances/service.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are
  // observed on the same mocks.
  $transaction: vi.fn(),
  openingBalance: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  account: { findMany: vi.fn() },
}));
const defaultCash = vi.hoisted(() => ({ ensureDefaultCash: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/accounts/defaultCash", () => defaultCash);

import {
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "@/core/accounts/errors";

import {
  getOpeningBalanceEditorData,
  getOpeningBalances,
  saveOpeningBalances,
} from "./service";

const { openingBalance, account } = db;

const USER_ID = "user_123";
const AT = new Date("2026-10-04T12:00:00.000Z");

const openingRow = (
  accountId: string,
  currency: string,
  amount: number,
  month = "2026-06",
) => ({
  id: `ob_${accountId}`,
  userId: USER_ID,
  accountId,
  account: { currency },
  amount: BigInt(amount),
  month,
});

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  openingBalance.findMany.mockResolvedValue([]);
  openingBalance.upsert.mockResolvedValue({});
  openingBalance.deleteMany.mockResolvedValue({ count: 0 });
  account.findMany.mockResolvedValue([]);
});

describe("getOpeningBalances", () => {
  it("reads only the user's own rows, with the currency of each account", async () => {
    await getOpeningBalances(USER_ID);

    expect(openingBalance.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      include: { account: { select: { currency: true } } },
    });
  });

  it("is null when the user never set one", async () => {
    await expect(getOpeningBalances(USER_ID)).resolves.toBeNull();
  });

  it("gives the shared month and one amount per account, as plain numbers", async () => {
    openingBalance.findMany.mockResolvedValue([
      openingRow("acc_bank", "ARS", 5000050),
      openingRow("acc_usd", "USD", 12000),
    ]);

    await expect(getOpeningBalances(USER_ID)).resolves.toEqual({
      month: "2026-06",
      amounts: [
        { accountId: "acc_bank", currency: "ARS", amount: 5000050 },
        { accountId: "acc_usd", currency: "USD", amount: 12000 },
      ],
    });
  });

  it("reads through the client it is given (a transaction, for the archive rule)", async () => {
    const tx = { openingBalance: { findMany: vi.fn().mockResolvedValue([]) } };

    await getOpeningBalances(USER_ID, tx as never);

    expect(tx.openingBalance.findMany).toHaveBeenCalledTimes(1);
    expect(openingBalance.findMany).not.toHaveBeenCalled();
  });
});

describe("saveOpeningBalances", () => {
  const input = {
    month: "2026-06",
    amounts: [
      { accountId: "acc_bank", currency: "ARS", amount: 5000 },
      { accountId: "acc_cash", currency: "ARS", amount: 0 },
    ],
  };

  beforeEach(() => {
    account.findMany.mockResolvedValue([
      { id: "acc_bank", currency: "ARS" },
      { id: "acc_cash", currency: "ARS" },
    ]);
  });

  it("checks the accounts among the user's own before writing", async () => {
    await saveOpeningBalances(USER_ID, input);

    expect(account.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, id: { in: ["acc_bank", "acc_cash"] } },
      select: { id: true, currency: true },
    });
  });

  it("upserts one row per account, all with the same month", async () => {
    await saveOpeningBalances(USER_ID, input);

    expect(openingBalance.upsert).toHaveBeenCalledTimes(2);
    expect(openingBalance.upsert).toHaveBeenCalledWith({
      where: { userId_accountId: { userId: USER_ID, accountId: "acc_bank" } },
      create: {
        userId: USER_ID,
        accountId: "acc_bank",
        amount: BigInt(5000),
        month: "2026-06",
      },
      update: { amount: BigInt(5000), month: "2026-06" },
    });
  });

  it("removes the user's other rows, so what was cleared stops counting", async () => {
    await saveOpeningBalances(USER_ID, input);

    expect(openingBalance.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        NOT: { accountId: { in: ["acc_bank", "acc_cash"] } },
      },
    });
  });

  it("removes every row of the user when there is no amount left, without reading accounts", async () => {
    await saveOpeningBalances(USER_ID, { month: "2026-06", amounts: [] });

    expect(account.findMany).not.toHaveBeenCalled();
    expect(openingBalance.upsert).not.toHaveBeenCalled();
    expect(openingBalance.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
  });

  it("refuses an account that is not the user's (or is gone), writing nothing", async () => {
    account.findMany.mockResolvedValue([{ id: "acc_bank", currency: "ARS" }]);

    await expect(saveOpeningBalances(USER_ID, input)).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
    expect(openingBalance.deleteMany).not.toHaveBeenCalled();
    expect(openingBalance.upsert).not.toHaveBeenCalled();
  });

  it("refuses an amount in another currency than its account, writing nothing", async () => {
    account.findMany.mockResolvedValue([
      { id: "acc_bank", currency: "USD" },
      { id: "acc_cash", currency: "ARS" },
    ]);

    await expect(saveOpeningBalances(USER_ID, input)).rejects.toBeInstanceOf(
      AccountCurrencyMismatchError,
    );
    expect(openingBalance.upsert).not.toHaveBeenCalled();
  });

  it("does it all in one transaction", async () => {
    await saveOpeningBalances(USER_ID, input);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("getOpeningBalanceEditorData", () => {
  it("seeds the default cash account first, so there is always a row to fill", async () => {
    await getOpeningBalanceEditorData(USER_ID);

    expect(defaultCash.ensureDefaultCash).toHaveBeenCalledWith(USER_ID);
  });

  it("offers the user's active accounts and the archived ones that already have an amount, grouped by bank", async () => {
    await getOpeningBalanceEditorData(USER_ID);

    expect(account.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        OR: [{ archivedAt: null }, { openingBalances: { some: {} } }],
      },
      include: { bank: { select: { name: true } } },
      orderBy: [
        { bank: { createdAt: "asc" } },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });
  });

  it("names each account with its bank and says whether it is archived", async () => {
    account.findMany.mockResolvedValue([
      {
        id: "acc_bank",
        name: "Caja de ahorro",
        currency: "ARS",
        archivedAt: null,
        bank: { name: "Banco Galicia" },
      },
      {
        id: "acc_old",
        name: "Vieja",
        currency: "USD",
        archivedAt: AT,
        bank: { name: "Banco Galicia" },
      },
    ]);
    openingBalance.findMany.mockResolvedValue([
      openingRow("acc_old", "USD", 100),
    ]);

    await expect(getOpeningBalanceEditorData(USER_ID)).resolves.toEqual({
      opening: {
        month: "2026-06",
        amounts: [{ accountId: "acc_old", currency: "USD", amount: 100 }],
      },
      accounts: [
        {
          accountId: "acc_bank",
          bankName: "Banco Galicia",
          accountName: "Caja de ahorro",
          currency: "ARS",
          archived: false,
        },
        {
          accountId: "acc_old",
          bankName: "Banco Galicia",
          accountName: "Vieja",
          currency: "USD",
          archived: true,
        },
      ],
    });
  });
});
```

In `core/balances/actions.test.ts`: change `payload` to `{ month: "2026-06", balances: [{ accountId: "acc_bank", currency: "ARS", amount: "1500.50" }, { accountId: "acc_cash", currency: "ARS", amount: "200" }] }`; the expected amounts become `[{ accountId: "acc_bank", currency: "ARS", amount: 150050 }, { accountId: "acc_cash", currency: "ARS", amount: 20000 }]`; in `"points at the field with an invalid amount and saves nothing"` use `balances: [{ accountId: "acc_bank", currency: "ARS", amount: "-3" }]` and the field key `"balances.0.amount"`; add:

```ts
it("asks to reopen the editor when an account changed meanwhile (gone, another user's or another currency)", async () => {
  for (const error of [
    new AccountNotFoundError(),
    new AccountCurrencyMismatchError(),
  ]) {
    mocks.saveOpeningBalances.mockRejectedValueOnce(error);

    expect(await saveOpeningBalanceAction(payload)).toEqual({
      status: "error",
      message:
        "Tus cuentas cambiaron mientras editabas. Cerrá el saldo inicial y volvé a abrirlo.",
    });
  }
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
});
```

with `import { AccountCurrencyMismatchError, AccountNotFoundError } from "@/core/accounts/errors";`.

The opening amounts now carry an account, so two tests that build them change shape here (their expectations stay the same):

- `core/balances/previous.test.ts`: replace the `opening` helper with

```ts
const opening = (
  month: string,
  ...amounts: [string, number, string?][]
): OpeningBalances => ({
  month,
  amounts: amounts.map(([currency, amount, accountId = `acc_${currency}`]) => ({
    accountId,
    currency,
    amount,
  })),
});
```

and rewrite its calls: `["ARS", "DIGITAL", 50000], ["ARS", "CASH", 8000]` → `["ARS", 50000, "acc_bank"], ["ARS", 8000, "acc_cash"]`; `["USD", "DIGITAL", 0]` → `["USD", 0]`; `["ARS", "DIGITAL", 1000]` → `["ARS", 1000]`.

- `core/summary/service.test.ts`: replace the `openingRow` helper with the shared `openingRow(accountId, currency, amount, month)` fixture of this plan (with `userId: USER_ID`) and rewrite its calls (`openingRow("ARS", "DIGITAL", 100, "2026-01")` → `openingRow("acc_ARS", "ARS", 100, "2026-01")`; the two ARS rows of `"starts from the opening amounts and adds what happened since"` → `openingRow("acc_bank", "ARS", 50000, "2026-06")` and `openingRow("acc_cash", "ARS", 8000, "2026-06")`; `openingRow("EUR", "CASH", 900, "2026-09")` → `openingRow("acc_EUR", "EUR", 900, "2026-09")`), and change the expectation of `"never reaches another user's rows ..."` to `toHaveBeenCalledWith({ where: { userId: USER_ID }, include: { account: { select: { currency: true } } } })`.

- [ ] **Step 4: Write the failing UI tests.**

`components/Summary/components/OpeningBalanceDrawer/utils.test.ts`: keep `describe("monthOptions", ...)`; replace the rest with:

```ts
describe("amountFieldName", () => {
  it("names a field after its row, as the server reports its errors", () => {
    expect(amountFieldName(0)).toBe("balances.0.amount");
    expect(amountFieldName(4)).toBe("balances.4.amount");
  });
});

describe("openingRowLabel", () => {
  it("names the account with its currency", () => {
    expect(openingRowLabel("Caja de ahorro", "ARS", false)).toBe(
      "Caja de ahorro (ARS)",
    );
  });

  it("says when the account is archived", () => {
    expect(openingRowLabel("Vieja", "USD", true)).toBe(
      "Vieja (USD) · archivada",
    );
  });
});

describe("toPayload", () => {
  const GROUPS = [
    {
      bankName: "Banco Galicia",
      rows: [
        {
          index: 0,
          accountId: "acc_bank",
          currency: "ARS",
          label: "Caja de ahorro (ARS)",
          amount: "",
        },
        {
          index: 1,
          accountId: "acc_usd",
          currency: "USD",
          label: "Dólares (USD)",
          amount: "",
        },
      ],
    },
    {
      bankName: "Efectivo",
      rows: [
        {
          index: 2,
          accountId: "acc_cash",
          currency: "ARS",
          label: "Efectivo (ARS)",
          amount: "",
        },
      ],
    },
  ];

  const form = (entries: Record<string, string>) => {
    const formData = new FormData();

    Object.entries(entries).forEach(([key, value]) => formData.set(key, value));

    return formData;
  };

  it("sends the month and one row per account, every bank together, as typed", () => {
    expect(
      toPayload(
        form({
          month: "2026-06",
          "balances.0.amount": "1500.50",
          "balances.2.amount": "200",
        }),
        GROUPS,
      ),
    ).toEqual({
      month: "2026-06",
      balances: [
        { accountId: "acc_bank", currency: "ARS", amount: "1500.50" },
        { accountId: "acc_usd", currency: "USD", amount: "" },
        { accountId: "acc_cash", currency: "ARS", amount: "200" },
      ],
    });
  });
});
```

with the import line `import { amountFieldName, monthOptions, openingRowLabel, toPayload } from "./utils";`.

`components/Summary/utils.test.ts`: replace `describe("toOpeningBalanceData", ...)` with:

```ts
describe("toOpeningBalanceData", () => {
  const ACCOUNTS = [
    {
      accountId: "acc_bank",
      bankName: "Banco Galicia",
      accountName: "Caja de ahorro",
      currency: "ARS",
      archived: false,
    },
    {
      accountId: "acc_usd",
      bankName: "Banco Galicia",
      accountName: "Dólares",
      currency: "USD",
      archived: false,
    },
    {
      accountId: "acc_cash",
      bankName: "Efectivo",
      accountName: "Efectivo",
      currency: "ARS",
      archived: false,
    },
    {
      accountId: "acc_old",
      bankName: "Efectivo",
      accountName: "Vieja",
      currency: "ARS",
      archived: true,
    },
  ];

  it("groups the accounts by bank, in order, numbering every row", () => {
    const { groups } = toOpeningBalanceData({
      opening: null,
      accounts: ACCOUNTS,
    });

    expect(
      groups.map(({ bankName, rows }) => [
        bankName,
        rows.map((row) => row.index),
      ]),
    ).toEqual([
      ["Banco Galicia", [0, 1]],
      ["Efectivo", [2, 3]],
    ]);
  });

  it("starts every amount empty, and the month unset, when nothing was saved", () => {
    const data = toOpeningBalanceData({ opening: null, accounts: ACCOUNTS });

    expect(data.month).toBeNull();
    expect(
      data.groups.flatMap(({ rows }) => rows.map((row) => row.amount)),
    ).toEqual(["", "", "", ""]);
  });

  it("prefills each saved amount as plain decimal text, with the month it is valid from", () => {
    const data = toOpeningBalanceData({
      opening: {
        month: "2026-06",
        amounts: [
          { accountId: "acc_bank", currency: "ARS", amount: 500050 },
          { accountId: "acc_old", currency: "ARS", amount: 0 },
        ],
      },
      accounts: ACCOUNTS,
    });

    expect(data.month).toBe("2026-06");
    expect(data.groups[0].rows[0]).toEqual({
      index: 0,
      accountId: "acc_bank",
      currency: "ARS",
      label: "Caja de ahorro (ARS)",
      amount: "5000.50",
    });
    // An explicit zero stays a zero, not an empty field; an archived account says so.
    expect(data.groups[1].rows[1]).toMatchObject({
      label: "Vieja (ARS) · archivada",
      amount: "0.00",
    });
  });
});
```

Replace `components/Summary/components/OpeningBalanceDrawer/OpeningBalanceDrawer.test.tsx`'s fixtures and amount tests (keep the header and month describes and the saving tests' structure):

```ts
const row = (
  index: number,
  accountId: string,
  label: string,
  amount = "",
  currency = "ARS",
) => ({ index, accountId, currency, label, amount });

const EMPTY: OpeningBalanceData = {
  month: null,
  groups: [
    { bankName: "Efectivo", rows: [row(0, "acc_cash", "Efectivo (ARS)")] },
  ],
};

const SAVED: OpeningBalanceData = {
  month: "2026-06",
  groups: [
    {
      bankName: "Banco Galicia",
      rows: [
        row(0, "acc_bank", "Caja de ahorro (ARS)", "5000.50"),
        row(1, "acc_usd", "Dólares (USD)", "", "USD"),
      ],
    },
    {
      bankName: "Efectivo",
      rows: [row(2, "acc_cash", "Efectivo (ARS)", "800")],
    },
  ],
};

const group = (bankName: string) =>
  within(screen.getByRole("group", { name: bankName }));

const saved = () =>
  actions.saveOpeningBalanceAction.mock.calls[0][0] as {
    month: string;
    balances: { accountId: string; currency: string; amount: string }[];
  };
```

```ts
describe("OpeningBalanceDrawer amounts", () => {
  it("gives every bank a group with one input per account", () => {
    renderDrawer(SAVED);

    expect(
      group("Banco Galicia").getByLabelText(/Caja de ahorro \(ARS\)/),
    ).toBeInTheDocument();
    expect(
      group("Banco Galicia").getByLabelText(/Dólares \(USD\)/),
    ).toBeInTheDocument();
    expect(
      group("Efectivo").getByLabelText(/Efectivo \(ARS\)/),
    ).toBeInTheDocument();
  });

  it("asks no Digital nor Efectivo split any more", () => {
    renderDrawer(SAVED);

    expect(screen.queryByLabelText(/^Digital/)).not.toBeInTheDocument();
  });

  it("prefills the saved amounts", () => {
    renderDrawer(SAVED);

    expect(group("Banco Galicia").getByLabelText(/Caja de ahorro/)).toHaveValue(
      "5000.50",
    );
    expect(group("Banco Galicia").getByLabelText(/Dólares/)).toHaveValue("");
    expect(group("Efectivo").getByLabelText(/Efectivo \(ARS\)/)).toHaveValue(
      "800",
    );
  });
});
```

and in the saving tests: `"sends the month and what was typed, one row per currency"` → `"... one row per account"`, typing into `group("Banco Galicia").getByLabelText(/Dólares/)` the value `"10"` and expecting

```ts
expect(saved()).toEqual({
  month: "2026-06",
  balances: [
    { accountId: "acc_bank", currency: "ARS", amount: "5000.50" },
    { accountId: "acc_usd", currency: "USD", amount: "10" },
    { accountId: "acc_cash", currency: "ARS", amount: "800" },
  ],
});
```

`"sends the month in course when none was chosen"` types into `group("Efectivo").getByLabelText(/Efectivo \(ARS\)/)`; `"shows the server's message on the field it is about, and stays open"` uses the field key `"balances.1.amount"` and looks for the message in `group("Banco Galicia")`.

`components/Summary/Summary.test.tsx`: `OPENING` becomes `{ month: "2026-06", groups: [{ bankName: "Banco Galicia", rows: [{ index: 0, accountId: "acc_bank", currency: "ARS", label: "Caja de ahorro (ARS)", amount: "5000.50" }] }] }`; in `"opens the editor with the saved opening balance"` replace `getByLabelText(/Digital/)` with `getByLabelText(/Caja de ahorro/)`.

`app/dashboard/overview/loadSummaryView.test.ts`: the default editor data becomes `{ opening: null, accounts: [{ accountId: "acc_cash", bankName: "Efectivo", accountName: "Efectivo", currency: "ARS", archived: false }] }`; in `"loads the opening balance editor's data ..."` mock `{ opening: { month: "2026-06", amounts: [{ accountId: "acc_cash", currency: "ARS", amount: 500050 }] }, accounts: [that same account] }` and expect

```ts
await expect(view.openingBalance).resolves.toEqual({
  month: "2026-06",
  groups: [
    {
      bankName: "Efectivo",
      rows: [
        {
          index: 0,
          accountId: "acc_cash",
          currency: "ARS",
          label: "Efectivo (ARS)",
          amount: "5000.50",
        },
      ],
    },
  ],
});
```

- [ ] **Step 5: Run them and see them fail**

Run: `npx vitest run core/balances components/Summary app/dashboard/overview`
Expected: FAIL.

- [ ] **Step 6: Implement the core.**

`core/balances/types.ts`: delete the `PaymentMedium` import and the old `OpeningAmount` and `OpeningBalances` interfaces, and add after the Task 1 types:

```ts
// The opening balance as the editor and the summary read it: one amount per account, one month.
export type OpeningAmount = AccountAmount;
export type OpeningBalances = AccountOpening;

// An account the opening balance editor offers a row for.
export interface OpeningAccount {
  accountId: string;
  bankName: string;
  accountName: string;
  currency: string;
  archived: boolean;
}
```

and replace `OpeningBalanceEditorData` with

```ts
// What the opening balance editor is built from: what is saved, and the accounts it offers.
export interface OpeningBalanceEditorData {
  opening: OpeningBalances | null;
  accounts: OpeningAccount[];
}
```

and update the comment of `OpeningBalanceActionResult.fieldErrors` to `By path ("month", "balances.0.amount")`.

`core/balances/consts.ts`:

```ts
import { SUPPORTED_CURRENCY_CODES } from "@/core/incomes/consts";
```

is no longer needed; replace the file body after `OVERVIEW_PATH` with:

```ts
// More rows than any user has accounts: a forged payload cannot ask for more writes than that.
export const MAX_OPENING_ACCOUNTS = 200;

export const INVALID_MONTH_MESSAGE = "Selecciona un mes válido.";
export const INVALID_BALANCE_AMOUNT_MESSAGE =
  "Ingresa un monto válido, con dígitos y un punto para los decimales.";
export const REPEATED_ACCOUNT_MESSAGE = "Esta cuenta está repetida.";
export const ACCOUNT_ROW_REQUIRED_MESSAGE = "Falta la cuenta.";
export const INVALID_OPENING_BALANCE_MESSAGE = "Corrige los campos resaltados.";
// An account of the editor was deleted, archived away, is not the user's or changed currency while
// the editor was open: nothing is saved and the editor is reopened with fresh accounts.
export const OPENING_ACCOUNTS_CHANGED_MESSAGE =
  "Tus cuentas cambiaron mientras editabas. Cerrá el saldo inicial y volvé a abrirlo.";
```

(and delete the `SUPPORTED_CURRENCY_CODES` import line).

`core/balances/schema.ts`:

```ts
import { z } from "zod";

import { currencyField } from "@/core/entries/fields";
import { toMinorUnits } from "@/core/incomes/money";
import { isSupportedMonth } from "@/core/summary/month";

import {
  ACCOUNT_ROW_REQUIRED_MESSAGE,
  INVALID_BALANCE_AMOUNT_MESSAGE,
  INVALID_MONTH_MESSAGE,
  MAX_OPENING_ACCOUNTS,
  REPEATED_ACCOUNT_MESSAGE,
} from "./consts";
import type { OpeningAmount } from "./types";

// What the editor sends: one row per account, with the account's currency (which the service
// checks against the account) and the amount as typed (text).
const balanceRowSchema = z.object({
  accountId: z
    .string({ error: ACCOUNT_ROW_REQUIRED_MESSAGE })
    .trim()
    .min(1, ACCOUNT_ROW_REQUIRED_MESSAGE),
  currency: currencyField,
  amount: z.string().trim(),
});

export interface OpeningBalanceInput {
  month: string;
  amounts: OpeningAmount[];
}

// Validates the editor's payload and outputs the amounts in minor units. An empty amount means "no
// amount" and is left out; zero is an amount like any other, but a negative one never is.
export const openingBalanceInputSchema = z
  .object({
    month: z
      .string({ error: INVALID_MONTH_MESSAGE })
      .refine(isSupportedMonth, INVALID_MONTH_MESSAGE),
    balances: z.array(balanceRowSchema).max(MAX_OPENING_ACCOUNTS),
  })
  .transform((value, ctx): OpeningBalanceInput => {
    const amounts: OpeningAmount[] = [];
    const seen = new Set<string>();

    value.balances.forEach((row, index) => {
      if (seen.has(row.accountId)) {
        ctx.issues.push({
          code: "custom",
          input: row.accountId,
          path: ["balances", index, "accountId"],
          message: REPEATED_ACCOUNT_MESSAGE,
        });

        return;
      }

      seen.add(row.accountId);

      if (row.amount === "") {
        return;
      }

      const amount = toMinorUnits(row.amount, row.currency);

      if (amount === null) {
        ctx.issues.push({
          code: "custom",
          input: row.amount,
          path: ["balances", index, "amount"],
          message: INVALID_BALANCE_AMOUNT_MESSAGE,
        });
      } else {
        amounts.push({
          accountId: row.accountId,
          currency: row.currency,
          amount,
        });
      }
    });

    return { month: value.month, amounts };
  });
```

`core/balances/service.ts`:

```ts
import { ensureDefaultCash } from "@/core/accounts/defaultCash";
import {
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "@/core/accounts/errors";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { prisma } from "@/infrastructure/db/client";
import type { Prisma } from "@/lib/generated/prisma/client";

import type { OpeningBalanceInput } from "./schema";
import type { OpeningBalanceEditorData, OpeningBalances } from "./types";

type OpeningReader = Pick<Prisma.TransactionClient, "openingBalance">;

// The user's opening balance, or null when they never set one (the balances then accumulate from
// their first entry). Every row shares the one month; the currency is the account's. Any client
// can read it, so the archive rule reads it inside the transaction that locks the account.
export const getOpeningBalances = async (
  userId: string,
  db: OpeningReader = prisma,
): Promise<OpeningBalances | null> => {
  const rows = await db.openingBalance.findMany({
    where: { userId },
    include: { account: { select: { currency: true } } },
  });

  if (rows.length === 0) {
    return null;
  }

  return {
    month: rows[0].month,
    amounts: rows.flatMap((row) =>
      // EXPAND: a row without an account cannot exist once the contract migration ran.
      row.accountId === null || row.account === null
        ? []
        : [
            {
              accountId: row.accountId,
              currency: row.account.currency,
              amount: minorUnitsToNumber(row.amount),
            },
          ],
    ),
  };
};

// Replaces the user's opening balance with the amounts given, all valid from the same month. The
// client sends account ids and currencies, so neither is trusted: every account must be the user's
// and in the currency of its row, or nothing is written. Each amount is created or updated, and any
// other row of the user is removed, so whatever was cleared stops counting. One transaction, so the
// rows never end up with different months.
export const saveOpeningBalances = async (
  userId: string,
  { month, amounts }: OpeningBalanceInput,
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const accountIds = amounts.map(({ accountId }) => accountId);

    if (accountIds.length > 0) {
      const accounts = await tx.account.findMany({
        where: { userId, id: { in: accountIds } },
        select: { id: true, currency: true },
      });
      const currencyOf = new Map(
        accounts.map(({ id, currency }) => [id, currency]),
      );

      for (const { accountId, currency } of amounts) {
        const owned = currencyOf.get(accountId);

        if (owned === undefined) {
          throw new AccountNotFoundError();
        }

        if (owned !== currency) {
          throw new AccountCurrencyMismatchError();
        }
      }
    }

    await tx.openingBalance.deleteMany({
      where:
        accountIds.length === 0
          ? { userId }
          : { userId, NOT: { accountId: { in: accountIds } } },
    });

    for (const { accountId, amount } of amounts) {
      await tx.openingBalance.upsert({
        where: { userId_accountId: { userId, accountId } },
        create: { userId, accountId, amount: BigInt(amount), month },
        update: { amount: BigInt(amount), month },
      });
    }
  });
};

// Everything the opening balance editor needs: what is saved, and a row for every active account of
// the user plus every archived one that already has an amount (so it can be corrected), in the order
// of the Banks board. The default cash account is seeded first, so there is always one row.
export const getOpeningBalanceEditorData = async (
  userId: string,
): Promise<OpeningBalanceEditorData> => {
  await ensureDefaultCash(userId);

  const [opening, rows] = await Promise.all([
    getOpeningBalances(userId),
    prisma.account.findMany({
      where: {
        userId,
        OR: [{ archivedAt: null }, { openingBalances: { some: {} } }],
      },
      include: { bank: { select: { name: true } } },
      orderBy: [
        { bank: { createdAt: "asc" } },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    }),
  ]);

  return {
    opening,
    accounts: rows.map((row) => ({
      accountId: row.id,
      bankName: row.bank.name,
      accountName: row.name,
      currency: row.currency,
      archived: row.archivedAt !== null,
    })),
  };
};
```

`core/balances/actions.ts`: import `AccountCurrencyMismatchError`, `AccountNotFoundError` and `OPENING_ACCOUNTS_CHANGED_MESSAGE`; replace `await saveOpeningBalances(userId, parsed.data);` with

```ts
try {
  await saveOpeningBalances(userId, parsed.data);
} catch (error) {
  // An account of the editor changed while it was open: the user reopens it with fresh rows.
  if (
    error instanceof AccountNotFoundError ||
    error instanceof AccountCurrencyMismatchError
  ) {
    return failure(OPENING_ACCOUNTS_CHANGED_MESSAGE);
  }

  throw error;
}
```

and change the comment above the action to "one call carries the month and every account's amount."

- [ ] **Step 7: Implement the editor.**

`OpeningBalanceDrawer/types.ts`: replace `OpeningBalanceRow`, `OpeningBalanceData`, `OpeningBalancePayload` and `CurrencyFieldsProps` with:

```ts
// One account of the opening balance editor. `index` is its position among all the rows: the input
// is named by it, which is how the server points at the one in error. `amount` is decimal text
// ("1500.50") ready to prefill the input, or "" when there is none saved.
export interface OpeningAccountRow {
  index: number;
  accountId: string;
  currency: string;
  // "Caja de ahorro (ARS)", with "· archivada" for an archived account.
  label: string;
  amount: string;
}

// The accounts of one bank, as one group of the editor.
export interface OpeningBankGroup {
  bankName: string;
  rows: OpeningAccountRow[];
}

// What the editor starts from: the month the saved opening balance is valid from (null when there
// is none) and the accounts it offers, grouped by bank.
export interface OpeningBalanceData {
  month: string | null;
  groups: OpeningBankGroup[];
}

// What "Guardar" sends to the server, amounts exactly as typed, one row per account.
export interface OpeningBalancePayload {
  month: string;
  balances: { accountId: string; currency: string; amount: string }[];
}

export interface BankFieldsProps {
  group: OpeningBankGroup;
}
```

`OpeningBalanceDrawer/consts.ts`: replace `DIGITAL_LABEL` and `CASH_LABEL` with `export const ARCHIVED_ACCOUNT_SUFFIX = " · archivada";` and change `DESCRIPTION` to `"Cuánto tenía cada cuenta al empezar el mes que elijas. Los meses anteriores dejan de contar."` (update the header test of `OpeningBalanceDrawer.test.tsx` to this text).

`OpeningBalanceDrawer/utils.ts`: import `ARCHIVED_ACCOUNT_SUFFIX`; replace `amountFieldName` and `toPayload` with:

```ts
// The name of an amount input. It is the path the server reports its errors under, so a message
// lands on the field it is about.
export const amountFieldName = (index: number): string =>
  `balances.${index}.amount`;

// "Caja de ahorro (ARS)", or "Vieja (USD) · archivada".
export const openingRowLabel = (
  accountName: string,
  currency: string,
  archived: boolean,
): string =>
  `${accountName} (${currency})${archived ? ARCHIVED_ACCOUNT_SUFFIX : ""}`;

const textOf = (formData: FormData, name: string): string => {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
};

// Reads the form into what the save action takes: the month and one row per account.
export const toPayload = (
  formData: FormData,
  groups: readonly OpeningBankGroup[],
): OpeningBalancePayload => ({
  month: textOf(formData, MONTH_FIELD_NAME),
  balances: groups.flatMap(({ rows }) =>
    rows.map(({ index, accountId, currency }) => ({
      accountId,
      currency,
      amount: textOf(formData, amountFieldName(index)),
    })),
  ),
});
```

(fix the type imports: `MonthOption`, `OpeningBalancePayload`, `OpeningBankGroup`).

Delete `components/CurrencyFields/`. Create `components/BankFields/styles.ts`:

```ts
// The accounts of a bank side by side from `sm` up, stacked on a phone.
export const GROUP_CLASS_NAME = "grid grid-cols-1 gap-4 sm:grid-cols-2";
```

`components/BankFields/BankFields.tsx`:

```tsx
import {
  Description,
  FieldError,
  FieldGroup,
  Fieldset,
  Input,
  Label,
  TextField,
} from "@heroui/react";

import {
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
} from "@/components/Entries/styles";

import { AMOUNT_HINT, AMOUNT_PLACEHOLDER } from "../../consts";
import type { BankFieldsProps } from "../../types";
import { amountFieldName } from "../../utils";
import { GROUP_CLASS_NAME } from "./styles";

// One bank of the opening balance: what each of its accounts held. The inputs are named by their
// position among all the rows, which is how the server points at the one in error.
export function BankFields({ group }: BankFieldsProps) {
  return (
    <Fieldset>
      <Fieldset.Legend>{group.bankName}</Fieldset.Legend>
      <FieldGroup className={GROUP_CLASS_NAME}>
        {group.rows.map((row) => (
          <TextField
            key={row.accountId}
            className={FIELD_CLASS_NAME}
            name={amountFieldName(row.index)}
            inputMode="decimal"
            defaultValue={row.amount}
          >
            <Label>{row.label}</Label>
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              placeholder={AMOUNT_PLACEHOLDER}
            />
            <FieldError />
          </TextField>
        ))}
      </FieldGroup>
      <Description>{AMOUNT_HINT}</Description>
    </Fieldset>
  );
}
```

`components/BankFields/index.ts`: `export { BankFields } from "./BankFields";`

`OpeningBalanceContent.tsx`: import `BankFields` instead of `CurrencyFields`; `toPayload(new FormData(event.currentTarget), data.groups)`; replace the rows map with

```tsx
{
  data.groups.map((group) => <BankFields key={group.bankName} group={group} />);
}
```

`OpeningBalanceDrawer/index.ts`: `export type { OpeningAccountRow, OpeningBalanceData, OpeningBankGroup } from "./types";` (replacing `OpeningBalanceRow`), and export `openingRowLabel`: `export { openingRowLabel } from "./utils";`. Update the drawer component's comment ("how much each account held when the month they choose began").

`components/Summary/utils.ts`: delete the `PaymentMedium` import; import `openingRowLabel` and the types `OpeningBalanceData`, `OpeningBankGroup` from `./components/OpeningBalanceDrawer`; replace `toOpeningBalanceData` with:

```ts
// What the opening balance editor starts from: the accounts it offers, grouped by bank in the order
// given (the Banks board's), each with its saved amount as plain decimal text, or empty when none is
// saved. Every row is numbered across all the groups: that number names its input.
export const toOpeningBalanceData = ({
  opening,
  accounts,
}: OpeningBalanceEditorData): OpeningBalanceData => {
  const saved = new Map(
    (opening?.amounts ?? []).map((amount) => [amount.accountId, amount]),
  );
  const groups: OpeningBankGroup[] = [];

  accounts.forEach((account, index) => {
    const amount = saved.get(account.accountId);
    const row = {
      index,
      accountId: account.accountId,
      currency: account.currency,
      label: openingRowLabel(
        account.accountName,
        account.currency,
        account.archived,
      ),
      amount: amount ? toDecimalString(amount.amount, account.currency) : "",
    };
    const last = groups[groups.length - 1];

    if (last && last.bankName === account.bankName) {
      last.rows.push(row);
    } else {
      groups.push({ bankName: account.bankName, rows: [row] });
    }
  });

  return { month: opening?.month ?? null, groups };
};
```

- [ ] **Step 8: Run and see them pass**

Run: `npx vitest run core/balances core/summary components/Summary app/dashboard/overview prisma components/componentStructure.test.ts`
Expected: PASS (`core/summary` keeps working: `previousBalances` only reads `currency` and `amount` of the opening amounts).

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/balances components/Summary app/dashboard/overview`, then `npx vitest run` and `npm run lint`
Expected: all green.

### Task 4: The summary's Saldo previo goes through the accounts

The previous balance of a currency becomes, by construction, the sum of its accounts' previous balances: the earlier settled entries are grouped by account and folded by `previousAccountBalances` + `totalsByCurrency`.

**Files:**

- Test: `core/balances/previous.test.ts`, `core/summary/service.test.ts`
- Modify: `core/balances/{previous,types}.ts`, `core/summary/service.ts`

**Interfaces:**

- Consumes: `previousAccountBalances`, `totalsByCurrency`, `AccountFlow` (Task 1), `OpeningBalances` (Task 3).
- Produces: `previousBalances(month, opening, flows: readonly AccountFlow[]): PreviousBalance[]` (same output as before); `SettledFlow` is deleted; `getMonthlySummary` reads the earlier settled entries grouped by `["accountId", "currency"]`.

- [ ] **Step 1: Write the failing tests.** In `core/balances/previous.test.ts` change the `flow` helper to

```ts
const flow = (
  currency: string,
  kind: AccountFlow["kind"],
  amount: number,
  accountId = `acc_${currency}`,
): AccountFlow => ({ accountId, currency, kind, amount });
```

(import `AccountFlow` instead of `SettledFlow`; every expected value stays the same); then add:

```ts
describe("previousBalances is the sum of the accounts", () => {
  it("adds the previous balance of every account of the currency", () => {
    expect(
      previousBalances(
        "2026-09",
        opening(
          "2026-06",
          ["ARS", 50000, "acc_bank"],
          ["ARS", 8000, "acc_cash"],
        ),
        [
          flow("ARS", "income", 20000, "acc_bank"),
          flow("ARS", "expense", 9000, "acc_cash"),
        ],
      ),
    ).toEqual([{ currency: "ARS", amount: 69000 }]);
  });

  it("equals totalsByCurrency of previousAccountBalances, for any mix of accounts", () => {
    const OPENING = opening(
      "2026-06",
      ["ARS", 1000, "a"],
      ["ARS", 0, "b"],
      ["USD", 300, "c"],
    );
    const FLOWS = [
      flow("ARS", "income", 700, "a"),
      flow("ARS", "expense", 1200, "b"),
      flow("USD", "expense", 50, "c"),
      flow("EUR", "income", 10, "d"),
    ];

    expect(previousBalances("2026-08", OPENING, FLOWS)).toEqual(
      totalsByCurrency(previousAccountBalances("2026-08", OPENING, FLOWS)),
    );
  });
});
```

(import `previousAccountBalances`, `totalsByCurrency` from `./accounts`).

In `core/summary/service.test.ts`: change `priorGroup` to

```ts
const priorGroup = (
  currency: string,
  amount: number,
  accountId = `acc_${currency}`,
) => ({
  accountId,
  currency,
  _sum: { amount: BigInt(amount) },
});
```

expect `by: ["accountId", "currency"]` in `"without an opening balance, adds up every settled entry before the month"`; add:

```ts
it("sums the previous balance of every account of the currency", async () => {
  db.income.groupBy
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      priorGroup("ARS", 10000, "acc_bank"),
      priorGroup("ARS", 2000, "acc_cash"),
    ]);
  db.expense.groupBy
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([priorGroup("ARS", 500, "acc_cash")]);

  const [row] = await getMonthlySummary(USER_ID, "2026-09");

  expect(row.previous).toBe(11500);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run core/balances/previous.test.ts core/summary/service.test.ts`
Expected: FAIL in `"without an opening balance, adds up every settled entry before the month"`: the service still groups the earlier entries by `["currency"]`. (The two new `previousBalances` tests already pass: they pin that the per-account path gives the very same totals, which is what makes this refactor safe.)

- [ ] **Step 3: Implement.** `core/balances/types.ts`: delete `SettledFlow`. `core/balances/previous.ts`: import `previousAccountBalances`, `totalsByCurrency` from `./accounts` and `AccountFlow` from `./types`; replace `previousBalances` with

```ts
// The "saldo previo" of `month`, per currency: the sum of the previous balances of its accounts
// (see previousAccountBalances for the opening-month rules). A currency shows up when it has an
// opening amount or a balance that is not zero.
export const previousBalances = (
  month: string,
  opening: OpeningBalances | null,
  flows: readonly AccountFlow[],
): PreviousBalance[] => {
  const opened = new Set(
    (opening?.amounts ?? []).map(({ currency }) => currency),
  );

  return totalsByCurrency(
    previousAccountBalances(month, opening, flows),
  ).filter(({ currency, amount }) => opened.has(currency) || amount !== 0);
};
```

(`priorEntriesWindow` stays in this file: `accounts.ts` imports it from here; there is no import cycle at runtime because `previous.ts` only uses `accounts.ts` inside the function body — if the linter flags `import/no-cycle`, move `priorEntriesWindow` into a new `core/balances/window.ts`, re-export it from `previous.ts`, and import it from `window.ts` in `accounts.ts`.)

`core/summary/service.ts`: `PriorGroup` becomes `{ accountId: string | null; currency: string; _sum: { amount: bigint | null } }`; `toFlows` returns `AccountFlow[]`:

```ts
const toFlows = (
  groups: readonly PriorGroup[],
  kind: AccountFlow["kind"],
): AccountFlow[] =>
  groups.flatMap(({ accountId, currency, _sum }) =>
    // EXPAND: an entry without an account cannot exist once the contract migration ran.
    _sum.amount === null || accountId === null
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
```

the prior query `by: ["accountId", "currency"] as ("accountId" | "currency")[],`, `let flows: AccountFlow[] = [];`, and the import `import type { AccountFlow } from "@/core/balances/types";` replacing `SettledFlow`; update the header comment ("…or by account and currency (the settled entries before it), so the previous balance is the sum of the accounts").

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run core/balances core/summary`
Expected: PASS.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/balances core/summary`, then `npx vitest run` and `npm run lint`
Expected: all green.

### Task 5: Reading account balances

**Files:**

- Test: `core/balances/accountBalances.test.ts`
- Create: `core/balances/accountBalances.ts`

**Interfaces:**

- Consumes: `getOpeningBalances(userId, db)` (Task 3), `sumAccountBalances` (Task 1), `monthRange` (`@/core/summary/month`), `isoDateToDate`, `minorUnitsToNumber`.
- Produces: `type BalanceReader = Pick<Prisma.TransactionClient, "openingBalance" | "income" | "expense">` and `readAccountBalances(db: BalanceReader, userId: string, accountIds?: readonly string[]): Promise<AccountBalance[]>` — the current balance of the user's accounts (all of them, or only `accountIds`): opening amounts plus every settled entry dated from the opening month's first day (all settled entries without an opening), no upper date. Accounts with neither are absent (callers treat absent as 0).

- [ ] **Step 1: Write the failing test** `core/balances/accountBalances.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readAccountBalances } from "./accountBalances";

const USER_ID = "user_123";

const fakeDb = () => ({
  openingBalance: { findMany: vi.fn().mockResolvedValue([]) },
  income: { groupBy: vi.fn().mockResolvedValue([]) },
  expense: { groupBy: vi.fn().mockResolvedValue([]) },
});

const group = (accountId: string | null, currency: string, amount: number) => ({
  accountId,
  currency,
  _sum: { amount: BigInt(amount) },
});

const openingRow = (
  accountId: string,
  currency: string,
  amount: number,
  month = "2026-06",
) => ({
  id: `ob_${accountId}`,
  userId: USER_ID,
  accountId,
  account: { currency },
  amount: BigInt(amount),
  month,
});

let db: ReturnType<typeof fakeDb>;

beforeEach(() => {
  db = fakeDb();
});

describe("readAccountBalances", () => {
  it("sums only the user's settled entries, grouped by account, with no upper date", async () => {
    await readAccountBalances(db as never, USER_ID);

    for (const table of [db.income, db.expense]) {
      expect(table.groupBy).toHaveBeenCalledWith({
        by: ["accountId", "currency"],
        where: { userId: USER_ID, status: "SETTLED" },
        _sum: { amount: true },
      });
    }
  });

  it("starts at the first day of the opening month when there is an opening balance", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("acc_bank", "ARS", 5000),
    ]);

    await readAccountBalances(db as never, USER_ID);

    expect(db.income.groupBy.mock.calls[0][0].where.date).toEqual({
      gte: new Date("2026-06-01T00:00:00.000Z"),
    });
  });

  it("is the opening amount plus the settled incomes minus the settled expenses, per account", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("acc_bank", "ARS", 5000),
    ]);
    db.income.groupBy.mockResolvedValue([group("acc_bank", "ARS", 2000)]);
    db.expense.groupBy.mockResolvedValue([
      group("acc_bank", "ARS", 500),
      group("acc_cash", "ARS", 300),
    ]);

    expect(await readAccountBalances(db as never, USER_ID)).toEqual([
      { accountId: "acc_bank", currency: "ARS", balance: 6500 },
      { accountId: "acc_cash", currency: "ARS", balance: -300 },
    ]);
  });

  it("can be narrowed to some accounts, keeping the user's opening month for all of them", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("acc_bank", "ARS", 5000),
      openingRow("acc_other", "ARS", 999),
    ]);

    const balances = await readAccountBalances(db as never, USER_ID, [
      "acc_bank",
    ]);

    expect(db.expense.groupBy.mock.calls[0][0].where).toEqual({
      userId: USER_ID,
      status: "SETTLED",
      accountId: { in: ["acc_bank"] },
      date: { gte: new Date("2026-06-01T00:00:00.000Z") },
    });
    expect(balances).toEqual([
      { accountId: "acc_bank", currency: "ARS", balance: 5000 },
    ]);
  });

  it("ignores planned and covered entries: only SETTLED is ever read", async () => {
    await readAccountBalances(db as never, USER_ID);

    expect(db.income.groupBy.mock.calls[0][0].where.status).toBe("SETTLED");
    expect(db.expense.groupBy.mock.calls[0][0].where.status).toBe("SETTLED");
  });

  it("skips a group without an account (only possible before the contract migration)", async () => {
    db.income.groupBy.mockResolvedValue([group(null, "ARS", 700)]);

    expect(await readAccountBalances(db as never, USER_ID)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run core/balances/accountBalances.test.ts`
Expected: FAIL — `Failed to resolve import "./accountBalances"`.

- [ ] **Step 3: Implement** `core/balances/accountBalances.ts`

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
  "openingBalance" | "income" | "expense"
>;

interface FlowGroup {
  accountId: string | null;
  currency: string;
  _sum: { amount: bigint | null };
}

const toFlows = (
  groups: readonly FlowGroup[],
  kind: AccountFlow["kind"],
): AccountFlow[] =>
  groups.flatMap(({ accountId, currency, _sum }) =>
    // EXPAND: an entry without an account cannot exist once the contract migration ran.
    _sum.amount === null || accountId === null
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

// What the user's accounts hold now (all of them, or only `accountIds`): the opening amount plus
// every settled income minus every settled expense, counting from the first day of the opening month
// when there is one. A settled entry is money that already moved, so there is no upper date. Two
// grouped queries, scoped by userId. Any client can read it, so the archive rule calls it inside the
// transaction that locks the account. Accounts with neither an opening amount nor a settled entry are
// absent: their balance is 0.
export const readAccountBalances = async (
  db: BalanceReader,
  userId: string,
  accountIds?: readonly string[],
): Promise<AccountBalance[]> => {
  const opening = await getOpeningBalances(userId, db);
  const where = {
    userId,
    status: "SETTLED" as const,
    ...(accountIds ? { accountId: { in: [...accountIds] } } : {}),
    ...(opening
      ? { date: { gte: isoDateToDate(monthRange(opening.month).from) } }
      : {}),
  };
  const query = {
    by: ["accountId", "currency"] as ("accountId" | "currency")[],
    where,
    _sum: { amount: true as const },
  };
  const incomes = await db.income.groupBy(query);
  const expenses = await db.expense.groupBy(query);
  const wanted = accountIds ? new Set(accountIds) : null;
  const amounts = (opening?.amounts ?? []).filter(
    ({ accountId }) => wanted === null || wanted.has(accountId),
  );

  return sumAccountBalances(amounts, [
    ...toFlows(incomes, "income"),
    ...toFlows(expenses, "expense"),
  ]);
};
```

- [ ] **Step 4: Run and see it pass**

Run: `npx vitest run core/balances`
Expected: PASS.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` (if Prisma's `groupBy` typing rejects the shared `query` object with `by` as an array of a union, inline the object in both calls exactly like `core/summary/service.ts` does), `npx eslint core/balances`, then `npx vitest run` and `npm run lint`
Expected: all green.

### Task 6: The Banks board shows each account's balance (and knows which accounts have movements)

**Files:**

- Test: `core/banks/boardAccounts.test.ts`, `core/accounts/movements.test.ts`, `core/banks/pageData.test.ts`, `components/Banks/components/BanksBoard/components/BankRow/components/AccountTile/AccountTile.test.tsx`, `components/Banks/components/BanksBoard/components/BankRow/BankRow.test.tsx`
- Fixture-only updates: `components/Banks/components/BanksBoard/BanksBoard.test.tsx`, `components/Banks/Banks.test.tsx`, `app/dashboard/banks/loadBanksView.test.ts`
- Create: `core/banks/boardAccounts.ts`, `core/accounts/movements.ts`
- Modify: `core/banks/{types,board,pageData}.ts`, `components/Banks/{types.ts,Banks.tsx}`, `components/Banks/components/BanksBoard/types.ts`, `.../BankRow/types.ts`, `.../AccountTile/{AccountTile.tsx,types.ts,consts.ts,styles.ts}`

**Interfaces:**

- Consumes: `readAccountBalances` (Task 5), `listBanksWithAccounts`, `ensureDefaultCash` (stage 1), `formatMoney`.
- Produces:
  - `core/banks/types.ts`: `BoardAccount extends Account { balance: number; balanceLabel: string; hasMovements: boolean }`, `BoardBank extends BankWithAccounts { accounts: BoardAccount[] }`.
  - `core/accounts/movements.ts`: `type MovementReader = Pick<Prisma.TransactionClient, "account">`, `countAccountMovements(db, userId, accountId): Promise<number>`, `listAccountsWithMovements(db, userId): Promise<Set<string>>` — a movement is anything that points at the account: an income, an expense, a recurring template, an installment plan or an opening amount (stage 3 adds transfers here).
  - `core/banks/boardAccounts.ts`: `toBoardBanks(banks: readonly BankWithAccounts[], balances: readonly AccountBalance[], withMovements: ReadonlySet<string>): BoardBank[]`.
  - `loadBanksBoard(userId): Promise<BoardBank[]>`; `filterBanks` becomes generic (`<B extends BankWithAccounts>(banks: readonly B[], filter) => B[]`).
  - `editAccountLabel({ name, currency, archived, balanceLabel })` = `"Editar cuenta <name>, <currency>, saldo <balanceLabel>[, archivada]"`; the tile shows the balance under the name, in `text-danger` when it is negative.

- [ ] **Step 1: Write the failing core tests.**

`core/accounts/movements.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";

import { countAccountMovements, listAccountsWithMovements } from "./movements";

const USER_ID = "user_123";

const counts = (patch: Record<string, number> = {}) => ({
  incomes: 0,
  expenses: 0,
  recurringIncomes: 0,
  recurringExpenses: 0,
  installmentPlans: 0,
  openingBalances: 0,
  ...patch,
});

const COUNT_SELECT = {
  incomes: true,
  expenses: true,
  recurringIncomes: true,
  recurringExpenses: true,
  installmentPlans: true,
  openingBalances: true,
};

describe("countAccountMovements", () => {
  it("counts everything that points at the user's account", async () => {
    const db = {
      account: {
        findFirst: vi.fn().mockResolvedValue({
          _count: counts({ expenses: 2, openingBalances: 1 }),
        }),
      },
    };

    await expect(
      countAccountMovements(db as never, USER_ID, "acc_1"),
    ).resolves.toBe(3);
    expect(db.account.findFirst).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      select: { _count: { select: COUNT_SELECT } },
    });
  });

  it("is zero for an account that is not the user's", async () => {
    const db = { account: { findFirst: vi.fn().mockResolvedValue(null) } };

    await expect(
      countAccountMovements(db as never, USER_ID, "acc_x"),
    ).resolves.toBe(0);
  });
});

describe("listAccountsWithMovements", () => {
  it("lists the user's accounts that anything points at, in one query", async () => {
    const db = {
      account: {
        findMany: vi.fn().mockResolvedValue([
          { id: "acc_1", _count: counts({ recurringIncomes: 1 }) },
          { id: "acc_2", _count: counts() },
          { id: "acc_3", _count: counts({ installmentPlans: 1 }) },
        ]),
      },
    };

    await expect(
      listAccountsWithMovements(db as never, USER_ID),
    ).resolves.toEqual(new Set(["acc_1", "acc_3"]));
    expect(db.account.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      select: { id: true, _count: { select: COUNT_SELECT } },
    });
  });
});
```

`core/banks/boardAccounts.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { toBoardBanks } from "./boardAccounts";

const BANKS = [
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
        name: "Dólares",
        currency: "USD",
        archived: false,
      },
      {
        id: "acc_3",
        bankId: "bank_1",
        name: "Nueva",
        currency: "ARS",
        archived: false,
      },
    ],
  },
];

describe("toBoardBanks", () => {
  const [bank] = toBoardBanks(
    BANKS,
    [
      { accountId: "acc_1", currency: "ARS", balance: 150000 },
      { accountId: "acc_2", currency: "USD", balance: -2550 },
    ],
    new Set(["acc_1", "acc_2"]),
  );

  it("gives every account its balance, formatted in the account's currency", () => {
    expect(bank.accounts[0].balance).toBe(150000);
    expect(bank.accounts[0].balanceLabel).toMatch(/1\.500,00/);
    expect(bank.accounts[1].balanceLabel).toMatch(/US\$/);
  });

  it("keeps a negative balance negative: it is shown, never hidden", () => {
    expect(bank.accounts[1].balance).toBe(-2550);
    expect(bank.accounts[1].balanceLabel).toMatch(/-/);
  });

  it("gives an account without movements a balance of zero", () => {
    expect(bank.accounts[2].balance).toBe(0);
    expect(bank.accounts[2].balanceLabel).toMatch(/0,00/);
  });

  it("says which accounts have movements", () => {
    expect(bank.accounts.map((account) => account.hasMovements)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("keeps everything else of the bank and its accounts", () => {
    expect(bank).toMatchObject({
      id: "bank_1",
      name: "Banco Galicia",
      archived: false,
    });
    expect(bank.accounts[0]).toMatchObject(BANKS[0].accounts[0]);
  });
});
```

`core/banks/pageData.test.ts`: add to the hoisted deps `readAccountBalances: vi.fn(), listAccountsWithMovements: vi.fn(),`; add the mocks

```ts
vi.mock("@/infrastructure/db/client", () => ({ prisma: { tag: "prisma" } }));
vi.mock("@/core/balances/accountBalances", () => ({
  readAccountBalances: deps.readAccountBalances,
}));
vi.mock("@/core/accounts/movements", () => ({
  listAccountsWithMovements: deps.listAccountsWithMovements,
}));
```

in `beforeEach` add `deps.readAccountBalances.mockResolvedValue([]); deps.listAccountsWithMovements.mockResolvedValue(new Set());`; replace `"gives the banks as the service read them"` with:

```ts
it("gives the banks with each account's balance and whether it has movements", async () => {
  deps.ensureDefaultCash.mockResolvedValue(undefined);
  deps.listBanksWithAccounts.mockResolvedValue([
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
  ]);
  deps.readAccountBalances.mockResolvedValue([
    { accountId: "acc_1", currency: "ARS", balance: 50000 },
  ]);
  deps.listAccountsWithMovements.mockResolvedValue(new Set(["acc_1"]));

  const [bank] = await loadBanksBoard("user_1");

  expect(deps.readAccountBalances).toHaveBeenCalledWith(
    { tag: "prisma" },
    "user_1",
  );
  expect(deps.listAccountsWithMovements).toHaveBeenCalledWith(
    { tag: "prisma" },
    "user_1",
  );
  expect(bank.accounts[0]).toMatchObject({
    balance: 50000,
    hasMovements: true,
  });
  expect(bank.accounts[0].balanceLabel).toMatch(/500,00/);
});
```

- [ ] **Step 2: Write the failing component tests.**

`AccountTile.test.tsx`: import `type { BoardAccount } from "@/core/banks/types"` instead of `Account`; `ACCOUNT` becomes

```ts
const ACCOUNT: BoardAccount = {
  id: "acc_1",
  bankId: "bank_1",
  name: "Caja de ahorro",
  currency: "ARS",
  archived: false,
  balance: 150000,
  balanceLabel: "$ 1.500,00",
  hasMovements: true,
};
```

then: the `tile()` default name becomes `"Editar cuenta Caja de ahorro, ARS, saldo $ 1.500,00"`; every other expected name gets `, saldo $ 1.500,00` inserted right after the currency (`"Editar cuenta Cuenta en dólares, USD, saldo $ 1.500,00"`, `"Editar cuenta Caja de ahorro, ARS, saldo $ 1.500,00, archivada"`); `"shows the name and the currency of the account and nothing else (no balance)"` becomes `"shows the name, the balance and the currency of the account"` with `expect(tile()).toHaveTextContent(/^Caja de ahorro\$ 1\.500,00ARS$/);`; in `"puts the name at the top-left and the currency at the bottom-right"` destructure `const [name, balance, bottom] = Array.from(tile().children);` and add `expect(balance).toHaveTextContent("$ 1.500,00");`; in `"puts the archived chip at the bottom-left, before the currency"` take `.children[2]` instead of `.children[1]`; and add:

```ts
  it("shows a negative balance in red, and a positive one in the usual color", () => {
    const { rerender } = render(<AccountTile account={ACCOUNT} onEdit={vi.fn()} />);

    expect(screen.getByText("$ 1.500,00")).not.toHaveClass("text-danger");

    rerender(
      <AccountTile
        account={{ ...ACCOUNT, balance: -2550, balanceLabel: "-$ 25,50" }}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText("-$ 25,50")).toHaveClass("text-danger");
  });
```

`BankRow.test.tsx`: type `BANK` as `BoardBank` (import from `@/core/banks/types`), add `balance: 0, balanceLabel: "$ 0,00", hasMovements: false` to both accounts, insert `, saldo $ 0,00` after the currency in every expected account name, and replace `"has no balance anywhere: each tile is its name and its currency"` with:

```ts
it("shows each account's balance in its tile, between the name and the currency", () => {
  renderRow();

  expect(
    screen.getByRole("button", {
      name: "Editar cuenta Cuenta en dólares, USD, saldo $ 0,00",
    }),
  ).toHaveTextContent(/^Cuenta en dólares\$ 0,00USD$/);
});
```

Fixture-only: in `BanksBoard.test.tsx`, `Banks.test.tsx` and `app/dashboard/banks/loadBanksView.test.ts` type the bank fixtures as `BoardBank` (`BoardBank[]`, including `archivedOnly` in `Banks.test.tsx` and the `renderBoard` parameter), add `balance: 0, balanceLabel: "$ 0,00", hasMovements: false` to every account literal, and insert `, saldo $ 0,00` after the currency in every expected account name; in `Banks.test.tsx` the `accountButton` regex becomes ``new RegExp(`^Editar cuenta ${name}, [A-Z]{3}, saldo .+?(, archivada)?$`)``.

- [ ] **Step 3: Run them and see them fail**

Run: `npx vitest run core/accounts/movements.test.ts core/banks components/Banks app/dashboard/banks`
Expected: FAIL — the new modules do not exist; the board has no balances; the tile names have no "saldo".

- [ ] **Step 4: Implement the core.**

`core/banks/types.ts`: add after `BankWithAccounts`:

```ts
// An account as the board shows it: its balance (minor units, and formatted in its currency on the
// server) and whether anything points at it (which locks its currency).
export interface BoardAccount extends Account {
  balance: number;
  balanceLabel: string;
  hasMovements: boolean;
}

export interface BoardBank extends BankWithAccounts {
  accounts: BoardAccount[];
}
```

`core/accounts/movements.ts`

```ts
import type { Prisma } from "@/lib/generated/prisma/client";

type MovementReader = Pick<Prisma.TransactionClient, "account">;

// Everything that points at an account and pins its currency: its incomes and expenses, its recurring
// templates and installment plans, and its opening amount. Stage 3 adds the transfers here.
const MOVEMENT_COUNTS = {
  incomes: true,
  expenses: true,
  recurringIncomes: true,
  recurringExpenses: true,
  installmentPlans: true,
  openingBalances: true,
} as const;

const totalOf = (
  counts: Record<keyof typeof MOVEMENT_COUNTS, number>,
): number => Object.values(counts).reduce((sum, count) => sum + count, 0);

// How many things point at the user's account (0 for an account that is not the user's).
export const countAccountMovements = async (
  db: MovementReader,
  userId: string,
  accountId: string,
): Promise<number> => {
  const row = await db.account.findFirst({
    where: { id: accountId, userId },
    select: { _count: { select: MOVEMENT_COUNTS } },
  });

  return row ? totalOf(row._count) : 0;
};

// The ids of the user's accounts that anything points at, in one query.
export const listAccountsWithMovements = async (
  db: MovementReader,
  userId: string,
): Promise<Set<string>> => {
  const rows = await db.account.findMany({
    where: { userId },
    select: { id: true, _count: { select: MOVEMENT_COUNTS } },
  });

  return new Set(
    rows.filter((row) => totalOf(row._count) > 0).map((row) => row.id),
  );
};
```

`core/banks/boardAccounts.ts`

```ts
import type { AccountBalance } from "@/core/balances/types";
import { formatMoney } from "@/core/incomes/money";

import type { BankWithAccounts, BoardBank } from "./types";

// The board's banks: every account with its balance (0 without movements), formatted on the server in
// the account's own currency, and whether anything points at it.
export const toBoardBanks = (
  banks: readonly BankWithAccounts[],
  balances: readonly AccountBalance[],
  withMovements: ReadonlySet<string>,
): BoardBank[] => {
  const balanceOf = new Map(
    balances.map(({ accountId, balance }) => [accountId, balance]),
  );

  return banks.map((bank) => ({
    ...bank,
    accounts: bank.accounts.map((account) => {
      const balance = balanceOf.get(account.id) ?? 0;

      return {
        ...account,
        balance,
        balanceLabel: formatMoney(balance, account.currency),
        hasMovements: withMovements.has(account.id),
      };
    }),
  }));
};
```

`core/banks/pageData.ts`:

```ts
import { listAccountsWithMovements } from "@/core/accounts/movements";
import { ensureDefaultCash } from "@/core/accounts/defaultCash";
import { readAccountBalances } from "@/core/balances/accountBalances";
import { prisma } from "@/infrastructure/db/client";

import { toBoardBanks } from "./boardAccounts";
import { listBanksWithAccounts } from "./service";
import type { BoardBank } from "./types";

// Everything the banks page needs: the user's banks with their accounts, each account's balance and
// whether it has movements. The first visit seeds the default cash bank (idempotent, safe when two
// requests race), so a user never lands on an empty board by accident. The three reads are
// independent, so they run together.
export const loadBanksBoard = async (userId: string): Promise<BoardBank[]> => {
  await ensureDefaultCash(userId);

  const [banks, balances, withMovements] = await Promise.all([
    listBanksWithAccounts(userId),
    readAccountBalances(prisma, userId),
    listAccountsWithMovements(prisma, userId),
  ]);

  return toBoardBanks(banks, balances, withMovements);
};
```

`core/banks/board.ts`: make `filterBanks` generic so the board keeps its balances:

```ts
export const filterBanks = <B extends BankWithAccounts>(
  banks: readonly B[],
  { query, showArchived }: BankFilter,
): B[] => {
  const needle = normalizeSearch(query);
  const matches = (name: string): boolean =>
    needle === "" || normalizeSearch(name).includes(needle);

  return banks.flatMap((bank): B[] => {
    if (bank.archived && !showArchived) {
      return [];
    }

    const visible = bank.accounts.filter(
      (account) => showArchived || !account.archived,
    ) as B["accounts"];

    if (matches(bank.name)) {
      return [{ ...bank, accounts: visible }];
    }

    const hits = visible.filter((account) =>
      matches(account.name),
    ) as B["accounts"];

    return hits.length > 0 ? [{ ...bank, accounts: hits }] : [];
  });
};
```

- [ ] **Step 5: Implement the components.**

`components/Banks/types.ts`: `board: Source<readonly BoardBank[]>;` (import `BoardBank`). `components/Banks/Banks.tsx`: `const renderBanks = (banks: readonly BoardBank[]) => (` (import `BoardBank`). `BanksBoard/types.ts`: `banks: readonly BoardBank[];`. `BankRow/types.ts`: `bank: BoardBank;` and `onEditAccount: (account: BoardAccount) => void;` (import both from `@/core/banks/types`; drop the `Account` and `BankWithAccounts` imports).

`AccountTile/types.ts`: `account: BoardAccount;` and `onEdit: (account: BoardAccount) => void;`.

`AccountTile/consts.ts`:

```ts
import type { BoardAccount } from "@/core/banks/types";

export const ARCHIVED_ACCOUNT_LABEL = "Archivada";

// The accessible name replaces what the tile shows, so it carries it all: the currency, the balance
// and whether the account is archived.
export const editAccountLabel = ({
  name,
  currency,
  archived,
  balanceLabel,
}: Pick<
  BoardAccount,
  "name" | "currency" | "archived" | "balanceLabel"
>): string =>
  `Editar cuenta ${name}, ${currency}, saldo ${balanceLabel}${archived ? ", archivada" : ""}`;
```

`AccountTile/styles.ts`: add

```ts
// The balance under the name; a negative one is red (it is shown, never blocked).
export const BALANCE_CLASS_NAME = "text-sm font-medium tabular-nums";
export const NEGATIVE_BALANCE_CLASS_NAME = `${BALANCE_CLASS_NAME} text-danger`;
```

`AccountTile.tsx`: import the two classes; update the leading comment ("its name at the top-left, its balance under it, and its currency at the bottom-right …"); after `<span className={NAME_CLASS_NAME}>{account.name}</span>` add

```tsx
<span
  className={
    account.balance < 0 ? NEGATIVE_BALANCE_CLASS_NAME : BALANCE_CLASS_NAME
  }
>
  {account.balanceLabel}
</span>
```

- [ ] **Step 6: Run and see them pass**

Run: `npx vitest run core/accounts core/banks components/Banks app/dashboard/banks components/componentStructure.test.ts`
Expected: PASS.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/accounts core/banks components/Banks app/dashboard/banks`, then `npx vitest run` and `npm run lint`
Expected: all green.

### Task 7: Lock the bank row: archive a bank, create or reactivate an account

Stage 1 admitted two races in comments: archiving a bank while one of its accounts is reactivated (or created) could leave an active account under an archived bank. All three writes now take a lock on the bank row first, inside a transaction, so they run one after another.

**Files:**

- Test: `core/banks/locks.test.ts`, `core/banks/service.test.ts` (`describe("archiveBank", ...)`), `core/accounts/service.test.ts` (`describe("createAccount", ...)`, `describe("unarchiveAccount", ...)`)
- Create: `core/banks/locks.ts`
- Modify: `core/banks/service.ts` (`archiveBank`), `core/accounts/service.ts` (`createAccount`, `unarchiveAccount`)

**Interfaces:**

- Consumes: `prisma.$transaction`, `isUniqueConstraintError`.
- Produces: `core/banks/locks.ts`: `interface LockedBank { id: string; archivedAt: Date | null }`, `lockBank(tx, userId, bankId): Promise<LockedBank | null>`, `lockBankOfAccount(tx, userId, accountId): Promise<LockedBank | null>` (`tx: Pick<Prisma.TransactionClient, "$queryRaw">`). Same signatures and errors as before for `archiveBank`, `createAccount`, `unarchiveAccount`.

- [ ] **Step 1: Write the failing tests.**

`core/banks/locks.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";

import { lockBank, lockBankOfAccount } from "./locks";

const USER_ID = "user_123";
const AT = new Date("2026-10-04T12:00:00.000Z");

const fakeTx = (rows: unknown[]) => ({
  $queryRaw: vi.fn().mockResolvedValue(rows),
});

// The tagged template reaches the client as (strings, ...values).
const callOf = (tx: ReturnType<typeof fakeTx>) => {
  const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [
    TemplateStringsArray,
    ...unknown[],
  ];

  return { sql: strings.join("?").replace(/\s+/g, " ").trim(), values };
};

describe("lockBank", () => {
  it("locks the user's bank row until the transaction ends, and reads whether it is archived", async () => {
    const tx = fakeTx([{ id: "bank_1", archivedAt: AT }]);

    await expect(lockBank(tx, USER_ID, "bank_1")).resolves.toEqual({
      id: "bank_1",
      archivedAt: AT,
    });

    const { sql, values } = callOf(tx);

    expect(sql).toContain('FROM "Bank"');
    expect(sql).toMatch(/FOR UPDATE$/);
    expect(values).toEqual(["bank_1", USER_ID]);
  });

  it("is null for a bank that is not the user's (or does not exist)", async () => {
    await expect(lockBank(fakeTx([]), USER_ID, "bank_x")).resolves.toBeNull();
  });

  it("never puts an id inside the SQL text", async () => {
    const tx = fakeTx([]);

    await lockBank(tx, USER_ID, 'bank\'; DROP TABLE "Bank"; --');

    expect(callOf(tx).sql).not.toContain("DROP");
  });
});

describe("lockBankOfAccount", () => {
  it("locks the bank row of the user's account", async () => {
    const tx = fakeTx([{ id: "bank_1", archivedAt: null }]);

    await expect(lockBankOfAccount(tx, USER_ID, "acc_1")).resolves.toEqual({
      id: "bank_1",
      archivedAt: null,
    });

    const { sql, values } = callOf(tx);

    expect(sql).toContain('JOIN "Account"');
    expect(sql).toMatch(/FOR UPDATE OF b$/);
    expect(values).toEqual(["acc_1", USER_ID, USER_ID]);
  });

  it("is null for an account that is not the user's", async () => {
    await expect(
      lockBankOfAccount(fakeTx([]), USER_ID, "acc_x"),
    ).resolves.toBeNull();
  });
});
```

In `core/banks/service.test.ts`: add `$transaction: vi.fn(), $queryRaw: vi.fn(),` to the `db` mock; in `beforeEach` add `db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) => run(db));`; replace the whole `describe("archiveBank", ...)` with:

```ts
describe("archiveBank", () => {
  it("locks the bank row first, then counts its active accounts and archives, in one transaction", async () => {
    const order: string[] = [];

    db.$queryRaw.mockImplementation(async () => {
      order.push("lock");

      return [{ id: "bank_1", archivedAt: null }];
    });
    account.count.mockImplementation(async () => {
      order.push("count");

      return 0;
    });
    bank.updateMany.mockImplementation(async () => {
      order.push("archive");

      return { count: 1 };
    });

    await expect(archiveBank(USER_ID, "bank_1")).resolves.toBeUndefined();

    expect(order).toEqual(["lock", "count", "archive"]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(account.count).toHaveBeenCalledWith({
      where: { bankId: "bank_1", userId: USER_ID, archivedAt: null },
    });
    expect(bank.updateMany).toHaveBeenCalledWith({
      where: { id: "bank_1", userId: USER_ID },
      data: { archivedAt: expect.any(Date) },
    });
  });

  it("refuses a bank that still has active accounts, says how many, and archives nothing", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: null }]);
    account.count.mockResolvedValue(2);

    await expect(archiveBank(USER_ID, "bank_1")).rejects.toMatchObject({
      name: "BankHasActiveAccountsError",
      count: 2,
    });
    expect(bank.updateMany).not.toHaveBeenCalled();
  });

  it("treats another user's bank (or an unknown id) as not found", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      archiveBank(USER_ID, "bank_of_someone_else"),
    ).rejects.toBeInstanceOf(BankNotFoundError);
    expect(account.count).not.toHaveBeenCalled();
    expect(bank.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing, without failing, for a bank that is already archived", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: AT }]);

    await expect(archiveBank(USER_ID, "bank_1")).resolves.toBeUndefined();
    expect(bank.updateMany).not.toHaveBeenCalled();
  });
});
```

In `core/accounts/service.test.ts`: add `$transaction: vi.fn(), $queryRaw: vi.fn(),` to `db` and `db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) => run(db));` to `beforeEach`; replace `describe("createAccount", ...)` with:

```ts
describe("createAccount", () => {
  const input = { bankId: "bank_1", name: "Caja de ahorro", currency: "ARS" };

  beforeEach(() => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: null }]);
    account.findFirst.mockResolvedValue(null);
    account.create.mockResolvedValue(accountRow());
  });

  it("locks the user's bank, looks for a clash inside it ignoring case, then creates, in one transaction", async () => {
    const created = await createAccount(USER_ID, input);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
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

  it("treats another user's bank (or an unknown id) as not found and creates nothing", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      createAccount(USER_ID, { ...input, bankId: "bank_of_someone_else" }),
    ).rejects.toBeInstanceOf(BankNotFoundError);
    expect(account.create).not.toHaveBeenCalled();
  });

  it("refuses an archived bank: a bank archived a moment earlier is seen, the lock serializes both", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: AT }]);

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

    expect(account.create.mock.calls[0][0].data).toEqual({
      userId: USER_ID,
      bankId: "bank_1",
      name: "Caja de ahorro",
      currency: "ARS",
    });
  });
});
```

and replace `describe("unarchiveAccount", ...)` with:

```ts
describe("unarchiveAccount", () => {
  beforeEach(() => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: null }]);
    account.findFirst.mockResolvedValue({ archivedAt: AT });
    account.updateMany.mockResolvedValue({ count: 1 });
  });

  it("locks the account's bank, then brings the account back, in one transaction", async () => {
    await expect(unarchiveAccount(USER_ID, "acc_1")).resolves.toBeUndefined();

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(account.findFirst).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      select: { archivedAt: true },
    });
    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      data: { archivedAt: null },
    });
  });

  it("refuses to bring an account back under an archived bank", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: AT }]);

    await expect(unarchiveAccount(USER_ID, "acc_1")).rejects.toBeInstanceOf(
      BankArchivedError,
    );
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("treats another user's account (or an unknown id) as not found", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      unarchiveAccount(USER_ID, "acc_of_someone_else"),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing, without failing, for an account that is already active, even under an archived bank", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: AT }]);
    account.findFirst.mockResolvedValue({ archivedAt: null });

    await expect(unarchiveAccount(USER_ID, "acc_1")).resolves.toBeUndefined();
    expect(account.updateMany).not.toHaveBeenCalled();
  });
});
```

(`db.bank.findFirst` is no longer called by `createAccount`; keep it in the mock for the other describes if they use it, otherwise remove it.)

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run core/banks core/accounts`
Expected: FAIL — `./locks` does not exist; the services still use `findFirst`/conditional `updateMany` without a transaction.

- [ ] **Step 3: Implement.** `core/banks/locks.ts`

```ts
import type { Prisma } from "@/lib/generated/prisma/client";

type Locker = Pick<Prisma.TransactionClient, "$queryRaw">;

export interface LockedBank {
  id: string;
  archivedAt: Date | null;
}

// Locks the user's bank row until the surrounding transaction ends, and reads whether it is archived.
// Every write that depends on a bank being active (archiving it, creating an account in it,
// reactivating one of its accounts) takes this lock first, so two of them never interleave. The ids
// travel as parameters, never inside the SQL text. Null for a bank that is not the user's.
export const lockBank = async (
  tx: Locker,
  userId: string,
  bankId: string,
): Promise<LockedBank | null> => {
  const rows = await tx.$queryRaw<LockedBank[]>`
    SELECT "id", "archivedAt" FROM "Bank"
    WHERE "id" = ${bankId} AND "userId" = ${userId}
    FOR UPDATE
  `;

  return rows[0] ?? null;
};

// The same lock, reached from one of the user's accounts.
export const lockBankOfAccount = async (
  tx: Locker,
  userId: string,
  accountId: string,
): Promise<LockedBank | null> => {
  const rows = await tx.$queryRaw<LockedBank[]>`
    SELECT b."id", b."archivedAt" FROM "Bank" AS b
    JOIN "Account" AS a ON a."bankId" = b."id"
    WHERE a."id" = ${accountId} AND a."userId" = ${userId} AND b."userId" = ${userId}
    FOR UPDATE OF b
  `;

  return rows[0] ?? null;
};
```

`core/banks/service.ts`: import `lockBank`; replace `archiveBank` (and its comment) with:

```ts
// A bank is archived only when all its accounts are. The bank row is locked first, and creating or
// reactivating one of its accounts takes the same lock, so neither can slip in between the count and
// the archive. Archiving an archived bank is not an error.
export const archiveBank = async (
  userId: string,
  id: string,
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const bank = await lockBank(tx, userId, id);

    if (!bank) {
      throw new BankNotFoundError();
    }

    if (bank.archivedAt !== null) {
      return;
    }

    const active = await tx.account.count({
      where: { bankId: id, userId, archivedAt: null },
    });

    if (active > 0) {
      throw new BankHasActiveAccountsError(active);
    }

    await tx.bank.updateMany({
      where: { id, userId },
      data: { archivedAt: new Date() },
    });
  });
};
```

`core/accounts/service.ts`: import `lockBank`, `lockBankOfAccount` from `@/core/banks/locks`; replace `createAccount` (and its comment) with:

```ts
// Names are unique per bank, ignoring case: "Efectivo" may exist in two banks, never twice in one.
// The case-insensitive check is check-then-insert: the unique constraint only catches an
// identical-casing race. A bank id that comes from the client is never trusted: it must be the user's
// and it must be active. The bank row is locked for the whole write, and archiving the bank takes the
// same lock, so an account can never be created under a bank archived at the same moment.
export const createAccount = async (
  userId: string,
  input: CreateAccountInput,
): Promise<Account> => {
  try {
    return await prisma.$transaction(async (tx) => {
      const bank = await lockBank(tx, userId, input.bankId);

      if (!bank) {
        throw new BankNotFoundError();
      }

      if (bank.archivedAt !== null) {
        throw new BankArchivedError();
      }

      const duplicate = await tx.account.findFirst({
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

      // Explicit field list: the owner, the id and the archive date can never be overridden by the
      // payload.
      const row = await tx.account.create({
        data: {
          userId,
          bankId: bank.id,
          name: input.name,
          currency: input.currency,
        },
      });

      return toAccount(row);
    });
  } catch (error) {
    // Two requests with identical casing can both pass the check above; the constraint catches the
    // second (it is case-sensitive, so a case-only difference is not caught).
    if (isUniqueConstraintError(error)) {
      throw new DuplicateAccountError();
    }

    throw error;
  }
};
```

and `unarchiveAccount` with:

```ts
// An account is brought back only under an active bank. The bank row is locked first, and archiving
// the bank takes the same lock, so the two never interleave. Reactivating an active account is not an
// error (even under an archived bank: nothing changes).
export const unarchiveAccount = async (
  userId: string,
  id: string,
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const bank = await lockBankOfAccount(tx, userId, id);

    if (!bank) {
      throw new AccountNotFoundError();
    }

    const account = await tx.account.findFirst({
      where: { id, userId },
      select: { archivedAt: true },
    });

    if (!account) {
      throw new AccountNotFoundError();
    }

    if (account.archivedAt === null) {
      return;
    }

    if (bank.archivedAt !== null) {
      throw new BankArchivedError();
    }

    await tx.account.updateMany({
      where: { id, userId },
      data: { archivedAt: null },
    });
  });
};
```

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run core/banks core/accounts`
Expected: PASS (the actions tests mock the services, so they are unaffected).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/banks core/accounts`, then `npx vitest run` and `npm run lint`
Expected: all green. `rg -n "not serialized|later stage will lock|not guarded" core/banks core/accounts` prints nothing.

### Task 8: Archive an account only when it holds nothing and nothing is pending on it

**Files:**

- Test: `core/accounts/locks.test.ts`, `core/accounts/service.test.ts` (`describe("archiveAccount", ...)`), `core/accounts/actions.test.ts`, `components/Banks/components/AccountFormDrawer/AccountFormDrawer.test.tsx`
- Create: `core/accounts/locks.ts`
- Modify: `core/accounts/{errors,consts,service}.ts`, `core/banks/actionHelpers.ts`, `components/Banks/components/AccountFormDrawer/consts.ts`

**Interfaces:**

- Consumes: `readAccountBalances` (Task 5), `formatMoney`.
- Produces:
  - `core/accounts/locks.ts`: `interface LockedAccount { id: string; currency: string; archivedAt: Date | null }`, `lockAccount(tx, userId, accountId): Promise<LockedAccount | null>`.
  - `core/accounts/errors.ts`: `AccountHasBalanceError(balance: number, currency: string)`, `AccountInUseError(pending: number, templates: number)`.
  - `core/accounts/consts.ts`: `accountHasBalanceMessage(balanceLabel: string): string`, `accountInUseMessage(pending: number, templates: number): string`.
  - `archiveAccount(userId, id)`: inside one transaction, locks the account row; refuses when the balance is not 0, when it has PLANNED incomes/expenses or when a recurring template (income or expense) points at it; otherwise archives. `COVERED` entries do not block (they never move money).

- [ ] **Step 1: Write the failing tests.**

`core/accounts/locks.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";

import { lockAccount } from "./locks";

const USER_ID = "user_123";

describe("lockAccount", () => {
  it("locks the user's account row until the transaction ends, reading its currency and archive date", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          { id: "acc_1", currency: "ARS", archivedAt: null },
        ]),
    };

    await expect(lockAccount(tx, USER_ID, "acc_1")).resolves.toEqual({
      id: "acc_1",
      currency: "ARS",
      archivedAt: null,
    });

    const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = strings.join("?").replace(/\s+/g, " ").trim();

    expect(sql).toContain('FROM "Account"');
    expect(sql).toMatch(/FOR UPDATE$/);
    expect(values).toEqual(["acc_1", USER_ID]);
  });

  it("is null for an account that is not the user's", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };

    await expect(lockAccount(tx, USER_ID, "acc_x")).resolves.toBeNull();
  });
});
```

In `core/accounts/service.test.ts`: add to `db` the members `income: { count: vi.fn() }`, `expense: { count: vi.fn() }`, `recurringIncome: { count: vi.fn() }`, `recurringExpense: { count: vi.fn() }`; add

```ts
const balances = vi.hoisted(() => ({ readAccountBalances: vi.fn() }));

vi.mock("@/core/balances/accountBalances", () => balances);
```

import `AccountHasBalanceError` and `AccountInUseError`; replace `describe("archiveAccount", ...)` with:

```ts
describe("archiveAccount", () => {
  beforeEach(() => {
    db.$queryRaw.mockResolvedValue([
      { id: "acc_1", currency: "ARS", archivedAt: null },
    ]);
    balances.readAccountBalances.mockResolvedValue([]);
    db.income.count.mockResolvedValue(0);
    db.expense.count.mockResolvedValue(0);
    db.recurringIncome.count.mockResolvedValue(0);
    db.recurringExpense.count.mockResolvedValue(0);
    account.updateMany.mockResolvedValue({ count: 1 });
  });

  it("archives an account at zero with nothing pending, under the account's lock, in one transaction", async () => {
    await expect(archiveAccount(USER_ID, "acc_1")).resolves.toBeUndefined();

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(balances.readAccountBalances).toHaveBeenCalledWith(db, USER_ID, [
      "acc_1",
    ]);
    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      data: { archivedAt: expect.any(Date) },
    });
  });

  it("refuses while the account holds money, saying how much and in its currency", async () => {
    balances.readAccountBalances.mockResolvedValue([
      { accountId: "acc_1", currency: "ARS", balance: 150000 },
    ]);

    await expect(archiveAccount(USER_ID, "acc_1")).rejects.toMatchObject({
      name: "AccountHasBalanceError",
      balance: 150000,
      currency: "ARS",
    });
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a negative balance too: zero means zero", async () => {
    balances.readAccountBalances.mockResolvedValue([
      { accountId: "acc_1", currency: "ARS", balance: -1 },
    ]);

    await expect(archiveAccount(USER_ID, "acc_1")).rejects.toBeInstanceOf(
      AccountHasBalanceError,
    );
  });

  it("refuses while planned incomes or expenses and recurring templates still use it, saying how many", async () => {
    db.income.count.mockResolvedValue(1);
    db.expense.count.mockResolvedValue(2);
    db.recurringIncome.count.mockResolvedValue(1);
    db.recurringExpense.count.mockResolvedValue(0);

    await expect(archiveAccount(USER_ID, "acc_1")).rejects.toMatchObject({
      name: "AccountInUseError",
      pending: 3,
      templates: 1,
    });
    expect(db.income.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, accountId: "acc_1", status: "PLANNED" },
    });
    expect(db.expense.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, accountId: "acc_1", status: "PLANNED" },
    });
    expect(db.recurringIncome.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, accountId: "acc_1" },
    });
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("does not count covered entries: they never move money", async () => {
    await archiveAccount(USER_ID, "acc_1");

    expect(db.expense.count.mock.calls[0][0].where.status).toBe("PLANNED");
  });

  it("treats another user's account (or an unknown id) as not found", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      archiveAccount(USER_ID, "acc_of_someone_else"),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing, without failing, for an account that is already archived", async () => {
    db.$queryRaw.mockResolvedValue([
      { id: "acc_1", currency: "ARS", archivedAt: AT },
    ]);

    await expect(archiveAccount(USER_ID, "acc_1")).resolves.toBeUndefined();
    expect(balances.readAccountBalances).not.toHaveBeenCalled();
  });
});
```

In `core/accounts/actions.test.ts` add (import the two errors):

```ts
describe("archiveAccountAction and the archive rules", () => {
  it("says how much the account still holds, in its currency", async () => {
    mocks.archiveAccount.mockRejectedValue(
      new AccountHasBalanceError(150000, "ARS"),
    );

    const result = await archiveAccountAction("acc_1");

    expect(result.status).toBe("error");
    expect(result.status === "error" && result.message).toMatch(
      /^Esta cuenta tiene un saldo de \$\s1\.500,00\. Dejala en cero antes de archivarla\.$/,
    );
  });

  it("says what is still pending on it", async () => {
    mocks.archiveAccount.mockRejectedValue(new AccountInUseError(3, 1));

    expect(await archiveAccountAction("acc_1")).toEqual({
      status: "error",
      message:
        "Esta cuenta todavía tiene 3 movimientos pendientes y 1 recurrente. Pasalos a otra cuenta o eliminalos antes de archivarla.",
    });
  });

  it("speaks in singular for one pending movement and no template", async () => {
    mocks.archiveAccount.mockRejectedValue(new AccountInUseError(1, 0));

    expect(await archiveAccountAction("acc_1")).toEqual({
      status: "error",
      message:
        "Esta cuenta todavía tiene 1 movimiento pendiente. Pasalo a otra cuenta o eliminalo antes de archivarla.",
    });
  });
});
```

`AccountFormDrawer.test.tsx`: update the assertion of the active-account archive hint to the new text `"Solo podés archivar una cuenta en cero, sin movimientos pendientes ni recurrentes. No se borra nada y podés reactivarla cuando quieras."`.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run core/accounts components/Banks/components/AccountFormDrawer`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`core/accounts/locks.ts`

```ts
import type { Prisma } from "@/lib/generated/prisma/client";

type Locker = Pick<Prisma.TransactionClient, "$queryRaw">;

export interface LockedAccount {
  id: string;
  currency: string;
  archivedAt: Date | null;
}

// Locks the user's account row until the surrounding transaction ends. Archiving the account and
// changing its currency take it, so the checks they make (its balance, its movements) stay true until
// they write. The ids travel as parameters. Null for an account that is not the user's.
export const lockAccount = async (
  tx: Locker,
  userId: string,
  accountId: string,
): Promise<LockedAccount | null> => {
  const rows = await tx.$queryRaw<LockedAccount[]>`
    SELECT "id", "currency", "archivedAt" FROM "Account"
    WHERE "id" = ${accountId} AND "userId" = ${userId}
    FOR UPDATE
  `;

  return rows[0] ?? null;
};
```

Append to `core/accounts/errors.ts`:

```ts
// An account is archived only at zero balance (in minor units of its currency).
export class AccountHasBalanceError extends Error {
  constructor(
    readonly balance: number,
    readonly currency: string,
  ) {
    super(`The account still holds ${balance} (${currency})`);
    this.name = "AccountHasBalanceError";
  }
}

// An account is archived only when nothing is still to happen on it: no planned income or expense and
// no recurring template points at it (they would generate or move money into an archived account).
export class AccountInUseError extends Error {
  constructor(
    readonly pending: number,
    readonly templates: number,
  ) {
    super(
      `The account still has ${pending} pending entries and ${templates} templates`,
    );
    this.name = "AccountInUseError";
  }
}
```

Append to `core/accounts/consts.ts`:

```ts
export const accountHasBalanceMessage = (balanceLabel: string): string =>
  `Esta cuenta tiene un saldo de ${balanceLabel}. Dejala en cero antes de archivarla.`;

const countOf = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

// "3 movimientos pendientes y 1 recurrente", with the verb agreeing with what is listed.
export const accountInUseMessage = (
  pending: number,
  templates: number,
): string => {
  const parts = [
    pending > 0
      ? countOf(pending, "movimiento pendiente", "movimientos pendientes")
      : null,
    templates > 0 ? countOf(templates, "recurrente", "recurrentes") : null,
  ].filter((part): part is string => part !== null);
  const one = pending + templates === 1;

  return `Esta cuenta todavía tiene ${parts.join(" y ")}. ${
    one
      ? "Pasalo a otra cuenta o eliminalo"
      : "Pasalos a otra cuenta o eliminalos"
  } antes de archivarla.`;
};
```

`core/accounts/service.ts`: import `lockAccount` from `./locks`, `readAccountBalances` from `@/core/balances/accountBalances`, and the two new errors; replace `archiveAccount` (and its comment) with:

```ts
// An account is archived only when it holds nothing and nothing is still to happen on it: its
// balance is zero, no planned income or expense is on it, and no recurring template points at it (a
// template would keep generating into it). Covered entries never move money, so they do not count. The
// account row is locked for the whole check and write. Archiving an archived account is not an error.
// (Entry writes do not take this lock: a movement saved in the same instant as the archive can still
// land on it; the account's balance then shows it, in red if negative, and it can be reactivated.)
export const archiveAccount = async (
  userId: string,
  id: string,
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const account = await lockAccount(tx, userId, id);

    if (!account) {
      throw new AccountNotFoundError();
    }

    if (account.archivedAt !== null) {
      return;
    }

    const [current] = await readAccountBalances(tx, userId, [id]);
    const balance = current?.balance ?? 0;

    if (balance !== 0) {
      throw new AccountHasBalanceError(balance, account.currency);
    }

    const pendingIncomes = await tx.income.count({
      where: { userId, accountId: id, status: "PLANNED" },
    });
    const pendingExpenses = await tx.expense.count({
      where: { userId, accountId: id, status: "PLANNED" },
    });
    const incomeTemplates = await tx.recurringIncome.count({
      where: { userId, accountId: id },
    });
    const expenseTemplates = await tx.recurringExpense.count({
      where: { userId, accountId: id },
    });
    const pending = pendingIncomes + pendingExpenses;
    const templates = incomeTemplates + expenseTemplates;

    if (pending + templates > 0) {
      throw new AccountInUseError(pending, templates);
    }

    await tx.account.updateMany({
      where: { id, userId },
      data: { archivedAt: new Date() },
    });
  });
};
```

`core/banks/actionHelpers.ts`: import `formatMoney` (`@/core/incomes/money`), `accountHasBalanceMessage`, `accountInUseMessage`, `AccountHasBalanceError`, `AccountInUseError`; in `toKnownFailure` before `return undefined;` add:

```ts
if (error instanceof AccountHasBalanceError) {
  return failure(
    accountHasBalanceMessage(formatMoney(error.balance, error.currency)),
  );
}

if (error instanceof AccountInUseError) {
  return failure(accountInUseMessage(error.pending, error.templates));
}
```

`components/Banks/components/AccountFormDrawer/consts.ts`: the active branch of `accountArchiveHint` becomes `"Solo podés archivar una cuenta en cero, sin movimientos pendientes ni recurrentes. No se borra nada y podés reactivarla cuando quieras."`.

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run core/accounts core/banks components/Banks`
Expected: PASS.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/accounts core/banks components/Banks`, then `npx vitest run` and `npm run lint`
Expected: all green.

### Task 9: Lock an account's currency once it has movements

**Files:**

- Test: `core/accounts/service.test.ts` (`describe("updateAccount", ...)`), `core/accounts/actions.test.ts`, `components/Banks/components/AccountFormDrawer/AccountFormDrawer.test.tsx`
- Modify: `core/accounts/{errors,consts,service}.ts`, `core/banks/actionHelpers.ts`, `components/Banks/{types.ts,Banks.tsx}`, `components/Banks/components/AccountFormDrawer/{AccountFormContent.tsx,consts.ts,types.ts}`

**Interfaces:**

- Consumes: `lockAccount` (Task 8), `countAccountMovements` (Task 6), `BoardAccount` (Task 6).
- Produces: `AccountCurrencyLockedError`; `ACCOUNT_CURRENCY_LOCKED_MESSAGE = "La moneda no se puede cambiar: esta cuenta ya tiene movimientos."`; `updateAccount` runs in a transaction under the account lock and refuses a currency change when `countAccountMovements > 0`; `AccountFormTarget.account: BoardAccount | null`; the drawer disables the currency of an account with movements (and still submits it through a hidden input).

- [ ] **Step 1: Write the failing tests.** In `core/accounts/service.test.ts` add `const movements = vi.hoisted(() => ({ countAccountMovements: vi.fn() })); vi.mock("./movements", () => movements);`, import `AccountCurrencyLockedError`, and replace `describe("updateAccount", ...)` with:

```ts
describe("updateAccount", () => {
  beforeEach(() => {
    db.$queryRaw.mockResolvedValue([
      { id: "acc_1", currency: "ARS", archivedAt: null },
    ]);
    account.findFirst.mockResolvedValue({ id: "acc_1", bankId: "bank_1" });
    movements.countAccountMovements.mockResolvedValue(0);
    account.updateMany.mockResolvedValue({ count: 1 });
  });

  it("locks the account, checks the rest of its bank and writes the name and the currency", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);

    await updateAccount(USER_ID, "acc_1", { name: "Ahorros", currency: "USD" });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
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

  it("lets an account with movements be renamed when the currency stays", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);
    movements.countAccountMovements.mockResolvedValue(4);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "Caja", currency: "ARS" }),
    ).resolves.toBeUndefined();
    expect(movements.countAccountMovements).not.toHaveBeenCalled();
  });

  it("lets an account without movements change its currency", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "Caja", currency: "USD" }),
    ).resolves.toBeUndefined();
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

In `core/accounts/actions.test.ts` add:

```ts
it("puts a currency change refused by the movements on the currency field", async () => {
  mocks.updateAccount.mockRejectedValue(new AccountCurrencyLockedError());

  expect(await updateAccountAction("acc_1", formOf())).toEqual({
    status: "error",
    message: "Corrige los campos resaltados.",
    fieldErrors: {
      currency: [
        "La moneda no se puede cambiar: esta cuenta ya tiene movimientos.",
      ],
    },
  });
});
```

`AccountFormDrawer.test.tsx`: type `ACCOUNT` as `BoardAccount` (import from `@/core/banks/types`) adding `balance: 0, balanceLabel: "US$ 0,00", hasMovements: false`, make `edit` take a `BoardAccount`, and add:

```ts
describe("the currency of an account with movements", () => {
  it("is shown but cannot be changed, and says why", () => {
    renderForm(edit({ ...ACCOUNT, hasMovements: true }));

    expect(currencyTrigger()).toBeDisabled();
    expect(
      screen.getByText(
        "La moneda no se puede cambiar porque la cuenta ya tiene movimientos.",
      ),
    ).toBeInTheDocument();
  });

  it("is still sent with the form, unchanged", async () => {
    actions.updateAccountAction.mockResolvedValue({ status: "success" });
    renderForm(edit({ ...ACCOUNT, hasMovements: true }));

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(actions.updateAccountAction).toHaveBeenCalledTimes(1),
    );
    expect(
      (actions.updateAccountAction.mock.calls[0][1] as FormData).get(
        "currency",
      ),
    ).toBe(ACCOUNT.currency);
  });

  it("stays editable on an account without movements", () => {
    renderForm(edit(ACCOUNT));

    expect(currencyTrigger()).not.toBeDisabled();
  });
});
```

(`renderForm`, `edit`, `actions`, `currencyTrigger` are the file's own helpers; add `waitFor` to its testing-library import if missing.)

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run core/accounts components/Banks/components/AccountFormDrawer`
Expected: FAIL.

- [ ] **Step 3: Implement.**

Append to `core/accounts/errors.ts`:

```ts
// An account's currency is fixed once anything points at it (its movements are in that currency).
export class AccountCurrencyLockedError extends Error {
  constructor() {
    super("The account currency cannot change: it has movements");
    this.name = "AccountCurrencyLockedError";
  }
}
```

Append to `core/accounts/consts.ts`: `export const ACCOUNT_CURRENCY_LOCKED_MESSAGE = "La moneda no se puede cambiar: esta cuenta ya tiene movimientos.";`

`core/accounts/service.ts`: import `countAccountMovements` from `./movements` and `AccountCurrencyLockedError`; replace `updateAccount` (and its comment) with:

```ts
// Changes the name and the currency. The currency is fixed once the account has movements (entries,
// templates, plans or an opening amount): they are all in that currency. The account row is locked for
// the whole check and write, so a concurrent archive or currency change waits. Renaming to another
// casing of its own name is fine; clashing with another account of the same bank (ignoring case) is
// not. (Entry writes do not take this lock; see archiveAccount.)
export const updateAccount = async (
  userId: string,
  id: string,
  input: AccountInput,
): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
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

      if (
        input.currency !== locked.currency &&
        (await countAccountMovements(tx, userId, id)) > 0
      ) {
        throw new AccountCurrencyLockedError();
      }

      const duplicate = await tx.account.findFirst({
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

      await tx.account.updateMany({
        where: { id, userId },
        data: { name: input.name, currency: input.currency },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateAccountError();
    }

    throw error;
  }
};
```

`core/banks/actionHelpers.ts`: import `ACCOUNT_CURRENCY_LOCKED_MESSAGE` and `AccountCurrencyLockedError`; add before `return undefined;`:

```ts
if (error instanceof AccountCurrencyLockedError) {
  return fieldFailure({ currency: [ACCOUNT_CURRENCY_LOCKED_MESSAGE] });
}
```

`components/Banks/types.ts`: `account: BoardAccount | null;` in `AccountFormTarget` (import `BoardAccount`; drop the `Account` import). `components/Banks/Banks.tsx`: `const openAccountForm = (account: BoardAccount | null, bankId: string | null) => {` (import `BoardAccount`, drop `Account`). `AccountFormDrawer/types.ts`: wherever the target's account type is referenced it follows `AccountFormTarget` (no change unless it imports `Account` directly — then switch to `BoardAccount`).

`AccountFormDrawer/consts.ts`: add `export const CURRENCY_LOCKED_HINT = "La moneda no se puede cambiar porque la cuenta ya tiene movimientos.";`.

`AccountFormContent.tsx`: import `Description` from `@heroui/react` and `CURRENCY_LOCKED_HINT`; after `const hasNoBanks = ...` add

```ts
// An account with movements keeps its currency: the select shows it but cannot change it, and the
// value travels in a hidden input (a disabled field is not submitted).
const isCurrencyLocked = account?.hasMovements ?? false;
```

change the currency `Select` to `name={isCurrencyLocked ? undefined : CURRENCY_FIELD_NAME}` and `isDisabled={isCurrencyLocked}`, add inside it after `</Select.Popover>`:

```tsx
{
  isCurrencyLocked ? <Description>{CURRENCY_LOCKED_HINT}</Description> : null;
}
```

and right after the `Select` element:

```tsx
{
  isCurrencyLocked && account ? (
    <input type="hidden" name={CURRENCY_FIELD_NAME} value={account.currency} />
  ) : null;
}
```

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run core/accounts core/banks components/Banks`
Expected: PASS.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`, `npx eslint core/accounts core/banks components/Banks`, then `npx vitest run` and `npm run lint`
Expected: all green.

### Task 10: One form parser for the banks and accounts actions

`core/banks/actions.ts` and `core/accounts/actions.ts` each repeat the same three lines (read the form, validate it, turn the zod error into the field failure). One helper does it.

**Files:**

- Test: `core/banks/actionHelpers.test.ts`
- Modify: `core/banks/actionHelpers.ts`, `core/banks/actions.ts`, `core/accounts/actions.ts`

**Interfaces:**

- Consumes: `readForm` (`@/core/entries/actionHelpers`), `toFieldFailure`.
- Produces: `parseForm<T>(schema: z.ZodType<T>, formData: FormData, fields: readonly string[]): ParsedForm<T>` in `core/banks/actionHelpers.ts`; `parseBankForm`, `parseCreateForm`, `parseUpdateForm` are deleted.

- [ ] **Step 1: Write the failing test** `core/banks/actionHelpers.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { z } from "zod";

import { parseForm } from "./actionHelpers";

const schema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
});

const formOf = (values: Record<string, string>) => {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => formData.set(key, value));

  return formData;
};

describe("parseForm", () => {
  it("reads only the listed fields and returns the validated data", () => {
    expect(
      parseForm(schema, formOf({ name: " Galicia ", userId: "attacker" }), [
        "name",
      ]),
    ).toEqual({ data: { name: "Galicia" } });
  });

  it("returns the field failure the UI shows when the form is invalid", () => {
    expect(parseForm(schema, formOf({ name: "  " }), ["name"])).toEqual({
      error: {
        status: "error",
        message: "Corrige los campos resaltados.",
        fieldErrors: { name: ["El nombre es obligatorio."] },
      },
    });
  });
});
```

Run: `npx vitest run core/banks/actionHelpers.test.ts` → FAIL (`parseForm` is not exported).

- [ ] **Step 2: Implement.** In `core/banks/actionHelpers.ts` add `import { failure, fieldFailure, readForm, runAuthenticated as runScoped } from "@/core/entries/actionHelpers";` (extend the existing import), `import type { ParsedForm } from "./types";` (add to the types import) and:

```ts
// Reads the listed fields of a form, validates them, and returns the data or the field failure the
// UI shows. Fields that are not listed never reach the schema.
export const parseForm = <T>(
  schema: z.ZodType<T>,
  formData: FormData,
  fields: readonly string[],
): ParsedForm<T> => {
  const result = schema.safeParse(readForm(formData, fields));

  return result.success
    ? { data: result.data }
    : { error: toFieldFailure(result.error) };
};
```

`core/banks/actions.ts`: delete `parseBankForm` and the `readForm`, `ParsedForm`, `BankInput` imports it needed; import `parseForm`; use `const parsed = parseForm(bankInputSchema, formData, BANK_FORM_FIELDS);` in both actions.

`core/accounts/actions.ts`: delete `parseCreateForm` and `parseUpdateForm` and the imports only they used (`readForm`, `ParsedForm`, `AccountInput`, `CreateAccountInput`); import `parseForm`; use `parseForm(createAccountInputSchema, formData, CREATE_ACCOUNT_FORM_FIELDS)` and `parseForm(accountInputSchema, formData, UPDATE_ACCOUNT_FORM_FIELDS)`; keep the comment "An edit reads only the name and the currency: the bank an account belongs to never changes." above the update call.

- [ ] **Step 3: Run and see everything pass**

Run: `npx vitest run core/banks core/accounts`
Expected: PASS (the existing actions tests pin the behaviour, unchanged).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` (if `z.ZodType<T>` rejects a schema whose input type differs, use `z.ZodType<T, unknown>`), `npx eslint core/banks core/accounts`, then `npx vitest run` and `npm run lint`
Expected: all green.

### Task 11: The contract migration — `accountId` required, `medium` and `PaymentMedium` gone

**Assumption (re-checked before applying):** the financial tables hold no row without an account. They were empty when stage 2a's expand migration ran and every write since sets `accountId`, so no backfill is written.

**Files:**

- Test: `prisma/schema.test.ts`, `core/balances/accountBalances.test.ts`
- Create: `prisma/migrations/20261006180000_entries_account_contract/migration.sql`
- Modify: `prisma/schema.prisma`, `core/expenses/service.ts`, `core/expenses/recurringService.ts`, `core/incomes/service.ts`, `core/balances/service.ts`, `core/balances/accountBalances.ts`, `core/summary/service.ts`
- Delete: `core/accounts/expand.ts`, `core/accounts/expand.test.ts`

**Interfaces:**

- Consumes: everything above.
- Produces: Prisma row types with `accountId: string` and a required `account` relation on the six models; no `medium` field anywhere; `PaymentMedium` no longer generated; `OpeningBalance` without `currency`/`medium` and without the old unique key. No `EXPAND` marker left in the code.

- [ ] **Step 1: Write the failing schema test.** In `prisma/schema.test.ts`: change `ACCOUNT_RELATION` (stage 2a) to the required form and its use:

```ts
const ACCOUNT_RELATION =
  /account\s+Account\s+@relation\(fields: \[accountId\], references: \[id\], onDelete: Restrict\)/;
```

and in that `describe.each` replace `expect(model).toMatch(/accountId\s+String\?/);` with `expect(model).toMatch(/accountId\s+String\s/);` and rename the test `"requires an account that cannot be deleted under it"`; replace the Task 3 test `"no longer requires a currency or a medium (the account has the currency)"` with

```ts
it("has no currency nor medium of its own: the account has the currency", () => {
  expect(opening).not.toMatch(/\bcurrency\b/);
  expect(opening).not.toMatch(/\bmedium\b/);
  expect(opening).not.toContain("@@unique([userId, currency, medium])");
});
```

and append:

```ts
describe("the payment medium", () => {
  it("is gone from every model, and its enum too", () => {
    expect(SCHEMA).not.toMatch(/\bmedium\b/);
    expect(SCHEMA).not.toContain("PaymentMedium");
  });
});
```

Run: `npx vitest run prisma/schema.test.ts` → FAIL (six required-relation tests, the OpeningBalance test, the medium test).

- [ ] **Step 2: Edit the schema.** Snapshot: `cp prisma/schema.prisma "${TMPDIR:-/tmp}/schema-before-2b-11.prisma"`. Then:
- Delete the whole `enum PaymentMedium { ... }` block and its two comment lines above it.
- Delete the `medium ... PaymentMedium ...` line of `Income`, `RecurringIncome`, `Expense`, `InstallmentPlan`, `RecurringExpense`.
- In the six models change `accountId <spaces> String?` to `String` and `account <spaces> Account? @relation(...)` to `Account @relation(...)`; in `Income` replace the comment "Nullable only until the contract step of stage 2b, which makes it required; the services already require it." with nothing (keep "The account the money arrived in.").
- In `OpeningBalance` delete the `currency`, `medium` lines and `@@unique([userId, currency, medium])`, and replace the model comment with "The money the user held in each account at the START of `month`, one row per account. Every row of a user shares the same month. Earlier months do not count and later ones accumulate on top of it." and the `accountId` comment with "The account the amount was held in; its currency is the account's.".
- Run `npx prisma format`, `npx prisma validate`.

- [ ] **Step 3: Write the migration from Prisma's diff (read-only).**

Run: `npx prisma migrate diff --from-schema "${TMPDIR:-/tmp}/schema-before-2b-11.prisma" --to-schema prisma/schema.prisma --script`

Create `prisma/migrations/20261006180000_entries_account_contract/migration.sql` with this header followed by the diff output verbatim:

```sql
-- Contract step of stage 2 (account instead of medium): every movement, template, plan and opening
-- amount now requires its account, and the payment medium is gone. No row is translated: the
-- controller re-checks right before applying that no row lacks an account (see the plan, Task 11).
```

The diff output must contain, and nothing beyond it except possibly a `DROP CONSTRAINT`/`ADD CONSTRAINT` pair per account foreign key that re-adds it `ON DELETE RESTRICT ON UPDATE CASCADE`:

- `DROP INDEX "OpeningBalance_userId_currency_medium_key";`
- for `Expense`, `Income`, `InstallmentPlan`, `RecurringExpense`, `RecurringIncome`: `DROP COLUMN "medium"` and `ALTER COLUMN "accountId" SET NOT NULL`;
- for `OpeningBalance`: `DROP COLUMN "currency"`, `DROP COLUMN "medium"`, `ALTER COLUMN "accountId" SET NOT NULL`;
- `DROP TYPE "PaymentMedium";`

If it contains a `DROP TABLE`, a `DROP COLUMN` of anything else, or a foreign key re-added with another `ON DELETE`, stop: the schema edit is wrong.

Run `npx prisma generate`. Run: `npx vitest run prisma/schema.test.ts` → PASS.

- [ ] **Step 4: Hand the migration to the controller, with the pre-flight check.** Do not apply it. The controller, before `npx prisma migrate deploy` and after the human's OK, runs this read-only query on the dev database (Neon SQL editor or `psql`) and applies only if every count is 0:

```sql
SELECT 'Income' AS "table", COUNT(*) FROM "Income" WHERE "accountId" IS NULL
UNION ALL SELECT 'Expense', COUNT(*) FROM "Expense" WHERE "accountId" IS NULL
UNION ALL SELECT 'RecurringIncome', COUNT(*) FROM "RecurringIncome" WHERE "accountId" IS NULL
UNION ALL SELECT 'RecurringExpense', COUNT(*) FROM "RecurringExpense" WHERE "accountId" IS NULL
UNION ALL SELECT 'InstallmentPlan', COUNT(*) FROM "InstallmentPlan" WHERE "accountId" IS NULL
UNION ALL SELECT 'OpeningBalance', COUNT(*) FROM "OpeningBalance" WHERE "accountId" IS NULL;
```

- [ ] **Step 5: Remove every EXPAND shim (tsc is the failing check).**

Run: `npx tsc --noEmit` — it now fails where a nullable `accountId` is still assumed, and `rg -n "// EXPAND|accounts/expand" core components app` lists every shim (a bare `EXPAND` also matches the sidebar's `EXPAND_LABEL` and `ROOT_EXPANDED`). Fix exactly these:

- `core/expenses/service.ts`: in `ExpenseWithCategory` make `account: AccountWithBank;` (required; import the type from `@/core/accounts/label`); in `toExpense` replace the two shim lines with `    accountId: row.accountId,` and `    accountLabel: labelOfAccount(row.account),`; import `labelOfAccount` from `@/core/accounts/label`; remove the `@/core/accounts/expand` import.
- `core/incomes/service.ts`: the same in `IncomeWithCategory` / `toIncome`; in `toRecurringIncome` `  accountId: row.accountId,`.
- `core/expenses/recurringService.ts`: in `toItem` `  accountId: row.accountId,`.
- `core/balances/service.ts` (`getOpeningBalances`): `amounts: rows.map((row) => ({ accountId: row.accountId, currency: row.account.currency, amount: minorUnitsToNumber(row.amount) })),`.
- `core/summary/service.ts` and `core/balances/accountBalances.ts` (`toFlows`): drop the `accountId === null` branch and the EXPAND comment; the group types get `accountId: string`.
- Delete `core/accounts/expand.ts` and `core/accounts/expand.test.ts`; in `core/balances/accountBalances.test.ts` delete the test `"skips a group without an account (only possible before the contract migration)"`.

Run: `rg -n "// EXPAND|accounts/expand" core components app` → no output.

- [ ] **Step 6: Run everything**

Run: `npx vitest run`
Expected: PASS. If a service test now throws `Cannot read properties of undefined (reading 'bank')` in `labelOfAccount`, that test's row fixture lacks `account: ACCOUNT_ROW` (stage 2a's **Row rule**): add it.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit`, `npm run lint`
Expected: all green.

### Task 12: The last of the medium

Nothing reads `core/entries/medium.ts` any more (the summary dropped it in Task 2, the opening balance in Task 3, the entries in stage 2a). Delete it and prove the medium is gone everywhere outside the migration history.

**Files:**

- Delete: `core/entries/medium.ts`, `core/entries/medium.test.ts`

**Interfaces:**

- Consumes: Tasks 1–11 and stage 2a.
- Produces: no `medium` anywhere in the code, the schema or the tests.

- [ ] **Step 1: Prove nothing imports it**

Run: `rg -n "entries/medium|from \"./medium\"" core components app lib scripts`
Expected: only `core/entries/medium.test.ts`. (Anything else: the task that owns it is unfinished — stop and report.)

- [ ] **Step 2: Delete** `core/entries/medium.ts` and `core/entries/medium.test.ts`.

- [ ] **Step 3: The repo-wide proof**

Run: `rg -n -i "\bmedium\b|PaymentMedium|mediumField|MediumField|CashMarker|MEDIUM_|\"CASH\"|\"DIGITAL\"|billetera|total disponible" core components app lib scripts prisma/schema.prisma prisma/schema.test.ts`
Expected: no output. (The only remaining mentions of the medium are the applied migrations under `prisma/migrations/`, which are history and are never edited. `app/themes.css` holds a color named `--p-medium-jungle` and `README.md` a `utm_medium` link: both are outside the searched paths on purpose and unrelated.)

- [ ] **Step 4: Verify (end of stage 2)**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`
Expected: all green. Report to the controller: stage 2 done; three migrations to apply in order if not yet applied: `20261005120000_entries_account_expand` (2a), `20261006120000_opening_balance_per_account` and, after the pre-flight query of Task 11, `20261006180000_entries_account_contract`; the human may need to restart `next dev` to load the regenerated client.

## Self-review notes (2b)

- Spec coverage (stage 2 items owned by 2b): account balance rule with the extension point for transfers (Task 1, `AccountFlow`); PLANNED/COVERED never move money (Tasks 1, 5, 8); currency total = sum of accounts (Tasks 1, 4); OpeningBalance unique `(userId, accountId)`, one month for all (Task 3); opening-balance drawer with one row per account grouped by bank (Task 3); summary Anterior/Actual/Objetivo with the same `includeExpectedIncomes` (Task 2, labels kept as today: "Saldo previo", "Actual", "Objetivo"); Billetera and Disponible removed (Task 2); archive only at zero balance (Task 8); currency immutable once it has movements (Task 9); negative balance shown in red, never blocked (Task 6); board tiles show balances (Task 6); bank-row lock and the shared form parser (Tasks 7, 10); contract migration and leftovers (Tasks 11, 12).
- Every boundary compiles: Task 2 keeps `OpeningAmount.medium` (only the summary stops reading it); Task 3 swaps the opening shape and rewrites every reader in the same task; the board types are widened with generics so stage-1 tests keep their plain fixtures except the five that render tiles.
