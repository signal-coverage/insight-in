-- CreateEnum
CREATE TYPE "PaymentMedium" AS ENUM ('DIGITAL', 'CASH');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "medium" "PaymentMedium" NOT NULL DEFAULT 'DIGITAL';

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "medium" "PaymentMedium" NOT NULL DEFAULT 'DIGITAL';

-- AlterTable
ALTER TABLE "RecurringExpense" ADD COLUMN     "medium" "PaymentMedium" NOT NULL DEFAULT 'DIGITAL';

-- AlterTable
ALTER TABLE "RecurringIncome" ADD COLUMN     "medium" "PaymentMedium" NOT NULL DEFAULT 'DIGITAL';

-- CreateTable
CREATE TABLE "OpeningBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "medium" "PaymentMedium" NOT NULL,
    "amount" BIGINT NOT NULL,
    "month" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpeningBalance_userId_idx" ON "OpeningBalance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningBalance_userId_currency_medium_key" ON "OpeningBalance"("userId", "currency", "medium");
