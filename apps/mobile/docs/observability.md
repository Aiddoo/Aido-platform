# 관측(Analytics · Sentry · 로그)

무엇을 언제 어디로 남기는지의 규칙이다. 이벤트 이름·파라미터는 `constants/*.events.ts`의 `AppEventMap`, 퍼널·지표는 [측정 계획](./analytics-measurement-plan.md), 콘솔 값은 [GA 콘솔 설정](./analytics-ga-console.md)에 있다. 서버·앱 공통 로그 키 형식은 [서버 관측](../../api/docs/observability.md#이벤트-키와-필드-서버앱-공통)을 따른다.

## 원칙

- 제품 지표는 GA(`useTrack` 이벤트 맵), 진단은 Sentry(logger 이벤트 키)에 남긴다. 두 시스템에 다 필요한 신호(비자발 로그아웃)는 각자의 타입 경로로 각각 보낸다.
- 벤더 코드(`@sentry/react-native`, `@react-native-firebase/*`)는 `shared/infra` 어댑터에만 둔다. 콜사이트는 포트와 파사드만 쓴다.
- 실패를 조용히 삼키지 않는다. 말한 내용·전사·할 일 제목은 어디에도 남기지 않는다.
- Crashlytics는 쓰지 않는다. 네이티브 크래시까지 Sentry로 모은다.

| 도구               | 답하는 질문      | 진입점                                                  |
| ------------------ | ---------------- | ------------------------------------------------------- |
| Firebase Analytics | 얼마나 많이 쓰나 | `Analytics` 포트 + 타입 카탈로그 `track()`·`useTrack()` |
| Sentry             | 무엇이 왜 깨졌나 | `ErrorReporter` 포트, `AppLogger` 포트                  |

## 환경별 구현

`shared/infra/observability/observability-env.ts`와 `create-device-ports.ts`가 정한다. 프로세스에 한 번 만들고 전역 `logger`도 이때 정한다(`composition-root.ts`).

| 포트·설정                 | 운영                        | 개발·프리뷰                                           |
| ------------------------- | --------------------------- | ----------------------------------------------------- |
| `Analytics`               | Firebase                    | console. 네이티브 자동 수집은 `traffic_type=internal` |
| `ErrorReporter`           | Sentry                      | console                                               |
| `AppLogger`               | console(warn 이상) + Sentry | console                                               |
| `Sentry.init`의 `enabled` | 항상                        | `EXPO_PUBLIC_SENTRY_DEBUG=true`일 때만                |

`EXPO_PUBLIC_SENTRY_DEBUG`는 SDK만 켠다. JS 어댑터는 운영 빌드에서만 Sentry라서 이 값으로는 개발 빌드의 `captureException`·`logger.error`를 확인할 수 없다.

## Analytics

### 선언과 이름

- 이벤트는 기능의 `constants/{entity}.events.ts`에서 `declare module '@src/shared/analytics/event-map'`으로 `AppEventMap`을 채워 먼저 정의한다. 기능에 속하지 않는 앱 공통 이벤트(`feature_action_success`, `local_day_changed`, `offline_banner_shown`, `view_tab_changed`, `error_fallback_retry_tapped`)만 `shared/analytics/event-map.ts`에 직접 있다. 맨 `string` 이름·파라미터를 쓰지 않는다.
- 값의 출처가 도메인이면 도메인 타입을 import한다(`invite_redeem_failed.reason` = `RedeemFailureReason`). 이벤트가 도메인 타입을 정의하지 않는다.
- 컴포넌트는 `useTrack().trackEvent(name, params)`, React 밖은 `track(analytics, name, params)`로 보낸다. `analytics.trackEvent('문자열', …)`를 직접 부르지 않는다.
- 새 이벤트 이름은 `{entity}_{object?}_{verb}`, 파라미터는 snake_case이고 맨 `string`을 쓰지 않는다(`aido/analytics-event-catalog`). 동사 목록은 그 규칙의 `EVENT_VERBS`(`tooling/oxlint-plugin-aido/rules/observability.mjs`)이고, GA가 보는 기존 이름은 `frozenNames`로 동결해 바꿀 때 별칭 기간을 둔다. 안내는 `{entity}_shown`·`{entity}_dismissed`로 맞춘다.
- 파라미터 예약어의 뜻은 정해져 있다: `source`(온 UI), `method`, `reason`, `result`. 앱 이벤트는 GA 예약 구매 이름(`purchase`·`in_app_purchase`·`refund`)을 쓸 수 없다(`AppReservedPurchaseEventGuard` 컴파일 검사).

### 어디서 추적하나

보기 종류마다 장치는 하나다. 같은 보기를 두 장치가 세지 않는다.

| 무엇                                                       | 어디서                                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 경로 보기(pathname이 바뀜. 시트 route 포함)                | 전역 `screen_view` 하나([화면 조회](#화면-조회)). 화면은 따로 보내지 않는다                     |
| 경로가 아닌 보기(카드·말풍선·캐러셀 장·받은 내용·오버레이) | `useTrackView(event, { key, params } \| null)`(`shared/analytics`). 마운트 안에서 key마다 한 번 |
| 같은 경로 안 단계                                          | `useStepper`의 `onStepChange`(entry마다 한 번, 뒤로 가면 다시)                                  |
| 누름·외부 앱 열기                                          | 핸들러                                                                                          |
| 서버가 확정한 결과                                         | mutation `onSuccess`·`onError`. `source`는 mutation 변수로 넘긴다                               |
| 추적하지 않는 층                                           | api, service, repository, store, mapper, model, cache                                           |

- 노출 이벤트는 보기마다 한 번이다. `useTrackView`는 params 객체를 새로 만들어 다시 그려도, 포커스가 돌아와도, 숨었다 다시 보여도 같은 key를 다시 보내지 않는다. 화면이 다시 마운트되면(뒤로 갔다 다시 열기) 새 보기로 센다. `null`은 아직 보이지 않은 것이라 뒤 탭·숨은 카드는 `null`을 넘긴다.
- key는 "무엇을 봤나"다. 같은 화면에서 다른 것을 보면 key가 바뀐다(캐러셀 장 index, 주, 단계). 마운트를 넘어 막아야 하는 것(초대 링크 열림)은 DI store가 맡는다.
- `weather_opened`는 경로와 URL param(`entry`)만 담아 원칙상 `screen_view`의 맥락이지만, KPI·퍼널·잠재고객이 이 이름을 써서 화면 진입 이벤트로 남기는 예외다. 날씨는 앱 Stack에 하나(`dangerouslySingular`)라 Stack에 남은 날씨를 알림으로 다시 열면 다시 마운트되지 않는다. 그래서 날씨를 여는 링크는 `toWeatherHref`로 연 시각(`openedAt`)을 붙이고, 날씨 화면의 노출(`weather_opened`·`weather_location_registered`·`weather_briefing_shown`·`weather_report_failed`)은 그 열기(`useWeatherOpenKey`)마다 한 번이다. 하위 화면에서 돌아오는 것은 세지 않는다. 1.15.1(화면을 열 때마다 새로 쌓음)과 같은 수다(`weather-screen.test.tsx`).

### 화면 조회

- `useScreenTracking`(`AuthGateLayout`의 null 자식 `RouteWatchers`에서 호출)이 `screen_view.screen_name`에 실제 경로가 아닌 route 템플릿(`toScreenName(useSegments())`, 예 `/invite/[inviteCode]`)을 보낸다. 초대 코드·사용자 id가 남지 않는다. 그룹(`(app)`)과 `index`는 뺀다. 같은 템플릿의 다른 대상(`/todo/1` → `/todo/2`)도 경로가 바뀌면 한 번 더 센다. Sentry 내비게이션 breadcrumb도 같은 이름을 쓴다.
- `screen_view`는 레이아웃 효과에서 보내 같은 이동에서 새 화면이 마운트하며 보내는 이벤트(`weather_opened`, `useTrackView`)보다 먼저 나간다. Firebase가 이벤트에 붙이는 화면 이름(`firebase_screen`)이 앞 화면이 되지 않는다. 순서는 `auth-gate-layout.test.tsx`가 지킨다.
- 스플래시 뒤로 지나가는 입구 `/`·`/loading`·`/auth/[provider]`는 세지 않는다(1.15.2부터). 목록은 앱 경로를 아는 bootstrap(`RouteWatchers`의 `ENTRY_REDIRECT_SCREENS`)이 넘긴다. 건너뛴 화면은 앞 화면으로 기억하지 않아 `/feed` → `/` → `/feed` 왕복은 다시 세지 않는다. 콜드 스타트는 첫 화면 한 번, 로그인·로그아웃은 도착한 화면 한 번이다(`auth-gate-layout.test.tsx`).
- URL로 바뀌는 탭 전환은 `ViewTabs`가 `view_tab_changed { screen_name, view }`를 보낸다(같은 탭을 다시 누르면 보내지 않는다). 조회 오류 화면의 다시 시도는 `error_fallback_retry_tapped { screen_name }`이다. `screen_name`은 모두 `useScreenName()`이다.
- 넓은 화면의 상세 pane은 마운트될 때 그 상세 화면 이름으로 조회를 보낸다.

### 측정 규칙

- **내부 트래픽**: 운영이 아닌 빌드는 JS 이벤트를 console로만 남긴다. 네이티브 SDK는 자동 수집 이벤트에 `markFirebaseTrafficAsInternal`의 `setDefaultEventParameters({ traffic_type: 'internal' })`를 건다. GA 데이터 필터 "내부 트래픽"을 활성화해야 제외된다. JS가 뜨기 전 첫 실행의 `first_open`에는 붙지 않는다.
- **매출 원본**: RevenueCat이 Firebase로 보내는 `purchase`·`rc_*`만 매출과 전환에 쓴다. 앱 `subscription_started`는 결제 UI 단계다. 자동 수집 `in_app_purchase`는 iOS에서 끌 수 없어 GA 키 이벤트에서 해제만 한다.
- **사용자 속성**(`UserPropertyMap`): `is_premium`·`subscription_status`는 대시보드 연속성 때문에 유지한다. `is_premium`은 ADMIN과 보상 기간을 포함하므로 유료 전환은 `premium_source = store`로 센다. 비인증이면 `Analytics.clearUser()`가 사용자 id와 모든 속성을 지운다.
- **가입·로그인**: 인증 성공 한 번에 `auth_signup`·`auth_login` 중 하나만 보낸다. 소셜은 서버 응답 `isNewUser`가 true면 `auth_signup`이다. 탈퇴 유예 복구·이메일 자동 연결은 가입이 아니다.
- **초대 귀속**: 진입점은 `invite_entry_tapped.entry`로 본다. `campaign_id`를 빌려 쓰지 않는다(캠페인은 기능 소개 전용).
- **길이와 위치**: 말한 길이·재생 위치는 구간(`VoiceDurationBucket`), 검색어 길이는 구간(`FriendSearchLengthBucket`), 시간대 변경은 폭(`TimezoneOffsetBucket`)으로만 보낸다.
- **답글 수**: `todo_comment_replies_expanded.loaded_count`는 페이지가 도착한 뒤 실제로 불러온 수다.

### 푸시 권한 퍼널

`source`는 `PushPermissionPromptSource`(`onboarding`·`todo_time`·`feed_card`·`settings`·`paywall`, 초대 환영 시트는 `invite_welcome`), `step`은 `PUSH_PERMISSION_STEP`(`ASK`·`REQUEST_SYSTEM`·`OPEN_SETTINGS`·`ENABLE_IN_APP`)이다. `shown`은 안내가 보일 때 마운트·단계마다 한 번이고(`useTrackView`, key는 `step`) 앱 안 다이얼로그는 `step=ASK`다. 피드 카드는 할 일 시각이 지나 숨었다 다음 할 일로 다시 보여도 같은 단계면 다시 세지 않는다(1.15.2부터, `push-permission-notice.test.tsx`). 단계 실행은 `usePushPermissionAction({ source }).runStep(step)` 하나이고, 권한 mutation이 `source`를 변수로 받아 `onSuccess`에서 한 번 추적한다(`requested`·`settings_opened`). 흐름은 [푸시 알림](./push-notifications.md)에 있다.

## Sentry

### Event: `captureException`, `captureMessage`

Issue로 묶이는 신호다. `severity`와 태그를 함께 넘긴다. `captureMessage`의 제목은 `ERROR_REPORT_MESSAGES`의 값만 쓴다(알림 규칙이 보므로 값은 바꾸지 않는다).

```ts
errorReporter.captureMessage(ERROR_REPORT_MESSAGES.SESSION_EXPIRED, {
  feature: 'auth',
  severity: SESSION_EXPIRED_SEVERITY[reason],
  errorCode: reason,
  serverErrorCode,
});
```

**Sentry 보고 자리는 정해져 있다.** mutation은 `meta.errorFeedback`을 읽는 앱 `MutationCache`의 캐시 단계 `onError`, 경계가 받는 조회는 `QueryErrorBoundary`, 경계 밖 조회(인라인 `useQuery`·데이터가 있는 재조회)는 앱 `QueryCache`의 `onError`(`feature: query_cache`), 그 밖은 훅(`useReportUnexpectedError` 등)이다. `useSuspenseQuery`가 데이터 없이 실패하거나 `throwOnError`가 경계로 보내면 `QueryCache`는 건너뛰고, 같은 오류 객체가 두 길로 와도 `captureError`가 한 번만 보낸다. 서비스는 삼킨 실패만 `logger.warn`하고 `captureException`을 부르지 않는다. mutation 실패의 햅틱·토스트·보고 규칙은 [오류 처리](./error-handling.md#mutation-오류-피드백)가 원본이다.

### Breadcrumb: `addBreadcrumb`

이벤트 직전의 행적이다. `category`는 `BREADCRUMB_CATEGORIES`(`http`·`navigation`·`auth`·`lifecycle`·`ui`·`widget`·`invite`·`network`·`voice`·`error`)로 고정한다.

- DI 밖(HTTP 훅, 전역 코드)은 `shared/infra/logger/global-logger`의 `logger`를 쓴다. `errorReporter`는 DI 포트로만 받는다.
- `logger.info`·`warn`도 breadcrumb로 남지만 카테고리가 없다. 카테고리가 필요하면 `addBreadcrumb`를 쓴다.

### User·Replay·Trace

- `useSyncUserIdentity`가 로그인하면 `setUserId(id)`, 비인증이면 `setUserId(null)`을 부른다. 내부 계정 id만 싣는다. `sendDefaultPii: false`다. RN SDK 8은 이 값으로 IP 추론·라우트 URL·딥링크 수집을 가르므로 그대로 둔다.
- Session Replay(`shared/infra/observability/error-reporting.ts`): `replaysSessionSampleRate` 0, `replaysOnErrorSampleRate` 0.2, `mobileReplayIntegration`의 `maskAllText`·`maskAllImages`·`maskAllVectors` 모두 `true`. 마스킹을 끄지 않는다(할 일·전사가 보인다). 상시 녹화는 무료 할당(월 50개)을 넘겨 버려졌고, 오류 녹화는 월 약 40개로 할당 안에 든다.
- `tracePropagationTargets`는 `ENV.API_URL`의 출처 하나다(`trace-propagation-targets.ts`). 외부 주소에는 `sentry-trace`·`baggage`를 붙이지 않는다. `tracesSampleRate`는 두지 않아 앱 span을 보내지 않고 표본 여부는 서버가 정한다.

### Severity

`debug` < `info` < `warning` < `error` < `fatal`(`core/observability/severity.ts`, 어댑터가 Sentry level로 매핑). `session_expired`는 `SESSION_EXPIRED_SEVERITY`(`core/observability/telemetry-event.ts`)로 정한다. 사유의 뜻은 [인증](./auth.md#세션-종료-사유의-두-축)을 본다.

| reason                     | severity  |
| -------------------------- | --------- |
| `refresh-rejected`         | `warning` |
| `tokens-missing`           | `warning` |
| `invalid-refresh-response` | `error`   |

어느 사유도 `info`가 아니다. 비자발 로그아웃은 전부 조사 대상이다.

### Tag

`ErrorReporterContext`(`feature`·`errorCode`·`serverErrorCode`·`method`·`endpoint`·`statusCode`)가 태그가 된다. `severity`는 제외다. 저카디널리티 값만 넣는다.

- `errorCode`는 클라이언트가 판단한 사유, `serverErrorCode`는 서버가 내려준 `@aido/api/errors` 코드다. 섞지 않는다.
- `feature`는 `ERROR_REPORT_FEATURES`의 snake_case 값이다. 새 값은 거기에 먼저 더한다. 태그 키는 `SENTRY_TAGS`(`shared/infra/error-reporter/sentry-tags.ts`)를 쓴다.
- `logger.error`의 `feature` 태그는 로그 키의 첫 마디이고 `ERROR_REPORT_FEATURES` 안의 값만 보낸다. 새 첫 마디를 쓰면 거기에도 더한다(빠지면 `sentry-logger.test.ts`가 실패한다).

## 오류 분류와 한 번만 보고

Sentry로 나가는 모든 오류(`AppLogger.error`, `ErrorReporter.captureException`)는 `shared/infra/observability/capture-error.ts`의 `captureError` 한 곳을 지난다. 이슈로 보낼지는 `shared/errors/classify-error.ts`의 `classifyError`만 판단하고 표는 `classify-error.test.ts`가 고정한다. 전역 피드백·경계·`useReportUnexpectedError`도 같은 판정으로 예상하지 못한 오류만 `reportUnexpectedError`로 보낸다.

| 오류(`classifyError`의 kind)                                     | Sentry                                                                                     | 비고                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------- |
| 4xx `ApiError`, `BusinessError`, `KeychainLockedError`(expected) | breadcrumb(`category: error`)                                                              | UI가 `Result`·토스트로 처리      |
| 401 `ApiError`(auth-expired)                                     | breadcrumb                                                                                 | 경계는 warning 메시지            |
| `NetworkError`, `TimeoutError`(connectivity)                     | breadcrumb                                                                                 | 기기 상태                        |
| `ServerError`(5xx)                                               | 이슈. `request_id`·`serverErrorCode`·method·endpoint 태그                                  | `ky-client`가 봉투·헤더에서 채움 |
| `ParseError`·`ZodError`, 렌더 오류, 잡지 못한 오류, SDK 오류     | 이슈. 호출부가 `feature` 태그(`error_boundary` 등), 루트 오류 화면은 `root_error_boundary` | 문자열 `code`가 있어도 이슈      |

- 같은 `Error` 객체는 어느 경로로 몇 번 보고해도 한 번만 처리한다(`WeakSet`). 먼저 닿은 쪽의 태그가 남는다(`capture-error.test.ts`).
- 새 오류 종류를 예상한 오류로 낮추려면 `classifyError`와 그 테스트 표에 먼저 더한다.

## AppLogger

- message는 자유 문자열 대신 기능별 `*_LOG_EVENT` 상수다. 상수는 기능 `constants/{entity}-log-events.ts`, 공용 코드는 쓰는 파일 옆에 둔다. 예: `NOTIFICATION_LOG_EVENT`.
- 로그 키는 `{feature}.{subject}.{outcome}` 세 마디 kebab-case이고 기능마다 유일하다. 값은 Sentry 대시보드에서 쓰므로 바꾸지 않는다. breadcrumb도 같은 키를 쓴다. lint(`aido/log-event-key`·`logger-event-constant`)가 형식, 유일성, 파일당 `*_LOG_EVENT` 하나, 문자열 직접 사용 금지를 검사한다.
- 레벨은 호출부가 정한다. 가변 정보는 message가 아니라 context로 넘긴다. context의 오류는 `{ error: getErrorMessage(error) }` 한 모양이다. 원본 `error` 객체·`instanceof` 분기를 넣지 않는다.
- 어댑터(`console-*`, `composite-logger`)와 테스트 밖에서 `console.*`을 쓰지 않는다(`eslint/no-console`).

| 상황                                                  | 호출                                                                           | Sentry                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
| 운영 이벤트·격리된 실패                               | `logger.info/warn(KEY, { error: getErrorMessage(e) })`                         | breadcrumb                                 |
| 예측 못한 오류(기능 이름을 아는 훅·전역 캐시·경계)    | `reportUnexpectedError`(`useReportUnexpectedError`·`useMutationErrorFeedback`) | 이벤트 `feature`·요청 태그                 |
| 예측 못한 오류(로그 키가 기능을 밝히는 곳, 추가 문맥) | `logger.error(KEY, toError(e), context)`                                       | 이벤트 `source=logger`·`feature=<첫 마디>` |
| 도메인 신호(세션 종료·결제 실패 등)                   | `errorReporter.captureMessage`                                                 | 이벤트 `feature`                           |

**보고 API는 하나다.** 두 입구 모두 `captureError` 한 곳을 지나 `classifyError`로 이벤트·breadcrumb를 정하고 같은 오류 객체는 한 번만 보낸다. `reportUnexpectedError`는 예상한 오류를 아예 보내지 않고, `logger.error`는 예상한 오류를 breadcrumb로 남긴다. 기능 이름을 아는 React 코드는 `reportUnexpectedError` 쪽을, DI 밖 코드와 로그 키·문맥(`speech_error` 등)으로 남기는 코드는 `logger.error`를 쓴다.

- `logger.error(KEY, undefined, context)`는 breadcrumb만 남긴다. 이벤트가 필요하면 `Error`를 넘긴다. `logger.debug`는 Sentry에 남지 않는다.
- 같은 오류는 한 곳에서 한 방법으로만 보낸다.

## 실패를 삼키지 않는다

- `.catch(() => undefined)`·`.catch(noop)`·빈 `catch`로 끝내지 않는다. `logger.warn(KEY, { error: getErrorMessage(error) })`로 남긴다.
- `mutateAsync`의 실패는 전역 `meta.errorFeedback`이 알리고 기록한다. 그래서 호출부 `.catch(noop)`은 흐름만 잇는 용도로 쓸 수 있다. `errorFeedback: false`이거나 `isHandledByFeature`로 뺀 오류는 호출부나 기능이 직접 보이고 기록한다.
- 기다리지 않는 Promise는 내부에서 실패를 처리하는 함수이거나 호출부 `.catch`에서 기록한다.
- 예측 가능한 4xx는 이벤트가 아니다. `Result.err()`로 UI가 처리하고 HTTP 실패는 `addBreadcrumb({ category: 'http' })`로만 남긴다. breadcrumb의 `requestId`는 요청마다 보내는 `X-Request-Id`(`shared/infra/http/request-headers.ts`)이고 서버 로그 `reqId`·서버 Sentry `request_id`와 같다.

## 개인정보

- 말한 내용·전사 글자·할 일 제목·알림 제목과 본문·메모 내용을 이벤트 파라미터, breadcrumb, 로그 context에 넣지 않는다. 토큰·이메일·좌표·검색어·초대 코드·상대 사용자 id·신고 상세도 넣지 않는다.
- 음성은 길이를 구간으로만 남기고 오류는 인식기 오류 코드(`speech_error`)만 남긴다.
- `shared/infra/observability/scrub-sentry-event.ts`가 `beforeSend`·`beforeBreadcrumb`로 한 번 더 지운다. 호출부가 실수해도 나가지 않게 하는 마지막 방어선이고 호출부에서 먼저 빼는 것이 원칙이다.
  - **허용 키**: `extra`와 breadcrumb `data`는 `core/observability/telemetry-keys.ts`의 `TELEMETRY_DATA_KEYS` 튜플에 있는 키의 문자열·숫자·불리언만 남는다. 그 밖의 키와 객체·배열 값은 지운다. 로그 context·`Breadcrumb.data` 타입(`TelemetryData`)이 같은 튜플이라 목록 밖 키나 배열은 타입 오류다. 목록은 `join(',')`한 문자열로 보내고, 새 키는 이메일·이름·사용자 글이 아닌지 확인한 뒤 튜플에 더한다. `logger.debug`는 Sentry로 가지 않아 키를 묶지 않는다.
  - **문자열 패턴**: 이메일, `Bearer ...`, JWT, 40자 이상 토큰 모양은 `[email]`·`[token]`으로 바뀌고 500자로 자른다. 요청 ID(UUID)는 그대로다.
  - `console` breadcrumb는 버린다. 요청은 `data`·쿠키·`Authorization`을 지우고 URL 쿼리를 자른다. 사용자는 내부 id만 남는다.

## 기기에서 확인하는 시나리오

운영이 아닌 빌드는 Sentry에 가지 않는다. 확인할 때는 개발 DSN을 넣은 Release 빌드를 쓰고 운영 DSN이 아닌지 먼저 본다.

| 시나리오             | 방법                                                | 기대                                                                                     |
| -------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 일부러 500           | QA 서버에서 목록 API가 500을 내게 한다              | 이슈 1건. `request_id`가 서버 `reqId`와 같다. 토스트와 재시도                            |
| 일부러 4xx(404, 409) | 지운 할 일 열기, 중복 요청                          | 이슈 없음. 다른 이슈의 breadcrumb에만 `error`·`http`                                     |
| 비행기 모드·타임아웃 | 네트워크를 끊고 새로 고침                           | 이슈 없음                                                                                |
| 응답 파싱 실패       | 서버 응답 필드를 일부러 어긋나게 한다               | 이슈 1건(`ParseError`, message에 어긋난 칸), `feature` 태그. 따로 남기는 로그는 없다     |
| 렌더 오류            | 개발용 화면에서 렌더 중 throw                       | 이슈 1건, `feature=error_boundary`. 중복 없음                                            |
| 루트 렌더 오류       | 루트 Provider 안에서 throw한 뒤 "다시 시도"         | 이슈 1건, `feature=root_error_boundary`. 로그인·피드·초안이 남는다                       |
| 개인정보             | 메모·음성·댓글을 쓰고 위 오류를 낸 직후 이슈를 연다 | 이벤트 JSON에 본문·글자·토큰·이메일이 없고 사용자는 내부 id뿐. 로그아웃 뒤엔 사용자 없음 |
