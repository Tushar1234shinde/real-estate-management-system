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

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "assetId" TEXT,
ADD COLUMN     "deliveryType" TEXT,
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "resourceType" TEXT;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "verificationRadiusMeters" INTEGER NOT NULL DEFAULT 200;

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMPTZ(3),
ADD COLUMN     "reviewerId" INTEGER,
ADD COLUMN     "verificationCheckedAt" TIMESTAMPTZ(3),
ADD COLUMN     "verificationDistanceMeters" DOUBLE PRECISION,
ADD COLUMN     "verificationResult" "VisitVerificationResult" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "visit_status_history" (
    "id" SERIAL NOT NULL,
    "visitId" INTEGER NOT NULL,
    "previousStatus" "VisitStatus",
    "newStatus" "VisitStatus" NOT NULL,
    "changedByUserId" INTEGER NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visit_status_history_visitId_changedAt_idx" ON "visit_status_history"("visitId", "changedAt");

-- CreateIndex
CREATE INDEX "visit_status_history_changedByUserId_idx" ON "visit_status_history"("changedByUserId");

-- CreateIndex
CREATE INDEX "visits_reviewerId_idx" ON "visits"("reviewerId");

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_status_history" ADD CONSTRAINT "visit_status_history_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_status_history" ADD CONSTRAINT "visit_status_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Property coordinate validation
ALTER TABLE "properties"
ADD CONSTRAINT "properties_latitude_range_check"
CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90);

ALTER TABLE "properties"
ADD CONSTRAINT "properties_longitude_range_check"
CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180);

ALTER TABLE "properties"
ADD CONSTRAINT "properties_coordinates_pair_check"
CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

ALTER TABLE "properties"
ADD CONSTRAINT "properties_verificationRadiusMeters_fixed_check"
CHECK ("verificationRadiusMeters" = 200);

-- Visit coordinate and distance validation
ALTER TABLE "visits"
ADD CONSTRAINT "visits_reachedCoordinates_pair_check"
CHECK (("reachedLatitude" IS NULL) = ("reachedLongitude" IS NULL));

ALTER TABLE "visits"
ADD CONSTRAINT "visits_verificationDistanceMeters_nonnegative_check"
CHECK (
    "verificationDistanceMeters" IS NULL
    OR "verificationDistanceMeters" >= 0
);

    -- -- Only one visit selfie per visit
    -- CREATE UNIQUE INDEX "media_assets_one_visit_selfie_per_visit_key"
    -- ON "media_assets"("visitId")
    -- WHERE "mediaType" = 'VISIT_SELFIE';