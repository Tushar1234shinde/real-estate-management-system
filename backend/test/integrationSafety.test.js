import assert from "node:assert/strict";
import { test } from "node:test";
import { requireTestDatabaseUrl } from "../integration/support/testDatabase.js";
import {
    APPROVED_ANNOUNCEMENTS_MIGRATION,
    APPROVED_PROPERTY_DOCUMENTS_MIGRATION,
    APPROVED_WHATSAPP_MIGRATIONS,
    compareMigrationLedger,
    integrationPreflightReport,
    runIntegrationPreflight,
} from "../integration/support/preflight.js";

const validUrl = "postgresql://real_estate_test_user:test-password@integration-db.test:5432/real_estate_integration_v2_integration_test?sslmode=verify-full";
const developmentUrl = "postgresql://app_user:dev-password@development-db.test:5432/real_estate_db";
const baselineMigrations = [
    "20261106110757_finalize_real_estate_schema",
    "20261108045018_add_outside_sales_visit_review_workflow",
    "20261108045019_add_outside_sales_visit_review_workflow_schema",
    "20261111120000_add_cloudinary_media_metadata",
];
const repositoryMigrations = [
    ...baselineMigrations,
    ...APPROVED_WHATSAPP_MIGRATIONS,
    APPROVED_PROPERTY_DOCUMENTS_MIGRATION,
    APPROVED_ANNOUNCEMENTS_MIGRATION,
].sort();
const establishedLedger = [...baselineMigrations, APPROVED_PROPERTY_DOCUMENTS_MIGRATION, APPROVED_ANNOUNCEMENTS_MIGRATION]
    .map((migration_name) => ({
        migration_name,
        started_at: new Date(),
        finished_at: new Date(),
        rolled_back_at: null,
    }));
const actualDatabaseIdentity = {
    database_name: "real_estate_integration_v2_integration_test",
    login_role: "real_estate_test_user",
    database_owner: "real_estate_test_user",
};

function environment(overrides = {}) {
    return {
        NODE_ENV: "test",
        INTEGRATION_TESTS_ENABLED: "true",
        TEST_DATABASE_URL: validUrl,
        TEST_DATABASE_ALLOWED_HOSTS: "integration-db.test",
        DATABASE_URL: developmentUrl,
        ...overrides,
    };
}

function mockDatabase({
    identity = actualDatabaseIdentity,
    ledgerRows = establishedLedger,
    ledgerExists = true,
    connectError = null,
} = {}) {
    const calls = [];
    const client = {
        async connect() {
            if (connectError) throw connectError;
        },
        async query(sql) {
            calls.push(sql);
            if (sql.includes("pg_advisory_lock(")) return { rows: [{}] };
            if (sql.includes("current_database()")) return { rows: identity ? [identity] : [] };
            if (sql.includes("to_regclass(")) return { rows: [{ ledger: ledgerExists ? "_prisma_migrations" : null }] };
            if (sql.includes('FROM public."_prisma_migrations"')) return { rows: ledgerRows };
            if (sql.includes("pg_advisory_unlock(")) return { rows: [{ unlocked: true }] };
            throw new Error("Unexpected mocked query.");
        },
        async end() {
            calls.push("end");
        },
    };
    return { client, calls };
}

async function runMockPreflight({
    environmentOverrides = {},
    databaseOptions = {},
} = {}) {
    const testEnvironment = environment({
        INTEGRATION_MIGRATIONS_CONFIRMED: "true",
        ...environmentOverrides,
    });
    const database = mockDatabase(databaseOptions);
    const result = await runIntegrationPreflight({
        environment: testEnvironment,
        repositoryMigrations,
        clientFactory: (connectionString) => {
            database.connectionString = connectionString;
            return database.client;
        },
    });
    return { testEnvironment, database, result };
}

test("requires explicit integration opt-in", () => {
    assert.throws(
        () => requireTestDatabaseUrl(environment({ INTEGRATION_TESTS_ENABLED: undefined })),
        /INTEGRATION_TESTS_ENABLED=true/,
    );
    assert.throws(
        () => requireTestDatabaseUrl(environment({ INTEGRATION_TESTS_ENABLED: "false" })),
        /INTEGRATION_TESTS_ENABLED=true/,
    );
});

test("rejects production environment and production database identities", () => {
    assert.throws(
        () => requireTestDatabaseUrl(environment({ NODE_ENV: "production" })),
        /cannot run when NODE_ENV=production/,
    );
    assert.throws(
        () => requireTestDatabaseUrl(environment({
            TEST_DATABASE_URL: "postgresql://real_estate_test_user:test@prod-primary.test:5432/real_estate_integration_v2_integration_test?sslmode=verify-full",
            TEST_DATABASE_ALLOWED_HOSTS: "prod-primary.test",
        })),
        /production database/,
    );
    assert.throws(
        () => requireTestDatabaseUrl(environment({
            DATABASE_URL: "postgresql://app_user:prod@integration-db.test:5432/production",
        })),
        /production database host/,
    );
});

test("requires a non-empty explicit test URL and never falls back to DATABASE_URL", () => {
    assert.throws(
        () => requireTestDatabaseUrl(environment({ TEST_DATABASE_URL: undefined })),
        /TEST_DATABASE_URL must be a non-empty PostgreSQL connection URL/,
    );
    assert.throws(
        () => requireTestDatabaseUrl(environment({ TEST_DATABASE_URL: "" })),
        /TEST_DATABASE_URL must be a non-empty PostgreSQL connection URL/,
    );
    assert.throws(
        () => requireTestDatabaseUrl(environment({ TEST_DATABASE_URL: "   " })),
        /TEST_DATABASE_URL must be a non-empty PostgreSQL connection URL/,
    );
});

test("rejects malformed, non-PostgreSQL, and ambiguous URLs", () => {
    for (const url of [
        "not-a-url",
        "mysql://real_estate_test_user:secret@integration-db.test/real_estate_integration_test",
        "postgresql://real_estate_test_user:secret@integration-db.test/real_estate_integration_test?host=other.test",
        "postgresql://real_estate_test_user:secret@integration-db.test/real_estate_integration_test?sslmode=require&sslmode=verify-full",
        "postgresql://real_estate_test_user:secret@integration-db.test/real_estate_integration_test#fragment",
        "postgresql://real_estate_test_user:secret@integration-db.test/real_estate_integration_test/",
    ]) {
        assert.throws(() => requireTestDatabaseUrl(environment({ TEST_DATABASE_URL: url })));
    }
    for (const parameter of ["schema", "options", "search_path"]) {
        const url = new URL(validUrl);
        url.searchParams.set(parameter, "other");
        assert.throws(
            () => requireTestDatabaseUrl(environment({ TEST_DATABASE_URL: url.toString() })),
            /public schema without search-path overrides/,
        );
    }
});

test("requires verified TLS for the integration database URL", () => {
    for (const testUrl of [
        validUrl.replace("sslmode=verify-full", "sslmode=require"),
        validUrl.replace("?sslmode=verify-full", ""),
        validUrl.replace("sslmode=verify-full", "sslmode=disable"),
    ]) {
        assert.throws(
            () => requireTestDatabaseUrl(environment({ TEST_DATABASE_URL: testUrl })),
            /sslmode=verify-full/,
        );
    }
});

test("requires the exact integration database name and dedicated login role", () => {
    assert.throws(
        () => requireTestDatabaseUrl(environment({
            TEST_DATABASE_URL: "postgresql://real_estate_test_user:test@integration-db.test:5432/real_estate",
        })),
        /must target the dedicated integration database/,
    );
    assert.throws(
        () => requireTestDatabaseUrl(environment({
            TEST_DATABASE_URL: "postgresql://real_estate_test_user:test@integration-db.test:5432/other_integration_test",
        })),
        /must target the dedicated integration database/,
    );
    assert.throws(
        () => requireTestDatabaseUrl(environment({ TEST_DATABASE_URL: validUrl.replace("real_estate_test_user", "app_user") })),
        /username must be real_estate_test_user/,
    );
});

test("requires an explicit hostname allowlist without ambiguous entries", () => {
    assert.throws(
        () => requireTestDatabaseUrl(environment({ TEST_DATABASE_ALLOWED_HOSTS: undefined })),
        /TEST_DATABASE_ALLOWED_HOSTS must list approved/,
    );
    assert.throws(
        () => requireTestDatabaseUrl(environment({ TEST_DATABASE_ALLOWED_HOSTS: "other-db.test" })),
        /host is not approved/,
    );
    assert.throws(
        () => requireTestDatabaseUrl(environment({ TEST_DATABASE_ALLOWED_HOSTS: "integration-db.test," })),
        /must not contain empty entries/,
    );
    assert.throws(
        () => requireTestDatabaseUrl(environment({ TEST_DATABASE_ALLOWED_HOSTS: "*" })),
        /hostnames only/,
    );
    assert.throws(
        () => requireTestDatabaseUrl(environment({ TEST_DATABASE_ALLOWED_HOSTS: "integration-db.test,integration-db.test" })),
        /must not contain duplicate hosts/,
    );
});

test("rejects the same normalized database identity despite URL credential or parameter differences", () => {
    assert.throws(
        () => requireTestDatabaseUrl(environment({
            DATABASE_URL: "postgresql://real_estate_test_user:different-password@integration-db.test/real_estate_integration_v2_integration_test?sslmode=disable",
        })),
        /must not target the configured DATABASE_URL database/,
    );
    assert.throws(
        () => requireTestDatabaseUrl(environment({
            DATABASE_URL: "postgresql://another_user:password@integration-db.test:5432/real_estate_integration_v2_integration_test?schema=other",
        })),
        /must not target the configured DATABASE_URL database/,
    );
});

test("rejects malformed configured DATABASE_URL instead of skipping identity comparison", () => {
    assert.throws(
        () => requireTestDatabaseUrl(environment({ DATABASE_URL: "" })),
        /DATABASE_URL must be a non-empty PostgreSQL connection URL/,
    );
    assert.throws(
        () => requireTestDatabaseUrl(environment({ DATABASE_URL: "not-a-url" })),
        /DATABASE_URL must be a valid PostgreSQL connection URL/,
    );
});

test("requires DATABASE_URL to exclude an unknown development database location", () => {
    assert.throws(
        () => requireTestDatabaseUrl(environment({ DATABASE_URL: undefined })),
        /DATABASE_URL must be configured/,
    );
});

test("validation errors never include credentials or full connection strings", () => {
    const secretUrl = "postgresql://real_estate_test_user:do-not-print@prod-db.test:5432/real_estate_integration_v2_integration_test";
    assert.throws(
        () => requireTestDatabaseUrl(environment({
            TEST_DATABASE_URL: secretUrl,
            TEST_DATABASE_ALLOWED_HOSTS: "prod-db.test",
        })),
        (error) => {
            assert.equal(error.message.includes("do-not-print"), false);
            assert.equal(error.message.includes(secretUrl), false);
            return true;
        },
    );
});

test("accepts a dedicated integration database on an explicitly allowed host", () => {
    const validatedUrl = requireTestDatabaseUrl(environment());
    assert.equal(validatedUrl.endsWith("/real_estate_integration_v2_integration_test?sslmode=verify-full"), true);
});

test("preflight rejects an incorrect database name before connecting", async () => {
    const testEnvironment = environment({
        TEST_DATABASE_URL: validUrl.replace(
            "real_estate_integration_v2_integration_test",
            "other_integration_test",
        ),
    });
    let clientCreated = false;
    await assert.rejects(
        runIntegrationPreflight({
            environment: testEnvironment,
            repositoryMigrations,
            clientFactory: () => {
                clientCreated = true;
                return mockDatabase().client;
            },
        }),
        /dedicated integration database/,
    );
    assert.equal(clientCreated, false);
});

test("preflight rejects an incorrect actual database owner", async () => {
    await assert.rejects(
        runMockPreflight({
            databaseOptions: {
                identity: { ...actualDatabaseIdentity, database_owner: "another_role" },
            },
        }),
        /database name, login role, or owner/,
    );
});

test("preflight rejects an incorrect actual login role", async () => {
    await assert.rejects(
        runMockPreflight({
            databaseOptions: {
                identity: { ...actualDatabaseIdentity, login_role: "another_login" },
            },
        }),
        /database name, login role, or owner/,
    );
});

test("preflight uses only TEST_DATABASE_URL for its connection", async () => {
    const { database, result } = await runMockPreflight();
    assert.equal(database.connectionString, validUrl);
    assert.deepEqual(result.pendingMigrations, APPROVED_WHATSAPP_MIGRATIONS);
    assert.match(database.calls[0], /pg_advisory_lock/);
    assert.equal(database.calls.includes("end"), false);
    await result.release();
    assert.match(database.calls.at(-2), /pg_advisory_unlock/);
    assert.equal(database.calls.at(-1), "end");
});

test("preflight fails closed when the migration ledger is missing", async () => {
    await assert.rejects(
        runMockPreflight({ databaseOptions: { ledgerExists: false } }),
        /migration ledger is missing/,
    );
});

test("preflight fails closed when the migration ledger has an incomplete migration", async () => {
    await assert.rejects(
        runMockPreflight({
            databaseOptions: {
                ledgerRows: [
                    ...establishedLedger,
                    {
                        migration_name: APPROVED_WHATSAPP_MIGRATIONS[0],
                        started_at: new Date(),
                        finished_at: null,
                        rolled_back_at: null,
                    },
                ],
            },
        }),
        /incomplete migration/,
    );
});

test("preflight rejects unexpected pending migrations", async () => {
    await assert.rejects(
        runMockPreflight({
            databaseOptions: {
                ledgerRows: establishedLedger.filter(
                    (row) => row.migration_name !== "20261111120000_add_cloudinary_media_metadata",
                ),
            },
        }),
        /Unexpected pending migrations/,
    );
});

test("migration ledger comparison accepts exactly the approved WhatsApp set", () => {
    const result = compareMigrationLedger(repositoryMigrations, establishedLedger);
    assert.deepEqual(result.pendingMigrations, APPROVED_WHATSAPP_MIGRATIONS);
    assert.deepEqual(result.appliedMigrations, establishedLedger.map((row) => row.migration_name));
});

test("preflight requires confirmation for the approved pending WhatsApp set", async () => {
    await assert.rejects(
        runMockPreflight({
            environmentOverrides: { INTEGRATION_MIGRATIONS_CONFIRMED: undefined },
        }),
        /INTEGRATION_MIGRATIONS_CONFIRMED=true is required/,
    );
});

test("migration confirmation cannot bypass the actual database identity check", async () => {
    await assert.rejects(
        runMockPreflight({
            environmentOverrides: { INTEGRATION_MIGRATIONS_CONFIRMED: "true" },
            databaseOptions: {
                identity: { ...actualDatabaseIdentity, database_owner: "wrong_owner" },
            },
        }),
        /database name, login role, or owner/,
    );
});

test("the property documents confirmation authorizes only its exact migration", () => {
    const appliedLedger = [...baselineMigrations, ...APPROVED_WHATSAPP_MIGRATIONS, APPROVED_ANNOUNCEMENTS_MIGRATION].map((migration_name) => ({
        migration_name,
        started_at: new Date(),
        finished_at: new Date(),
        rolled_back_at: null,
    }));
    const result = compareMigrationLedger(repositoryMigrations, appliedLedger);
    assert.deepEqual(result.pendingMigrations, [APPROVED_PROPERTY_DOCUMENTS_MIGRATION]);
    assert.throws(() => compareMigrationLedger(
        [...repositoryMigrations, "20261112190000_unapproved_migration"],
        appliedLedger,
    ), /Unexpected pending migrations/);
});

test("the property documents migration requires its own explicit confirmation", async () => {
    const appliedLedger = [...baselineMigrations, ...APPROVED_WHATSAPP_MIGRATIONS, APPROVED_ANNOUNCEMENTS_MIGRATION].map((migration_name) => ({
        migration_name,
        started_at: new Date(),
        finished_at: new Date(),
        rolled_back_at: null,
    }));
    const database = mockDatabase({ ledgerRows: appliedLedger });
    await assert.rejects(
        runIntegrationPreflight({
            environment: environment({
                INTEGRATION_MIGRATIONS_CONFIRMED: "true",
                PROPERTY_DOCUMENTS_MIGRATION_CONFIRMED: undefined,
            }),
            repositoryMigrations,
            clientFactory: () => database.client,
        }),
        /PROPERTY_DOCUMENTS_MIGRATION_CONFIRMED=true is required/,
    );

    const confirmedDatabase = mockDatabase({ ledgerRows: appliedLedger });
    const preflight = await runIntegrationPreflight({
        environment: environment({
            INTEGRATION_MIGRATIONS_CONFIRMED: undefined,
            PROPERTY_DOCUMENTS_MIGRATION_CONFIRMED: "true",
        }),
        repositoryMigrations,
        clientFactory: () => confirmedDatabase.client,
    });
    assert.deepEqual(preflight.pendingMigrations, [APPROVED_PROPERTY_DOCUMENTS_MIGRATION]);
    await preflight.release();
});

test("preflight errors and reports do not expose connection URLs or passwords", async () => {
    const secretUrl = "postgresql://real_estate_test_user:never-log-this@integration-db.test/private";
    await assert.rejects(
        runMockPreflight({
            databaseOptions: { connectError: new Error(`Could not connect to ${secretUrl}`) },
        }),
        (error) => {
            assert.equal(error.message.includes("never-log-this"), false);
            assert.equal(error.message.includes(secretUrl), false);
            return true;
        },
    );

    const report = integrationPreflightReport({
        database: {
            name: actualDatabaseIdentity.database_name,
            owner: actualDatabaseIdentity.database_owner,
            loginRole: actualDatabaseIdentity.login_role,
            host: "integration-db.test",
            port: 5432,
            connectionString: secretUrl,
        },
        appliedMigrations: establishedLedger.map((row) => row.migration_name),
        pendingMigrations: APPROVED_WHATSAPP_MIGRATIONS,
        connectionString: secretUrl,
    });
    const serialized = JSON.stringify(report);
    assert.equal(serialized.includes("never-log-this"), false);
    assert.equal(serialized.includes(secretUrl), false);
    assert.deepEqual(report.pendingMigrations, APPROVED_WHATSAPP_MIGRATIONS);
});
