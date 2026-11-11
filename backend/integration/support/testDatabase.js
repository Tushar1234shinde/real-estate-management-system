import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";

const TEST_DATABASE_SUFFIX = "_integration_test";

function requireIntegrationOptIn(environment) {
    if (environment.INTEGRATION_TESTS_ENABLED !== "true") {
        throw new Error("INTEGRATION_TESTS_ENABLED=true is required for integration tests.");
    }

    if (environment.NODE_ENV === "production") {
        throw new Error("Integration tests cannot run when NODE_ENV=production.");
    }
}

function normalizedUrl(value) {
    try {
        return new URL(value).toString();
    } catch {
        return null;
    }
}

function requireAllowedHost(hostname, environment) {
    const configuredHosts = environment.TEST_DATABASE_ALLOWED_HOSTS
        ?.split(",")
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean);

    if (!configuredHosts?.length) {
        throw new Error("TEST_DATABASE_ALLOWED_HOSTS must list approved integration database hosts.");
    }

    if (!configuredHosts.includes(hostname.toLowerCase())) {
        throw new Error("TEST_DATABASE_URL host is not approved for integration tests.");
    }
}

export function requireTestDatabaseUrl(environment = process.env) {
    requireIntegrationOptIn(environment);
    const connectionString = environment.TEST_DATABASE_URL;

    if (!connectionString) {
        throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests.");
    }

    let parsed;
    try {
        parsed = new URL(connectionString);
    } catch {
        throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL connection URL.");
    }

    if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
        throw new Error("TEST_DATABASE_URL must use the PostgreSQL protocol.");
    }

    if (environment.DATABASE_URL && normalizedUrl(connectionString) === normalizedUrl(environment.DATABASE_URL)) {
        throw new Error("TEST_DATABASE_URL must not match DATABASE_URL.");
    }

    requireAllowedHost(parsed.hostname, environment);

    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (!databaseName || databaseName.includes("/") || !databaseName.endsWith(TEST_DATABASE_SUFFIX)) {
        throw new Error(`The integration-test database name must end with ${TEST_DATABASE_SUFFIX}.`);
    }

    return connectionString;
}

export function createIntegrationPrisma(connectionString = requireTestDatabaseUrl()) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
