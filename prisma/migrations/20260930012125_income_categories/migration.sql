-- Replaces the free-text "source" of an income with a per-user category, preserving
-- existing data: every distinct (user, source) becomes a category and each income is
-- pointed at the matching one. "source" is dropped last, once nothing depends on it.

-- CreateTable
CREATE TABLE "IncomeCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncomeCategory_userId_idx" ON "IncomeCategory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeCategory_userId_name_key" ON "IncomeCategory"("userId", "name");

-- AlterTable: nullable for now so existing rows stay valid while they are backfilled
ALTER TABLE "Income" ADD COLUMN "categoryId" TEXT;

-- Backfill: one category per (user, case-insensitive trimmed source). Blank sources become
-- 'Other'; names are capped at the 40 characters the app allows for category names.
INSERT INTO "IncomeCategory" ("id", "userId", "name")
SELECT DISTINCT ON ("userId", lower("name"))
    gen_random_uuid()::text,
    "userId",
    "name"
FROM (
    SELECT
        "userId",
        left(COALESCE(NULLIF(btrim("source"), ''), 'Other'), 40) AS "name"
    FROM "Income"
) AS "normalized"
ORDER BY "userId", lower("name"), "name";

UPDATE "Income" AS i
SET "categoryId" = c."id"
FROM "IncomeCategory" AS c
WHERE c."userId" = i."userId"
  AND lower(c."name") = lower(left(COALESCE(NULLIF(btrim(i."source"), ''), 'Other'), 40));

-- Every income now has a category, so the column can become required.
ALTER TABLE "Income" ALTER COLUMN "categoryId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Income_categoryId_idx" ON "Income"("categoryId");

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IncomeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropColumn (last: the backfill above reads it)
ALTER TABLE "Income" DROP COLUMN "source";
