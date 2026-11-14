import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";

export const TEST_DATABASE_NAME = "real_estate_integration_v2_integration_test";
export const TEST_DATABASE_USER = "real_estate_test_user";
const POSTGRES_DEFAULT_PORT = 5432;
const IDENTITY_QUERY_PARAMETERS = new Set([
    "database",
    "dbname",
    "host",
    "hostaddr",
    "port",
    "service",
    "servicefile",
    "user",
    "username",
]);
const PRODUCTION_MARKER = /(^|[._-])(prod|production|prd|live)(?=$|[._-])/i;

function decodeComponent(value, label) {
    try {
        return decodeURIComponent(value);
    } catch {
        throw new Error(`${label} contains invalid URL encoding.`);
    }
}

function normalizedHostname(hostname) {
    return hostname.toLowerCase().replace(/\.+$/, "");
}

function parseDatabaseIdentity(value, label) {
    if (typeof value !== "string" || !value || value.trim() !== value) {
        throw new Error(`${label} must be a non-empty PostgreSQL connection URL without surrounding whitespace.`);
    }

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error(`${label} must be a valid PostgreSQL connection URL.`);
    }

    if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
        throw new Error(`${label} must use the PostgreSQL protocol.`);
    }
    if (parsed.hash) throw new Error(`${label} must not include a URL fragment.`);
    if (!parsed.hostname) throw new Error(`${label} must include a database host.`);

    const username = decodeComponent(parsed.username, label);
    if (!username) throw new Error(`${label} must include a database username.`);

    const databasePath = parsed.pathname.replace(/^\//, "");
    const databaseName = decodeComponent(databasePath, label);
    if (!databaseName || databaseName.includes("/") || databaseName === "." || databaseName === "..") {
        throw new Error(`${label} must include one unambiguous database name.`);
    }

    const queryParameters = new Set();
    for (const [key] of parsed.searchParams) {
        const normalizedKey = key.toLowerCase();
        if (queryParameters.has(normalizedKey)) {
            throw new Error(`${label} must not contain duplicate query parameters.`);
        }
        queryParameters.add(normalizedKey);
        if (IDENTITY_QUERY_PARAMETERS.has(normalizedKey)) {
            throw new Error(`${label} must not override database identity in query parameters.`);
        }
    }

    const port = parsed.port ? Number(parsed.port) : POSTGRES_DEFAULT_PORT;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`${label} must use a valid PostgreSQL port.`);
    }

    return {
        host: normalizedHostname(parsed.hostname),
        port,
        databaseName,
        username,
    };
}

function isProductionIdentity(identity) {
    return PRODUCTION_MARKER.test(identity.host)
        || PRODUCTION_MARKER.test(identity.databaseName)
        || PRODUCTION_MARKER.test(identity.username);
}

function normalizeAllowedHost(value) {
    const host = value.trim();
    if (!host) throw new Error("TEST_DATABASE_ALLOWED_HOSTS must not contain empty entries.");
    if (host.includes("*") || host.includes("?")) {
        throw new Error("TEST_DATABASE_ALLOWED_HOSTS must contain hostnames only.");
    }

    let parsed;
    try {
        parsed = new URL(`postgres://${host}/`);
    } catch {
        throw new Error("TEST_DATABASE_ALLOWED_HOSTS must contain hostnames only.");
    }
    if (!parsed.hostname
        || parsed.username
        || parsed.password
        || parsed.port
        || parsed.pathname !== "/"
        || parsed.search
        || parsed.hash
        || parsed.host !== parsed.hostname) {
        throw new Error("TEST_DATABASE_ALLOWED_HOSTS must contain hostnames only.");
    }
    return normalizedHostname(parsed.hostname);
}

function requireAllowedHost(hostname, environment) {
    const configuredHosts = environment.TEST_DATABASE_ALLOWED_HOSTS;
    if (typeof configuredHosts !== "string" || !configuredHosts.trim()) {
        throw new Error("TEST_DATABASE_ALLOWED_HOSTS must list approved integration database hosts.");
    }

    const allowedHosts = configuredHosts.split(",").map(normalizeAllowedHost);
    if (new Set(allowedHosts).size !== allowedHosts.length) {
        throw new Error("TEST_DATABASE_ALLOWED_HOSTS must not contain duplicate hosts.");
    }
    if (!allowedHosts.includes(hostname)) {
        throw new Error("TEST_DATABASE_URL host is not approved for integration tests.");
    }
}

function sameDatabaseIdentity(left, right) {
    return left.host === right.host
        && left.port === right.port
        && left.databaseName === right.databaseName
        && left.username === right.username;
}

function sameDatabaseLocation(left, right) {
    return left.host === right.host
        && left.port === right.port
        && left.databaseName === right.databaseName;
}

export function requireTestDatabaseUrl(environment = process.env) {
    if (environment.INTEGRATION_TESTS_ENABLED !== "true") {
        throw new Error("INTEGRATION_TESTS_ENABLED=true is required for integration tests.");
    }
    if (typeof environment.NODE_ENV === "string" && environment.NODE_ENV.trim().toLowerCase() === "production") {
        throw new Error("Integration tests cannot run when NODE_ENV=production.");
    }

    const connectionString = environment.TEST_DATABASE_URL;
    const testIdentity = parseDatabaseIdentity(connectionString, "TEST_DATABASE_URL");

    if (testIdentity.username !== TEST_DATABASE_USER) {
        throw new Error(`TEST_DATABASE_URL username must be ${TEST_DATABASE_USER}.`);
    }
    if (testIdentity.databaseName !== TEST_DATABASE_NAME) {
        throw new Error(`TEST_DATABASE_URL must target the dedicated integration database ${TEST_DATABASE_NAME}.`);
    }
    const testUrl = new URL(connectionString);
    if (testUrl.searchParams.get("sslmode") !== "verify-full") {
        throw new Error("TEST_DATABASE_URL must use sslmode=verify-full.");
    }
    if ((testUrl.searchParams.has("schema") && testUrl.searchParams.get("schema") !== "public")
        || testUrl.searchParams.has("options")
        || testUrl.searchParams.has("search_path")) {
        throw new Error("TEST_DATABASE_URL must use the public schema without search-path overrides.");
    }
    if (isProductionIdentity(testIdentity)) {
        throw new Error("TEST_DATABASE_URL must not identify a production database.");
    }

    requireAllowedHost(testIdentity.host, environment);

    if (environment.DATABASE_URL === undefined) {
        throw new Error("DATABASE_URL must be configured to exclude the development database location.");
    }
    const developmentIdentity = parseDatabaseIdentity(environment.DATABASE_URL, "DATABASE_URL");
    if (sameDatabaseIdentity(testIdentity, developmentIdentity)
        || sameDatabaseLocation(testIdentity, developmentIdentity)) {
        throw new Error("TEST_DATABASE_URL must not target the configured DATABASE_URL database.");
    }
    if (isProductionIdentity(developmentIdentity)
        && testIdentity.host === developmentIdentity.host
        && testIdentity.port === developmentIdentity.port) {
        throw new Error("TEST_DATABASE_URL must not share a production database host.");
    }

    return connectionString;
}

export function createIntegrationPrisma(connectionString) {
    const validatedConnectionString = connectionString === undefined
        ? requireTestDatabaseUrl()
        : requireTestDatabaseUrl({ ...process.env, TEST_DATABASE_URL: connectionString });
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: validatedConnectionString }) });
}
