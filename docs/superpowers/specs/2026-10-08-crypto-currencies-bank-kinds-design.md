# Crypto currencies and bank kinds (design)

Status: design approved by the user in conversation on 2026-10-08; this file is the written spec awaiting review.
Builds on: `2026-10-04-accounts-banks-transfers-design.md` and `2026-10-07-cards-debit-credit-design.md` (both implemented).

## Purpose

The user keeps part of their money in virtual wallets that hold crypto balances (USDC, USDT, ETH, XMR, ...) and also pays with the debit/prepaid cards of those wallets in those currencies. Bank entities (real banks) only hold legal-tender currencies (ARS, USD, EUR, ...). The app must therefore (1) let accounts, incomes, expenses and transfers use crypto currencies, and (2) distinguish "bank entity" from "virtual wallet" when a bank is created, because only wallets may have crypto accounts.

Success: a wallet can have a USDC account; incomes, expenses and transfers in USDC work with the same rules as any currency (funds checks, balances, summary section per currency); a debit/prepaid card of that wallet can pay in USDC; a bank entity cannot get a crypto account; credit cards and installments stay legal-tender only.

## Facts checked in the repo (2026-10-08)

- A crypto registry already exists in `core/currencies` (`consts.ts`, `crypto.ts`, `origin.ts`, `types.ts`): USDC, USDT and DAI with `CRYPTO_EXPONENT = 6`, used only as the optional ORIGIN of an income/expense ("quoted in 1000 USDC"). Origin amounts are already stored with 6 decimals, so the exponent must stay 6.
- `core/incomes/money.ts` (`toMinorUnits`, `toDecimalString`, `formatMoney`, `currencyExponent`) is built on `dinero.js` and `Intl.NumberFormat` with ISO currencies only; amounts travel as JS numbers (`MAX_MINOR_UNITS` = safe integer). `Intl` rejects crypto codes as a currency. Currency columns are plain `String` in the database with no CHECK or enum, so no column changes.
- Currency validation lives at the boundary in `SUPPORTED_CURRENCY_CODES` / `SUPPORTED_CURRENCIES` (`core/incomes/consts.ts`), used by `core/entries/fields.ts`, `query.ts`, `originFields.ts`, `core/reimbursements/fields.ts`, `core/installments/schema.ts`, and the form options in `components/Entries/currencyOptions.ts`.
- `Bank` has `name`, `archivedAt`, the "Efectivo" default cash bank, and accounts with one currency each.

## Decisions

1. **A crypto currency is one more currency**, not a separate concept: same account/entry/transfer machinery, same funds checks. No parallel model.
2. **Extend the existing registry** in `core/currencies` with the list USDC, USDT, DAI, BTC, ETH, XMR, SOL, BNB, LTC, TRX (code, English name). **6 decimals for all** (the user's choice; BTC/ETH lose only dust below 0.000001; the safe-integer cap still allows about 9,000 million units per amount). Adding a coin later is one line.
3. **Bank kind:** `Bank.kind` is `ENTITY` (shown "Entidad bancaria") or `WALLET` ("Billetera virtual"). The migration sets every existing bank to `ENTITY` (including "Efectivo", which stays an entity: cash is not crypto). The user switches Mercado Pago, AstroPay and Fiwind to wallet by editing them. A new bank starts as `ENTITY`.
4. **Currency rule per kind:** an `ENTITY` account accepts legal-tender (ISO) currencies only; a `WALLET` account accepts those and the crypto list. Validated in the service when creating an account and when changing its currency (already limited to accounts without movements). Changing a bank's kind: `ENTITY` -> `WALLET` always allowed; `WALLET` -> `ENTITY` refused while the bank has any crypto account (archived ones included).
5. **Where crypto is allowed:** account currency (wallets), opening balances, incomes and expenses, transfers (same currency), the reimbursement amount, the "quoted in another currency" origin (already), and debit/prepaid cards (their currencies come from the bank's active accounts, so crypto shows up with no card change).
6. **Where crypto is NOT allowed:** credit cards (their per-currency limits), installment plans and any expense paid with a credit card: legal-tender only. The planner's currency list and the credit-limit rows keep the ISO list.
7. **One money module:** `core/incomes/money.ts` becomes the single place that knows both kinds of currency: `currencyExponent`, `toMinorUnits`, `toDecimalString` and `formatMoney` recognise crypto codes (reusing the registry), and the Dinero currency objects for crypto are built from it so existing arithmetic keeps working. Crypto is formatted as a plain decimal plus the code ("1.250,5 USDC": at least 2 and at most 6 decimals, es-AR separators), never through `Intl` as a currency. Origin helpers in `core/currencies/origin.ts` delegate to the same code instead of duplicating it.
8. **Summary, Bancos, "Por cuenta":** sections group by currency string as today; the order is legal-tender first (as today), then crypto in registry order. Different currencies are never added.

## Data model

- `enum BankKind { ENTITY WALLET }` and `Bank.kind BankKind @default(ENTITY)`. One additive migration (`ALTER TABLE "Bank" ADD COLUMN "kind" ... NOT NULL DEFAULT 'ENTITY'`); the default fills the existing rows. The implementer only WRITES the SQL and runs `prisma generate`/`validate`; the USER applies it (`npx prisma migrate deploy`) and restarts `next dev`. Prisma CLI stays 7.10.
- No other schema change.

## Behaviour and screens (Spanish es-AR voseo; code in English)

- **Bank drawer:** new "Tipo" selector (Entidad bancaria / Billetera virtual) on create and edit, with the one-way rule of Decision 4 and a Spanish refusal message ("Este banco tiene cuentas cripto; archivalas o eliminalas antes de pasarlo a entidad bancaria").
- **Account drawer:** the currency selector shows the ISO list and, only for a wallet bank, a separate "Criptomonedas" group. Server refusal for an entity: "Las entidades bancarias solo admiten monedas de curso legal. Usá una billetera virtual."
- **Income, expense, transfer and opening-balance forms:** their currency selectors also list the crypto currencies (grouped after the ISO list). Account selectors already filter by currency, so only wallets with that currency are offered, with the existing empty hint linking to Bancos.
- **Cards:** the credit-limit currency list and the installment planner stay ISO only. Debit/prepaid cards need no change.
- **Banks board and tiles:** a small "Billetera" chip on wallet banks; balances formatted with the crypto formatter.

## Errors

New typed errors in Spanish: crypto currency not allowed in an entity bank (create/update account); bank kind change refused because of crypto accounts; crypto currency chosen where only legal tender is allowed (credit limit, installment) is rejected by the existing schema validation with the usual "moneda no soportada" message. Everything stays scoped by `userId`.

## Testing

Strict TDD with Vitest, services against the Prisma mock. Cover: the registry and exponents; `toMinorUnits`/`toDecimalString`/`formatMoney` for crypto (rounding, more than 6 decimals refused, limit, es-AR format, never calling `Intl` with a crypto currency code); account service rules per bank kind (create, change currency, switch kind both ways); funds checks and balances with a crypto account (transfer and debit expense in USDC); summary/board grouping and ordering with crypto sections; forms: currency groups per bank kind, selectors listing crypto, planner and credit limits still ISO only; migration text guard; browser pass after the user applies the migration (ask before live writes; clean up with the new delete feature).

## Out of scope

Prices or exchange rates for crypto, on-chain addresses or live balances, fiat value of crypto holdings, converting between currencies, network fees, more than 6 decimals, crypto credit limits, crypto installments.

## Open items to settle in the plan

- Exact list of every place that enumerates currencies (forms, queries, schemas, Zod `enum`s) and which of them gets the ISO-only list versus the ISO + crypto list.
- Whether a "Billetera" chip fits the tile layout without crowding (see the earlier tile sizing fix).
