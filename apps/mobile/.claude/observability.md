# 관측(Observability) 가이드 — Analytics · Sentry · Breadcrumb · Severity · Tag

**Version**: 1.0.0 · **Last Updated**: 2026-07-06 · **Owner**: Aido Mobile Team

> "무엇을 언제 어디로 남기나"를 한 곳에. 벤더(`@sentry/*`·`@react-native-firebase/*`) 코드는 **어댑터에만**, 콜사이트는 포트/파사드만 쓴다.

---

## 역할 분리

| 도구                   | 답하는 질문                         | 진입점                                                                     |
| ---------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| **Firebase Analytics** | "얼마나 많이/자주 쓰나" (제품 지표) | `Analytics` 포트 + 타입 카탈로그 `track()`/`useTrack()`                    |
| **Sentry**             | "무엇이 왜 깨졌나" (관측·진단)      | `ErrorReporter` 포트 (`captureException`/`captureMessage`/`addBreadcrumb`) |

- **Crashlytics는 쓰지 않는다** — 네이티브 크래시까지 Sentry로 일원화(2026-07 정리).
- 이중 목적 이벤트(예: 비자발 로그아웃)는 두 시스템에 **각자의 타입 경로**로 각각 기록한다. 억지로 합치지 않는다.

---

## Analytics — 제품 지표

- 모든 이벤트는 `shared/observability/telemetry-keys.ts`의 `*EventMap`에 **먼저 정의**한다 → `AppEventMap`으로 합쳐짐. Analytics 이벤트·Sentry feature·태그 키·breadcrumb 카테고리는 이 한 파일이 단일 원본이다(`core/ports`는 타입만 import).
- 맵은 기능별로 나눈다(`AuthEventMap`, `TodoEventMap`, `FriendEventMap`, `InviteEventMap`, `GrowthEventMap` …). 값의 출처가 도메인이면 도메인 타입을 import한다(예: `invite_link_opened.source` = `InviteLinkSource`, `invite_redeem_failed.reason` = `RedeemFailureReason`). 이벤트가 도메인 타입을 정의하지 않는다.
- 친구 초대 퍼널: `invite_entry_tapped{entry}` → `invite_link_shared{channel}` → `invite_link_opened{source}`(시스템이 연 링크가 착지한 화면에서 `source+openedAt`당 한 번) → `invite_redeemed` / `invite_redeem_failed`. 진입점 귀속에 `campaign_id`를 빌려 쓰지 않는다(캠페인은 기능 소개 전용).
- 전송은 `track(analytics, name, params)`(비-React) 또는 `useTrack().trackEvent(name, params)`(컴포넌트)만 사용.
- **raw `analytics.trackEvent('문자열', …)` 직접호출 금지** — 이벤트명·payload가 컴파일 타임 검증되지 않는다.

```ts
// 이벤트 정의 (telemetry-keys.ts의 AuthEventMap)
session_expired: {
  reason: SessionExpiredReason;
}

// 전송 (무캐스트, 타입 검증됨)
track(analytics, 'session_expired', { reason });
```

### 측정 규칙 (1.14.0)

- **화면 조회**: `useScreenTracking`이 `screen_view.screen_name`에 실제 경로가 아닌 **라우트 템플릿**(`toScreenName(useSegments())`, 예 `/invite/[inviteCode]`)을 보낸다. 그룹(`(app)`)·`index`는 뺀다. 같은 템플릿의 다른 대상(`/todo/1` → `/todo/2`)도 경로가 바뀌면 한 번 더 센다. Sentry 내비게이션 breadcrumb도 같은 이름을 쓴다.
- **내부 트래픽**: 운영이 아닌 빌드(`APP_ENV` = development·preview)는 JS 이벤트를 `console` 어댑터로만 남긴다. 그래도 네이티브 SDK가 자동 수집 이벤트를 같은 속성으로 보내므로 `markFirebaseTrafficAsInternal`이 `setDefaultEventParameters({ traffic_type: 'internal' })`를 건다. GA 데이터 필터 "내부 트래픽"을 활성화해야 제외된다. JS가 뜨기 전 첫 실행의 `first_open`에는 붙지 않는다.
- **매출 원본**: RevenueCat이 Firebase로 보내는 `purchase`(·`rc_*`)만 매출·전환에 쓴다. 앱 `subscription_started`는 결제 UI 퍼널 단계일 뿐이고, Firebase 자동 수집 `in_app_purchase`는 iOS에서 끌 수 없으므로 GA 키 이벤트에서 해제만 한다. 앱 이벤트는 GA 예약 구매 이름(`purchase`·`in_app_purchase`·`refund`)을 쓸 수 없다(`AppReservedPurchaseEventGuard` 컴파일 검사).
- **사용자 속성**(`UserPropertyMap`): `is_premium`·`subscription_status`(연속성 유지) + `premium_source`(`store`·`grant`·`admin`·`none`). 유료 전환은 `premium_source = store`로 센다. 로그아웃(비인증)이면 `Analytics.clearUser()`가 사용자 id와 모든 속성을 `null`로 지운다.
- **한 번만**: 노출 이벤트는 화면·구간마다 한 번이다. 재렌더·분 단위 갱신으로 다시 보내지 않는다.
- **가입·로그인**: 인증 성공 한 번에 `auth_signup`·`auth_login` 중 **하나만** 보낸다. 소셜(OAuth 교환·Apple)은 서버 응답 `isNewUser`가 true면 `auth_signup`, 아니면 `auth_login`이다. 필드가 없는 구버전 서버 응답은 `auth_login`으로 본다. 탈퇴 유예 복구·이메일 자동 연결은 가입이 아니다.

| 이벤트                          | 파라미터                                                                                                  | 시점                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `auth_signup`                   | `method`: `email`·`google`·`apple`·`kakao`·`naver`                                                        | 이메일 가입 / 소셜 신규 가입(`isNewUser`)            |
| `auth_login`                    | `method`: `email`·`google`·`apple`·`kakao`·`naver`                                                        | 이메일 로그인 / 소셜 기존 계정 로그인                |
| `premium_gate_cta_tapped`       | `feature`(`PremiumFeature`)                                                                               | `usePremiumGate().subscribe`                         |
| `paywall_viewed`                | `view`: `status`·`plans`                                                                                  | 요금제를 받아 페이월이 보였을 때                     |
| `purchase_failed`               | `reason`: `network`·`server`·`store_unavailable`·`store_error`                                            | 결제 실패를 문의로 안내할 때(취소·승인 대기 제외)    |
| `ai_report_viewed`              | `report_id` · `report_type`: `WEEKLY`·`MONTHLY`                                                           | 저장된 리포트 상세                                   |
| `weather_opened`                | `entry`: `feed_badge`·`notification`·`other`                                                              | 날씨 화면 진입(`weatherHref(entry)`의 `?entry`)      |
| `weather_briefing_shown`        | `kind`: `rainy`·`stormy`·`snowy`·`hot`·`rain_later`·`clear`·`tomorrow_morning`·`dry`·`no_scheduled_todos` | 브리핑이 처음 보였을 때                              |
| `weather_location_registered`   | `result`: `located`·`denied`·`unavailable`                                                                | 날씨 화면에서 위치 확인이 처음 끝났을 때             |
| `weather_report_failed`         | `cause`: `no_location`·`provider_unavailable`·`offline`·`other`                                           | 리포트 실패 화면(위치 등록 대기 중 로딩은 제외)      |
| `offline_banner_shown`          | –                                                                                                         | 오프라인 전환마다(`connectOnlineManager`)            |
| `todo_comment_created`          | `todo_id` · `is_reply` · `chain_size`                                                                     | 댓글·답글 게시 성공(mutation `onSuccess`)            |
| `todo_comment_deleted`          | `todo_id` · `is_reply`                                                                                    | 삭제 성공                                            |
| `todo_comment_liked`            | `todo_id` · `is_liked` · `via`: `button`·`double_tap`                                                     | 좋아요 요청 성공(더블탭은 이미 좋아요면 보내지 않음) |
| `todo_comment_replies_expanded` | `todo_id` · `loaded_count`                                                                                | "답글 N개 보기·더 보기"로 받은 페이지가 도착했을 때  |
| `todo_comment_reply_started`    | `todo_id` · `target`: `comment`·`reply`                                                                   | "답글 달기"를 누를 때                                |
| `todo_comment_hint_dismissed`   | `kind`: `double_tap` · `reason`: `close`·`used`                                                           | 더블탭 안내를 닫거나 처음 더블탭했을 때(계정당 1회)  |

---

### 1.14.1 신규 측정기준/측정항목 (댓글)

GA 등록 대상: 측정기준 `is_reply`, `via`, `is_liked`, `target`, `kind`, `reason`(기존), `sort` / 측정항목 `chain_size`, `loaded_count`.
`loaded_count`는 답글 페이지가 도착한 뒤 실제로 불러온 답글 수다(추정값을 보내지 않는다). `depth`는 보내지 않는다.

## Sentry — 관측 (3원소)

### 1) Event — `captureException` / `captureMessage`

Sentry Issue로 그룹핑되는 1급 신호. `severity`(→ Sentry level)와 tags를 함께 넘긴다.

```ts
errorReporter.captureException(error, { feature: 'error_boundary' }); // 예측 불가 에러
errorReporter.captureMessage('session_expired', {
  feature: 'auth',
  severity: 'warning',
  errorCode: reason,
});
```

### 2) Breadcrumb — `addBreadcrumb`

이벤트 **직전 행적**(자체 Issue 아님). `category`는 `telemetry-keys.ts`의 `BREADCRUMB_CATEGORIES`(`BreadcrumbCategory`)로 고정.

```ts
errorReporter.addBreadcrumb({
  category: 'http',
  level: 'warning',
  message: 'API 요청 실패',
  data: { status, code },
});
errorReporter.addBreadcrumb({ category: 'navigation', message: '화면 이동', data: { from, to } });
```

- DI 밖(HTTP 훅·화면 추적)에서는 전역 접근자 `errorReporter`(`shared/infra/error-reporter/global-error-reporter`)를 쓴다 — `global-logger`와 동일 패턴.
- 일반 로그(`logger.info/warn`)도 Sentry breadcrumb로 남지만 **카테고리는 없다**. 카테고리 breadcrumb는 반드시 `addBreadcrumb`로.

### 3) User — `setUserId`

로그인 시 `setUserId(id)`, 로그아웃 시 `setUserId(null)`. PII는 넣지 않는다(`sendDefaultPii: false`).

---

## Severity (`debug` < `info` < `warning` < `error` < `fatal`)

`core/ports/severity.ts`의 union. Sentry level로 exhaustive 매핑되어 **알림 규칙·우선순위**에 쓰인다.

예) `session_expired`의 reason별 판정(`sessionExpiredSeverity`):

| reason                     | severity  | 의미                      |
| -------------------------- | --------- | ------------------------- |
| `no-refresh-token`         | `info`    | 정상 만료 (알림 X)        |
| `refresh-rejected-401`     | `warning` | 재사용/거부 의심          |
| `invalid-refresh-response` | `error`   | 계약·프록시 이상 (알림 O) |

---

## Tag (검색·집계 축)

`ErrorReporterContext`(`feature`·`errorCode`·`method`·`endpoint`·`statusCode`)가 Sentry tags로 변환된다(`severity` 제외).
저카디널리티 값만 태그로 — 검색(`errorCode:AUTH_0104`)·필터·그룹핑용.

`feature`는 `telemetry-keys.ts`의 `SENTRY_FEATURES`(`SentryFeature`)이며 snake_case 값만 쓴다(`app_icon`, `todo_nudge`). 새 값은 거기에 먼저 추가한다. 태그 키는 `SENTRY_TAGS`를 쓴다.

---

## Logger — 이벤트 키 규칙

- `logger.info/warn/error/debug`의 message는 자유 문자열(`'[Notification] ...'`) 대신 **기능별 `*_LOG_EVENT` 상수**를 쓴다. 서버의 `*-log.events.ts`와 같은 방식이다.
- 위치는 기능 `constants/<feature>-log-events.ts`(공용 인프라는 해당 모듈 옆), 형태는 `export const X_LOG_EVENT = { KEY: 'feature.subject.outcome' } as const`.
- 키 형식은 `<feature>.<subject>.<outcome>`(소문자·하이픈, 예 `notification.badge-sync.failed`). 레벨(`warn`/`error`)은 호출부가 정한다.
- 가변 정보는 message가 아닌 `context`로 넘긴다. 포트(`Logger`)는 `message: string`을 유지하므로 어댑터·테스트 계약은 그대로다.
- **PII 금지**: 토큰·이메일·좌표·알림 제목/본문·할 일 내용은 context에 넣지 않는다. 에러는 `error`/`message`만 남긴다.
- 어댑터(`console-*`, `firebase-analytics`)와 `env.ts`의 개발용 진단 외에는 `console.*`을 직접 쓰지 않는다.

---

## 핵심 원칙 — 이벤트 남발 금지

- **예측 가능한 4xx는 event가 아니다.** `Result.err()`로 UI가 처리하고 HTTP 실패는 `addBreadcrumb({ category: 'http' })`로만 남긴다.
- event는 **예측 못한 문제**(ErrorBoundary 도달, 5xx·네트워크·파싱)와 **도메인 신호**(session_expired 등)에만.
- 결과적으로 Sentry Issue 목록이 실제 문제로만 채워져 신호 대 잡음비가 좋아진다.

---

## 관련 코드

| 관심사                    | 위치                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 포트                      | `core/ports/{error-reporter,severity,breadcrumb,analytics,telemetry-event}.ts`                                                                  |
| Sentry 어댑터             | `shared/infra/error-reporter/sentry-error-reporter.ts`, `shared/infra/logger/sentry-logger.ts`                                                  |
| Sentry init/wrap          | `shared/infra/observability/sentry.ts` (앱 루트 `initSentry()`·`wrapRootComponent()`)                                                           |
| Analytics 카탈로그/파사드 | `shared/observability/telemetry-keys.ts`, `shared/analytics/{track,use-track}.ts`                                                               |
| DI 배선                   | `bootstrap/providers/di-provider.tsx`                                                                                                           |
| 계측 지점                 | `shared/infra/http/error-handler.ts`(http), `shared/hooks/use-screen-tracking.ts`(navigation), `bootstrap/providers/auth-provider.tsx`(session) |
