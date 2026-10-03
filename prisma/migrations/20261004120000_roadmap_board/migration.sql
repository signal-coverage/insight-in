-- CreateEnum
CREATE TYPE "BoardStatus" AS ENUM ('IDEA', 'TODO', 'DONE', 'DEPLOYED');

-- CreateTable
CREATE TABLE "BoardItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "BoardStatus" NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardItem_userId_status_position_idx" ON "BoardItem"("userId", "status", "position");
