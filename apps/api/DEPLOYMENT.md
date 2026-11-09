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

deploy workflow는 같은 저장소의 main push/dispatch로 끝난 CI run만 배포한다. SSH host key는 `EC2_SSH_HOST_FINGERPRINT` secret(`ssh-keygen -lf`의 `SHA256:…` 값)이 있을 때만 검증하므로 등록해 둔다.

서버 repository는 `~/apps/Aido-platform`, 배포 상태는 `~/apps/deploy-state`다. workflow와 서버 `flock`이 동시 배포를 막는다. script는 작업 tree SHA·기존 배포 ancestry·최소 3GB 디스크 여유를 확인하고 현재 이미지를 rollback 태그로 보존한다. 이미지는 GHCR에서 pull만 한다. 토큰이 없으면 서버에서 빌드하지 않고 중단하며, 서버 빌드는 `--build`를 준 비상 폴백뿐이다.

production compose는 host API 포트를 `127.0.0.1:${PORT:-8080}`에만 bind한다. 공개 경로는 host Nginx→loopback API 한 홉이며 서버는 이 proxy 경계를 따른다. API container 내부 포트 8080, memory 512M/CPU 1, Node heap 384MiB는 현재 구성값이다.

migrate 서비스 성공 뒤 API를 교체한다. script의 90초 health gate는 Docker healthy와 `/health` 연속 3회 성공을 함께 요구하고, workflow는 공개 `/health`도 확인한다. 실패하면 이전 API image로 복구한다. 성공 뒤 dangling 이미지와 BuildKit cache 전체를 정리하며 `image prune -a`로 rollback image를 제거하지 않는다.

## 수동 배포 (Actions 없이)

서버(t4g.small, 메모리 2GB)에서 이미지를 빌드하면 swap을 쓰고 BuildKit cache가 5GB까지 쌓여 dockerd 메모리도 커졌다. 그래서 수동 배포도 Mac에서 CI image job과 같은 설정(Dockerfile·target·linux/arm64·SHA 태그)으로 빌드해 GHCR에 올리고, 서버는 pull만 한다.

1. Mac: `origin/main`에 있는 커밋을 변경 없는 tree로 checkout하고 `docker login ghcr.io`(write:packages)를 해 둔다. [build script](../../scripts/release/build-push-api-images.sh)는 trivy 검사(CI와 같은 기준)를 통과한 이미지만 올리고, GHCR에 이미 있는 SHA 태그는 덮어쓰지 않는다.

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

migrate 이미지(`tooling/database-migrate`)는 Drizzle 마이그레이션 폴더와 DB guard만 가진다. 규칙은 [.claude/drizzle.md](./.claude/drizzle.md)를 참고한다.

`migrate.mjs`는 API·pg-boss URL을 먼저 검증한 뒤 pg-boss migration, Drizzle migration 순서로 실행한다. 원격 DB는 의도한 배포의 `AIDO_ALLOW_REMOTE_DB=1`일 때만 허용하며, DDL lock_timeout은 5초다.

| DB 상태                       | 처리                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| 빈 DB                         | baseline부터 모든 마이그레이션 적용                                                           |
| Drizzle 기록이 있는 DB(운영)  | 아직 적용하지 않은 마이그레이션만 적용                                                        |
| Drizzle 기록이 없는 오래된 DB | 지원하지 않는다. 로컬 개발 볼륨이면 `docker compose … down -v`로 지우고 빈 DB에서 다시 만든다 |

## Job과 종료

durable job은 PostgreSQL(pg-boss)만 쓴다. 배포 env에 남은 `JOB_BACKEND`·`JOB_REDIS_DRAIN_ENABLED`는 무시된다. Redis는 `CACHE_TYPE=redis`·`PUSH_RATE_LIMIT_BACKEND=redis`를 고른 경우에만 연결한다.

job runtime의 기본 graceful 종료 대기는 `JOB_SHUTDOWN_TIMEOUT_MS=90000`이며 production Compose의 `stop_grace_period`는 120초다. 기본 작업 대기 뒤 HTTP·자원 종료 여유를 둔다. 종료 대기를 더 길게 설정한다면 Compose 유예도 함께 늘린다. 제한 시간을 넘는 작업의 완료나 모든 background 작업의 drain까지 보장하는 설정은 아니다. 실제 적용 값과 active 작업 상태는 배포 후 확인한다.

[`push-notifications.md`](./docs/push-notifications.md)는 delivery fence/receipt/cache와 남는 전달 한계를 정리한다.

리텐션 발송은 공용 push-delivery outbox를 쓴다.

## 롤백의 범위

workflow 수동 실행은 특정 SHA와 force를 지원한다. 서버의 `scripts/deploy.sh --rollback` 또는 자동 rollback은 이전 API를 `--no-deps`로 재생성하고 migrate를 다시 실행하지 않는다. 이미지 rollback은 스키마와 업무 데이터를 되돌리지 않는다.

배포 순서는 서버 → 안정화 확인 → 앱이다. 앱 1.15.0은 1.15 서버가 안정화된 뒤에 낸다. 모바일은 최신 서버 응답만 읽으므로 앱 1.15.0 출시 뒤에는 서버를 1.15 이전으로 되돌리지 않고 수정 배포로 대응한다. 아래 1.14.2 롤백 절은 앱 출시 전에만 쓴다.

**1.14.2 migration 뒤에는 이미지를 1.14.1 이하로만 되돌리지 않는다.** `drop_legacy_comment_path_and_retention_outbox`가 `TodoComment.path`·`depth`·`rootId` 열과 `RetentionPushOutbox`를 지웠다. 이전 이미지는 지운 열에 값을 쓰므로 댓글 작성이 실패한다. API를 되돌려야 하면 1.14.2 이상 이미지를 쓴다.

**1.15.0 반복 할 일(`todo_series`)**은 1.14.2 이미지로 되돌릴 수 있도록 `Todo`→`TodoSeries` FK와 `CHECK ((recurrenceGroupId IS NULL) = (occurrenceDate IS NULL))`를 걸지 않았다. 되돌린 동안 옛 코드가 만든 묶음은 규칙이 없고 `occurrenceDate`도 NULL이다. 1.16.0에서 이 고아 묶음을 보정한 뒤 FK(`NOT VALID`→`VALIDATE`)와 CHECK를 건다.

1.15.0에서 1.14.2 이미지로 되돌리면 이미지 교체 직후 아래 SQL을 한 번 실행한다. 이관으로 모든 레거시 묶음에 규칙이 생겼는데 옛 코드는 카테고리를 지울 때 `Todo`만 옮기므로, 이 FK(`ON DELETE RESTRICT`)가 남아 있으면 반복이 있던 카테고리를 지울 수 없다.

```sql
ALTER TABLE "TodoSeries" DROP CONSTRAINT "TodoSeries_categoryId_fkey";
```

다시 1.15.0 이상으로 올릴 때는 새 API로 교체한 직후 아래 SQL을 한 트랜잭션으로 한 번 실행한다. 교체 전에 FK를 걸면 아직 도는 옛 서버의 카테고리 삭제가 다시 막힌다. `migrate`는 이 FK를 복구하지 않는다.

정리 대상이 없어도 그대로 실행한다. 옛 서버는 카테고리를 지울 때 할 일만 옮겼으므로 규칙은 자기 회차가 옮겨 간 카테고리로 따라가고, 회차가 없으면 사용자의 첫 카테고리로 간다. 사용자마다 카테고리가 하나 이상 있어 대상이 비지 않는다. 대상이 없으면 `NOT NULL` 위반으로 트랜잭션 전체가 되돌아가므로 일부만 적용되지 않는다.

```sql
BEGIN;
UPDATE "TodoSeries" AS series
SET
  "categoryId" = COALESCE(
    (
      SELECT occurrence."categoryId"
      FROM "Todo" AS occurrence
      JOIN "TodoCategory" AS category ON category."id" = occurrence."categoryId"
      WHERE occurrence."recurrenceGroupId" = series."id"
        AND category."userId" = series."userId"
      ORDER BY occurrence."startDate" DESC, occurrence."id" DESC
      LIMIT 1
    ),
    (
      SELECT category."id"
      FROM "TodoCategory" AS category
      WHERE category."userId" = series."userId"
      ORDER BY category."sortOrder", category."id"
      LIMIT 1
    )
  ),
  "updatedAt" = now()
WHERE NOT EXISTS (SELECT 1 FROM "TodoCategory" AS category WHERE category."id" = series."categoryId");
ALTER TABLE "TodoSeries"
  ADD CONSTRAINT "TodoSeries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TodoCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "TodoSeries" VALIDATE CONSTRAINT "TodoSeries_categoryId_fkey";
COMMIT;
```

이 SQL을 돌리기 전까지 새 서버의 동작: 밤 작업은 깨진 규칙만 `planning.todo-series.materialize-failed`로 건너뛰고 다른 규칙은 계속 만든다. 사용자가 그 규칙을 바꾸면 400 `SYS_0002`이고 `categoryId`를 함께 보내면 풀린다. SQL을 돌린 뒤 다음 밤 작업부터 멈췄던 규칙이 이어진다.

1.14.2로 되돌릴 때의 다른 영향: `email-delivery.v1` 큐에 남은 인증 메일은 재배포 전까지 나가지 않는다. `admin-notification.v1`의 새 형식 잡은 옛 worker가 버린다(운영 알림이라 수용). 2026-11-04 AI 데이터 공유 동의자는 옛 서버에서 UNDECIDED로 보인다(개인정보 쪽으로 안전한 방향이고, 다시 올리면 돌아온다).

**1.15.0 떠 있는 시각(`todo_scheduled_local_time`)도 1.14.2로 되돌릴 수 있다.** `Todo.scheduledLocalTime`은 NOT NULL·CHECK가 없는 추가 칸이라 옛 서버가 몰라도 쓰기가 깨지지 않는다. 다만 되돌린 동안 옛 서버는 이 칸을 채우거나 고치지 않는다. 그동안 새 앱은 칸이 비면 `scheduledTime`을 기기 시간대로 보여 주고, 칸이 낡은 행은 옛 값을 보여 준다. 재계산은 칸이 빈 행을 건너뛴다. `todo-timezone-rebase.v1`의 대기 작업은 옛 서버가 소비하지 않으므로 쌓이기만 하고, 다시 올리면 보관 시간(24시간) 안의 것은 그대로 돈다.

**1.15.0 알림 회차(`notification_reminder_occurrence`)도 되돌릴 수 있다.** `Notification.reminderOccurrenceKey`는 빈 값을 허용하고 옛 서버는 비운 채로 쓴다. 인덱스가 비운 값끼리 예전처럼 할 일 + 단계로 막는다. 응답과 푸시에는 실리지 않는다.

다시 1.15.0 이상으로 올릴 때는 위 FK SQL과 함께 새 API로 교체한 직후 아래의 다시 채우는 SQL을 한 번 실행한다. `rollback_started_at`은 옛 이미지로 교체한 UTC 시각이다. `updatedAt`으로 롤백 중 옛 서버가 쓴 행만 고치고 그 전의 지난 행은 벽시계를 지킨다. 칸이 빈 행은 시각과 상관없이 채운다. 여러 번 돌려도 결과가 같고 `updatedAt`을 바꾸지 않는다. 앱 쓰기를 막지 않도록 행 잠금만 잡는다. 실행 전 건수는 `WHERE`만 `SELECT count(*)`로 바꿔 확인한다.

```sql
UPDATE "Todo" AS t
SET "scheduledLocalTime" = CASE
  WHEN t."scheduledTime" IS NULL THEN NULL
  ELSE to_char(t."scheduledTime" AT TIME ZONE zone."name", 'HH24:MI')
END
FROM (
  SELECT u."id" AS "userId", COALESCE(valid_zone."name", 'Asia/Seoul') AS "name"
  FROM "User" AS u
  LEFT JOIN "UserPreference" AS preference ON preference."userId" = u."id"
  LEFT JOIN (SELECT "name" FROM pg_timezone_names) AS valid_zone ON valid_zone."name" = preference."timezone"
) AS zone
WHERE zone."userId" = t."userId"
  AND (
    t."updatedAt" >= :'rollback_started_at'::timestamp
    OR (t."scheduledTime" IS NOT NULL AND t."scheduledLocalTime" IS NULL)
  );
```

되돌린 동안 시간대가 바뀐 사용자는 재계산 작업이 없어 모든 할 일의 순간이 옛 시간대로 남는다. 표시는 벽시계라 맞고, 알림은 사용자가 다음에 시간대를 바꾸거나 그 할 일의 시간을 고칠 때 맞는다. 되돌린 기간이 길었다면 저장 시간대가 규칙 시간대와 다른 사용자를 찾아 `todo-timezone-rebase.v1`을 넣는다.

**1.15.0 재계산 범위:** 재계산은 시간 있는 모든 할 일을 본다. 배포만으로는 아무 행도 바꾸지 않고, 사용자의 다음 시간대 변경 때 그 사용자의 전체 이력을 한 번에 다시 쓴다. 5만 행 기준 약 4~5초, 묶음(500행)마다 잠금을 놓는다. 일괄 이관은 없다. 알림 단계 `immediate`는 없어졌다. 배포 순간 대기 중이던 작업은 60분 문구로 나갈 수 있다.

**1.15.0 앱 × 1.14.2 서버의 제약 (롤백 중에만):** 서버를 먼저 배포하므로 이 조합은 롤백 때만 생긴다.

| 동작                                             | 결과                                                                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 반복 회차 수정 시트                              | `GET /v1/todo-series/:id`가 없어 404 `SYS_0002`다. 앱은 규칙 없음으로 보고 "이 할 일만" 고친다                                                                   |
| 반복 만들기                                      | 옛 서버는 `repeat`를 버리고 단일 할 일 하나만 201로 만든다. 응답에 `series`가 없으면 앱은 실패로 안내하고 입력을 보존한다. **이미 만들어진 단일 할 일은 남는다** |
| 삭제 `scope=ALL`, 이후 모두 수정                 | 옛 서버는 `scope`를 몰라 이 회차 하나만 지우거나 고치고 200을 준다. 앱은 구분할 수 없다                                                                          |
| 반복 끝내기                                      | 200이지만 아무것도 바뀌지 않는다. 앱은 구분할 수 없다                                                                                                            |
| AI 동의 `2026-11-04` 동의·철회                   | 400 `SYS_0002`다. 이 동의자는 옛 서버에서 UNDECIDED로 보여 `AI_1311`을 받는다. 동의도 철회도 다시 올릴 때까지 안 된다                                            |
| `/v1/entitlements`, `/v1/quick-plans` 등 새 경로 | 404다. 크래시는 없고 내 정보·구독 화면에 재시도 화면이 뜬다                                                                                                      |

옛 서버가 만든 묶음은 규칙과 회차 날짜가 없어 응답의 `repeat`가 null이다. 앱은 이런 묶음에 범위 질문과 반복 끝내기를 보이지 않고, 다시 올린 뒤 새 서버는 이 묶음의 "모든 반복 할 일" 삭제를 받는다. 이관에서 요일을 정할 수 없던 묶음도 같은 상태다.

**1.15.0 배포 전 확인**: `todo_series` 이관은 `Todo` 전체를 잠근다(로컬 측정 126만 행·26만 행 묶음에서 약 4.7초, 앱 요청 제한 10초, `lock_timeout` 5초). 실행 전에 운영 DB에서 읽기 전용으로 아래 건수를 본다. 묶음 행이 수만을 넘으면 칸 추가·채우기·`CREATE UNIQUE INDEX CONCURRENTLY`로 나눈다. 2026-11 기준 묶음 119개·1,834행이라 그대로 실행한다.

```sql
SELECT count(DISTINCT "recurrenceGroupId") AS series, count(*) AS rows FROM "Todo" WHERE "recurrenceGroupId" IS NOT NULL;
```

**`todo_scheduled_local_time` 배포 전 확인**: 칸 채우기도 같은 트랜잭션에서 `Todo`를 잠근다. 일회용 PostgreSQL에서 전체 126만 행 중 시간 있는 63만 행을 채우는 데 10.0~10.9초였다(사용자 2만 명, 인덱스 그대로, 약 17µs/행, 2회). 앱 요청 제한이 10초이고 위 이관과 시간이 더해지므로 아래 건수가 20만을 넘으면 배포 전에 나눠 채운다. 건수가 그 아래면 그대로 실행한다.

```sql
SELECT count(*) FROM "Todo" WHERE "scheduledTime" IS NOT NULL;
```

나눠 채우는 법: 먼저 `ALTER TABLE "Todo" ADD COLUMN IF NOT EXISTS "scheduledLocalTime" varchar(5);`을 실행하고, 마이그레이션의 `UPDATE`에 `AND t."id" BETWEEN :from AND :to`를 붙여 1만 행씩 커밋한다. 옛 서버가 새 칸을 몰라도 쓰기는 깨지지 않는다. 마이그레이션은 빈 칸만 다시 채우므로 그 뒤 배포하면 잠금이 짧다.

**`notification_reminder_occurrence` 배포 전 확인**: 같은 트랜잭션에서 `Notification`을 잠근다. 일회용 PostgreSQL에서 알림 200만 행 중 44만 행을 채우는 데 7.2~7.7초, 인덱스 만들기 0.2초였다(약 17µs/행, 2회). 채우는 행은 그제 이후 할 일의 알림뿐이라 보통 훨씬 적다. 앞의 이관과 시간이 더해지므로 아래 건수가 10만을 넘으면 알리고 한가한 시간에 배포한다.

```sql
SELECT count(*) FROM "Notification" AS n JOIN "Todo" AS t ON t."id" = n."todoId"
WHERE n."type" = 'TODO_REMINDER' AND t."startDate" >= CURRENT_DATE - 2;
```

모든 과거 이미지의 스키마·동작 호환을 보장하지 않는다. 파괴적 DDL·데이터 변환의 되돌리기는 별도 forward migration 또는 검토된 복구 절차가 필요하다. DB를 drop하지 않는다.

새 cursor를 발급한 API를 이전 형식으로 되돌리면 클라이언트가 첫 페이지부터 다시 조회해야 할 수 있다. 공개 routing/payload·개인정보 보정처럼 API와 스키마가 함께 바뀌는 릴리스는 그 릴리스 노트(`docs/releases`)의 제한을 함께 확인한다.

## 환경 설정과 공개 버전

설정 정본은 `src/platform/config/schemas`와 `.env*.example`이다. env 원문·secret·backup은 로그나 Git에 넣지 않는다. 운영은 OAuth 최소 1개, Resend key, WeatherKit 자격 네 값이 필요하다.

| 설정                                                              | 기본/용도                                                                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| DATABASE_URL / PGBOSS_DATABASE_URL                                | API DB / 별도 미설정 시 같은 pg-boss DB                                                                           |
| DATABASE_POOL_MAX / _IDLE_TIMEOUT_MS / _CONNECTION_TIMEOUT_MS     | 10 / 비우면 pg 기본값(유휴 10초, 연결 대기 무제한)                                                                |
| NODE_ENV / APP_ENV                                                | 런타임 / 배포 환경. Sentry는 production APP_ENV에서 발송                                                          |
| PORT                                                              | host 기본 8080, API container 8080                                                                                |
| JWT_SECRET / JWT_REFRESH_SECRET / TOKEN_ENCRYPTION_KEY            | 시작 검증에 필요한 32자 이상 값                                                                                   |
| JOB_SCHEMA                                                        | pgboss                                                                                                            |
| CACHE_TYPE / PUSH_RATE_LIMIT_BACKEND                              | memory / postgres; 서로 다른 capability                                                                           |
| REDIS_*                                                           | `CACHE_TYPE=redis` 또는 `PUSH_RATE_LIMIT_BACKEND=redis`일 때의 연결 설정                                          |
| EXPO_ACCESS_TOKEN / RESEND_API_KEY                                | Expo / 이메일 공급자                                                                                              |
| EMAIL_PROVIDER / ADMIN_NOTIFIER_PROVIDER                          | 선택. 기본 `resend` / `discord`. `log`는 보내지 않고 로그만 남기며 운영은 `resend`+키 필수                        |
| ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / OPENAI_API_KEY | AI 업체 키(있는 업체만 사용). 1.13·1.14 동의 사용자는 Gemini만 쓰므로 Google 키는 계속 필요                       |
| AI_PROVIDER_ORDER / AI_MODEL_{ANTHROPIC,GOOGLE,OPENAI}            | 선택. 기본 `anthropic,google,openai` / claude-haiku-5-5·gemini-3.1-flash-lite·gpt-6-luna                          |
| AI_DEADLINE_<TASK>_MS / AI_BREAKER_*                              | 선택. 업체 체인 제한 시간·회로 차단 시간(docs/server/ai.md)                                                       |
| AI_GENERATION_MODE / AI_BUDGET_*_USD                              | 선택. 킬 스위치(`off`·`interactive-only`, 재시작 필요)와 추정 비용 예산(docs/server/ai.md)                        |
| WEATHERKIT_TEAM_ID / _KEY_ID / _SERVICE_ID / _PRIVATE_KEY         | 날씨 v2. 모두 있거나 모두 없음, 운영 필수. SERVICE_ID는 앱 번들 ID가 아닌 Services ID, 키는 `\n`을 넣은 한 줄 PEM |
| RETENTION_ONBOARDING_V2_ENABLED                                   | 기본 false; treatment 배정은 별도 운영 설정                                                                       |
| DISCORD_SIGNUP_WEBHOOK_URL / DISCORD_PAYMENT_WEBHOOK_URL          | 운영 가입/결제 채널                                                                                               |
| REVENUECAT_API_V2_SECRET_KEY / REVENUECAT_PROJECT_ID              | 선택. 둘 다 있으면 웹훅 뒤 스토어 상태 대조를 켠다(`docs/billing.md`). v2 비밀 키, 권한은 읽기 둘뿐               |
| FEATURE_DISCOVERY_*                                               | 새 기능 소개. 규칙은 아래                                                                                         |

새 기능 소개 값은 릴리스마다 맞춘다. `.env*.example`의 값은 옛 예시이므로 복사하지 않는다.

- `FEATURE_DISCOVERY_CAMPAIGN_ID`: 그 릴리스 앱에 번들된 id다(`feature-discovery.registry.ts`의 `FEATURE_DISCOVERY_CAMPAIGN_ID`, 1.15.0은 `feature-discovery-2026-12`). 앱은 자기가 모르는 id면 소개를 띄우지 않는다.
- `FEATURE_DISCOVERY_MIN_APP_VERSION`: 그 캠페인을 번들한 앱 버전이다(1.15.0).
- `FEATURE_DISCOVERY_LAUNCHED_AT`: 끝이 `Z`인 UTC ISO로 쓴 그 릴리스의 배포 시각이다. 이후 가입자는 소개 대신 활성화 흐름을 본다.

운영 경보(이메일 발송 실패·한도 근접·회로 열림, 결제 웹훅 실패, AI 예산 등)는 Sentry 이슈로만 남고 사람에게 자동 전달되지 않는다. Sentry 알림 규칙에서 태그 `alert.key`가 `notification.email.*`·`billing.subscription.webhook.processing-failed`·`operations.admin-notification.rejected`·`ai.*`(예산 초과로 유료 포함 AI 전체 중단·결제 회로·가격표 없는 모델)·`weather.*`(WeatherKit 호출량)·`access.quota.*`(돌려주지 못한 예약)·`planning.todo-series.*`(회차 채우기 실패)·`planning.todo-timezone-rebase-failed`(시간대 재계산 실패)·`social.invite-reward.*`(초대 보상 재시도 소진)·`billing.subscription.reconcile.failed`(스토어 상태 대조 재시도 소진)인 이슈를 Discord·Slack·이메일로 전달하도록 설정해야 한다. 설정하지 않으면 인증 메일이 밀리거나 메일이 버려져도 아무도 알 수 없다.

Swagger는 development에서 `/api/docs`, `/api/admin/docs`로만 제공한다. OS push 권한·외부 공급자 도착·LLM 의미 품질은 `/health` 성공만으로 확인되지 않는다.

스토어 공개 버전은 API `/v1/app-config/app-version` 설정으로 안내하며 API 접근을 차단하지 않는다. 두 store 공개 후에만 `scripts/update-app-version-env.py`의 `--enabled true --published`를 사용한다. script는 app-version 3개 키만 수정하고 private backup을 만들며 나머지 내용·권한을 보존한다. 실행 예시의 버전은 해당 release의 실제 공개값으로 선택한다.

env만 반영할 때는 배포 락과 같은 image 확인 뒤 API만 `--no-deps --no-build --pull never --force-recreate`로 재생성한다. `docker restart`는 env_file 변경을 반영하지 않는다. 실패하면 private env backup과 같은 image로 복구한다.

작업 PR과 릴리스 stack은 `main`으로 바로 머지한다(`develop`은 더 이상 쓰지 않는다). 검증 완료·merge 완료·이미지 발행·배포 health·실제 DB verify는 각각의 결과로 기록하며, 이 문서는 아직 수행하지 않은 작업을 완료로 표시하지 않는다.
