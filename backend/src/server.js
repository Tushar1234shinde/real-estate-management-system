
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createLoginRateLimiterFromEnv } from "./middlewares/loginRateLimitMiddleware.js";
import prisma from "./config/prisma.js";
import { createWhatsAppOutboxDispatcher } from "./dispatchers/whatsAppOutboxDispatcher.js";
import { createGracefulShutdown, registerGracefulShutdown } from "./shutdown.js";

export function startServer({
    app = createApp({
        loginRateLimiter: createLoginRateLimiterFromEnv(),
    }),
    prismaClient = prisma,
    port = process.env.PORT || 5000,
    shutdownTimeoutMs = 30_000,
    whatsAppDispatcher = createWhatsAppOutboxDispatcher({ prismaClient }),
} = {}) {
    whatsAppDispatcher.start();
    const server = app.listen(port, () => {
        console.info(JSON.stringify({ level: "info", event: "server_started", port: String(port) }));
    });
    const shutdown = createGracefulShutdown({
        server,
        prismaClient,
        timeoutMs: shutdownTimeoutMs,
        beforeDisconnect: () => whatsAppDispatcher.stop(),
    });
    const unregisterShutdown = registerGracefulShutdown({ shutdown });

    return { server, shutdown, unregisterShutdown, whatsAppDispatcher };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    startServer();
}
