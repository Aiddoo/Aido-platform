# @aido/mobile

Expo 54 기반 React Native 모바일 앱.

## 기술 스택

| 분류 | 기술 |
|------|------|
| Framework | Expo 54, React Native 0.81 |
| Routing | Expo Router |
| State | TanStack Query v5 |
| HTTP | Ky |
| Validation | Zod 4.3 |
| UI | HeroUI Native, NativeWind |

## 개발 환경

```bash
pnpm dev          # Metro 번들러
pnpm dev:android  # Android
pnpm dev:ios      # iOS
```

## 실제 기기 테스트

앱이 Expo Metro 번들러 IP를 자동 감지합니다.

```bash
pnpm dev:android  # QR 코드 스캔
```

**조건**: 기기와 개발 머신이 같은 Wi-Fi에 연결

## 빌드

### 개발 빌드 (Dev Client)

```bash
pnpm build:development           # 전체
pnpm build:development:android   # Android
pnpm build:development:ios       # iOS
```

### 프리뷰 빌드 (내부 테스트)

```bash
pnpm build:preview
```

### 프로덕션 빌드

```bash
pnpm build:production            # 빌드
pnpm submit:production           # 스토어 제출
```

### OTA 업데이트

```bash
pnpm update:preview "메시지"
pnpm update:production "메시지"
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 개발 서버 |
| `pnpm dev:android` | Android 실행 |
| `pnpm dev:ios` | iOS 실행 |
| `pnpm test` | 테스트 |
| `pnpm typecheck` | 타입 검사 |
| `pnpm build:development` | 개발 빌드 |
| `pnpm build:production` | 프로덕션 빌드 |

## 환경별 API URL

| 환경 | Platform | API URL 변환 |
|------|----------|-------------|
| Android 에뮬레이터 | android | localhost → 10.0.2.2 |
| iOS 시뮬레이터 | ios | localhost 유지 |
| 실제 기기 | 둘 다 | localhost → {개발 머신 IP} |

## 배포

자세한 내용은 [DEPLOYMENT.md](./DEPLOYMENT.md) 참고.
