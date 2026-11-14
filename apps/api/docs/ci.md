# 서버 CI

PR 또는 배포 검증을 준비할 때 참고한다. 정본은 [ci.yml](../../../.github/workflows/ci.yml), [setup action](../../../.github/actions/setup/action.yml), [dependency scope](../../../scripts/ci/dependency-scope.mjs)다.

## 실행 범위

CI는 `main`을 향한 PR(draft 제외), `main` push, 수동 실행에서 돈다. stack은 맨 아래 PR만 `main`을 향하므로 위층 PR에는 CI가 없다. 위층의 누적 tree는 tip을 push할 때 pre-push 훅(typecheck·단위·통합·계약·build)이 검증하고, stack을 합친 뒤 `main` push CI가 이미지 발행 전에 같은 검사를 다시 돈다. `main` CI가 실패하면 이미지 발행과 배포가 멈춘다.

`apps/api`, migration tooling, production compose/deploy 변경은 API 범위다. `packages/api` 공개 계약은 API·모바일·공유 범위 모두다. Markdown/docs-only 변경은 heavy 범위에서 빠지고 `Docs Check` job이 문서 검사만 돈다. 비교 기준이 없거나(수동 실행·새 브랜치) diff를 구하지 못하면 전체 범위로 검증한다. CI 범위 테스트(`scripts/ci/*.test.mjs`)는 그 파일을 바꾼 커밋의 pre-commit 훅에서 돈다.

PR에서만 도는 Dependency Review는 `main`을 향한 PR의 diff만 본다.

## API 작업 흐름

| Job                | 역할                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI Scope           | 변경 파일로 API·모바일·공유·문서 범위를 정한다([dependency scope](../../../scripts/ci/dependency-scope.mjs))                                                                                                                                                                                                                                                                                                                             |
| Dependency Review  | `main`을 향한 PR에서 공식 dependency-review-action으로 high 이상 취약 의존성이 새로 들어오는지 확인                                                                                                                                                                                                                                                                                                                                      |
| Lint, Test & Build | 한 번의 checkout·설치로 Oxc lint/format, `pnpm audit --prod --audit-level high`, 컨벤션 검사, `turbo run typecheck --affected`, 테스트 작업을 한 번에 하나씩 도는 `turbo run test test:node test:integration test:contract --affected --concurrency=1`, API 범위일 때 API 의존성 closure build. 테스트는 pre-push가 올린 원격 캐시를 재사용하고 놓친 작업만 러너에서 돈다. 전체 E2E는 CI에서 돌리지 않고 `pnpm test:e2e`로 직접 실행한다 |
| Docs Check         | 문서만 바뀐 diff(세 범위가 모두 꺼짐)에서 루트 도구만 설치(`install-scope: root`)하고 `pnpm docs:check`만 실행. 코드와 함께 바뀐 문서는 Lint, Test & Build의 docs:check가 본다                                                                                                                                                                                                                                                           |
| Build & Push Image | main의 API 영향 변경이며 같은 run의 Lint, Test & Build가 성공했을 때 ARM64 API/migrate 두 이미지를 같은 SHA로 빌드해 Trivy(HIGH/CRITICAL, 미수정 제외) 검사를 통과한 뒤 발행하고, 공식 `actions/attest`로 두 digest에 빌드 출처 증명을 남김                                                                                                                                                                                              |

공식 setup action은 `.nvmrc` Node.js 버전, packageManager의 pnpm 버전, frozen lockfile과 pnpm cache를 사용한다. API만 영향이 있으면 API dependency closure를 설치하고 필요한 contract를 emit한다. GitHub Actions는 버전 주석과 commit SHA로 고정하며 업데이트의 정본은 workflow다.

CI는 PostgreSQL service를 띄우지 않는다. 통합·계약 테스트는 러너(로컬은 훅)의 Docker에서 Testcontainers(또는 `AIDO_TEST_POSTGRES_URL`)로 무작위 `aido_test_<run-id>` DB를 만들고 자신이 만든 DB만 정리한다. 유료 vendor 호출은 기본 테스트에 넣지 않는다.

Turbo 원격 캐시는 `TURBO_TOKEN`·`TURBO_TEAM`으로 로컬과 CI가 같은 팀 캐시를 쓴다(시크릿이 없는 fork PR은 캐시 없이 전부 돈다). `test:integration`·`test:contract`는 `src/**`·`test/**`·`drizzle/**`·설정 파일을 입력으로 캐시되며, 결과에 영향을 주는 `TZ`·`BROADCAST_RECIPIENT_COUNT`는 `env`로 해시에 넣는다. Docker build cache는 도구 기본 경로를 사용한다. CI Scope는 변경 파일 목록만 필요하므로 `filter: blob:none`으로 이력만 받는다.

## 로컬 검증과 완료 기록

작업 중에는 변경한 동작의 target test와 필요한 lint/type/format을 실행하고, source가 바뀌지 않은 성공 검사를 반복하지 않는다. 공개 HTTP·OpenAPI·released-client fingerprint와 실제 DB/transaction 검사는 pre-push 훅(통합·계약 테스트)이 맡고, CI는 같은 캐시로 정적 검사·단위·통합·계약 테스트와 build를 다시 확인한다. 로컬 결과에는 command, source revision, seed, 파일/테스트 수, 실패·재실행 사유와 한계를 남긴다. coverage나 SDK schema 통과를 실제 vendor 품질/운영 배포 완료로 표현하지 않는다.

수동 performance project와 승인된 유료 AI 평가는 일반 CI 밖의 별도 근거다. 배포 승인은 [배포 문서](deployment.md)의 동일 SHA 이미지·마이그레이션·health 절차를 따른다.

## 의존성·이미지 보안 검사

- workflow 기본 권한은 `contents: read`이고 job이 필요한 권한만 더한다. `TURBO_TOKEN`은 turbo를 실행하는 job에만 주입한다.
- 출처 증명은 GitHub attestations API에만 저장하고 registry에는 올리지 않는다(GHCR 버전 보존 개수 유지). `gh attestation verify oci://ghcr.io/aiddoo/aido-platform-api:<sha> --repo Aiddoo/Aido-platform`으로 확인한다.
- CodeQL(actions, JavaScript/TypeScript)은 PR마다 돌리지 않고 기본 브랜치를 주 1회 스캔한다([codeql.yml](../../../.github/workflows/codeql.yml)). schedule은 저장소 기본 브랜치에서만 돌므로 기본 브랜치는 `main`이어야 한다.

- `pnpm audit --prod --audit-level high`가 high 이상 취약점을 막는다. 패치 버전이 없어 위험을 수용한 advisory는 `pnpm-workspace.yaml`의 `auditConfig.ignoreGhsas`에 사유·제거 조건 주석과 함께 둔다. 지금 수용한 advisory와 사유는 그 파일의 주석이 정본이다.
- API/migrate 이미지는 runner에 load한 상태로 Trivy가 먼저 검사하고, 둘 다 고칠 수 있는 HIGH/CRITICAL이 없을 때만 GHCR에 push한다. 검사에 실패하면 그 SHA의 이미지가 발행되지 않으므로 deploy의 이미지 존재 확인(`docker buildx imagetools inspect`)에서 멈춘다.
