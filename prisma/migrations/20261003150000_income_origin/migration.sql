-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "originAmount" BIGINT,
ADD COLUMN     "originCurrency" TEXT;

-- The origin of an income (the currency and the amount its net amount came from) is a pair: both are
-- set, with a positive amount, or both are null. Prisma cannot express this, so it is written by
-- hand. Every income that exists today has neither, so it already complies.
ALTER TABLE "Income" ADD CONSTRAINT "Income_origin_pair_check" CHECK (
  ("originCurrency" IS NULL AND "originAmount" IS NULL)
  OR
  ("originCurrency" IS NOT NULL AND "originAmount" IS NOT NULL AND "originAmount" > 0)
);
