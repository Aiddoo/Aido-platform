# Aido API 배포 가이드

> **Version**: 1.0.0 · **Last Updated**: 2026-04-23 · **Owner**: Aido Platform Team

## 목차

- [Prerequisites](#prerequisites)
- [1. Local Development](#1-local-development)
- [2. Production Docker (로컬 테스트)](#2-production-docker-로컬-테스트)
- [3. AWS ECS + ECR 배포](#3-aws-ecs--ecr-배포)
- [4. 환경변수 레퍼런스](#4-환경변수-레퍼런스)
- [5. 트러블슈팅](#5-트러블슈팅)

## Prerequisites

- Docker 24+ / Docker Compose V2
- Node.js 20+ / pnpm 10.29+
- AWS CLI v2 (AWS 배포 시)

---

## 1. Local Development

### DB-only 모드 (권장)

PostgreSQL만 Docker로 실행하고, API는 네이티브로 실행합니다.

```bash
# DB 시작
pnpm docker:up

# API 개발 서버
pnpm dev
```

### Full Docker 모드

API + DB 모두 Docker로 실행합니다.

```bash
# 환경변수 설정
cp .env.docker.dev.example .env.docker.dev

# 빌드 & 실행
pnpm docker:dev:build
pnpm docker:dev:up

# 로그 확인
pnpm docker:dev:logs

# DB 마이그레이션
pnpm docker:dev:migrate

# 종료
pnpm docker:dev:down
```

> dev 모드는 소스 volume mount로 hot reload를 지원합니다.

---

## 2. Production Docker (로컬 테스트)

로컬에서 프로덕션 이미지를 테스트합니다.

```bash
# 환경변수 설정 (모든 CHANGE_ME 값을 실제 값으로 교체)
cp .env.docker.prod.example .env.docker.prod
# .env.docker.prod 편집...

# 빌드 & 실행 (migrate → api 순서 자동)
pnpm docker:prod:build
pnpm docker:prod:up

# 헬스 체크
curl http://localhost:8080/health

# 로그 확인
pnpm docker:prod:logs

# 종료
pnpm docker:prod:down
```

---

## 3. AWS ECS + ECR 배포

### 3.1 ECR 리포지토리 생성

```bash
aws ecr create-repository --repository-name aido/api --image-scanning-configuration scanOnPush=true
aws ecr create-repository --repository-name aido/migrate --image-scanning-configuration scanOnPush=true
```

### 3.2 이미지 빌드 & Push

```bash
# ECR 로그인
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=ap-northeast-2
ECR_URL=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URL

# Production 이미지 빌드
docker build --target production -t aido/api:latest -f apps/api/Dockerfile .
docker build --target migrate -t aido/migrate:latest -f apps/api/Dockerfile .

# 태그 & Push
docker tag aido/api:latest $ECR_URL/aido/api:latest
docker tag aido/migrate:latest $ECR_URL/aido/migrate:latest

docker push $ECR_URL/aido/api:latest
docker push $ECR_URL/aido/migrate:latest
```

### 3.3 ECS Task Definition

**API 서비스** (long-running):
- Image: `aido/api:latest`
- CPU: 256 / Memory: 512
- Port mapping: 8080
- Health check: `/health`

**Migration 태스크** (one-shot):
- Image: `aido/migrate:latest`
- CPU: 256 / Memory: 512
- 배포 전 `aws ecs run-task`로 실행

### 3.4 RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier aido-db \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username postgres \
  --master-user-password <password> \
  --allocated-storage 20
```

### 3.5 Secrets Manager

```bash
aws secretsmanager create-secret \
  --name aido/api/env \
  --secret-string '{
    "JWT_SECRET": "...",
    "JWT_REFRESH_SECRET": "...",
    "TOKEN_ENCRYPTION_KEY": "...",
    "DATABASE_URL": "postgresql://..."
  }'
```

ECS Task Definition에서 `secrets` 필드로 참조합니다.

### 3.6 CI/CD 파이프라인

```
Build → Push to ECR → Run Migration Task → Deploy API Service
```

1. 코드 Push 또는 PR 머지 트리거
2. Docker 이미지 빌드 (production + migrate)
3. ECR에 Push
4. Migration 태스크 실행 및 완료 대기
5. ECS 서비스 업데이트 (롤링 배포)

### 3.7 `develop` → `main` 릴리스 브랜치 정합

기능 PR과 릴리스 PR의 merge 방식을 구분한다.

| PR 방향 | merge 방식 | 이유 |
|----------|------------|------|
| feature → `develop` | Squash merge 허용 | 기능 단위로 이력을 정리한다. |
| `develop` → `main` | **Create a merge commit 필수** | 두 브랜치의 공통 조상을 유지해 다음 릴리스 PR의 중복 diff·충돌을 막는다. |

`develop` → `main` 릴리스 PR은 squash merge 또는 rebase merge하지 않는다. GitHub CLI를 사용할 때도 `--merge`를 명시한다.

```bash
gh pr merge <PR_NUMBER> --merge
```

병합 직후에는 `main`의 merge commit을 `develop`에 fast-forward하고 원격 두 브랜치가 같은 커밋을 가리키는지 확인한다. 이 단계까지가 릴리스 머지의 완료 조건이다.

```bash
git fetch origin main develop
git switch develop
git merge --ff-only origin/main
git push origin develop
git fetch origin main develop
git rev-parse origin/main
git rev-parse origin/develop
```

마지막 두 커밋 해시는 반드시 같아야 한다. `--ff-only`가 실패하면 그 사이 `develop`에 새 변경이 들어온 것이므로 강제 푸시하지 않고 일반 merge로 양쪽 변경을 보존한다.

릴리스 PR을 열기 전에는 원격 브랜치를 갱신하고 실제 순 변경을 확인한다.

```bash
git fetch origin main develop
git diff --stat origin/main..origin/develop
```

과거 릴리스가 이미 squash merge되어 같은 변경이 다시 보이면 먼저 브랜치 이력을 정합화한다. 이때 `ours` 전략은 **main의 릴리스 tree와 해당 시점 develop tree가 완전히 동일함을 확인한 경우에만** develop 내용을 보존하는 일회성 복구에 사용한다. tree가 다르면 일반 merge로 충돌을 파일별 검토하며 해결해야 한다.

```bash
git rev-parse origin/main^{tree}
git rev-parse <RELEASE_SOURCE_DEVELOP_COMMIT>^{tree}

# 위 두 tree가 동일할 때만 사용
git switch develop
git merge -s ours origin/main -m "chore: main 릴리스 이력을 develop에 동기화"
git push origin develop
```

정합화 후 GitHub의 `develop` → `main` PR 파일 목록에 이미 배포된 변경이 다시 나타나지 않고, merge 상태가 `MERGEABLE`인지 확인한다.

---

## 4. 환경변수 레퍼런스

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `NODE_ENV` | - | development | 런타임 모드 (빌드 최적화 기준) |
| `APP_ENV` | - | NODE_ENV 폴백 | 배포 환경 (`development`/`staging`/`production`). **Sentry는 `production`에서만 발송** — 개발서버는 반드시 `APP_ENV=development` 설정 |
| `PORT` | - | 8080 | API 포트 |
| `DATABASE_URL` | Y | - | PostgreSQL 연결 URL |
| `JWT_SECRET` | Y | - | JWT 서명 키 (min 32자) |
| `JWT_REFRESH_SECRET` | Y | - | Refresh 토큰 키 (min 32자) |
| `JWT_EXPIRES_IN` | - | 15m | Access 토큰 만료 |
| `JWT_REFRESH_EXPIRES_IN` | - | 7d | Refresh 토큰 만료 |
| `TOKEN_ENCRYPTION_KEY` | Y | - | AES-256-GCM 키 (min 32자) |
| `CORS_ORIGINS` | - | localhost | 허용 오리진 (쉼표 구분) |
| `THROTTLE_TTL` | - | 60000 | Rate limit 윈도우 (ms) |
| `THROTTLE_LIMIT` | - | 100 | Rate limit 횟수 |
| `GOOGLE_CLIENT_ID` | Prod* | - | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Prod* | - | Google OAuth |
| `KAKAO_CLIENT_ID` | Prod* | - | Kakao OAuth |
| `NAVER_CLIENT_ID` | Prod* | - | Naver OAuth |
| `RESEND_API_KEY` | Prod | - | Resend 이메일 API 키 |
| `EXPO_ACCESS_TOKEN` | - | - | 푸시 알림 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | - | - | AI 기능 |
| `DISCORD_SIGNUP_WEBHOOK_URL` | - | - | 가입 알림 웹훅 |

> *Prod: 프로덕션에서 OAuth 최소 1개 필수

---

## 5. 트러블슈팅

### pnpm install 실패 (lockfile mismatch)

```bash
# 로컬에서 lockfile 업데이트 후 재빌드
pnpm install
pnpm docker:dev:build --no-cache
```

### Migration 실패

```bash
# 로그 확인
pnpm docker:prod:logs

# 수동 마이그레이션
pnpm docker:prod:migrate
```

### Health check 실패

```bash
# 컨테이너 내부에서 확인
docker exec aido-prod-api wget -qO- http://localhost:8080/health
```

### 이미지 크기 최적화

```bash
# 이미지 크기 확인
docker images aido/api
```

Production 이미지는 `node:22-alpine` + production deps만 포함하여 경량화됩니다.
