import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import dotenv from "dotenv";
import { requireCloudinaryTestConfig } from "../integration/support/cloudinaryTest.js";

const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: resolve(backendDirectory, ".env"), quiet: true });
const configuration = requireCloudinaryTestConfig(process.env);
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const testEnvironment = {
    ...process.env,
    TEST_DATABASE_URL: configuration.testDatabaseUrl,
    CLOUDINARY_TEST_RUN_ID: configuration.runId,
};

function run(executable, args, environment = testEnvironment) {
    const result = spawnSync(executable, args, { cwd: backendDirectory, env: environment, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}

// This performs forward-only migrations exclusively against the validated test database.
run(process.execPath, [prismaCli, "migrate", "deploy"], { ...testEnvironment, DATABASE_URL: configuration.testDatabaseUrl });
run(process.execPath, ["--test", "integration/cloudinary.integration.test.js"]);
