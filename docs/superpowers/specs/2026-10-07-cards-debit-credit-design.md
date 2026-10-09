# Cards: debit/prepaid and credit, tied to banks (design)

Status: design approved by the user in conversation on 2026-10-07; this file is the written spec awaiting review.
Builds on: `2026-10-04-accounts-banks-transfers-design.md` (stages 1 to 3 are implemented). This stage REVISES two of its statements: "Debit and prepaid cards are not modelled" and the out-of-scope item "linking credit cards to a bank or account".

## Purpose

The user pays with two different kinds of cards and wants the app to treat them differently:

- **Debit / prepaid cards** spend money that must already be in an account. They can operate in one or several currencies (a prepaid card like AstroPay holds ARS, USD and EUR accounts).
- **Credit cards** are used for purchases in installments, bounded by a limit the user chooses. They can also operate in several currencies, each with its own limit.

Today `Card` is credit-only, has a single currency, and is not linked to any bank or account; a card on an expense is only a label. Success: choosing a debit/prepaid card on an expense moves money out of the right account and refuses the expense when the account lacks funds; credit cards keep their current behaviour with a limit per currency; every card belongs to a bank.

## Facts checked in the repo and the database (2026-10-07)

- The `Card` table has 0 rows in the dev database. The user has installment plans bought with borrowed cards; those plans have no card and stay as they are. So the schema change needs no data migration.
- The expense form ("Ingresar gasto") already offers an optional card (`CardField`) when at least one card exists in the expense's currency; with a card the date field becomes the purchase date and a line shows when the card charges it. An installment never offers a card (it inherits its plan's). The installment planner ("Compra en cuotas") is the second path.
- Today the card limit never refuses anything: it only feeds the recommender (`core/cards/recommend.ts`), which warns ("fits", "near", over the limit) while planning an installment purchase. This stage keeps it a warning.

## Decisions

1. **One `Card` table with a `kind`** (`CREDIT` or `DEBIT`; DEBIT covers prepaid), not two tables. Expenses and plans keep pointing at `Card`.
2. **Every card belongs to a bank** (`bankId`, required, `Restrict`). A bank can have several cards. A debit/prepaid card is tied to the WHOLE bank: for a purchase it uses the bank's active account in the expense's currency. No per-account selection.
3. **A debit/prepaid card stores no currencies.** Its currencies are those of its bank's active accounts.
4. **A credit card has a limit per currency**, in a new child table `CardLimit` (card, currency, amount). The limit MODE (monthly or total) stays one per card. Limits are never added across currencies.
5. **Kind and bank cannot be changed after creating a card** (a credit card may have plans hanging from it). Everything else is editable.
6. **Debit/prepaid funds check:** an expense with a debit/prepaid card is refused when its account would go below zero (same invariant as transfers: a write never pushes an account it takes money from below zero). The check runs only when the expense is SETTLED (paid) or becomes paid; planned and covered expenses move no money and are not checked until then.
7. **The credit limit stays a warning**, never a block (the user defines it as the cap they want to respect, possibly lower than the real one).
8. **The installment planner offers only credit cards** (debit is paid on the spot).

## Data model

- `enum CardKind { CREDIT DEBIT }`.
- `Card`: add `kind CardKind` and `bankId String` (relation to `Bank`, `onDelete: Restrict`, indexed). `closingDay`, `dueDay` and `limitMode` become optional (only credit has them; the service enforces presence for credit and absence for debit). Remove `currency` and `limitAmount` (moved to `CardLimit`). Keep `last4`, `brand`, the `@@unique([userId, last4, brand])` and the relations to plans and expenses.
- `CardLimit`: `id`, `cardId` (relation `Card`, `onDelete: Cascade`), `currency` (ISO 4217), `amount BigInt` (minor units, `> 0`), `@@unique([cardId, currency])`.
- Migration: the `Card` table is empty, so it is written as one hand-written migration that creates the enum and `CardLimit`, adds the columns and drops the two removed ones. The implementer only WRITES the SQL and runs `prisma generate`/`validate`; the USER applies it (`npx prisma migrate deploy`) and restarts `next dev` (the client is cached on `globalThis`). Before applying, the controller re-checks that `Card` is still empty.
- `clearData` order and its test learn the new table (`CardLimit` before `Card`).

## Behaviour

**Expense with a debit/prepaid card** (in "Ingresar gasto"):

- The server resolves the account: the bank's ACTIVE account whose currency equals the expense's currency. If the bank has none, the expense is refused with a message that points to Bancos ("El banco de esta tarjeta no tiene una cuenta activa en {moneda}. Creá una en Bancos."). The client never sends the account for these expenses; the form shows the resolved account read-only ("Se descuenta de {Banco · Cuenta}").
- When the expense is settled, the account row is locked (`lockAccount`, `FOR NO KEY UPDATE`, as the other account writers), its balance is read with `readAccountBalances` inside the same transaction excluding this expense itself on an edit, and the write is refused with the existing insufficient-funds message shown under "Monto" when the balance does not cover it.
- Editing an expense, marking it paid, or changing its card, amount, currency or date re-runs the resolution and the check. Moving an expense from a debit card to something else, or deleting it, takes no check (the account only gains).
- Planned and covered expenses resolve the account but check no funds.

**Expense with a credit card:** unchanged: the account stays the one that pays the statement and the user picks it. Only cards with a limit in the expense's currency are offered; changing the currency to one the card has no limit in clears the card. The limit remains a warning in the recommender, with the existing messages ("quedan X de Y") but using the limit of the purchase's currency.

**Installment planner:** card selector and recommender consider credit cards only, with the limit of the purchase currency. Plans keep their `cardId` and the cycle rule is unchanged.

**Cards and banks:** deleting a card keeps its expenses and plans without a card (as today). Archiving a bank is not blocked by its cards (the bank already requires zero balances). Recurring templates carry no card, so they do not change.

## Screens (Spanish es-AR, voseo; code and comments in English)

- **Tarjetas** (`/dashboard/cards`): the form starts with **Tipo** (Crédito / Débito o prepago) and **Banco** (required; with no banks, a notice linking to Bancos). Debit/prepaid asks only last 4 digits and brand. Credit adds closing day, due day, limit mode and a list of limits per currency (add and remove rows; at least one; no repeated currency). Editing cannot change kind or bank. The table gains **Tipo** and **Banco** columns; a credit card shows its limits per currency, a debit/prepaid card shows the currencies of its bank's active accounts without amounts.
- **Ingresar gasto:** the card selector offers credit cards with a limit in the expense's currency and debit/prepaid cards whose bank has an active account in that currency. Choosing a debit/prepaid card replaces the "Cuenta" selector with the fixed line. The funds refusal appears under "Monto".
- **Compra en cuotas:** only credit cards.
- **Bancos:** unchanged in this stage (showing a bank's cards there is a possible later idea).

## Errors

Domain errors in Spanish, shown as field errors where they belong: bank of the card without an active account in the currency; insufficient funds (existing message, under "Monto"); card kind or bank change attempted (refused, the form does not offer it); credit card without at least one limit; a debit card with credit-only fields; a card of another user or another currency behaves as not found. Services stay scoped by `userId`.

## Testing

Strict TDD with Vitest, services against the Prisma mock (no database needed). Cover: card service validation per kind and limits-per-currency rules; account resolution (found, none in that currency, archived account skipped); the funds check for create, edit (including excluding the expense itself), marking paid, planned/covered not checked, and lock order; the credit offer filtering by limit currency; the recommender using the purchase currency's limit; the planner offering only credit; form states and the read-only account line; `clearData` order; migration text guard (additive plus the two drops on an empty table) like the Transfer one. Browser pass after the user applies the migration, reusing the signed-in session and asking before live writes.

## Out of scope

Credit-card statements and payments of the statement, linking a credit card to the account that pays it, interest and fees, per-account card selection, virtual/extra cards, showing cards on the Bancos board, a hard block on the credit limit, converting between currencies, importing statements.

## Open items to settle in the plan

- Where exactly the server resolves the account for an expense edit that only changes notes (it must not fail for funds, mirroring the transfer notes-only rule).
- Whether the recurring wizard needs any change (templates carry no card, expected none).
