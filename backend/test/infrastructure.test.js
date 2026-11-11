import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { after, before, test } from "node:test";
import crypto from "node:crypto";
import { createApp } from "../src/app.js";
import { validateDatabaseTransport } from "../src/config/databaseSecurity.js";
import { validateProductionConfiguration } from "../src/config/production.js";
import { createGracefulShutdown, registerGracefulShutdown } from "../src/shutdown.js";
import { requireTestDatabaseUrl } from "../integration/support/testDatabase.js";

const jwtConfig = {
    secret: crypto.randomBytes(32).toString("base64url"),
    expiresIn: "1h",
    issuer: "test-real-estate-api",
    audience: "test-real-estate-client",
};

let healthyServer;
let unhealthyServer;
let healthyBaseUrl;
let unhealthyBaseUrl;

before(async () => {
    const healthyPrisma = { async $queryRaw() { return [{ ok: 1 }]; } };
    const unavailablePrisma = { async $queryRaw() { throw new Error("database unavailable"); } };
    healthyServer = await new Promise((resolve) => {
        const server = createApp({ prismaClient: healthyPrisma, jwtConfig, corsOptions: { origin: false } })
            .listen(0, () => resolve(server));
    });
    unhealthyServer = await new Promise((resolve) => {
        const server = createApp({ prismaClient: unavailablePrisma, jwtConfig, corsOptions: { origin: false } })
            .listen(0, () => resolve(server));
    });
    healthyBaseUrl = `http://127.0.0.1:${healthyServer.address().port}`;
    unhealthyBaseUrl = `http://127.0.0.1:${unhealthyServer.address().port}`;
});

after(async () => {
    await Promise.all([
        new Promise((resolve, reject) => healthyServer.close((error) => (error ? reject(error) : resolve()))),
        new Promise((resolve, reject) => unhealthyServer.close((error) => (error ? reject(error) : resolve()))),
    ]);
});

test("validates secure database transport only in production", () => {
    assert.doesNotThrow(() => validateDatabaseTransport({ NODE_ENV: "development" }));
    assert.doesNotThrow(() => validateDatabaseTransport({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:password@db.example.test:5432/app?sslmode=verify-full",
    }));
    assert.throws(() => validateDatabaseTransport({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:password@db.example.test:5432/app",
    }), /sslmode=verify-full/);
    assert.throws(() => validateDatabaseTransport({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:password@db.example.test:5432/app?sslmode=require",
    }), /sslmode=verify-full/);
});

test("requires explicit and isolated integration database configuration", () => {
    const testDatabaseUrl = "postgresql://test_user:test_password@integration-db.test:5432/real_estate_integration_test";
    const developmentDatabaseUrl = "postgresql://dev_user:dev_password@development-db.test:5432/real_estate_db";
    const safeEnvironment = {
        NODE_ENV: "test",
        INTEGRATION_TESTS_ENABLED: "true",
        TEST_DATABASE_URL: testDatabaseUrl,
        DATABASE_URL: developmentDatabaseUrl,
        TEST_DATABASE_ALLOWED_HOSTS: "integration-db.test",
    };

    assert.equal(requireTestDatabaseUrl(safeEnvironment), testDatabaseUrl);
    assert.throws(
        () => requireTestDatabaseUrl({ ...safeEnvironment, INTEGRATION_TESTS_ENABLED: "false" }),
        /INTEGRATION_TESTS_ENABLED/,
    );
    assert.throws(
        () => requireTestDatabaseUrl({ ...safeEnvironment, NODE_ENV: "production" }),
        /cannot run when NODE_ENV=production/,
    );
    assert.throws(
        () => requireTestDatabaseUrl({ ...safeEnvironment, DATABASE_URL: testDatabaseUrl }),
        /must not match DATABASE_URL/,
    );
    assert.throws(
        () => requireTestDatabaseUrl({ ...safeEnvironment, TEST_DATABASE_ALLOWED_HOSTS: "other-db.test" }),
        /host is not approved/,
    );
    assert.throws(
        () => requireTestDatabaseUrl({ ...safeEnvironment, TEST_DATABASE_ALLOWED_HOSTS: "" }),
        /TEST_DATABASE_ALLOWED_HOSTS/,
    );
});

test("validates production configuration without including secret values in errors", () => {
    const safeProductionEnvironment = {
        NODE_ENV: "production",
        JWT_SECRET: "a".repeat(32),
        JWT_EXPIRES_IN: "15m",
        JWT_ISSUER: "test-real-estate-api",
        JWT_AUDIENCE: "test-real-estate-client",
        CORS_ORIGINS: "https://app.example.test",
        DATABASE_URL: "postgresql://user:database_password@db.example.test:5432/app?sslmode=verify-full",
        CLOUDINARY_CLOUD_NAME: "test-cloud",
        CLOUDINARY_API_KEY: "test-api-key",
        CLOUDINARY_API_SECRET: "test-api-secret",
    };

    assert.doesNotThrow(() => validateProductionConfiguration(safeProductionEnvironment));
    assert.throws(
        () => validateProductionConfiguration({ ...safeProductionEnvironment, CLOUDINARY_API_SECRET: "" }),
        (error) => {
            assert.match(error.message, /CLOUDINARY_API_SECRET/);
            assert.equal(error.message.includes("test-api-secret"), false);
            assert.equal(error.message.includes("database_password"), false);
            return true;
        },
    );
    assert.throws(
        () => validateProductionConfiguration({ ...safeProductionEnvironment, JWT_SECRET: "" }),
        (error) => {
            assert.match(error.message, /JWT_SECRET/);
            assert.equal(error.message.includes("test-api-secret"), false);
            return true;
        },
    );
});

test("returns lightweight liveness and generic readiness responses", async () => {
    const live = await fetch(`${healthyBaseUrl}/health/live`);
    const ready = await fetch(`${healthyBaseUrl}/health/ready`);
    const unavailable = await fetch(`${unhealthyBaseUrl}/health/ready`);

    assert.equal(live.status, 200);
    assert.deepEqual(await live.json(), { success: true, status: "live" });
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { success: true, status: "ready" });
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { success: false, status: "unavailable" });
});

test("gracefully closes once, disconnects Prisma, and unregisters signal handlers", async () => {
    let closeCalls = 0;
    let disconnectCalls = 0;
    const exitCodes = [];
    let timeoutDelay;
    let timeoutCleared = false;
    const originalInfo = console.info;
    console.info = () => {};

    try {
        const shutdown = createGracefulShutdown({
            server: { close(callback) { closeCalls += 1; callback(); } },
            prismaClient: { async $disconnect() { disconnectCalls += 1; } },
            timeoutMs: 123,
            exit: (code) => exitCodes.push(code),
            setTimeoutFn: (callback, delay) => {
                timeoutDelay = delay;
                return { unref() {} };
            },
            clearTimeoutFn: () => { timeoutCleared = true; },
        });

        await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);
        assert.equal(closeCalls, 1);
        assert.equal(disconnectCalls, 1);
        assert.deepEqual(exitCodes, [0]);
        assert.equal(timeoutDelay, 123);
        assert.equal(timeoutCleared, true);

        const processRef = new EventEmitter();
        const signals = [];
        const unregister = registerGracefulShutdown({ processRef, shutdown: (signal) => signals.push(signal) });
        processRef.emit("SIGTERM");
        processRef.emit("SIGINT");
        assert.deepEqual(signals, ["SIGTERM", "SIGINT"]);
        unregister();
        processRef.emit("SIGTERM");
        assert.deepEqual(signals, ["SIGTERM", "SIGINT"]);
    } finally {
        console.info = originalInfo;
    }
});
