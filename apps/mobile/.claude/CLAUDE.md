# Mobile App - AI 개발 가이드

**Version**: 1.0.0 · **Last Updated**: 2026-04-23 · **Owner**: Aido Mobile Team

Expo 57 + React Native 0.86 기반 모바일 앱.

## 아키텍처

Feature-based Layered Architecture. Service가 HTTP + Zod + Mapper + Policy를 모두 담당.
자세한 내용: [architecture.md](./architecture.md)

```
features/{feature}/
  models/          # 도메인 모델, 에러
  services/        # Service + Mapper (HTTP + Zod + 변환 + 비즈니스 로직)
  presentations/   # hooks, components, screens
```

> **예외**: `DeviceIdRepository`만 Repository 패턴 유지 (SecureStore 로컬 스토리지 접근 — HTTP가 아님)

## 테스트

DI + `jest.fn()` 기반 레이어별 독립 테스트. Given/When/Then 패턴.
자세한 내용: [testing-guide.md](./testing-guide.md)

## UI 컴포넌트

1순위: Shared UI (`@src/shared/ui`) - `cn()`, `withUniwind()` 유틸
2순위: HeroUI Native
3순위: React Native 기본
자세한 내용: [ui-components.md](./ui-components.md)

## 주요 패턴

### 인증
- `useAuth()` 훅으로 인증 상태 관리
- 토큰: `expo-secure-store`에 저장
- OAuth: 백엔드 플로우 (Google/Kakao/Naver), Apple은 네이티브 SDK
- OAuth 클라이언트 ID는 **모바일에 불필요** (API 서버에서 관리)

### 에러 처리
- 예측 가능 (4xx): `Result.err()` -> UI 처리
- 예측 불가능 (5xx, 네트워크): `throw` -> ErrorBoundary
- 상세: [error-handling.md](../docs/error-handling.md)

### 폼
- `react-hook-form` + Zod (`@aido/validators`)

### HTTP
- `Ky` 클라이언트, `HttpClient` port를 통해 DI

## 환경변수

```bash
# 런타임
APP_ENV                      # development | preview | production
EXPO_PUBLIC_API_URL          # API 서버 URL

# 빌드 (EAS Secrets)
GOOGLE_SERVICES_JSON         # Firebase Android (Base64)
GOOGLE_SERVICES_INFO_PLIST   # Firebase iOS (Base64)
EXPO_PUBLIC_EAS_PROJECT_ID   # EAS 프로젝트 ID
```

## 관련 문서

- [인증 가이드](../docs/authentication_guide.md)
- [에러 처리](../docs/error-handling.md)
- [EAS 빌드](../docs/eas-build-guide.md)
- [EAS Secrets](../docs/EAS_SECRETS.md)
- [배포 가이드](../DEPLOYMENT.md)
