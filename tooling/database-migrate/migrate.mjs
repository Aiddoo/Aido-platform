import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const require = createRequire(import.meta.url);
const apiDirectory = resolve(import.meta.dirname, '../../apps/api');
const { assertDatabaseUrlIsSafe } = require(
  resolve(apiDirectory, 'scripts/guard-database-url.cjs'),
);

const RESERVED_COMMENT_AUTHOR = [
  'cm1deletedcommentauthor000001',
  'system:deleted-comment-author',
  '_DELETED',
];

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
const db = drizzle({ client: pool });
const migrationsFolder = resolve(apiDirectory, 'drizzle');

/** Prisma로 만든 기존 DB는 baseline을 실행하지 않고 적용됨으로만 기록한다(공식 init). */
async function adoptExistingDatabase() {
  const { rows } = await pool.query(`
    SELECT to_regclass('public."User"') IS NOT NULL AS "hasSchema",
           to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS "hasJournal"
  `);
  const [{ hasSchema, hasJournal }] = rows;
  if (!hasSchema || hasJournal) {
    return;
  }

  const invariant = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM "User" u
       WHERE u.id = $1 AND u.email = $2 AND u."userTag" = $3 AND u.status = 'LOCKED' AND u."deletedAt" IS NULL
         AND NOT EXISTS (SELECT 1 FROM "Account" a WHERE a."userId" = u.id)
     ) AS valid`,
    RESERVED_COMMENT_AUTHOR,
  );
  if (invariant.rows[0]?.valid !== true) {
    throw new Error('Reserved comment author invariant is invalid');
  }

  const result = await migrate(db, { migrationsFolder, init: true });
  if (result?.exitCode) {
    throw new Error(
      `Cannot adopt the existing database as the Drizzle baseline: ${result.exitCode}`,
    );
  }
  console.log('[migrate] existing database adopted at the Drizzle baseline');
}

try {
  await adoptExistingDatabase();
  await migrate(db, { migrationsFolder });
  console.log('[migrate] migrations applied');
} finally {
  await pool.end();
}
