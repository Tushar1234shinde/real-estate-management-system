import { getJwtConfig } from "./auth.js";
import { getCorsOptions } from "./cors.js";
import { validateDatabaseTransport } from "./databaseSecurity.js";

const REQUIRED_CLOUDINARY_VARIABLES = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
];

export function validateProductionConfiguration(environment = process.env) {
    if (environment.NODE_ENV !== "production") return;

    // These helpers validate format without including any environment values in errors.
    getJwtConfig(environment);
    getCorsOptions(environment);
    validateDatabaseTransport(environment);

    for (const variableName of REQUIRED_CLOUDINARY_VARIABLES) {
        if (!environment[variableName]?.trim()) {
            throw new Error(`${variableName} must be configured in production.`);
        }
    }
}
