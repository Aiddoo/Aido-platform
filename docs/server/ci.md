# 서버 CI

PR 또는 배포 검증을 준비할 때 참고한다. 정본은 [ci.yml](../../.github/workflows/ci.yml), [setup action](../../.github/actions/setup/action.yml), [CI policy](../../scripts/ci/stack-policy.mjs), [dependency scope](../../scripts/ci/dependency-scope.mjs)다.

## 실행 범위

일반 PR은 ready일 때 검사한다. Draft와 중간 stack PR의 heavy job은 미룬다. 열린 stack에서 `ci:stack-tip`을 가진 하나의 ready tip이 현재 base와 ancestor를 포함한 누적 diff를 검증한다. 오래된 workflow head나 누락 ancestor는 실패시켜 재정렬 후 현재 head에서 다시 실행한다.

`apps/api`, migration tooling, production compose/deploy 변경은 API 범위다. `packages/api` 공개 계약은 API와 모바일·공유 검증에 영향을 준다. Markdown/docs-only 변경은 heavy 범위에서 제외된다. 불명확한 diff는 전체 범위로 fallback한다. CI 정책 테스트는 공식 GitHub script/Octokit action 안에서 Node test runner로 실행한다. 중간 PR에도 workflow/run 또는 skipped job 메타데이터는 생길 수 있으므로, 비용 기록에서는 실제 검증 job 실행과 구분한다.

## 동일 source 검증 재사용

최종 ready stack tip에서 heavy job을 실행하고, develop landing과 main release의 Git tree가 같으면 그 성공 결과를 재사용한다. Commit SHA가 달라져도 파일·파일 모드·경로를 포함한 tree가 같아야 한다. CI 정책·workflow·lockfile 변경도 tree에 포함되므로 새 source는 이전 결과를 재사용할 수 없다.

PR의 head `H`와 실제 checkout한 merge commit `P`는 별개다. 후보 artifact `ci-tree-proof-<run-id>-<attempt>`에 `H`, `P`, `git rev-parse HEAD^{tree}`, repository, run/attempt, PR 번호, stack label, base/ancestor, API·mobile·shared 범위와 `cumulative-stack-tip` 정책을 기록한다. `P`와 `H`의 tree가 같은 경우에만 후보를 발행하며, heavy job 실행 전 업로드된 artifact 자체는 성공 증거가 아니다.

main·develop gate는 같은 저장소·CI workflow의 성공 PR run에서 후보를 찾고, 공식 download-artifact와 `actions: read` 권한으로 해당 run의 정확한 artifact를 다운로드한다. 재사용 전에 다음 조건을 독립적으로 확인한다.

- 원본 run은 현재 attempt에서 `completed/success`이고, 해당 PR은 같은 저장소의 ready stack tip이며 head가 `H`로 유지된다. 일반 PR·fork·중간 PR의 결과는 사용하지 않는다.
- 공식 attempt별 jobs API에서 `Lint & Type Check`와 증거 범위에 필요한 `Verify API`, `Test - Mobile & Contracts`가 실제 `completed/success`여야 한다. skipped job은 성공 검증을 대신하지 않는다. 조회 후 원본 run의 attempt를 다시 확인한다.
- Artifact는 해당 run/attempt의 유일한 이름·메타데이터와 일치하고 만료되지 않아야 한다. 다운로드 digest 검증 실패도 재사용을 거부한다.
- 원본 `P`, `H`와 현재 checkout의 tree가 같고 현재 commit이 `H`를 포함해야 한다. 현재 변경 범위는 증거가 검증한 API·mobile·shared 범위에 모두 포함되어야 한다.

조건이 맞으면 gate의 `validation_reused=true`와 원본 run URL을 summary에 남기고 현재 heavy job을 건너뛴다. main의 API 변경은 이 신뢰된 결과로 이미지 build/push를 계속 실행한다. heavy job이 단지 skipped인 것만으로 이미지 발행을 허용하지 않는다.

증거가 없거나 만료·불일치·API 조회/다운로드 실패이면 현재 범위의 실제 검증으로 돌아간다. 후보 검색은 최근 성공 PR run 100개 중 앞 20개로 제한하므로 범위 밖 증거도 이 fallback에 해당한다. `workflow_dispatch`는 재사용하지 않고 전체 검증을 실행한다. 같은 source의 성공 증거가 유지되는 정상 경로에서 heavy 검증은 tip 한 번이며, source 변경·증거 소실·수동 실행에서는 추가 검증이 필요하다.

Git tree 증거는 파일과 검증 범위에 관한 근거다. 새로운 runner·외부 서비스·컨테이너 환경의 동작이나 운영 배포를 보장하지 않는다. main 이미지는 release commit SHA로 새로 만들고 배포 후 별도 health·DB·queue 검증을 따른다. `[skip ci]`는 이미지 workflow까지 막거나 required check를 Pending으로 남길 수 있어 이 재사용 경로에 사용하지 않는다.

공식 동작 참고: [PR checkout과 workflow event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [attempt별 jobs API](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt), [artifact 다운로드](https://github.com/actions/download-artifact), [workflow 건너뛰기](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs).

## API 작업 흐름

| Job                | 역할                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| CI Scope           | 공식 Octokit pagination으로 누적 변경 범위 계산·동일 tree 검증 증거 확인                                           |
| Lint & Type Check  | Oxc lint/format 한 번, 영향 범위 typecheck                                                                         |
| Verify API         | API unit+coverage 한 번→PostgreSQL Integration→HTTP/released-client E2E→API 의존성 closure build                   |
| Build & Push Image | main의 API 영향 변경이며 직접 검증 또는 신뢰된 재사용 증거가 있을 때 ARM64 API/migrate 두 이미지를 같은 SHA로 발행 |

공식 setup action은 `.nvmrc` Node.js 버전, packageManager의 pnpm 버전, frozen lockfile과 pnpm cache를 사용한다. API만 영향이 있으면 API dependency closure를 설치하고 필요한 contract를 emit한다. GitHub Actions는 버전 주석과 commit SHA로 고정하며 업데이트의 정본은 workflow다.

PostgreSQL 16 service는 GitHub가 시작·health check·정리한다. 테스트 helper는 `AIDO_TEST_POSTGRES_URL`을 administration 연결로 사용해 무작위 `aido_test_<run-id>` DB를 만들고 자신이 만든 DB만 정리한다. 업무 DB용 `DATABASE_URL`을 administration URL로 재사용하지 않는다. 잘못된 생성 이름·service URL을 거부하고 시작·migration 실패 시에도 resource와 환경을 정리한다. 로컬에서는 해당 변수를 생략하면 Testcontainers 수명주기를 사용한다. 테스트용 인증 값은 fixture이며 운영 접근용 값이 아니다. 준비된 HTTP fixture는 실제 SDK/library를 통해 schema·실패 계약을 검사하고 유료 vendor 호출을 CI 기본값으로 두지 않는다.

API test 로그는 실패 시 upload-artifact로 14일 보관한다. Bash의 `-eo pipefail`로 tee 뒤 실패도 유지한다. Turbo와 Docker build cache는 도구 기본 경로를 사용한다. API unit을 coverage 전후로 중복 실행하거나 source-scan gate를 새로 만들지 않는다.

## 로컬 검증과 완료 기록

작업 중에는 변경한 동작의 target test와 필요한 lint/type/format을 실행하고, source가 바뀌지 않은 성공 검사를 반복하지 않는다. 최종 누적 CI는 공개 HTTP·OpenAPI·released-client fingerprint, 실제 DB/transaction 및 build를 함께 검사한다. 로컬 결과에는 command, source revision, seed, 파일/테스트 수, 실패·재실행 사유와 한계를 남긴다. coverage나 SDK schema 통과를 실제 vendor 품질/운영 배포 완료로 표현하지 않는다.

수동 performance project와 승인된 유료 AI 평가는 일반 CI 밖의 별도 근거다. 배포 승인은 [DEPLOYMENT.md](../../apps/api/DEPLOYMENT.md)의 동일 SHA 이미지·graph·health 절차를 따른다.
