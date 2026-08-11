-- AlterTable
ALTER TABLE "Block" ADD COLUMN     "brief" JSONB,
ADD COLUMN     "objective" TEXT NOT NULL DEFAULT '';

