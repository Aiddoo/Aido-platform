# 커밋·PR·이슈

## 커밋

- Conventional Commits(`pnpm commit` 권장), 설명은 한국어다. type은 [commitlint](../../commitlint.config.ts)의 `feat`·`fix`·`docs`·`refactor`·`perf`·`test`·`ci`·`chore`다. scope는 `server`·`mobile`·`api`(공유 계약)를 쓰고, 저장소 전체면 생략한다.
- 제목은 사용자나 코드가 무엇이 달라지는지를 문장으로 쓴다(`fix(mobile): 자정이 지나도 위젯이 앱을 열기 전에 새 날짜를 표시한다`). 본문에는 문제·원인·변경과 실제 실행한 검증을 쓴다.
- 커밋 훅(lint-staged, typecheck, build)을 건너뛰지 않는다(`--no-verify` 금지).

## PR

- 본문은 [PR 템플릿](../../.github/PULL_REQUEST_TEMPLATE.md)의 요약·주요 변경·검증을 기본으로 한다. 재현·성능·위험·배포·화면 자료는 필요한 경우만 제목을 더한다.
- 처음 보는 리뷰어(면접관)가 읽고 판단할 수 있게 쓴다. 바꾼 이유와 버린 대안을 적고, 코드 품질 개선은 실제 base/head에서 발췌한 짧은 Before/After 코드와 경로를 붙인다.
- 숫자는 측정한 값만 쓴다(조건·환경 포함). 측정하지 않은 개선율·예상치를 쓰지 않는다. 로컬 통과·merge·운영 배포를 구분해 적는다.
- assignee를 지정한다.

## Stack

- 의존하는 PR은 같은 `stack:<release>` 라벨(예: `stack:1.13.0`)을 단다. 맨 위 tip 하나만 `ci:stack-tip`을 달고, 그 tip이 누적 diff를 검증한다([CI](../server/ci.md#실행-범위), [stack-policy](../../scripts/ci/stack-policy.mjs)). 중간 PR에 `ci:stack-tip`을 달지 않는다.
- 공유 브랜치의 이력을 바꾸는 rebase·force push는 그 stack의 담당 범위에서만 한다.

## 이슈

배경·목표·완료 조건을 적는다. 완료 조건은 확인할 수 있는 동작이나 검사로 쓴다.
