# 서버 CI

PR 또는 배포 검증을 준비할 때 참고한다. 정본은 [ci.yml](../../.github/workflows/ci.yml), [setup action](../../.github/actions/setup/action.yml), [CI policy](../../scripts/ci/stack-policy.mjs), [dependency scope](../../scripts/ci/dependency-scope.mjs)다.

## 실행 범위

일반 PR은 ready일 때 검사한다. Draft와 중간 stack PR의 heavy job은 미룬다. 열린 stack에서 `ci:stack-tip`을 가진 하나의 ready tip이 현재 base와 ancestor를 포함한 누적 diff를 검증한다. 오래된 workflow head나 누락 ancestor는 실패시켜 재정렬 후 현재 head에서 다시 실행한다.

`apps/api`, migration tooling, production compose/deploy 변경은 API 범위다. `packages/api` 공개 계약은 API와 모바일·공유 검증에 영향을 준다. Markdown/docs-only 변경은 heavy 범위에서 제외된다. 불명확한 diff는 전체 범위로 fallback한다. CI 정책 테스트는 공식 GitHub script/Octokit action 안에서 Node test runner로 실행한다.

## API 작업 흐름

| Job                | 역할                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| CI Scope           | 공식 Octokit pagination으로 현재 PR/stack과 누적 변경 범위 계산                                  |
| Lint & Type Check  | Oxc lint/format 한 번, 영향 범위 typecheck                                                       |
| Verify API         | API unit+coverage 한 번→PostgreSQL Integration→HTTP/released-client E2E→API 의존성 closure build |
| Build & Push Image | main의 API 영향 변경이며 필요한 job 성공 시 ARM64 API/migrate 두 이미지를 같은 SHA로 발행        |

공식 setup action은 `.nvmrc` Node.js 버전, packageManager의 pnpm 버전, frozen lockfile과 pnpm cache를 사용한다. API만 영향이 있으면 API dependency closure를 설치하고 필요한 contract를 emit한다. GitHub Actions는 버전 주석과 commit SHA로 고정하며 업데이트의 정본은 workflow다.

PostgreSQL 16 service는 GitHub가 시작·health check·정리한다. 테스트 helper는 `AIDO_TEST_POSTGRES_URL`을 administration 연결로 사용해 무작위 `aido_test_<run-id>` DB를 만들고 자신이 만든 DB만 정리한다. 업무 DB용 `DATABASE_URL`을 administration URL로 재사용하지 않는다. 잘못된 생성 이름·service URL을 거부하고 시작·migration 실패 시에도 resource와 환경을 정리한다. 로컬에서는 해당 변수를 생략하면 Testcontainers 수명주기를 사용한다. 테스트용 인증 값은 fixture이며 운영 접근용 값이 아니다. 준비된 HTTP fixture는 실제 SDK/library를 통해 schema·실패 계약을 검사하고 유료 vendor 호출을 CI 기본값으로 두지 않는다.

API test 로그는 실패 시 upload-artifact로 14일 보관한다. Bash의 `-eo pipefail`로 tee 뒤 실패도 유지한다. Turbo와 Docker build cache는 도구 기본 경로를 사용한다. API unit을 coverage 전후로 중복 실행하거나 source-scan gate를 새로 만들지 않는다.

## 로컬 검증과 완료 기록

작업 중에는 변경한 동작의 target test와 필요한 lint/type/format을 실행하고, source가 바뀌지 않은 성공 검사를 반복하지 않는다. 최종 누적 CI는 공개 HTTP·OpenAPI·released-client fingerprint, 실제 DB/transaction 및 build를 함께 검사한다. 로컬 결과에는 command, source revision, seed, 파일/테스트 수, 실패·재실행 사유와 한계를 남긴다. coverage나 SDK schema 통과를 실제 vendor 품질/운영 배포 완료로 표현하지 않는다.

수동 performance project와 승인된 유료 AI 평가는 일반 CI 밖의 별도 근거다. 배포 승인은 [DEPLOYMENT.md](../../apps/api/DEPLOYMENT.md)의 동일 SHA 이미지·graph·health 절차를 따른다.
