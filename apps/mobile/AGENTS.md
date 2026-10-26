# Aido Mobile App

> **Version**: 1.3.0 · **Last Updated**: 2026-10-14 · **Owner**: Aido Mobile Team

Expo 기반 React Native 모바일 앱. Feature-based Layered Architecture.

---

## 문서 가이드

| 상황                                                           | 읽을 문서                                                        |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| 전체 아키텍처 / 레이어 패턴 (Model · Mapper · Service · Query) | [.claude/architecture.md](.claude/architecture.md)               |
| Todo 댓글 화면·대화·작성 시트                                  | [.claude/todo-comments.md](.claude/todo-comments.md)             |
| 테스트 작성 (Model · Service · 순수 util 중심)                 | [.claude/testing-guide.md](.claude/testing-guide.md)             |
| UI 컴포넌트 선택 / 작성 (Shared UI > HeroUI Native > RN)       | [.claude/ui-components.md](.claude/ui-components.md)             |
| 다국어 / 문자열 추가 (i18n, ko+en 카탈로그)                    | [.claude/i18n-guide.md](.claude/i18n-guide.md)                   |
| 인증 상태 · 토큰 · 로그인 플로우                               | [docs/authentication_guide.md](docs/authentication_guide.md)     |
| OAuth · 소셜 로그인 구현                                       | [.claude/oauth-client-guide.md](.claude/oauth-client-guide.md)   |
| 홈 화면 위젯 (iOS WidgetKit / Android AppWidget)               | [.claude/widgets.md](.claude/widgets.md)                         |
| 에러 처리 (Result, ApiError, BusinessError)                    | [docs/error-handling.md](docs/error-handling.md)                 |
| 관측 (Analytics · Sentry · Breadcrumb · Severity)              | [.claude/observability.md](.claude/observability.md)             |
| 테스트 전략 (단위/통합)                                        | [docs/testing-strategy.md](docs/testing-strategy.md)             |
| 1.13.0 친구 초대 링크·보상·날짜·위젯 정비                      | [docs/releases/1.13.0-client.md](docs/releases/1.13.0-client.md) |
| 1.12.1 Duo·Mac·SDK 58 정합성·구조 정비                         | [docs/releases/1.12.1-client.md](docs/releases/1.12.1-client.md) |
| 1.10.1 변경 및 native QA                                       | [docs/releases/1.10.1-client.md](docs/releases/1.10.1-client.md) |
| 1.10 클라이언트 변경 및 검증                                   | [docs/releases/1.10.0-client.md](docs/releases/1.10.0-client.md) |
| EAS 빌드                                                       | [docs/eas-build-guide.md](docs/eas-build-guide.md)               |
| EAS Secrets 관리                                               | [docs/EAS_SECRETS.md](docs/EAS_SECRETS.md)                       |
| 배포 (EAS, App Store / Play)                                   | [DEPLOYMENT.md](DEPLOYMENT.md)                                   |

---

## 기술 스택 (요약)

Expo SDK 58.0.19 · React Native 0.88 · React 19.3 · Expo Router · TanStack Query 5 · Ky · Zod 4.3 · HeroUI Native · Uniwind · `react-hook-form`

---

## 아키텍처 한눈에 보기

```
Presentation (app/, components/, hooks/, queries/)
     ↓
Application (apis/)   ← HTTP + Zod + Mapper + Policy 모두 담당
     ↓
Domain (domains/)          ← Zod 스키마 + Policy + Error
     ↓
Infrastructure (shared/infra/, core/ports/)  ← Ky 클라이언트, SecureStore
     ↓
Bootstrap (bootstrap/providers/)   ← DI 컨테이너, 전역 Provider
```

세부 패턴 · 코드 예제 · 책임 경계: [.claude/architecture.md](.claude/architecture.md)

### Feature 구조

```
features/{feature}/   # 단수 kebab-case
├── domains/        # 클라이언트 모델 + 순수 함수 + Policy + Error
├── apis/           # Service + Mapper (HTTP + Zod + 변환 + Policy 검증)
├── components/     # 의미 있는 UI 블록 (.Loading·.Error·.Empty·.Item)
├── hooks/          # 단일 책임 훅 ([value, setValue] 상태 튜플, 라우트 읽기)
├── queries/        # Query / Mutation Options, {feature}-cache.ts
├── constants/      # Query Keys, 라벨·옵션 상수
├── utils/          # 순수 계산, navigation resolver, view-models/
└── __tests__/      # 테스트 팩토리
```

> **예외**: 로컬 저장소(SecureStore·MMKV)는 `apis/{name}.repository.ts`로 두고 Service가 감싼다.
> 다른 피처는 `@src/features/{feature}/…` 절대경로로만 import한다 (`check:conventions`가 검사).

---

## 핵심 규칙

- **불필요한 훅 금지**: `react-hook-form`과 Query 훅은 사용처에서 직접 쓴다. 화면을 짧게 만들려고 조회·폼·저장·내비게이션을 포괄적인 커스텀 훅에 묶지 않는다. 추출은 독립적인 단일 책임을 기준으로 한다.
- **코드 스타일**: 짧은 조기 반환도 `if (조건) { return; }`처럼 중괄호를 쓴다. Promise 호출에 `void` 연산자를 붙이지 않는다(Oxlint로 강제). 이벤트 핸들러는 Promise를 반환하고, 기다리지 않는 호출은 실패를 내부에서 처리하는 함수이거나 호출부 `.catch`로 기록한다. 들여쓰기·공백·import 정렬은 Oxfmt를 따른다.
- **컴포넌트 계약**: 추출은 추상화가 아니다. 입력 래퍼는 `Omit<ComponentProps<typeof X>, …>`로 원본 props(`value`/`onChange`, HeroUI의 `isSelected`/`isDisabled`)를 살린다. 화면 식별자는 Props 대신 컴포넌트가 route hook에서 읽고, 데이터는 쓰는 컴포넌트가 조회한다. 상세: [.claude/architecture.md#컴포넌트-계약](.claude/architecture.md)
- **Screen 구성**: `app/`의 Screen에서 화면 순서·레이아웃·Suspense·Error 경계가 위에서 아래로 읽히게 유지한다. 피처는 의미 있는 UI 블록과 훅·쿼리·모델·정책을 관리한다. 화면 전체를 피처 `pages/`로 옮겨 재수출하지 않으며, 한 화면에서만 쓰는 작은 컴포넌트는 Screen 아래에 둘 수 있다.
- **Service 책임**: HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증을 모두 담당. Service는 서버 에러(ApiError)를 번역/변환하지 않고 pass-through.
- **에러 분류**:
  - 예측 가능 (4xx, Policy 실패) → `Result.err()` → Mutation `onError`에서 분기
  - 예측 불가 (5xx, 네트워크, Zod 파싱 실패) → `throw` → 조회는 QueryErrorBoundary fallback(다시 시도 + 문의하기), mutation은 기본 토스트
  - 한 오류는 토스트와 fallback 중 한 곳에서만 보인다
- **Mapper·select**: 서버 스펙 변경은 Mapper(DTO → 클라이언트 모델, ISO 문자열 → `Date`)가 흡수하고 캐시에는 클라이언트 모델을 둔다. `select`는 화면별 필터·정렬·표시 모델만 만들며 참조가 안정적인 순수 함수를 쓴다.
- **Model·Policy**: 클라이언트 모델은 `@aido/api` 스키마를 재사용·`extend`하고 모양이 다를 때만 독자 스키마를 둔다. Policy는 모델을 첫 인자로 받는 이름 있는 순수 함수를 `{Entity}Policy`로 묶은 Facade다.
- **공통 규칙(서버·모바일)**: 날짜·시간대·표시 언어 [dates](../../docs/conventions/dates.md), 응답·오류 [errors](../../docs/conventions/errors.md), 하위 호환 [compatibility](../../docs/conventions/compatibility.md)
- **의존성 방향**: `Model ← Service/Mapper/UI` (단방향). Model이 다른 레이어를 알면 안 됨.
- **UI 컴포넌트 우선순위**: Shared UI (`@src/shared/ui`) > HeroUI Native > React Native.
- **DTO**: `@aido/api` 사용, 모바일 내부 중복 금지.
- **i18n**: 사용자 노출 문자열 하드코딩 금지 — ko/en 카탈로그(`src/shared/i18n/locales`) 동시 추가. 상세: [.claude/i18n-guide.md](.claude/i18n-guide.md)
- **인증**: `useAuth()` 훅으로 인증 상태를 관리하고 토큰은 `expo-secure-store`에 저장한다.
- **OAuth**: Google/Kakao/Naver는 백엔드 플로우, Apple은 네이티브 SDK를 사용한다. OAuth 클라이언트 ID는 API 서버에서 관리하며 모바일에는 두지 않는다.
- **폼**: `react-hook-form`과 `@aido/api`의 Zod 스키마를 사용한다.
- **HTTP**: Ky 클라이언트를 `HttpClient` 포트를 통해 DI한다.
- **관측**: Sentry는 `ErrorReporter` 포트, Firebase Analytics는 `Analytics` 포트와 타입 카탈로그 `track()`을 사용한다. 벤더 코드는 어댑터에만 둔다. 상세: [.claude/observability.md](.claude/observability.md)

---

## 새 Feature 추가 체크리스트

1. **Models** — Zod 스키마 + 타입 + Policy + Error 정의
2. **Services + Mapper** — HTTP 호출 + Zod 검증 + Mapper 변환 + Policy 검증
3. **DI 등록** — `di-provider.tsx`에 Service 인스턴스, `di-context.tsx`에 `use{Feature}Service` 훅
4. **Presentations** — Query Keys, Query/Mutation Options, 컴포넌트
5. **라우트** — `app/` 하위에 화면 추가
6. **테스트** — Model/Policy, Service/Mapper, 자체 로직이 있는 순수 util/view-model만 선별

상세: [.claude/architecture.md#새-feature-추가-체크리스트](.claude/architecture.md)

---

## 파일 네이밍 규칙

| 파일 유형        | 패턴                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| 모델 + Policy    | `domains/{entity}.model.ts`                                             |
| 에러             | `domains/{feature}.error.ts`                                            |
| 서비스           | `apis/{feature}.service.ts`                                             |
| 매퍼             | `apis/{entity}.mapper.ts`                                               |
| Query Options    | `queries/get-{resource}[-infinite]-query-options.ts` (`get…`/`useGet…`) |
| Mutation Options | `queries/use-{action}-mutation-options.ts`                              |
| 캐시 helper      | `queries/{feature}-cache.ts`                                            |
| Query Keys       | `constants/{feature}-query-keys.ts`                                     |

---

## 환경 변수

```bash
# 런타임
APP_ENV                      # development | preview | production
EXPO_PUBLIC_API_URL          # API 서버 URL
EXPO_PUBLIC_SENTRY_DSN       # Sentry DSN (publishable, 관측)
EXPO_PUBLIC_SENTRY_DEBUG     # (선택) dev에서 Sentry 강제 활성화 — 'true'일 때만

# 빌드 (EAS Secrets)
GOOGLE_SERVICES_JSON         # Firebase Android (Base64) — Analytics
GOOGLE_SERVICES_INFO_PLIST   # Firebase iOS (Base64) — Analytics
SENTRY_AUTH_TOKEN            # Sentry 소스맵 업로드 (sensitive)
EXPO_PUBLIC_EAS_PROJECT_ID   # EAS 프로젝트 ID
```

> 관측 스택: **Sentry**(크래시·에러·이벤트·breadcrumb) + **Firebase Analytics**(제품 지표). Crashlytics 미사용.
> OAuth 클라이언트 ID는 **모바일에 불필요** (API 서버에서 관리).

---

## UI 컴포넌트 문서 규칙

`src/shared/ui/` 하위에 새 컴포넌트를 생성할 때 **반드시** 다음을 수행한다:

1. `src/shared/ui/{ComponentDir}/{ComponentName}.md` 문서 생성 (사용법, Props 표, 파일 구조)
2. [`.claude/ui-components.md`](.claude/ui-components.md)의 **Shared UI 컴포넌트 목록** 테이블에 행 추가
