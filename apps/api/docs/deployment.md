# 서버 배포와 롤백

배포를 준비하거나 장애로 이전 이미지를 복구할 때 참고한다. 정본은 [deploy workflow](../../../.github/workflows/deploy.yml), [배포 스크립트](../../../scripts/deploy.sh), [production compose](../../../docker-compose.prod.yml), [Dockerfile](../Dockerfile)이다. 문서의 절차와 로컬 검증은 실제 운영 적용 완료의 증거가 아니다.

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

deploy workflow는 같은 저장소의 main push/dispatch로 끝난 CI run만 배포한다. SSH host key는 `EC2_SSH_HOST_FINGERPRINT` secret(`ssh-keygen -lf`의 `SHA256:…` 값)이 있을 때만 검증하므로 등록해 둔다.

서버 repository는 `~/apps/Aido-platform`, 배포 상태는 `~/apps/deploy-state`다. workflow와 서버 `flock`이 동시 배포를 막는다. script는 작업 tree SHA·기존 배포 ancestry·최소 3GB 디스크 여유를 확인하고 현재 이미지를 rollback 태그로 보존한다. 이미지는 GHCR에서 pull만 한다. 토큰이 없으면 서버에서 빌드하지 않고 중단하며, 서버 빌드는 `--build`를 준 비상 폴백뿐이다.

production compose는 host API 포트를 `127.0.0.1:${PORT:-8080}`에만 bind한다. 공개 경로는 host Nginx→loopback API 한 홉이며 서버는 이 proxy 경계를 따른다. API container 내부 포트 8080, memory 512M/CPU 1, Node heap 384MiB는 현재 구성값이다.

migrate 서비스 성공 뒤 API를 교체한다. script의 90초 health gate는 Docker healthy와 `/health` 연속 3회 성공을 함께 요구하고, workflow는 공개 `/health`도 확인한다. 실패하면 이전 API image로 복구한다. 성공 뒤 dangling 이미지와 BuildKit cache 전체를 정리하며 `image prune -a`로 rollback image를 제거하지 않는다.

## 수동 배포 (Actions 없이)

서버(t4g.small, 메모리 2GB)에서 이미지를 빌드하면 swap을 쓰고 BuildKit cache가 5GB까지 쌓여 dockerd 메모리도 커졌다. 그래서 수동 배포도 Mac에서 CI image job과 같은 설정(Dockerfile·target·linux/arm64·SHA 태그)으로 빌드해 GHCR에 올리고, 서버는 pull만 한다.

1. Mac: `origin/main`에 있는 커밋을 변경 없는 tree로 checkout하고 `docker login ghcr.io`(write:packages)를 해 둔다. [build script](../../../scripts/release/build-push-api-images.sh)는 trivy 검사(CI와 같은 기준)를 통과한 이미지만 올리고, GHCR에 이미 있는 SHA 태그는 덮어쓰지 않는다.

   ```sh
   git switch main && git pull --ff-only
   bash scripts/release/build-push-api-images.sh --push   # 끝에 서버 명령을 출력한다
   ```

2. 서버: script가 출력한 명령을 실행한다.

   ```sh
   cd ~/apps/Aido-platform && git fetch origin main \
     && git merge-base --is-ancestor <sha> origin/main && git reset --hard <sha> \
     && DEPLOY_SHA=<sha> bash scripts/deploy.sh
   ```

수동 이미지에는 CI attestation이 없고, GHCR 보존 개수 정리는 다음 CI image job이 한다. `bash scripts/deploy.sh --build`는 GHCR를 쓸 수 없을 때만 쓰는 비상 서버 빌드이며 끝나면 빌드 캐시를 모두 지운다.

**서버 GHCR 읽기 토큰 (1회)**: `read:packages`만 가진 classic PAT를 만료일을 정해 만들고 서버에 소유자 전용 파일로 둔다. 토큰을 명령 인자·shell history에 남기지 않는다. 파일이 없으면 터미널 실행 시 입력을 묻는다. 로그인에 실패하면 `GHCR_USER=<GitHub 로그인>`을 앞에 붙인다.

```sh
install -m 600 /dev/null ~/apps/deploy-state/ghcr-read-token
read -rs t && printf '%s\n' "$t" > ~/apps/deploy-state/ghcr-read-token; unset t
```

## DB 전환: API보다 먼저 적용

migrate 이미지(`tooling/database-migrate`)는 Drizzle 마이그레이션 폴더와 DB guard만 가진다. 규칙은 [영속성](persistence.md#마이그레이션)을 따른다.

`migrate.mjs`는 API·pg-boss URL을 먼저 검증한 뒤 pg-boss migration, Drizzle migration 순서로 실행한다. 원격 DB는 의도한 배포의 `AIDO_ALLOW_REMOTE_DB=1`일 때만 허용하며, DDL lock_timeout은 5초다.

| DB 상태                       | 처리                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| 빈 DB                         | baseline부터 모든 마이그레이션 적용                                                           |
| Drizzle 기록이 있는 DB(운영)  | 아직 적용하지 않은 마이그레이션만 적용                                                        |
| Drizzle 기록이 없는 오래된 DB | 지원하지 않는다. 로컬 개발 볼륨이면 `docker compose … down -v`로 지우고 빈 DB에서 다시 만든다 |

## Job과 종료

durable job은 PostgreSQL(pg-boss)만 쓴다. 배포 env에 남은 `JOB_BACKEND`·`JOB_REDIS_DRAIN_ENABLED`·`JOB_POLLING_INTERVAL_SECONDS`는 무시된다. Redis는 `CACHE_TYPE=redis`·`PUSH_RATE_LIMIT_BACKEND=redis`를 고른 경우에만 연결한다.

job runtime의 기본 graceful 종료 대기는 `JOB_SHUTDOWN_TIMEOUT_MS=90000`이며 production Compose의 `stop_grace_period`는 120초다. 기본 작업 대기 뒤 HTTP·자원 종료 여유를 둔다. 종료 대기를 더 길게 설정한다면 Compose 유예도 함께 늘린다. 제한 시간을 넘는 작업의 완료나 모든 background 작업의 drain까지 보장하는 설정은 아니다. 실제 적용 값과 active 작업 상태는 배포 후 확인한다.

[`push-notifications.md`](push-notifications.md)는 delivery fence/receipt/cache와 남는 전달 한계를 정리한다. 리텐션 발송은 공용 push-delivery outbox를 쓴다. 배포 중 리마인더·푸시를 잃지 않는 기준은 [작업과 이벤트](jobs-and-events.md#배포-중-내구성)에 있다.

배포 시각: 03:00~03:40 KST(일간 정리 작업)와 07:00~08:00 KST(아침 리마인더 몰림)를 피한다. 스케줄 `missed` 정책과 워터마크가 들어간 뒤에도 사용량이 적은 시간을 고른다.

## 롤백의 범위

workflow 수동 실행은 특정 SHA와 force를 지원한다. 서버의 `scripts/deploy.sh --rollback` 또는 자동 rollback은 이전 API를 `--no-deps`로 재생성하고 migrate를 다시 실행하지 않는다. 이미지 rollback은 스키마와 업무 데이터를 되돌리지 않는다.

배포 순서는 서버 → 안정화 확인 → 앱이다. 모바일은 최신 서버 응답만 읽으므로 앱 출시 뒤에는 서버를 그 릴리스 이전으로 되돌리지 않고 수정 배포로 대응한다. 릴리스마다 다른 되돌리기 SQL·배포 전 건수 확인은 그 릴리스 문서(`docs/releases/<버전>/`)에 둔다.

모든 과거 이미지의 스키마·동작 호환을 보장하지 않는다. 파괴적 DDL·데이터 변환의 되돌리기는 별도 forward migration 또는 검토된 복구 절차가 필요하다. DB를 drop하지 않는다.

새 cursor를 발급한 API를 이전 형식으로 되돌리면 클라이언트가 첫 페이지부터 다시 조회해야 할 수 있다. 공개 routing/payload·개인정보 보정처럼 API와 스키마가 함께 바뀌는 릴리스는 그 릴리스 노트(`docs/releases`)의 제한을 함께 확인한다.

## 공개 버전과 env 반영

env 목록과 규칙은 [설정](configuration.md), 운영 경보를 사람에게 보내는 Sentry 규칙은 [관측](observability.md#sentry-무료-플랜-운영)에 있다.

Swagger는 development에서 `/api/docs`, `/api/admin/docs`로만 제공한다. OS push 권한·외부 공급자 도착·LLM 의미 품질은 `/health` 성공만으로 확인되지 않는다.

스토어 공개 버전은 API `/v1/app-config/app-version` 설정으로 안내하며 API 접근을 차단하지 않는다. 두 store 공개 후에만 `scripts/update-app-version-env.py`의 `--enabled true --published`를 사용한다. script는 app-version 3개 키만 수정하고 private backup을 만들며 나머지 내용·권한을 보존한다. 실행 예시의 버전은 해당 release의 실제 공개값으로 선택한다.

env만 반영할 때는 배포 락과 같은 image 확인 뒤 API만 `--no-deps --no-build --pull never --force-recreate`로 재생성한다. `docker restart`는 env_file 변경을 반영하지 않는다. 실패하면 private env backup과 같은 image로 복구한다.

작업 PR과 릴리스 stack은 `main`으로 바로 머지한다(`develop`은 더 이상 쓰지 않는다). 검증 완료·merge 완료·이미지 발행·배포 health·실제 DB verify는 각각의 결과로 기록하며, 이 문서는 아직 수행하지 않은 작업을 완료로 표시하지 않는다.
