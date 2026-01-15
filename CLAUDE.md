# Aido

Turborepo + pnpm 모노레포

## 기술 스택

- **API**: NestJS 11 + Prisma 7 + PostgreSQL
- **Mobile**: Expo SDK 54 + React Native 0.81 + React 19.1
- **공통**: TypeScript 5.9, Zod 4.3

## 구조

```
apps/api            - NestJS 백엔드
apps/mobile         - Expo 모바일 앱
packages/validators - Zod 스키마 (@aido/validators)
packages/utils      - 공유 유틸리티
tooling/*           - 공유 설정 (biome, jest, typescript)
```

## 빠른 시작

```bash
pnpm install
pnpm docker:up    # PostgreSQL 컨테이너
pnpm dev          # 전체 개발 서버
```

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 전체 개발 서버 |
| `pnpm build` | 전체 빌드 |
| `pnpm test` | 단위 테스트 |
| `pnpm test:e2e` | E2E 테스트 |
| `pnpm lint` | Biome 린트 |
| `pnpm typecheck` | 타입 체크 |
| `pnpm commit` | Conventional Commit |

## AI 가이드 위치

- **API**: `apps/api/.claude/` (아키텍처, 테스트 가이드)
- **Mobile**: `apps/mobile/.claude/` (컴포넌트, 테스트 가이드)

## 규칙

- **린트/포맷**: Biome 2.2
- **커밋**: Conventional Commits (`pnpm commit`)
- **타입**: TypeScript strict 모드
- **DTO**: Zod 스키마 (@aido/validators)
