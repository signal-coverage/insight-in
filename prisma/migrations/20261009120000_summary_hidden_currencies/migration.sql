-- The currencies the user hides from the month tabs of the summary. Display only: nothing else reads it.
-- Additive only: the empty default keeps every currency visible, and existing rows are filled with it.

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "hiddenSummaryCurrencies" TEXT[] DEFAULT ARRAY[]::TEXT[];
