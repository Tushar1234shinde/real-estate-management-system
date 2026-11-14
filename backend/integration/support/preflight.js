import { readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import pg from "pg";
import {
    requireTestDatabaseUrl,
    TEST_DATABASE_NAME,
    TEST_DATABASE_USER,
} from "./testDatabase.js";

export const APPROVED_WHATSAPP_MIGRATIONS = Object.freeze([
    "20261112140000_add_whatsapp_consent_and_webhook_events",
    "20261112143000_add_whatsapp_inbound_dedup_and_reconsent",
    "20261112150000_add_whatsapp_message_outbox",
    "20261112160000_add_whatsapp_reliability_controls",
]);
export const APPROVED_PROPERTY_DOCUMENTS_MIGRATION =
    "20261112180000_add_property_document_cloudinary_metadata";
export const APPROVED_ANNOUNCEMENTS_MIGRATION =
    "20261112190000_add_announcements";

const MIGRATIONS_DIRECTORY = fileURLToPath(new URL("../../prisma/migrations/", import.meta.url));
const MIGRATION_LOCK_CLASS_ID = 1_475_320_001;
const MIGRATION_LOCK_OBJECT_ID = 1;
const MIGRATION_LOCK_SQL = "SELECT pg_advisory_lock($1, $2)";
const MIGRATION_UNLOCK_SQL = "SELECT pg_advisory_unlock($1, $2) AS unlocked";
const DATABASE_IDENTITY_SQL = `
    SELECT current_database() AS database_name,
           session_user AS login_role,
           owner_role.rolname AS database_owner
    FROM pg_database AS database_info
    JOIN pg_roles AS owner_role ON owner_role.oid = database_info.datdba
    WHERE database_info.datname = current_database()
`;
const MIGRATION_LEDGER_EXISTS_SQL = "SELECT to_regclass('public._prisma_migrations') AS ledger";
const MIGRATION_LEDGER_SQL = `
    SELECT migration_name, started_at, finished_at, rolled_back_at
    FROM public."_prisma_migrations"
    ORDER BY migration_name
`;

export class IntegrationPreflightError extends Error {
    constructor(message) {
        super(message);
        this.name = "IntegrationPreflightError";
    }
}

export function integrationPreflightReport(preflight) {
    return {
        event: "integration_database_preflight_passed",
        database: {
            name: preflight.database.name,
            owner: preflight.database.owner,
            loginRole: preflight.database.loginRole,
            host: preflight.database.host,
            port: preflight.database.port,
        },
        appliedMigrations: [...preflight.appliedMigrations],
        pendingMigrations: [...preflight.pendingMigrations],
    };
}

function assertActualDatabaseIdentity(row, url) {
    if (!row
        || row.database_name !== TEST_DATABASE_NAME
        || row.login_role !== TEST_DATABASE_USER
        || row.database_owner !== TEST_DATABASE_USER) {
        throw new IntegrationPreflightError(
            "Connected database name, login role, or owner does not match the dedicated integration identity.",
        );
    }

    return {
        name: row.database_name,
        owner: row.database_owner,
        loginRole: row.login_role,
        host: url.hostname.toLowerCase().replace(/\.+$/, ""),
        port: url.port ? Number(url.port) : 5432,
    };
}

async function listRepositoryMigrations(migrationsDirectory) {
    let entries;
    try {
        entries = await readdir(migrationsDirectory, { withFileTypes: true });
    } catch {
        throw new IntegrationPreflightError("Repository migration folders could not be inspected.");
    }

    const migrations = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
            if ((await stat(join(migrationsDirectory, entry.name, "migration.sql"))).isFile()) {
                migrations.push(entry.name);
            }
        } catch (error) {
            if (error?.code !== "ENOENT") {
                throw new IntegrationPreflightError("Repository migration folders could not be inspected.");
            }
        }
    }
    return migrations.sort();
}

export function compareMigrationLedger(repositoryMigrations, ledgerRows) {
    if (!Array.isArray(repositoryMigrations) || !Array.isArray(ledgerRows)) {
        throw new IntegrationPreflightError("The migration ledger or repository migration inventory is unavailable.");
    }

    const repositorySet = new Set(repositoryMigrations);
    if (repositorySet.size !== repositoryMigrations.length) {
        throw new IntegrationPreflightError("Repository migration folder names are ambiguous.");
    }
    if (!APPROVED_WHATSAPP_MIGRATIONS.every((name) => repositorySet.has(name))
        || !repositorySet.has(APPROVED_PROPERTY_DOCUMENTS_MIGRATION)
        || !repositorySet.has(APPROVED_ANNOUNCEMENTS_MIGRATION)) {
        throw new IntegrationPreflightError("An approved migration is missing from repository folders.");
    }

    const applied = new Set();
    for (const row of ledgerRows) {
        if (!row || typeof row.migration_name !== "string" || !repositorySet.has(row.migration_name)) {
            throw new IntegrationPreflightError("The migration ledger contains an unknown migration.");
        }
        if (row.rolled_back_at !== null && row.rolled_back_at !== undefined) {
            throw new IntegrationPreflightError("The migration ledger contains a rolled-back migration requiring review.");
        }
        if (row.started_at === null || row.started_at === undefined
            || row.finished_at === null || row.finished_at === undefined) {
            throw new IntegrationPreflightError("The migration ledger contains an incomplete migration.");
        }
        if (applied.has(row.migration_name)) {
            throw new IntegrationPreflightError("The migration ledger contains duplicate completed migrations.");
        }
        applied.add(row.migration_name);
    }

    const pending = repositoryMigrations.filter((name) => !applied.has(name)).sort();
    const approvedPending = [...APPROVED_WHATSAPP_MIGRATIONS].sort();
    const approvedPropertyDocumentsPending = [APPROVED_PROPERTY_DOCUMENTS_MIGRATION];
    const approvedAnnouncementsPending = [APPROVED_ANNOUNCEMENTS_MIGRATION];
    if (pending.length > 0
        && !(
            (pending.length === approvedPending.length
                && pending.every((name, index) => name === approvedPending[index]))
            || (pending.length === approvedPropertyDocumentsPending.length
                && pending.every((name, index) => name === approvedPropertyDocumentsPending[index]))
            || (pending.length === approvedAnnouncementsPending.length
                && pending.every((name, index) => name === approvedAnnouncementsPending[index]))
        )) {
        throw new IntegrationPreflightError(
            `Unexpected pending migrations: ${pending.join(", ")}.`,
        );
    }

    return {
        appliedMigrations: [...applied].sort(),
        pendingMigrations: pending,
    };
}

async function closeClient(client, connected, locked) {
    let failed = false;
    if (connected && locked) {
        try {
            const result = await client.query(MIGRATION_UNLOCK_SQL, [
                MIGRATION_LOCK_CLASS_ID,
                MIGRATION_LOCK_OBJECT_ID,
            ]);
            if (result.rows?.[0]?.unlocked !== true) failed = true;
        } catch {
            failed = true;
        }
    }
    if (connected) {
        try {
            await client.end();
        } catch {
            failed = true;
        }
    }
    return !failed;
}

export async function runIntegrationPreflight({
    environment = process.env,
    migrationsDirectory = MIGRATIONS_DIRECTORY,
    repositoryMigrations: suppliedRepositoryMigrations,
    clientFactory = (connectionString) => new pg.Client({ connectionString }),
} = {}) {
    let connectionString;
    try {
        connectionString = requireTestDatabaseUrl(environment);
    } catch (error) {
        throw new IntegrationPreflightError(error.message);
    }
    const parsedUrl = new URL(connectionString);
    let client;
    try {
        client = clientFactory(connectionString);
    } catch {
        throw new IntegrationPreflightError(
            "Integration database preflight could not create a database client.",
        );
    }
    let connected = false;
    let locked = false;
    let released = false;

    const release = async () => {
        if (released) return;
        released = true;
        if (!await closeClient(client, connected, locked)) {
            throw new IntegrationPreflightError("The integration migration lock could not be released cleanly.");
        }
    };

    try {
        await client.connect();
        connected = true;
        await client.query(MIGRATION_LOCK_SQL, [
            MIGRATION_LOCK_CLASS_ID,
            MIGRATION_LOCK_OBJECT_ID,
        ]);
        locked = true;

        const identityResult = await client.query(DATABASE_IDENTITY_SQL);
        const database = assertActualDatabaseIdentity(identityResult.rows?.[0], parsedUrl);

        const ledgerExists = await client.query(MIGRATION_LEDGER_EXISTS_SQL);
        if (ledgerExists.rows?.[0]?.ledger == null) {
            throw new IntegrationPreflightError(
                "The migration ledger is missing; automatic fresh-database initialization is disabled.",
            );
        }

        const repositoryMigrations = suppliedRepositoryMigrations
            ?? await listRepositoryMigrations(migrationsDirectory);
        const ledgerResult = await client.query(MIGRATION_LEDGER_SQL);
        const { appliedMigrations, pendingMigrations } = compareMigrationLedger(
            repositoryMigrations,
            ledgerResult.rows,
        );

        if (pendingMigrations.length > 0
            && pendingMigrations.some((name) => APPROVED_WHATSAPP_MIGRATIONS.includes(name))
            && environment.INTEGRATION_MIGRATIONS_CONFIRMED !== "true") {
                throw new IntegrationPreflightError(
                    `INTEGRATION_MIGRATIONS_CONFIRMED=true is required for: ${pendingMigrations.join(", ")}.`,
                );
        }
        if (pendingMigrations.includes(APPROVED_PROPERTY_DOCUMENTS_MIGRATION)
            && environment.PROPERTY_DOCUMENTS_MIGRATION_CONFIRMED !== "true") {
            throw new IntegrationPreflightError(
                `PROPERTY_DOCUMENTS_MIGRATION_CONFIRMED=true is required for: ${pendingMigrations.join(", ")}.`,
            );
        }
        if (pendingMigrations.includes(APPROVED_ANNOUNCEMENTS_MIGRATION)
            && environment.ANNOUNCEMENTS_MIGRATION_CONFIRMED !== "true") {
            throw new IntegrationPreflightError(
                `ANNOUNCEMENTS_MIGRATION_CONFIRMED=true is required for: ${pendingMigrations.join(", ")}.`,
            );
        }

        return {
            database,
            appliedMigrations,
            pendingMigrations,
            release,
        };
    } catch (error) {
        await closeClient(client, connected, locked);
        if (error instanceof IntegrationPreflightError) throw error;
        throw new IntegrationPreflightError(
            "Integration database preflight failed; no migration subprocess was started.",
        );
    }
}
