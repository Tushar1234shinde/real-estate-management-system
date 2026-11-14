import { v2 as cloudinary } from "cloudinary";
import { AppError } from "../errors/AppError.js";

const DEFAULT_EVIDENCE_FOLDER = "visit-evidence";
const DEFAULT_PROPERTY_DOCUMENTS_FOLDER = "property-documents";

export function getCloudinaryEvidenceFolder(environment = process.env) {
    const folder = environment.CLOUDINARY_EVIDENCE_FOLDER?.trim() || DEFAULT_EVIDENCE_FOLDER;
    const segments = folder.split("/");

    if (!segments.every((segment) => /^[A-Za-z0-9_-]+$/.test(segment))) {
        throw new AppError(503, "Evidence uploads are not configured.");
    }

    return folder;
}

export function getCloudinaryPropertyDocumentsFolder(environment = process.env) {
    const folder = environment.CLOUDINARY_PROPERTY_DOCUMENTS_FOLDER?.trim() || DEFAULT_PROPERTY_DOCUMENTS_FOLDER;
    const segments = folder.split("/");

    if (!segments.every((segment) => /^[A-Za-z0-9_-]+$/.test(segment))) {
        throw new AppError(503, "Property document uploads are not configured.");
    }

    return folder;
}

export function createCloudinaryClient(environment = process.env, mediaLabel = "Evidence") {
    const cloudName = environment.CLOUDINARY_CLOUD_NAME;
    const apiKey = environment.CLOUDINARY_API_KEY;
    const apiSecret = environment.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        throw new AppError(503, `${mediaLabel} uploads are not configured.`);
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    return cloudinary;
}
