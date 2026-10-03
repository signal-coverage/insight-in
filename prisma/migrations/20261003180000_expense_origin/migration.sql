-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "originAmount" BIGINT,
ADD COLUMN     "originCurrency" TEXT;

-- AlterTable
ALTER TABLE "RecurringExpense" ADD COLUMN     "originAmount" BIGINT,
ADD COLUMN     "originCurrency" TEXT;

-- The origin of an expense (the currency and the price it was quoted in, when it really cost another
-- currency) is a pair: both are set, with a positive amount, or both are null. A recurring template
-- remembers the same reference price. Prisma cannot express this, so it is written by hand. Every
-- row that exists today has neither, so it already complies.
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_origin_pair_check" CHECK (
  ("originCurrency" IS NULL AND "originAmount" IS NULL)
  OR
  ("originCurrency" IS NOT NULL AND "originAmount" IS NOT NULL AND "originAmount" > 0)
);

ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_origin_pair_check" CHECK (
  ("originCurrency" IS NULL AND "originAmount" IS NULL)
  OR
  ("originCurrency" IS NOT NULL AND "originAmount" IS NOT NULL AND "originAmount" > 0)
);
