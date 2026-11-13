# 서버 CI

PR 또는 배포 검증을 준비할 때 참고한다. 정본은 [ci.yml](../../../.github/workflows/ci.yml), [setup action](../../../.github/actions/setup/action.yml), [CI policy](../../../scripts/ci/stack-policy.mjs), [dependency scope](../../../scripts/ci/dependency-scope.mjs)다.

## 실행 범위

PR은 `main`을 향한다. 일반 PR은 ready일 때 검사한다. Draft와 중간 stack PR의 heavy job은 미룬다. 열린 stack에서 `ci:stack-tip`을 가진 하나의 ready tip이 현재 base와 ancestor를 포함한 누적 diff를 검증한다. 오래된 workflow head나 누락 ancestor는 실패시켜 재정렬 후 현재 head에서 다시 실행한다.

`apps/api`, migration tooling, production compose/deploy 변경은 API 범위다. `packages/api` 공개 계약은 API와 모바일·공유 검증에 영향을 준다. Markdown/docs-only 변경은 heavy 범위에서 제외되고 `Docs Check` job이 문서 검사만 돈다. 불명확한 diff는 전체 범위로 fallback한다. CI 정책 테스트(`scripts/ci/*.test.mjs`)는 CI에서 돌리지 않고 해당 파일을 바꾼 커밋의 pre-commit 훅에서 실행한다. 중간 PR에도 workflow/run 또는 skipped job 메타데이터는 생길 수 있으므로, 비용 기록에서는 실제 검증 job 실행과 구분한다.

## 동일 source 검증 재사용

main을 향한 일반 PR과 최종 ready stack tip에서 heavy job을 실행한다. main push는 Git tree가 같은 성공 PR 결과가 있으면 재사용해 이미지 빌드·배포만 진행한다. Commit SHA가 달라져도 파일·파일 모드·경로를 포함한 tree가 같아야 한다. CI 정책·workflow·lockfile 변경도 tree에 포함되므로 새 source는 이전 결과를 재사용할 수 없다.

PR의 head `H`와 실제 checkout한 merge commit `P`는 별개다. 후보 artifact `ci-tree-proof-<run-id>-<attempt>`에 `H`, `P`, `git rev-parse HEAD^{tree}`, repository, run/attempt, PR 번호, stack label(일반 PR은 없음), base/ancestor, API·mobile·shared 범위와 `cumulative-stack-tip` 또는 `regular` 정책을 기록한다. `regular` 후보는 base가 `main`인 일반 PR에서만 만든다. `P`와 `H`의 tree가 같은 경우에만 후보를 발행하며, heavy job 실행 전 업로드된 artifact 자체는 성공 증거가 아니다.

main gate는 같은 저장소·CI workflow의 성공 PR run에서 후보를 찾고, 공식 download-artifact와 `actions: read` 권한으로 해당 run의 정확한 artifact를 다운로드한다. 재사용 전에 다음 조건을 독립적으로 확인한다.

- 원본 run은 현재 attempt에서 `completed/success`이고, 해당 PR은 같은 저장소의 ready stack tip 또는 stack 라벨이 없고 base가 `main`인 일반 PR이며 head가 `H`로 유지된다. fork·중간 PR의 결과는 사용하지 않는다.
- 공식 attempt별 jobs API에서 `Lint, Test & Build`가 실제 `completed/success`여야 한다. skipped job은 성공 검증을 대신하지 않는다. 조회 후 원본 run의 attempt를 다시 확인한다.
- Artifact는 해당 run/attempt의 유일한 이름·메타데이터와 일치하고 만료되지 않아야 한다. 다운로드 digest 검증 실패도 재사용을 거부한다.
- 원본 `P`, `H`와 현재 checkout의 tree가 같고 현재 commit이 `H`를 포함해야 한다. 현재 변경 범위는 증거가 검증한 API·mobile·shared 범위에 모두 포함되어야 한다.

조건이 맞으면 gate의 `validation_reused=true`와 원본 run URL을 summary에 남기고 현재 heavy job을 건너뛴다. main의 API 변경은 이 신뢰된 결과로 이미지 build/push를 계속 실행한다. heavy job이 단지 skipped인 것만으로 이미지 발행을 허용하지 않는다.

증거가 없거나 만료·불일치·API 조회/다운로드 실패이면 현재 범위의 실제 검증으로 돌아간다. 후보 검색은 최근 성공 PR run 100개 중 앞 20개로 제한하므로 범위 밖 증거도 이 fallback에 해당한다. `workflow_dispatch`는 재사용하지 않고 전체 검증을 실행한다. 같은 source의 성공 증거가 유지되는 정상 경로에서 heavy 검증은 tip 한 번이며, source 변경·증거 소실·수동 실행에서는 추가 검증이 필요하다.

Git tree 증거는 파일과 검증 범위에 관한 근거다. 새로운 runner·외부 서비스·컨테이너 환경의 동작이나 운영 배포를 보장하지 않는다. main 이미지는 release commit SHA로 새로 만들고 배포 후 별도 health·DB·queue 검증을 따른다. `[skip ci]`는 이미지 workflow까지 막거나 required check를 Pending으로 남길 수 있어 이 재사용 경로에 사용하지 않는다.

공식 동작 참고: [PR checkout과 workflow event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [attempt별 jobs API](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt), [artifact 다운로드](https://github.com/actions/download-artifact), [workflow 건너뛰기](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs).

## API 작업 흐름

| Job                | 역할                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI Scope           | 공식 Octokit pagination으로 누적 변경 범위 계산·동일 tree 검증 증거 확인                                                                                                                                                                                                                                                                                                                                                                                                   |
| Dependency Review  | heavy job과 같은 조건의 PR에서 공식 dependency-review-action으로 gate의 base~head 누적 범위에 high 이상 취약 의존성이 새로 들어오는지 확인                                                                                                                                                                                                                                                                                                                                 |
| Lint, Test & Build | 한 번의 checkout·설치로 Oxc lint/format, `pnpm audit --prod --audit-level high`, Changeset, 컨벤션 검사, `turbo run typecheck --affected`, 테스트 작업을 한 번에 하나씩 도는 `turbo run test test:integration --affected --concurrency=1`, API 범위일 때 API 의존성 closure build. 단위·통합 테스트는 pre-push가 올린 원격 캐시를 재사용하고 놓친 작업만 러너에서 돈다. 계약·E2E 테스트는 CI에서 돌리지 않고 로컬 pre-push(`test:contract`)와 `pnpm test:e2e`에서 실행한다 |
| Docs Check         | 문서만 바뀐 diff(세 범위가 모두 꺼짐)에서 의존성 설치 없이 `node scripts/docs/docs-check.mjs`만 실행. 코드와 함께 바뀐 문서는 Lint, Test & Build의 docs:check가 본다                                                                                                                                                                                                                                                                                                       |
| Build & Push Image | main의 API 영향 변경이며 직접 검증 또는 신뢰된 재사용 증거가 있을 때 ARM64 API/migrate 두 이미지를 같은 SHA로 빌드해 Trivy(HIGH/CRITICAL, 미수정 제외) 검사를 통과한 뒤 발행하고, 공식 `actions/attest`로 두 digest에 빌드 출처 증명을 남김                                                                                                                                                                                                                                |

공식 setup action은 `.nvmrc` Node.js 버전, packageManager의 pnpm 버전, frozen lockfile과 pnpm cache를 사용한다. API만 영향이 있으면 API dependency closure를 설치하고 필요한 contract를 emit한다. GitHub Actions는 버전 주석과 commit SHA로 고정하며 업데이트의 정본은 workflow다.

CI는 PostgreSQL service를 띄우지 않는다. 통합 테스트는 러너의 Docker에서, 계약 테스트는 로컬 훅에서 Testcontainers(또는 `AIDO_TEST_POSTGRES_URL`)로 무작위 `aido_test_<run-id>` DB를 만들고 자신이 만든 DB만 정리한다. 유료 vendor 호출은 기본 테스트에 넣지 않는다.

Turbo 원격 캐시는 `TURBO_TOKEN`·`TURBO_TEAM`으로 로컬과 CI가 같은 팀 캐시를 쓴다(시크릿이 없는 fork PR은 캐시 없이 전부 돈다). `test:integration`·`test:contract`는 `src/**`·`test/**`·`drizzle/**`·설정 파일을 입력으로 캐시되며, 결과에 영향을 주는 `TZ`·`BROADCAST_RECIPIENT_COUNT`는 `env`로 해시에 넣는다. Docker build cache는 도구 기본 경로를 사용한다. gate는 변경 파일 목록만 필요하므로 `filter: blob:none`으로 이력만 받는다.

## 로컬 검증과 완료 기록

작업 중에는 변경한 동작의 target test와 필요한 lint/type/format을 실행하고, source가 바뀌지 않은 성공 검사를 반복하지 않는다. 공개 HTTP·OpenAPI·released-client fingerprint와 실제 DB/transaction 검사는 pre-push 훅(통합·계약 테스트)이 맡고, CI는 같은 캐시로 정적 검사·단위·통합 테스트와 build를 확인한다. 로컬 결과에는 command, source revision, seed, 파일/테스트 수, 실패·재실행 사유와 한계를 남긴다. coverage나 SDK schema 통과를 실제 vendor 품질/운영 배포 완료로 표현하지 않는다.

수동 performance project와 승인된 유료 AI 평가는 일반 CI 밖의 별도 근거다. 배포 승인은 [배포 문서](deployment.md)의 동일 SHA 이미지·마이그레이션·health 절차를 따른다.

## 의존성·이미지 보안 검사

- workflow 기본 권한은 `contents: read`이고 job이 필요한 권한만 더한다. `TURBO_TOKEN`은 turbo를 실행하는 job에만 주입한다.
- 출처 증명은 GitHub attestations API에만 저장하고 registry에는 올리지 않는다(GHCR 버전 보존 개수 유지). `gh attestation verify oci://ghcr.io/aiddoo/aido-platform-api:<sha> --repo Aiddoo/Aido-platform`으로 확인한다.
- CodeQL(actions, JavaScript/TypeScript)은 PR마다 돌리지 않고 기본 브랜치를 주 1회 스캔한다([codeql.yml](../../../.github/workflows/codeql.yml)). schedule은 저장소 기본 브랜치에서만 돌므로 기본 브랜치는 `main`이어야 한다.

- `pnpm audit --prod --audit-level high`가 high 이상 취약점을 막는다. 패치 버전이 없어 위험을 수용한 advisory는 `pnpm-workspace.yaml`의 `auditConfig.ignoreGhsas`에 사유·제거 조건 주석과 함께 둔다. 현재는 `@expo/cli`(Expo 빌드 도구) 내부의 `node-forge`(GHSA-86w9-cpqp-85rv)와 `zod` 3.x(GHSA-mrhx-c7xc-m3w5)이며, `@expo/cli`가 패치된 버전을 받으면 제거한다.
- API/migrate 이미지는 runner에 load한 상태로 Trivy가 먼저 검사하고, 둘 다 고칠 수 있는 HIGH/CRITICAL이 없을 때만 GHCR에 push한다. 검사에 실패하면 그 SHA의 이미지가 발행되지 않으므로 deploy의 이미지 존재 확인(`docker buildx imagetools inspect`)에서 멈춘다.
