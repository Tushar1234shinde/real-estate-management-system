import { spawnSync } from "node:child_process";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import {
    integrationPreflightReport,
    runIntegrationPreflight,
    IntegrationPreflightError,
} from "../integration/support/preflight.js";
import { requireTestDatabaseUrl } from "../integration/support/testDatabase.js";

const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_CHILD_OUTPUT_BYTES = 10 * 1024 * 1024;

function runChild(executable, args, environment) {
    const result = spawnSync(executable, args, {
        cwd: backendDirectory,
        env: environment,
        encoding: "utf8",
        maxBuffer: MAX_CHILD_OUTPUT_BYTES,
        stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.error) {
        throw new Error("A guarded integration subprocess could not be started.");
    }
    return result;
}

function tapSummary(output) {
    const summary = {};
    for (const field of ["tests", "pass", "fail", "cancelled", "skipped", "todo"]) {
        const value = output.match(new RegExp(`^# ${field} (\\d+)$`, "m"));
        if (value) summary[field] = Number(value[1]);
    }
    return Object.keys(summary).length === 6 ? summary : null;
}

async function main() {
    dotenv.config({ path: resolve(backendDirectory, ".env"), quiet: true });

    const preflight = await runIntegrationPreflight();
    try {
        console.info(JSON.stringify(integrationPreflightReport(preflight)));

        if (preflight.pendingMigrations.length > 0) {
            const testDatabaseUrl = requireTestDatabaseUrl();
            const require = createRequire(import.meta.url);
            const prismaCli = require.resolve("prisma/build/index.js");
            const migrationResult = runChild(
                process.execPath,
                [prismaCli, "migrate", "deploy"],
                {
                    ...process.env,
                    TEST_DATABASE_URL: testDatabaseUrl,
                    DATABASE_URL: testDatabaseUrl,
                },
            );
            if (migrationResult.status !== 0) {
                throw new Error(`Migration deployment failed with exit status ${migrationResult.status ?? "unknown"}; subprocess output was suppressed.`);
            }
            console.info(JSON.stringify({
                event: "integration_migrations_applied",
                migrations: preflight.pendingMigrations,
            }));
        }
    } finally {
        await preflight.release();
    }

    const testResult = runChild(
        process.execPath,
        [
            "--test",
            "--test-reporter=tap",
            "--test-concurrency=1",
            "integration/postgres.integration.test.js",
            "integration/whatsapp.integration.test.js",
            "integration/propertyDocuments.integration.test.js",
        ],
        {
            ...process.env,
            TEST_DATABASE_URL: requireTestDatabaseUrl(),
        },
    );
    const summary = tapSummary(`${testResult.stdout ?? ""}\n${testResult.stderr ?? ""}`);
    if (summary) {
        console.info(JSON.stringify({ event: "integration_tests_completed", ...summary }));
    }
    if (testResult.status !== 0) {
        throw new Error(`PostgreSQL integration tests failed with exit status ${testResult.status ?? "unknown"}; subprocess output was suppressed.`);
    }
    if (!summary) {
        throw new Error("PostgreSQL integration tests completed without a parseable TAP summary.");
    }
}

try {
    await main();
} catch (error) {
    const message = error instanceof IntegrationPreflightError
        ? error.message
        : error instanceof Error && /^(Migration deployment|PostgreSQL integration tests|A guarded integration|PostgreSQL integration tests completed)/.test(error.message)
            ? error.message
            : "Integration test runner stopped safely; diagnostic details were suppressed.";
    console.error(JSON.stringify({ event: "integration_runner_stopped", error: message }));
    process.exitCode = 1;
}
