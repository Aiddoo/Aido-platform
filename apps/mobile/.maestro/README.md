# Maestro E2E

출시 전마다 개발 서버에 붙은 개발 빌드에서 기능별 실제 동작을 확인하는 흐름이다. 운영 서버·운영 앱에는 쓰지 않는다.
업무 규칙은 단위 테스트가 지키고, 여기서는 사용자가 실제로 누르는 핵심 경로만 본다([테스트 가이드](../.claude/testing-guide.md#maestro-e2e)).

## 구조

```
.maestro/
├── config.yaml              작업 공간: flows/**만 찾고 실행 순서를 정한다
├── .env.maestro.example     실행 설정·계정 키 목록 (.env.maestro는 git이 무시한다)
├── flows/<기능>/<사용자-목표>.yaml   테스트 흐름 (기능 = 태그)
├── subflows/<기능>/<동작>.yaml       화면 단위 동작 하나 (env로 값을 받는다)
├── scripts/
│   ├── config.js            MAESTRO_* → output.config, 운영이면 멈춤, 실행마다 runId
│   ├── selectors.js         흐름이 찾는 testID·라벨의 단 하나의 원천 (output.ids, output.labels)
│   ├── api.js               개발 API로 데이터 준비·확인·정리 (output.api.signIn → 세션)
│   ├── accounts.ts          개발 테스트 계정 만들기·되돌리기 (Node, 로컬 DB)
│   └── run-e2e.ts           pnpm e2e* 입구
└── store-screenshots/       스토어·랜딩 화면 캡처 도구 (E2E와 따로 돈다, 자체 README)
```

기능별(feature) 구성과 `flows` 글롭, `subflows/` 분리는 Maestro 문서의 권장 구조를 따른다.
[Repository configuration](https://docs.maestro.dev/maestro-flows/workspace-management/design-your-test-architecture/repository-configuration) ·
[Project configuration](https://docs.maestro.dev/maestro-flows/workspace-management/project-configuration) ·
[Workspace configuration](https://docs.maestro.dev/reference/workspace-configuration) ·
[Nested flows](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/nested-flows)

## 흐름

| 흐름                                   | 태그                                           | 확인하는 것                                                   |
| -------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `auth/sign-in-dev-account`             | smoke, auth                                    | 개발 계정 이메일 로그인 → 피드                                |
| `todo/create-complete-delete`          | smoke, todo                                    | 추가 → 완료 → 삭제, 각 단계가 서버에 반영                     |
| `memo/create-and-edit`                 | smoke, memo                                    | 메모 저장 → 열어 고쳐 저장 → 목록·서버 반영                   |
| `subscription/paywall-open-close`      | smoke, subscription                            | 페이월 열고 결제 없이 닫기 → 피드, 구독 상태 그대로           |
| `category/delete-move-todos`           | regression, category                           | 할 일이 있는 카테고리 삭제 시 고른 카테고리로 옮김            |
| `category/delete-with-todos`           | regression, category                           | 할 일과 함께 삭제 (선택지 testID는 아래 "대기" 참고)          |
| `notification/inbox-opens-screen-once` | regression, notification, needs-second-account | 친구 요청 알림 → 받은 요청 화면 한 번, 읽음 처리              |
| `friends/invite-code-already-friends`  | regression, friends, needs-second-account      | 이미 친구면 환영 시트·수락 기록 없이 친구 피드                |
| `friends/invite-code-happy-path`       | regression, friends, needs-second-account      | 코드 입력 → 초대 카드 → 수락 → 환영 시트, 친구가 됨           |
| `network/offline-fallback-retry`       | regression, network, android-only              | 비행기 모드: 앱 오류 없이 오프라인 안내 → 복구 후 다시 불러옴 |

## 이름과 태그

| 대상          | 규칙                                                                       | 예                                      |
| ------------- | -------------------------------------------------------------------------- | --------------------------------------- |
| 흐름 폴더     | 앱 기능 이름(kebab-case). 폴더 이름을 태그로도 단다                        | `flows/category/`                       |
| 흐름 파일     | 사용자 목표를 동사로(kebab-case). 파일 이름은 작업 공간 전체에서 하나      | `delete-move-todos.yaml`                |
| 흐름 `name`   | 기대 결과를 한국어 한 문장으로                                             | `할 일이 있는 카테고리를 지우면 …`      |
| subflow       | `subflows/<기능>/<동작>.yaml`, 동작 하나 + 끝 상태 확인                    | `subflows/todo/create.yaml`             |
| subflow 입력  | 파일 머리 `# env:` 주석에 적고 UPPER_SNAKE                                 | `CATEGORY_ID`, `TODO_TITLE`             |
| 실행 설정     | `.env.maestro`의 `MAESTRO_` 접두 UPPER_SNAKE                               | `MAESTRO_APP_ID`, `MAESTRO_MAIN_EMAIL`  |
| testID        | `<feature>-<element>[-<action>]`, 목록 행은 끝에 id                        | `todo-add-submit`, `category-delete-42` |
| 테스트 데이터 | `E2E ` 접두 + `output.config.runId`(실행마다 새로), Android 입력이라 ASCII | `E2E todo k3x9a1`                       |

태그는 고르는 기준이다([Test discovery and tags](https://docs.maestro.dev/maestro-flows/workspace-management/test-discovery-and-tags)).

- `smoke`: 몇 분 안에 끝나는 핵심 경로. 출시 빌드마다 먼저 돈다.
- `regression`: 지난 버그·정책 경계. 출시 전에 전체로 돈다.
- 기능 태그(`todo`, `category`, …): `pnpm e2e:feature <태그>`로 그 기능만 돈다.
- `needs-second-account`: `MAESTRO_SECOND_*` 계정이 있어야 한다.
- `android-only`: iOS에서는 본문을 건너뛴다(통과로 표시된다). iOS는 아래 수동 목록으로 본다.

## 개발 서버에 붙이기

1. 개발 서버: `pnpm docker:up`(PostgreSQL) 후 API를 켠다(`http://localhost:8080`).
2. 개발 빌드: `APP_ENV=development`라 앱 ID `com.aido.mobile.dev`, 스킴 `aido-dev`이고 API는 `.env.development`의
   `EXPO_PUBLIC_API_URL`(기본 `http://localhost:8080`)을 쓴다. 시뮬레이터는 `pnpm ios`·`pnpm android` 또는
   EAS `development-simulator` 프로필 빌드를 설치한다. Android 에뮬레이터는 `pnpm adb:reverse`와 `adb reverse tcp:8081 tcp:8081`을 건다.
3. Metro: `pnpm dev`. 흐름은 개발 클라이언트 실행 URL(`exp+aido://?__expo_url=…&__expo_disable_onboarding=1…`)로 Metro 번들에
   붙는다([Development workflows](https://docs.expo.dev/develop/development-builds/development-workflows/)).
4. 계정: `pnpm e2e:accounts create`가 main·second를 실제 가입 API로 만들고 로컬 DB에서 메일 인증만 표시한 뒤
   `.maestro/.env.maestro`에 쓴다(비밀번호는 무작위, 출력하지 않는다). 처음이면 `cp .maestro/.env.maestro.example .maestro/.env.maestro`.

안전장치: `config.js`는 앱 ID가 운영(`com.aido.mobile`)이거나 `MAESTRO_API_URL`이 http 로컬·사설망 주소가 아니면 첫 요청 전에 멈춘다.
`accounts.ts`는 API·DB가 로컬이 아니거나 DB 이름에 `prod`가 있으면 멈춘다.

## 실행

```bash
pnpm --filter @aido/mobile e2e                    # 전체
pnpm --filter @aido/mobile e2e:smoke              # smoke만
pnpm --filter @aido/mobile e2e:feature category   # 한 기능(태그)만
pnpm --filter @aido/mobile e2e --device <udid> --exclude-tags android-only
pnpm --filter @aido/mobile e2e:accounts reset     # 초대 수락 기록·두 계정 사이 친구 알림 지우기 (e2e가 시작할 때 자동으로 부른다)
```

`run-e2e.ts`는 `.env.maestro`를 환경으로 올리고(Maestro가 `MAESTRO_*`를 바로 읽어 비밀번호가 `-e` 인자에 남지 않는다,
[Parameters and constants](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/parameters-and-constants)), second 계정이 있으면
`accounts.ts reset`을 먼저 부르고, 결과를 `maestro-output/<시각>/`(git이 무시한다)에 HTML 보고서와 함께 모은다
([Test reports and artifacts](https://docs.maestro.dev/maestro-flows/workspace-management/test-reports-and-artifacts)).
산출물에는 입력한 비밀번호가 남을 수 있으니 공유하지 않는다.

직접 돌릴 때(또는 Claude Code의 Maestro MCP `run`)는 같은 값을 환경으로 준다.

```bash
set -a; source apps/mobile/.maestro/.env.maestro; set +a
maestro test --test-output-dir apps/mobile/maestro-output apps/mobile/.maestro/flows/todo/create-complete-delete.yaml
maestro check-syntax apps/mobile/.maestro/flows/todo/create-complete-delete.yaml   # 기기 없이 문법만
```

iOS 시뮬레이터는 영어 키보드를 첫 번째로 둔다. 병음·한글 입력기가 앞에 있으면 Maestro가 넣은 영문이 조합 중으로 남아 이메일 형식 오류나
저장되지 않은 메모로 실패한다. 알림 권한은 iOS 시뮬레이터에서 미리 줄 수 없어 새 계정은 로그인 뒤 알림 안내 화면이 뜨고, 로그인 subflow가 닫는다.

```bash
xcrun simctl spawn <udid> defaults write -g AppleKeyboards -array "en_US@sw=QWERTY;hw=Automatic" "ko_KR@sw=Korean;hw=Automatic" "emoji@sw=Emoji"
xcrun simctl shutdown <udid> && xcrun simctl boot <udid>
```

Maestro MCP(`maestro mcp`)로 기기를 볼 때는 `inspect_screen`으로 testID가 화면 트리에 있는지 확인하고 `take_screenshot`으로 상태를 남긴다
([Maestro MCP](https://docs.maestro.dev/get-started/maestro-mcp)).

## 흐름 하나의 모양

```yaml
appId: ${MAESTRO_APP_ID}
name: 할 일을 추가하고 완료한 뒤 지운다
tags: [smoke, todo]
onFlowStart:
  - runFlow: ../../subflows/app/load-helpers.yaml # config → selectors → api
  - evalScript: ${output.main = output.api.signIn('main')} # 데이터 준비는 API 한 줄씩
  - runFlow: ../../subflows/app/launch-fresh.yaml # clearState + 개발 클라이언트 연결
onFlowComplete:
  - evalScript: ${output.main && output.main.removeE2eCategories()} # 실패해도 정리
---
# Given / When / Then 한국어 주석 아래에 subflow와 확인만 둔다
```

- 시작 상태는 `onFlowStart`의 `launchApp: clearState`(iOS는 `clearKeychain`)와 API 준비로 만든다. 다른 흐름이 남긴 상태에 기대지 않는다
  ([Hooks](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/hooks), [Sequential execution](https://docs.maestro.dev/maestro-flows/workspace-management/sequential-execution)).
- 기다림은 `extendedWaitUntil`·`assertVisible`과 명시 timeout이다. 고정 sleep을 쓰지 않는다. 서버 반영은 `api.js`의 `waitFor*`가 기다린다.
- `retry`는 네트워크처럼 본래 흔들리는 단계에만 쓴다. 흐름 큰 덩어리를 감싸지 않는다.
- 플랫폼 차이는 `runFlow: when: platform:`으로 나눈다. 권한은 `launchApp`의 `permissions`로 미리 정해 시스템 창을 누르지 않는다.
- 화면 결과는 UI로, 저장 결과는 `assertTrue`+API로 확인한다([assertTrue](https://docs.maestro.dev/reference/commands-available/asserttrue),
  [Make HTTP requests](https://docs.maestro.dev/maestro-flows/javascript/make-http-requests),
  [Manage data and states](https://docs.maestro.dev/maestro-flows/javascript/manage-data-and-states)).
- `${…}` 안에는 `$`를 쓸 수 없고, YAML 평문이라 `: `가 들어간 객체 리터럴을 쓰지 않는다. 그런 계산은 `api.js` 메서드로 둔다.

## 흐름 추가하기

1. 사용자 목표 하나를 정한다. 업무 규칙 분기는 단위 테스트로 보내고 여기는 핵심 경로만 둔다.
2. 필요한 화면 요소에 testID가 없으면 해당 컴포넌트에 `<feature>-<element>[-<action>]`로 하나만 단다(React Native `testID`는 Maestro `id`로 찾는다,
   [React Native](https://docs.maestro.dev/get-started/supported-platform/react-native)). 네이티브 헤더 툴바 버튼은 testID를 받지 않아 `output.labels`의 접근성 라벨을 쓴다.
3. `scripts/selectors.js`에 id를 더한다.
4. 여러 흐름이 쓰거나 화면 단위 동작이면 `subflows/<기능>/<동작>.yaml`로 만들고 `# env:`에 입력을 적는다.
5. `flows/<기능>/<목표>.yaml`을 위 모양으로 쓰고 기능 태그와 `smoke`/`regression`을 단다.
6. `maestro check-syntax <파일>`로 문법을 확인하고, 개발 빌드에서 `pnpm e2e:feature <태그>`로 돌린다.

## 화면이 바뀌면

| 바뀐 것                         | 고칠 곳                                 |
| ------------------------------- | --------------------------------------- |
| testID 이름·위치                | `scripts/selectors.js`                  |
| 동작 순서(시트 단계, 버튼 추가) | 그 동작의 `subflows/<기능>/<동작>.yaml` |
| 서버 경로·응답 모양             | `scripts/api.js`                        |
| 기대 결과(제품 정책)            | 그 흐름의 Then                          |

## 빌드에 들어가지 않는 이유

- Metro는 진입점에서 import한 파일만 묶는다. `.maestro/`는 앱 코드가 import하지 않는다(`src/`·`app/`에 참조 없음).
- EAS Build 업로드에서는 루트 `.easignore`가 `/apps/mobile/.maestro/`와 `/apps/mobile/maestro-output/`을 뺀다
  ([.easignore](https://docs.expo.dev/build-reference/easignore/), [Project upload](https://docs.expo.dev/build-reference/project-upload/)).
- EAS Workflows의 `type: maestro` job은 `flow_path`를 체크아웃한 프로젝트에서 읽는다
  ([Run E2E tests](https://docs.expo.dev/eas/workflows/examples/e2e-tests/), [Pre-packaged jobs](https://docs.expo.dev/eas/workflows/pre-packaged-jobs/#maestro)).
  지금은 workflow가 없고(비용·Actions 최소화) 흐름이 로컬 DB를 쓰는 `accounts.ts`와 로컬 개발 서버에 기대므로 클라우드 job에 맞지 않아 빼 둔다.
  workflow를 더할 때 `eas workflow:run`은 `.easignore`를 따른 압축본을 올리므로 이 줄을 지우고 `flow_path: ./.maestro/flows`로 잡는다.

## 자동화하지 않는 것 (수동 확인)

Maestro는 기기 밖 서비스와 시간 경과를 흉내 내지 못한다. 출시 전 실기기에서 확인한다.

| 항목                                | 확인 방법                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 실제 푸시 도착(APNs·FCM)            | 실기기 개발 빌드 로그인 → 다른 계정이 친구 요청·찌르기 → 잠금 화면 배너·소리 → 눌러 해당 화면 한 번 열림 |
| 앱이 꺼진 상태의 푸시 열기          | 앱 종료 → 푸시 탭 → 콜드 스타트로 해당 화면, 알림함 읽음                                                 |
| 푸시 권한 거부·설정 문구            | 시스템 설정에서 알림 끄기 → 알림 설정 화면 안내 문구·설정 열기 버튼                                      |
| iOS 오프라인                        | 실기기 비행기 모드 → 오프라인 안내·조회 오류 카드 → 복구 후 다시 시도                                    |
| 카카오톡·시스템 공유 시트           | 초대 화면 공유 → 문구·링크가 열리는지                                                                    |
| https 초대 링크(`aido.kr/i/<코드>`) | 운영 빌드에서만 열린다(AASA·assetlinks에 운영 앱만 등록)                                                 |
| 실제 스토어 결제                    | 샌드박스 계정으로 구독 → 영수증·복원                                                                     |
| 위젯·홈 화면 빠른 동작              | 기기 홈 화면에서 위젯 추가·누르기                                                                        |

## 다른 곳에서 확인하는 것

1.13.0 초대 흐름 중 아래 실패 변형은 업무 규칙이라 서버·앱 단위 테스트가 지키고, Maestro에서는 지웠다(git 이력에 있다).
코드 형식 오류, 없는 코드(INVITE_2101), 바뀐 링크(INVITE_2102), 본인 초대(INVITE_2103), 다른 초대 수락 뒤(INVITE_2104), 서버 플래그 꺼짐(INVITE_2105),
친구 한도(INVITE_2106·REQUESTED), 로그인 보류 이어 가기·다른 계정, 친구 끊은 뒤 재수락, 진입점 3곳, 내 초대 공유·발자국 판, 보상 프리미엄 영수증,
친구 줄 전환, 아바타·날짜 복귀.

## 버전

Maestro CLI 2.12.1(Homebrew `mobile-dev-inc/tap/maestro`). 최신 안정판 확인: `brew info mobile-dev-inc/tap/maestro`,
[CHANGELOG](https://github.com/mobile-dev-inc/maestro/blob/main/CHANGELOG.md), 업데이트: [Update the Maestro CLI](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli/update-the-maestro-cli).
흐름 문법은 설치된 CLI의 명령 표면(Maestro MCP cheat sheet)과 `maestro check-syntax`를 기준으로 한다.
