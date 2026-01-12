# Aido

AI 기반 TodoList 앱 - Turborepo 모노레포

## 프로젝트 구조

```
Aido/
├── apps/
│   ├── api/          # NestJS 백엔드
│   └── mobile/       # Expo 모바일 앱
├── packages/
│   ├── utils/        # 공유 유틸리티
│   └── validators/   # Zod 스키마
└── tooling/          # 공유 설정 (Biome, TypeScript, Jest, Vitest)
```

## 아키텍처

### 패키지 의존성

```
apps/api ─────┬──> @aido/validators (Zod 스키마)
              └──> @aido/utils (유틸리티)

apps/mobile ──┬──> @aido/validators
              └──> @aido/utils

tooling/* ────> 설정 공유 (extends)
```

### 기술 스택

| 영역       | 기술                          |
| ---------- | ----------------------------- |
| Backend    | NestJS, Prisma 7, PostgreSQL  |
| Mobile     | Expo, React Native            |
| Validation | Zod (런타임 검증 + 타입 추출) |
| Testing    | Jest (API), Vitest (packages) |
| Linting    | Biome                         |
| Build      | Turborepo                     |

### API 모듈 패턴

```
src/
├── {feature}/
│   ├── {feature}.module.ts      # 모듈 정의
│   ├── {feature}.controller.ts  # HTTP 요청 처리
│   ├── {feature}.service.ts     # 비즈니스 로직
│   ├── {feature}.repository.ts  # 데이터 접근
│   └── dto/                     # 요청/응답 DTO
│       ├── create-{feature}.dto.ts
│       ├── update-{feature}.dto.ts
│       └── index.ts             # barrel export
└── common/
    └── filters/                 # 글로벌 예외 필터
```

## 시작하기

### 필수 조건

- Node.js v20.19+
- pnpm v9.15+
- Docker Desktop
- TypeScript 5.4+

### 설치

```bash
pnpm install
pnpm docker:up
pnpm db:generate
pnpm db:migrate
pnpm dev
```

## 주요 명령어

| 명령어           | 설명             |
| ---------------- | ---------------- |
| `pnpm dev`       | 개발 서버 시작   |
| `pnpm build`     | 빌드             |
| `pnpm test`      | 테스트           |
| `pnpm lint`      | 린트 검사        |
| `pnpm lint:fix`  | 린트 자동 수정   |
| `pnpm typecheck` | 타입 체크        |
| `pnpm db:push`   | DB 스키마 동기화 |
| `pnpm docker:up` | PostgreSQL 시작  |

## 코드 스타일

### 포맷팅 규칙 (Biome)

| 규칙      | 값           | 설명                    |
| --------- | ------------ | ----------------------- |
| 들여쓰기  | 2 spaces     | 탭 대신 스페이스        |
| 줄 길이   | 100자        | 최대 라인 너비          |
| 따옴표    | single (`'`) | 작은따옴표 사용         |
| 세미콜론  | always       | 항상 세미콜론           |
| 후행 쉼표 | all          | 배열/객체 마지막에 쉼표 |

> 상세 설정: [tooling/biome/README.md](./tooling/biome/README.md)

### 명명 규칙

| 대상            | 스타일               | 예시                 |
| --------------- | -------------------- | -------------------- |
| 파일/폴더       | kebab-case           | `create-todo.dto.ts` |
| 클래스          | PascalCase           | `TodoService`        |
| 함수/변수       | camelCase            | `findById()`         |
| 상수            | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT`    |
| 타입/인터페이스 | PascalCase           | `CreateTodoDto`      |

### Import 규칙

```typescript
// ✅ type imports 사용
import type { Todo } from "../generated/prisma/client";

// ✅ 값과 타입 분리
import { TodoService } from "./todo.service";
import type { CreateTodoDto } from "./dto";

// ✅ barrel exports 활용
export * from "./create-todo.dto";
export * from "./update-todo.dto";
```

- **Type imports**: 타입만 가져올 때 `import type` 사용
- **Barrel exports**: 각 모듈의 `index.ts`에서 재export
- **자동 정렬**: Biome가 import 순서 자동 정리

## 개발 워크플로우

### 브랜치 전략

```
main              # 프로덕션 브랜치
└── feature/*     # 기능 개발
└── fix/*         # 버그 수정
└── hotfix/*      # 긴급 수정
```

### 작업 순서

1. 이슈 생성 (버그/기능 요청)
2. 브랜치 생성: `git checkout -b feature/이슈번호-설명`
3. 개발 및 커밋
4. PR 생성 → 코드 리뷰
5. main 머지

### 커밋 규칙

[Conventional Commits](https://www.conventionalcommits.org/) 스펙을 따르며, [Commitlint](https://commitlint.js.org/)로 자동 검증됩니다.

#### 커밋 메시지 형식

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

**예시:**

```bash
feat(api): 사용자 인증 API 추가
fix(mobile): 로그인 화면 크래시 수정
docs: README 업데이트
refactor(api): 인증 로직 개선
```

#### 커밋 타입

| 타입       | 설명                             | 예시                                    |
| ---------- | -------------------------------- | --------------------------------------- |
| `feat`     | 새로운 기능 추가                 | `feat(api): 할일 목록 API 구현`         |
| `fix`      | 버그 수정                        | `fix(mobile): 날짜 표시 오류 수정`      |
| `docs`     | 문서 변경                        | `docs: API 문서 업데이트`               |
| `style`    | 코드 포맷팅 (로직 변경 없음)     | `style: 세미콜론 추가`                  |
| `refactor` | 리팩토링 (기능 변경 없음)        | `refactor(api): 쿼리 최적화`            |
| `perf`     | 성능 개선                        | `perf(api): 캐싱 적용`                  |
| `test`     | 테스트 추가/수정                 | `test(api): 인증 테스트 추가`           |
| `build`    | 빌드 시스템, 외부 종속성 변경    | `build: TypeScript 5.4 업그레이드`      |
| `ci`       | CI 설정 변경                     | `ci: GitHub Actions 워크플로우 추가`    |
| `chore`    | 기타 변경사항 (src, test 미영향) | `chore: .gitignore 업데이트`            |
| `revert`   | 이전 커밋 되돌리기               | `revert: feat(api): 할일 목록 API 구현` |

#### Scope (선택)

변경된 앱/패키지를 명시합니다:

- `api` - apps/api
- `mobile` - apps/mobile
- `utils` - packages/utils
- `validators` - packages/validators

```bash
feat(api): 새 엔드포인트 추가      # apps/api 변경
fix(mobile): UI 버그 수정          # apps/mobile 변경
chore(validators): 스키마 업데이트 # packages/validators 변경
docs: 전체 문서 정리               # scope 없이 전역 변경
```

#### 커밋 방법

```bash
# 방법 1: Commitizen 대화형 (권장)
pnpm commit

# 방법 2: 직접 작성
git commit -m "feat(api): 새로운 기능 추가"

# 방법 3: 본문 포함
git commit -m "fix(api): 인증 토큰 만료 처리

- 토큰 갱신 로직 추가
- 만료 시 자동 로그아웃

Closes #123"
```

#### Commitlint 검증

커밋 시 Husky + Commitlint가 자동으로 메시지를 검증합니다.

```bash
# ✅ 통과
git commit -m "feat: 로그인 기능 추가"
git commit -m "fix(api): 널 포인터 예외 수정"

# ❌ 실패 (잘못된 타입)
git commit -m "feature: 로그인 기능"  # 'feature' → 'feat' 사용

# ❌ 실패 (콜론 누락)
git commit -m "feat 로그인 기능"      # 'feat:' 형식 필요

# ❌ 실패 (타입 누락)
git commit -m "로그인 기능 추가"       # 타입 필수
```

#### Breaking Changes

하위 호환성이 깨지는 변경은 `!`를 추가하거나 footer에 명시합니다:

```bash
# 방법 1: 타입 뒤에 ! 추가
feat(api)!: 인증 API 응답 형식 변경

# 방법 2: footer에 명시
feat(api): 인증 API 응답 형식 변경

BREAKING CHANGE: 응답 JSON 구조가 변경되었습니다.
이전: { token: string }
이후: { accessToken: string, refreshToken: string }
```

#### 이슈 연결

커밋 footer에 이슈 번호를 연결할 수 있습니다:

```bash
fix(mobile): 로그인 버튼 미동작 수정

Closes #45
Refs #42, #43
```

| 키워드                        | 동작                      |
| ----------------------------- | ------------------------- |
| `Closes`, `Fixes`, `Resolves` | PR 머지 시 이슈 자동 종료 |
| `Refs`, `Related to`, `See`   | 이슈 참조 (종료하지 않음) |

### 코드 리뷰 가이드

- 로직 정확성 확인
- 테스트 코드 포함 여부
- 코드 스타일 일관성
- 성능/보안 이슈 검토

## CI/CD

PR 생성 시 자동 실행:

- Biome 린트/포맷 검사
- TypeScript 타입 체크
- 단위/통합 테스트
- 빌드 검증

## 문서

| 앱/패키지  | README                                                           |
| ---------- | ---------------------------------------------------------------- |
| API        | [apps/api/README.md](./apps/api/README.md)                       |
| Mobile     | [apps/mobile/README.md](./apps/mobile/README.md)                 |
| Utils      | [packages/utils/README.md](./packages/utils/README.md)           |
| Validators | [packages/validators/README.md](./packages/validators/README.md) |

## 라이선스

MIT License - [LICENSE](./LICENSE)
