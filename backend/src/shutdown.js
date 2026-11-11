function closeServer(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

export function createGracefulShutdown({
    server,
    prismaClient,
    timeoutMs = 10_000,
    exit = (code) => process.exit(code),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
} = {}) {
    if (!server || !prismaClient || !Number.isInteger(timeoutMs) || timeoutMs < 1) {
        throw new Error("Graceful shutdown requires a server, Prisma client, and positive timeout.");
    }

    let shuttingDown = false;

    return async (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.info(JSON.stringify({ level: "info", event: "shutdown_started", signal }));

        let timedOut = false;
        const timeout = setTimeoutFn(() => {
            timedOut = true;
            console.error(JSON.stringify({ level: "error", event: "shutdown_timeout" }));
            exit(1);
        }, timeoutMs);
        timeout.unref?.();

        let exitCode = 0;
        try {
            await closeServer(server);
        } catch {
            exitCode = 1;
        }

        try {
            await prismaClient.$disconnect();
        } catch {
            exitCode = 1;
        }

        clearTimeoutFn(timeout);
        if (!timedOut) exit(exitCode);
    };
}

export function registerGracefulShutdown({ processRef = process, shutdown } = {}) {
    if (!shutdown) throw new Error("A shutdown handler is required.");

    const onSigterm = () => shutdown("SIGTERM");
    const onSigint = () => shutdown("SIGINT");
    processRef.once("SIGTERM", onSigterm);
    processRef.once("SIGINT", onSigint);

    return () => {
        processRef.removeListener("SIGTERM", onSigterm);
        processRef.removeListener("SIGINT", onSigint);
    };
}
