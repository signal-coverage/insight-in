-- The kind of each bank: an entity (legal tender only) or a virtual wallet (crypto too). Additive only:
-- the column default fills every existing bank as an entity, the cash bank included.

-- CreateEnum
CREATE TYPE "BankKind" AS ENUM ('ENTITY', 'WALLET');

-- AlterTable
ALTER TABLE "Bank" ADD COLUMN     "kind" "BankKind" NOT NULL DEFAULT 'ENTITY';
