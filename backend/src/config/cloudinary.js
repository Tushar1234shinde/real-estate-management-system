import { v2 as cloudinary } from "cloudinary";
import { AppError } from "../errors/AppError.js";

export function createCloudinaryClient(environment = process.env) {
    const cloudName = environment.CLOUDINARY_CLOUD_NAME;
    const apiKey = environment.CLOUDINARY_API_KEY;
    const apiSecret = environment.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        throw new AppError(503, "Evidence uploads are not configured.");
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    return cloudinary;
}
