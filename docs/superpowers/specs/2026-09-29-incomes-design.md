# Incomes — Design

Date: 2026-09-29
Status: Design approved in conversation; written spec pending user review.

## Goal

First functional feature of insight-in (an income/expense tracker): let a signed-in user record, list, edit and delete incomes in multiple currencies (ARS, USD, EUR, ...), persisted in Neon Postgres.

## Understanding

- Scope is limited to incomes. Expenses, cross-currency totals/conversion, categories and filters are out of scope.
- The existing sidebar entries (Overview with Project/Revenue/Insights, Billing, Calendar, Invoices) stay as placeholders. **Incomes** is added at the very top.
- The Neon database behind the provided `DATABASE_URL` is dedicated to insight-in (not shared with play-padel), so `prisma migrate dev` is safe.
- Data is per user: every record belongs to a Clerk `userId`.

## Prerequisite (manual)

Add `DATABASE_URL` to `.env.local` (gitignored via `.env*`). Add a placeholder entry to `.env.example`. The password was shared in chat and should be rotated once the work is done.

## Architecture

### 1. Sidebar

- Prepend an `Incomes` item to `NAV_ITEMS` in `components/Sidebar/consts.ts`: href `/dashboard/incomes`, a heroicons outline icon.
- All other items are untouched.

### 2. Data layer (pattern copied from play-padel)

- Dependencies: `prisma`, `@prisma/client`, `@prisma/adapter-neon`, `@neondatabase/serverless`, `ws`, `dotenv`.
- `prisma.config.ts` loads `.env` then `.env.local` (override) and points to `prisma/schema.prisma` and `prisma/migrations`.
- Generator output: `lib/generated/prisma` (`provider = "prisma-client"`).
- `infrastructure/db/client.ts`: singleton `PrismaClient` using `PrismaNeon`, `neonConfig.webSocketConstructor = ws`, cached on `globalThis` outside production, throws `DATABASE_URL is not set` when missing.
- Model `Income`:
  - `id` String `@id @default(cuid())`
  - `userId` String (Clerk user id)
  - `description` String
  - `amount` BigInt (minor units; BigInt because Int overflows around 21M ARS with cents)
  - `currency` String (ISO 4217 code)
  - `date` DateTime `@db.Date`
  - `source` String (free text)
  - `notes` String?
  - `createdAt`, `updatedAt`
  - Index on `(userId, date desc)`.

### 3. Domain logic — `core/incomes/`

- zod schema for create/update input (description, amount, currency in the Dinero currency list, date, source, notes).
- Money helpers built on Dinero.js v2 (`dinero.js`, `dinero.js/currencies`): parse a decimal input to minor units, format with `toDecimal` + `Intl.NumberFormat`. BigInt is converted to `number` at the boundary.
- Service with list/create/update/delete, always scoped by `userId`.
- Server Actions (no API routes) for create/update/delete. Each takes `userId` from Clerk `auth()`, validates with zod, and revalidates the incomes route.
- No `react-hook-form`; HeroUI `Form` is enough.

### 4. UI — `app/dashboard/incomes`

- Server Component page lists the user's incomes in a HeroUI `Table`.
- "Add income" opens a HeroUI `Modal` with the form: description, amount, currency (`Select`), date, source, notes.
- Row actions: edit (same modal) and delete (`AlertDialog` confirmation).
- Amounts are displayed per currency; no totals mix currencies.
- Follow the repo's component convention: `Component.tsx`, `index.ts`, and `consts.ts` / `styles.ts` / `types.ts` / `utils.ts` where needed; `@/` imports.
- Before writing code, read the Next.js 16 docs in `node_modules/next/dist/docs/` and the HeroUI v3 docs in `.heroui-docs/react` (required by AGENTS.md).

### 5. Testing (Strict TDD)

- The project has no test runner: add Vitest.
- Cover the zod schema, the money helpers and the service (Prisma client mocked). UI is verified by running the app.

## Out of scope

Expenses, cross-currency totals or conversion, categories, filters, pagination.
