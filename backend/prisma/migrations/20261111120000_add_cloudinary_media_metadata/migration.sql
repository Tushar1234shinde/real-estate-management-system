-- Preserve existing evidence while retaining the Cloudinary identifiers required
-- for authenticated, server-generated access URLs.
ALTER TABLE "media_assets"
ADD COLUMN "publicId" TEXT,
ADD COLUMN "assetId" TEXT,
ADD COLUMN "resourceType" TEXT,
ADD COLUMN "deliveryType" TEXT;
