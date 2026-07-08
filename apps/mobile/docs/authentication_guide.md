# 인증 가이드 — 세션 수명주기와 불변식

> **Owner**: Aido Mobile Team · **Last Updated**: 2026-07-08

## 핵심 불변식: 클라이언트는 세션을 먼저 끊지 않는다

**토큰 삭제(=세션 종료)가 허용되는 경로는 정확히 두 가지뿐이다:**

1. **사용자의 명시적 로그아웃** (`AuthService`)
2. **`SessionManager.end()`** — 서버의 definitive refresh 거부, 2xx 응답 파싱 실패, 로컬 토큰 부재

이 불변식은 이제 **구조가 강제한다**: `TokenRefresher`에는 토큰 삭제도 이벤트 발행도 없다.
갱신기는 `RefreshOutcome`을 반환할 뿐이고, 세션 수명은 `SessionManager`만 소유한다.
(갱신기가 세션을 끝낼 수 있던 것이 v1.4.0 사고의 구조적 원인이었다.)

그 외 어떤 코드도 토큰을 삭제해서는 안 된다. 특히:

- **로컬 휴리스틱(플래그·앱 버전·MMKV 상태 비교)으로 토큰을 선제 삭제하지 않는다.**
  MMKV 플래그 부재는 "재설치"뿐 아니라 "그 플래그가 없던 구버전에서의 업데이트"도
  의미한다. v1.3.5의 첫 실행 가드가 이 오판으로 업데이트한 전체 유저를 강제 로그아웃시켰다
  (v1.4.0 사고, PR #591의 회귀).
- **부팅 시 인증 상태를 네트워크 결과에 걸지 않는다.** 오프라인·서버 장애 중에도
  리프레시 토큰이 있으면 인증 상태로 시작한다(낙관적 부팅, `auth-boot.ts`).
- 이 불변식은 `auth-boot.test.ts`가 회귀 테스트로 강제한다.

## 부팅 흐름 (`bootstrap/providers/auth-boot.ts`)

**부팅은 읽기 전용이다.** 토큰을 지우지도, 저장하지도, 네트워크를 타지도 않는다.

| `readRefreshToken()` | 상태 |
|---|---|
| 값 있음 | `authenticated` |
| `null` | `unauthenticated` |
| **throw** (기기 잠김 등) | **`locked`** — 판정 보류, `AppState` 복귀 시 재판정 |

- **첫 실행 플래그(MMKV)는 완전히 제거했다.** 플래그 부재는 "재설치"와 "그 키가 없던 구버전에서의
  업데이트"를 구분할 수 없다. 이 오판이 v1.4.0 대량 로그아웃을 만들었다.
- **부팅 세션 검증(`validateSession`)도 제거했다.** 첫 인증 요청의 401 경로가 어차피 갱신한다.
  부팅 검증은 얻는 것 없이 강제 로그아웃 표면만 넓힌다.
- `locked`를 `unauthenticated`로 확정하면 **잠긴 키체인이 곧 로그아웃**이 된다.
  iOS `getItemAsync`는 잠금 중 `null`이 아니라 **throw**한다.

## 토큰 갱신 (`shared/infra/http/token-refresher.ts`, `auth-client.ts`)

- **단일 인스턴스**: `TokenRefresher`는 DI(`di-provider.tsx`)에서 1개만 생성해
  auth-client의 401 훅과 부팅 검증이 공유한다. 인스턴스가 갈라지면 single-flight mutex가
  분리되어 동시 회전(토큰 패밀리 소모)이 발생한다.
- `RefreshOutcome`으로 결과를 보고한다:
  `refreshed` / `transient-failure`(네트워크·타임아웃·429·5xx·**잠긴 키체인**·저장 실패 → 토큰 보존) /
  `session-invalid`(401·2xx 파싱 실패) / `no-session`(로컬 토큰 없음).
- 클라 refresh 타임아웃 8s는 서버 reuse grace 10s보다 짧게 유지한다(회전 성공+응답 유실 시 재시도 여백).

## 세션 종료 사유의 두 축 (`core/ports/telemetry-event.ts`)

세션 **유효성**의 진실의 원천은 서버다. 그러나 "왜 클라이언트가 세션을 끝냈는가"에는
서버가 원리적으로 알 수 없는 경우가 있으므로 두 축을 분리해 관측한다.

| `reason` (클라의 결정 경로) | 서버가 아는가 | `serverErrorCode` |
|---|---|---|
| `tokens-missing` | 모름 (요청조차 안 나감) | 없음 |
| `invalid-refresh-response` | 모름 (서버는 200을 줬다) | 없음 |
| `refresh-rejected` | **안다** | `SESSION_0704`(재사용 감지) / `SESSION_0702`(만료) / `AUTH_0104` … |

`refresh-rejected`일 때는 서버의 `ErrorCode`를 그대로 실어 보낸다. 401 하나로 뭉개면
"세션이 만료됐다"와 "우리 앱이 토큰 패밀리를 태우고 있다"를 구분할 수 없다.
`session_expired`의 severity에 `info`는 없다 — 비자발적 로그아웃은 전부 조사 대상이다.

## 401은 ErrorBoundary로 새지 않는다

- `queryClient.clear()`는 만료 리스너가 아니라 `status === 'unauthenticated'` **effect**에서 호출한다.
  같은 tick에 비우면 아직 마운트된 인증 화면의 `useSuspenseQuery`가 즉시 재요청 → 401 → 다시 만료 →
  ErrorBoundary("재시도/로그아웃") 루프를 돈다.
- 인증이 끝난 뒤 도착한 401은 `(app)/_layout.tsx`의 ErrorBoundary가 통과시킨다(라우트 게이트가 화면을 바꾼다).
- **미인증 상태에서 인증 API를 호출하지 않는다.** 푸시 토큰 해제는 아직 인증된 로그아웃 플로우가 담당한다.

## 영속 계약 (변경 시 마이그레이션 필수)

| 항목 | 위치 | 바꾸면 생기는 일 |
|---|---|---|
| 토큰 키 이름 (`accessToken`/`refreshToken`) | `storage-keys.constant.ts` | 기존 설치의 토큰을 못 읽음 → 전체 로그아웃 |
| `keychainAccessible` 등 키체인 옵션 | `secure-storage.ts` | iOS 조회 쿼리엔 `kSecAttrAccessible`이 없으므로 **읽기는 깨지지 않는다**. 진짜 위험은 `SecItemUpdate`가 `kSecValueData`만 갱신해 **기존 설치의 accessibility가 영영 마이그레이션되지 않는다**는 것 |
| refresh 응답 envelope (`{ data: { accessToken, refreshToken } }`) | 서버 `v1/auth/refresh` | 클라가 2xx를 파싱 못 해 `invalid-refresh-response`로 세션 종료 |
| 토큰 키 이름을 아는 곳 | `secure-token-store.ts` **한 곳뿐** | 다른 레이어가 키를 직접 참조하면 저장 계약이 흩어진다 |

## 서버 측 운영 불변식 (apps/api)

- **`JWT_REFRESH_SECRET` 회전 = 전체 유저 즉시 로그아웃.** 불가피하면 이중 키 검증 기간을 두고 회전한다.
- `JWT_REFRESH_EXPIRES_IN`(기본 7d)은 회전 시마다 sliding 갱신되므로 활성 유저는 만료되지 않지만,
  그 기간 이상 미접속한 유저는 재로그인이 필요하다. 세션 유지 정책에 맞게 프로덕션 값을 관리한다.
- 리프레시 토큰 재사용 grace는 10s(`TOKEN_REUSE_GRACE_PERIOD_MS`) — 클라 타임아웃(8s)보다 항상 길게 유지한다.
