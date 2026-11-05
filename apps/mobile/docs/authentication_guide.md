# 인증 가이드: 세션 수명주기와 불변식

> **Owner**: Aido Mobile Team · **Last Updated**: 2026-11-06

OAuth 로그인 흐름은 [oauth-client-guide](../.claude/oauth-client-guide.md)를 본다.

## 핵심 불변식: 클라이언트는 세션을 먼저 끊지 않는다

**토큰을 지우는 경로는 두 가지뿐이다.**

1. 사용자의 명시적 로그아웃·탈퇴(`AuthService`)
2. `SessionManager.end()`: 서버의 확정적 refresh 거부, 2xx 응답 파싱 실패, 로컬 토큰 부재

구조가 이 불변식을 강제한다. `TokenRefresher`에는 토큰 삭제도 이벤트 발행도 없다. 갱신기는 `RefreshOutcome`을 돌려줄 뿐이고 세션 수명은 `SessionManager`(`core/session/session-manager.ts`)만 소유한다. 갱신기가 세션을 끝낼 수 있던 것이 v1.4.0 사고의 구조적 원인이었다.

그 외 어떤 코드도 토큰을 지우지 않는다. 특히:

- **로컬 휴리스틱(플래그·앱 버전·MMKV 상태 비교)으로 토큰을 선제 삭제하지 않는다.** MMKV 플래그 부재는 재설치뿐 아니라 그 플래그가 없던 구버전에서의 업데이트도 뜻한다. v1.3.5의 첫 실행 가드가 이 오판으로 업데이트한 전체 유저를 강제 로그아웃시켰다(v1.4.0 사고, PR #591의 회귀).
- **부팅 시 인증 상태를 네트워크 결과에 걸지 않는다.** 오프라인·서버 장애 중에도 리프레시 토큰이 있으면 인증 상태로 시작한다(`auth-boot.ts`).

`auth-boot.test.ts`가 회귀 테스트다.

## 부팅 흐름 (`bootstrap/providers/auth-boot.ts`)

부팅은 읽기 전용이다. 토큰을 지우지도, 저장하지도, 네트워크를 타지도 않는다.

| `readRefreshToken()` | 상태                                              |
| -------------------- | ------------------------------------------------- |
| 값 있음              | `authenticated`                                   |
| `null`               | `unauthenticated`                                 |
| throw (기기 잠김)    | `locked`: 판정을 미루고 `AppState` 복귀 시 재판정 |

- 잠금이 아닌 읽기 실패는 그대로 던진다. `AuthProvider`가 관측하고 미인증으로 폴백한다. 토큰은 지우지 않으므로 다음 실행에 회복할 수 있다. `locked`로 뭉개면 재판정도 계속 실패해 무한 로딩에 갇힌다.
- `locked`를 `unauthenticated`로 확정하면 잠긴 키체인이 곧 로그아웃이 된다. iOS `getItemAsync`는 잠금 중 `null`이 아니라 throw한다.
- 첫 실행 플래그와 부팅 세션 검증은 두지 않는다. 플래그는 위 오판을 만들고, 부팅 검증은 얻는 것 없이 강제 로그아웃 표면만 넓힌다. 첫 인증 요청의 401 경로가 어차피 갱신한다.

## 토큰 갱신 (`shared/infra/http/token-refresher.ts`, `token-refresh-hook.ts`)

- **단일 인스턴스**: `TokenRefresher`는 `di-provider.tsx`에서 1개만 만들어 auth-client의 401 훅에 넘긴다. 인스턴스가 갈라지면 single-flight가 분리되어 동시 회전으로 토큰 패밀리를 소모한다.
- resolve는 확정 판정, reject는 일시 장애다.

| 결과                                 | 사유                                            | 처리                                      |
| ------------------------------------ | ----------------------------------------------- | ----------------------------------------- |
| `{ kind: 'refreshed', accessToken }` | 새 토큰 저장 성공                               | 원 요청을 새 토큰으로 재시도              |
| `{ kind: 'invalid', details }`       | 401 거부, 2xx 파싱 실패, 로컬 토큰 없음         | `SessionManager.end(details)`             |
| 인프라 에러 throw                    | 네트워크·타임아웃·429·5xx·잠긴 키체인·저장 실패 | 토큰 보존. React Query 재시도 정책이 처리 |

- 클라이언트 refresh 타임아웃 8초(`REFRESH_TIMEOUT_MS`)는 서버 reuse grace 10초보다 짧게 둔다. 회전 성공 뒤 응답이 유실돼도 재시도할 여백이다.

## 세션 종료 사유의 두 축 (`core/ports/telemetry-event.ts`)

세션 유효성의 진실의 원천은 서버다. 그러나 왜 클라이언트가 세션을 끝냈는지는 서버가 모를 수 있어 두 축을 나눠 관측한다.

| `reason` (클라의 결정 경로) | 서버가 아는가          | `serverErrorCode`                                              |
| --------------------------- | ---------------------- | -------------------------------------------------------------- |
| `tokens-missing`            | 모름 (요청이 안 나감)  | 없음                                                           |
| `invalid-refresh-response`  | 모름 (서버는 200을 줌) | 없음                                                           |
| `refresh-rejected`          | 안다                   | `SESSION_0704`(재사용 감지), `SESSION_0702`(만료) 등 서버 코드 |

`refresh-rejected`는 서버의 `ErrorCode`를 그대로 실어 보낸다. 401 하나로 뭉개면 "세션이 만료됐다"와 "앱이 토큰 패밀리를 태우고 있다"를 구분할 수 없다. severity는 [observability.md](../.claude/observability.md#severity)를 본다.

이미 로그아웃된 앱이 낸 401은 세션 만료가 아니다. `AuthProvider`가 `authenticated`일 때만 `session_expired`를 보낸다. 없으면 로그인한 적 없는 유저의 이벤트가 진짜 세션 유실을 묻는다.

## 401은 ErrorBoundary로 새지 않는다

- `queryClient.clear()`는 만료 리스너가 아니라 `status === 'unauthenticated'` effect에서 부른다. 같은 tick에 비우면 아직 마운트된 인증 화면의 `useSuspenseQuery`가 즉시 재요청 → 401 → 다시 만료 → ErrorBoundary 루프를 돈다.
- 인증이 끝난 뒤 도착한 401은 `(app)/_layout.tsx`의 ErrorBoundary가 통과시킨다. 라우트 게이트가 화면을 바꾼다.
- 미인증 상태에서 인증 API를 부르지 않는다. 푸시 토큰 해제는 아직 인증된 로그아웃 흐름(`logOutDevice`)이 맡는다.

## 로그아웃과 로컬 데이터

- `logOutDevice`는 서버 정리(푸시 토큰 해제·로그아웃)를 최선 노력으로 하고 토큰은 항상 지운다. 요청 하나의 상한은 3초(`LOGOUT_REQUEST_TIMEOUT_MS`)다. 오프라인이면 서버 호출 없이 지운다.
- 조회 캐시는 세션 만료 때도 지운다. 다음에 로그인한 사람에게 복원되지 않게 하기 위해서다.
- 초안과 말로 메모하기 녹음은 사용자가 로그아웃·탈퇴했을 때만 지운다. 세션 만료 때는 남기고, 다른 사용자가 로그인하면 `useUserIdentity`가 이전 소유자의 것을 지운다.

## 영속 계약 (변경 시 마이그레이션 필수)

| 항목                                                              | 위치                               | 바꾸면 생기는 일                                                                                                                                                               |
| ----------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 토큰 키 이름 (`accessToken`·`refreshToken`)                       | `shared/constants/storage-keys.ts` | 기존 설치의 토큰을 못 읽어 전체 로그아웃                                                                                                                                       |
| `keychainAccessible` 등 키체인 옵션                               | `secure-storage.ts`                | iOS 조회 쿼리엔 `kSecAttrAccessible`이 없어 읽기는 깨지지 않는다. 진짜 위험은 `SecItemUpdate`가 `kSecValueData`만 갱신해 기존 설치의 accessibility가 영영 옮겨지지 않는 것이다 |
| refresh 응답 envelope (`{ data: { accessToken, refreshToken } }`) | 서버 `v1/auth/refresh`             | 클라이언트가 2xx를 파싱 못 해 `invalid-refresh-response`로 세션 종료                                                                                                           |
| 토큰 키를 읽고 쓰는 곳                                            | `secure-token-store.ts` 한 곳      | 다른 레이어가 키를 직접 참조하면 저장 계약이 흩어진다                                                                                                                          |

## 서버 측 운영 불변식 (apps/api)

- `JWT_REFRESH_SECRET` 회전은 전체 유저 즉시 로그아웃이다. 불가피하면 이중 키 검증 기간을 두고 회전한다.
- `JWT_REFRESH_EXPIRES_IN`(기본 7d)은 회전 때마다 새로 계산되어 활성 유저는 만료되지 않는다. 그 기간 이상 접속하지 않은 유저는 다시 로그인한다.
- 리프레시 토큰 재사용 grace는 10초(`TOKEN_REUSE_GRACE_PERIOD_MS`)다. 클라이언트 타임아웃(8초)보다 항상 길게 둔다.
