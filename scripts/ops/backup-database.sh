#!/usr/bin/env bash
# 운영 DB를 pg_dump로 떠서 S3에 올린다. 서버 cron이 매일 03:00 UTC에 ~/apps/backup.sh(이 파일의 사본)를 실행한다.
# 설정은 ~/apps/backup.env(권한 600)의 BACKUP_DB_HOST·BACKUP_S3_URI, 비밀번호는 ~/.pgpass에서 읽는다.
set -euo pipefail

# shellcheck source=/dev/null
source "${BACKUP_ENV_FILE:-$HOME/apps/backup.env}"
: "${BACKUP_DB_HOST:?BACKUP_DB_HOST 없음}" "${BACKUP_S3_URI:?BACKUP_S3_URI 없음}"

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
LOCAL_RETENTION_DAYS=7
backup_file="$BACKUP_DIR/aido_db_$(date -u +%Y%m%d_%H%M%S).sql.gz"

# pipefail이라 pg_dump가 실패하면 반쪽 파일을 올리지 않고 지운 뒤 멈춘다
trap 'rm -f "$backup_file"; echo "$(date -u +%FT%TZ) 백업 실패" >&2' ERR

mkdir -p "$BACKUP_DIR"
pg_dump -h "$BACKUP_DB_HOST" -U postgres aido | gzip >"$backup_file"
gzip -t "$backup_file"
aws s3 cp --only-show-errors "$backup_file" "$BACKUP_S3_URI/daily/$(basename "$backup_file")"
echo "$(date -u +%FT%TZ) 백업 완료: $(basename "$backup_file") ($(du -h "$backup_file" | cut -f1))"

# 올린 뒤에만 오래된 로컬 사본을 지운다
find "$BACKUP_DIR" -name 'aido_db_*.sql.gz' -mtime +"$LOCAL_RETENTION_DAYS" -delete
