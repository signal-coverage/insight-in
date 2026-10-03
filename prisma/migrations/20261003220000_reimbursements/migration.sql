-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "expectedReimbursement" BIGINT;

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "reimbursesExpenseId" TEXT;

-- CreateIndex
CREATE INDEX "Income_reimbursesExpenseId_idx" ON "Income"("reimbursesExpenseId");

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_reimbursesExpenseId_fkey" FOREIGN KEY ("reimbursesExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The reimbursement an expense expects is either absent or positive. Prisma cannot express this, so it
-- is written by hand. Every expense that exists today has none, so it already complies.
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_expectedReimbursement_check" CHECK (
  "expectedReimbursement" IS NULL OR "expectedReimbursement" > 0
);
