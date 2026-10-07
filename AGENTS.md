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

NestJS 12 ESM · Prisma 8 RC · PostgreSQL 16 · Expo SDK 58 · React Native 0.88 RC · React 19.3 · TypeScript 6 · Zod 4.3.6 · Oxlint 1.86 · Oxfmt 0.71 · Turbo 2.11 · pnpm 10.34

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
| 배포                             | `apps/{api,mobile}/DEPLOYMENT.md`                                                                                                                 |

---

## 규칙 & 금칙

- **린트/포맷**: Oxlint + Oxfmt — `pnpm lint`, `pnpm format:check`, `pnpm format`
- **이슈/PR**: 이슈는 배경·목표·완료 조건, PR은 요약·주요 변경·실제 검증을 기본으로 작성한다. 코드 가독성·품질 개선은 실제 base/head의 짧은 Before/After 코드와 문제·개선 이유를 적고 측정 성능과 구분한다. 재현·측정·위험·배포·화면 자료는 필요한 경우만 추가하고 merge와 운영 배포 상태를 구분한다.
- **커밋**: Conventional Commits (`pnpm commit` 권장). 설명은 한국어로 작성한다. 서버 리팩터링은 `refactor(server): 설명`, CI 변경은 `ci(server): 설명` 형식을 사용한다.
- **타입**: `strict: true` 유지
- **DTO**: `@aido/api`의 Zod 스키마 사용. 앱 내부 중복 정의 금지
- **에러 코드**: `@aido/api/errors`의 `ErrorCode`를 사용. 하드코딩 문자열 금지
- **API 문서**: Swagger UI는 `http://localhost:8080/api/docs`
- **AGENTS.md**: Claude/Codex 공통 지침의 단일 원본. 세션 컨텍스트에 포함되므로 _얇게 유지_. 상세는 `.claude/*.md`로 분리

---

## AI 가이드 인덱스

- **API**: [서버 문서 안내](docs/server/README.md) — 작업별 설계·계약·테스트·배포와 검증 기록
- **Mobile**: [`apps/mobile/.claude/`](apps/mobile/.claude/) — architecture, testing-guide, ui-components, oauth-client-guide
