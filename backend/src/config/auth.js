import "dotenv/config";
import jwt from "jsonwebtoken";

const MINIMUM_JWT_SECRET_BYTES = 32;
const INSECURE_JWT_SECRETS = new Set([
    "replace-with-a-long-random-secret",
    "replace-with-a-cryptographically-random-32-byte-secret",
    "changeme",
    "change-me",
    "secret",
    "your-secret-key",
]);

export function getJwtConfig(environment = process.env) {
    const secret = environment.JWT_SECRET?.trim();
    const expiresIn = environment.JWT_EXPIRES_IN?.trim();

    if (!secret) {
        throw new Error("JWT_SECRET must be configured.");
    }

    if (!expiresIn) {
        throw new Error("JWT_EXPIRES_IN must be configured.");
    }

    if (INSECURE_JWT_SECRETS.has(secret.toLowerCase())) {
        throw new Error("JWT_SECRET must not use a known placeholder or default value.");
    }

    if (Buffer.byteLength(secret, "utf8") < MINIMUM_JWT_SECRET_BYTES) {
        throw new Error(`JWT_SECRET must be at least ${MINIMUM_JWT_SECRET_BYTES} bytes.`);
    }

    try {
        const validationToken = jwt.sign({ sub: "0" }, secret, {
            algorithm: "HS256",
            expiresIn,
        });
        const payload = jwt.decode(validationToken);

        if (!payload?.iat || !payload.exp || payload.exp <= payload.iat) {
            throw new Error("JWT_EXPIRES_IN must be a positive duration.");
        }
    } catch (error) {
        if (error.message === "JWT_EXPIRES_IN must be a positive duration.") {
            throw error;
        }

        throw new Error("JWT_EXPIRES_IN must be a valid positive duration.");
    }

    return { secret, expiresIn };
}
