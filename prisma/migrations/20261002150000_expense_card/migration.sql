-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "cardId" TEXT,
ADD COLUMN     "purchaseDate" DATE;

-- CreateIndex
CREATE INDEX "Expense_cardId_idx" ON "Expense"("cardId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: the installments of a plan paid with a card carry that card too, so a card's usage reads
-- its expenses directly.
UPDATE "Expense"
SET "cardId" = "InstallmentPlan"."cardId"
FROM "InstallmentPlan"
WHERE "Expense"."installmentPlanId" = "InstallmentPlan"."id"
  AND "InstallmentPlan"."cardId" IS NOT NULL;
