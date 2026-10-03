-- CreateEnum
CREATE TYPE "InstallmentKind" AS ENUM ('EXPENSE', 'INCOME');

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "installmentPlanId" TEXT;

-- AlterTable
ALTER TABLE "InstallmentPlan" ADD COLUMN     "incomeCategoryId" TEXT,
ADD COLUMN     "kind" "InstallmentKind" NOT NULL DEFAULT 'EXPENSE',
ALTER COLUMN "categoryId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Income_installmentPlanId_idx" ON "Income"("installmentPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "Income_installmentPlanId_installmentNumber_key" ON "Income"("installmentPlanId", "installmentNumber");

-- CreateIndex
CREATE INDEX "InstallmentPlan_incomeCategoryId_idx" ON "InstallmentPlan"("incomeCategoryId");

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_installmentPlanId_fkey" FOREIGN KEY ("installmentPlanId") REFERENCES "InstallmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_incomeCategoryId_fkey" FOREIGN KEY ("incomeCategoryId") REFERENCES "IncomeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An expense plan has an expense category and no income category; an income plan the other way
-- round, and never a card. Prisma cannot express this, so it is written by hand. Every plan that
-- exists today is an expense plan (the default of "kind") with its category, so it already complies.
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_kind_category_check" CHECK (
  ("kind" = 'EXPENSE' AND "categoryId" IS NOT NULL AND "incomeCategoryId" IS NULL)
  OR
  ("kind" = 'INCOME' AND "incomeCategoryId" IS NOT NULL AND "categoryId" IS NULL AND "cardId" IS NULL)
);
