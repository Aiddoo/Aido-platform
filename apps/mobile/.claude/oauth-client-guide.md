# OAuth 클라이언트 구현 가이드

Expo + React Native 환경에서 OAuth 소셜 로그인을 구현하는 상세 가이드.

---

## 목차

1. [Apple Sign In](#apple-sign-in)
2. [Google OAuth](#google-oauth)
3. [Kakao OAuth](#kakao-oauth)
4. [Naver OAuth](#naver-oauth)
5. [공통 패턴](#공통-패턴)

---

## Apple Sign In

### 라이브러리

```bash
npx expo install expo-apple-authentication
```

### Developer Console 설정

1. [Apple Developer Console](https://developer.apple.com) → Certificates, Identifiers & Profiles
2. App ID에서 "Sign In with Apple" 활성화
3. `app.json`에 entitlement 추가:

```json
{
  "expo": {
    "ios": {
      "usesAppleSignIn": true
    }
  }
}
```

### 클라이언트 구현

```typescript
import * as AppleAuthentication from "expo-apple-authentication";

async function signInWithApple() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
    ],
  });

  // 백엔드로 전송
  const response = await fetch("/auth/apple/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken: credential.identityToken,
      userName: credential.fullName
        ? `${credential.fullName.givenName ?? ""} ${credential.fullName.familyName ?? ""}`.trim()
        : undefined,
    }),
  });

  return response.json(); // { accessToken, refreshToken }
}
```

### 주의사항

- Apple은 **최초 로그인 시에만** email/name을 제공합니다
- "Hide My Email" 선택 시 `random@privaterelay.appleid.com` 형식
- Identity Token은 JWT 형식이며, 백엔드에서 Apple 공개키로 검증합니다
- iOS 전용 (Android에서는 웹 OAuth 필요)

---

## Google OAuth

### 라이브러리

```bash
npx expo install expo-auth-session expo-crypto expo-web-browser
```

### Developer Console 설정

1. [Google Cloud Console](https://console.cloud.google.com) → API & Services → Credentials
2. OAuth 2.0 Client ID 생성:
   - **iOS**: Bundle ID 입력
   - **Android**: SHA-1 fingerprint 입력
   - **Web**: Authorized redirect URI 설정
3. 환경별 Client ID가 다르므로 정확히 구분 필요

### 클라이언트 구현

```typescript
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: "YOUR_IOS_CLIENT_ID",
    androidClientId: "YOUR_ANDROID_CLIENT_ID",
    webClientId: "YOUR_WEB_CLIENT_ID",
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      handleGoogleLogin(id_token);
    }
  }, [response]);

  return { request, promptAsync };
}

async function handleGoogleLogin(idToken: string) {
  const response = await fetch("/auth/google/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  return response.json(); // { accessToken, refreshToken }
}
```

### 주의사항

- ID Token은 약 1시간 유효, 만료 후 재인증 필요
- 시스템 브라우저를 사용하므로 WebView보다 보안적으로 우수
- `webClientId`는 백엔드 검증에 사용되므로 반드시 포함

---

## Kakao OAuth

### 라이브러리

```bash
npx expo install expo-auth-session expo-crypto expo-web-browser
```

### Developer Console 설정

1. [Kakao Developers](https://developers.kakao.com) → 앱 등록
2. 플랫폼 등록: iOS Bundle ID, Android 패키지명
3. 카카오 로그인 → 활성화
4. 동의항목 설정: 닉네임, 이메일, 프로필 사진 등

### 클라이언트 구현

```typescript
import { makeRedirectUri, useAuthRequest } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const KAKAO_REST_API_KEY = "YOUR_REST_API_KEY";
const discovery = {
  authorizationEndpoint: "https://kauth.kakao.com/oauth/authorize",
  tokenEndpoint: "https://kauth.kakao.com/oauth/token",
};

function useKakaoAuth() {
  const redirectUri = makeRedirectUri({ scheme: "your-app-scheme" });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: KAKAO_REST_API_KEY,
      redirectUri,
      scopes: ["profile_nickname", "account_email"],
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type === "success") {
      exchangeCodeForToken(response.params.code, redirectUri);
    }
  }, [response]);

  return { request, promptAsync };
}

async function exchangeCodeForToken(code: string, redirectUri: string) {
  // Authorization Code → Access Token 교환
  const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: KAKAO_REST_API_KEY,
      redirect_uri: redirectUri,
      code,
    }).toString(),
  });

  const { access_token } = await tokenResponse.json();

  // Access Token으로 사용자 정보 조회
  const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const userData = await userResponse.json();

  // 백엔드로 전송
  const response = await fetch("/auth/kakao/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken: access_token,
      profile: {
        id: String(userData.id), // 숫자 → 문자열 변환 필수
        email: userData.kakao_account?.email,
        emailVerified: userData.kakao_account?.is_email_verified,
        name: userData.properties?.nickname,
        picture: userData.properties?.profile_image,
      },
    }),
  });

  return response.json(); // { accessToken, refreshToken }
}
```

### 주의사항

- Kakao API는 `id`를 숫자로 반환하지만, 백엔드에는 **문자열**로 전송 필수
- 이메일은 사용자가 동의해야만 제공됨
- REST API 키는 네이티브 앱 키와 다름

---

## Naver OAuth

### 라이브러리

```bash
npx expo install expo-auth-session expo-crypto expo-web-browser
```

### Developer Console 설정

1. [Naver Developers](https://developers.naver.com) → 앱 등록
2. API 권한: 네이버 로그인(프로필 조회)
3. 환경 추가: iOS URL Scheme, Android 패키지명
4. Client ID + **Client Secret** 발급

### 클라이언트 구현

```typescript
import { makeRedirectUri, useAuthRequest } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const NAVER_CLIENT_ID = "YOUR_CLIENT_ID";
const NAVER_CLIENT_SECRET = "YOUR_CLIENT_SECRET"; // ⚠️ 보안 주의
const discovery = {
  authorizationEndpoint: "https://nid.naver.com/oauth2.0/authorize",
  tokenEndpoint: "https://nid.naver.com/oauth2.0/token",
};

function useNaverAuth() {
  const redirectUri = makeRedirectUri({ scheme: "your-app-scheme" });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: NAVER_CLIENT_ID,
      redirectUri,
      responseType: "code",
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type === "success") {
      exchangeCodeForToken(response.params.code, response.params.state);
    }
  }, [response]);

  return { request, promptAsync };
}

async function exchangeCodeForToken(code: string, state: string) {
  // Authorization Code → Access Token 교환 (client_secret 필수)
  const tokenResponse = await fetch("https://nid.naver.com/oauth2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: NAVER_CLIENT_ID,
      client_secret: NAVER_CLIENT_SECRET,
      code,
      state,
    }).toString(),
  });

  const { access_token } = await tokenResponse.json();

  // Access Token으로 사용자 정보 조회
  const userResponse = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const { response: profile } = await userResponse.json();

  // 백엔드로 전송
  const apiResponse = await fetch("/auth/naver/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken: access_token,
      profile: {
        id: profile.id,
        email: profile.email,
        name: profile.name || profile.nickname,
        picture: profile.profile_image,
      },
    }),
  });

  return apiResponse.json(); // { accessToken, refreshToken }
}
```

### 주의사항

- Naver는 토큰 교환 시 **client_secret 필수** (Kakao/Google과 다름)
- client_secret을 앱에 직접 넣으면 보안 위험 → **프록시 서버 사용 권장**
- 동의 항목을 사용자가 거부하면 해당 정보는 null 반환

---

## 공통 패턴

### 보안 권장사항

| 항목 | 권장 | 비권장 |
|------|------|--------|
| 인증 UI | 시스템 브라우저 / 네이티브 SDK | WebView (토큰 탈취 위험) |
| client_secret | 프록시 서버 경유 | 앱 번들에 직접 포함 |
| 토큰 저장 | SecureStore | AsyncStorage |
| HTTPS | 필수 | HTTP |

### 에러 처리

모든 OAuth 콜백 엔드포인트는 동일한 에러 구조를 사용합니다:

| 에러 코드 | HTTP | 상황 |
|-----------|------|------|
| `SOCIAL_0202` | 401 | 유효하지 않은 토큰 (만료, 위변조) |

### 토큰 저장 예시

```typescript
import * as SecureStore from "expo-secure-store";

async function saveTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync("accessToken", accessToken);
  await SecureStore.setItemAsync("refreshToken", refreshToken);
}
```

### 교환 코드 방식 (선택)

모바일 네이티브 직접 전송 외에, 교환 코드를 사용하는 방식도 지원됩니다:

1. 클라이언트 → `POST /auth/{provider}/callback` → `{ exchangeCode }` 응답
2. 클라이언트 → `POST /auth/exchange` → `{ exchangeCode }` → `{ accessToken, refreshToken }`

교환 코드는 30초 유효, 1회용입니다. 웹 브라우저 기반 OAuth 플로우에서 사용됩니다.

---

**문서 버전**: 3.0.0
**최종 수정일**: 2026-03-22
