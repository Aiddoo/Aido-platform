# Maestro E2E

출시 전마다 개발 서버에 붙은 개발 빌드에서 기능별 실제 동작을 확인할 때 읽는다. 운영 서버·운영 앱에는 쓰지 않는다.
업무 규칙은 단위 테스트가 지키고, 여기서는 사용자가 실제로 누르는 핵심 경로와 지난 엣지만 본다([테스트 가이드](../docs/testing.md)).

## 구조

| 자리                              | 무엇                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `config.yaml`                     | 작업 공간. `flows/**`만 테스트로 찾고 순서가 필요한 흐름을 `flowsOrder`에 둔다                 |
| `flows/<기능>/<동작>-<결과>.yaml` | 흐름 하나 = 지키는 것 하나                                                                     |
| `subflows/<기능>/<동작>.yaml`     | 두 흐름 이상이 되풀이하는 화면 동작. 한 흐름만 쓰면 그 흐름 안에 둔다                          |
| `scripts/*.js`                    | 흐름 안에서 Maestro가 돌리는 JS(GraalJS, `runScript`): `config.js` → `selectors.js` → `api.js` |
| `scripts/*.ts`                    | Node로 돌리는 도구(`package.json`의 `e2e*`): `run-e2e.ts`, `accounts.ts`                       |
| `push/<이름>.json`                | 시뮬레이터 푸시 payload 템플릿(서버 푸시 data 모양)                                            |
| `store-screenshots/`              | 스토어·랜딩 캡처 도구([자체 README](store-screenshots/README.md))                              |

두 런타임을 확장자로 나눈다. `scripts/` 폴더 이름은 루트 `.oxlintrc.json`과 `apps/mobile/tsconfig.json`이 `.maestro/**/scripts/*`로 잡아 그대로 둔다.
`store-screenshots/`는 Release 빌드(`com.aido.mobile`)·캡처 계정(`MAESTRO_QA_*`)·찍기 전 대기가 달라 이 작업 공간의 하위 흐름·도우미를 쓰지 않는다(`config.js`가 운영 앱 ID를 거부한다).
구성은 Maestro 문서의 권장을 따른다([Repository configuration](https://docs.maestro.dev/maestro-flows/workspace-management/design-your-test-architecture/repository-configuration),
[Workspace configuration](https://docs.maestro.dev/reference/workspace-configuration), [Nested flows](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/nested-flows)).

## 흐름

`flows/` 아래 경로다(`app/` 폴더만 앱의 `app/` 경로와 헷갈리지 않게 `flows/`를 붙여 적는다).

| 흐름                                           | 태그(기능 태그 뒤)                               | 지키는 것                                                         |
| ---------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| `auth/email-sign-in-opens-feed`                | smoke                                            | 개발 계정 이메일 로그인 → 피드                                    |
| `todo/create-complete-delete-saves`            | smoke                                            | 추가 → 완료 → 삭제, 단계마다 서버 반영                            |
| `memo/create-edit-saves`                       | smoke                                            | 메모 저장 → 고쳐 저장 → 목록·서버 반영                            |
| `subscription/paywall-close-keeps-plan`        | smoke                                            | 페이월을 결제 없이 닫으면 피드, 구독 상태 그대로                  |
| `todo/create-double-tap-saves-once`            | regression                                       | 저장 연타에도 서버에 할 일 하나                                   |
| `todo/complete-toggle-matches-server`          | regression                                       | 체크박스가 바로 바뀌고 연타 뒤에도 화면 = 서버                    |
| `todo/complete-offline-rolls-back`             | regression, android-only                         | 비행기 모드 완료 → 연결 안내 + 되돌림, 서버 그대로 → 연결 뒤 완료 |
| `todo-import/import-undo-removes-todos`        | regression, ios-only                             | 캘린더 앱에 심은 일정 가져오기 → 할 일 생김 → 되돌리기 → 사라짐   |
| `todo-import/permission-denied-shows-settings` | regression, ios-only                             | 캘린더 거절이면 설정 열기만, 계속 없음                            |
| `comment/write-and-like-saves`                 | regression, needs-second-account                 | 친구 할 일에 댓글 → 목록·서버, 친구 댓글 하트 → 바로 켜짐·서버    |
| `category/delete-moves-todos`                  | regression                                       | 할 일이 든 카테고리 삭제 시 고른 카테고리로 옮김                  |
| `category/delete-removes-todos`                | regression                                       | 할 일과 함께 삭제                                                 |
| `friend/add-double-tap-sends-once`             | regression, needs-second-account                 | 친구 추가 연타에도 중복 요청 안내 없이 요청 하나                  |
| `invite/already-friend-skips-reward`           | regression, needs-second-account                 | 이미 친구면 환영 시트·수락 기록 없이 친구 피드                    |
| `invite/code-redeem-makes-friends`             | regression, needs-second-account                 | 코드 입력 → 초대 카드 → 수락 → 환영 시트, 친구가 됨               |
| `notification/inbox-item-opens-once`           | regression, needs-second-account                 | 알림함 친구 요청 → 받은 요청 화면 한 번, 읽음                     |
| `notification/permission-off-shows-guide`      | regression                                       | 기기 알림 꺼짐 안내 + 켜는 버튼, iOS 거절 뒤 설정 열기            |
| `notification/push-background-opens-once`      | regression, push, ios-only, needs-second-account | 뒤에 있는 앱에 시뮬레이터 푸시 → 받은 요청 화면 한 번, 읽음       |
| `notification/push-cold-start-opens-screen`    | regression, push, ios-only, needs-second-account | 꺼진 앱에 시뮬레이터 푸시 → 콜드 스타트로 그 화면, 읽음           |
| `report/free-shows-sample-and-paywall`         | regression                                       | 무료 리포트: 이번 주 기록 + 예시 → 예시 상세 → 페이월             |
| `weather/location-allowed-shows-report`        | regression                                       | 위치 허용 + 서울 좌표 → 앱 오류 없이 날씨 요약                    |
| `weather/location-denied-shows-guide`          | regression                                       | 위치 없음 → 위치 안내(iOS 설정 열기, Android 계속)                |
| `flows/app/offline-shows-banner-and-reloads`   | regression, android-only                         | 비행기 모드: 오프라인 안내 → 복구 후 다시 불러옴                  |
| `flows/app/background-keeps-draft`             | regression                                       | 저장 전 메모를 쓰다 홈 → 돌아오면 화면·글 그대로                  |
| `flows/app/relaunch-keeps-session`             | regression                                       | 앱을 끄고(Android는 killApp도) 다시 열면 피드                     |

## 이름과 태그

| 대상          | 규칙                                                                                                                      | 예                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 흐름 폴더     | 앱 기능 폴더 이름(`src/features/*/<기능>`). 앱 전체(실행·네트워크)는 `app`. 폴더 이름을 태그로도 단다                     | `flows/todo-import/`                    |
| 흐름 파일     | `<동작>-<결과>` kebab-case, 결과는 3인칭 동사(saves·opens·keeps). 작업 공간 전체에서 하나                                 | `delete-moves-todos.yaml`               |
| 흐름 `name`   | "…하면 …한다" 한 문장. `flowsOrder`가 이 이름으로 찾는다                                                                  | `할 일이 있는 카테고리를 지우며 …`      |
| 하위 흐름     | `subflows/<기능>/<동작>.yaml`, 입력은 머리 `# env:` 주석의 UPPER_SNAKE                                                    | `subflows/todo/write-new.yaml`          |
| 실행 설정     | `.env.maestro`의 `MAESTRO_` 접두 UPPER_SNAKE                                                                              | `MAESTRO_APP_ID`, `MAESTRO_MAIN_EMAIL`  |
| testID        | `<feature>-<element>[-<action>]`, 목록 행은 끝에 id                                                                       | `todo-add-submit`, `category-delete-42` |
| API 도우미    | 준비 `create*`·`send*`·`accept*`·`complete*`, 정리 `remove*`, 조회 `find*`, 확인 `has*`·`is*`·`count*`, 기다림 `waitFor*` | `waitForTodo`                           |
| 테스트 데이터 | `E2E ` 접두 + `output.config.runId`(실행마다 새로), Android 입력이라 ASCII                                                | `E2E todo k3x9a1`                       |

- `smoke`: 몇 분 안에 끝나는 핵심 경로. 출시 빌드마다 먼저 돈다. `regression`: 지난 버그·정책 경계. 출시 전에 전체로 돈다.
- 기능 태그(`todo`, `invite`, `app`, …): `pnpm e2e:feature <태그>`로 그 기능만 돈다.
- `needs-second-account`: `MAESTRO_SECOND_*` 계정이 있어야 한다. `push`: `pnpm e2e`가 연 시뮬레이터 푸시 입구가 있어야 한다.
- `android-only`·`ios-only`: 다른 플랫폼에서는 본문을 건너뛴다(통과로 표시된다). 그 플랫폼은 아래 수동 목록으로 본다.

## 개발 서버에 붙이기

1. 개발 서버: `pnpm docker:up`(PostgreSQL) 후 API를 켠다(`http://localhost:8080`).
2. 개발 빌드: `APP_ENV=development`라 앱 ID `com.aido.mobile.dev`, 스킴 `aido-dev`이고 API는 `.env.development`의
   `EXPO_PUBLIC_API_URL`(기본 `http://localhost:8080`)을 쓴다. 시뮬레이터는 `pnpm ios`·`pnpm android` 또는
   EAS `development-simulator` 프로필 빌드를 설치한다. Android 에뮬레이터는 `pnpm adb:reverse`와 `adb reverse tcp:8081 tcp:8081`을 건다.
3. Metro: `pnpm dev`. 흐름은 개발 클라이언트 실행 URL(`exp+aido://?__expo_url=…`)로 Metro 번들에 붙는다. `MAESTRO_METRO_URL`을 비우면(Release 로컬 빌드) 건너뛴다.
4. 계정: `pnpm e2e:accounts create`가 main·second를 실제 가입 API로 만들고 로컬 DB에서 메일 인증만 표시한 뒤
   `.maestro/.env.maestro`에 쓴다(비밀번호는 무작위, 출력하지 않는다). 처음이면 `cp .maestro/.env.maestro.example .maestro/.env.maestro`.

안전장치: `config.js`는 앱 ID가 운영(`com.aido.mobile`)이거나 `MAESTRO_API_URL`이 http 로컬·사설망 주소가 아니면 첫 요청 전에 멈춘다.
`accounts.ts`는 API·DB가 로컬이 아니거나 DB 이름에 `prod`가 있으면 멈춘다.

## 실행

```bash
pnpm --filter @aido/mobile e2e                    # 전체
pnpm --filter @aido/mobile e2e:smoke              # smoke만
pnpm --filter @aido/mobile e2e:feature todo       # 한 기능(태그)만
pnpm --filter @aido/mobile e2e --device <udid> --exclude-tags android-only
pnpm --filter @aido/mobile e2e:accounts reset     # 초대 수락 기록·두 계정 사이 친구 알림 지우기(e2e가 시작할 때 자동으로 부른다)
```

`run-e2e.ts`는 `.env.maestro`를 환경으로 올리고(Maestro가 `MAESTRO_*`를 바로 읽어 비밀번호가 `-e` 인자에 남지 않는다,
[Parameters and constants](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/parameters-and-constants)), second 계정이 있으면
`accounts.ts reset`을 먼저 부르고, 결과를 `maestro-output/<시각>/`(git이 무시한다)에 HTML 보고서와 함께 모은다. 산출물에는 입력한 비밀번호가 남을 수 있으니 공유하지 않는다.
직접 돌릴 때(또는 Maestro MCP `run`)는 같은 값을 환경으로 준다. `push` 태그 흐름은 `pnpm e2e`로만 돈다.

```bash
set -a; source apps/mobile/.maestro/.env.maestro; set +a
maestro test --test-output-dir apps/mobile/maestro-output apps/mobile/.maestro/flows/todo/create-complete-delete-saves.yaml
MAESTRO_APP_ID=com.aido.mobile.dev maestro check-syntax apps/mobile/.maestro/flows/todo/create-complete-delete-saves.yaml   # 기기 없이 문법만
```

iOS 시뮬레이터는 영어 키보드를 첫 번째로 둔다(`xcrun simctl spawn <udid> defaults write -g AppleKeyboards -array "en_US@sw=QWERTY;hw=Automatic" "ko_KR@sw=Korean;hw=Automatic"` 뒤 재부팅).
병음·한글 입력기가 앞에 있으면 넣은 영문이 조합 중으로 남는다. 알림 권한은 iOS 시뮬레이터에서 `launchApp`으로 미리 줄 수 없어 새 계정은 로그인 뒤
알림 안내가 뜨고 새로운 기능 소개가 피드를 덮는다. 로그인 하위 흐름이 부르는 `subflows/app/dismiss-hints.yaml`이 둘 다 닫는다.
푸시를 받아야 하는 흐름은 `subflows/notification/allow-push.yaml`이 알림 설정에서 시스템 창을 허용한다.

### 시뮬레이터 푸시

`run-e2e.ts`가 `127.0.0.1:8091/push`에 입구를 열고 `MAESTRO_SIMULATOR_PUSH_URL`로 흐름에 알린다. 흐름은 알림함의 실제 알림(id·문구)을
`output.api.pushToSimulator('friend-request', notification)`으로 보내고, 입구는 `push/friend-request.json`을 채워
`xcrun simctl push <--device 값 또는 booted> <MAESTRO_APP_ID> -`로 넣는다(APNs 없이, [시뮬레이터 재현](../docs/push-notifications.md#시뮬레이터-재현)).
id가 실제 알림이어야 앱의 소유 확인(읽음)이 통과한다. 개발 서버가 실제 푸시도 보내게 설정돼 있으면 배너가 둘 뜰 수 있다.

## 흐름 하나의 모양

```yaml
appId: ${MAESTRO_APP_ID}
name: 할 일을 추가하고 완료한 뒤 지우면 단계마다 서버에 반영된다
tags: [smoke, todo]
onFlowStart:
  - runFlow: ../../subflows/app/load-helpers.yaml # config → selectors → api
  - evalScript: ${output.main = output.api.signIn('main')} # 데이터 준비는 API 한 줄씩
  - runFlow: ../../subflows/app/launch-fresh.yaml # clearState + 개발 클라이언트 연결, 알림만 허용
onFlowComplete:
  - evalScript: ${output.main && output.main.removeE2eCategories()} # 실패해도 정리
---
# 지키는 것: 한 줄과 그 근거인 앱 파일
# Given / When / Then 한국어 주석 아래에 하위 흐름과 확인만 둔다
```

- 시작 상태는 `onFlowStart`의 `launchApp: clearState`(iOS는 `clearKeychain`)와 API 준비로 만든다. 다른 흐름이 남긴 상태에 기대지 않는다
  ([Hooks](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/hooks)).
- 선택자는 `output.ids.<기능>.*`(testID)와 `output.labels.<묶음>.*`(글자)만 쓴다. 흐름에 id·글자를 직접 적지 않는다. 서버가 준 글자는 `output.containing(text)`로 찾는다.
- 기다림은 `extendedWaitUntil`·`assertVisible`과 명시 timeout이다. 고정 sleep·좌표 누르기를 쓰지 않는다. 서버 반영은 `api.js`의 `waitFor*`가 기다린다.
- `retry`는 네트워크처럼 본래 흔들리는 단계에만 쓴다. 플랫폼 차이는 `runFlow: when: platform:`으로 나눈다.
- 권한은 `launchApp`의 `permissions`로 미리 정하고, 흐름 도중 허용은 `setPermissions`로 한다(iOS에서 거두면 앱이 끝난다).
- 화면 결과는 UI로, 저장 결과는 `assertTrue`+API로 확인한다([assertTrue](https://docs.maestro.dev/reference/commands-available/asserttrue)).
- `${…}` 안에는 `$`를 쓸 수 없고, YAML 평문이라 `: `가 들어간 객체 리터럴을 쓰지 않는다. 그런 계산은 `api.js`·`selectors.js`에 둔다.

## 흐름 추가하기

- [ ] 지키는 것 하나를 정한다. 업무 규칙 분기는 단위 테스트로 보낸다.
- [ ] 화면 요소에 testID가 없으면 해당 컴포넌트에 `<feature>-<element>[-<action>]`로 하나 단다(React Native `testID`는 Maestro `id`).
      네이티브 헤더 툴바·시스템 창은 testID를 받지 않아 `labels`의 글자로 찾는다.
- [ ] `scripts/selectors.js`의 기능 묶음에 더하고 묶음 위 주석에 앱 파일 경로를 적는다.
- [ ] 서버 준비·확인이 모자라면 `scripts/api.js`에 동사 규칙대로 더한다(`packages/api` 계약에 있는 경로만).
- [ ] 두 흐름 이상이 같은 단계를 되풀이하면 `subflows/<기능>/<동작>.yaml`로 뺀다.
- [ ] `flows/<기능>/<동작>-<결과>.yaml`을 위 모양으로 쓰고 기능 태그와 `smoke`/`regression`을 단다. 이 README 흐름 표에 한 줄 더한다.
- [ ] `maestro check-syntax <파일>`, 개발 빌드에서 `pnpm e2e:feature <태그>`.

## 화면이 바뀌면

| 바뀐 것                          | 고칠 곳                                    |
| -------------------------------- | ------------------------------------------ |
| testID 이름·위치, 버튼·제목 문구 | `scripts/selectors.js`의 그 기능 묶음      |
| 동작 순서(시트 단계, 버튼 추가)  | 그 동작의 하위 흐름, 없으면 그 흐름의 When |
| 서버 경로·응답 모양              | `scripts/api.js`                           |
| 서버 푸시 data 모양              | `push/<이름>.json`                         |
| 기대 결과(제품 정책)             | 그 흐름의 Then과 `name`                    |

## 앱에 더할 testID

| 화면                           | 파일·컴포넌트                                                              | 제안 이름                                                                              |
| ------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 캘린더 가져오기 단계·버튼·결과 | `app/(app)/(tabs)/(me,memos,todos)/todo-import/index.tsx`·`[importId].tsx` | `todo-import-step-<step>`, `todo-import-next`, `todo-import-start`, `todo-import-undo` |
| 할 일 체크박스 완료 상태(iOS)  | `src/features/planning/todo/components/todo-list.tsx` `TodoRow.Checkbox`   | iOS에서 `checked`가 안 읽히면 `accessibilityState.selected`도 싣기                     |
| 날씨 요약                      | `src/features/weather/components/weather-hero.tsx`                         | `weather-hero`                                                                         |

## 빌드에 들어가지 않는 이유

`.maestro/`는 앱 코드가 import하지 않아 Metro 번들에 없고, EAS 업로드에서는 루트 `.easignore`가 `/apps/mobile/.maestro/`와 `/apps/mobile/maestro-output/`을 뺀다
([.easignore](https://docs.expo.dev/build-reference/easignore/)). EAS Workflows `type: maestro` job은 로컬 DB·개발 서버에 기대는 지금 흐름과 맞지 않아 두지 않는다.

## 자동화하지 않는 것 (수동 확인)

Maestro는 기기 밖 서비스와 시간 경과를 흉내 내지 못한다. 출시 전 실기기에서 확인한다.

| 항목                                  | 확인 방법                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 실제 푸시 도착(APNs·FCM)·Android 푸시 | 실기기 개발 빌드 → 다른 계정이 친구 요청·찌르기 → 잠금 화면 배너·소리 → 눌러 해당 화면 한 번(iOS 시뮬레이터 탭은 `push` 흐름) |
| iOS 오프라인                          | 실기기 비행기 모드 → 오프라인 안내·조회 오류 카드·완료 되돌림 → 복구 후 다시 시도                                             |
| Android 캘린더 가져오기·권한 거절     | 에뮬레이터 캘린더에 일정 추가 → 가져오기 → 되돌리기, 시스템 창 두 번 거절 → 설정 열기                                         |
| 카카오톡·시스템 공유 시트             | 초대 화면 공유 → 문구·링크가 열리는지                                                                                         |
| https 초대 링크(`aido.kr/i/<코드>`)   | 운영 빌드에서만 열린다(AASA·assetlinks에 운영 앱만 등록)                                                                      |
| 실제 스토어 결제                      | 샌드박스 계정으로 구독 → 영수증·복원                                                                                          |
| 위젯·홈 화면 빠른 동작                | 기기 홈 화면에서 위젯 추가·누르기                                                                                             |

1.13.0 초대 흐름의 실패 변형(코드 형식, INVITE_2101~2106, 로그인 보류, 진입점, 보상 영수증 등)은 업무 규칙이라 서버·앱 단위 테스트가 지킨다(git 이력에 흐름이 있다).

## 버전

Maestro CLI 2.12.1(Homebrew `mobile-dev-inc/tap/maestro`). 흐름 문법은 설치된 CLI(`maestro check-syntax`, Maestro MCP cheat sheet)를 기준으로 한다.
업데이트: [Update the Maestro CLI](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli/update-the-maestro-cli), [CHANGELOG](https://github.com/mobile-dev-inc/maestro/blob/main/CHANGELOG.md).
