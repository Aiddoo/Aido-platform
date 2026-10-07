#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
export PGBOSS_DATABASE_URL="${PGBOSS_DATABASE_URL:-$DATABASE_URL}"
export PGBOSS_SCHEMA="${JOB_SCHEMA:-pgboss}"

# pg-boss도 DDL을 실행하므로 두 연결 모두 Prisma 실행 전에 검증한다.
script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
node - "$script_directory/guard-database-url.cjs" <<'NODE'
const { assertDatabaseUrlIsSafe } = require(process.argv[2]);
assertDatabaseUrlIsSafe(process.env.DATABASE_URL);
assertDatabaseUrlIsSafe(process.env.PGBOSS_DATABASE_URL);
NODE

# Bound DDL lock waits so an active request cannot leave deployment queued indefinitely.
export PGOPTIONS="${PGOPTIONS:+$PGOPTIONS }-c lock_timeout=5000"

pnpm exec pg-boss migrate

# Native migration graphs start at an empty DB. Existing installations are
# adopted only after the CLI verifies the exact baseline schema. An existing
# Prisma 8 marker is never re-signed, so drift and missing migrations still fail.
node --input-type=module - "$script_directory" <<'NODE'
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

const scriptDirectory = process.argv[2];
const output = execFileSync('pnpm', ['exec', 'prisma', 'migration', 'status', '--json'], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
const result = output.split('\n').filter(Boolean).map(line => JSON.parse(line))
  .find(item => item.kind === 'result');
if (result?.envelope.ok !== true) throw new Error('Cannot read native migration status');
const space = result.envelope.result.spaces.find(item => item.space === 'app');
if (space === undefined) throw new Error('Application contract space is missing');
// A no-op migrate trusts its marker. Verify an already-current installation
// explicitly so out-of-band schema changes cannot pass the deployment gate.
if (space.currentContract !== null && space.currentContract === space.targetContract) {
  execFileSync('pnpm', ['exec', 'prisma', 'db', 'verify', '--format', 'human'], {
    stdio: 'inherit',
  });
}
if (space.currentContract === null) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let existingDatabase;
  try {
    await client.connect();
    const query = await client.query(`SELECT to_regclass('public."User"') IS NOT NULL AS exists`);
    existingDatabase = query.rows[0]?.exists === true;
    if (existingDatabase) {
      const invariant = await client.query(`SELECT EXISTS (SELECT 1 FROM "public"."User" u
        WHERE u.id = $1 AND u.email = $2 AND u."userTag" = $3 AND u.status = 'LOCKED' AND u."deletedAt" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "public"."Account" a WHERE a."userId" = u.id)) AS valid`,
        ['cm1deletedcommentauthor000001', 'system:deleted-comment-author', '_DELETED']);
      if (invariant.rows[0]?.valid !== true) throw new Error('Reserved comment author invariant is invalid');
    }
  } finally {
    await client.end();
  }
  if (existingDatabase) {
    const manifest = JSON.parse(readFileSync(resolve(scriptDirectory,
      '../prisma/migrations8/app/20261006T1211_prisma8_baseline/migration.json'), 'utf8'));
    execFileSync('pnpm', ['exec', 'prisma', 'db', 'sign', '--contract', manifest.to,
      '--no-advance-ref', '--format', 'human'], { stdio: 'inherit' });
  }
}
NODE

pnpm exec prisma db migrate --format human
exec pnpm exec prisma db verify --format human
