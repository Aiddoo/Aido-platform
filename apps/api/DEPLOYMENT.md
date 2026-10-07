# 서버 배포와 롤백

배포를 준비하거나 장애로 이전 이미지를 복구할 때 참고한다. 정본은 [deploy workflow](../../.github/workflows/deploy.yml), [배포 스크립트](../../scripts/deploy.sh), [production compose](../../docker-compose.prod.yml), [Dockerfile](./Dockerfile)이다. 문서의 절차와 로컬 검증은 실제 운영 적용 완료의 증거가 아니다.

## 로컬 실행

`.nvmrc`의 Node.js와 루트 `packageManager`의 pnpm과 Docker Compose V2를 사용한다. DB·Redis만 띄우는 `pnpm docker:up`과 API까지 띄우는 `pnpm docker:dev:up`은 별도 구성이다. 전자는 `docker-compose.yml`의 DB5432, 후자는 `docker-compose.dev.yml`의 기본 host DB5433을 사용하므로 연결을 혼동하지 않는다.

```sh
cp .env.docker.dev.example .env.docker.dev
pnpm docker:dev:build
pnpm docker:dev:up
pnpm docker:dev:logs
```

개발 compose는 DB health→migrate 완료→API 순서이고 source volume으로 재시작을 지원한다. 운영 이미지를 로컬에서 시험하려면 `.env.docker.prod.example`을 별도 환경에 맞춰 준비한 뒤 `docker:prod:build`/`docker:prod:up`을 사용한다. production compose는 원격 migration 허용을 명시하므로 실제 운영 연결을 로컬 시험에 재사용하지 않는다.

## 동일 SHA의 배포 흐름

main의 API 영향 변경에서 CI 검증이 성공하면 ARM64 API와 migrate 이미지를 같은 40자리 SHA 태그로 GHCR에 발행한다. deploy workflow는 이미지 발행 job 성공 여부와 두 태그를 확인한 뒤 해당 SHA를 선택한다. 배포 시점의 main HEAD를 임의로 대신 쓰지 않는다. API 영향이 없어 image job을 건너뛴 run은 자동 배포하지 않는다.

```text
CI 검증 → 같은 SHA의 API/migrate 이미지 → Deploy to EC2
  → 배포 락·SHA 확인 → migration/verify → API 교체 → health 확인
```

서버 repository는 `~/apps/Aido-platform`, 배포 상태는 `~/apps/deploy-state`다. workflow와 서버 `flock`이 동시 배포를 막는다. script는 작업 tree SHA·기존 배포 ancestry·최소 3GB 디스크 여유를 확인하고 현재 이미지를 rollback 태그로 보존한다. 기본은 GHCR pull이며 `--build` 또는 토큰 부재에서는 서버에서 migrate/API를 순차 빌드한다.

production compose는 host API 포트를 `127.0.0.1:${PORT:-8080}`에만 bind한다. 공개 경로는 host Nginx→loopback API 한 홉이며 서버는 이 proxy 경계를 따른다. API container 내부 포트 8080, memory 512M/CPU 1, Node heap 384MiB는 현재 구성값이다.

migrate 서비스 성공 뒤 API를 교체한다. script의 90초 health gate는 Docker healthy와 `/health` 연속 3회 성공을 함께 요구하고, workflow는 공개 `/health`도 확인한다. 실패하면 이전 API image로 복구한다. 성공 뒤 dangling 이미지와 BuildKit cache 6GB 초과분만 정리하며 `prune -a`로 rollback image를 제거하지 않는다.

## DB 전환: API보다 먼저 적용

Prisma ORM rc.14/CLI rc.20은 RC이며 production API와 migration 이미지를 분리한다. API에는 runtime·generated contract, migrate 이미지에는 CLI·contract source·graph·DB guard가 있다. 정확한 생성·CAS 규칙은 [.claude/prisma.md](./.claude/prisma.md)를 참고한다.

`migrate.sh`는 API/pg-boss URL을 먼저 검증하고 pg-boss migration, application graph와 실제 `db verify`를 수행한다. 기본 remote guard는 의도한 deployment의 `AIDO_ALLOW_REMOTE_DB=1`로만 허용한다. pg-boss 별도 URL도 같은 guard 대상이며 DDL lock_timeout은 5초다.

| DB 상태             | 처리                                                           |
| ------------------- | -------------------------------------------------------------- |
| 빈 DB               | baseline→후속 graph→schema/marker verify                       |
| marker 없는 기존 DB | 시스템 댓글 작성자 불변식·baseline schema 검증 뒤 기존 DB 등록 |
| 기존 marker         | 재서명 없이 현재 위치부터 graph 적용                           |
| 이미 target marker  | no-op migrate 전후에도 실제 schema verify; drift면 중단        |

baseline 등록은 `db sign --contract <baseline> --no-advance-ref`이며 기존 migration 이력과 업무 데이터를 지우지 않는다. 운영 DB가 baseline과 일치하는지는 실제 환경에서 확인해야 한다. 로컬 migration 성공을 운영 adoption 성공으로 대신하지 않는다.

Notification14의 `20261007T1840_push_receipt_token_fingerprint`는 nullable `PushDeliveryAttempt.tokenFingerprint VARCHAR(64)` additive 1개다. target contract는 `5eefdf63886315410d0378bf753a05f415396e235f83795390bd693cec24dd95`이며 신규 API가 해당 열에 쓰므로 DDL·verify 성공 후 API를 띄운다. 기존 행은 null로 남고 receipt 상태만 반영하며 이전 token을 추측해 비활성화하지 않는다. 새 값은 실제 발송 token의 SHA256이며 token 원문 snapshot/backfill을 저장하지 않는다.

댓글 system-author invariant, 기존 unique index를 constraint로 채택하는 graph, subscription-event receipt graph도 해당 migration 경로에 포함된다. schema marker의 강제 변경이나 이미 적용된 graph 수정으로 실패를 우회하지 않는다.

## Job 전환과 잔존 작업

기본 `JOB_BACKEND=postgres`와 `PUSH_RATE_LIMIT_BACKEND=postgres`는 별도 선택이다. Redis/BullMQ는 선택 backend·기존 작업 drain을 위해 남아 있다. `JOB_REDIS_DRAIN_ENABLED=true`의 전환 runtime은 신규 enqueue를 PostgreSQL로 보내고 기존 Redis 작업을 처리하며 이전 scheduler를 정리한다.

job runtime의 기본 graceful 종료 대기는 `JOB_SHUTDOWN_TIMEOUT_MS=90000`이다. production compose에는 별도 `stop_grace_period`가 없어 컨테이너 종료 유예가 이 대기보다 충분하다고 보장하지 않는다. 배포 시 종료 유예와 active 작업의 drain 결과를 별도로 확인한다.

기존 waiting/delayed/active/retry 작업의 payload·job name·queue alias·재시도 의미는 drain이 확인되기 전 유지한다. production BullMQ가 비었다는 확인 없이 legacy queue/key/worker를 일괄 삭제하지 않는다. 새 backend health만으로 과거 queue가 비었다고 판단하지 않는다. [`push-notifications.md`](./docs/push-notifications.md)는 delivery fence/receipt/cache와 남는 전달 한계를 정리한다.

## 롤백의 범위

workflow 수동 실행은 특정 SHA와 force를 지원한다. 서버의 `scripts/deploy.sh --rollback` 또는 자동 rollback은 이전 API를 `--no-deps`로 재생성하고 migrate를 다시 실행하지 않는다. 이미지 rollback은 application graph·marker·DDL·업무 데이터 rollback이 아니다.

nullable fingerprint 열은 남아 있어 이전 native client CRUD가 가능한 경우에도 이전 API의 receipt 처리 보호는 사라진다. 모든 과거 이미지의 schema/동작 호환을 보장하지 않는다. 파괴적 DDL·data 변환의 되돌리기는 별도 forward migration 또는 검토된 복구 절차가 필요하다. DB를 drop하거나 marker를 재서명하지 않는다.

새 cursor를 발급한 API를 이전 형식으로 되돌리면 클라이언트가 첫 페이지부터 다시 조회해야 할 수 있다. 공개 routing/payload·개인정보 보정처럼 API와 schema가 함께 바뀌는 릴리스는 해당 graph의 rollout 제한을 [migration.md](../../docs/server/migration.md)와 함께 확인한다.

## 환경 설정과 공개 버전

설정 정본은 `src/platform/config/schemas`와 `.env*.example`이다. env 원문·secret·backup은 로그나 Git에 넣지 않는다. 운영은 OAuth 최소 1개와 Resend key가 필요하다.

| 설정                                                     | 기본/용도                                                |
| -------------------------------------------------------- | -------------------------------------------------------- |
| DATABASE_URL / PGBOSS_DATABASE_URL                       | API DB / 별도 미설정 시 같은 pg-boss DB                  |
| NODE_ENV / APP_ENV                                       | 런타임 / 배포 환경. Sentry는 production APP_ENV에서 발송 |
| PORT                                                     | host 기본 8080, API container 8080                       |
| JWT_SECRET / JWT_REFRESH_SECRET / TOKEN_ENCRYPTION_KEY   | 시작 검증에 필요한 32자 이상 값                          |
| JOB_BACKEND / JOB_SCHEMA                                 | postgres / pgboss                                        |
| JOB_REDIS_DRAIN_ENABLED                                  | false; 잔존 Redis job 전환은 확인한 경우에만 사용        |
| CACHE_TYPE / PUSH_RATE_LIMIT_BACKEND                     | memory / postgres; 서로 다른 capability                  |
| REDIS_*                                                  | Redis backend 또는 drain 연결 설정                       |
| EXPO_ACCESS_TOKEN / RESEND_API_KEY                       | Expo / 이메일 공급자                                     |
| GOOGLE_GENERATIVE_AI_API_KEY                             | 기존 Gemini 모델 공급자; 유료 호출은 별도 범위           |
| RETENTION_ONBOARDING_V2_ENABLED                          | 기본 false; treatment 배정은 별도 운영 설정              |
| DISCORD_SIGNUP_WEBHOOK_URL / DISCORD_PAYMENT_WEBHOOK_URL | 운영 가입/결제 채널                                      |

Swagger는 development에서 `/api/docs`, `/api/admin/docs`로만 제공한다. OS push 권한·외부 공급자 도착·LLM 의미 품질은 `/health` 성공만으로 확인되지 않는다.

스토어 공개 버전은 API `/v1/app-config/app-version` 설정으로 안내하며 API 접근을 차단하지 않는다. 두 store 공개 후에만 `scripts/update-app-version-env.py`의 `--enabled true --published`를 사용한다. script는 app-version 3개 키만 수정하고 private backup을 만들며 나머지 내용·권한을 보존한다. 실행 예시의 버전은 해당 release의 실제 공개값으로 선택한다.

env만 반영할 때는 배포 락과 같은 image 확인 뒤 API만 `--no-deps --no-build --pull never --force-recreate`로 재생성한다. `docker restart`는 env_file 변경을 반영하지 않는다. 실패하면 private env backup과 같은 image로 복구한다.

릴리스 `develop`→`main`은 merge commit으로 공통 조상을 유지한다. main 반영 뒤 develop 이력을 동기화하고 다음 release diff를 확인한다. 검증 완료·merge 완료·이미지 발행·배포 health·실제 DB verify는 각각의 결과로 기록하며, 이 문서는 아직 수행하지 않은 작업을 완료로 표시하지 않는다.
