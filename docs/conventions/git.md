# 커밋·PR·이슈

## 커밋

- Conventional Commits(`pnpm commit` 권장), 설명은 한국어다. 본문 줄은 100자 이하다(commitlint). type은 [commitlint](../../commitlint.config.ts)의 `feat`·`fix`·`docs`·`refactor`·`perf`·`test`·`ci`·`chore`다. scope는 `server`·`mobile`·`api`(공유 계약)를 쓰고, 저장소 전체면 생략한다.
- 제목은 사용자나 코드가 무엇이 달라지는지를 문장으로 쓴다(`fix(mobile): 자정이 지나도 위젯이 앱을 열기 전에 새 날짜를 표시한다`). 본문에는 문제·원인·변경과 실제 실행한 검증을 쓴다.
- Git 훅은 [lefthook](../../lefthook.yml)이 관리하고 `pnpm install`의 `prepare`가 설치한다. 테스트는 GitHub Actions에서 돌리지 않고 이 훅에서만 실행한다.
  - pre-commit: staged 파일에 `oxlint --fix`·`oxfmt --write`를 적용해 다시 stage하고, CI 정책 테스트(`scripts/ci/*.mjs` 변경 시)를 실행한다.
  - pre-push: `turbo run typecheck test build`(캐시 사용), 서버 통합 테스트(`pnpm test:integration`), 배포 앱 계약 테스트(`pnpm --filter @aido/server test:contract`)를 차례로 실행한다. 통합·계약 테스트는 로컬 Docker PostgreSQL이 필요하다. 전체 E2E는 `pnpm test:e2e`로 직접 실행한다.
  - commit-msg: commitlint.
- 훅을 건너뛰지 않는다(`--no-verify` 금지). 훅 자체가 고장 난 긴급 상황에서만 `LEFTHOOK=0 git …`을 쓰고, 건너뛴 검사는 바로 수동으로 실행해 PR 검증에 적는다. 특정 job만 빼려면 `LEFTHOOK_EXCLUDE=<job 이름>`을 쓴다.

## PR

- PR은 `main`을 향한다. `develop`은 더 이상 통합 브랜치가 아니다.
- 본문은 [PR 템플릿](../../.github/PULL_REQUEST_TEMPLATE.md)의 요약·주요 변경·검증을 기본으로 한다. 재현·성능·위험·배포·화면 자료는 필요한 경우만 제목을 더한다.
- 처음 보는 리뷰어(면접관)가 읽고 판단할 수 있게 쓴다. 바꾼 이유와 버린 대안을 적고, 코드 품질 개선은 실제 base/head에서 발췌한 짧은 Before/After 코드와 경로를 붙인다.
- 숫자는 측정한 값만 쓴다(조건·환경 포함). 측정하지 않은 개선율·예상치를 쓰지 않는다. 로컬 통과·merge·운영 배포를 구분해 적는다.
- assignee를 지정한다.

## Stack

- 의존하는 PR은 같은 `stack:<release>` 라벨(예: `stack:1.13.0`)을 단다. 맨 위 tip 하나만 `ci:stack-tip`을 달고, 그 tip이 누적 diff를 검증한다([CI](../../apps/api/docs/ci.md#실행-범위), [stack-policy](../../scripts/ci/stack-policy.mjs)). 중간 PR에 `ci:stack-tip`을 달지 않는다.
- 공유 브랜치의 이력을 바꾸는 rebase·force push는 그 stack의 담당 범위에서만 한다.

## 버전

릴리스 버전은 하나다. 앱 버전(`apps/mobile/package.json`)을 올리면 서버(`@aido/server`)·공유 계약(`@aido/api`)도 같은 버전이 된다. 스토어 1.14.0과 Swagger·CHANGELOG 1.14.0이 같은 릴리스를 가리킨다.

| 대상                                        | 버전 출처                                                                | 올리는 방법                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 앱(`@aido/mobile`)                          | `apps/mobile/package.json`의 `version`. `app.config.ts`가 이 값을 읽는다 | 스토어 릴리스마다 직접 올린다. 빌드 번호는 EAS remote가 관리한다                                                   |
| 서버(`@aido/server`)·공유 계약(`@aido/api`) | 앱 버전                                                                  | 릴리스 PR의 `pnpm version-packages`가 앱 버전으로 맞춘다([sync-versions](../../scripts/release/sync-versions.mjs)) |

- 서버나 계약을 바꾸는 PR은 `pnpm changeset`으로 변경 파일(`.changeset/*.md`)을 함께 올린다. 변경 파일은 CHANGELOG 항목이 되며, 계약에 필드·엔드포인트를 더하면 minor, 동작 수정은 patch, `/v{n}` 제거처럼 구 앱을 깨는 변경은 major로 적어 변경 성격을 남긴다.
- 릴리스 stack의 마지막 PR에서 앱 버전을 올린 뒤 `pnpm version-packages`를 실행한다. `changeset version`이 변경 파일을 CHANGELOG로 소비하고, 이어서 서버·계약 버전과 CHANGELOG 제목을 앱 버전으로 맞춘다. 비공개 패키지라 npm에 배포하거나 태그를 만들지 않는다.
- 서버만 고치는 핫픽스도 앱과 같은 patch 버전(예: 1.14.1)으로 릴리스한다. 스토어 배포가 없는 버전은 앱 빌드를 올리지 않는다.
- Swagger 문서 버전은 서버 `package.json`의 `version`을 그대로 보여 준다.

## 이슈

배경·목표·완료 조건을 적는다. 완료 조건은 확인할 수 있는 동작이나 검사로 쓴다.
