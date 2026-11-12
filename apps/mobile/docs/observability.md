# 관측(Analytics · Sentry · 로그)

무엇을 언제 어디로 남기는지의 규칙이다. 이벤트 목록과 GA 콘솔 설정은 [측정 계획](./analytics-measurement-plan.md)에 있다. 서버·앱 공통 로그 키 형식은 [서버 관측](../../api/docs/observability.md#이벤트-키와-필드-서버앱-공통)을 따른다.

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

- 이벤트는 기능의 `constants/{entity}.events.ts`에서 `declare module '@src/shared/analytics/event-map'`으로 `AppEventMap`을 채워 먼저 정의한다. 기능에 속하지 않는 앱 공통 이벤트(`feature_action_success`, `local_day_changed`, `offline_banner_shown`)만 `shared/analytics/event-map.ts`에 직접 있다. 맨 `string` 이름·파라미터를 쓰지 않는다.
- 값의 출처가 도메인이면 도메인 타입을 import한다(`invite_redeem_failed.reason` = `RedeemFailureReason`). 이벤트가 도메인 타입을 정의하지 않는다.
- 컴포넌트는 `useTrack().trackEvent(name, params)`, React 밖은 `track(analytics, name, params)`로 보낸다. `analytics.trackEvent('문자열', …)`를 직접 부르지 않는다.
- 새 이벤트 이름은 `{entity}_{object?}_{verb}`이고 동사는 `shown`·`tapped`·`dismissed`·`toggled`·`failed`·`created`·`updated`·`deleted`·`viewed`(화면)·`requested`·`completed`·`opened`·`submitted`·`changed`·`verified`·`resent`·`opted_in`·`opted_out`만 쓴다. 안내는 `{entity}_shown`·`{entity}_dismissed`로 맞춘다. 기존 이름은 동결하고 바꿀 때는 별칭 기간을 둔다.
- 파라미터는 snake_case다. 예약어의 뜻은 정해져 있다: `source`(온 UI), `method`, `reason`, `result`.
- 이름·동사·snake_case·맨 `string` 금지와 로그 키 유일성은 `aido` oxlint 플러그인이 막는다. 앱 이벤트는 GA 예약 구매 이름(`purchase`·`in_app_purchase`·`refund`)을 쓸 수 없다(`AppReservedPurchaseEventGuard` 컴파일 검사).

### 어디서 추적하나

| 무엇               | 어디서                                                            |
| ------------------ | ----------------------------------------------------------------- |
| 서버가 확정한 결과 | mutation `onSuccess`·`onError`. `source`는 mutation 변수로 넘긴다 |
| 보여짐·누름·단계   | 컴포넌트·훅                                                       |
| 추적하지 않는 층   | api, service, repository, store, mapper, model, cache             |

- 노출 이벤트는 화면·구간마다 한 번이다. 재렌더·분 단위 갱신으로 다시 보내지 않는다.

### 화면 조회

- `useScreenTracking`(`AuthGateLayout`의 null 자식 `RouteWatchers`에서 호출)이 `screen_view.screen_name`에 실제 경로가 아닌 route 템플릿(`toScreenName(useSegments())`, 예 `/invite/[inviteCode]`)을 보낸다. 초대 코드·사용자 id가 남지 않는다. 그룹(`(app)`)과 `index`는 뺀다. 같은 템플릿의 다른 대상(`/todo/1` → `/todo/2`)도 경로가 바뀌면 한 번 더 센다. Sentry 내비게이션 breadcrumb도 같은 이름을 쓴다.
- URL로 바뀌는 탭 전환은 `ViewTabs`가 `view_tab_selected { screen_name, view }`를 보낸다.
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

`source`는 `PushPermissionPromptSource`(`onboarding`·`todo_time`·`feed_card`·`settings`·`paywall`, 초대 환영 시트는 `invite_welcome`), `step`은 `PUSH_PERMISSION_STEP`(`ASK`·`REQUEST_SYSTEM`·`OPEN_SETTINGS`·`ENABLE_IN_APP`)이다. `shown`은 안내가 보일 때 한 번이고 앱 안 다이얼로그는 `step=ASK`다. 단계 실행은 `usePushPermissionAction({ source }).runStep(step)` 하나이고, 권한 mutation이 `source`를 변수로 받아 `onSuccess`에서 한 번 추적한다(`requested`·`settings_opened`). 흐름은 [푸시 알림](./push-notifications.md)에 있다.

## Sentry

### Event: `captureException`, `captureMessage`

Issue로 묶이는 신호다. `severity`와 태그를 함께 넘긴다. `captureMessage`의 제목은 `ERROR_REPORT_MESSAGES`의 값만 쓴다(알림 규칙이 보므로 값은 바꾸지 않는다).

```ts
errorReporter.captureMessage(ERROR_REPORT_MESSAGES.SESSION_EXPIRED, {
  feature: 'auth',
  severity: sessionExpiredSeverity[reason],
  errorCode: reason,
  serverErrorCode,
});
```

**Sentry는 두 곳에서만 보낸다.** mutation은 `meta.errorFeedback`을 읽는 앱 `MutationCache`의 캐시 단계 `onError`, 그 밖은 훅(`useReportUnexpectedError` 등)이다. 서비스는 삼킨 실패만 `logger.warn`하고 `captureException`을 부르지 않는다.

### Breadcrumb: `addBreadcrumb`

이벤트 직전의 행적이다. `category`는 `BREADCRUMB_CATEGORIES`(`http`·`navigation`·`auth`·`lifecycle`·`ui`·`widget`·`invite`·`network`·`voice`·`error`)로 고정한다.

- DI 밖(HTTP 훅, 전역 코드)은 `shared/infra/logger/global-logger`의 `logger`를 쓴다. `errorReporter`는 DI 포트로만 받는다.
- `logger.info`·`warn`도 breadcrumb로 남지만 카테고리가 없다. 카테고리가 필요하면 `addBreadcrumb`를 쓴다.

### User·Replay·Trace

- `useSyncUserIdentity`가 로그인하면 `setUserId(id)`, 비인증이면 `setUserId(null)`을 부른다. 내부 계정 id만 싣는다. `sendDefaultPii: false`다. RN SDK 8은 이 값으로 IP 추론·라우트 URL·딥링크 수집을 가르므로 그대로 둔다.
- Session Replay(`shared/infra/observability/error-reporting.ts`): `replaysSessionSampleRate` 0, `replaysOnErrorSampleRate` 0.2, `mobileReplayIntegration`의 `maskAllText`·`maskAllImages`·`maskAllVectors` 모두 `true`. 마스킹을 끄지 않는다(할 일·전사가 보인다). 상시 녹화는 무료 할당(월 50개)을 넘겨 버려졌고, 오류 녹화는 월 약 40개로 할당 안에 든다.
- `tracePropagationTargets`는 `ENV.API_URL`의 출처 하나다(`trace-propagation-targets.ts`). 외부 주소에는 `sentry-trace`·`baggage`를 붙이지 않는다. `tracesSampleRate`는 두지 않아 앱 span을 보내지 않고 표본 여부는 서버가 정한다.

### Severity

`debug` < `info` < `warning` < `error` < `fatal`(`core/observability/severity.ts`, 어댑터가 Sentry level로 매핑). `session_expired`는 `sessionExpiredSeverity`로 정한다. 사유의 뜻은 [인증](./auth.md#세션-종료-사유의-두-축)을 본다.

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

## mutation 오류 피드백

mutation의 햅틱·토스트·Sentry는 앱 `MutationCache`의 캐시 단계 `onError` 하나가 맡는다. 모든 mutation 옵션이 `meta.errorFeedback`을 둔다.

- `{ feature, fallbackKey }`: `bootstrap/query/mutation-error-feedback.tsx`가 `haptics.notify('error')`, `toast.error(getUserFacingMessage(error), { fallback: t(fallbackKey) })`를 한 번 하고, `reportUnexpectedError`가 예상하지 못한 오류만 `captureException(error, { feature, ...getErrorReportTags(error) })`로 보낸다. 태그는 `ServerError`가 지닌 상태·서버 코드·method·endpoint다. 예상한 오류와 연결 문제는 보고하지 않는다.
- `isHandledByFeature(error)`가 true인 오류와 `errorFeedback: false`는 전역이 알리지도 보고하지도 않는다. 기능이 보이는 오류는 예측한 것이라 보고 대상이 아니고, 기능이 모든 실패를 보이는 mutation(결제·복원 등)은 그 자리에서 `captureMessage`한다.
- 캐시 단계라 기능 `onSettled`가 기다리는 재조회에 묶이지 않는다. 자세한 규칙은 [오류 처리](./error-handling.md#mutation-오류-피드백)를 본다.

## AppLogger

- message는 자유 문자열 대신 기능별 `*_LOG_EVENT` 상수다. 상수는 기능 `constants/{entity}-log-events.ts`, 공용 코드는 쓰는 파일 옆에 둔다. 예: `NOTIFICATION_LOG_EVENT`.
- 로그 키는 `{feature}.{subject}.{outcome}` 세 마디 kebab-case이고 기능마다 유일하다. 값은 Sentry 대시보드에서 쓰므로 바꾸지 않는다. breadcrumb도 같은 키를 쓴다. `core/observability/log-event-keys.test.ts`와 lint가 형식, 유일성, 문자열 직접 사용 금지를 검사한다.
- 레벨은 호출부가 정한다. 가변 정보는 message가 아니라 context로 넘긴다. context의 오류는 `{ error: getErrorMessage(error) }` 한 모양이다. 원본 `error` 객체·`instanceof` 분기를 넣지 않는다.
- 어댑터(`console-*`, `composite-logger`)와 테스트 밖에서 `console.*`을 쓰지 않는다(`eslint/no-console`).

| 상황                               | 호출                                                   | Sentry                                     |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------ |
| 운영 이벤트·격리된 실패            | `logger.info/warn(KEY, { error: getErrorMessage(e) })` | breadcrumb                                 |
| 예측 못한 오류(경계 밖·백그라운드) | `logger.error(KEY, toError(e))`                        | 이벤트 `source=logger`·`feature=<첫 마디>` |
| 예측 못한 오류(경계·도메인 신호)   | `errorReporter.captureException/captureMessage`        | 이벤트 `feature`                           |

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
  - **허용 키**: `extra`와 breadcrumb `data`는 `ALLOWED_CONTEXT_KEYS`(`memoId`, `status`, `code`, `durationMs`, `error`, `reason` 등)에 있는 키의 문자열·숫자·불리언만 남는다. 그 밖의 키와 객체·배열 값은 지운다. 새 context 키는 허용 목록과 테스트에 먼저 더한다.
  - **문자열 패턴**: 이메일, `Bearer ...`, JWT, 40자 이상 토큰 모양은 `[email]`·`[token]`으로 바뀌고 500자로 자른다. 요청 ID(UUID)는 그대로다.
  - `console` breadcrumb는 버린다. 요청은 `data`·쿠키·`Authorization`을 지우고 URL 쿼리를 자른다. 사용자는 내부 id만 남는다.

## 기기에서 확인하는 시나리오

운영이 아닌 빌드는 Sentry에 가지 않는다. 확인할 때는 개발 DSN을 넣은 Release 빌드를 쓰고 운영 DSN이 아닌지 먼저 본다.

| 시나리오             | 방법                                                | 기대                                                                                     |
| -------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 일부러 500           | QA 서버에서 목록 API가 500을 내게 한다              | 이슈 1건. `request_id`가 서버 `reqId`와 같다. 토스트와 재시도                            |
| 일부러 4xx(404, 409) | 지운 할 일 열기, 중복 요청                          | 이슈 없음. 다른 이슈의 breadcrumb에만 `error`·`http`                                     |
| 비행기 모드·타임아웃 | 네트워크를 끊고 새로 고침                           | 이슈 없음                                                                                |
| 응답 파싱 실패       | 서버 응답 필드를 일부러 어긋나게 한다               | 이슈 1건(`ParseError`), `feature` 태그, breadcrumb에 `*.response-parse.failed`           |
| 렌더 오류            | 개발용 화면에서 렌더 중 throw                       | 이슈 1건, `feature=error_boundary`. 중복 없음                                            |
| 루트 렌더 오류       | 루트 Provider 안에서 throw한 뒤 "다시 시도"         | 이슈 1건, `feature=root_error_boundary`. 로그인·피드·초안이 남는다                       |
| 개인정보             | 메모·음성·댓글을 쓰고 위 오류를 낸 직후 이슈를 연다 | 이벤트 JSON에 본문·글자·토큰·이메일이 없고 사용자는 내부 id뿐. 로그아웃 뒤엔 사용자 없음 |

## 관련 코드

| 관심사              | 위치                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 포트                | `core/ports/{error-reporter,severity,breadcrumb,analytics,logger,telemetry-event}.ts`                                                               |
| Sentry 어댑터       | `shared/infra/error-reporter/sentry-error-reporter.ts`, `shared/infra/logger/sentry-logger.ts`                                                      |
| init·전송 입구·분류 | `shared/infra/observability/{error-reporting,capture-error,scrub-sentry-event}.ts`, `shared/errors/classify-error.ts`                               |
| 카탈로그·파사드     | `core/observability/telemetry-keys.ts`, `shared/analytics/{track,use-track}.ts`                                                                     |
| 환경별 구현·DI      | `shared/infra/observability/observability-env.ts`, `bootstrap/providers/{create-device-ports,composition-root}.ts`                                  |
| 계측 지점           | `shared/infra/http/api-failure-breadcrumb.ts`(http), `shared/hooks/use-screen-tracking.ts`(navigation), `bootstrap/hooks/use-auth-boot.ts`(session) |
| 테스트 stub         | `src/testing/ports/{logger,error-reporter,analytics}.stub.ts`                                                                                       |
