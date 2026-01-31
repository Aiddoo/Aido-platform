# Aido Mobile App

Expo 기반 React Native 모바일 앱. Feature-based Layered Architecture + Ports & Adapters 패턴.

## 개발 환경 설정

### 로컬 개발 (에뮬레이터/시뮬레이터)

```bash
pnpm dev          # Metro 번들러 시작 (플랫폼 선택)
pnpm dev:android  # Android 에뮬레이터 자동 실행
pnpm dev:ios      # iOS 시뮬레이터 자동 실행
```

### 실제 기기 테스트

#### 기본 방법 (자동 IP 감지)

앱은 Expo Metro 번들러의 IP를 자동으로 감지하여 실제 기기에서도 동작합니다:

```bash
# 1. 개발 서버 시작
pnpm dev:android  # 또는 dev:ios

# 2. 실제 기기에서 QR 코드 스캔
# - Android: Expo Go 앱으로 QR 코드 스캔
# - iOS: 카메라 앱으로 QR 코드 스캔
```

**자동으로 동작합니다!** ✨ 별도 설정 없이 에뮬레이터처럼 사용 가능합니다.

#### 고급: 수동 IP 설정 (선택사항)

자동 감지가 실패하거나 특정 IP를 사용하려면:

```bash
# 1. 개발 머신의 로컬 IP 확인
ifconfig | grep "inet " | grep -v 127.0.0.1  # Mac/Linux
ipconfig | findstr IPv4                       # Windows

# 2. .env.local 파일에 IP 설정 (선택)
echo "EXPO_PUBLIC_DEV_MACHINE_IP=192.168.1.100" > .env.local

# 3. 앱 재시작
pnpm dev:android
```

### 주의사항

- 실제 기기와 개발 머신이 **같은 Wi-Fi 네트워크**에 연결되어야 합니다
- 방화벽에서 포트 8080(API 서버), 8081(Metro)이 열려 있어야 합니다
- 자동 IP 감지가 실패하면 콘솔에 경고 메시지가 표시됩니다

## 빌드 및 배포

### 개발 빌드 (Dev Client)

```bash
# 로컬 빌드 및 실행 (네이티브 코드 변경 시)
pnpm run:android
pnpm run:ios

# EAS 클라우드 빌드 (내부 배포용)
pnpm build:dev           # Android + iOS
pnpm build:dev:android   # Android만
pnpm build:dev:ios       # iOS만
```

### 프리뷰 빌드 (내부 테스팅)

```bash
pnpm build:preview           # Android + iOS
pnpm build:preview:android   # Android만
pnpm build:preview:ios       # iOS만
```

빌드 완료 후 QR 코드로 설치 가능

### 프로덕션 빌드

#### 방법 1: 빌드만 (수동 제출)

```bash
pnpm build:prod           # Android + iOS
pnpm build:prod:android   # Android만
pnpm build:prod:ios       # iOS만
```

빌드 완료 후 수동으로 제출:

```bash
pnpm submit:prod          # Android + iOS (최신 빌드)
pnpm submit:prod:android  # Android만
pnpm submit:prod:ios      # iOS만
```

#### 방법 2: 빌드 + 자동 제출 (권장)

```bash
# 한 번에 빌드하고 스토어에 자동 제출
pnpm build:prod:auto           # Android + iOS
pnpm build:prod:android:auto   # Android만
pnpm build:prod:ios:auto       # iOS만
```

### OTA 업데이트 (JavaScript 변경만)

```bash
pnpm update:preview "버그 수정"
pnpm update:prod "새 기능 추가"
```

**참고**: 네이티브 코드 변경이 없는 경우에만 OTA 업데이트 가능

## 스크립트 사용 가이드

### 개발 워크플로우

```bash
# 1. 로컬 개발
pnpm dev:android

# 2. 네이티브 모듈 추가/변경 시
pnpm run:android

# 3. 실제 기기 테스트
pnpm build:dev:android  # EAS로 APK 빌드
```

### 배포 워크플로우

```bash
# 1. 내부 테스팅
pnpm build:preview:android

# 2. 프로덕션 배포 (빌드 + 자동 제출)
pnpm build:prod:auto

# 3. JavaScript만 변경 시 (OTA)
pnpm update:prod "버그 수정"
```

## 환경 분기 처리

### API URL 자동 변환

앱은 실행 환경에 따라 API URL을 자동으로 변환합니다:

| 환경 | Platform | isDevice | 입력 URL | 출력 URL |
|------|----------|----------|----------|----------|
| Android 에뮬레이터 | android | false | localhost:8080 | 10.0.2.2:8080 |
| iOS 시뮬레이터 | ios | false | localhost:8080 | localhost:8080 |
| Android 실제 기기 | android | true | localhost:8080 | {DEV_IP}:8080 |
| iOS 실제 기기 | ios | true | localhost:8080 | {DEV_IP}:8080 |

### 디버깅

개발 환경에서는 콘솔에 API URL 변환 정보가 출력됩니다:

```
[env] API URL resolved: {
  platform: 'android',
  isDevice: true,
  original: 'http://localhost:8080',
  resolved: 'http://192.168.1.100:8080'
}
```

## 아키텍처

자세한 아키텍처 가이드는 [CLAUDE.md](./CLAUDE.md)를 참조하세요.

## 기술 스택

| 분류 | 라이브러리 |
|------|-----------|
| 프레임워크 | Expo SDK 54, React Native 0.81 |
| 라우팅 | Expo Router (파일 기반) |
| 상태관리 | TanStack Query v5 |
| HTTP | Ky |
| 검증 | Zod 4.3 |
| UI | HeroUI Native, NativeWind |
| DI | React Context (수동 DI) |
