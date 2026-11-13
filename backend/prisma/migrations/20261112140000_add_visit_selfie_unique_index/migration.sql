CREATE UNIQUE INDEX "media_assets_one_visit_selfie_per_visit_key"
ON "media_assets"("visitId")
WHERE "mediaType" = 'VISIT_SELFIE';