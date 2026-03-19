/*
  Warnings:

  - You are about to drop the column `note` on the `StockMovement` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "MovementType" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "StockMovement" DROP COLUMN "note",
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "reference" TEXT;
