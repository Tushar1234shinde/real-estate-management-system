-- CreateEnum
CREATE TYPE "VisitVerificationResult" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- AlterEnum
ALTER TYPE "MediaType" ADD VALUE 'VISIT_SELFIE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VisitStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "VisitStatus" ADD VALUE 'REJECTED';
