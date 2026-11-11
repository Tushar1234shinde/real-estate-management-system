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
- `NODE_ENV` is not `production`
- `TEST_DATABASE_URL` uses PostgreSQL and a database name ending in `_integration_test`
- `TEST_DATABASE_URL` does not equal `DATABASE_URL`
- `TEST_DATABASE_ALLOWED_HOSTS` explicitly includes the test database host

Run `npm run test:integration` only against a disposable database. Real Cloudinary integration tests also require their existing explicit Cloudinary opt-in and isolated test credentials/folder.

## Reverse proxy and rate limiting

Configure Express `trust proxy` only after identifying the exact proxy hop count or trusted proxy CIDR ranges. Do not use a blanket `true` setting. For multiple API instances, replace the current in-memory login limiter with an atomic Redis-backed shared limiter before scaling horizontally.
