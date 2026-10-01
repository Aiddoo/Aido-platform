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

pnpm exec pg-boss migrate
exec pnpm prisma migrate deploy
