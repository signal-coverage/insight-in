-- Contract step of stage 2 (account instead of medium): every movement, template, plan and opening
-- amount now requires its account, and the payment medium is gone. No row is translated: the
-- controller re-checks right before applying that no row lacks an account (see the plan, Task 11).

-- DropIndex
DROP INDEX "OpeningBalance_userId_currency_medium_key";

-- AlterTable
ALTER TABLE "Income" DROP COLUMN "medium",
ALTER COLUMN "accountId" SET NOT NULL;

-- AlterTable
ALTER TABLE "RecurringIncome" DROP COLUMN "medium",
ALTER COLUMN "accountId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "medium",
ALTER COLUMN "accountId" SET NOT NULL;

-- AlterTable
ALTER TABLE "InstallmentPlan" DROP COLUMN "medium",
ALTER COLUMN "accountId" SET NOT NULL;

-- AlterTable
ALTER TABLE "RecurringExpense" DROP COLUMN "medium",
ALTER COLUMN "accountId" SET NOT NULL;

-- AlterTable
ALTER TABLE "OpeningBalance" DROP COLUMN "currency",
DROP COLUMN "medium",
ALTER COLUMN "accountId" SET NOT NULL;

-- DropEnum
DROP TYPE "PaymentMedium";

