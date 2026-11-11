
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import prisma from "./config/prisma.js";
import { createGracefulShutdown, registerGracefulShutdown } from "./shutdown.js";

export function startServer({
    app = createApp(),
    prismaClient = prisma,
    port = process.env.PORT || 5000,
    shutdownTimeoutMs = 10_000,
} = {}) {
    const server = app.listen(port, () => {
        console.info(JSON.stringify({ level: "info", event: "server_started", port: String(port) }));
    });
    const shutdown = createGracefulShutdown({ server, prismaClient, timeoutMs: shutdownTimeoutMs });
    const unregisterShutdown = registerGracefulShutdown({ shutdown });

    return { server, shutdown, unregisterShutdown };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    startServer();
}
