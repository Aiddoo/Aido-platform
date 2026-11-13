# 영속성 (Drizzle·PostgreSQL)

Repository·Reader·스키마·마이그레이션·DB 오류 번역을 바꿀 때 읽는다. 트랜잭션 경계는 [아키텍처](architecture.md#트랜잭션과-외부-작업), 확장 단계는 [확장](scaling.md)에 있다.

## 정본

`drizzle-orm`·`drizzle-kit` `1.0.0-rc.5`(catalog `drizzle1`), `@nestjs/drizzle`(Pool 수명주기), 공식 트랜잭션 어댑터 `@nestjs-cls/transactional-adapter-drizzle-orm`을 쓴다.

| 항목            | 경로/명령                                                                            |
| --------------- | ------------------------------------------------------------------------------------ |
| 테이블·enum     | `src/platform/database/schema/<context>.schema.ts`, `enums.schema.ts`                |
| relations (RQB) | `src/platform/database/schema/relations.ts` (`defineRelations`)                      |
| Temporal 칼럼   | `src/platform/database/columns/temporal-columns.ts` (`instant`, `plainDate`)         |
| 클라이언트·풀   | `src/platform/database/database.module.ts`, `database.client.ts`, `postgres-pool.ts` |
| 설정            | `drizzle.config.ts`                                                                  |
| 마이그레이션    | `drizzle/<timestamp>_<name>/{migration.sql,snapshot.json}`                           |
| 생성·검사       | `pnpm --filter @aido/server db:generate --name <name>`, `db:check`                   |
| 적용(로컬·배포) | `pnpm db:migrate` (`tooling/database-migrate/migrate.mjs`)                           |

## Repository와 Reader

| 응답이 무엇인가      | 쓰는 것                                                               |
| -------------------- | --------------------------------------------------------------------- |
| Aggregate 상태       | Repository Port + `*-row.mapper.ts`(행 → 도메인 복원은 매퍼 한 곳)    |
| join·집계 projection | Reader Port + Read Model(CQRS-lite). 트랜잭션 밖 조회는 복제본 후보다 |

- 구현은 `TransactionHost<DrizzleTransactionalAdapter>`를 받아 `txHost.tx`만 쓴다. 중첩은 `SavepointRunnerPort`(savepoint)다.
- 조회는 RQB v2(`tx.query.<table>.findFirst`·`findMany`)나 query builder, 변경은 `insert/update/delete … returning()`, 충돌은 `onConflictDoUpdate`/`onConflictDoNothing`이다.
- 조건은 ORM 연산자(`eq`·`and`·`inArray`), 개수는 `$count`, 존재는 `exists`다. 여러 행 upsert는 한 문장(``set: { col: sql`excluded.col` }``)이다.
- 항목 수에 비례해 쿼리를 퍼뜨리지 않는다. N번 조회는 `inArray` 한 번 + `keyBy`/`groupBy`다. `Promise.all`은 트랜잭션 밖의 독립 읽기에만 쓴다.
- 행 타입은 `$inferSelect`/`$inferInsert`로 유도한다. ORM 타입은 infrastructure 밖으로 나가지 않는다.
- Reader 사례: [DrizzleTodoCommentReader](../src/modules/engagement/comments/infrastructure/persistence/drizzle-todo-comment.reader.ts)는 댓글 overview·대화를 root keyset으로 읽고 page 단위 좋아요를 합친다(viewer 상태·cursor 문맥이 있어 공유 캐시를 쓰지 않는다).
- 다른 Context의 테이블은 읽지도 쓰지도 않는다. 필요한 projection은 소유 Context가 public 조회 포트로 열고 그 Context의 Reader가 SQL을 가진다([아키텍처](architecture.md#의존-규칙과-강제)).

## 저장과 잠금

`save(aggregate)`는 읽어 온 Aggregate의 바뀔 수 있는 칸을 모두 쓴다. 그래서 같은 Aggregate를 바꾸는 UseCase는 모두 하나의 공통 잠금을 UoW 안에서 읽기 전에 잡는다. 잡지 않으면 동시에 읽은 두 요청 중 나중 `save`가 앞 요청의 변경을 덮는다(lost update). 다른 행을 미는 집합 update(순서 밀기)도 같은 잠금 아래에서 한다.

- 사례: 메모 수정(`UpdateMemoUseCase`)·고정(`SetMemoPinnedUseCase`)·순서 이동(`ReorderMemoUseCase`)은 같은 메모 행을 `save`하고 순서 이동은 다른 메모의 `sortOrder`도 `shiftSortOrders`로 민다. 셋은 같은 잠금 키([memos.lock-keys.ts](../src/modules/notes/memos/application/memos.lock-keys.ts))를 잡는다.
- 할 일 순서는 사이를 띄운 정수(간격 1024, [todo-sort-order.domain-service.ts](../src/modules/planning/shared/domain/todo-sort-order.domain-service.ts))다. 새 할 일·순서 바꾸기는 이웃 사이 값 한 행만 쓰고, 사이가 없을 때만 그 사용자 할 일을 지금 순서대로 다시 번호 매긴다. 둘 다 사용자 순서 잠금(`TodoLockKeys.sortOrder`) 아래에서 한다.
- 예외: 한 칸만 조건부로 바꾸는 갱신(`readAt`을 `WHERE "readAt" IS NULL`일 때만 채우기)은 잠금 없이 저장소의 전용 메서드로 둔다. 조건이 경합을 막고 다른 칸을 덮지 않기 때문이다.

## raw SQL

기본은 ORM API다: `leftJoinLateral`, `$with`(CTE. `update … returning`을 받는 데이터 변경 CTE도 된다), `.for("update", { of, skipLocked: true })`, `$count`, `exists`. 튜플 keyset 비교는 `platform/database/keyset.ts`의 `tupleLessThan(columns, values)` 하나다.

- 행마다 값이 다른 묶음 갱신은 query builder ``update(table).set({ col: sql`v."col"` }).from(sql`(VALUES …) AS v(…)`)``다. 사례: 보상 기간 `DrizzlePremiumGrantRepository.saveAll`, 댓글 수 정리, 푸시 receipt 종결·세대 재개방.
- `GREATEST`·`COALESCE`·`CASE` 같은 값 식은 `set`·`select` 안의 `sql` 조각으로 쓰고 칼럼은 참조로 넘긴다. 사례: 마지막 활동 기록(`DrizzleUserRepository.updateLastActiveAt`, `$with` + `insert().select()`).

`db.execute(sql…)`는 ORM으로 쓸 수 없을 때만 테이블·칼럼·enum을 참조로 넘겨(`${todo.id}`, `sql.identifier(col.name)`, `::${pushDispatchStatus}`) 쓰고 이유를 한 줄 남긴다. 지금 쓰는 곳은 다음뿐이다.

| 경우                                                                   | 위치                                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| `pg_advisory_xact_lock`                                                | `PostgresMutationLockAdapter`                                   |
| 시퀀스 `nextval`                                                       | `sequence.ts`                                                   |
| 트랜잭션 한정 `set_config('statement_timeout', …)`                     | `ClsUnitOfWork`                                                 |
| VALUES CTE + `FOR UPDATE OF` + 데이터 변경 CTE(claim·finalize·release) | `DrizzlePushDeliveryLifecycleRepository`                        |
| 리텐션 단계 후보 CTE, 시스템 뷰 `pg_timezone_names`                    | `DrizzleRetentionRepository`                                    |
| 성장 지표 요약 CTE                                                     | `DrizzleGrowthMetricsReader`                                    |
| pg-boss 테이블 조회·SQL 브리지                                         | `pg-boss-schedule-run.reader.ts`, `drizzle-pg-boss.database.ts` |
| 연결 확인 `SELECT 1`                                                   | `DatabaseHealthIndicator`                                       |

## 시간 칼럼

| 값        | DB                                | 서버 타입            |
| --------- | --------------------------------- | -------------------- |
| 순간      | `timestamp(3)` / `timestamptz(3)` | `Temporal.Instant`   |
| 달력 날짜 | `date`                            | `Temporal.PlainDate` |
| 벽시계    | `varchar(5)`                      | 문자열 `HH:mm`       |

- `instant`·`plainDate` customType이 Temporal을 주고받는다. `dataType()`은 기존 문자열(`"timestamp(3)"`, `"timestamp(3) with time zone"`, `"date"`)을 정확히 돌려줘 `db:generate`가 빈 diff여야 한다. custom column은 `.defaultNow()`가 없어 ``.default(sql`now()`)``를 쓴다.
- 풀은 세션 `TimeZone=UTC`를 고정한다. 규칙은 [날짜](../../../docs/conventions/dates.md)다.
- `updatedAt`은 도메인이 `ClockPort` 값으로 직접 둔다. 스키마 `$onUpdate`·`$defaultFn`으로 숨겨 채우지 않는다(DB 기본값이 없으면 테스트 seed도 값을 넣는다). 집합 update도 `updatedAt: now`를 명시한다. 사례: [Memo 테이블](../src/platform/database/schema/notes.schema.ts)·[DrizzleMemoRepository](../src/modules/notes/memos/infrastructure/persistence/drizzle-memo.repository.ts).
- 새 시각 칸은 `instant`·`plainDate`만 쓴다. `timestamp(…, { mode: "date" })`·`date(…, { mode: "date" })`와 `$onUpdate`를 쓰지 않는다. 칸을 바꿀 때 그 테이블의 저장소·Reader·테스트 seed를 같은 커밋에서 Temporal로 바꾼다.

## 풀 설정

[postgres-pool.ts](../src/platform/database/postgres-pool.ts)가 세션 옵션을 고정하고 값은 env([설정](configuration.md))다.

| 설정                                  | 값                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `application_name`                    | `aido-api`                                                                                                                                   |
| `statement_timeout`·`lock_timeout`    | 15s · 5s (배치는 `unitOfWork.run(work, { statementTimeoutMs })`가 그 트랜잭션에만 `set_config(…, true)`로 늘린다)                            |
| `idle_in_transaction_session_timeout` | 60s                                                                                                                                          |
| 연결 대기                             | `DATABASE_POOL_CONNECTION_TIMEOUT_MS` 5s, 넘으면 503으로 빨리 실패                                                                           |
| `query_timeout`(클라이언트)           | 20s. 서버 `statement_timeout`보다 길어 평소에는 서버가 먼저 취소하고, DB가 답하지 않을 때만 끊는다                                           |
| 크기                                  | 앱 `DATABASE_POOL_MAX` 10 + pg-boss 3(연결·쿼리 상한은 앱 풀과 같다). 메모리 때문에 늘리지 않는다                                            |
| TLS                                   | URL에 `sslmode`(운영 `require`)가 있으면 TLS로 연결하고 인증서를 검증한다(이미지의 RDS CA `NODE_EXTRA_CA_CERTS`). 규칙은 [보안](security.md) |

## DB 오류 번역

| SQLSTATE                                | 분류                      | 처리                                                                                       |
| --------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| `23505`                                 | unique                    | 저장소가 `isUniqueConstraintViolation(error)`로 잡아 자기 제약만 업무 오류로 번역          |
| `23503`                                 | FK                        | 400 `SYS_0002`, 로그 `database.foreign-key.violated`                                       |
| `40001`·`40P01`                         | 직렬화·교착               | 멱등한 호출자만 `isTransactionWriteConflict`로 다시 시도(예: Postgres 푸시 rate limiter)   |
| `55P03`·`57014`                         | lock·statement 시간 초과  | 503 `SYS_0005`(잠시 후 다시 시도)                                                          |
| `08***`·`57P01`, 풀 대기 초과·연결 끊김 | 연결                      | 같음. SQLSTATE가 없는 pg·pg-pool 고정 문구와 Drizzle 쿼리 아래 네트워크 오류도 연결로 본다 |
| 없음(`Query read timeout`)              | 클라이언트 쿼리 시간 초과 | 같음                                                                                       |

- 분류표는 [classifyDatabaseError](../src/platform/database/database-error.util.ts) 한 곳이다. `GlobalExceptionFilter`가 이 분류로 응답을 정한다. 플랫폼 필터는 Context의 제약 이름을 모른다. 저장소가 번역하지 않은 unique는 409 `SYS_0004`와 경보(`database.unique-constraint.unknown`)이므로, 업무 의미가 있는 제약은 그 저장소가 `isUniqueConstraintViolation(error)`와 `databaseConstraint(error)`로 자기 제약인지 확인해 기존 코드·details를 내게 한다.
- 유휴 연결이 끊기면 pg-pool이 그 연결을 빼고, 풀은 같은 분류로 `database.idle-connection.failed`를 warn으로 남긴다(듣는 쪽이 없으면 프로세스가 죽는다).
- 단건 변경 결과가 없으면 부재 오류(`requireRecord`)를 낸다. 잠금·CAS·rollback은 실제 PostgreSQL integration으로 확인한다.

## 마이그레이션

1. `schema/*.schema.ts`를 고친다.
2. `db:generate --name <change>`로 SQL을 만들고 검토한다. 데이터 이전이 필요하면 생성된 `migration.sql`에 직접 더한다.
3. 적용된 마이그레이션 폴더는 고치지 않는다. 고칠 일은 새 마이그레이션이다.
4. 추가만 한다(칼럼 추가 → 코드 배포 → 정리). 물리 테이블·칼럼 이름은 바꾸지 않고 Drizzle 코드 이름만 바꾼다.
5. 안 쓰는 칼럼·테이블은 두 릴리스에 걸쳐 지운다. Drizzle은 선언한 칼럼을 `select`·`insert`·`returning`에 모두 적어, 배포 중이거나 롤백한 이전 이미지가 그 테이블을 쿼리하기만 해도 칼럼 이름이 나간다.
   - 1단계: 스키마·코드에서 빼고 `db:generate`가 만든 `DROP` 줄은 지우고 이유 주석만 남긴다. snapshot에서 빠져 다음 generate가 확인 없는 `DROP`을 만들지 않는다. 남긴 DB 칸은 nullable이거나 기본값이 있어야 새 코드의 insert가 통과한다. 코드와 [호환](../../../docs/conventions/compatibility.md)에 제거 표시를 남긴다. 사례: `retire_unused_columns`.
   - 2단계(다음 릴리스): `db:generate --custom`으로 `DROP`을 손으로 쓴다. 롤백 대상 이미지가 SQL에 적지 않는 것만 지운다. 어느 이미지도 쿼리하지 않는 테이블은 1단계 없이 지울 수 있다(relations 선언은 SQL을 보내지 않는다).
   - 지우는 마이그레이션은 `DROP` 앞에 `DO $$ … RAISE EXCEPTION … $$`로 "비었다(또는 다른 칸에 똑같이 있다)"를 다시 확인한다. 운영이 다르면 migrate가 실패해 모두 되돌아가고 API는 바뀌지 않는다. 운영 읽기 전용 확인 쿼리와 되돌리기 SQL(모양만 돌아오고 데이터는 돌아오지 않는다)은 릴리스 문서에 둔다. 사례: `drop_push_daily_budget`과 그 [통합 테스트](../test/integration/push-daily-budget-drop.integration-spec.ts).
6. 큰 테이블 잠금은 배포 전 운영 건수를 읽기 전용으로 확인하고, 수만 행을 넘으면 칼럼 추가·나눠 채우기로 나눈다. `db:migrate`는 미적용 마이그레이션을 한 트랜잭션에서 돌려 `CREATE INDEX CONCURRENTLY`를 쓸 수 없다.
7. 앞 마이그레이션의 잠금은 트랜잭션 끝까지 남는다. 그래서 다른 테이블(FK가 가리키는 테이블 포함)을 AccessExclusive로 잠그는 마이그레이션은 첫 문장에 `SET LOCAL lock_timeout = '500ms'`를 둔다. 기다리는 동안 앱 요청이 앱 `lock_timeout`(5초)을 넘겨 503이 되거나 교착에서 앱 트랜잭션이 끊기지 않도록, `deadlock_timeout`(1초)보다 먼저 migrate가 물러난다. 실패는 다시 실행하면 된다.

`db:deploy`(migrate 이미지)는 URL guard → pg-boss migrate → Drizzle migrate 순서이고 원격 DB는 `AIDO_ALLOW_REMOTE_DB=1`일 때만 허용한다. 이미지 롤백은 DB를 되돌리지 않는다([배포](deployment.md#롤백의-범위)).
