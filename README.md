# Aido

AI 기반 할 일 관리 애플리케이션. Turborepo + pnpm 모노레포.

## 기술 스택

| 분류 | 기술 |
|------|------|
| Monorepo | Turborepo 2.7, pnpm 9.15 |
| Backend | NestJS 11, Prisma 7, PostgreSQL 16 |
| Mobile | Expo 54, React Native 0.81, React 19.1 |
| Validation | Zod 4.3, nestjs-zod |
| Testing | Jest 29, Vitest, Testcontainers |
| Code Quality | Biome 2.3 |

## 구조

```
aido/
├── apps/
│   ├── api/          # NestJS 백엔드
│   └── mobile/       # Expo 모바일 앱
├── packages/
│   ├── validators/   # Zod 스키마 (@aido/validators)
│   ├── utils/        # 유틸리티 (@aido/utils)
│   └── errors/       # 에러 정의 (@aido/errors)
├── tooling/
│   ├── typescript/   # TypeScript 프리셋
│   ├── jest/         # Jest 프리셋
│   ├── vitest/       # Vitest 프리셋
│   └── biome/        # Biome 프리셋
└── turbo.json
```

## 시작하기

```bash
# 설치
pnpm install

# DB 실행 (Docker)
pnpm docker:up

# 마이그레이션
pnpm db:migrate

# 개발 서버
pnpm dev
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 전체 개발 서버 |
| `pnpm build` | 전체 빌드 |
| `pnpm test` | 단위 테스트 |
| `pnpm test:e2e` | E2E 테스트 |
| `pnpm check` | Biome 검사 |
| `pnpm format` | 코드 포맷팅 |
| `pnpm typecheck` | 타입 검사 |
| `pnpm commit` | Conventional Commit |

## 패키지

| 패키지 | 설명 |
|--------|------|
| [@aido/api](./apps/api) | NestJS 백엔드 API |
| [@aido/mobile](./apps/mobile) | Expo 모바일 앱 |
| [@aido/validators](./packages/validators) | Zod 스키마 |
| [@aido/utils](./packages/utils) | 유틸리티 함수 |
| [@aido/errors](./packages/errors) | 에러 정의 |

## 개발 가이드

- **커밋**: Conventional Commits (`pnpm commit`)
- **린트/포맷**: Biome
- **타입**: TypeScript strict 모드
- **DTO**: Zod 스키마 (@aido/validators)

## API 문서

```
http://localhost:8080/api/docs
```

## 라이선스

MIT
