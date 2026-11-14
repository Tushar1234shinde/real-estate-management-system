import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { getJwtConfig } from "../src/config/auth.js";
import { getCorsOptions } from "../src/config/cors.js";
import { authorizeRoles, createAuthenticate, ROLES } from "../src/middlewares/authMiddleware.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import { createLoginRateLimiter } from "../src/middlewares/loginRateLimitMiddleware.js";

const jwtConfig = {
    secret: crypto.randomBytes(32).toString("base64url"),
    expiresIn: "1h",
    issuer: "test-real-estate-api",
    audience: "test-real-estate-client",
};

const passwordHash = await bcrypt.hash("correct-password", 10);
const users = [
    { id: 1, fullName: "Admin User", email: "admin@example.com", passwordHash, isActive: true, role: { name: ROLES.ADMIN } },
    { id: 2, fullName: "Executive User", email: "executive@example.com", passwordHash, isActive: true, role: { name: ROLES.EXECUTIVE } },
    { id: 3, fullName: "Inside User", email: "inside@example.com", passwordHash, isActive: true, role: { name: ROLES.INSIDE_SALES } },
    { id: 4, fullName: "Outside User", email: "outside@example.com", passwordHash, isActive: true, role: { name: ROLES.OUTSIDE_SALES } },
    { id: 5, fullName: "Inactive User", email: "inactive@example.com", passwordHash, isActive: false, role: { name: ROLES.OUTSIDE_SALES } },
];

const prismaClient = {
    user: {
        async findUnique({ where }) {
            if (where.email) {
                return users.find((user) => user.email === where.email) ?? null;
            }

            return users.find((user) => user.id === where.id) ?? null;
        },
    },
};

const authenticate = createAuthenticate({
    prismaClient,
    jwtSecret: jwtConfig.secret,
    jwtIssuer: jwtConfig.issuer,
    jwtAudience: jwtConfig.audience,
});
const app = createApp({
    prismaClient,
    jwtConfig,
    loginRateLimiter: createLoginRateLimiter({ maxAttempts: 100 }),
});

let server;
let baseUrl;
let rateLimitServer;
let rateLimitBaseUrl;

before(async () => {
    server = await new Promise((resolve) => {
        const listeningServer = app.listen(0, () => resolve(listeningServer));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const rateLimitApp = createApp({
        prismaClient,
        jwtConfig,
        loginRateLimiter: createLoginRateLimiter({ maxAttempts: 2 }),
    });
    rateLimitServer = await new Promise((resolve) => {
        const listeningServer = rateLimitApp.listen(0, () => resolve(listeningServer));
    });
    rateLimitBaseUrl = `http://127.0.0.1:${rateLimitServer.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await new Promise((resolve, reject) => rateLimitServer.close((error) => (error ? reject(error) : resolve())));
});

function tokenFor(user) {
    return jwt.sign({ sub: String(user.id) }, jwtConfig.secret, {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
    });
}

test("logs in with valid credentials without exposing passwordHash", async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@example.com", password: "correct-password" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(typeof body.data.token, "string");
    const payload = jwt.verify(body.data.token, jwtConfig.secret, {
        algorithms: ["HS256"],
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
    });
    assert.equal(payload.sub, "1");
    assert.deepEqual(body.data.user, { id: 1, name: "Admin User", email: "admin@example.com", role: ROLES.ADMIN });
    assert.equal(JSON.stringify(body).includes("passwordHash"), false);
});

test("normalizes email casing before authenticating", async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ADMIN@EXAMPLE.COM", password: "correct-password" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.user.email, "admin@example.com");
});

test("returns the same generic failure for unknown, incorrect-password, and inactive accounts", async () => {
    const wrongPassword = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@example.com", password: "wrong-password" }),
    });
    const inactiveUser = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "inactive@example.com", password: "correct-password" }),
    });
    const unknownUser = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "unknown@example.com", password: "wrong-password" }),
    });

    assert.equal(wrongPassword.status, 401);
    assert.equal((await wrongPassword.json()).message, "Invalid email or password.");
    assert.equal(inactiveUser.status, 401);
    assert.equal((await inactiveUser.json()).message, "Invalid email or password.");
    assert.equal(unknownUser.status, 401);
    assert.equal((await unknownUser.json()).message, "Invalid email or password.");
});

test("rejects malformed, oversized JSON request bodies with consistent client errors", async () => {
    const invalidEmail = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email", password: "correct-password" }),
    });
    const oversizedPassword = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@example.com", password: "a".repeat(1025) }),
    });
    const malformedJson = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
    });
    const oversizedJson = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@example.com", password: "a".repeat(101 * 1024) }),
    });

    assert.equal(invalidEmail.status, 400);
    assert.equal(oversizedPassword.status, 400);
    assert.equal(malformedJson.status, 400);
    assert.equal((await malformedJson.json()).message, "Invalid JSON request body.");
    assert.equal(oversizedJson.status, 413);
    assert.equal((await oversizedJson.json()).message, "Request body is too large.");
});

test("protects /api/auth/me from missing, invalid, and expired tokens", async () => {
    const missing = await fetch(`${baseUrl}/api/auth/me`);
    const invalid = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: "Bearer invalid" } });
    const expiredToken = jwt.sign({ sub: "1" }, jwtConfig.secret, {
        algorithm: "HS256",
        expiresIn: "-1s",
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
    });
    const expired = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${expiredToken}` } });

    assert.equal(missing.status, 401);
    assert.equal(invalid.status, 401);
    assert.equal(expired.status, 401);
});

test("rejects JWTs signed with an algorithm other than HS256", async () => {
    const hs384Token = jwt.sign({ sub: "1" }, jwtConfig.secret, {
        algorithm: "HS384",
        expiresIn: "1h",
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
    });
    const response = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${hs384Token}` },
    });

    assert.equal(response.status, 401);
});

test("rejects tokens with missing or incorrect issuer and audience", async () => {
    const tokenWithWrongIssuer = jwt.sign({ sub: "1" }, jwtConfig.secret, {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: "other-issuer",
        audience: jwtConfig.audience,
    });
    const tokenWithWrongAudience = jwt.sign({ sub: "1" }, jwtConfig.secret, {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: jwtConfig.issuer,
        audience: "other-audience",
    });
    const tokenWithoutClaims = jwt.sign({ sub: "1" }, jwtConfig.secret, { algorithm: "HS256", expiresIn: "1h" });

    for (const token of [tokenWithWrongIssuer, tokenWithWrongAudience, tokenWithoutClaims]) {
        const response = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(response.status, 401);
        assert.equal((await response.json()).message, "Authentication token is invalid.");
    }
});

test("returns the database-backed authenticated profile from /api/auth/me", async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tokenFor(users[1])}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.user, { id: 2, name: "Executive User", email: "executive@example.com", role: ROLES.EXECUTIVE });
});

test("authorizes each supported database role and rejects an unauthorized role", async () => {
    for (const user of users.slice(0, 4)) {
        const error = await new Promise((resolve) => {
            authorizeRoles(user.role.name)(
                { user: { role: user.role.name } },
                {},
                resolve,
            );
        });
        assert.equal(error, undefined, `${user.role.name} should be authorized`);
    }

    const forbidden = await new Promise((resolve) => {
        authorizeRoles(ROLES.ADMIN)(
            { user: { role: ROLES.EXECUTIVE } },
            {},
            resolve,
        );
    });
    assert.equal(forbidden.statusCode, 403);
});

test("applies login rate limiting by IP and email", async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(`${rateLimitBaseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "rate-limit@example.com", password: "wrong-password" }),
        });
        assert.equal(response.status, 401);
    }

    const blocked = await fetch(`${rateLimitBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "rate-limit@example.com", password: "wrong-password" }),
    });

    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("retry-after") !== null, true);
});

test("validates JWT configuration and restricts CORS origins", () => {
    const validSecret = crypto.randomBytes(32).toString("base64url");

    assert.throws(
        () => getJwtConfig({
            JWT_SECRET: "replace-with-a-long-random-secret",
            JWT_EXPIRES_IN: "1h",
            JWT_ISSUER: "test-issuer",
            JWT_AUDIENCE: "test-audience",
        }),
        /placeholder or default/,
    );
    assert.throws(
        () => getJwtConfig({ JWT_SECRET: "too-short", JWT_EXPIRES_IN: "1h", JWT_ISSUER: "test-issuer", JWT_AUDIENCE: "test-audience" }),
        /at least 32 bytes/,
    );
    assert.throws(
        () => getJwtConfig({ JWT_SECRET: validSecret, JWT_EXPIRES_IN: "not-a-duration", JWT_ISSUER: "test-issuer", JWT_AUDIENCE: "test-audience" }),
        /valid positive duration/,
    );
    assert.throws(() => getJwtConfig({ JWT_SECRET: validSecret, JWT_EXPIRES_IN: "1h" }), /JWT_ISSUER/);
    assert.throws(() => getJwtConfig({ JWT_SECRET: validSecret, JWT_EXPIRES_IN: "1h", JWT_ISSUER: "test-issuer" }), /JWT_AUDIENCE/);
    assert.deepEqual(
        getCorsOptions({ NODE_ENV: "production", CORS_ORIGINS: "https://app.example.com, https://admin.example.com" }),
        { origin: ["https://app.example.com", "https://admin.example.com"] },
    );
    assert.throws(() => getCorsOptions({ NODE_ENV: "production" }), /CORS_ORIGINS/);
    assert.throws(() => getCorsOptions({ NODE_ENV: "production", CORS_ORIGINS: "*" }), /cannot include/);
    assert.deepEqual(getCorsOptions({ NODE_ENV: "development" }).origin.includes("http://localhost:5173"), true);
    assert.deepEqual(getCorsOptions({ NODE_ENV: "development" }).origin.includes("http://localhost:8443"), true);
});

test("allows configured local CORS origins and omits CORS headers for other origins", async () => {
    const allowed = await fetch(`${baseUrl}/`, {
        headers: { Origin: "http://localhost:5173" },
    });
    const viteOrigin = await fetch(`${baseUrl}/`, {
        headers: { Origin: "http://localhost:8443" },
    });
    const disallowed = await fetch(`${baseUrl}/`, {
        headers: { Origin: "https://untrusted.example" },
    });

    assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.equal(viteOrigin.headers.get("access-control-allow-origin"), "http://localhost:8443");
    assert.equal(disallowed.headers.get("access-control-allow-origin"), null);
});

test("applies API security headers without exposing Express", async () => {
    const response = await fetch(`${baseUrl}/`);

    assert.equal(response.headers.get("x-powered-by"), null);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("content-security-policy"), null);
});

test("logs server errors with safe structured metadata only", () => {
    const entries = [];
    const originalConsoleError = console.error;
    console.error = (entry) => entries.push(entry);

    try {
        const response = {
            headersSent: false,
            statusCode: null,
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; return this; },
        };
        const secretText = "Bearer sensitive-token postgresql://secret cloudinary signed-url password";
        errorHandler(new Error(secretText), { method: "POST", path: "/api/test" }, response, assert.fail);

        assert.equal(response.statusCode, 500);
        assert.equal(response.body.message, "An unexpected error occurred.");
        assert.equal(entries.length, 1);
        assert.equal(entries[0].includes(secretText), false);
        assert.deepEqual(JSON.parse(entries[0]), {
            level: "error",
            event: "request_failed",
            statusCode: 500,
            method: "POST",
        });
    } finally {
        console.error = originalConsoleError;
    }
});
