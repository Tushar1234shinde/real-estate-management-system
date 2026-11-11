import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";

const TEST_DATABASE_SUFFIX = "_integration_test";

export function requireTestDatabaseUrl(environment = process.env) {
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

    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (!databaseName || databaseName.includes("/") || !databaseName.endsWith(TEST_DATABASE_SUFFIX)) {
        throw new Error(`The integration-test database name must end with ${TEST_DATABASE_SUFFIX}.`);
    }

    return connectionString;
}

export function createIntegrationPrisma(connectionString = requireTestDatabaseUrl()) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
