-- CreateEnum
CREATE TYPE "RecurringDecision" AS ENUM ('ENABLED', 'DISABLED');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "recurringExpenseId" TEXT;

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "notes" TEXT,
    "dayOfMonth" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpenseDecision" (
    "id" TEXT NOT NULL,
    "recurringExpenseId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "decision" "RecurringDecision" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringExpenseDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringExpense_userId_idx" ON "RecurringExpense"("userId");

-- CreateIndex
CREATE INDEX "RecurringExpense_categoryId_idx" ON "RecurringExpense"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringExpenseDecision_recurringExpenseId_month_key" ON "RecurringExpenseDecision"("recurringExpenseId", "month");

-- CreateIndex
CREATE INDEX "Expense_recurringExpenseId_idx" ON "Expense"("recurringExpenseId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_recurringExpenseId_date_key" ON "Expense"("recurringExpenseId", "date");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpenseDecision" ADD CONSTRAINT "RecurringExpenseDecision_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: until now the flag was only a mark. It now means "linked to a template", so marks
-- without a template are cleared (the user turns them on again to create the template).
UPDATE "Expense" SET "isRecurring" = false WHERE "recurringExpenseId" IS NULL;
