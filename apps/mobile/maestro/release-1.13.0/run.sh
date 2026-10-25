#!/usr/bin/env bash
# 1.13.0 초대 Maestro 실행기. 사용: run.sh [smoke|full] [maestro 추가 인자...]
# 계정·코드는 .env.maestro(키는 .env.maestro.example 참고) 또는 셸 환경 변수로만 받는다.
set -euo pipefail

cd "$(dirname "$0")"
profile="${1:-smoke}"
shift || true

env_file="${MAESTRO_ENV_FILE:-.env.maestro}"
if [[ -f "$env_file" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

require=(QA_INVITER_EMAIL QA_INVITER_PASSWORD QA_INVITER_NAME QA_INVITEE_EMAIL QA_INVITEE_PASSWORD)
if [[ "$profile" == "full" ]]; then
  require+=(QA_EXISTING_EMAIL QA_EXISTING_PASSWORD)
fi
for key in "${require[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "필수 환경 변수 $key 가 없습니다. .env.maestro.example 을 참고하세요." >&2
    exit 1
  fi
done

# 순서가 중요하다: 초대받는 계정이 친구 0명인 상태에서 entry-points → code-entry → cold-start → grant 순으로 쓴다
case "$profile" in
  smoke) flows=(invite-cold-start-logged-out.yaml invite-code-entry.yaml my-invite.yaml) ;;
  full)
    flows=(entry-points.yaml invite-code-entry.yaml invite-cold-start-logged-out.yaml
      premium-grant-subscription.yaml my-invite.yaml invite-existing-user.yaml avatar-and-date-smoke.yaml)
    ;;
  *) echo "profile은 smoke 또는 full 입니다." >&2; exit 1 ;;
esac

# 선택 변수는 flow의 env 기본값을 덮어쓰도록 -e 로 넘긴다
args=()
for key in QA_SCHEME QA_INVITE_CODE INVITE_CODE QA_INVITER_NAME QA_INVITER_EMAIL QA_INVITER_PASSWORD \
  QA_INVITEE_EMAIL QA_INVITEE_PASSWORD QA_EXISTING_EMAIL QA_EXISTING_PASSWORD; do
  if [[ -n "${!key:-}" ]]; then
    name="$key"
    [[ "$key" == "INVITE_CODE" ]] && name="QA_INVITE_CODE"
    args+=(-e "$name=${!key}")
  fi
done

# Maestro 는 flow 하나씩 독립 실행한다. 하나가 실패해도 나머지를 돌리고 마지막에 실패 수로 종료한다
failed=0
for flow in "${flows[@]}"; do
  echo "== $flow"
  maestro ${MAESTRO_DEVICE:+--device "$MAESTRO_DEVICE"} test "${args[@]}" "$@" "$flow" || failed=$((failed + 1))
done
exit "$failed"
