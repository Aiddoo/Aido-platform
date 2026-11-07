# OAuth 클라이언트 가이드

**Version**: 2.0.1 · **Last Updated**: 2026-11-08 · **Owner**: Aido Mobile Team

소셜 로그인과 계정 연결의 앱 쪽 흐름이다. 세션 수명과 토큰 규칙은 [인증 가이드](../docs/authentication_guide.md)를 본다.

## 규칙

- OAuth 클라이언트 ID와 시크릿은 API 서버가 관리한다. 앱에 두지 않는다.
- 앱은 공급자 토큰을 직접 교환하지 않는다. Google·Kakao·Naver는 서버 흐름, Apple은 네이티브 SDK다.
- 인증 UI는 시스템 브라우저(`expo-web-browser`)와 네이티브 SDK만 쓴다. WebView를 쓰지 않는다.
- 토큰은 `TokenStore` 포트로 저장한다.

## Google·Kakao·Naver: 서버 흐름

```
AuthService.openKakaoLogin()                  # openGoogleLogin·openNaverLogin도 같다
  → WebBrowser.openAuthSessionAsync(GET {API}/v1/auth/{provider}/start?redirect_uri&mode=login, redirectUri)
  → 서버가 공급자 인증을 끝내고 redirectUri로 일회용 code를 돌려준다
  → POST v1/auth/exchange { code }
  → 토큰 저장, signIn()
```

- `redirectUri`는 `makeRedirectUri({ scheme: ENV.SCHEME, path: 'auth/{provider}' })`다. scheme은 환경별로 다르다(`app.config.ts`). 서버가 `start-oauth-authorization.use-case.ts`의 허용 패턴으로 검사하므로 scheme을 바꾸면 거기도 고친다.
- Android는 `app.config.ts`의 `intentFilters`(`auth/kakao`·`auth/naver`·`auth/google`)로 콜백을 받는다. `app/auth/[provider].tsx`가 `maybeCompleteAuthSession()`을 불러 `openAuthSessionAsync`가 URL을 받게 한다.
- 화면은 `useOpen{Kakao,Google,Naver}LoginMutationOptions`로 code를 받고 `useExchangeCodeMutationOptions`에 `{ code, provider }`를 넘긴다(`app/(auth)/login.tsx`).
- 콜백 URL에 code가 없고 `error`가 있으면 그 코드의 `BusinessError`(카탈로그에 없으면 호출부 폴백 문구), 없으면 `AUTH_NO_CODE_RECEIVED`다. 창을 닫으면 `AUTH_LOGIN_CANCELLED`다.

## Apple: 네이티브

iOS에서만 버튼을 보인다(`process.env.EXPO_OS === 'ios'`). `usesAppleSignIn`은 `app.config.ts`에 있다.

```
AuthService.openAppleLogin()
  → nonce 생성, SHA-256 해시를 AppleAuthentication.signInAsync에 넘김
  → POST v1/auth/apple/callback { idToken, nonce, userName, deviceType: 'IOS' }
  → 토큰 저장
```

- Apple은 이름을 최초 로그인에만 준다. `userName`은 `fullName.givenName`이고 없으면 보내지 않는다.
- SDK 호출과 오류 변환은 `SocialAuthGateway`(`shared/infra/social-auth`)가 맡고, `AuthService`가 결과를 `AUTH_ERROR_CODE`로 옮긴다.

## 계정 연결

`AuthService.linkAccount(provider)`가 나눈다. 인증된 클라이언트로 부른다.

| 공급자             | 흐름                                                                        |
| ------------------ | --------------------------------------------------------------------------- |
| Google·Kakao·Naver | `openAuthSessionAsync(.../start?mode=link)` → `POST v1/auth/link-with-code` |
| Apple              | `signInAsync` → `POST v1/auth/link { provider: 'APPLE', idToken, nonce }`   |

해제는 `DELETE v1/auth/linked-accounts/{provider}`다. 취소는 `isLoginCancelledError`로 걸러 토스트를 띄우지 않는다.

## 분석

성공 한 번에 `auth_signup`·`auth_login` 중 하나만 보낸다. 서버 응답 `isNewUser`로 고른다. [측정 규칙](observability.md#측정-규칙)을 본다.

## 오류 코드

공통 소셜 오류는 `@aido/api/errors`의 `SOCIAL_02xx`다. 문구는 i18n `errors` 카탈로그에 있다. 서버 동작은 서버 문서를 본다.

## 콘솔 설정의 함정

- Apple은 App ID에 Sign In with Apple을 켜야 한다.
- 공급자 콘솔의 redirect URI는 서버 콜백(`*_CALLBACK_URL`, `apps/api/src/platform/config/schemas/oauth.schema.ts`)이다. 앱의 `redirectUri`를 등록하지 않는다.
