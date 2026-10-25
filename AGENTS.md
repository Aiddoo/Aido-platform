# Aido

> **Version**: 1.1.0 · **Last Updated**: 2026-08-14 · **Owner**: Aido Platform Team

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

NestJS 12.2 ESM · Prisma 8 RC (ORM rc.20, CLI rc.27) · PostgreSQL 16 · Expo SDK 58 · React Native 0.88 · React 19.3 · TypeScript 6.0 · Zod 4.3.6 · Oxlint 1.89 · Oxfmt 0.74 · Turbo 2.11 · pnpm 12.15 · Node 24.22.1

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

| 명령어              | 설명                          |
| ------------------- | ----------------------------- |
| `pnpm install`      | 의존성 설치                   |
| `pnpm docker:up`    | PostgreSQL 컨테이너 시작      |
| `pnpm dev`          | 전체 개발 서버                |
| `pnpm build`        | 전체 빌드                     |
| `pnpm typecheck`    | 타입 체크                     |
| `pnpm lint`         | Oxlint 정적 검사              |
| `pnpm format`       | 코드 포맷팅                   |
| `pnpm format:check` | Oxfmt 포맷 검사               |
| `pnpm test`         | 단위 테스트                   |
| `pnpm test:e2e`     | E2E 테스트                    |
| `pnpm db:migrate`   | Prisma 8 migration graph 적용 |
| `pnpm commit`       | Conventional Commit 생성기    |

---

## 작업 유형별 문서 네비게이션

| 하려는 일                        | 읽을 문서                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| API 기능 추가·Context 경계 변경  | [`apps/api/AGENTS.md`](apps/api/AGENTS.md), 필요에 따라 [구조](apps/api/.claude/architecture.md)·[코드 규칙](apps/api/.claude/api-conventions.md) |
| Mobile 기능 추가 (Feature-based) | [`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md) → [`apps/mobile/.claude/architecture.md`](apps/mobile/.claude/architecture.md)                   |
| Zod 스키마 / DTO 추가            | [`apps/api/.claude/rest-contracts.md`](apps/api/.claude/rest-contracts.md)                                                                        |
| Prisma 스키마 변경               | [`apps/api/.claude/prisma.md`](apps/api/.claude/prisma.md)                                                                                        |
| 단위/통합/E2E 테스트             | `apps/{api,mobile}/.claude/testing-guide.md`                                                                                                      |
| Mobile UI 컴포넌트               | [`apps/mobile/.claude/ui-components.md`](apps/mobile/.claude/ui-components.md)                                                                    |
| Mobile 다국어 / 문자열 추가      | [`apps/mobile/.claude/i18n-guide.md`](apps/mobile/.claude/i18n-guide.md)                                                                          |
| 홈 화면 위젯 (iOS/Android)       | [`apps/mobile/.claude/widgets.md`](apps/mobile/.claude/widgets.md)                                                                                |
| OAuth / 소셜 로그인              | [`apps/mobile/.claude/oauth-client-guide.md`](apps/mobile/.claude/oauth-client-guide.md)                                                          |
| 로깅 패턴                        | [`apps/api/.claude/logging-guide.md`](apps/api/.claude/logging-guide.md)                                                                          |
| 응답·오류, 날짜·시간, 하위 호환  | [오류](docs/conventions/errors.md) · [날짜](docs/conventions/dates.md) · [호환](docs/conventions/compatibility.md)                                |
| 배포                             | `apps/{api,mobile}/DEPLOYMENT.md`                                                                                                                 |

---

## 규칙 & 금칙

- **린트/포맷**: Oxlint + Oxfmt — `pnpm lint`, `pnpm format:check`, `pnpm format`
- **커밋/PR/이슈**: 한국어 Conventional Commits(`refactor(server): …`, `ci(server): …`). PR은 요약·주요 변경·실제 검증, 측정한 숫자만. stack은 `stack:<release>`, tip만 `ci:stack-tip`. 상세: [docs/conventions/git.md](docs/conventions/git.md)
- **타입**: `strict: true`. `as`(`as const` 제외)·`any`·`!`·`@ts-ignore`/`@ts-expect-error` 금지, 타입은 Zod·props·상수 튜플에서 유도
- **DTO**: `@aido/api`의 Zod 스키마 사용. 앱 내부 중복 정의 금지
- **에러 코드**: `@aido/api/errors`의 `ErrorCode`를 사용. 하드코딩 문자열 금지
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
