import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/** DATABASE_URL may be unset when only `prisma generate` runs (fresh install, CI typecheck). Migrations need it. */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://movo:movo@localhost:5433/movo',
  },
});
