
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { validateDatabaseTransport } from "./src/config/databaseSecurity.js";

validateDatabaseTransport(process.env);

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
        seed: "node prisma/seed.js",
    },
    datasource: {
        url: process.env.DATABASE_URL,
    },
});
