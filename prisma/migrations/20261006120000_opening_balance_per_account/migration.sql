-- The opening balance moves from (currency, medium) to one row per account. The table is empty (the
-- controller re-checks it right before applying), so nothing is translated. The old columns stay,
-- nullable, until the contract migration drops them.

-- AlterTable
ALTER TABLE "OpeningBalance" ALTER COLUMN "currency" DROP NOT NULL,
ALTER COLUMN "medium" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "OpeningBalance_userId_accountId_key" ON "OpeningBalance"("userId", "accountId");
