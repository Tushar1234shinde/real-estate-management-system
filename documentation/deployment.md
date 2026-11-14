# Backend deployment checklist

## Startup contract

Run the API with `npm start`, which executes `node src/server.js`. The process exposes:

- `GET /health/live` for process liveness.
- `GET /health/ready` for database readiness. It returns only `ready` or `unavailable` and never exposes database details.

The process handles `SIGTERM` and `SIGINT`: it stops accepting new connections, gives active requests up to 10 seconds to finish, then disconnects Prisma.

## Required production configuration

Set these values through the deployment platform's secret/configuration manager, never source control:

- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL` using a PostgreSQL URL with `sslmode=verify-full`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `CORS_ORIGINS` as a comma-separated explicit allowlist
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Production startup fails closed if JWT, CORS, database transport, or Cloudinary configuration is missing or invalid. The application does not print configuration values in validation errors.

## Safe deployment procedure

1. Provision a least-privilege production database user and configure verified TLS transport.
2. Configure all required production variables in the platform secret manager.
3. In the build/validation job, install dependencies using the lockfile with `npm ci` and run `npx prisma validate`. Production runtime images may then omit development dependencies.
4. Run `npx prisma migrate deploy` exactly once in a controlled deployment job after backup and migration review. Do not use `prisma migrate dev` in production.
5. Start `npm start` and wait for `/health/ready` before routing traffic.
6. Configure the load balancer to send `SIGTERM` and allow at least 10 seconds of drain time during replacement.

## Integration-test safety

Integration migrations and tests are blocked unless all of these checks pass:

- `INTEGRATION_TESTS_ENABLED=true`
- `DATABASE_URL` is configured and identifies a different database location
- `NODE_ENV` is not `production`
- `TEST_DATABASE_URL` uses PostgreSQL, targets exactly
  `real_estate_integration_v2_integration_test`, and uses the dedicated
  `real_estate_test_user` login with `sslmode=verify-full`
- `TEST_DATABASE_ALLOWED_HOSTS` explicitly includes the test database host
- A read-only preflight confirms the connected database name, login, and actual
  PostgreSQL database owner before inspecting the migration ledger
- The migration ledger is present and complete, and the only pending migrations
  are either the four approved WhatsApp migrations or the single approved
  `20261112180000_add_property_document_cloudinary_metadata` migration
- `INTEGRATION_MIGRATIONS_CONFIRMED=true` is set only when the exact four
  approved WhatsApp migrations are pending; this flag cannot bypass identity or
  ledger checks
- `PROPERTY_DOCUMENTS_MIGRATION_CONFIRMED=true` is required specifically for
  the Property Documents metadata migration and does not authorize other pending
  migrations

Preflight connects only through `TEST_DATABASE_URL`; it does not change the
parent `DATABASE_URL`. The runner holds a PostgreSQL advisory lock while it
checks the ledger and deploys migrations, preventing concurrent guarded
integration migration runners. A missing or incomplete ledger is an error; the
runner never initializes a fresh database automatically. Run
`npm run test:integration` only against this dedicated disposable database.
Real Cloudinary integration tests also require their existing explicit
Cloudinary opt-in and isolated test credentials/folder.

## Manual unmatched WhatsApp status reconciliation

The application normally reconciles early delivery statuses when the provider
message ID is persisted. If finalization repeatedly fails, unmatched rows stay
in `whatsapp_pending_status_events`; they are not discarded or used to resend a
message.

1. Use a read-only query on the explicitly approved operational database to
   inventory pending events:

   ```sql
   SELECT "providerMessageId", status, "providerTimestamp", "receivedAt"
   FROM public.whatsapp_pending_status_events
   ORDER BY "receivedAt", "providerMessageId", "providerTimestamp", id;
   ```

2. Obtain an authoritative mapping from that exact provider message ID to one
   outbound `whatsapp_message_logs.id`, using the provider response/audit record
   for the send attempt. Do not infer the mapping from phone number, message
   text, or approximate timestamps. If no authoritative mapping exists, leave
   the events pending and escalate for provider-side investigation.

3. Configure `WHATSAPP_RECONCILIATION_DATABASE_URL` and
   `WHATSAPP_RECONCILIATION_ALLOWED_HOSTS` only in the operator's secure
   environment. The URL must use `sslmode=verify-full` and a trusted
   `sslrootcert`; the procedure never falls back to `DATABASE_URL` and rejects
   `real_estate_db` and `_integration_test` databases.

4. Run the guarded operation with the exact database name, message-log ID, and
   provider message ID from the authoritative mapping:

   ```text
   node scripts/reconcile-whatsapp-pending-status.js --confirm-database=<database-name> --message-log-id=<message-log-id> --provider-message-id=<provider-message-id> --confirm-provider-match
   ```

   The operation takes the same provider-ID advisory lock as webhook handling
   and send finalization. In one transaction it rejects an already-assigned
   provider ID, ineligible message/outbox states, or a missing unmatched event;
   links the ID; resolves an `UNKNOWN` or `SUBMITTING` outbox to `SENT`; and
   applies the pending statuses in provider-timestamp order using the normal
   deduplication and monotonic status-transition rules. A repeated run is a
   no-op after successful reconciliation. It never calls Meta or resends a
   message; `FAILED` and `CANCELLED` outbox records are not eligible.

5. Verify the provider ID is unique on the message log, the expected status
   events were linked, and no pending rows remain for that provider ID. Never
   move `UNKNOWN` or stale `SUBMITTING` work back to `PENDING`.

## Reverse proxy and rate limiting

Configure Express `trust proxy` only after identifying the exact proxy hop count or trusted proxy CIDR ranges. Do not use a blanket `true` setting. For multiple API instances, replace the current in-memory login limiter with an atomic Redis-backed shared limiter before scaling horizontally.
