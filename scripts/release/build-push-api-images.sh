#!/usr/bin/env bash
# =============================================================================
# Actions 없이 배포할 API/migrate 이미지를 개발자 Mac에서 빌드하고 GHCR에 올린다.
# 서버(t4g.small, 2GB)는 빌드하지 않고 pull만 한다 — apps/api/docs/deployment.md "수동 배포"
#
# 빌드 설정은 .github/workflows/ci.yml의 docker job과 같다:
#   apps/api/Dockerfile · target production/migrate · linux/arm64 · --pull · provenance/sbom 끔
#   태그 ghcr.io/aiddoo/aido-platform-{api,migrate}:<40자리 HEAD SHA>
#   CI처럼 trivy(HIGH/CRITICAL, ignore-unfixed) 검사를 통과한 이미지만 push 한다.
#
# 사용: bash scripts/release/build-push-api-images.sh            # 빌드만 (기본)
#       bash scripts/release/build-push-api-images.sh --push     # 빌드 → 검사 → GHCR push
# 옵션: --allow-local  변경 있는 작업 tree·origin/main에 없는 SHA도 빌드 (로컬 시험용, --push 불가)
#       --skip-scan    trivy 없이 push (CI와 달라지므로 비상시에만)
# 전제: --push 전에 소유자가 `docker login ghcr.io`(write:packages)를 해 둔다. 이 스크립트는
#       자격 증명을 읽거나 출력하지 않는다.
# [보안] set -x 금지
# =============================================================================
set -euo pipefail

GHCR_API_IMAGE="ghcr.io/aiddoo/aido-platform-api"
GHCR_MIGRATE_IMAGE="ghcr.io/aiddoo/aido-platform-migrate"
PLATFORM="linux/arm64"
# .dockerignore allowlist와 같은 빌드 context 경로 — 여기의 미추적 파일은 이미지에 들어간다
CONTEXT_PATHS=(package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json patches apps/api packages/api tooling)

log()  { printf '\n[images] %s\n' "$*"; }
fail() { printf '\n[images][ERROR] %s\n' "$*" >&2; exit 1; }

usage() { sed -n '3,16p' "$0" | sed 's/^# \{0,1\}//'; }

push=0 allow_local=0 skip_scan=0
for arg in "$@"; do
  case "$arg" in
    --push) push=1 ;;
    --allow-local) allow_local=1 ;;
    --skip-scan) skip_scan=1 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "알 수 없는 인자: $arg (--help 참고)" ;;
  esac
done
(( push && allow_local )) && fail "--allow-local 이미지는 push 하지 않습니다 (서버는 origin/main의 SHA만 배포)"

cd "$(git rev-parse --show-toplevel)"
sha="$(git rev-parse HEAD)"

# 1. 이미지가 정확히 이 SHA의 내용인지 확인
if (( ! allow_local )); then
  [[ -z "$(git status --porcelain --untracked-files=no)" ]] \
    || fail "커밋하지 않은 변경이 있습니다 — commit/stash 후 다시 실행"
  [[ -z "$(git status --porcelain --untracked-files=all -- "${CONTEXT_PATHS[@]}")" ]] \
    || fail "빌드 context에 미추적 파일이 있습니다 — 지우거나 commit 후 다시 실행"
  log "origin/main 확인 (git fetch)"
  git fetch --quiet origin main
  git merge-base --is-ancestor "$sha" origin/main \
    || fail "HEAD($sha)가 origin/main 이력에 없습니다 — main에 머지된 커밋을 checkout 하세요"
fi

# 2. buildx builder가 arm64를 빌드할 수 있는지 확인 (BUILDX_BUILDER로 다른 builder 지정 가능)
docker buildx inspect --bootstrap 2>/dev/null | grep -E '^Platforms:' | grep -q 'linux/arm64' \
  || fail "현재 buildx builder가 $PLATFORM을 지원하지 않습니다 — docker buildx ls 확인"
[[ "$(docker info --format '{{.Architecture}}' 2>/dev/null)" == "aarch64" ]] \
  || log "경고: Docker 호스트가 arm64가 아닙니다 — 에뮬레이션 빌드라 느립니다"

if (( push && ! skip_scan )); then
  command -v trivy >/dev/null 2>&1 \
    || fail "trivy가 없습니다 — brew install trivy (검사 없이 올리려면 --skip-scan)"
fi

# 이미 GHCR에 있는 태그(CI 발행분 등)는 덮어쓰지 않는다 — CI attestation digest가 어긋나지 않게
exists_remote() { docker buildx imagetools inspect "$1" >/dev/null 2>&1; }

print_next() {
  cat <<EOF

[images] 다음 단계 — 서버에서 (토큰은 ~/apps/deploy-state/ghcr-read-token 또는 프롬프트로 읽음):
  cd ~/apps/Aido-platform && git fetch origin main \\
    && git merge-base --is-ancestor $sha origin/main && git reset --hard $sha \\
    && DEPLOY_SHA=$sha bash scripts/deploy.sh
EOF
}

refs=()
for image in "$GHCR_MIGRATE_IMAGE" "$GHCR_API_IMAGE"; do
  if (( push )) && exists_remote "$image:$sha"; then
    log "이미 GHCR에 있음 — 건너뜀: $image:$sha"
  else
    refs+=("$image:$sha")
  fi
done
if (( ${#refs[@]} == 0 )); then
  print_next
  exit 0
fi

# 3. 빌드 (서버와 같은 순서: migrate → api). --load로 로컬 docker에 넣어 검사·push 한다
for ref in "${refs[@]}"; do
  case "$ref" in
    "$GHCR_API_IMAGE":*) target=production ;;
    *) target=migrate ;;
  esac
  log "빌드: $ref (target=$target, $PLATFORM)"
  docker buildx build \
    --file apps/api/Dockerfile \
    --target "$target" \
    --platform "$PLATFORM" \
    --pull \
    --provenance=false \
    --sbom=false \
    --load \
    --tag "$ref" \
    .
done

# 4. 검사 (CI와 같은 기준)
if (( ! skip_scan )) && command -v trivy >/dev/null 2>&1; then
  for ref in "${refs[@]}"; do
    log "검사: $ref"
    trivy image --quiet --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "$ref"
  done
elif (( ! skip_scan )); then
  log "trivy 없음 — 검사 생략 (빌드만 하는 실행)"
fi

if (( ! push )); then
  log "빌드 완료 (push 안 함): ${refs[*]}"
  log "GHCR에 올리려면 같은 커밋에서 --push 로 다시 실행"
  exit 0
fi

# 5. push — GHCR 버전 보존(최신 10개)은 다음 CI image job의 정리 단계가 맡는다
for ref in "${refs[@]}"; do
  log "push: $ref"
  docker push --quiet "$ref"
  log "digest: $(docker buildx imagetools inspect "$ref" --format '{{.Manifest.Digest}}')"
done
print_next
