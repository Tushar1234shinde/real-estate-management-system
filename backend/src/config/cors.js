import "dotenv/config";

const LOCAL_DEVELOPMENT_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8443",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8443",
];

export function getCorsOptions(environment = process.env) {
    const configuredOrigins = environment.CORS_ORIGINS
        ?.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    const origins = configuredOrigins?.length
        ? configuredOrigins
        : environment.NODE_ENV === "production"
            ? null
            : LOCAL_DEVELOPMENT_ORIGINS;

    if (!origins) {
        throw new Error("CORS_ORIGINS must be configured in production.");
    }

    if (origins.includes("*")) {
        throw new Error("CORS_ORIGINS must list explicit origins and cannot include '*'.");
    }

    return { origin: origins };
}
