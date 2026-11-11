import crypto from "node:crypto";
import { requireTestDatabaseUrl } from "./testDatabase.js";

const DEFAULT_FOLDER_PREFIX = "stage7c";

function requireValue(environment, name) {
    const value = environment[name];
    if (!value) throw new Error(`${name} is required for real Cloudinary integration tests.`);
    return value;
}

function getTestFolderPrefix(environment) {
    const prefix = environment.CLOUDINARY_TEST_FOLDER_PREFIX?.trim() || DEFAULT_FOLDER_PREFIX;
    const segments = prefix.split("/");
    if (segments[0] !== "stage7c" || !segments.every((segment) => /^[A-Za-z0-9_-]+$/.test(segment))) {
        throw new Error("CLOUDINARY_TEST_FOLDER_PREFIX must be stage7c or a stage7c/<subfolder> path.");
    }
    return prefix;
}

export function requireCloudinaryTestConfig(environment = process.env) {
    if (environment.CLOUDINARY_TEST_ENABLED !== "true") {
        throw new Error("CLOUDINARY_TEST_ENABLED=true is required for real Cloudinary integration tests.");
    }

    const runId = environment.CLOUDINARY_TEST_RUN_ID ?? crypto.randomUUID();
    if (!/^[A-Za-z0-9_-]+$/.test(runId)) throw new Error("CLOUDINARY_TEST_RUN_ID is invalid.");

    return {
        testDatabaseUrl: requireTestDatabaseUrl(environment),
        cloudName: requireValue(environment, "CLOUDINARY_TEST_CLOUD_NAME"),
        apiKey: requireValue(environment, "CLOUDINARY_TEST_API_KEY"),
        apiSecret: requireValue(environment, "CLOUDINARY_TEST_API_SECRET"),
        runId,
        evidenceFolder: `${getTestFolderPrefix(environment)}/${runId}`,
    };
}
