
import { spawnSync } from "node:child_process";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { requireTestDatabaseUrl } from "../integration/support/testDatabase.js";

const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: resolve(backendDirectory, ".env"), quiet: true });
const testDatabaseUrl = requireTestDatabaseUrl();
const require = createRequire(import.meta.url);

const prismaCli = require.resolve("prisma/build/index.js");

const testEnvironment = {
    ...process.env,
    TEST_DATABASE_URL: testDatabaseUrl,
};

function run(executable, args, environment = testEnvironment) {
    const result = spawnSync(executable, args, {
        cwd: backendDirectory,
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

// Migrations receive the validated test URL only after all parent-process safety
// checks complete. Tests retain the original DATABASE_URL for equality checking.
run(process.execPath, [prismaCli, "migrate", "deploy"], { ...testEnvironment, DATABASE_URL: testDatabaseUrl });

// Run integration tests using Node's test runner.
run(process.execPath, ["--test", "integration/postgres.integration.test.js"]);
