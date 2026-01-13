# Aido

> AI-powered Todo List Application

[![Node.js](https://img.shields.io/badge/Node.js-≥20.0.0-339933?logo=node.js)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.15.4-F69220?logo=pnpm)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.5.3-EF4444?logo=turborepo)](https://turbo.build/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Version: 0.1.0** | Last Updated: 2025-01-13

---

## Overview

Aido는 AI 기반 할 일 관리 애플리케이션입니다. 모노레포 구조로 백엔드 API와 모바일 앱을 통합 관리합니다.

## Tech Stack

| Category | Technology |
|----------|------------|
| **Monorepo** | Turborepo + pnpm Workspaces |
| **Backend** | NestJS 11, Prisma 7, PostgreSQL |
| **Mobile** | Expo 54, React Native 0.81 |
| **Validation** | Zod + nestjs-zod |
| **Testing** | Jest, Vitest, Testcontainers |
| **Code Quality** | Biome (lint + format) |
| **CI/CD** | GitHub Actions, Docker |

## Project Structure

```
aido/
├── apps/
│   ├── api/                 # NestJS 백엔드 API
│   └── mobile/              # Expo 모바일 앱
├── packages/
│   ├── validators/          # Zod 스키마 (공유)
│   └── utils/               # 유틸리티 함수 (공유)
├── tooling/
│   ├── typescript/          # TypeScript 프리셋
│   ├── jest/                # Jest 프리셋
│   ├── vitest/              # Vitest 프리셋
│   └── biome/               # Biome 프리셋
├── turbo.json               # Turborepo 설정
├── pnpm-workspace.yaml      # 워크스페이스 설정
└── package.json             # 루트 패키지
```

## Prerequisites

- **Node.js** ≥ 20.0.0
- **pnpm** 9.15.4
- **Docker** (PostgreSQL용)

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/your-org/aido.git
cd aido
pnpm install
```

### 2. Environment Setup

```bash
# API 환경변수 설정
cp apps/api/.env.example apps/api/.env
```

### 3. Database Setup

```bash
# PostgreSQL 컨테이너 실행
pnpm docker:up

# Prisma 마이그레이션
pnpm db:migrate
```

### 4. Development

```bash
# 전체 앱 개발 서버 실행
pnpm dev

# 개별 앱 실행
pnpm --filter @aido/api dev      # API만
pnpm --filter @aido/mobile dev   # Mobile만
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | 모든 앱 개발 서버 실행 |
| `pnpm build` | 모든 패키지 빌드 |
| `pnpm test` | 테스트 실행 |
| `pnpm check` | Biome 린트/포맷 검사 |
| `pnpm format` | 코드 포맷팅 |
| `pnpm typecheck` | TypeScript 타입 검사 |
| `pnpm db:migrate` | Prisma 마이그레이션 |
| `pnpm db:generate` | Prisma Client 생성 |
| `pnpm docker:up` | Docker 컨테이너 실행 |
| `pnpm docker:down` | Docker 컨테이너 중지 |

## Apps & Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@aido/api](./apps/api) | 0.0.1 | NestJS 백엔드 API |
| [@aido/mobile](./apps/mobile) | 1.0.0 | Expo 모바일 앱 |
| [@aido/validators](./packages/validators) | 0.0.0 | Zod 스키마 패키지 |
| [@aido/utils](./packages/utils) | 0.0.0 | 유틸리티 함수 |

## Development Guidelines

### Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/) 규칙을 따릅니다.

```bash
# Commitizen 사용
pnpm commit
```

| Type | Description |
|------|-------------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `style` | 코드 스타일 (포맷팅) |
| `refactor` | 리팩토링 |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 설정 변경 |

### Code Quality

- **Biome**: 린팅 + 포맷팅 통합
- **TypeScript**: Strict 모드 활성화
- **Git Hooks**: pre-commit (lint-staged), commit-msg (commitlint)

## Architecture

### Backend (NestJS)

```
apps/api/src/
├── common/          # 공통 모듈 (필터, 가드, 인터셉터)
├── config/          # 환경변수 검증
├── database/        # Prisma 설정
└── modules/         # 도메인 모듈
    ├── health/      # 헬스체크
    └── todo/        # Todo CRUD
```

- **3-Layer Architecture**: Controller → Service → Repository
- **DTO Validation**: Zod + nestjs-zod
- **Logging**: Pino (구조화된 로깅)
- **Security**: Helmet, Rate Limiting, CORS

### Mobile (Expo)

```
apps/mobile/
├── app/             # Expo Router 페이지
├── components/      # 재사용 컴포넌트
├── hooks/           # 커스텀 훅
└── lib/             # 유틸리티
```

## API Documentation

개발 환경에서 Swagger UI를 통해 API 문서를 확인할 수 있습니다.

```
http://localhost:8080/api/docs
```

## Testing

```bash
# 전체 테스트
pnpm test

# 커버리지 포함
pnpm test:cov

# E2E 테스트
pnpm test:e2e

# API 통합 테스트 (Testcontainers)
pnpm --filter @aido/api test:integration
```

## Deployment

### Docker

```bash
# 이미지 빌드
pnpm docker:build

# 컨테이너 실행
pnpm docker:up
```

### CI/CD

GitHub Actions를 통해 자동화된 파이프라인이 실행됩니다:

1. **Lint & Format** (Biome)
2. **Type Check** (TypeScript)
3. **Test** (Jest + Testcontainers)
4. **Build** (Turborepo)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Changelog

### v0.1.0 (2025-01-13)
- Initial monorepo setup
- NestJS API with Prisma 7
- Expo mobile app setup
- Shared validators package
- CI/CD pipeline with GitHub Actions
