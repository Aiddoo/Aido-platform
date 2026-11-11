# Aido Mobile App

> **Version**: 1.9.0 · **Last Updated**: 2026-11-11 · **Owner**: Aido Mobile Team

Expo 기반 React Native 모바일 앱. Feature-based Layered Architecture.

서버·앱 공통 규칙은 [루트 공통 코드 규칙](../../AGENTS.md#공통-코드-규칙)에 있다. 이 파일은 앱의 입구이고 상세는 아래 문서에 있다.

---

## 문서 가이드

| 상황                                                       | 읽을 문서                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 사용성·화면·컴포넌트·모델·서비스·DI·상태·넓은 화면         | [.claude/architecture.md](.claude/architecture.md)                                             |
| UI 부품 선택·스타일·애니메이션·safe area                   | [.claude/ui-components.md](.claude/ui-components.md)                                           |
| HeroUI Native 부품 문서 색인·테마                          | [.claude/heroui-native.md](.claude/heroui-native.md), [DESIGN.md](DESIGN.md)                   |
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
| 새로운 기능 출시 (Steps·캠페인·이미지)                     | [docs/whats-new-release.md](docs/whats-new-release.md)                                         |
| 현재 릴리스 1.15.1 변경                                    | [docs/releases/1.15.1-client.md](docs/releases/1.15.1-client.md)                               |
| 지난 릴리스                                                | [docs/releases/](docs/releases/)                                                               |
| EAS 빌드·Secrets                                           | [docs/eas-build-guide.md](docs/eas-build-guide.md), [docs/EAS_SECRETS.md](docs/EAS_SECRETS.md) |
| 배포 (EAS, App Store / Play)                               | [DEPLOYMENT.md](DEPLOYMENT.md)                                                                 |

---

## 기술 스택 (요약)

Expo SDK 58.0.23 · React Native 0.88 · React 19.3 · Expo Router · TanStack Query 5 · Ky · Zod 4.6 · HeroUI Native · Uniwind · `react-hook-form`

---

## 구조

```
features/{area}/{feature}/   # 서버 모듈 이름의 업무 영역 + 단수 kebab-case 기능 (voice, notification, weather는 한 단계)
├── domains/          # 클라이언트 도메인 모델: 모델 스키마·타입 + 순수 함수 + Policy, 오류
├── schemas/          # 폼·초안·route·쿼리 키·기기 저장 모양, 서버와 주고받는 요청·응답·payload(계약에서 pick·omit)
├── apis/             # Service, Mapper, 로컬 저장소 repository
├── queries/          # 조회·변경 옵션, {feature}-cache.ts
├── constants/        # Query Keys, feature 상수
├── components/       # UI 블록과 부모에 결합된 네임스페이스 조각
├── hooks/            # 여러 파일이 쓰는 튜플 훅(route 값은 읽기 전용도 튜플), 한 파일만 쓰면 그 파일 안
├── utils/            # 초안 키, view-model, 순수 계산
└── __tests__/        # fixture, 테스트 DI
```

| 파일 유형      | 패턴                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 도메인 모델    | `domains/{entity}.model.ts`(모델 스키마·타입 + 순수 함수 + Policy를 한 파일에)                                                                     |
| 공유 계약 타입 | `schemas/{name}-response.schema.ts`·`{name}-request.schema.ts`(서버와 공유하는 요청·응답 모양, 계약에서 pick·omit)                                 |
| 에러           | `domains/{feature}.error.ts`                                                                                                                       |
| 기기 저장 모양 | `schemas/{name}-storage.schema.ts`(MMKV·SecureStore·위젯 저장소). 모델과 같으면 모델 스키마를 `extend`                                             |
| 폼 스키마      | `schemas/{name}-form.schema.ts`                                                                                                                    |
| 서비스         | `apis/{feature}.service.ts`                                                                                                                        |
| 매퍼           | `apis/{entity}.mapper.ts`                                                                                                                          |
| 조회 옵션      | `queries/{entity}.queries.ts`                                                                                                                      |
| 변경 옵션      | `queries/{entity}.mutations.ts`                                                                                                                    |
| 캐시 helper    | `queries/{feature}-cache.ts`                                                                                                                       |
| Query Keys     | `constants/{feature}-query-keys.ts`                                                                                                                |
| feature 상수   | `constants/{feature}.constants.ts`                                                                                                                 |
| 라벨 키        | `constants/{feature}-labels.ts`. 한 파일만 쓰면 그 파일 지역 상수                                                                                  |
| URL params     | `schemas/{name}-params.schema.ts` + `hooks/use-{name}-param(s).ts`(여러 파일이 쓸 때만). 탭·보기는 공용 `useView`, 한 곳이면 `useRouteParams` 직접 |
| 쿼리 키 값     | `schemas/{name}-query-key.schema.ts`. `Params`는 route에만 쓴다                                                                                    |
| 초안 키        | `utils/{feature}-draft.ts`                                                                                                                         |
| 표시 값        | `utils/{name}.view-model.ts`                                                                                                                       |
| 좌표·도형 계산 | `utils/{name}.geometry.ts`                                                                                                                         |
| Mutation Keys  | `constants/{entity}-mutation-keys.ts`                                                                                                              |
| 로그 키        | `constants/{entity}-log-events.ts`                                                                                                                 |
| 분석 이벤트    | `constants/{entity}.events.ts`                                                                                                                     |
| 테스트 fixture | `__tests__/{entity}.fixtures.ts`                                                                                                                   |

파일 이름의 접두사는 그 파일이 다루는 entity 이름이다(`todo-comment.*`, `todo-category.*`). 같은 feature에서 다른 접두사를 쓰지 않는다. 표의 `{feature}`도 feature 이름이 entity 이름을 줄인 것이면 entity 이름을 쓴다(`social/nudge`는 `todo-nudge-query-keys.ts`).

`schemas/` 파일은 `-form`·`-params`·`-draft`·`-query-key`·`-storage`·`-request`·`-response`·`-payload`·`-entry`로 끝나고 모델 스키마는 모두 `domains/`에 있다(`check:conventions`가 막는다). 남은 차이는 모델이 `schemas/` 값을 읽는 곳 등이다. 차이 목록: [아직 옮기지 않은 것](.claude/architecture.md#아직-옮기지-않은-것). 층과 허용 import: [층과 의존](.claude/architecture.md#층과-의존).

---

## 핵심 규칙

상세와 이유는 [architecture.md](.claude/architecture.md)에 있다.

- **[사용성](.claude/architecture.md#사용성)**: 코드 구조보다 먼저다. 입력칸과 저장 버튼은 키보드 위에 보이고, 키보드가 열린 채 버튼은 첫 탭에 눌리고, 저장 실패에도 글자가 남는다. 구조를 고치다 나빠지면 구조를 양보한다.
- **[이름](.claude/architecture.md#이름)**: 판별 함수는 `can*`(사용자가 해도 되나), `should*`(앱이 할 때인가), `is*`(상태), `has*`(가진 것, 이미 일어난 일)만 쓰고 부정 이름은 쓰지 않는다. 안내를 띄우는 함수는 `promptIf*`이고 true는 "안내를 띄웠다, 멈춘다"다. 불리언 ref는 `*Ref`다. 같은 종류 함수는 반환과 실패 표현이 같다. Policy 키도 같은 접두사를 따른다. 코드 품질 판단은 [Frontend Fundamentals](https://frontend-fundamentals.com/code-quality/)를 기준으로 한다([architecture](.claude/architecture.md#코드-품질-판단-기준)).
- **[모델](.claude/architecture.md#모델과-policy)**: 가장 중요한 규칙이다. `domains/{entity}.model.ts`는 프론트엔드의 도메인 모델이다. 앱이 쓰는 모델 스키마·타입, 이름 있는 순수 함수, Policy Facade를 한 파일에 응집한다. 모델은 서버 응답 모양과 독립이라 계약(`@aido/api` 루트·contracts)을 import하지 않고, `apis/{entity}.mapper.ts`가 DTO를 모델로 바꾼다. 서버 필드가 바뀌면 mapper만 고친다. `schemas/`는 폼·초안·route·쿼리 키·기기 저장 모양과 서버와 주고받는 요청·응답·payload만 둔다. Policy는 모듈 함수를 모은 객체(`{ canDelete } as const`)이고 멤버는 모델 전체(`category: TodoCategory`, 목록은 `readonly TodoCategory[]`)를 첫 인자로 받는 동사형 이름이다. `Pick`·객체 리터럴로 좁히지 않고, 모델 일부(폼 값·`select` 결과)만 가진 곳의 규칙은 Policy 밖 순수 함수로 둔다. 한 Policy는 한 엔티티다. 문구·i18n 키·색·레이아웃·폼 값·초안 키를 넣지 않고, 서버 값을 다시 계산하지 않는다.
- **[화면](.claude/architecture.md#화면)**: 위에서 아래로 읽힌다. Boundary·`Suspense`·`Spacing`과 화면 구성을 설명하는 글자를 스크린에 나열한다. 넘기기용 래퍼를 만들지 않는다. fallback은 `X.Loading`·`X.Error`다.
- **[컴포넌트](.claude/architecture.md#컴포넌트-계약)**: 데이터는 쓰는 컴포넌트가 조회한다. 화면 id는 route hook에서 읽는다. 바깥 레이아웃을 모른다. Props는 `Omit<ComponentProps<typeof X>, …>`로 원본 이름을 살린다. 반복 표시는 `<Record />`를 나란히 쓴다. 래퍼와 훅은 역할이 있을 때만 만든다. 한 곳에서만 쓰면 파일 아래 지역 컴포넌트다.
- **[레이아웃 시프트](.claude/architecture.md#레이아웃-시프트)**: 받은 뒤에 화면이 밀리지 않게 자리를 먼저 잡는다.
- **[함수 형태](.claude/architecture.md#함수-형태)**: 모듈 수준은 `function` 선언이다. 화살표는 Service 필드, 컴포넌트 안 핸들러, 인라인 콜백만 쓴다.
- **[DI](.claude/architecture.md#portadapterdi)**: 포트는 앱의 말로 짓는다. SDK import는 `shared/infra`에서만 한다. 조립은 순수 함수 `createAppContainer(ports)` 하나이고, 프로세스 수명 객체(로거·QueryClient·토큰·HTTP·결제 SDK)는 `composition-root`가 한 번 만든다([수명](.claude/architecture.md#수명)). feature는 `di-context` 훅으로만 꺼낸다. Mapper는 DI에 넣지 않는다.
- **[상태](.claude/architecture.md#상태)**: 서버·URL·MMKV·폼·임시 값을 구분하고 원천 하나에만 둔다. 앱이 만드는 Context는 DI와 UI 내부 구현에만 쓴다([대신 쓰는 것](.claude/architecture.md#context-대신-쓰는-것)).
- **[쿼리](.claude/architecture.md#query와-mutation)**: 옵션은 `useGetXQueryOptions`·`useXMutationOptions` 훅이고 화면은 `useSuspenseQuery`·`useMutation`을 직접 부른다. 저장 후 바로 떠나는 변경은 `onSettled`에서 Promise를 돌려주지 않는다.
- **[폼](.claude/architecture.md#폼)**: `useForm` 제네릭 없이 `form`으로 쓰고 입력은 RHF `Controller`로 잇는다. 생성과 수정은 스키마와 입력 부품만 공유하고 제출은 각자 소유한다([생성·수정](.claude/architecture.md#생성수정)).
- **[오류](docs/error-handling.md)**: 4xx·Policy는 `Result.err()`, 5xx·네트워크·파싱은 `throw`다. 한 오류는 한 곳에서만 보인다.
- **[UI](.claude/ui-components.md)**: heroui-native → `shared/ui` → RN 순서다. 글자·레이아웃은 `shared/ui`가 먼저다. 새 `shared/ui` 컴포넌트는 `{name}.md`를 만들고 [목록](.claude/ui-components.md#shared-ui-컴포넌트-목록)에 추가한다.
- **[넓은 화면](.claude/architecture.md#넓은-화면과-기기)**: 칸은 화면이 받은 폭(`usePaneSizeClass`, iPad 탭 사이드바 제외)으로, 방향 같은 창 전체 정책은 창 폭(`useWindowSizeClass`)으로 판단한다. 규칙은 `WindowLayoutPolicy`다. 레이아웃을 힌지로 나누지 않는다. 접힘선은 경계 위치만 맞춘다.
- **[상수·날짜](.claude/architecture.md#상수와-날짜)**: 기존 도구 하나로 쓴다. 새 `Intl` 포매터를 만들지 않는다.
- **서버 값**: 서버가 계산한 값(여러 날 할 일의 날짜별 완료, 알림함 `navigation`, 날씨 브리핑 `affectedTodoIds`·`rescheduleOptions`, 메모 AI 반복, 한도 오류 `details.limit`)은 다시 계산하지 않고 그대로 그린다. 앱·서버가 함께 아는 상수와 언어 규칙(`resolveSupportedLocale`)은 `@aido/api/vocabulary`에서 가져온다.
- **[문구](.claude/i18n-guide.md)**: 하드코딩하지 않고 ko·en 카탈로그에 함께 넣는다. 해요체, 앱 이름은 "아이두"/"Aido"다.
- **[관측](.claude/observability.md)**: Sentry는 `ErrorReporter`·`Logger` 포트, GA는 타입 카탈로그 `useTrack`이다.
- **인증**: `useAuthStatus()`로 읽고 `useAuthSession()`의 `signIn`, `signOut`으로 쓴다. 토큰은 `TokenStore` 포트(SecureStore)에 둔다. OAuth 클라이언트 ID는 API 서버가 관리한다.
- **테스트**: 주요 비즈니스 로직(Policy·모델·mutation·캐시·권한·버그 재현)만 쓴다. 늘 무작위 순서로 돈다. fake timer는 `setupFakeTimersPerTest`로만 켜고 끄고, 테스트가 일으킨 비동기 결과(토스트 등)는 기다려 확인한 뒤 끝낸다. Jest worker 수는 `AIDO_TEST_WORKERS`(기본 `50%`)로 줄이고 `workerIdleMemoryLimit`이 자란 worker를 다시 띄운다. 상세: [testing-guide](.claude/testing-guide.md#테스트-격리)
- **코드 스타일**: `void` 연산자를 쓰지 않는다(Oxlint). 포맷은 Oxfmt다. 린트 설정은 `apps/mobile/.oxlintrc.json`(루트 상속 + correctness, React Hooks·Compiler, Jest 규칙)이다. 규칙을 끌 때는 그 줄에서만 `oxlint-disable-next-line 규칙 -- 이유`로 끈다.

`check:conventions`가 막는 범위는 [이 표](.claude/architecture.md#checkconventions가-막는-것)가 전부다. 그 밖의 규칙은 리뷰로 지킨다.

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
