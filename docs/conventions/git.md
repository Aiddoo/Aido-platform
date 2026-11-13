# 커밋·PR·이슈

## 커밋

- Conventional Commits(`pnpm commit` 권장), 설명은 한국어다. 본문 줄은 100자 이하다(commitlint). type은 [commitlint](../../commitlint.config.ts)의 `feat`·`fix`·`docs`·`refactor`·`perf`·`test`·`ci`·`chore`다. scope는 `server`·`mobile`·`api`(공유 계약)를 쓰고, 저장소 전체면 생략한다.
- 제목은 사용자나 코드가 무엇이 달라지는지를 문장으로 쓴다(`fix(mobile): 자정이 지나도 위젯이 앱을 열기 전에 새 날짜를 표시한다`). 본문에는 문제·원인·변경과 실제 실행한 검증을 쓴다. 커밋에 `Co-Authored-By` 트레일러를 넣지 않는다.
- Git 훅은 [lefthook](../../lefthook.yml)이 관리하고 `pnpm install`의 `prepare`가 설치한다. 테스트는 이 훅에서 turbo로 실행해 결과를 팀 원격 캐시에 올린다. CI가 같은 캐시를 재사용하고 놓친 작업만 실제로 돈다.
  - pre-commit: staged 파일에 `oxlint --fix`·`oxfmt --write`를 적용해 다시 stage하고, CI 정책 테스트(`scripts/ci/*.mjs` 변경 시), 문서 검사(`pnpm docs:check`, 커밋마다)와 파일 이름 검사(`apps/api/src`·`packages/api/src`·모바일 `features/`·`app/` 변경 시 `ls-lint`)를 실행한다. 코드 관례는 `oxlint`의 `aido/*` 규칙이 staged 파일에서 본다.
  - pre-push: 코드가 바뀐 push만 `turbo run typecheck test test:node build`, 서버 통합·배포 앱 계약 테스트(`test:integration`·`test:contract`)를 실행한다. 동시 실행 수를 2(통합·계약은 1)로 묶어 맥북 부하를 줄인다. 문서만 바뀐 push와 merge·rebase는 건너뛴다. 입력이 같으면 캐시를 쓰고 결과가 원격 캐시에 올라간다. 통합·계약 테스트는 로컬 Docker(Testcontainers)가 필요하다. 전체 E2E는 `pnpm test:e2e`로 직접 실행하고 PR 본문에 기록한다. CI에서는 돌리지 않는다.
  - commit-msg: commitlint.
- 훅을 건너뛰지 않는다(`--no-verify` 금지). 훅 자체가 고장 난 긴급 상황에서만 `LEFTHOOK=0 git …`을 쓰고, 건너뛴 검사는 바로 수동으로 실행해 PR 검증에 적는다. 특정 job만 빼려면 `LEFTHOOK_EXCLUDE=<job 이름>`을 쓴다.

## PR

- PR은 `main`을 향한다. `develop`은 더 이상 통합 브랜치가 아니다.
- 제목은 커밋과 같은 `type(scope): 문장`이다. stack PR은 문장 앞에 순서를 둔다(`docs(mobile): [1/32] 앱 문서와 경로 규칙을 목표 구조로 다시 쓴다`).
- 본문은 [PR 템플릿](../../.github/PULL_REQUEST_TEMPLATE.md)의 요약·주요 변경·검증을 기본으로 한다. 재현·성능·위험·배포·화면 자료는 필요한 경우만 제목을 더한다. 요약 끝에 `Closes #<이슈>`를 쓰고 stack이면 `· Epic #<에픽>`을 붙인다.
- 주요 변경은 **문제**(파일:줄·측정값), 바꾼 것, **왜 이 설계**(버린 대안 포함) 순서로 쓴다.
- 라벨은 연결한 이슈와 같게 단다(`type:*` 하나, 바뀐 앱마다 `scope:*`, `priority:*`, stack이면 `stack:<release>`).
- 처음 보는 리뷰어(면접관)가 읽고 판단할 수 있게 쓴다. 바꾼 이유와 버린 대안을 적고, 코드 품질 개선은 실제 base/head에서 발췌한 짧은 Before/After 코드와 경로를 붙인다.
- 숫자는 측정한 값만 쓴다(조건·환경 포함). 측정하지 않은 개선율·예상치를 쓰지 않는다. 로컬 통과·merge·운영 배포를 구분해 적는다.
- assignee를 지정한다.

## Stack

- 의존하는 PR은 [`gh stack`](https://github.com/github/gh-stack)으로 쌓고(`gh stack add`·`gh stack submit --auto`) 같은 `stack:<release>` 라벨(예: `stack:1.13.0`)을 단다. 맨 아래 PR만 `main`을 향하고 나머지는 바로 아래 브랜치를 향한다.
- CI는 `main`을 향한 PR과 `main` push에서만 돈다([CI](../../apps/api/docs/ci.md#실행-범위)). 위층의 누적 tree는 tip을 push할 때 pre-push가 검증하고, 합친 뒤 `main` CI가 이미지 발행 전에 다시 검증한다. 각 PR은 혼자 빌드·테스트를 통과하도록 나눈다.
- 아래 층을 고치면 그 브랜치에서 커밋하고 `gh stack rebase --upstack`으로 위층을 다시 쌓는다. 공유 브랜치의 이력을 바꾸는 rebase·force push는 그 stack의 담당 범위에서만 한다.
- 합칠 때는 `gh stack merge --yes`로 stack 전체를 한 번에 `main`에 합친다. `main` push가 한 번이라 운영 배포도 한 번이다(`deploy.yml`은 main CI 성공마다 배포한다).
- 다 합친 뒤 `gh issue list --state open`으로 stack 이슈가 모두 닫혔는지 확인한다. 남은 이슈는 PR 머지 커밋이 `main`에 있는지(`git merge-base --is-ancestor`) 확인하고 PR 링크와 함께 닫는다. 부모 브랜치를 향한 PR의 `Closes #N`은 GitHub가 처리하지 않는다([GitHub 문서](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)).

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

- 제목은 `[Feature]: 대상: 문장` 또는 `[Bug]: 대상: 문제를 고친다`다. 대상은 `앱`·`서버`·`공통`이다. 리팩터·성능·문서도 `[Feature]`이고 종류는 `type:*` 라벨이 말한다.
- 본문은 `### 배경`·`### 목표`·`### 완료 조건`(체크박스)이다. stack 이슈는 `### 진행 방식`에 브랜치(`stack/<release>/NN-slug`), `[n/N]`, Epic 번호를 적는다.
- 라벨은 `type:*` 하나, 바뀌는 앱마다 `scope:*`, `priority:*`, stack이면 `stack:<release>`를 단다. Assignee를 지정한다.
- 릴리스 stack은 Epic 이슈(`[Epic]: <release> 문장`) 하나를 둔다. Epic은 배경·목표·핵심 결정(결정·이유·버린 대안 표)·완료 조건·레이어 이슈 목록(`- [ ] #이슈 [n/N] \`NN-slug\` — 제목`)·진행 방식을 갖는다.
