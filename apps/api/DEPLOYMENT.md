# Aido API 배포 가이드

> **Version**: 1.1.0 · **Last Updated**: 2026-07-19 · **Owner**: Aido Platform Team

## 목차

- [Prerequisites](#prerequisites)
- [1. Local Development](#1-local-development)
- [2. Production Docker (로컬 테스트)](#2-production-docker-로컬-테스트)
- [3. 프로덕션 배포 (GitHub Actions → EC2)](#3-프로덕션-배포-github-actions--ec2)
- [4. 환경변수 레퍼런스](#4-환경변수-레퍼런스)
- [5. 트러블슈팅](#5-트러블슈팅)

## Prerequisites

- Docker 24+ / Docker Compose V2
- Node.js 22.x / pnpm 10.29+

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

# 헬스 체크 (API host port는 loopback-only)
curl http://127.0.0.1:8080/health

# 로그 확인
pnpm docker:prod:logs

# 종료
pnpm docker:prod:down
```

---

## 3. 프로덕션 배포 (GitHub Actions → EC2)

> 실제 운영 파이프라인. ECS/ECR을 사용하지 않는다 — EC2 한 대(t4g.small)에서 `docker compose`로 빌드·기동하며, DB(RDS)/Redis(ElastiCache)는 외부 관리형 서비스다.
> 공개 요청 경로는 **client → host-local Nginx → `127.0.0.1:${PORT}` Docker API**다.
> Compose가 API host port를 loopback에만 bind하고 Express는 이 Nginx 한 홉만 신뢰한다.

### 3.1 파이프라인 개요

```
push(main) ─→ CI (lint / test / build / docker*)   * arm64 러너에서 이미지 빌드 → GHCR push (:sha 태그)
                 │ 전 job 성공 시 (workflow_run)
                 ▼
        Deploy to EC2 (.github/workflows/deploy.yml)
                 ├─ CI가 검증한 커밋 SHA 해석·검증 (40자 hex + origin/main ancestor)
                 ├─ SSH 부트스트랩: flock 락 → git reset --hard $SHA
                 ├─ scripts/deploy.sh: 디스크 점검 → 롤백 태깅 → GHCR pull → 기동 → 헬스 게이트
                 └─ 러너에서 외부 검증: https://api.aido.kr/health
```

- 배포 대상은 **CI가 검증한 SHA로 고정**된다 (`workflow_run.head_sha`) — 배포 시점의 `origin/main` HEAD가 아니다.
- `workflow_run` 트리거 특성상 `deploy.yml`은 **기본 브랜치(develop)의 파일**이 실행된다. 배포 로직 본체는 배포 대상 SHA의 `scripts/deploy.sh`.
- 수동 배포/롤백: GitHub Actions → **Deploy to EC2 → Run workflow**. `sha` 비우면 main의 최신 CI 성공 커밋, 이전 커밋으로 되돌릴 땐 `sha` 입력 + `force` 체크.

### 3.2 배포 단계 (`scripts/deploy.sh`)

서버 레이아웃: 레포 `~/apps/Aido-platform` · 배포 상태 `~/apps/deploy-state/{deploy.lock, last_deployed_sha, history.log}`

| 단계        | 동작                                                                                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 락          | `flock` — 동시 배포 차단 (GH concurrency + 서버 락 이중 방어)                                                                                                                                                               |
| SHA 검증    | 작업트리 == `DEPLOY_SHA`, 마지막 배포 커밋의 후손인지 확인 (역행 배포 차단, `FORCE_DEPLOY=1`로 우회)                                                                                                                        |
| 디스크 점검 | §3.3 참조 — 부족하면 빌드 시작 전 중단                                                                                                                                                                                      |
| 롤백 태깅   | 현재 `latest` → `:rollback` (자동 롤백 지점, 첫 실행 시 자동 시드)                                                                                                                                                          |
| 이미지 준비 | 기본: CI(arm64 러너)가 빌드해 GHCR에 올린 `:{sha}` 이미지 pull → 로컬 이름 retag — **서버 빌드 부하 0**. pull 실패 시 컨테이너 무접촉 중단. 폴백: `--build` 또는 `GHCR_TOKEN` 부재 시 서버 로컬 빌드 (`compose build` 순차) |
| 기동        | `compose up -d` — migrate 완료 대기 후 api 재생성                                                                                                                                                                           |
| 헬스 게이트 | 90초 내 Docker HEALTHCHECK `healthy` **AND** `/health` 연속 3회 성공, 실패 시 자동 롤백                                                                                                                                     |
| 정리        | dangling 이미지 + 캐시 6GB 초과분만 (**`-a` prune 금지** — 롤백 이미지가 삭제됨)                                                                                                                                            |

댓글 cursor 형식을 바꾸는 배포는 서로 다른 API 버전을 동시에 서비스하지 않는다. 현재 단일 API
컨테이너 교체 방식은 이 조건을 만족한다. 해당 배포를 이전 이미지로 롤백하면 이미 발급된 새 형식 cursor는
`SYS_0002`로 거부되며, 클라이언트는 첫 페이지부터 다시 조회한다.

댓글 알림 경로·개인정보 전환 migration은 `NOT VALID` 제약을 먼저 공개해 구 API가 깨진 URL이나
senderId 없는 댓글 알림을 새로 쓰지 못하게 한 뒤 기존 행을 보정한다. COMMENT·REPLY는 댓글 작성자로
senderId를 복구하고, 보낸 사람을 안전하게 알 수 없는 기존 LIKE와 orphan 알림은 제거한다. migration과 API 교체
사이에는 구 API의 해당 알림 저장이 거부될 수
있어 댓글 활동 알림이 일부 생략될 수 있지만, 댓글 쓰기 transaction과 다른 알림은 유지된다. 무손실 전환이
필요하면 URL 없는 알림 writer를 먼저 배포하고 다음 릴리스에서 제약과 backfill을 적용하는 2단계 배포를 쓴다.

계정 purge는 삭제된 댓글을 NULL 작성자로 만들지 않는다. migration이 개인정보와 로그인 수단이 없는
LOCKED 시스템 작성자를 만들고, cleanup이 묘비 댓글을 그 작성자로 옮긴 뒤 원 계정을 삭제한다.
`TodoComment.authorId`와 relation은 계속 NOT NULL이므로 migration 뒤 직전 API 이미지로 롤백해도
기존 required relation 조회가 안전하다. 시스템 작성자는 deletedAt·인증 Account 없이 LOCKED 상태를
유지해 purge·복구·검색·추천·가입 통계 대상에서 제외되고, 화면에서는 댓글의 deletedAt이 작성자와 본문을 숨긴다.
계정 purge가 알림 전체를 반복 스캔하지 않도록 friendId와 metadata.senderId cleanup index는 각각 별도
`CREATE INDEX CONCURRENTLY` migration으로 배포한다. 두 migration은 재시도와 쓰기 잠금 범위를 분리하려고
파일당 statement 하나만 둔다. 알림 90일 보관 정책의 주기 실행은 계정 purge와 별도 운영 과제로 관리한다.

### 3.3 디스크·캐시 관리

모든 성장 벡터에 상한을 걸어 "디스크 꽉 참" 자체를 방지한다:

| 성장 벡터          | 상한 장치                                                                     |
| ------------------ | ----------------------------------------------------------------------------- |
| BuildKit 빌드 캐시 | 매 배포 성공 후 6GB 초과분 LRU 정리 (`docker builder prune --max-used-space`) |
| Docker 이미지      | `latest` + `rollback` 2세대만 유지, dangling 매회 정리                        |
| 컨테이너 로그      | json-file 20m × 5 로테이션 (compose 설정)                                     |
| DB 백업            | 로컬 7일 보존 + S3 업로드 (서버 cron)                                         |

- 용량 예산: 29GB 디스크 기준 정상 상태 ≈ 15GB (기본 ~8 + 캐시 ≤6 + 빌드 중 임시 1세대).
- 빌드 전 사전 점검: 여유 <3GB → 캐시 전체 정리 → 재확인 → **그래도 부족하면 빌드를 시작하지 않고 중단** (서비스 무영향).
- 점검 명령: `df -h /`, `docker system df` (매 배포의 GH Actions 로그에도 `df` 출력됨).
- **GHCR 보존 정책**: CI docker job이 각 패키지(`aido-platform-api`/`-migrate`) 버전을 최신 10개만 유지 (`actions/delete-package-versions`). 서버의 BuildKit 캐시는 로컬 빌드 폴백 경로에서만 사용됨.
- **자격 증명**: GHCR push/pull 모두 워크플로우별 임시 `GITHUB_TOKEN` 사용 — 서버·레포에 장수명 레지스트리 자격 증명 없음 (서버는 stdin 로그인 후 즉시 logout).

### 3.4 장애 대응 런북

| 시나리오                | 자동 동작                                            | 서비스 영향          | 운영자 조치                                      |
| ----------------------- | ---------------------------------------------------- | -------------------- | ------------------------------------------------ |
| 디스크 <3GB (빌드 전)   | 전체 정리 → 재확인 → 부족 시 빌드 미시작 중단        | 없음                 | `df -h`/`docker system df`로 원인 확인 후 재배포 |
| 빌드 실패 (ENOSPC 포함) | `latest` 태그 불변 → 서비스 유지, run 실패(red)      | 없음                 | 원인 수정 후 재배포                              |
| migrate 실패            | 구 api 유지된 채 compose 비정상 종료 → 롤백 경로     | 없음                 | 마이그레이션 수정 후 재배포                      |
| 헬스 게이트 실패        | `:rollback` → `latest` retag + `up -d --no-deps api` | 수십 초 내 자동 복구 | 원인 수정 후 재배포                              |
| 롤백마저 실패           | FATAL 로그 + exit 2                                  | 장애                 | 아래 수동 복구                                   |
| 동시 배포               | flock으로 후발 즉시 중단                             | 없음                 | 선행 완료 후 재시도                              |
| 구 SHA 배포 시도        | ancestor 검사로 중단                                 | 없음                 | 의도적 롤백이면 `force` 체크                     |

```bash
# 수동 재배포 (GitHub UI): Actions → Deploy to EC2 → Run workflow (sha 비움)
# 특정 SHA 배포: sha 입력 / 이전 커밋 롤백: sha + force 체크

# 서버에서 직접 (SSH):
cd ~/apps/Aido-platform
bash scripts/deploy.sh --rollback                        # 이전 이미지로 즉시 롤백
DEPLOY_SHA=$(git rev-parse HEAD) bash scripts/deploy.sh  # 현재 커밋 재배포

# 롤백마저 실패했을 때 수동 복구:
docker images | grep rollback                            # 롤백 이미지 존재 확인
docker tag aido-platform-api:rollback aido-platform-api:latest
docker compose -f docker-compose.prod.yml up -d --no-deps api
docker logs --tail 100 aido-prod-api                     # 원인 확인
```

### 3.5 DB 마이그레이션 규율

- 마이그레이션은 **forward-only** — 자동 롤백은 API 컨테이너만 되돌리고 DB는 이미 신 스키마다.
- 따라서 모든 마이그레이션은 **직전 릴리스의 API와 호환**되어야 한다 (expand → contract: 먼저 추가만 하는 릴리스, 구 컬럼 제거는 다음 릴리스에서).
- 기존 운영 테이블의 인덱스는 PostgreSQL `CREATE INDEX CONCURRENTLY`로 생성하고 해당 migration에 `BEGIN`/`COMMIT`을 넣지 않는다. 실제 DB lock 회귀 테스트로 기존 쓰기가 계속 완료되는지 검증한다.
- concurrent build 실패 시 invalid index가 남을 수 있다. 재시도 전에 `pg_index.indisvalid`와 migrate 로그를 확인하고, 운영 절차에 따라 invalid index 정리 및 migration 상태 복구 후 다시 배포한다.

### 3.6 보안 수칙

- `.env.docker.prod`는 **서버 전용** (레포 미포함, `.gitignore` 제외 유지). 시크릿 로테이션 = 서버에서 파일 수정 후 재배포.
- 배포 디렉터리(`~/apps/Aido-platform`)에서 **`git clean` 금지** — untracked인 `.env.docker.prod`가 삭제된다. (`git reset --hard`는 untracked를 건드리지 않아 안전.)
- GH Secrets: `EC2_HOST` / `EC2_USER` / `EC2_SSH_PRIVATE_KEY` (배포 SSH), `TURBO_TOKEN` (Turbo 원격 캐시). 시크릿은 이미지 빌드에 유입되지 않는다 (`env_file`은 런타임 주입만, build args 없음).

### 3.7 `develop` → `main` 릴리스 브랜치 정합

기능 PR과 릴리스 PR의 merge 방식을 구분한다.

| PR 방향             | merge 방식                     | 이유                                                                     |
| ------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| feature → `develop` | Squash merge 허용              | 기능 단위로 이력을 정리한다.                                             |
| `develop` → `main`  | **Create a merge commit 필수** | 두 브랜치의 공통 조상을 유지해 다음 릴리스 PR의 중복 diff·충돌을 막는다. |

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

| 변수                           | 필수  | 기본값        | 설명                                                                                                                                  |
| ------------------------------ | ----- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                     | -     | development   | 런타임 모드 (빌드 최적화 기준)                                                                                                        |
| `APP_ENV`                      | -     | NODE_ENV 폴백 | 배포 환경 (`development`/`staging`/`production`). **Sentry는 `production`에서만 발송** — 개발서버는 반드시 `APP_ENV=development` 설정 |
| `PORT`                         | -     | 8080          | API 포트                                                                                                                              |
| `DATABASE_URL`                 | Y     | -             | PostgreSQL 연결 URL                                                                                                                   |
| `JWT_SECRET`                   | Y     | -             | JWT 서명 키 (min 32자)                                                                                                                |
| `JWT_REFRESH_SECRET`           | Y     | -             | Refresh 토큰 키 (min 32자)                                                                                                            |
| `JWT_EXPIRES_IN`               | -     | 15m           | Access 토큰 만료                                                                                                                      |
| `JWT_REFRESH_EXPIRES_IN`       | -     | 7d            | Refresh 토큰 만료                                                                                                                     |
| `TOKEN_ENCRYPTION_KEY`         | Y     | -             | AES-256-GCM 키 (min 32자)                                                                                                             |
| `CORS_ORIGINS`                 | -     | localhost     | 허용 오리진 (쉼표 구분)                                                                                                               |
| `THROTTLE_TTL`                 | -     | 60000         | Rate limit 윈도우 (ms)                                                                                                                |
| `THROTTLE_LIMIT`               | -     | 100           | Rate limit 횟수                                                                                                                       |
| `GOOGLE_CLIENT_ID`             | Prod* | -             | Google OAuth                                                                                                                          |
| `GOOGLE_CLIENT_SECRET`         | Prod* | -             | Google OAuth                                                                                                                          |
| `KAKAO_CLIENT_ID`              | Prod* | -             | Kakao OAuth                                                                                                                           |
| `NAVER_CLIENT_ID`              | Prod* | -             | Naver OAuth                                                                                                                           |
| `RESEND_API_KEY`               | Prod  | -             | Resend 이메일 API 키                                                                                                                  |
| `EXPO_ACCESS_TOKEN`            | -     | -             | 푸시 알림                                                                                                                             |
| `GOOGLE_GENERATIVE_AI_API_KEY` | -     | -             | AI 기능                                                                                                                               |
| `DISCORD_SIGNUP_WEBHOOK_URL`   | -     | -             | 가입 알림 웹훅                                                                                                                        |

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
docker images aido-platform-api
```

Production 이미지는 `node:22-alpine` + production deps만 포함하여 경량화됩니다.
