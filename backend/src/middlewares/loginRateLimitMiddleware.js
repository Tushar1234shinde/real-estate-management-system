const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

function requestEmail(req) {
    return typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "unknown";
}

function incrementAttempt(store, key, now, windowMs) {
    const current = store.get(key);

    if (!current || now >= current.resetAt) {
        const next = { attempts: 1, resetAt: now + windowMs };
        store.set(key, next);
        return next;
    }

    current.attempts += 1;
    return current;
}

export function createLoginRateLimiter({
    windowMs = DEFAULT_WINDOW_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    now = () => Date.now(),
} = {}) {
    if (!Number.isInteger(windowMs) || windowMs <= 0 || !Number.isInteger(maxAttempts) || maxAttempts <= 0) {
        throw new Error("Login rate-limit configuration must use positive integers.");
    }

    const attemptsByIp = new Map();
    const attemptsByEmail = new Map();

    return (req, res, next) => {
        const timestamp = now();
        const ipAttempt = incrementAttempt(attemptsByIp, req.ip, timestamp, windowMs);
        const emailAttempt = incrementAttempt(attemptsByEmail, requestEmail(req), timestamp, windowMs);
        const attempt = ipAttempt.attempts >= emailAttempt.attempts ? ipAttempt : emailAttempt;

        if (attempt.attempts > maxAttempts) {
            const retryAfterSeconds = Math.max(1, Math.ceil((attempt.resetAt - timestamp) / 1000));
            res.set("Retry-After", String(retryAfterSeconds));
            return res.status(429).json({
                success: false,
                message: "Too many login attempts. Please try again later.",
            });
        }

        return next();
    };
}
