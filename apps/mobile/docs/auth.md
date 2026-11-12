# 인증: 세션 수명주기와 소셜 로그인

세션·토큰 규칙([세션](#세션-수명주기와-불변식))과 소셜 로그인·계정 연결([소셜 로그인](#소셜-로그인)), 가입·비밀번호 폼([폼과 단계](#폼과-단계))을 다룬다. 인증 상태는 `useAuthStatus()`로 읽고 `useAuthSession()`의 `signIn`·`signOut`으로 쓴다. 토큰은 `TokenStore` 포트(SecureStore)에 둔다.

층은 `features/identity/auth`에 있다. 서버 호출은 `apis/auth.api.ts`(`AuthApi`), 소셜 인증 창·토큰 저장·탈퇴 뒤 토큰 삭제는 `services/sign-in.service.ts`(`SignInService`), 로그아웃은 `LogOutDeviceService`, 오프라인 로그아웃 해제는 `SessionRevocationService`, 미인증 뒤 정리는 `SessionCleanupService`, 인증 상태 기계는 `stores/auth-session.store.ts`다. 추적은 mutation 옵션(`queries/auth.mutations.ts`), 화면 이동과 칸 오류·로그인하러 가기 같은 화면 안내는 `mutateAsync`를 부른 폼이 한다.

# 세션 수명주기와 불변식

## 핵심 불변식: 클라이언트는 세션을 먼저 끊지 않는다

**토큰을 지우는 경로는 두 가지뿐이다.**

1. 사용자의 명시적 로그아웃(`LogOutDeviceService`)·탈퇴(`SignInService.deleteAccount`)
2. `SessionManager.end()`: 서버의 확정적 refresh 거부, 2xx 응답 파싱 실패, 로컬 토큰 부재

구조가 이 불변식을 강제한다. `TokenRefresher`에는 토큰 삭제도 이벤트 발행도 없다. 갱신기는 `RefreshOutcome`을 돌려줄 뿐이고 세션 수명은 `SessionManager`(`core/session/session-manager.ts`)만 소유한다. 갱신기가 세션을 끝낼 수 있던 것이 v1.4.0 사고의 구조적 원인이었다.

그 외 어떤 코드도 토큰을 지우지 않는다. 특히:

- **로컬 휴리스틱(플래그·앱 버전·MMKV 상태 비교)으로 토큰을 선제 삭제하지 않는다.** MMKV 플래그 부재는 재설치뿐 아니라 그 플래그가 없던 구버전에서의 업데이트도 뜻한다. v1.3.5의 첫 실행 가드가 이 오판으로 업데이트한 전체 유저를 강제 로그아웃시켰다(v1.4.0 사고, PR #591의 회귀).
- **부팅 시 인증 상태를 네트워크 결과에 걸지 않는다.** 오프라인·서버 장애 중에도 리프레시 토큰이 있으면 인증 상태로 시작한다(`resolve-initial-auth-status.ts`, 회귀 테스트는 같은 이름의 `.test.ts`).

## 부팅 흐름 (`bootstrap/auth/resolve-initial-auth-status.ts`)

부팅은 읽기 전용이다. 토큰을 지우지도, 저장하지도, 네트워크를 타지도 않는다.

| `getRefreshToken()` | 상태                                                             |
| ------------------- | ---------------------------------------------------------------- |
| 값 있음             | `authenticated`                                                  |
| `null`              | `unauthenticated`                                                |
| throw (기기 잠김)   | `locked`: 판정을 미루고 앱 복귀(`AppLifecycleGateway`) 때 재판정 |

- 잠금이 아닌 읽기 실패는 그대로 던진다. `useAuthBoot`가 관측하고 미인증으로 폴백한다. 토큰은 지우지 않으므로 다음 실행에 회복할 수 있다. `locked`로 뭉개면 재판정도 계속 실패해 무한 로딩에 갇힌다.
- `locked`를 `unauthenticated`로 확정하면 잠긴 키체인이 곧 로그아웃이 된다. iOS `getItemAsync`는 잠금 중 `null`이 아니라 throw한다.
- 첫 실행 플래그와 부팅 세션 검증은 두지 않는다. 플래그는 위 오판을 만들고, 부팅 검증은 얻는 것 없이 강제 로그아웃 표면만 넓힌다. 첫 인증 요청의 401 경로가 어차피 갱신한다.

## 인증 상태 (`features/identity/auth/domains/auth-session.model.ts`)

상태는 순수 전이 함수 `transitionAuthSession`과 DI가 소유하는 저장소(`stores/auth-session.store.ts`)가 관리한다. 화면은 `useAuthStatus()`로 읽고 `useAuthSession()`의 `signIn()`, `signOut()`으로 쓴다.

| 이벤트           | 반영되는 상태       | 결과                                      |
| ---------------- | ------------------- | ----------------------------------------- |
| `bootResolved`   | `loading`, `locked` | 판정 결과. 토큰 없음은 미인증(`none`)     |
| `bootFailed`     | `loading`, `locked` | 미인증(`boot-failed`). 토큰은 지우지 않음 |
| `signedIn`       | 전부                | `authenticated`                           |
| `signedOut`      | 전부                | 미인증(`signed-out`). 초안까지 지움       |
| `sessionExpired` | `authenticated`     | 미인증(`expired`). 초안을 남김            |

시작 판정, 잠금 해제 재판정, 만료 구독, 커밋 뒤 정리는 `bootstrap/hooks/use-auth-boot.ts`가 맡는다. `QueryErrorBoundary` 아래에 두면 오류 화면에서 만료 구독이 끊기므로 `AuthBootProvider`에서 부른다.

## 토큰 갱신 (`shared/infra/http/token-refresher.ts`, `token-refresh-hook.ts`)

- **단일 인스턴스**: `TokenRefresher`는 `create-device-ports.ts`가 1개만 만들어 auth-client의 401 훅에 넘기고, `composition-root.ts`가 프로세스에 한 번만 부른다. 인스턴스가 갈라지면 single-flight가 분리되어 동시 회전으로 토큰 패밀리를 소모한다. 루트 "다시 시도"는 화면 수명 컨테이너만 다시 만들어 갱신기·`TokenStore`·`SessionEpoch`가 그대로다.
- resolve는 확정 판정, reject는 일시 장애다.
- 갱신은 토큰·세션이 거부된 401(`AUTH_0101`~`0107`, `SESSION_0701`~`0704`)과 코드를 읽지 못한 401에만 한다. 비밀번호가 틀린 `USER_0602` 같은 업무 401은 갱신·재전송·Sentry 보고 없이 그대로 돌려준다(`token-refresh-hook.ts`).

| 결과                                 | 사유                                            | 처리                                      |
| ------------------------------------ | ----------------------------------------------- | ----------------------------------------- |
| `{ kind: 'refreshed', accessToken }` | 새 토큰 저장 성공                               | 원 요청을 새 토큰으로 재시도              |
| `{ kind: 'invalid', details }`       | 401 거부, 2xx 파싱 실패, 로컬 토큰 없음         | `SessionManager.end(details)`             |
| 인프라 에러 throw                    | 네트워크·타임아웃·429·5xx·잠긴 키체인·저장 실패 | 토큰 보존. React Query 재시도 정책이 처리 |

- 클라이언트 refresh 타임아웃 8초(`REFRESH_TIMEOUT_MS`)는 서버 reuse grace 10초보다 짧게 둔다. 회전 성공 뒤 응답이 유실돼도 재시도할 여백이다.

## 세션 종료 사유의 두 축

세션 종료 이벤트의 타입은 `core/observability/telemetry-event.ts`에 있다. 세션 유효성의 진실의 원천은 서버다. 그러나 왜 클라이언트가 세션을 끝냈는지는 서버가 모를 수 있어 두 축을 나눠 관측한다.

| `reason` (클라의 결정 경로) | 서버가 아는가          | `serverErrorCode`                                              |
| --------------------------- | ---------------------- | -------------------------------------------------------------- |
| `tokens-missing`            | 모름 (요청이 안 나감)  | 없음                                                           |
| `invalid-refresh-response`  | 모름 (서버는 200을 줌) | 없음                                                           |
| `refresh-rejected`          | 안다                   | `SESSION_0704`(재사용 감지), `SESSION_0702`(만료) 등 서버 코드 |

`refresh-rejected`는 서버의 `ErrorCode`를 그대로 실어 보낸다. 401 하나로 뭉개면 "세션이 만료됐다"와 "앱이 토큰 패밀리를 태우고 있다"를 구분할 수 없다. severity는 [observability.md](./observability.md#severity)를 본다.

이미 로그아웃된 앱이 낸 401은 세션 만료가 아니다. `useAuthBoot`가 `authenticated`일 때만 `session_expired`를 보낸다. 없으면 로그인한 적 없는 유저의 이벤트가 진짜 세션 유실을 묻는다.

## 401은 ErrorBoundary로 새지 않는다

- 캐시 정리(`SessionCleanupService`)는 만료 리스너가 아니라 `status === 'unauthenticated'` effect에서 부른다. 같은 tick에 비우면 아직 마운트된 인증 화면의 `useSuspenseQuery`가 즉시 재요청 → 401 → 다시 만료 → ErrorBoundary 루프를 돈다.
- 인증이 끝난 뒤 도착한 401은 `(app)/_layout.tsx`의 ErrorBoundary가 통과시킨다. 라우트 게이트가 화면을 바꾼다.
- 미인증 상태에서 인증 API를 부르지 않는다. 푸시 토큰 해제는 아직 인증된 로그아웃 흐름(`LogOutDeviceService`)이 맡는다.

## 끝난 세션의 늦은 응답

토큰을 지우면 `SessionEpoch`(`core/session/session-epoch.ts`)가 오른다. `withSessionEpoch`가 `TokenStore.clear`에 걸려 있어 삭제 경로를 빠뜨릴 수 없다. 저장은 세대를 올리지 않는다.

| 늦게 온 것                  | 막지 않으면                                    | 동작                                                          |
| --------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| 갱신 200                    | 로그아웃한 토큰이 되살아난다                   | `TokenRefresher`가 저장 전에 비교해 `superseded`, 저장 안 함  |
| 갱신 401                    | 다음 계정의 토큰이 지워진다                    | `invalid` 대신 `superseded`, 세션 종료 안 함                  |
| A가 보낸 요청의 401         | A의 요청이 저장된 B 토큰으로 B 계정에서 실행됨 | 보낸 세대를 ky `context`에 남겨 비교, 재시도·갱신 없이 원 401 |
| 진행 중 갱신(다음 세션에서) | 다음 세션이 지난 세션의 결과를 받는다          | 세대가 다르면 공유하지 않는다                                 |
| 로그아웃 응답               | 만료 뒤 다시 로그인한 새 세션이 끝난다         | `LogOutDeviceService`가 비교, 아래 참고                       |

로그아웃은 자기 `clear`로도 세대를 올리고, 만료가 먼저 와도 사용자가 나간 것으로 끝내야 한다(초안 삭제, `auth_logout`). 그래서 세대만으로 끝내지 않는다. 세대가 그대로면 토큰을 지우고 끝낸다. 세대가 올랐으면 서버 로그아웃과 토큰 삭제를 건너뛰고, 저장소에 토큰이 없을 때만 끝낸다. 토큰이 있거나 읽지 못하면 새 세션으로 보고 `auth_logout`, `clearUser()`, `signOut`을 하지 않는다.

`save` 도중의 `clear`는 ms 창이라 다루지 않는다. ky의 `timeout`은 요청 한 번의 응답 대기라 `afterResponse` 훅을 덮지 않는다. 로그아웃 POST 자신의 401은 갱신이 끝날 때까지 기다리고, 그 대기(최대 8초)는 `LOGOUT_REQUEST_TIMEOUT_MS`에 들어가지 않는다.

## 로그아웃과 로컬 데이터

- `LogOutDeviceService`는 서버 정리(푸시 토큰 해제·로그아웃)를 최선 노력으로 하고 토큰을 지운다. 기다리는 사이 세션이 만료됐으면 토큰은 이미 지워졌으니 다시 지우지 않는다([끝난 세션의 늦은 응답](#끝난-세션의-늦은-응답)). 요청 하나의 상한은 3초(`LOGOUT_REQUEST_TIMEOUT_MS`)다. 앱 오류 화면의 로그아웃도 같은 경로다.
- 정리는 `SessionCleanupService`가 미인증 전환이 커밋된 뒤 한다. 한 단계가 실패해도 나머지를 계속한다.
- 조회 캐시는 세션 만료 때도 지운다. 다음에 로그인한 사람에게 복원되지 않게 하기 위해서다.
- 진행 중 mutation은 요청을 끊지 않고 콜백만 비운다. `clear`는 취소하지 않아서, 그대로 두면 롤백이 지운 캐시를 채운다. 마운트된 관찰자가 다시 그려지면 콜백이 복구되므로 로그인 직전에 조회 캐시를 한 번 더 비운다.
- OS 알림 센터에 도착한 알림은 로그아웃·탈퇴·세션 만료 때 지운다([푸시 알림](./push-notifications.md#로그아웃과-배지)).
- 초안과 말로 메모하기 녹음은 사용자가 로그아웃·탈퇴했을 때만 지운다. 세션 만료 때는 남기고, 다른 사용자가 로그인하면 `useClaimDeviceDataForUser`가 이전 소유자의 것을 지운다.
- 이어서 열 초대(`pendingRedemptionStoredValue`)는 계정 구분이 없어 로그아웃·탈퇴 때 지운다. 세션 만료 때는 같은 사람이 돌아온다고 보고 남기므로, 만료 뒤 다른 계정이 로그인하면 그 계정이 초대를 받는다(의도, `SignOutEpoch`와 같은 가정).
- 탈퇴는 요청 전에 계정 id를 내 정보(캐시, 없으면 서버)로 정하고 `beforeAccountDeletion`에 남긴다. 탈퇴 뒤에는 서버가 내 정보를 주지 않기 때문이다. 받지 못하면 탈퇴는 이어 가고 `auth.account-deletion.owner-unknown`을 남긴다. 그 계정의 안내 기록은 로그아웃 정리(`afterSignedOut`)가 지운다.
- 탈퇴 요청이 서버에 닿았을 수 있는데 응답을 받지 못하면(시간 초과, 온라인에서 연결 끊김) 서버가 지웠는지 모른다(`afterAccountDeletionUnanswered`). 이어서 세션이 만료되거나 로그아웃하면 로그아웃처럼 초안·녹음·안내 기록까지 지운다. 모르는 것은 지운 것이 아니라서 그 뒤 인증 요청이 하나라도 성공하거나(`session-confirmed`, 응답을 기다리는 동안 온 성공은 보지 않는다) 다시 로그인하면 잊는다. fetch는 보내기 전 실패와 보낸 뒤 끊김을 가르지 못해 온라인 연결 오류는 닿았을 수 있다고 본다.
- 서버가 거절한 탈퇴(비밀번호 오류 등)와 오프라인이라 기기를 떠나지 못한 탈퇴는 `afterAccountDeletionRejected`로 잊는다. 만료 때 초안을, 로그아웃 때 안내 기록을 남긴다.

## 오프라인 로그아웃

토큰을 지우면 인증 요청을 보낼 수 없어, 그대로 두면 서버 세션과 푸시 기기가 남는다. 서버에 닿지 못한 로그아웃(오프라인, 시간 초과, 연결 실패, 5xx)은 refresh 토큰을 `pendingRevocation`에 기록하고 나서 토큰을 지운다. 서버가 답한 4xx는 기록하지 않는다. 푸시 기기는 이 기록과 따로 기기 id와 토큰으로 푼다(세션 만료 포함, [푸시 알림](./push-notifications.md#로그아웃과-배지)).

| 시점                                       | 동작                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 앱 시작, 연결 복귀, 포그라운드 복귀        | `requestRefresh` → 공개 클라이언트로 `POST v1/auth/logout` → 기록 삭제                     |
| 갱신 또는 로그아웃의 네트워크 실패·429·5xx | 기록을 남겨 다음 복귀에 다시 시도. 회전한 뒤면 새 refresh 토큰으로 덮어 재사용 감지를 피함 |
| 갱신 401 등 4xx, 로그아웃 4xx              | 세션이 이미 끝난 것이라 기록만 지운다                                                      |
| 기록 후 24시간 경과                        | 네트워크 없이 기록을 지운다. 서버 세션은 refresh 만료(최대 7일)까지 남는다                 |
| 다른 계정으로 로그인한 뒤                  | 지난 계정 토큰으로만 요청한다. 지금 계정의 토큰과 세션 상태는 건드리지 않는다              |

- **`authHttpClient`를 쓰지 않는다.** 401에 저장된 토큰으로 갱신하고 세션을 끝내므로 지난 계정의 실패가 지금 계정을 로그아웃시킨다.
- **TTL 24시간:** 로그아웃한 기기에 refresh 토큰이 남는 시간이라 짧을수록 좋다. 가장 긴 직항 비행(약 19시간)과 지하철·해외 도착 직후 복귀를 덮는다. 7일(refresh 수명)보다 길면 의미가 없다.
- 슬롯은 하나다. 해제 전에 다른 계정으로 또 오프라인 로그아웃하면 앞의 기록을 덮고, 앞 세션은 refresh 만료에 맡긴다.
- 이 기록은 부팅 판정에 쓰이지 않는다. 부팅 판정은 여전히 읽기만 하고 네트워크를 타지 않는다.
- 토큰 값을 로그에 남기지 않는다.

## 영속 계약 (변경 시 마이그레이션 필수)

| 항목                                                              | 위치                                    | 바꾸면 생기는 일                                                                                                                                                               |
| ----------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 토큰 키 이름 (`accessToken`·`refreshToken`)                       | `shared/storage/secure-storage-keys.ts` | 기존 설치의 토큰을 못 읽어 전체 로그아웃                                                                                                                                       |
| `keychainAccessible` 등 키체인 옵션                               | `secure-storage.ts`                     | iOS 조회 쿼리엔 `kSecAttrAccessible`이 없어 읽기는 깨지지 않는다. 진짜 위험은 `SecItemUpdate`가 `kSecValueData`만 갱신해 기존 설치의 accessibility가 영영 옮겨지지 않는 것이다 |
| refresh 응답 envelope (`{ data: { accessToken, refreshToken } }`) | 서버 `v1/auth/refresh`                  | 클라이언트가 2xx를 파싱 못 해 `invalid-refresh-response`로 세션 종료                                                                                                           |
| 토큰 키를 읽고 쓰는 곳                                            | `secure-token-store.ts` 한 곳           | 다른 레이어가 키를 직접 참조하면 저장 계약이 흩어진다                                                                                                                          |
| 해제 대기 키 (`pendingRevocation`, `{ refreshToken, expiresAt }`) | `pending-revocation.repository.ts`      | 기록한 세션을 풀지 못한다. 토큰 키와 달리 잃어도 로그아웃되지는 않는다                                                                                                         |

서버 쪽 운영 불변식(refresh 비밀 회전, 만료, 재사용 grace)은 [서버 보안](../../api/docs/security.md#세션-토큰-운영-불변식)에 있다.

# 소셜 로그인

소셜 로그인과 계정 연결의 앱 쪽 흐름이다. 세션 수명과 토큰 규칙은 위 [세션](#세션-수명주기와-불변식)을 본다.

## 규칙

- OAuth 클라이언트 ID와 시크릿은 API 서버가 관리한다. 앱에 두지 않는다.
- 앱은 공급자 토큰을 직접 교환하지 않는다. Google·Kakao·Naver는 서버 흐름, Apple은 네이티브 SDK다.
- 인증 UI는 시스템 브라우저(`expo-web-browser`)와 네이티브 SDK만 쓴다. WebView를 쓰지 않는다.
- 토큰은 `TokenStore` 포트로 저장한다.

## Google·Kakao·Naver: 서버 흐름

```
SignInService.openKakaoLogin()                # openGoogleLogin·openNaverLogin도 같다
  → WebBrowser.openAuthSessionAsync(GET {API}/v1/auth/{provider}/start?redirect_uri&mode=login, redirectUri)
  → 서버가 공급자 인증을 끝내고 redirectUri로 일회용 code를 돌려준다
  → SignInService.exchangeCode: AuthApi.exchangeCode(POST v1/auth/exchange { code }) → 토큰 저장
  → mutation onSuccess: signIn(), auth_login 또는 auth_signup
```

- `redirectUri`는 `makeRedirectUri({ scheme: ENV.SCHEME, path: 'auth/{provider}' })`다. scheme은 환경별로 다르다(`app.config.ts`). 서버가 `start-oauth-authorization.use-case.ts`의 허용 패턴으로 검사하므로 scheme을 바꾸면 거기도 고친다.
- Android는 `app.config.ts`의 `intentFilters`(`auth/kakao`·`auth/naver`·`auth/google`)로 콜백을 받는다. `app/auth/[provider].tsx`가 `maybeCompleteAuthSession()`을 불러 `openAuthSessionAsync`가 URL을 받게 한다. 인증 판정 전(`loading`)·잠긴 키체인(`locked`)에서 열리면 첫 화면처럼 `/loading`에서 판정을 기다린다(미인증으로 보지 않는다).
- 화면은 `useOpen{Kakao,Google,Naver}LoginMutationOptions`로 code를 받고 `useExchangeCodeMutationOptions`에 `{ code, provider }`를 넘긴다(`components/social-login-buttons.tsx`).
- 콜백 URL에 code가 없고 `error`가 있으면 그 코드의 `BusinessError`(카탈로그에 없으면 호출부 폴백 문구), 없으면 `AUTH_NO_CODE_RECEIVED`다. 창을 닫으면 `AUTH_LOGIN_CANCELLED`다.

## Apple: 네이티브

iOS에서만 버튼을 보인다(`process.env.EXPO_OS === 'ios'`). `usesAppleSignIn`은 `app.config.ts`에 있다.

```
SignInService.openAppleLogin()
  → SocialAuthGateway.signInWithApple(): nonce 생성, SHA-256 해시를 AppleAuthentication.signInAsync에 넘김
  → toAppleSignInRequest → AuthApi.signInWithApple(POST v1/auth/apple/callback { idToken, nonce, userName, deviceType })
  → 토큰 저장
```

- Apple은 이름을 최초 로그인에만 준다. `userName`은 `fullName.givenName`이고 없으면 보내지 않는다.
- SDK 호출과 오류 변환은 `SocialAuthGateway`(`shared/infra/social-auth`)가 맡고, `SignInService`가 결과를 `AUTH_ERROR_CODE`로 옮긴다.
- 토큰 저장이 실패하면(잠긴 키체인) `SignInService`가 던져 로그인 mutation이 실패로 끝나고 인증 상태는 바뀌지 않는다.

## 계정 연결

`SignInService.linkAccount(provider)`가 나눈다. 인증된 클라이언트로 부르고 토큰은 저장하지 않는다. 성공하면 연결 계정과 내 정보를 다시 받는다(`invalidateLinkedAccounts`·`invalidateMe`).

| 공급자             | 흐름                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Google·Kakao·Naver | `openAuthSessionAsync(.../start?mode=link)` → `POST v1/auth/link-with-code`                          |
| Apple              | `signInAsync` → `POST v1/auth/link { provider: 'APPLE', idToken, nonce }`(`AuthApi.linkWithIdToken`) |

해제는 `DELETE v1/auth/linked-accounts/{provider}`다. 취소는 `isLoginCancelledError`로 걸러 토스트를 띄우지 않는다.

## 분석·오류·콘솔 설정

- 성공 한 번에 `auth_signup`·`auth_login` 중 하나만 보낸다. 서버 응답 `isNewUser`로 고른다([측정 규칙](./observability.md#측정-규칙)). 실패·단계·확정 결과 이벤트는 [`auth.events.ts`](../src/features/identity/auth/constants/auth.events.ts)에 있다.
- 공통 소셜 오류는 `@aido/api/errors`의 `SOCIAL_02xx`이고 문구는 i18n `errors` 카탈로그에 있다.
- 공급자 콘솔 설정(Apple App ID, redirect URI)은 [서버 설정](../../api/docs/configuration.md#소셜-로그인-콘솔)에 있다.

# 폼과 단계

가입(`app/(auth)/sign-up.tsx`), 비밀번호 찾기·바꾸기는 `useStepper` 흐름이다. 단계 표와 같은 렌더러 규칙은 [hooks](./architecture/hooks.md#usestepper), 버튼 상태는 [data](./architecture/data.md#폼)에 있다. 현재 비밀번호가 틀리면(`USER_0602`) `findPasswordFieldError`로 그 칸에 보인다(바꾸기는 `currentPassword` 단계로 돌아가고 탈퇴는 `password` 칸에 포커스). 가입 중복 이메일은 로그인하러 가기 동작이 있는 토스트다. 재설정 코드가 마지막 제출에서 거절되면(`VERIFY_0751`·`0752`·`0754`, `findVerificationCodeFieldError`) 문구는 전역 피드백이 `errors` 카탈로그로 보이고, 폼은 `code` 칸에 오류를 두고 새 비밀번호를 지킨 채 코드 단계로 돌아가 칸을 오류 상태로 연다. 화면 이동(인증 화면으로, 로그인으로, 앞 화면으로)은 mutation 옵션이 아니라 폼이 `mutateAsync` 뒤에 한다.
