-- CreateEnum
CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD', 'OTHER');

-- CreateEnum
CREATE TYPE "CardLimitMode" AS ENUM ('MONTHLY', 'TOTAL');

-- AlterTable
ALTER TABLE "InstallmentPlan" ADD COLUMN     "cardId" TEXT,
ADD COLUMN     "purchaseDate" DATE;

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "brand" "CardBrand" NOT NULL,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "limitMode" "CardLimitMode" NOT NULL,
    "limitAmount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Card_userId_idx" ON "Card"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Card_userId_last4_brand_key" ON "Card"("userId", "last4", "brand");

-- CreateIndex
CREATE INDEX "InstallmentPlan_cardId_idx" ON "InstallmentPlan"("cardId");

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
