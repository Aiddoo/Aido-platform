# 인증 가이드

Aido 모바일 앱의 인증 시스템 개발 가이드입니다.

## 인증 아키텍처

### OAuth 플로우

| 제공자 | 방식 | 흐름 |
|--------|------|------|
| Google | 백엔드 OAuth | WebBrowser -> `/v1/auth/google/start` -> 코드 추출 -> `POST /v1/auth/exchange` |
| Kakao | 백엔드 OAuth | WebBrowser -> `/v1/auth/kakao/start` -> 코드 추출 -> `POST /v1/auth/exchange` |
| Naver | 백엔드 OAuth | WebBrowser -> `/v1/auth/naver/start` -> 코드 추출 -> `POST /v1/auth/exchange` |
| Apple | 네이티브 SDK | `AppleAuthentication.signInAsync()` -> `POST /v1/auth/apple/callback` |

모바일 앱은 OAuth 클라이언트 ID를 직접 사용하지 않습니다.
모든 OAuth 설정(Client ID, Secret)은 **API 서버에서 관리**합니다.

### 토큰 관리

| 토큰 | 저장 위치 | 용도 |
|------|-----------|------|
| Access Token | `expo-secure-store` | API 인증 헤더 |
| Refresh Token | `expo-secure-store` | 토큰 갱신 |

### 패키지 의존성

```
expo-auth-session          # OAuth redirect URI 생성
expo-web-browser           # 백엔드 OAuth 페이지 오픈
expo-apple-authentication  # Apple 네이티브 로그인
expo-crypto                # Nonce 생성 (Apple)
expo-secure-store          # 토큰 보안 저장
```

## 환경변수

```bash
EXPO_PUBLIC_API_URL=http://localhost:8080   # API 서버 URL
APP_ENV=development                         # 환경
```

> OAuth 클라이언트 ID 환경변수는 필요 없습니다.

---

## 소셜 로그인

### Google / Kakao / Naver (백엔드 OAuth)

세 제공자 모두 동일한 흐름을 사용합니다.

```
1. authService.openGoogleLogin()
2. -> WebBrowser.openAuthSessionAsync(API_URL/v1/auth/google/start?redirect_uri=...)
3. -> 사용자가 브라우저에서 인증
4. -> 앱으로 리다이렉트 (aido-dev://auth/google?code=...)
5. -> URL에서 code 추출
6. -> authService.exchangeCode({ code, provider: 'GOOGLE' })
7. -> POST /v1/auth/exchange -> 토큰 발급 -> SecureStore에 저장
```

**사용법:**

```typescript
// AuthService에서 제공하는 메서드
const codeResult = await authService.openGoogleLogin();   // 또는 openKakaoLogin(), openNaverLogin()

if (!codeResult.ok) {
  if (codeResult.error.code === 'AUTH_LOGIN_CANCELLED') return; // 사용자 취소
  // 에러 처리
  return;
}

const tokenResult = await authService.exchangeCode({
  code: codeResult.value,
  provider: 'GOOGLE',  // 또는 'KAKAO', 'NAVER'
});

if (!tokenResult.ok) {
  // API 에러 처리
  return;
}

// 토큰 자동 저장됨. 로그인 완료.
```

### Apple (네이티브 SDK)

Apple은 `expo-apple-authentication`의 네이티브 SDK를 사용합니다.

```
1. authService.openAppleLogin()
2. -> AppleAuthentication.signInAsync({ nonce: hashedNonce })
3. -> Apple 네이티브 인증 시트
4. -> idToken 획득
5. -> POST /v1/auth/apple/callback { idToken, nonce }
6. -> 토큰 발급 -> SecureStore에 저장
```

**사용법:**

```typescript
const result = await authService.openAppleLogin();

if (!result.ok) {
  if (result.error.code === 'AUTH_LOGIN_CANCELLED') return;
  // 에러 처리
  return;
}

// 토큰 자동 저장됨. 로그인 완료.
```

> Apple 로그인은 Nonce(SHA-256)를 사용하여 Replay Attack을 방지합니다.
> `expo-crypto`로 생성한 해시된 nonce를 Apple에 전달하고, 원본 nonce를 백엔드에 전송합니다.

---

## 이메일 인증

### 회원가입

```typescript
const result = await authService.register({
  email: 'user@example.com',
  password: 'password123',
  name: '홍길동',
  // ... RegisterInput 스키마 참고
});

if (!result.ok) {
  // ApiError 처리 (이메일 중복 등)
  return;
}

// 이메일 인증 코드 발송됨 -> 인증 화면으로 이동
```

### 이메일 인증 코드 확인

```typescript
const result = await authService.verifyEmail({
  email: 'user@example.com',
  code: '123456',
});

if (!result.ok) {
  // 잘못된 코드 또는 만료
  return;
}

// 토큰 자동 저장됨. 로그인 완료.
```

### 이메일 로그인

```typescript
const result = await authService.emailLogin('user@example.com', 'password123');

if (!result.ok) {
  // 이메일/비밀번호 오류
  return;
}

// 토큰 자동 저장됨.
```

### 인증 코드 재발송

```typescript
const result = await authService.resendVerification({
  email: 'user@example.com',
});
```

---

## 인증 상태 관리

`useAuth()` 훅으로 인증 상태를 관리합니다.

```typescript
import { useAuth } from '@src/features/auth/presentations/hooks/use-auth';

function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    // 성공/실패 관계없이 로컬 토큰은 삭제됨
  };
}
```

---

## 소셜 계정 연동

로그인 후 추가 소셜 계정을 연결/해제할 수 있습니다.

### 연동된 계정 조회

```typescript
const result = await authService.getLinkedAccounts();
// LinkedAccount[] 반환
```

### 계정 연동

```typescript
// Google/Kakao/Naver: OAuth 플로우 -> linkWithCode
const codeResult = await authService.openLinkOAuth('google');
if (!codeResult.ok) return;
const result = await authService.linkWithCode(codeResult.value);

// Apple: 네이티브 SDK -> linkApple
const result = await authService.linkApple();

// 또는 통합 메서드 사용
const result = await authService.linkAccount('google'); // 자동으로 적절한 플로우 선택
```

### 계정 연동 해제

```typescript
const result = await authService.unlinkAccount('GOOGLE'); // OAuthProvider 타입
```

---

## API 엔드포인트

### 인증

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|:----:|
| `POST` | `/v1/auth/register` | 회원가입 | |
| `POST` | `/v1/auth/verify-email` | 이메일 인증 | |
| `POST` | `/v1/auth/resend-verification` | 인증 코드 재발송 | |
| `POST` | `/v1/auth/login` | 이메일 로그인 | |
| `GET` | `/v1/auth/{provider}/start` | OAuth 시작 (redirect) | |
| `POST` | `/v1/auth/exchange` | 인증 코드 -> 토큰 교환 | |
| `POST` | `/v1/auth/apple/callback` | Apple ID Token 검증 | |
| `GET` | `/v1/auth/me` | 현재 사용자 조회 | O |
| `POST` | `/v1/auth/logout` | 로그아웃 | O |

### 계정 관리

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|:----:|
| `GET` | `/v1/auth/linked-accounts` | 연동 계정 목록 | O |
| `POST` | `/v1/auth/link-with-code` | OAuth 코드로 연동 | O |
| `POST` | `/v1/auth/link` | Apple 계정 연동 | O |
| `DELETE` | `/v1/auth/linked-accounts/{provider}` | 연동 해제 | O |

### 설정

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|:----:|
| `GET` | `/v1/auth/preference` | 사용자 설정 조회 | O |
| `PATCH` | `/v1/auth/preference` | 사용자 설정 수정 | O |
| `GET` | `/v1/auth/consent` | 동의 내역 조회 | O |
| `PATCH` | `/v1/auth/consent/marketing` | 마케팅 동의 수정 | O |

---

## 에러 처리

### AuthError (클라이언트 측)

OAuth 플로우에서 발생하는 에러입니다. `AuthService` 메서드가 `Result<T, AuthError>`로 반환합니다.

| 코드 | 설명 | 처리 |
|------|------|------|
| `AUTH_LOGIN_CANCELLED` | 사용자가 로그인 취소 | 무시 |
| `AUTH_PROVIDER_ERROR` | OAuth 제공자 에러 | 알림 표시 |
| `AUTH_NO_CODE_RECEIVED` | 인증 코드 미수신 | 재시도 안내 |
| `AUTH_VALIDATION_FAILED` | 잘못된 인증 응답 | 재시도 안내 |
| `AUTH_UNKNOWN` | 알 수 없는 에러 | 일반 에러 안내 |

### ApiError (서버 측)

API 호출 실패 시 반환됩니다. `Result<T, ApiError>`로 처리합니다.

```typescript
const result = await authService.emailLogin(email, password);

if (!result.ok) {
  const error = result.error;
  // error.code, error.message 사용
  Alert.alert('로그인 실패', error.message);
}
```

---

## 보안 고려사항

1. **토큰 저장**: `expo-secure-store` 사용 (iOS Keychain, Android Keystore). AsyncStorage 사용 금지.
2. **딥링크 스킴**: OAuth redirect URI는 앱 스킴 사용 (`aido-dev://auth/{provider}`, 프로덕션: `aido://auth/{provider}`)
3. **Apple Nonce**: SHA-256 해싱된 nonce를 Apple에 전달, 원본 nonce를 백엔드에 전송하여 Replay Attack 방지.
4. **로그아웃**: API 실패와 관계없이 로컬 토큰을 반드시 삭제 (`onSettled` 패턴).

---

## 구현 파일

| 파일 | 역할 |
|------|------|
| `src/features/auth/services/auth.service.ts` | OAuth 플로우 오케스트레이션 |
| `src/features/auth/repositories/auth.repository.impl.ts` | API 호출 + Zod 파싱 |
| `src/features/auth/repositories/auth.repository.ts` | Repository port (인터페이스) |
| `src/features/auth/models/auth.error.ts` | AuthError, AuthErrors 팩토리 |
| `src/features/auth/models/auth.model.ts` | 도메인 모델 타입 |
| `src/features/auth/repositories/auth.mapper.ts` | DTO -> 도메인 모델 변환 |
| `src/features/auth/presentations/hooks/use-auth.ts` | 인증 상태 훅 |
| `src/bootstrap/providers/auth-provider.tsx` | 인증 컨텍스트 |
