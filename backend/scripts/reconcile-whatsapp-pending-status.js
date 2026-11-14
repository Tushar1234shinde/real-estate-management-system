import process from "node:process";

function optionValue(name, args) {
    const matches = args.filter((argument) => argument.startsWith(`${name}=`));
    if (matches.length !== 1 || !matches[0].slice(name.length + 1)) {
        throw new Error(`Exactly one ${name}=... argument is required.`);
    }
    return matches[0].slice(name.length + 1);
}

function validatedConnection(environment) {
    const connectionString = environment.WHATSAPP_RECONCILIATION_DATABASE_URL;
    if (typeof connectionString !== "string" || !connectionString || connectionString.trim() !== connectionString) {
        throw new Error("WHATSAPP_RECONCILIATION_DATABASE_URL is required; DATABASE_URL is never used as a fallback.");
    }

    let url;
    let databaseName;
    try {
        url = new URL(connectionString);
        databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
    } catch {
        throw new Error("The reconciliation database URL is invalid.");
    }
    const identityParameters = new Set(["database", "dbname", "host", "hostaddr", "port", "service", "servicefile", "user", "username"]);
    const parameterNames = [...url.searchParams.keys()].map((name) => name.toLowerCase());
    if (!["postgres:", "postgresql:"].includes(url.protocol)
        || !url.hostname
        || !url.username
        || !databaseName
        || databaseName.includes("/")
        || databaseName === "."
        || databaseName === ".."
        || url.hash
        || new Set(parameterNames).size !== parameterNames.length
        || parameterNames.some((name) => identityParameters.has(name))
        || databaseName === "real_estate_db"
        || databaseName.endsWith("_integration_test")
        || url.searchParams.get("sslmode") !== "verify-full"
        || !url.searchParams.get("sslrootcert")
        || url.searchParams.has("options")
        || url.searchParams.has("search_path")
        || (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public")) {
        throw new Error("The reconciliation URL must target an explicit operational database and require verified TLS.");
    }
    const hostList = environment.WHATSAPP_RECONCILIATION_ALLOWED_HOSTS;
    if (typeof hostList !== "string" || !hostList.trim()) {
        throw new Error("WHATSAPP_RECONCILIATION_ALLOWED_HOSTS must explicitly allow the database host.");
    }
    const allowedHosts = hostList.split(",").map((host) => host.trim().toLowerCase());
    if (allowedHosts.some((host) => !host || host.includes("*") || host.includes("?"))
        || new Set(allowedHosts).size !== allowedHosts.length
        || !allowedHosts.includes(url.hostname.toLowerCase())) {
        throw new Error("The reconciliation database host is not explicitly allowlisted.");
    }
    return { connectionString, databaseName };
}

function parseArguments(args) {
    const confirmProviderMatch = args.filter((argument) => argument === "--confirm-provider-match");
    const allowedOptions = new Set([
        "--confirm-provider-match",
        "--confirm-database",
        "--message-log-id",
        "--provider-message-id",
    ]);
    if (confirmProviderMatch.length !== 1
        || args.some((argument) => ![...allowedOptions].some((option) => argument === option || argument.startsWith(`${option}=`)))) {
        throw new Error("Explicit provider-match confirmation and supported reconciliation arguments are required.");
    }

    const messageLogIdText = optionValue("--message-log-id", args);
    if (!/^\d+$/.test(messageLogIdText)) throw new Error("The message log ID is invalid.");
    const messageLogId = Number(messageLogIdText);
    const providerMessageId = optionValue("--provider-message-id", args);
    const confirmedDatabase = optionValue("--confirm-database", args);
    if (!Number.isSafeInteger(messageLogId) || messageLogId < 1
        || providerMessageId.length > 255) {
        throw new Error("The message log ID or provider message ID is invalid.");
    }
    return { messageLogId, providerMessageId, confirmedDatabase };
}

async function main() {
    try {
        const { connectionString, databaseName } = validatedConnection(process.env);
        const { messageLogId, providerMessageId, confirmedDatabase } = parseArguments(process.argv.slice(2));
        if (confirmedDatabase !== databaseName) {
            throw new Error("The confirmed database name does not match the configured reconciliation URL.");
        }

        process.env.DATABASE_URL = connectionString;
        const [{ default: prisma }, { reconcileUnmatchedWhatsAppStatusEvents }] = await Promise.all([
            import("../src/config/prisma.js"),
            import("../src/controllers/whatsAppController.js"),
        ]);
        try {
            const identity = await prisma.$queryRaw`SELECT current_database() AS database_name`;
            if (identity[0]?.database_name !== confirmedDatabase) {
                throw new Error("The connected database name does not match the explicit confirmation.");
            }
            const result = await reconcileUnmatchedWhatsAppStatusEvents(prisma, {
                messageLogId,
                providerMessageId,
            });
            console.info(JSON.stringify({
                event: "whatsapp_status_reconciliation_completed",
                database: confirmedDatabase,
                messageLogId,
                reconciledEvents: result.reconciledCount,
                alreadyReconciled: result.alreadyReconciled,
            }));
        } finally {
            await prisma.$disconnect();
        }
    } catch {
        console.error(JSON.stringify({
            event: "whatsapp_status_reconciliation_stopped",
            error: "Reconciliation was not completed; diagnostic details and connection data were suppressed.",
        }));
        process.exitCode = 1;
    }
}

await main();
