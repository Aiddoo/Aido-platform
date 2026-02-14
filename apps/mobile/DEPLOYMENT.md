# Aido Mobile App 배포 가이드

## 목차

- [EAS 빌드 및 배포](#eas-빌드-및-배포)
- [환경별 설정](#환경별-설정)
- [OAuth 설정](#oauth-설정)
- [App Store / Google Play 제출](#app-store--google-play-제출)
- [배포 전 체크리스트](#배포-전-체크리스트)

---

## EAS 빌드 및 배포

### 사전 준비

```bash
# EAS CLI 설치
npm install -g eas-cli

# Expo 계정 로그인
eas login

# 프로젝트 설정 확인
eas build:configure
```

### 환경별 빌드

#### 1. Development 빌드 (내부 테스트용)

```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android

# 둘 다
eas build --profile development --platform all
```

**특징**:
- Expo Go처럼 빠른 개발 가능
- 실제 기기에서 테스트
- 시뮬레이터에서도 실행 가능

#### 2. Preview 빌드 (스테이징/QA)

```bash
# iOS
eas build --profile preview --platform ios

# Android
eas build --profile preview --platform android
```

**특징**:
- 프로덕션과 동일한 환경
- 내부 테스터 배포용
- API: `https://api-preview.aido.kr`

#### 3. Production 빌드 (앱스토어 제출용)

```bash
# iOS
eas build --profile production --platform ios

# Android
eas build --profile production --platform android
```

**특징**:
- App Store / Google Play 제출용
- API: `https://api.aido.kr`
- 자동 버전 증가

---

## 환경별 설정

### Development (개발)

**API URL**: 자동 감지 (시뮬레이터: `localhost`, 실제 기기: 개발 머신 IP)

**환경 변수**: `.env` + `.env.development`

**빌드 설정**: `eas.json` > `build.development`

### Preview (스테이징)

**API URL**: `https://api-preview.aido.kr`

**환경 변수**: `.env.preview`

**빌드 설정**: `eas.json` > `build.preview`

**필수 설정**:
```bash
# .env.preview
APP_ENV=preview
EXPO_PUBLIC_API_URL=https://api-preview.aido.kr
```

### Production (프로덕션)

**API URL**: `https://api.aido.kr`

**환경 변수**: `.env.production`

**빌드 설정**: `eas.json` > `build.production`

**필수 설정**:
```bash
# .env.production
APP_ENV=production
EXPO_PUBLIC_API_URL=https://api.aido.kr
```

> OAuth 클라이언트 ID는 모바일 앱에서 직접 사용하지 않습니다.
> 모든 OAuth 설정은 **API 서버 환경변수**에서 관리합니다.

---

## OAuth 설정

모바일 앱은 **백엔드 OAuth** 방식을 사용합니다. 사용자가 로그인하면 WebBrowser로 API 서버의 OAuth 시작 엔드포인트를 열고, 서버가 OAuth 제공자와 직접 통신합니다.

따라서 OAuth 클라이언트 ID/Secret은 **API 서버에만** 설정하면 됩니다.

### Google OAuth

#### 1. Google Cloud Console에서 OAuth 클라이언트 생성

**Web** (API 서버용):
- Application Type: Web application
- Authorized redirect URIs:
  - `https://api.aido.kr/v1/auth/google/web-callback` (프로덕션)
  - `https://api-preview.aido.kr/v1/auth/google/web-callback` (프리뷰)

#### 2. API 서버 환경 변수 설정

```bash
# API 서버 (.env.production)
GOOGLE_CLIENT_ID=웹-클라이언트-ID
GOOGLE_CLIENT_SECRET=웹-클라이언트-시크릿
GOOGLE_CALLBACK_URL=https://api.aido.kr/v1/auth/google/web-callback
```

### Apple Sign In

#### 1. Apple Developer에서 설정

**Service ID 생성**:
- https://developer.apple.com/account/resources/identifiers/list/serviceId
- Identifier: `com.aido.mobile.service`
- Return URLs:
  - `https://api.aido.kr/v1/auth/apple/callback`
  - `https://api-preview.aido.kr/v1/auth/apple/callback`

**Key 생성**:
- https://developer.apple.com/account/resources/authkeys/add
- Enable: Sign in with Apple
- Download .p8 파일 (한 번만 다운로드 가능!)

#### 2. Private Key를 Base64로 변환

```bash
cat AuthKey_XXXXXXXXXX.p8 | grep -v "BEGIN PRIVATE KEY" | grep -v "END PRIVATE KEY" | tr -d '\n'
```

#### 3. API 서버 환경 변수 설정

```bash
# API 서버 (.env.production)
APPLE_TEAM_ID=6XKZSBB9HH
APPLE_CLIENT_ID=com.aido.mobile.service
APPLE_KEY_ID=CX8FBMWTJX
APPLE_PRIVATE_KEY=Base64로-변환된-키
APPLE_CALLBACK_URL=https://api.aido.kr/v1/auth/apple/callback
```

### Kakao / Naver

각 플랫폼의 개발자 콘솔에서 앱 등록 후 Client ID/Secret을 **API 서버에** 설정합니다.

---

## App Store / Google Play 제출

### iOS (App Store Connect)

#### 1. 프로덕션 빌드

```bash
eas build --profile production --platform ios
```

#### 2. TestFlight 배포 (선택)

```bash
eas submit --platform ios --profile production
```

또는 App Store Connect에서 수동 업로드

#### 3. App Store 제출

App Store Connect에서:
- 앱 정보 입력 (스크린샷, 설명 등)
- 가격 및 배포 지역 설정
- 심사 제출

### Android (Google Play Console)

#### 1. 프로덕션 빌드

```bash
eas build --profile production --platform android
```

#### 2. Google Play 업로드

```bash
eas submit --platform android --profile production
```

또는 Google Play Console에서 수동 업로드

#### 3. 심사 제출

Google Play Console에서:
- 앱 콘텐츠 등록 (스크린샷, 설명 등)
- 가격 및 배포 국가 설정
- 프로덕션 트랙으로 출시

---

## 배포 전 체크리스트

### API 서버 배포

- [ ] 프로덕션 데이터베이스 준비
- [ ] 환경 변수 설정 (OAuth 키 포함)
- [ ] `NODE_ENV=production` 설정
- [ ] HTTPS 설정 (SSL 인증서)
- [ ] 데이터베이스 마이그레이션 실행
  ```bash
  pnpm prisma migrate deploy
  ```
- [ ] Health Check 확인
  ```bash
  curl https://api.aido.kr/health
  ```

### 모바일 앱 배포

- [ ] `.env.production` 설정 완료 (APP_ENV, API_URL)
- [ ] API URL 프로덕션 서버로 변경
  ```bash
  EXPO_PUBLIC_API_URL=https://api.aido.kr
  ```
- [ ] Google Services 파일 업데이트 (EAS Secrets)
  - `google-services.json` (Android)
  - `GoogleService-Info.plist` (iOS)
- [ ] 앱 아이콘, 스플래시 화면 최종 확인
- [ ] 버전 번호 업데이트 (`app.config.ts`)

### 테스트

- [ ] 실제 기기에서 테스트
- [ ] 소셜 로그인 테스트 (Google, Apple, Kakao, Naver)
- [ ] API 호출 정상 작동 확인
- [ ] 푸시 알림 테스트
- [ ] 에러 처리 확인

### 보안

- [ ] 민감한 정보 환경 변수로 관리 (코드에 하드코딩 금지)
- [ ] OAuth 콜백 URL 프로덕션 도메인으로 변경 (API 서버)
- [ ] HTTPS 적용 확인

---

## 트러블슈팅

### 빌드 실패

**EAS Secrets 확인**:
```bash
eas secret:list
```

**캐시 삭제 후 재빌드**:
```bash
eas build --clear-cache --profile production --platform ios
```

### OAuth 로그인 실패

**1. Redirect URI 확인**:
- Google Cloud Console / Apple Developer에서 정확한 URL 설정 확인

**2. API URL 확인**:
```bash
# 모바일 앱에서 실제 사용되는 API URL 확인
console.log(ENV.API_URL);
```

**3. API 서버 로그 확인**:
- OAuth 콜백 요청이 도착하는지 확인
- OAuth 제공자 응답 에러 확인

### 실제 기기에서 API 연결 실패

**개발 환경**:
- 같은 Wi-Fi 네트워크 연결 확인
- API URL 자동 감지 로그 확인

**프로덕션 환경**:
- API 서버 도메인 올바른지 확인
- HTTPS 인증서 유효한지 확인

---

## 참고 자료

- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Submit](https://docs.expo.dev/submit/introduction/)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [Google Play Console](https://play.google.com/console)
- [Google OAuth 설정](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign In 설정](https://developer.apple.com/sign-in-with-apple/get-started/)
