# 1.15.0 서버 되돌리기와 배포 전 확인

1.15.0 서버를 1.14.2 이미지로 되돌리거나 다시 올릴 때만 쓴다. 앱 1.15.0 출시 뒤에는 서버를 1.15 이전으로 되돌리지 않고 수정 배포로 대응한다. 일반 배포·롤백 절차는 [서버 배포](../../../apps/api/docs/deployment.md)에 있다.

## 되돌리기

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
