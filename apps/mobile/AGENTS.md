# Aido Mobile App

> **Version**: 1.6.0 · **Last Updated**: 2026-11-06 · **Owner**: Aido Mobile Team

Expo 기반 React Native 모바일 앱. Feature-based Layered Architecture.

서버·앱 공통 규칙은 [루트 공통 코드 규칙](../../AGENTS.md#공통-코드-규칙)에 있다. 이 파일은 앱의 입구이고 상세는 아래 문서에 있다.

---

## 문서 가이드

| 상황                                                       | 읽을 문서                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 화면·컴포넌트·모델·서비스·DI·상태·넓은 화면                | [.claude/architecture.md](.claude/architecture.md)                                             |
| UI 부품 선택·스타일·애니메이션·safe area                   | [.claude/ui-components.md](.claude/ui-components.md)                                           |
| 테스트 작성                                                | [.claude/testing-guide.md](.claude/testing-guide.md)                                           |
| 테스트 범위와 이유                                         | [docs/testing-strategy.md](docs/testing-strategy.md)                                           |
| 에러 처리 (Result, ApiError, QueryErrorBoundary, 오프라인) | [docs/error-handling.md](docs/error-handling.md)                                               |
| 관측 (Analytics · Sentry · Breadcrumb · Severity)          | [.claude/observability.md](.claude/observability.md)                                           |
| 다국어·문구 (ko+en 카탈로그)                               | [.claude/i18n-guide.md](.claude/i18n-guide.md)                                                 |
| Todo 댓글 한 화면·답글·작성 바·더블탭 하트                 | [.claude/todo-comments.md](.claude/todo-comments.md)                                           |
| 인증 상태·토큰·로그인 플로우                               | [docs/authentication_guide.md](docs/authentication_guide.md)                                   |
| OAuth·소셜 로그인                                          | [.claude/oauth-client-guide.md](.claude/oauth-client-guide.md)                                 |
| 홈 화면 위젯 (iOS WidgetKit / Android AppWidget)           | [.claude/widgets.md](.claude/widgets.md)                                                       |
| 푸시 알림 클라이언트 (권한·토큰 보고·안내)                 | [docs/push-notifications.md](docs/push-notifications.md)                                       |
| 현재 릴리스 1.15.0 변경                                    | [docs/releases/1.15.0-client.md](docs/releases/1.15.0-client.md)                               |
| 지난 릴리스                                                | [docs/releases/](docs/releases/)                                                               |
| EAS 빌드·Secrets                                           | [docs/eas-build-guide.md](docs/eas-build-guide.md), [docs/EAS_SECRETS.md](docs/EAS_SECRETS.md) |
| 배포 (EAS, App Store / Play)                               | [DEPLOYMENT.md](DEPLOYMENT.md)                                                                 |

---

## 기술 스택 (요약)

Expo SDK 58.0.23 · React Native 0.88 · React 19.3 · Expo Router · TanStack Query 5 · Ky · Zod 4.6 · HeroUI Native · Uniwind · `react-hook-form`

---

## 구조

```
features/{feature}/   # 단수 kebab-case
├── domains/          # Zod 모델 + 순수 함수 + Policy + Error
├── apis/             # Service + Mapper + 로컬 저장소 repository
├── components/       # UI 블록 + 부모에 결합된 네임스페이스 조각
├── hooks/            # 단일 책임 훅 (route 읽기, [value, setValue] 튜플)
├── queries/          # Query·Mutation Options, {feature}-cache.ts
├── constants/        # Query Keys, 라벨·옵션 상수
├── utils/            # 순수 계산, navigation/, view-models/
└── __tests__/        # 테스트 팩토리
```

| 파일 유형        | 패턴                                                 |
| ---------------- | ---------------------------------------------------- |
| 모델 + Policy    | `domains/{entity}.model.ts`                          |
| 에러             | `domains/{feature}.error.ts`                         |
| 폼 스키마        | `domains/{name}-form.schema.ts`                      |
| 서비스           | `apis/{feature}.service.ts`                          |
| 매퍼             | `apis/{entity}.mapper.ts`                            |
| Query Options    | `queries/get-{resource}[-infinite]-query-options.ts` |
| Mutation Options | `queries/use-{action}-mutation-options.ts`           |
| 캐시 helper      | `queries/{feature}-cache.ts`                         |
| Query Keys       | `constants/{feature}-query-keys.ts`                  |

---

## 핵심 규칙

상세와 이유는 [architecture.md](.claude/architecture.md)에 있다.

- **[화면](.claude/architecture.md#화면)**: 위에서 아래로 읽힌다. Boundary·`Suspense`·`Spacing`을 스크린에 나열한다. 넘기기용 래퍼를 만들지 않는다. fallback은 `X.Loading`·`X.Error`다.
- **[컴포넌트](.claude/architecture.md#컴포넌트-계약)**: 데이터는 쓰는 컴포넌트가 조회한다. 화면 id는 route hook에서 읽는다. 바깥 레이아웃을 모른다. Props는 `Omit<ComponentProps<typeof X>, …>`로 원본 이름을 살린다. 반복 표시는 `<Record />`를 나란히 쓴다. 래퍼는 역할이 있을 때만 만든다. 한 곳에서만 쓰면 파일 아래 지역 컴포넌트다.
- **[모델](.claude/architecture.md#모델과-policy)**: Zod + 순수 함수 + Policy Facade. UI를 모른다. 모델이 첫 인자다. 동사형 이름이고 `xxxOf`는 쓰지 않는다. 서버 값을 다시 계산하지 않는다. 서버 응답은 mapper만 안다.
- **[DI](.claude/architecture.md#portadapterdi)**: 포트는 앱의 말로 짓는다. SDK import는 `shared/infra`에서만 한다. `check:conventions`가 강제한다. Mapper는 DI에 넣지 않는다.
- **[상태](.claude/architecture.md#상태)**: 서버·URL·MMKV·폼·임시 값을 구분하고 원천 하나에만 둔다.
- **[오류](docs/error-handling.md)**: 4xx·Policy는 `Result.err()`, 5xx·네트워크·파싱은 `throw`다. 한 오류는 한 곳에서만 보인다.
- **[UI](.claude/ui-components.md)**: heroui-native → `shared/ui` → RN 순서다. 새 `shared/ui` 컴포넌트는 `{name}.md`를 만들고 [목록](.claude/ui-components.md#shared-ui-컴포넌트-목록)에 추가한다.
- **[넓은 화면](.claude/architecture.md#넓은-화면과-기기)**: 창 폭(`useWindowSizeClass`)으로 판단한다. 힌지로 레이아웃을 나누지 않는다.
- **[상수·날짜](.claude/architecture.md#상수와-날짜)**: 기존 도구 하나로 쓴다. 새 `Intl` 포매터를 만들지 않는다.
- **[문구](.claude/i18n-guide.md)**: 하드코딩하지 않고 ko·en 카탈로그에 함께 넣는다. 해요체, 앱 이름은 "아이두"/"Aido"다.
- **[관측](.claude/observability.md)**: Sentry는 `ErrorReporter`·`Logger` 포트, GA는 타입 카탈로그 `useTrack`이다.
- **인증**: `useAuth()`로 읽고 토큰은 `TokenStore` 포트(SecureStore)에 둔다. OAuth 클라이언트 ID는 API 서버가 관리한다.
- **코드 스타일**: `void` 연산자를 쓰지 않는다(Oxlint). 포맷은 Oxfmt다.

공통 규칙: [dates](../../docs/conventions/dates.md), [errors](../../docs/conventions/errors.md), [nullish](../../docs/conventions/nullish.md), [compatibility](../../docs/conventions/compatibility.md)

새 기능 순서: [체크리스트](.claude/architecture.md#새-feature-추가-체크리스트)

---

## 환경 변수

```bash
# 런타임
APP_ENV                      # development | preview | production
EXPO_PUBLIC_API_URL          # API 서버 URL
EXPO_PUBLIC_SENTRY_DSN       # Sentry DSN (publishable, 관측)
EXPO_PUBLIC_SENTRY_DEBUG     # (선택) dev에서 Sentry SDK만 켠다. 'true'일 때만. JS 어댑터는 운영 빌드에서만 Sentry다

# 빌드 (EAS Secrets)
GOOGLE_SERVICES_JSON         # Firebase Android (Base64), Analytics
GOOGLE_SERVICES_INFO_PLIST   # Firebase iOS (Base64), Analytics
SENTRY_AUTH_TOKEN            # Sentry 소스맵 업로드 (sensitive)
EXPO_PUBLIC_EAS_PROJECT_ID   # EAS 프로젝트 ID
```

Crashlytics는 쓰지 않는다. 크래시·에러는 Sentry, 제품 지표는 Firebase Analytics다.
