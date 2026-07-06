# 관측(Observability) 가이드 — Analytics · Sentry · Breadcrumb · Severity · Tag

**Version**: 1.0.0 · **Last Updated**: 2026-07-06 · **Owner**: Aido Mobile Team

> "무엇을 언제 어디로 남기나"를 한 곳에. 벤더(`@sentry/*`·`@react-native-firebase/*`) 코드는 **어댑터에만**, 콜사이트는 포트/파사드만 쓴다.

---

## 역할 분리

| 도구 | 답하는 질문 | 진입점 |
|------|-------------|--------|
| **Firebase Analytics** | "얼마나 많이/자주 쓰나" (제품 지표) | `Analytics` 포트 + 타입 카탈로그 `track()`/`useTrack()` |
| **Sentry** | "무엇이 왜 깨졌나" (관측·진단) | `ErrorReporter` 포트 (`captureException`/`captureMessage`/`addBreadcrumb`) |

- **Crashlytics는 쓰지 않는다** — 네이티브 크래시까지 Sentry로 일원화(2026-07 정리).
- 이중 목적 이벤트(예: 비자발 로그아웃)는 두 시스템에 **각자의 타입 경로**로 각각 기록한다. 억지로 합치지 않는다.

---

## Analytics — 제품 지표

- 모든 이벤트는 `shared/analytics/events/*.events.ts`의 `*EventMap`에 **먼저 정의**한다 → `AppEventMap`으로 합쳐짐.
- 전송은 `track(analytics, name, params)`(비-React) 또는 `useTrack().trackEvent(name, params)`(컴포넌트)만 사용.
- **raw `analytics.trackEvent('문자열', …)` 직접호출 금지** — 이벤트명·payload가 컴파일 타임 검증되지 않는다.

```ts
// 이벤트 정의 (auth.events.ts)
session_expired: { reason: SessionExpiredReason };

// 전송 (무캐스트, 타입 검증됨)
track(analytics, 'session_expired', { reason });
```

---

## Sentry — 관측 (3원소)

### 1) Event — `captureException` / `captureMessage`
Sentry Issue로 그룹핑되는 1급 신호. `severity`(→ Sentry level)와 tags를 함께 넘긴다.

```ts
errorReporter.captureException(error, { feature: 'error_boundary' });          // 예측 불가 에러
errorReporter.captureMessage('session_expired', { feature: 'auth', severity: 'warning', errorCode: reason });
```

### 2) Breadcrumb — `addBreadcrumb`
이벤트 **직전 행적**(자체 Issue 아님). `category`는 `BreadcrumbCategory` union으로 고정.

```ts
errorReporter.addBreadcrumb({ category: 'http', level: 'warning', message: 'API 요청 실패', data: { status, code } });
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

| reason | severity | 의미 |
|--------|----------|------|
| `no-refresh-token` | `info` | 정상 만료 (알림 X) |
| `refresh-rejected-401` | `warning` | 재사용/거부 의심 |
| `invalid-refresh-response` | `error` | 계약·프록시 이상 (알림 O) |

---

## Tag (검색·집계 축)

`ErrorReporterContext`(`feature`·`errorCode`·`method`·`endpoint`·`statusCode`)가 Sentry tags로 변환된다(`severity` 제외).
저카디널리티 값만 태그로 — 검색(`errorCode:AUTH_0104`)·필터·그룹핑용.

---

## 핵심 원칙 — 이벤트 남발 금지

- **예측 가능한 4xx는 event가 아니다.** `Result.err()`로 UI가 처리하고 HTTP 실패는 `addBreadcrumb({ category: 'http' })`로만 남긴다.
- event는 **예측 못한 문제**(ErrorBoundary 도달, 5xx·네트워크·파싱)와 **도메인 신호**(session_expired 등)에만.
- 결과적으로 Sentry Issue 목록이 실제 문제로만 채워져 신호 대 잡음비가 좋아진다.

---

## 관련 코드

| 관심사 | 위치 |
|--------|------|
| 포트 | `core/ports/{error-reporter,severity,breadcrumb,analytics,telemetry-event}.ts` |
| Sentry 어댑터 | `shared/infra/error-reporter/sentry-error-reporter.ts`, `shared/infra/logger/sentry-logger.ts` |
| Sentry init | `shared/infra/observability/sentry.ts` (앱 루트 `initSentry()`) |
| Analytics 카탈로그/파사드 | `shared/analytics/events/*.events.ts`, `track.ts`, `use-track.ts` |
| DI 배선 | `bootstrap/providers/di-provider.tsx` |
| 계측 지점 | `shared/infra/http/error-handler.ts`(http), `shared/hooks/use-screen-tracking.ts`(navigation), `bootstrap/providers/auth-provider.tsx`(session) |
