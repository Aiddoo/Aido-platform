#!/usr/bin/env bash
# =============================================================================
# Aido 프로덕션 배포 스크립트 (버전 관리: scripts/deploy.sh)
# 호출: .github/workflows/deploy.yml → SSH 부트스트랩(락 획득 + git reset) → 이 스크립트
# 전제: 실행 시점에 레포는 이미 DEPLOY_SHA로 reset --hard 된 상태
#
# 이미지 소스: 항상 GHCR pull (CI 또는 개발자 Mac이 빌드한 SHA 태그). 서버(2GB)는 빌드하지 않는다.
#              --build만 서버 로컬 빌드(비상 폴백, 끝나면 빌드 캐시 전체 삭제)
# 읽기 토큰: GHCR_TOKEN env(Actions) → $GHCR_TOKEN_FILE(기본 $STATE_DIR/ghcr-read-token, 600)
#            → 터미널 프롬프트. 없으면 빌드로 넘어가지 않고 중단한다. PAT 로그인 실패 시 GHCR_USER=<GitHub 로그인>
# 수동 배포 (apps/api/docs/deployment.md "수동 배포"):
#   Mac: bash scripts/ops/build-push-api-images.sh --push   # 마지막에 서버 명령을 출력
#   서버: cd ~/apps/Aido-platform && git fetch origin main \
#           && git merge-base --is-ancestor <sha> origin/main && git reset --hard <sha> \
#           && DEPLOY_SHA=<sha> bash scripts/deploy.sh
# 비상 서버 빌드: 위 서버 명령 끝을 `bash scripts/deploy.sh --build`로
# 수동 롤백: cd ~/apps/Aido-platform && bash scripts/deploy.sh --rollback
# [보안] 이 디렉터리에서 git clean 절대 금지 — .env.docker.prod(untracked 시크릿)가 삭제됨
# [보안] set -x 금지 — 환경변수 노출 방지. 토큰은 argv·history에 두지 않고 stdin 로그인 후 즉시 logout
# =============================================================================
set -Eeuo pipefail

STATE_DIR="${STATE_DIR:-$HOME/apps/deploy-state}"
COMPOSE_FILE="docker-compose.prod.yml"
API_IMAGE="aido-platform-api"
MIGRATE_IMAGE="aido-platform-migrate"
GHCR_API_IMAGE="ghcr.io/aiddoo/aido-platform-api"
GHCR_MIGRATE_IMAGE="ghcr.io/aiddoo/aido-platform-migrate"
API_CONTAINER="aido-prod-api"
MIGRATE_CONTAINER="aido-prod-migrate"
HEALTH_URL="${HEALTH_URL:-http://localhost:8080/health}"   # 드릴 시 env로 교체 가능
HEALTH_TIMEOUT_S=90
HEALTH_INTERVAL_S=5
HEALTH_CONSECUTIVE_OK=3
GHCR_USER="${GHCR_USER:-x-access-token}"               # Actions GITHUB_TOKEN 기본값. PAT면 GitHub 로그인
GHCR_TOKEN_FILE="${GHCR_TOKEN_FILE:-$STATE_DIR/ghcr-read-token}"  # 서버 1회 등록 read:packages 토큰
MIN_FREE_KB="${MIN_FREE_KB:-$((3 * 1024 * 1024))}"   # 빌드 전 최소 디스크 여유 3GB (드릴 시 env로 상향 가능)
DEPLOY_MODE=pull                                       # pull | build(--build) | rollback(--rollback)
export BUILDKIT_PROGRESS=plain

# --env-file: compose 변수 보간(${PORT:-8080} 등)은 서비스 env_file이 아닌 이 플래그/호스트 env만 읽음
#             — 루트 package.json의 docker:prod:* 스크립트와 동일 형태로 통일
compose() { docker compose --env-file .env.docker.prod -f "$COMPOSE_FILE" "$@"; }
log()  { printf '\n[deploy] %s\n' "$*"; }
fail() { printf '\n[deploy][ERROR] %s\n' "$*" >&2; exit 1; }
file_mode() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"; }
file_owner() { stat -c '%u' "$1" 2>/dev/null || stat -f '%u' "$1"; }
# 서버는 빌드 캐시를 두지 않는다 (2GB 서버에서 캐시가 5GB까지 쌓이고 dockerd RSS가 커졌다)
prune_build_cache() { docker builder prune -af >/dev/null || log "경고: 빌드 캐시 정리 실패"; }
disk_avail_kb() { df -k --output=avail / | tail -1 | tr -d '[:space:]'; }

acquire_lock() {
  # 부트스트랩이 이미 락(fd 9)을 잡고 넘어온 경우 재획득 금지 (재-open 시 락 해제됨)
  if [[ "${DEPLOY_LOCK_HELD:-0}" != "1" ]]; then
    mkdir -p "$STATE_DIR"
    exec 9>"$STATE_DIR/deploy.lock"
    flock -n 9 || fail "다른 배포가 진행 중입니다 ($STATE_DIR/deploy.lock)"
  fi
}

dump_logs() {
  log "── migrate 로그 (마지막 50줄) ──"
  docker logs --tail 50 "$MIGRATE_CONTAINER" 2>&1 || true
  log "── api 로그 (마지막 50줄) ──"
  docker logs --tail 50 "$API_CONTAINER" 2>&1 || true
  docker ps -a --filter "name=aido-prod" || true
}

wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT_S)) ok=0 status
  while (( SECONDS < deadline )); do
    status="$(docker inspect --format '{{.State.Health.Status}}' "$API_CONTAINER" 2>/dev/null || echo missing)"
    if [[ "$status" == "healthy" ]] && curl -fsS -m 5 "$HEALTH_URL" >/dev/null 2>&1; then
      ok=$((ok + 1))
      (( ok >= HEALTH_CONSECUTIVE_OK )) && { log "헬스체크 통과 (연속 ${ok}회)"; return 0; }
    else
      ok=0
    fi
    sleep "$HEALTH_INTERVAL_S"
  done
  return 1
}

restore_previous_images() {
  docker image inspect "$API_IMAGE:rollback" >/dev/null 2>&1 \
    || fail "롤백 이미지($API_IMAGE:rollback) 없음 — 수동 개입 필요"
  docker tag "$API_IMAGE:rollback" "$API_IMAGE:latest"
  if docker image inspect "$MIGRATE_IMAGE:rollback" >/dev/null 2>&1; then
    docker tag "$MIGRATE_IMAGE:rollback" "$MIGRATE_IMAGE:latest"
  fi
}

rollback() {
  trap - ERR
  log "배포 실패 — 이전 이미지로 롤백 시도"
  dump_logs
  restore_previous_images
  compose up -d --no-deps api   # migrate 재실행 없이 api만 복구 (--no-deps 필수)
  local healthy=0
  wait_healthy && healthy=1
  [[ "$DEPLOY_MODE" == "build" ]] && prune_build_cache
  if (( healthy )); then
    log "롤백 성공 — 이전 버전으로 서비스 중 (이번 배포는 실패 처리)"
    exit 1
  fi
  printf '\n[deploy][FATAL] 롤백 후에도 unhealthy — 즉시 수동 개입 필요\n' >&2
  dump_logs
  exit 2
}

# GHCR 읽기 토큰을 GHCR_TOKEN에 채운다 (env → 소유자 전용 파일 → 터미널 프롬프트). 값은 출력하지 않는다.
resolve_ghcr_token() {
  [[ -n "${GHCR_TOKEN:-}" ]] && return 0
  if [[ -f "$GHCR_TOKEN_FILE" ]]; then
    [[ "$(file_owner "$GHCR_TOKEN_FILE")" == "$(id -u)" ]] \
      || fail "$GHCR_TOKEN_FILE 소유자가 현재 사용자가 아닙니다"
    [[ "$(file_mode "$GHCR_TOKEN_FILE")" =~ ^[46]00$ ]] \
      || fail "$GHCR_TOKEN_FILE 권한이 너무 넓습니다 — chmod 600 \"$GHCR_TOKEN_FILE\""
    GHCR_TOKEN="$(tr -d '[:space:]' < "$GHCR_TOKEN_FILE")"
  elif [[ -t 0 ]]; then
    read -rsp "GHCR read:packages 토큰 (입력은 표시되지 않음): " GHCR_TOKEN; echo
  fi
  [[ -n "${GHCR_TOKEN:-}" ]] || fail "GHCR 토큰이 없습니다 — 서버에서 이미지를 빌드하지 않습니다.
  Mac에서 bash scripts/ops/build-push-api-images.sh --push 후 토큰 파일($GHCR_TOKEN_FILE, 600)을
  두거나 터미널에서 실행하세요. 비상시에만 서버 빌드: bash scripts/deploy.sh --build"
}

main() {
  case "${1:-}" in
    "") ;;
    --build) DEPLOY_MODE=build ;;
    --rollback) DEPLOY_MODE=rollback ;;
    *) fail "알 수 없는 인자: $1 (--build | --rollback)" ;;
  esac
  (( $# <= 1 )) || fail "인자는 하나만 받습니다: $*"

  cd "$(dirname "$0")/.."
  mkdir -p "$STATE_DIR"
  acquire_lock

  if [[ "$DEPLOY_MODE" == "rollback" ]]; then
    restore_previous_images
    compose up -d --no-deps api
    wait_healthy || { dump_logs; fail "수동 롤백 후에도 unhealthy"; }
    log "수동 롤백 완료"
    exit 0
  fi

  # 0. 배포 대상 검증
  DEPLOY_SHA="${DEPLOY_SHA:-$(git rev-parse HEAD)}"
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse "${DEPLOY_SHA}^{commit}")" ]] \
    || fail "작업트리가 DEPLOY_SHA(${DEPLOY_SHA}) 상태가 아닙니다"

  local last_sha_file="$STATE_DIR/last_deployed_sha"
  if [[ "${FORCE_DEPLOY:-0}" != "1" && -f "$last_sha_file" ]]; then
    local last; last="$(cat "$last_sha_file")"
    if git cat-file -e "${last}^{commit}" 2>/dev/null; then
      git merge-base --is-ancestor "$last" "$DEPLOY_SHA" \
        || fail "마지막 배포($last)보다 오래된 커밋 — 의도적이면 FORCE_DEPLOY=1"
    fi
  fi
  log "배포 대상: $(git log -1 --oneline HEAD)"
  # 이미지 소스를 컨테이너·태그를 건드리기 전에 확정 (토큰 부재로 조용히 서버 빌드하지 않음)
  if [[ "$DEPLOY_MODE" == "pull" ]]; then
    resolve_ghcr_token
  else
    log "비상 폴백: 서버 로컬 빌드 (--build) — 2GB 서버라 swap·디스크 압박이 큼"
  fi

  # 1. 디스크 사전 점검: 부족 → 전체 정리 → 재확인 → 그래도 부족하면 빌드 시작 전 중단
  #    (도중 ENOSPC로 죽는 빌드를 만들지 않는다 — 서비스는 구 버전으로 무영향)
  local avail_kb; avail_kb="$(disk_avail_kb)"
  log "디스크 여유: $(( avail_kb / 1024 / 1024 ))GB"
  if (( avail_kb < MIN_FREE_KB )); then
    log "여유 부족 — 빌드 캐시 전체 + dangling 이미지 정리 (이번 빌드는 콜드 빌드)"
    docker builder prune -af
    docker image prune -f
    avail_kb="$(disk_avail_kb)"
    (( avail_kb >= MIN_FREE_KB )) \
      || fail "정리 후에도 디스크 여유 부족($(( avail_kb / 1024 / 1024 ))GB) — 빌드 미시작, 서비스는 구 버전으로 계속 동작 중. df -h / docker system df로 원인 확인"
  fi

  # 2. 현재 이미지를 롤백 지점으로 태깅 (첫 실행 시 자동 시드)
  if docker image inspect "$API_IMAGE:latest" >/dev/null 2>&1; then
    docker tag "$API_IMAGE:latest" "$API_IMAGE:rollback"
    docker image inspect "$MIGRATE_IMAGE:latest" >/dev/null 2>&1 \
      && docker tag "$MIGRATE_IMAGE:latest" "$MIGRATE_IMAGE:rollback"
    log "롤백 태그 갱신 완료"
  else
    log "기존 latest 없음(첫 배포) — 롤백 태그 생략"
  fi

  # 3. 이미지 준비 — 기본: CI 또는 Mac이 빌드해 GHCR에 올린 이미지 pull (실패 시 컨테이너 무접촉 중단)
  #    폴백: --build일 때만 서버 로컬 빌드 (순차로 메모리 피크 분산)
  trap rollback ERR
  if [[ "$DEPLOY_MODE" == "build" ]]; then
    log "이미지 빌드(로컬): migrate"
    compose build migrate
    log "이미지 빌드(로컬): api"
    compose build api
  else
    log "이미지 pull: ${GHCR_API_IMAGE}:${DEPLOY_SHA}"
    # 로그인 실패는 롤백 없이 중단 — 아직 :latest와 컨테이너를 바꾸지 않았다
    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null 2>&1 \
      || { trap - ERR; fail "GHCR 로그인 실패 — 토큰의 read:packages 권한·만료, GHCR_USER 확인 (서비스는 구 버전)"; }
    # pull 실패로 ERR trap(롤백)을 타는 경로를 포함해 어떤 종료에서도 자격 증명이 남지 않도록 보장
    trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
    docker pull -q "${GHCR_API_IMAGE}:${DEPLOY_SHA}"
    docker pull -q "${GHCR_MIGRATE_IMAGE}:${DEPLOY_SHA}"
    docker logout ghcr.io >/dev/null 2>&1 || true
    # 로컬 이름으로 retag 후 GHCR 태그 제거 — 기존 :latest/:rollback 2세대 모델 그대로 유지
    docker tag "${GHCR_API_IMAGE}:${DEPLOY_SHA}" "$API_IMAGE:latest"
    docker tag "${GHCR_MIGRATE_IMAGE}:${DEPLOY_SHA}" "$MIGRATE_IMAGE:latest"
    docker rmi "${GHCR_API_IMAGE}:${DEPLOY_SHA}" "${GHCR_MIGRATE_IMAGE}:${DEPLOY_SHA}" >/dev/null 2>&1 || true
  fi

  # 4. 기동 (migrate 완료 대기 후 api 재생성; migrate 실패 시 구 api 유지된 채 비정상 종료 → 롤백 경로)
  log "컨테이너 기동 (migrate → api)"
  compose up -d

  # 5. 헬스 게이트
  wait_healthy || rollback
  trap - ERR

  # 6. 성공 처리: 상태 기록 + 안전한 정리 (정리 실패가 성공한 배포를 실패로 만들지 않도록 비치명 처리)
  git rev-parse HEAD > "$last_sha_file"
  printf '%s %s deployed\n' "$(date -Is)" "$(git rev-parse --short HEAD)" >> "$STATE_DIR/history.log"
  docker image prune -f || log "경고: dangling 이미지 정리 실패 (배포는 성공)"   # dangling만 — :rollback 보존 위해 -a 절대 금지
  prune_build_cache
  log "배포 완료: $(git rev-parse --short HEAD)"
  df -h / | tail -1
}

main "$@"
