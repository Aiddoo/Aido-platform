# Aido 모바일 앱 인증 가이드

> Aido 애플리케이션의 인증 구현을 위한 프론트엔드 개발자 가이드입니다.
> 이 문서는 **바로 구현할 수 있는** 코드 예시와 함께 작성되었습니다.

---

## 목차

1. [시작하기](#1-시작하기)
2. [기본 설정](#2-기본-설정)
3. [이메일 인증](#3-이메일-인증)
4. [소셜 로그인](#4-소셜-로그인)
5. [인증 상태 관리](#5-인증-상태-관리)
6. [에러 처리](#6-에러-처리)
7. [API 레퍼런스](#7-api-레퍼런스)

---

## 1. 시작하기

### 1.1 필수 패키지

프로젝트에 이미 설치된 패키지입니다:

```bash
# OAuth 인증
expo-auth-session          # Google, Kakao, Naver OAuth
expo-apple-authentication  # Apple 로그인
expo-web-browser           # OAuth 리다이렉트 처리
expo-crypto               # PKCE 코드 생성

# 보안 저장소
expo-secure-store         # 토큰 안전 저장

# HTTP & 상태 관리
ky                        # HTTP 클라이언트
@tanstack/react-query     # 서버 상태 관리

# 폼 & 유효성 검사
react-hook-form           # 폼 처리
@hookform/resolvers       # Zod 연동
@aido/validators          # 공유 Zod 스키마
```

### 1.2 환경변수 설정

`.env` 파일에 다음 환경변수를 설정하세요:

```bash
# API 서버
EXPO_PUBLIC_API_URL=http://localhost:3001

# Google OAuth
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-google-ios-client-id
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-google-android-client-id

# Kakao OAuth
EXPO_PUBLIC_KAKAO_REST_API_KEY=your-kakao-rest-api-key

# Naver OAuth
EXPO_PUBLIC_NAVER_CLIENT_ID=your-naver-client-id
EXPO_PUBLIC_NAVER_CLIENT_SECRET=your-naver-client-secret
```

### 1.3 권장 프로젝트 구조

```
app/
├── (auth)/                    # 인증 관련 화면 그룹
│   ├── login.tsx
│   ├── register.tsx
│   ├── verify-email.tsx
│   └── forgot-password.tsx
├── (app)/                     # 인증된 사용자 화면
│   └── ...
└── _layout.tsx

src/
├── api/
│   └── client.ts              # ky 인스턴스 + 인터셉터
├── auth/
│   ├── token-store.ts         # SecureStore 래퍼
│   ├── use-auth.ts            # 인증 훅
│   └── auth-context.tsx       # 인증 컨텍스트
├── features/
│   └── auth/
│       ├── LoginForm.tsx
│       ├── RegisterForm.tsx
│       ├── AppleLoginButton.tsx
│       ├── GoogleLoginButton.tsx
│       ├── KakaoLoginButton.tsx
│       └── NaverLoginButton.tsx
└── utils/
    └── auth-errors.ts         # 에러 메시지 매핑
```

---

## 2. 기본 설정

### 2.1 토큰 저장소 (SecureStore)

토큰을 안전하게 저장하기 위해 `expo-secure-store`를 사용합니다.

```typescript
// src/auth/token-store.ts
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'aido_access_token';
const REFRESH_TOKEN_KEY = 'aido_refresh_token';

export const TokenStore = {
  // Access Token
  getAccessToken: () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token),
  deleteAccessToken: () => SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),

  // Refresh Token
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  deleteRefreshToken: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),

  // 모든 토큰 저장
  setTokens: async (accessToken: string, refreshToken: string) => {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },

  // 모든 토큰 삭제
  clearTokens: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  },
};
```

### 2.2 API 클라이언트 (ky)

토큰 자동 주입과 갱신을 위한 인터셉터를 설정합니다.

```typescript
// src/api/client.ts
import ky, { type BeforeRequestHook, type AfterResponseHook, HTTPError } from 'ky';
import { TokenStore } from '@/auth/token-store';

// 토큰 갱신 중복 방지
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

// 토큰 갱신 함수
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await TokenStore.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await ky.post(`${process.env.EXPO_PUBLIC_API_URL}/v1/auth/refresh`, {
      json: { refreshToken },
    }).json<{ accessToken: string; refreshToken: string }>();

    await TokenStore.setTokens(response.accessToken, response.refreshToken);
    return response.accessToken;
  } catch {
    await TokenStore.clearTokens();
    return null;
  }
}

// 토큰 주입 인터셉터
const injectToken: BeforeRequestHook = async (request) => {
  const accessToken = await TokenStore.getAccessToken();
  if (accessToken) {
    request.headers.set('Authorization', `Bearer ${accessToken}`);
  }
};

// 401 에러 처리 및 토큰 갱신 인터셉터
const handleUnauthorized: AfterResponseHook = async (request, options, response) => {
  if (response.status !== 401) return response;

  // 이미 갱신 중이면 대기
  if (isRefreshing && refreshPromise) {
    const newToken = await refreshPromise;
    if (newToken) {
      request.headers.set('Authorization', `Bearer ${newToken}`);
      return ky(request, options);
    }
    return response;
  }

  // 토큰 갱신 시작
  isRefreshing = true;
  refreshPromise = refreshAccessToken();

  try {
    const newToken = await refreshPromise;
    if (newToken) {
      request.headers.set('Authorization', `Bearer ${newToken}`);
      return ky(request, options);
    }
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }

  return response;
};

// API 클라이언트 인스턴스
export const api = ky.create({
  prefixUrl: process.env.EXPO_PUBLIC_API_URL,
  timeout: 30000,
  hooks: {
    beforeRequest: [injectToken],
    afterResponse: [handleUnauthorized],
  },
});

// JSON 응답 헬퍼
export const apiJson = {
  get: <T>(url: string) => api.get(url).json<T>(),
  post: <T>(url: string, json?: unknown) => api.post(url, { json }).json<T>(),
  patch: <T>(url: string, json?: unknown) => api.patch(url, { json }).json<T>(),
  delete: <T>(url: string) => api.delete(url).json<T>(),
};
```

### 2.3 React Query 설정

```typescript
// src/api/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분
      retry: (failureCount, error) => {
        // 401 에러는 재시도하지 않음 (토큰 갱신 처리됨)
        if (error instanceof Error && error.message.includes('401')) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
```

### 2.4 토큰 정보

| 토큰 종류 | 유효기간 | 용도 | 저장 위치 |
|-----------|----------|------|-----------|
| **Access Token** | 15분 | API 요청 인증 | SecureStore |
| **Refresh Token** | 7일 | Access Token 갱신 | SecureStore |

---

## 3. 이메일 인증

### 3.1 회원가입

```typescript
// src/features/auth/RegisterForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { RegisterRequest, registerRequestSchema } from '@aido/validators';
import { apiJson } from '@/api/client';
import { router } from 'expo-router';

export function RegisterForm() {
  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: {
      email: '',
      password: '',
      passwordConfirm: '',
      name: '',
      termsAgreed: false,
      privacyAgreed: false,
      marketingAgreed: false,
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterRequest) =>
      apiJson.post<{ message: string }>('v1/auth/register', data),
    onSuccess: (_, variables) => {
      // 이메일 인증 화면으로 이동
      router.push({
        pathname: '/(auth)/verify-email',
        params: { email: variables.email },
      });
    },
    onError: (error) => {
      // 에러 처리는 섹션 6 참고
      handleAuthError(error, setError);
    },
  });

  const onSubmit = handleSubmit((data) => {
    registerMutation.mutate(data);
  });

  return (
    // 폼 UI 구현
    // TextInput, Checkbox 등...
  );
}
```

### 3.2 이메일 인증

```typescript
// src/features/auth/VerifyEmailForm.tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { VerifyEmailRequest } from '@aido/validators';
import { apiJson } from '@/api/client';
import { TokenStore } from '@/auth/token-store';
import { useAuth } from '@/auth/use-auth';

interface Props {
  email: string;
}

export function VerifyEmailForm({ email }: Props) {
  const [code, setCode] = useState('');
  const { setUser } = useAuth();

  const verifyMutation = useMutation({
    mutationFn: (data: VerifyEmailRequest) =>
      apiJson.post<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>('v1/auth/verify-email', data),
    onSuccess: async (response) => {
      // 토큰 저장
      await TokenStore.setTokens(response.accessToken, response.refreshToken);
      // 사용자 상태 업데이트
      setUser(response.user);
    },
  });

  const resendMutation = useMutation({
    mutationFn: () =>
      apiJson.post<{ message: string }>('v1/auth/resend-verification', { email }),
  });

  const handleVerify = () => {
    verifyMutation.mutate({ email, code });
  };

  const handleResend = () => {
    resendMutation.mutate();
  };

  return (
    // 6자리 코드 입력 UI
    // 재발송 버튼
  );
}
```

### 3.3 로그인

```typescript
// src/features/auth/LoginForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LoginRequest, loginRequestSchema } from '@aido/validators';
import { apiJson } from '@/api/client';
import { TokenStore } from '@/auth/token-store';
import { useAuth } from '@/auth/use-auth';

export function LoginForm() {
  const { setUser } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) =>
      apiJson.post<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>('v1/auth/login', data),
    onSuccess: async (response) => {
      await TokenStore.setTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
    },
    onError: (error) => {
      // EMAIL_NOT_VERIFIED 에러 시 인증 화면으로 이동
      if (isEmailNotVerifiedError(error)) {
        const email = getValues('email');
        resendVerificationAndNavigate(email);
        return;
      }
      // 기타 에러 처리
      handleAuthError(error);
    },
  });

  const onSubmit = handleSubmit((data) => {
    loginMutation.mutate(data);
  });

  return (
    // 폼 UI 구현
  );
}

// 이메일 미인증 에러 처리
async function resendVerificationAndNavigate(email: string) {
  await apiJson.post('v1/auth/resend-verification', { email });
  router.push({
    pathname: '/(auth)/verify-email',
    params: { email },
  });
}
```

### 3.4 비밀번호 재설정

```typescript
// src/features/auth/ForgotPasswordForm.tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiJson } from '@/api/client';

type Step = 'request' | 'reset';

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');

  // 1단계: 재설정 코드 요청
  const requestMutation = useMutation({
    mutationFn: (email: string) =>
      apiJson.post('v1/auth/forgot-password', { email }),
    onSuccess: () => {
      setStep('reset');
    },
  });

  // 2단계: 새 비밀번호 설정
  const resetMutation = useMutation({
    mutationFn: (data: {
      email: string;
      code: string;
      newPassword: string;
      newPasswordConfirm: string;
    }) => apiJson.post('v1/auth/reset-password', data),
    onSuccess: () => {
      router.replace('/(auth)/login');
      // 성공 토스트 표시
    },
  });

  if (step === 'request') {
    return (
      // 이메일 입력 UI
      // 제출 시 requestMutation.mutate(email)
    );
  }

  return (
    // 인증 코드 + 새 비밀번호 입력 UI
    // 제출 시 resetMutation.mutate(...)
  );
}
```

---

## 4. 소셜 로그인

### 4.1 Apple 로그인

Apple 로그인은 `expo-apple-authentication`을 사용합니다.

```typescript
// src/features/auth/AppleLoginButton.tsx
import * as AppleAuthentication from 'expo-apple-authentication';
import { useMutation } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { apiJson } from '@/api/client';
import { TokenStore } from '@/auth/token-store';
import { useAuth } from '@/auth/use-auth';

export function AppleLoginButton() {
  const { setUser } = useAuth();

  const appleMutation = useMutation({
    mutationFn: async (idToken: string) =>
      apiJson.post<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>('v1/auth/apple/callback', { idToken }),
    onSuccess: async (response) => {
      await TokenStore.setTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
    },
    onError: (error) => {
      handleSocialLoginError(error, 'Apple');
    },
  });

  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        appleMutation.mutate(credential.identityToken);
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // 사용자가 취소함
        return;
      }
      console.error('Apple login error:', error);
    }
  };

  // iOS에서만 표시
  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={8}
      style={{ width: '100%', height: 48 }}
      onPress={handleAppleLogin}
    />
  );
}
```

### 4.2 Google 로그인

Google 로그인은 `expo-auth-session`의 Google 프로바이더를 사용합니다.

```typescript
// src/features/auth/GoogleLoginButton.tsx
import { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useMutation } from '@tanstack/react-query';
import { apiJson } from '@/api/client';
import { TokenStore } from '@/auth/token-store';
import { useAuth } from '@/auth/use-auth';

// 웹 브라우저 세션 완료 처리
WebBrowser.maybeCompleteAuthSession();

export function GoogleLoginButton() {
  const { setUser } = useAuth();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  const googleMutation = useMutation({
    mutationFn: async (idToken: string) =>
      apiJson.post<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>('v1/auth/google/callback', { idToken }),
    onSuccess: async (response) => {
      await TokenStore.setTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
    },
    onError: (error) => {
      handleSocialLoginError(error, 'Google');
    },
  });

  // OAuth 응답 처리
  useEffect(() => {
    if (response?.type === 'success' && response.params.id_token) {
      googleMutation.mutate(response.params.id_token);
    }
  }, [response]);

  return (
    <Button
      onPress={() => promptAsync()}
      disabled={!request || googleMutation.isPending}
    >
      Google로 계속하기
    </Button>
  );
}
```

### 4.3 Kakao 로그인

Kakao는 커스텀 OAuth 설정을 사용합니다.

```typescript
// src/features/auth/KakaoLoginButton.tsx
import { useEffect } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useMutation } from '@tanstack/react-query';
import { apiJson } from '@/api/client';
import { TokenStore } from '@/auth/token-store';
import { useAuth } from '@/auth/use-auth';

WebBrowser.maybeCompleteAuthSession();

const KAKAO_REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY!;

// Kakao OAuth 디스커버리
const kakaoDiscovery = {
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
};

export function KakaoLoginButton() {
  const { setUser } = useAuth();

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'aido',
    path: 'auth/kakao',
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: KAKAO_REST_API_KEY,
      redirectUri,
      scopes: ['profile_nickname', 'profile_image', 'account_email'],
      responseType: AuthSession.ResponseType.Code,
    },
    kakaoDiscovery
  );

  const kakaoMutation = useMutation({
    mutationFn: async (code: string) => {
      // 1단계: Kakao에서 access token 발급
      const tokenResponse = await fetch(kakaoDiscovery.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: KAKAO_REST_API_KEY,
          redirect_uri: redirectUri,
          code,
        }).toString(),
      });

      const { access_token } = await tokenResponse.json();

      // 2단계: Aido 서버로 토큰 전송
      return apiJson.post<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>('v1/auth/kakao/callback', { accessToken: access_token });
    },
    onSuccess: async (response) => {
      await TokenStore.setTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
    },
    onError: (error) => {
      handleSocialLoginError(error, 'Kakao');
    },
  });

  useEffect(() => {
    if (response?.type === 'success' && response.params.code) {
      kakaoMutation.mutate(response.params.code);
    }
  }, [response]);

  return (
    <Button
      onPress={() => promptAsync()}
      disabled={!request || kakaoMutation.isPending}
      style={{ backgroundColor: '#FEE500' }}
    >
      카카오로 계속하기
    </Button>
  );
}
```

### 4.4 Naver 로그인

```typescript
// src/features/auth/NaverLoginButton.tsx
import { useEffect } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useMutation } from '@tanstack/react-query';
import { apiJson } from '@/api/client';
import { TokenStore } from '@/auth/token-store';
import { useAuth } from '@/auth/use-auth';

WebBrowser.maybeCompleteAuthSession();

const NAVER_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID!;
const NAVER_CLIENT_SECRET = process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET!;

const naverDiscovery = {
  authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
  tokenEndpoint: 'https://nid.naver.com/oauth2.0/token',
};

export function NaverLoginButton() {
  const { setUser } = useAuth();

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'aido',
    path: 'auth/naver',
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: NAVER_CLIENT_ID,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
    },
    naverDiscovery
  );

  const naverMutation = useMutation({
    mutationFn: async (code: string) => {
      // 1단계: Naver에서 access token 발급
      const tokenResponse = await fetch(
        `${naverDiscovery.tokenEndpoint}?` +
          new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: NAVER_CLIENT_ID,
            client_secret: NAVER_CLIENT_SECRET,
            code,
          }).toString()
      );

      const { access_token } = await tokenResponse.json();

      // 2단계: Aido 서버로 토큰 전송
      return apiJson.post<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>('v1/auth/naver/callback', { accessToken: access_token });
    },
    onSuccess: async (response) => {
      await TokenStore.setTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
    },
    onError: (error) => {
      handleSocialLoginError(error, 'Naver');
    },
  });

  useEffect(() => {
    if (response?.type === 'success' && response.params.code) {
      naverMutation.mutate(response.params.code);
    }
  }, [response]);

  return (
    <Button
      onPress={() => promptAsync()}
      disabled={!request || naverMutation.isPending}
      style={{ backgroundColor: '#03C75A' }}
    >
      네이버로 계속하기
    </Button>
  );
}
```

### 4.5 소셜 로그인 에러 처리

소셜 로그인 시 발생할 수 있는 특수한 에러를 처리합니다.

```typescript
// src/features/auth/social-login-helpers.ts
import { router } from 'expo-router';
import { Alert } from 'react-native';

export function handleSocialLoginError(error: unknown, provider: string) {
  const errorCode = getErrorCode(error);

  switch (errorCode) {
    case 'SOCIAL_ACCOUNT_NOT_LINKED':
      // 수동 연동 필요 (Kakao, Naver)
      Alert.alert(
        '이미 가입된 이메일',
        `이 이메일로 가입된 계정이 있습니다.\n기존 계정에 로그인한 후 ${provider} 계정을 연결해주세요.`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '로그인하기',
            onPress: () => router.push('/(auth)/login'),
          },
        ]
      );
      break;

    case 'SOCIAL_EMAIL_REQUIRED':
      Alert.alert(
        '이메일 권한 필요',
        `${provider} 계정의 이메일 정보가 필요합니다. 다시 시도해주세요.`
      );
      break;

    default:
      Alert.alert('로그인 실패', `${provider} 로그인에 실패했습니다.`);
  }
}
```

### 4.6 계정 연동 정책

| 제공자 | 이메일 검증 | 정책 | 동작 |
|--------|-------------|------|------|
| **Google** | ✅ 보장 | 자동 연동 | 기존 계정 발견 시 자동 연결 |
| **Apple** | ✅ 보장 | 자동 연동 | 기존 계정 발견 시 자동 연결 |
| **Kakao** | ❌ 미보장 | 수동 연동 | 기존 계정 발견 시 에러 반환 |
| **Naver** | ❌ 미보장 | 수동 연동 | 기존 계정 발견 시 에러 반환 |

---

## 5. 인증 상태 관리

### 5.1 AuthContext

앱 전역에서 인증 상태를 관리합니다.

```typescript
// src/auth/auth-context.tsx
import { createContext, useState, useEffect, ReactNode } from 'react';
import { TokenStore } from './token-store';
import { apiJson } from '@/api/client';

interface User {
  id: string;
  email: string;
  name: string;
  profileImageUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 앱 시작 시 토큰 복원 및 사용자 정보 조회
  useEffect(() => {
    restoreAuth();
  }, []);

  async function restoreAuth() {
    try {
      const accessToken = await TokenStore.getAccessToken();
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      // 사용자 정보 조회
      const userData = await apiJson.get<User>('v1/auth/me');
      setUser(userData);
    } catch (error) {
      // 토큰 만료 또는 유효하지 않음
      await TokenStore.clearTokens();
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    try {
      await apiJson.post('v1/auth/logout');
    } catch {
      // 서버 에러 무시
    } finally {
      await TokenStore.clearTokens();
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        setUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
```

### 5.2 useAuth 훅

```typescript
// src/auth/use-auth.ts
import { useContext } from 'react';
import { AuthContext } from './auth-context';

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
```

### 5.3 보호된 라우트

Expo Router를 사용한 인증 기반 라우팅입니다.

```typescript
// app/_layout.tsx
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/auth';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/api/query-client';

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // 인증되지 않은 사용자가 보호된 경로에 접근
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // 인증된 사용자가 인증 경로에 접근
      router.replace('/(app)/home');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

---

## 6. 에러 처리

### 6.1 에러 코드 목록

```typescript
// src/utils/auth-errors.ts
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // 회원가입
  EMAIL_ALREADY_REGISTERED: '이미 가입된 이메일입니다.',
  WEAK_PASSWORD: '비밀번호가 보안 요구사항을 충족하지 않습니다.',
  PASSWORDS_DO_NOT_MATCH: '비밀번호가 일치하지 않습니다.',

  // 로그인
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
  EMAIL_NOT_VERIFIED: '이메일 인증이 필요합니다.',
  ACCOUNT_LOCKED: '5회 연속 실패로 계정이 잠겼습니다. 15분 후 다시 시도해주세요.',

  // 이메일 인증
  VERIFICATION_CODE_INVALID: '잘못된 인증 코드입니다.',
  VERIFICATION_CODE_EXPIRED: '인증 코드가 만료되었습니다. 다시 요청해주세요.',

  // 비밀번호 재설정
  RESET_CODE_INVALID: '잘못된 재설정 코드입니다.',
  RESET_CODE_EXPIRED: '재설정 코드가 만료되었습니다.',

  // 소셜 로그인
  SOCIAL_ACCOUNT_NOT_LINKED: '이미 가입된 이메일입니다. 기존 계정에 로그인 후 연결해주세요.',
  SOCIAL_EMAIL_REQUIRED: '이메일 정보 제공 동의가 필요합니다.',
  SOCIAL_ACCOUNT_ALREADY_LINKED: '이미 연결된 계정입니다.',
  CANNOT_UNLINK_LAST_LOGIN_METHOD: '마지막 로그인 수단은 해제할 수 없습니다.',

  // 토큰
  TOKEN_EXPIRED: '세션이 만료되었습니다. 다시 로그인해주세요.',
  INVALID_REFRESH_TOKEN: '세션이 유효하지 않습니다. 다시 로그인해주세요.',

  // 기타
  NETWORK_ERROR: '네트워크 연결을 확인해주세요.',
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
};
```

### 6.2 에러 처리 유틸리티

```typescript
// src/utils/auth-errors.ts (계속)
import { HTTPError } from 'ky';
import Toast from 'react-native-toast-message';

interface ApiError {
  errorCode: string;
  message: string;
}

// 에러에서 코드 추출
export function getErrorCode(error: unknown): string {
  if (error instanceof HTTPError) {
    try {
      const body = error.response.json() as ApiError;
      return body.errorCode;
    } catch {
      return 'UNKNOWN_ERROR';
    }
  }
  return 'NETWORK_ERROR';
}

// 에러 메시지 가져오기
export function getErrorMessage(errorCode: string): string {
  return AUTH_ERROR_MESSAGES[errorCode] || AUTH_ERROR_MESSAGES.UNKNOWN_ERROR;
}

// 에러 토스트 표시
export function showAuthError(error: unknown) {
  const errorCode = getErrorCode(error);
  const message = getErrorMessage(errorCode);

  Toast.show({
    type: 'error',
    text1: '오류',
    text2: message,
  });
}

// 폼 에러 처리 (react-hook-form)
export function handleFormError(
  error: unknown,
  setError: (name: string, error: { message: string }) => void
) {
  const errorCode = getErrorCode(error);

  switch (errorCode) {
    case 'EMAIL_ALREADY_REGISTERED':
      setError('email', { message: getErrorMessage(errorCode) });
      break;
    case 'INVALID_CREDENTIALS':
      setError('password', { message: getErrorMessage(errorCode) });
      break;
    case 'WEAK_PASSWORD':
      setError('password', { message: getErrorMessage(errorCode) });
      break;
    case 'PASSWORDS_DO_NOT_MATCH':
      setError('passwordConfirm', { message: getErrorMessage(errorCode) });
      break;
    default:
      showAuthError(error);
  }
}
```

### 6.3 특수 에러 처리 패턴

```typescript
// 이메일 미인증 에러 감지
export function isEmailNotVerifiedError(error: unknown): boolean {
  return getErrorCode(error) === 'EMAIL_NOT_VERIFIED';
}

// 계정 잠김 에러 감지
export function isAccountLockedError(error: unknown): boolean {
  return getErrorCode(error) === 'ACCOUNT_LOCKED';
}

// 수동 연동 필요 에러 감지
export function isSocialNotLinkedError(error: unknown): boolean {
  return getErrorCode(error) === 'SOCIAL_ACCOUNT_NOT_LINKED';
}
```

---

## 7. API 레퍼런스

### 이메일 인증 API

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|:----:|
| `POST` | `/v1/auth/register` | 회원가입 시작 | |
| `POST` | `/v1/auth/verify-email` | 이메일 인증 완료 | |
| `POST` | `/v1/auth/resend-verification` | 인증 코드 재발송 | |
| `POST` | `/v1/auth/login` | 이메일 로그인 | |
| `POST` | `/v1/auth/forgot-password` | 비밀번호 재설정 요청 | |
| `POST` | `/v1/auth/reset-password` | 새 비밀번호 설정 | |

### 토큰 관리 API

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|:----:|
| `POST` | `/v1/auth/refresh` | 토큰 갱신 | 🔄 Refresh |
| `POST` | `/v1/auth/logout` | 현재 세션 로그아웃 | ✅ |
| `POST` | `/v1/auth/logout-all` | 전체 세션 로그아웃 | ✅ |

### 소셜 로그인 API

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|:----:|
| `POST` | `/v1/auth/apple/callback` | Apple 로그인 (idToken) | |
| `POST` | `/v1/auth/google/callback` | Google 로그인 (idToken) | |
| `POST` | `/v1/auth/kakao/callback` | Kakao 로그인 (accessToken) | |
| `POST` | `/v1/auth/naver/callback` | Naver 로그인 (accessToken) | |
| `GET` | `/v1/auth/{provider}/start` | 웹 OAuth 시작 | |
| `POST` | `/v1/auth/exchange` | 교환 코드로 토큰 획득 | |

### 계정 관리 API

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|:----:|
| `GET` | `/v1/auth/me` | 내 정보 조회 | ✅ |
| `PATCH` | `/v1/auth/profile` | 프로필 수정 | ✅ |
| `GET` | `/v1/auth/sessions` | 활성 세션 목록 | ✅ |
| `DELETE` | `/v1/auth/sessions/{id}` | 특정 세션 종료 | ✅ |
| `POST` | `/v1/auth/link` | 소셜 계정 연결 | ✅ |
| `DELETE` | `/v1/auth/unlink/{provider}` | 소셜 계정 해제 | ✅ |

### Request/Response 예시

#### 회원가입

```http
POST /v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!",
  "passwordConfirm": "Password123!",
  "name": "홍길동",
  "termsAgreed": true,
  "privacyAgreed": true,
  "marketingAgreed": false
}
```

#### 로그인 성공 응답

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2...",
  "user": {
    "id": "clx1234567890",
    "email": "user@example.com",
    "name": "홍길동",
    "status": "ACTIVE"
  }
}
```

#### 에러 응답

```json
{
  "statusCode": 401,
  "errorCode": "INVALID_CREDENTIALS",
  "message": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "timestamp": "2025-01-17T10:30:00.000Z"
}
```

---

## 부록: 딥링크 설정

### app.json 설정

```json
{
  "expo": {
    "scheme": "aido",
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [{ "scheme": "aido" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "ios": {
      "bundleIdentifier": "com.aido.app"
    }
  }
}
```

### OAuth 콜백 URI

- **Apple**: 앱 내 네이티브 SDK 사용 (리다이렉트 불필요)
- **Google**: `aido://auth/google`
- **Kakao**: `aido://auth/kakao`
- **Naver**: `aido://auth/naver`

---

> **문서 버전**: 1.0.0
> **최종 수정**: 2025-01-17
