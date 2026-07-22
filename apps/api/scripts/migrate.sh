#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

# pg-boss 공식 CLI로 스키마를 먼저 맞춘 뒤 Prisma migration을 적용한다.
# 연결 문자열은 출력하지 않으며, 앱 런타임은 migrate=false로 DDL 권한을 갖지 않는다.
export PGBOSS_DATABASE_URL="${PGBOSS_DATABASE_URL:-$DATABASE_URL}"
export PGBOSS_SCHEMA="${JOB_SCHEMA:-pgboss}"

pnpm exec pg-boss migrate
exec pnpm prisma migrate deploy
