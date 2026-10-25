#!/usr/bin/env bash
# 얇은 실행 래퍼. 사용: run.sh <smoke|full|failure|flag-off> [maestro 추가 인자...]
#
# 하는 일은 두 가지뿐이다.
#  1) .env.maestro를 shell 환경으로 올린다(MAESTRO_ 접두 변수는 Maestro가 flow 변수로 읽는다).
#  2) 초대 수락 기록은 API로 되돌릴 수 없어서, 'fresh' 태그 flow는 실행 직전에 B를 reset하고 하나씩 돌린다.
#     그 밖의 flow는 config.yaml 순서로 한 번에 돌린다.
set -euo pipefail

cd "$(dirname "$0")"
tag="${1:-smoke}"
shift || true

env_file="${MAESTRO_ENV_FILE:-.env.maestro}"
if [[ -f "$env_file" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

accounts() { node scripts/maestro-accounts.ts "$@"; }
run_maestro() { maestro ${QA_DEVICE:+--device "$QA_DEVICE"} test ${QA_SCHEME:+-e "QA_SCHEME=$QA_SCHEME"} ${QA_API_BASE_URL:+-e "QA_API_BASE_URL=$QA_API_BASE_URL"} "$@"; }

if [[ "$tag" == "flag-off" ]]; then
  run_maestro --include-tags flag-off "$@" .
  exit $?
fi

exclude="production-build,flag-off"
[[ "${QA_PLATFORM:-}" == "ios" ]] && exclude="$exclude,android-only"

failed=0

# 1) 상태 변경이 없는 flow: B가 깨끗한 상태에서 한 번에
accounts reset
run_maestro --include-tags "$tag" --exclude-tags "fresh,fill-a,fill-ab,$exclude" "$@" . || failed=$((failed + 1))

# 2) B를 소비하는 flow: 하나씩 reset 후 실행. fill-a/fill-ab 태그는 친구 한도를 먼저 채운다
for flow in *.yaml; do
  [[ "$flow" == "config.yaml" ]] && continue
  grep -q '^  - fresh$' "$flow" || continue
  grep -q "^  - $tag\$" "$flow" || continue
  accounts reset
  if grep -q '^  - fill-a$' "$flow"; then
    accounts fill-friends a
  elif grep -q '^  - fill-ab$' "$flow"; then
    accounts fill-friends a
    accounts fill-friends b
  fi
  echo "== $flow"
  run_maestro "$@" "$flow" || failed=$((failed + 1))
  accounts clear-friends
done

exit "$failed"
