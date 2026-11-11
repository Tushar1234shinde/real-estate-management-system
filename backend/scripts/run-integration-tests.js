
import { spawnSync } from "node:child_process";
import process from "node:process";
import { createRequire } from "node:module";
import { requireTestDatabaseUrl } from "../integration/support/testDatabase.js";

const testDatabaseUrl = requireTestDatabaseUrl();
const require = createRequire(import.meta.url);

const prismaCli = require.resolve("prisma/build/index.js");

const environment = {
    ...process.env,
    // Only the validated disposable test URL is exposed to child processes.
    DATABASE_URL: testDatabaseUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
};

function run(executable, args) {
    const result = spawnSync(executable, args, {
        cwd: process.cwd(),
        env: environment,
        stdio: "inherit",
    });

    if (result.error) {
        console.error("Failed to execute:", executable, result.error.message);
        process.exit(1);
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

// Migrations run only after TEST_DATABASE_URL validation.
run(process.execPath, [prismaCli, "migrate", "deploy"]);

// Run integration tests using Node's test runner.
run(process.execPath, ["--test", "integration/postgres.integration.test.js"]);
