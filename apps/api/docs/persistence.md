# 영속성 (Drizzle·PostgreSQL)

Repository·Reader·스키마·마이그레이션·DB 오류 번역을 바꿀 때 읽는다. 트랜잭션 경계는 [아키텍처](architecture.md#트랜잭션과-외부-작업), 확장 단계는 [확장](scaling.md)에 있다.

## 정본

`drizzle-orm`·`drizzle-kit` `1.0.0-rc.5`(catalog `drizzle1`)와 공식 트랜잭션 어댑터 `@nestjs-cls/transactional-adapter-drizzle-orm`을 쓴다.

| 항목            | 경로/명령                                                             |
| --------------- | --------------------------------------------------------------------- |
| 테이블·enum     | `src/platform/database/schema/<context>.schema.ts`, `enums.schema.ts` |
| relations (RQB) | `src/platform/database/schema/relations.ts` (`defineRelations`)       |
| 클라이언트·풀   | `src/platform/database/database.client.ts`, `postgres-pool.ts`        |
| 설정            | `drizzle.config.ts`                                                   |
| 마이그레이션    | `drizzle/<timestamp>_<name>/{migration.sql,snapshot.json}`            |
| 생성·검사       | `pnpm --filter @aido/server db:generate --name <name>`, `db:check`    |
| 적용(로컬·배포) | `pnpm db:migrate` (`tooling/database-migrate/migrate.mjs`)            |

## Repository와 Reader

| 응답이 무엇인가      | 쓰는 것                                                               |
| -------------------- | --------------------------------------------------------------------- |
| Aggregate 상태       | Repository Port + `*-row.mapper.ts`(행 → 도메인 복원은 매퍼 한 곳)    |
| join·집계 projection | Reader Port + Read Model(CQRS-lite). 트랜잭션 밖 조회는 복제본 후보다 |

- 구현은 `TransactionHost<DrizzleTransactionalAdapter>`를 받아 `txHost.tx`만 쓴다. 중첩 `Propagation.Nested`는 savepoint다.
- 조회는 RQB v2(`tx.query.<table>.findFirst/findMany`)나 query builder, 변경은 `insert/update/delete … returning()`, 충돌은 `onConflictDoUpdate`/`onConflictDoNothing`이다.
- 조건은 ORM 연산자(`eq`·`and`·`inArray`), 개수는 `$count`, 존재는 `exists`다. 여러 행 upsert는 한 문장(``set: { col: sql`excluded.col` }``)이다.
- 항목 수에 비례해 쿼리를 퍼뜨리지 않는다. N번 조회는 `inArray` 한 번 + `keyBy`/`groupBy`다. `Promise.all`은 트랜잭션 밖의 독립 읽기에만 쓴다.
- 행 타입은 `$inferSelect`/`$inferInsert`로 유도한다. ORM 타입은 infrastructure 밖으로 나가지 않는다.
- Reader 사례: 댓글 overview·대화는 [DrizzleTodoCommentReader](../src/modules/engagement/comments/infrastructure/persistence/drizzle-todo-comment.reader.ts)가 root keyset을 Drizzle CTE·LATERAL로 읽고 page 단위 좋아요를 합친다. viewer 상태·cursor 문맥이 있어 공유 캐시를 쓰지 않는다. 리마인더 스케줄러의 [DrizzleSchedulerReader](../src/modules/notification/reminders/infrastructure/persistence/drizzle-scheduler.reader.ts)는 발송 대상 판정을 위해 다른 Context 테이블을 한 SQL로 읽는 배치 Read Model이다(쓰기와 판단은 소유 Context).

## raw SQL

허용은 네 경우뿐이다. Drizzle `sql` 템플릿에 테이블·컬럼을 참조로 넘긴다(`${todo.id}`).

1. `pg_advisory_xact_lock`
2. 시퀀스 `nextval`
3. `UPDATE … FROM (VALUES …)`
4. pg-boss SQL 브리지(`drizzle-pg-boss.database.ts`)

나머지는 ORM API로 쓴다: `leftJoinLateral`, `$with`(CTE), `.for("update", { skipLocked: true })`, `$count`, `exists`. 튜플 keyset 비교는 `platform/database/keyset.ts`의 `tupleLessThan(columns, values)` 하나다.

## 시간 칼럼

| 값        | DB                                | 서버 타입(목표)      |
| --------- | --------------------------------- | -------------------- |
| 순간      | `timestamp(3)` / `timestamptz(3)` | `Temporal.Instant`   |
| 달력 날짜 | `date`                            | `Temporal.PlainDate` |
| 벽시계    | `varchar(5)`                      | `Temporal.PlainTime` |

- Drizzle `customType` 두 개(`instant`, `plainDate`)가 Temporal을 주고받는다. `dataType()`은 기존 문자열(`"timestamp(3)"`, `"timestamp(3) with time zone"`, `"date"`)을 정확히 돌려줘 `db:generate`가 빈 diff여야 한다. `codec`은 문자열을 받고 RQB `with`용 `fromJson`을 둔다. custom column은 `.defaultNow()`가 없어 ``.default(sql`now()`)``를 쓴다.
- 풀은 세션 `TimeZone=UTC`를 고정한다. 규칙은 [날짜](../../../docs/conventions/dates.md)다.
- `updatedAt`은 도메인이 `ClockPort` 값으로 직접 둔다. 스키마 `$onUpdate`·`$defaultFn`으로 숨겨 채우지 않는다(DB 기본값이 없으면 테스트 seed도 값을 넣는다). 집합 update(순서 이동 등)도 지금처럼 `updatedAt: now`를 명시한다. 사례: [Memo 테이블](../src/platform/database/schema/notes.schema.ts)·[DrizzleMemoRepository](../src/modules/notes/memos/infrastructure/persistence/drizzle-memo.repository.ts).

## 풀 설정

`platform/database/postgres-pool.ts`의 목표 값이다.

| 설정                                  | 값                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `application_name`                    | `aido-api`                                                                                              |
| `statement_timeout`·`lock_timeout`    | 15s · 5s (배치는 `unitOfWork.run(work, { statementTimeoutMs })`가 그 트랜잭션에만 `SET LOCAL`로 늘린다) |
| `idle_in_transaction_session_timeout` | 60s                                                                                                     |
| `connectionTimeoutMillis`             | 약 5s, 넘으면 503으로 빨리 실패                                                                         |
| `query_timeout`(클라이언트)           | 20s. 서버 `statement_timeout`보다 길어 평소에는 서버가 먼저 취소하고, DB가 답하지 않을 때만 끊는다      |
| 크기                                  | 앱 `DATABASE_POOL_MAX` 10 + pg-boss 3(연결·쿼리 상한은 앱 풀과 같다). 메모리 때문에 늘리지 않는다       |
| TLS                                   | `sslmode=verify-full`(RDS CA는 이미지에 있다)                                                           |

## DB 오류 번역

| SQLSTATE                                | 분류                      | 처리                                                                                       |
| --------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| `23505`·`23503`·`23514`                 | unique·FK·check           | 저장소가 `isUniqueConstraintViolation(error, "<제약>")`으로 자기 제약만 업무 오류로 번역   |
| `40001`·`40P01`                         | 직렬화·교착               | 멱등한 UoW만 `run(work, { retryOnConflict: true })`로 1회 재실행                           |
| `55P03`·`57014`                         | lock·statement 시간 초과  | 503 `SYS_0005`(잠시 후 다시 시도)                                                          |
| `08***`·`57P01`, 풀 대기 초과·연결 끊김 | 연결                      | 같음. SQLSTATE가 없는 pg·pg-pool 고정 문구와 Drizzle 쿼리 아래 네트워크 오류도 연결로 본다 |
| 없음(`Query read timeout`)              | 클라이언트 쿼리 시간 초과 | 같음                                                                                       |

- 분류표는 [classifyDatabaseError](../src/platform/database/database-error.util.ts) 한 곳이다. `GlobalExceptionFilter`는 이 분류로 응답을 정하고, 미지의 unique는 409 `SYS_0004`에 경보(`database.unique-constraint.unknown`)를 올린다.
- 유휴 연결이 끊기면 pg-pool이 그 연결을 빼고, 풀은 같은 분류로 `database.idle-connection.failed`를 warn으로 남긴다(듣는 쪽이 없으면 프로세스가 죽는다).
- 단건 변경 결과가 없으면 부재 오류를 낸다. 잠금·CAS·rollback은 실제 PostgreSQL integration으로 확인한다.

## 마이그레이션

1. `schema/*.schema.ts`를 고친다.
2. `db:generate --name <change>`로 SQL을 만들고 검토한다. 데이터 이전이 필요하면 생성된 `migration.sql`에 직접 더한다.
3. 적용된 마이그레이션 폴더는 고치지 않는다. 고칠 일은 새 마이그레이션이다.
4. 추가만 한다(칼럼 추가 → 코드 배포 → 정리). 물리 테이블·칼럼 이름은 바꾸지 않고 Drizzle 코드 이름만 바꾼다.
5. 안 쓰는 칼럼은 두 릴리스에 걸쳐 지운다: 먼저 스키마·코드에서 빼고, 다음 릴리스에 `DROP COLUMN/TABLE`. 배포 중이거나 롤백한 이전 컨테이너가 칼럼을 이름으로 SELECT하기 때문이다.
6. 큰 테이블 잠금은 배포 전 운영 건수를 읽기 전용으로 확인하고, 수만 행을 넘으면 칼럼 추가·나눠 채우기·`CREATE INDEX CONCURRENTLY`로 나눈다.

`db:deploy`(migrate 이미지)는 URL guard → pg-boss migrate → Drizzle migrate 순서이고 원격 DB는 `AIDO_ALLOW_REMOTE_DB=1`일 때만 허용한다. 이미지 롤백은 DB를 되돌리지 않는다([배포](deployment.md#롤백의-범위)).

## 전환 중

아직 옮기지 않은 Context의 저장소는 `mode: "date"`(`date`는 UTC 자정 `Date`), `$onUpdate`, raw SQL(LATERAL·윈도 집계·`FOR UPDATE SKIP LOCKED`)을 그대로 쓴다. customType·`$onUpdate` 제거·raw SQL 정리는 각 Context를 옮길 때 자기 테이블과 그 테이블을 읽는 다른 Context reader를 함께 바꾼다. 옮긴 Context는 `apps/api/architecture.ratchet.json`의 `migratedContexts`에 있다.
