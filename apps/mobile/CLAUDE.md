# Aido Mobile App

> **Version**: 1.0.0 · **Last Updated**: 2026-04-23 · **Owner**: Aido Mobile Team

Expo 기반 React Native 모바일 앱. Feature-based Layered Architecture.

---

## 문서 가이드

| 상황 | 읽을 문서 |
|------|----------|
| 전체 아키텍처 / 레이어 패턴 (Model · Mapper · Service · Query) | [.claude/architecture.md](.claude/architecture.md) |
| 테스트 작성 (DI + jest.fn() 레이어별) | [.claude/testing-guide.md](.claude/testing-guide.md) |
| UI 컴포넌트 선택 / 작성 (Shared UI > HeroUI Native > RN) | [.claude/ui-components.md](.claude/ui-components.md) |
| OAuth · 소셜 로그인 구현 | [.claude/oauth-client-guide.md](.claude/oauth-client-guide.md) |
| 에러 처리 (Result, ApiError, BusinessError) | [docs/error-handling.md](docs/error-handling.md) |
| 테스트 전략 (단위/통합) | [docs/testing-strategy.md](docs/testing-strategy.md) |
| EAS 빌드 | [docs/eas-build-guide.md](docs/eas-build-guide.md) |
| EAS Secrets 관리 | [docs/EAS_SECRETS.md](docs/EAS_SECRETS.md) |
| 배포 (EAS, App Store / Play) | [DEPLOYMENT.md](DEPLOYMENT.md) |

---

## 기술 스택 (요약)

Expo SDK 55 · React Native 0.83 · React 19.2 · Expo Router · TanStack Query 5 · Ky · Zod 4.3 · HeroUI Native · NativeWind · `react-hook-form`

---

## 아키텍처 한눈에 보기

```
Presentation (app/, presentations/)
     ↓
Application (services/)   ← HTTP + Zod + Mapper + Policy 모두 담당
     ↓
Domain (models/)          ← Zod 스키마 + Policy + Error
     ↓
Infrastructure (shared/infra/, core/ports/)  ← Ky 클라이언트, SecureStore
     ↓
Bootstrap (bootstrap/providers/)   ← DI 컨테이너, 전역 Provider
```

세부 패턴 · 코드 예제 · 책임 경계: [.claude/architecture.md](.claude/architecture.md)

### Feature 구조

```
features/{feature}/
├── models/         # Zod 스키마 + 타입 + Policy + Error
├── services/       # Service + Mapper (HTTP + Zod + 변환 + 비즈니스 로직)
├── __tests__/      # 테스트 팩토리
└── presentations/  # Query Keys / Options, 컴포넌트, view-models
```

> **예외**: `DeviceIdRepository`만 Repository 패턴 유지 (SecureStore 로컬 스토리지 — HTTP 아님).

---

## 핵심 규칙

- **Service 책임**: HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증을 모두 담당. Service는 서버 에러(ApiError)를 번역/변환하지 않고 pass-through.
- **에러 분류**:
  - 예측 가능 (4xx, Policy 실패) → `Result.err()` → Mutation `onError`에서 분기
  - 예측 불가 (5xx, 네트워크, Zod 파싱 실패) → `throw` → ErrorBoundary 처리
- **Mapper**: DTO(ISO 문자열) → Domain(`Date` 객체) 변환. 서버 응답 변경의 충격을 Mapper에서 흡수.
- **의존성 방향**: `Model ← Service/Mapper/UI` (단방향). Model이 다른 레이어를 알면 안 됨.
- **UI 컴포넌트 우선순위**: Shared UI (`@src/shared/ui`) > HeroUI Native > React Native.
- **DTO**: `@aido/validators` 사용, 모바일 내부 중복 금지.

---

## 새 Feature 추가 체크리스트

1. **Models** — Zod 스키마 + 타입 + Policy + Error 정의
2. **Services + Mapper** — HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증
3. **DI 등록** — `bootstrap/providers/di-provider.tsx`에 Service 인스턴스 + `use{Feature}Service` 훅
4. **Presentations** — Query Keys, Query/Mutation Options, 컴포넌트
5. **라우트** — `app/` 하위에 화면 추가
6. **테스트** — 레이어별 단위 테스트 (DI + `jest.fn()`)

상세: [.claude/architecture.md#새-feature-추가-체크리스트](.claude/architecture.md)

---

## 파일 네이밍 규칙

| 파일 유형 | 패턴 |
|----------|------|
| 모델 | `{feature}.model.ts` |
| 에러 | `{feature}.error.ts` |
| 서비스 | `{feature}.service.ts` |
| 매퍼 | `{feature}.mapper.ts` (services/ 하위) |
| Query Options | `use-{action}-query-options.ts` |
| Mutation Options | `use-{action}-mutation-options.ts` |
| Query Keys | `{feature}-query-keys.constant.ts` |

---

## 환경 변수

```bash
# 런타임
APP_ENV                      # development | preview | production
EXPO_PUBLIC_API_URL          # API 서버 URL

# 빌드 (EAS Secrets)
GOOGLE_SERVICES_JSON         # Firebase Android (Base64)
GOOGLE_SERVICES_INFO_PLIST   # Firebase iOS (Base64)
EXPO_PUBLIC_EAS_PROJECT_ID   # EAS 프로젝트 ID
```

> OAuth 클라이언트 ID는 **모바일에 불필요** (API 서버에서 관리).

---

## UI 컴포넌트 문서 규칙

`src/shared/ui/` 하위에 새 컴포넌트를 생성할 때 **반드시** 다음을 수행한다:

1. `src/shared/ui/{ComponentDir}/{ComponentName}.md` 문서 생성 (사용법, Props 표, 파일 구조)
2. [`.claude/ui-components.md`](.claude/ui-components.md)의 **Shared UI 컴포넌트 목록** 테이블에 행 추가
