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
