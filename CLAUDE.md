# Aido

> **Version**: 1.0.0 · **Last Updated**: 2026-04-23 · **Owner**: Aido Platform Team

Turborepo + pnpm 모노레포. AI 기반 할 일 관리 서비스의 API 서버와 모바일 앱을 포함.

---

## TL;DR (Claude 세션 체크리스트)

- 작업 전 관련 `.claude/*.md` 가이드를 **먼저** 읽는다 (아래 네비게이션 표 참조).
- 변경 후 항상 `pnpm typecheck && pnpm lint`로 검증한다.
- 파괴적 명령(`db:push --force-reset`, `rm -rf`, `git reset --hard`, `git push --force`)은 **사용자 확인 필수**.
- CLAUDE.md는 세션마다 컨텍스트로 로드되므로 **얇게 유지**한다. 상세 패턴·예제는 `.claude/*.md`에 둔다.

---

## 기술 스택 (요약)

NestJS 11 · Prisma 7 · PostgreSQL 16 · Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript 5.9 · Zod 4.3 · Biome 2.4 · Turbo 2.9 · pnpm 10.29

상세: [README.md](./README.md)

---

## 모노레포 구조

```
apps/api            NestJS 백엔드
apps/mobile         Expo 모바일 앱
packages/validators Zod 스키마 (@aido/validators)
packages/utils      공유 유틸리티 (@aido/utils)
packages/errors     에러 코드 (@aido/errors)
tooling/*           공유 설정 (biome, jest, vitest, typescript)
```

---

## 핵심 명령어

| 명령어 | 설명 |
|--------|------|
| `pnpm install` | 의존성 설치 |
| `pnpm docker:up` | PostgreSQL 컨테이너 시작 |
| `pnpm dev` | 전체 개발 서버 |
| `pnpm build` | 전체 빌드 |
| `pnpm typecheck` | 타입 체크 |
| `pnpm lint` | Biome 린트 |
| `pnpm format` | 코드 포맷팅 |
| `pnpm test` | 단위 테스트 |
| `pnpm test:e2e` | E2E 테스트 |
| `pnpm db:migrate` | Prisma 마이그레이션 |
| `pnpm commit` | Conventional Commit 생성기 |

---

## 작업 유형별 문서 네비게이션

| 하려는 일 | 읽을 문서 |
|-----------|-----------|
| API 기능 추가 (클린아키텍처 CQRS — todo 표준 / 레거시 3계층) | [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) → [`apps/api/.claude/architecture.md`](apps/api/.claude/architecture.md) |
| Mobile 기능 추가 (Feature-based) | [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) → [`apps/mobile/.claude/architecture.md`](apps/mobile/.claude/architecture.md) |
| Zod 스키마 / DTO 추가 | [`apps/api/.claude/validators.md`](apps/api/.claude/validators.md) |
| Prisma 스키마 변경 | [`apps/api/.claude/prisma.md`](apps/api/.claude/prisma.md) |
| 단위/통합/E2E 테스트 | `apps/{api,mobile}/.claude/testing-guide.md` |
| Mobile UI 컴포넌트 | [`apps/mobile/.claude/ui-components.md`](apps/mobile/.claude/ui-components.md) |
| Mobile 다국어 / 문자열 추가 | [`apps/mobile/.claude/i18n-guide.md`](apps/mobile/.claude/i18n-guide.md) |
| OAuth / 소셜 로그인 | [`apps/mobile/.claude/oauth-client-guide.md`](apps/mobile/.claude/oauth-client-guide.md) |
| 로깅 패턴 | [`apps/api/.claude/logging-guide.md`](apps/api/.claude/logging-guide.md) |
| 배포 | `apps/{api,mobile}/DEPLOYMENT.md` |

---

## 규칙 & 금칙

- **린트/포맷**: Biome 2.4 — `pnpm lint`, `pnpm format`
- **커밋**: Conventional Commits (`pnpm commit` 권장)
- **타입**: `strict: true` 유지
- **DTO**: `@aido/validators`의 Zod 스키마 사용. 앱 내부 중복 정의 금지
- **에러 코드**: `@aido/errors`의 `ErrorCode`를 사용. 하드코딩 문자열 금지
- **API 문서**: Swagger UI는 `http://localhost:8080/api-docs`
- **CLAUDE.md**: 세션마다 로드되므로 *얇게 유지*. 상세는 `.claude/*.md`로 분리

---

## AI 가이드 인덱스

- **API**: [`apps/api/.claude/`](apps/api/.claude/) — architecture, api-conventions, prisma, validators, logging, testing
- **Mobile**: [`apps/mobile/.claude/`](apps/mobile/.claude/) — architecture, testing-guide, ui-components, oauth-client-guide
