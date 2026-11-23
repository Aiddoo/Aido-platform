import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

import { assertDatabaseUrlIsSafe } from '../../apps/api/scripts/guard-database-url.mjs';

const apiDirectory = resolve(import.meta.dirname, '../../apps/api');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}
const jobDatabaseUrl = process.env.PGBOSS_DATABASE_URL ?? databaseUrl;
assertDatabaseUrlIsSafe(databaseUrl);
assertDatabaseUrlIsSafe(jobDatabaseUrl);

const lockTimeout = '-c lock_timeout=5000';
const pgOptions = process.env.PGOPTIONS ? `${process.env.PGOPTIONS} ${lockTimeout}` : lockTimeout;

execFileSync('pnpm', ['exec', 'pg-boss', 'migrate'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PGOPTIONS: pgOptions,
    PGBOSS_DATABASE_URL: jobDatabaseUrl,
    PGBOSS_SCHEMA: process.env.JOB_SCHEMA ?? 'pgboss',
  },
});

const pool = new pg.Pool({
  connectionString: databaseUrl,
  options: `-c TimeZone=UTC ${lockTimeout}`,
});

try {
  await migrate(drizzle({ client: pool }), {
    migrationsFolder: resolve(apiDirectory, 'drizzle'),
  });
  console.log('[migrate] migrations applied');
} finally {
  await pool.end();
}
