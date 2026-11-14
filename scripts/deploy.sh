#!/usr/bin/env bash
# Aido 운영 배포(Blue-Green): migrate → 쉬는 슬롯에 새 API → healthy 확인 → Nginx 전환 → 옛 슬롯 종료.
# 호출: deploy.yml이 서버 checkout을 DEPLOY_SHA로 reset한 뒤 실행한다. 수동: DEPLOY_SHA=<sha> bash scripts/deploy.sh
# 롤백: 이전 SHA를 FORCE_DEPLOY=1로 다시 배포한다(이미지가 서버에 남아 있으면 토큰 없이 된다). 스키마는 되돌리지 않는다.
# 이 디렉터리에서 git clean을 하지 않는다(apps/api/.env가 지워진다). set -x를 쓰지 않는다(env가 로그에 남는다).
set -Eeuo pipefail

STATE_DIR="${STATE_DIR:-$HOME/apps/deploy-state}"
# Nginx가 가리키는 슬롯 한 줄. 지금 어느 슬롯이 살아 있는지는 이 파일이 정한다
UPSTREAM_FILE="${UPSTREAM_FILE:-/etc/nginx/aido-api-upstream.inc}"
REGISTRY=ghcr.io/aiddoo/aido-platform
GHCR_USER="${GHCR_USER:-x-access-token}"
GHCR_TOKEN_FILE="${GHCR_TOKEN_FILE:-$STATE_DIR/ghcr-read-token}"
NGINX_PID_FILE="${NGINX_PID_FILE:-/run/nginx.pid}"
HEALTH_WAIT_S=90
NGINX_RELOAD_WAIT_S=15
# Nginx proxy_read_timeout(60초)보다 길게 기다린다
NGINX_DRAIN_WAIT_S=70
# compose stop_grace_period와 같다
STOP_WAIT_S=120
draining_workers=""

log() { printf '\n[deploy] %s\n' "$*"; }
fail() {
  printf '\n[deploy][ERROR] %s\n' "$*" >&2
  exit 1
}
compose() { docker compose --env-file apps/api/.env -f docker-compose.prod.yml "$@"; }
is_private_file() { [[ -f "$1" && ! -L "$1" && "$(stat -c '%a' "$1")" =~ ^[46]00$ ]]; }
# 슬롯은 호스트 바인딩 문자열로 찾는다(blue·green 둘 다 컨테이너 안 포트는 8080이다)
containers_on() {
  docker ps --format '{{.ID}} {{.Ports}}' | awk -v bind="127.0.0.1:$1->" 'index($0, bind) { print $1 }'
}
nginx_workers() { pgrep -P "$(cat "$NGINX_PID_FILE")" | sort; }
# reload는 신호만 보내고 돌아온다. 새 worker가 떠야 새 설정이 적용된 것이다
reload_nginx() {
  local before waited
  before="$(nginx_workers)"
  sudo nginx -t -q && sudo systemctl reload nginx || return 1
  for ((waited = 0; waited < NGINX_RELOAD_WAIT_S; waited++)); do
    if [[ -n "$(comm -13 <(printf '%s\n' "$before") <(nginx_workers))" ]]; then
      draining_workers="$before"
      return 0
    fi
    sleep 1
  done
  return 1
}
# 옛 설정을 쥔 worker가 받던 요청을 끝내고 모두 빠질 때까지 기다린다.
# 곧바로 옛 슬롯을 내리면 그 사이 옛 슬롯으로 간 요청이 502가 된다(로컬 전환 연습에서 확인)
wait_nginx_drain() {
  local waited
  for ((waited = 0; waited < NGINX_DRAIN_WAIT_S; waited++)); do
    [[ -n "$(comm -12 <(printf '%s\n' "$draining_workers") <(nginx_workers))" ]] || return 0
    sleep 1
  done
}
point_nginx_at() {
  # 쓰다 만 파일이 남지 않게 옆에 쓰고 바꾼다
  printf 'server 127.0.0.1:%s;\n' "$1" | sudo tee "$UPSTREAM_FILE.new" >/dev/null \
    && sudo mv "$UPSTREAM_FILE.new" "$UPSTREAM_FILE" \
    && reload_nginx
}

(($# == 0)) || fail "인자를 받지 않는다. 롤백은 DEPLOY_SHA=<sha> FORCE_DEPLOY=1 bash scripts/deploy.sh"
cd "$(dirname "$0")/.."
mkdir -p "$STATE_DIR"
# workflow가 이미 잡고 넘어온 잠금(fd 9)은 다시 열지 않는다. 다시 열면 풀린다
if [[ "${DEPLOY_LOCK_HELD:-0}" != 1 ]]; then
  exec 9>"$STATE_DIR/deploy.lock"
  flock -n 9 || fail "다른 배포가 진행 중이다"
fi
is_private_file apps/api/.env || fail "apps/api/.env가 없거나 권한이 600이 아니다"
is_private_file apps/api/.env.migrate || fail "apps/api/.env.migrate가 없거나 권한이 600이 아니다"

IMAGE_TAG="$(git rev-parse "${DEPLOY_SHA:-HEAD}^{commit}")"
export IMAGE_TAG
[[ "$(git rev-parse HEAD)" == "$IMAGE_TAG" ]] || fail "작업 tree가 $IMAGE_TAG 상태가 아니다"
last="$(cat "$STATE_DIR/last_deployed_sha" 2>/dev/null || true)"
if [[ "${FORCE_DEPLOY:-0}" != 1 && -n "$last" ]] && git cat-file -e "$last^{commit}" 2>/dev/null; then
  git merge-base --is-ancestor "$last" "$IMAGE_TAG" \
    || fail "마지막 배포($last)보다 오래된 커밋이다. 롤백이면 FORCE_DEPLOY=1"
fi

live_port="$(grep -oE '127\.0\.0\.1:[0-9]+' "$UPSTREAM_FILE" 2>/dev/null | cut -d: -f2 || true)"
case "$live_port" in
  8080) next=green next_port=8081 ;;
  8081) next=blue next_port=8080 ;;
  *) fail "$UPSTREAM_FILE 에서 살아 있는 슬롯(8080·8081)을 읽지 못했다" ;;
esac
# 지난 배포가 전환 도중 끊겼어도 실행 중인 Nginx가 파일과 같은 슬롯을 보게 맞춘다
reload_nginx || fail "Nginx reload가 적용되지 않았다. 설정을 확인한다"
log "배포 $IMAGE_TAG: 지금 $live_port → 새 슬롯 $next($next_port)"

if ! docker image inspect "$REGISTRY-api:$IMAGE_TAG" "$REGISTRY-migrate:$IMAGE_TAG" >/dev/null 2>&1; then
  token="${GHCR_TOKEN:-}"
  if [[ -z "$token" ]] && is_private_file "$GHCR_TOKEN_FILE"; then
    token="$(tr -d '[:space:]' <"$GHCR_TOKEN_FILE")"
  fi
  [[ -n "$token" ]] || fail "GHCR 토큰이 없다: GHCR_TOKEN 또는 $GHCR_TOKEN_FILE(600)"
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
  printf '%s' "$token" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null 2>&1 \
    || fail "GHCR 로그인 실패"
  compose pull -q migrate "api-$next"
  docker logout ghcr.io >/dev/null 2>&1 || true
fi

# migrate가 실패하면 여기서 끝나고 살아 있는 API는 그대로다
log "migrate"
compose run --rm --pull never migrate

# 새 슬롯 자리에 남은 컨테이너를 치운다(끊긴 지난 배포, 첫 전환 때의 옛 컨테이너). Nginx는 이 포트를 보지 않는다
mapfile -t stale < <(containers_on "$next_port")
if ((${#stale[@]})); then
  log "새 슬롯($next_port)에 남은 컨테이너 정리"
  docker stop -t "$STOP_WAIT_S" "${stale[@]}" >/dev/null
  docker rm "${stale[@]}" >/dev/null
fi
compose rm -sf "api-$next" >/dev/null || fail "새 슬롯의 옛 컨테이너를 지우지 못했다"
log "새 API 기동"
if ! compose up -d --no-deps --pull never --wait --wait-timeout "$HEALTH_WAIT_S" "api-$next" \
  || ! curl -fsS -m 5 "http://127.0.0.1:$next_port/health" >/dev/null; then
  compose logs --tail 80 "api-$next" || true
  compose rm -sf "api-$next" >/dev/null || true
  fail "새 API가 healthy가 아니어서 지웠다. 살아 있는 슬롯($live_port)은 그대로다"
fi

log "Nginx 전환"
if ! point_nginx_at "$next_port"; then
  point_nginx_at "$live_port" || true
  compose rm -sf "api-$next" >/dev/null || true
  fail "Nginx 전환 실패. 살아 있는 슬롯($live_port)으로 되돌렸다"
fi
# 여기부터 새 버전이 응답한다. 뒤 단계가 끊겨도 기록은 맞다
printf '%s\n' "$IMAGE_TAG" >"$STATE_DIR/last_deployed_sha"
printf '%s %s deployed %s\n' "$(date -Is)" "${IMAGE_TAG:0:9}" "$next" >>"$STATE_DIR/history.log"
wait_nginx_drain

mapfile -t old < <(containers_on "$live_port")
previous_image=""
if ((${#old[@]})); then
  previous_image="$(docker inspect -f '{{.Config.Image}}' "${old[0]}")"
  log "옛 API 종료"
  docker stop -t "$STOP_WAIT_S" "${old[@]}" >/dev/null
  docker rm "${old[@]}" >/dev/null
fi

# 롤백용으로 방금 내린 버전의 이미지까지 남긴다. 같은 SHA를 다시 배포했으면 지우지 않는다. 정리 실패는 배포 실패가 아니다
previous_tag="${previous_image##*:}"
if [[ "$previous_tag" != "$IMAGE_TAG" ]]; then
  docker images --filter "reference=$REGISTRY-*" --format '{{.Repository}}:{{.Tag}}' \
    | grep -vE ":(${IMAGE_TAG}|${previous_tag:-${last:-none}})$" | xargs -r docker rmi >/dev/null 2>&1 || true
fi
docker image prune -f >/dev/null || true
log "배포 완료: ${IMAGE_TAG:0:9} ($next)"
