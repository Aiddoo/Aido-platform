# Aido

> **Version**: 1.2.1 · **Last Updated**: 2026-11-07 · **Owner**: Aido Platform Team

Turborepo + pnpm 모노레포. AI 기반 할 일 관리 서비스의 API 서버와 모바일 앱을 포함.

---

## 작업 진입점

- API 작업은 [`apps/api/AGENTS.md`](apps/api/AGENTS.md)에서 시작하고, 작업에 해당하는 상세 문서만 참조한다. 문서 전체를 순서대로 읽을 필요는 없다.
- Mobile 작업은 기존 [`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md)를 따른다.
- 서버 검증 범위는 변경한 동작과 위험에 맞춘다. 문서만 바꾸면 링크·예제·포맷을 확인하고, 코드 변경은 관련 정적 검사와 의미 있는 테스트로 확인한다. 통과한 검사는 추가 변경·실패·미확인 위험이 있을 때 다시 실행한다. Mobile 검증 규칙은 해당 앱 지침을 따른다.
- 데이터 삭제·운영 migration·배포·공유 Git 이력 재작성은 사용자의 기존 승인 범위에서만 실행한다. 요청과 무관한 파괴적 초기화는 하지 않는다. 서버의 일회성 테스트 DB 생성·삭제는 해당 테스트 실행의 정상 수명주기다.
- `AGENTS.md`는 Claude/Codex 공통 지침의 **단일 원본**으로 유지한다. `CLAUDE.md`에는 별도 공통 규칙을 추가하지 않는다.
- `AGENTS.md`는 세션 컨텍스트에 포함되므로 **얇게 유지**한다. 상세 패턴·예제는 `.claude/*.md`에 둔다.

---

## 기술 스택 (요약)

NestJS 12.3 ESM · Drizzle ORM 1.0 RC · PostgreSQL 16 · Expo SDK 58.0.x · React Native 0.88 · React 19.3 · TypeScript 6.0 · Zod 4.6 · Oxlint 1.91 · Oxfmt 0.76 · Turbo 2.11 · pnpm 12.15 · Node 24.22.2

상세: [README.md](./README.md)

---

## 모노레포 구조

```
apps/api            NestJS 백엔드
apps/mobile         Expo 모바일 앱
packages/api        REST 스키마·오류 계약·순수 공용 타입 (@aido/api)
tooling/*           공유 설정 (vitest, typescript) 및 migration CLI
```

---

## 핵심 명령어

| 명령어              | 설명                       |
| ------------------- | -------------------------- |
| `pnpm install`      | 의존성 설치                |
| `pnpm docker:up`    | PostgreSQL 컨테이너 시작   |
| `pnpm dev`          | 전체 개발 서버             |
| `pnpm build`        | 전체 빌드                  |
| `pnpm typecheck`    | 타입 체크                  |
| `pnpm lint`         | Oxlint 정적 검사           |
| `pnpm format`       | 코드 포맷팅                |
| `pnpm format:check` | Oxfmt 포맷 검사            |
| `pnpm test`         | 단위 테스트                |
| `pnpm test:e2e`     | E2E 테스트                 |
| `pnpm db:migrate`   | Drizzle migration 적용     |
| `pnpm commit`       | Conventional Commit 생성기 |

---

## 작업 유형별 문서 네비게이션

| 하려는 일                            | 읽을 문서                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| API 기능 추가·Context 경계 변경      | [`apps/api/AGENTS.md`](apps/api/AGENTS.md), 필요에 따라 [구조](apps/api/.claude/architecture.md)·[코드 규칙](apps/api/.claude/api-conventions.md) |
| Mobile 기능 추가 (Feature-based)     | [`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md) → [`apps/mobile/.claude/architecture.md`](apps/mobile/.claude/architecture.md)                   |
| Zod 스키마 / DTO 추가                | [`apps/api/.claude/rest-contracts.md`](apps/api/.claude/rest-contracts.md)                                                                        |
| DB 스키마·ORM 변경                   | [`apps/api/.claude/drizzle.md`](apps/api/.claude/drizzle.md)                                                                                      |
| 단위/통합/E2E 테스트                 | `apps/{api,mobile}/.claude/testing-guide.md`                                                                                                      |
| Mobile UI 컴포넌트                   | [`apps/mobile/.claude/ui-components.md`](apps/mobile/.claude/ui-components.md)                                                                    |
| Mobile 다국어 / 문자열 추가          | [`apps/mobile/.claude/i18n-guide.md`](apps/mobile/.claude/i18n-guide.md)                                                                          |
| 홈 화면 위젯 (iOS/Android)           | [`apps/mobile/.claude/widgets.md`](apps/mobile/.claude/widgets.md)                                                                                |
| OAuth / 소셜 로그인                  | [`apps/mobile/.claude/oauth-client-guide.md`](apps/mobile/.claude/oauth-client-guide.md)                                                          |
| 로깅 패턴 (서버 이벤트 키·오류 필드) | [`apps/api/.claude/logging-guide.md`](apps/api/.claude/logging-guide.md)                                                                          |
| 요청 헤더·throttle (서버)            | [`apps/api/.claude/api-conventions.md`](apps/api/.claude/api-conventions.md#요청-헤더와-throttle)                                                 |
| 푸시 기기·발송 (서버)                | [`apps/api/docs/push-notifications.md`](apps/api/docs/push-notifications.md)                                                                      |
| 응답·오류, 날짜·시간, 하위 호환      | [오류](docs/conventions/errors.md) · [날짜](docs/conventions/dates.md) · [호환](docs/conventions/compatibility.md)                                |
| 배포                                 | `apps/{api,mobile}/DEPLOYMENT.md`                                                                                                                 |

---

## 공통 코드 규칙

서버·앱 공통이다. 앱·서버 문서는 여기로 링크하고 되풀이하지 않는다.

- **책임**: SOLID와 단일 책임을 지킨다. 계산·변환은 부수효과 없는 순수 함수로 두고 훅·클래스는 그것을 감싼다.
- **이름**: 실무에서 흔하고 직관적으로 짓는다. 파일·변수·메서드를 같은 규칙으로 맞춘다. 포트 이름에는 SDK·공급자 이름을 쓰지 않는다.
- **주석**: 코드만 봐서는 알 수 없는 이유(제약, 버전 사유, 정책, QA 근거)만 한 줄로 남긴다. 이름·인자·반환을 되풀이하는 JSDoc, 다음 줄을 설명하는 주석, 구역 구분선, 변경 이력("이전에는", PR 번호)은 쓰지 않는다. 플랫폼 차이, 서버 동작·하위 호환, 순서·경합 이유, 뻔하지 않은 반환값의 뜻("true면 멈춘다")은 코드에 없는 정보라 남긴다. 테스트의 `// Given`·`// When`·`// Then`과 계산 근거 주석은 남긴다.
- **제어문**: 한 줄 `if`도 `if (조건) { return; }`처럼 중괄호를 쓴다.
- **라이브러리**: 라이브러리·프레임워크가 주는 기능을 다시 만들지 않는다(es-toolkit, ts-pattern 등). 공식 문서의 권장 방식을 먼저 본다.
- **테스트**: 새 테스트는 중요한 비즈니스 로직과 공용 유틸에만 쓴다. `// Given`·`// When`·`// Then` 한 줄 주석과 한국어 제목을 쓴다. mock보다 포트 stub을 쓰고 외부 API는 부르지 않는다. 기존 테스트를 일괄 교체하지 않는다.
- **정리**: 안 쓰는 코드·파일과 레거시를 지운다. 출시 앱이 쓰는 계약만 남긴다([호환](docs/conventions/compatibility.md)).
- **비밀**: env 값·토큰·키를 로그·문서·커밋에 쓰지 않는다.

---

## 규칙 & 금칙

- **린트/포맷**: Oxlint + Oxfmt — `pnpm lint`, `pnpm format:check`, `pnpm format`
- **커밋/PR/이슈**: 한국어 Conventional Commits(`refactor(server): …`, `ci(server): …`). PR은 요약·주요 변경·실제 검증, 측정한 숫자만. stack은 `stack:<release>`, tip만 `ci:stack-tip`. 상세: [docs/conventions/git.md](docs/conventions/git.md)
- **타입**: `strict: true`. `as`(`as const` 제외)·`any`·`!`·`@ts-ignore`/`@ts-expect-error` 금지, 타입은 Zod·props·상수 튜플에서 유도
- **DTO**: 요청·응답 계약은 `@aido/api`, 앱 모델은 앱이 소유
- **에러 코드**: `@aido/api/errors`의 `ErrorCode`를 사용. 하드코딩 문자열 금지
- **서버 요청 헤더**: Controller에서 `@Headers("x-…")`를 쓰지 않는다. `RequestClient`(`@CurrentRequestClient()`·`@AppVersion()`)로 읽는다
- **서버 테스트**: 상태가 중요하면 깊은 mock 대신 작은 Port Stub/Fake, DB 의미는 실제 PostgreSQL(Testcontainers)로 검증
- **비교·null/undefined**: 값 비교는 `===`, "없음"만 `== null`(Oxlint `eqeqeq`). 상세: [docs/conventions/nullish.md](docs/conventions/nullish.md)
- **API 문서**: Swagger UI는 `http://localhost:8080/api/docs`
- **AGENTS.md**: Claude/Codex 공통 지침의 단일 원본. 세션 컨텍스트에 포함되므로 _얇게 유지_. 상세는 `.claude/*.md`로 분리

---

## AI 가이드 인덱스

- **API**: [서버 문서 안내](docs/server/README.md) — 작업별 설계·계약·테스트·배포와 검증 기록
- **Mobile**: [`apps/mobile/.claude/`](apps/mobile/.claude/) — architecture, testing-guide, ui-components, oauth-client-guide

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
