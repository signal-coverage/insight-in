-- AlterEnum
ALTER TYPE "EntryStatus" ADD VALUE 'COVERED';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "installmentPlanId" TEXT;

-- CreateTable
CREATE TABLE "InstallmentPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "totalCuotas" INTEGER NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "medium" "PaymentMedium" NOT NULL DEFAULT 'DIGITAL',
    "categoryId" TEXT NOT NULL,
    "notes" TEXT,
    "dayOfMonth" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstallmentPlan_userId_idx" ON "InstallmentPlan"("userId");

-- CreateIndex
CREATE INDEX "InstallmentPlan_categoryId_idx" ON "InstallmentPlan"("categoryId");

-- CreateIndex
CREATE INDEX "Expense_installmentPlanId_idx" ON "Expense"("installmentPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_installmentPlanId_installmentNumber_key" ON "Expense"("installmentPlanId", "installmentNumber");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_installmentPlanId_fkey" FOREIGN KEY ("installmentPlanId") REFERENCES "InstallmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
