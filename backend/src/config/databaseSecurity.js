const PRODUCTION_ENVIRONMENT = "production";

export function validateDatabaseTransport(environment = process.env) {
    if (environment.NODE_ENV !== PRODUCTION_ENVIRONMENT) return;

    const connectionString = environment.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is required in production.");
    }

    let databaseUrl;
    try {
        databaseUrl = new URL(connectionString);
    } catch {
        throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL in production.");
    }

    if (!new Set(["postgres:", "postgresql:"]).has(databaseUrl.protocol)) {
        throw new Error("DATABASE_URL must use the PostgreSQL protocol in production.");
    }

    // `verify-full` is the PostgreSQL URL mode that enables TLS and verifies the
    // server certificate and host identity. Do not silently accept weaker modes.
    if (databaseUrl.searchParams.get("sslmode") !== "verify-full") {
        throw new Error("DATABASE_URL must use sslmode=verify-full in production.");
    }
}
