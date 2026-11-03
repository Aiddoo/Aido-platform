# Drizzle와 PostgreSQL

DB adapter를 고칠 때는 "읽기·쓰기와 transaction"을 본다. 스키마나 배포를 바꿀 때는 "마이그레이션"과 "배포와 롤백"을 본다. 모든 DB 작업이 마이그레이션을 만드는 것은 아니다.

## 정본

`drizzle-orm`·`drizzle-kit` `1.0.0-rc.5`(catalog `drizzle1`)와 공식 트랜잭션 어댑터 `@nestjs-cls/transactional-adapter-drizzle-orm`을 쓴다.

| 항목            | 경로/명령                                                             |
| --------------- | --------------------------------------------------------------------- |
| 테이블·enum     | `src/platform/database/schema/<context>.schema.ts`, `enums.schema.ts` |
| relations (RQB) | `src/platform/database/schema/relations.ts` (`defineRelations`)       |
| 클라이언트      | `src/platform/database/database.client.ts` (`DRIZZLE`, `Database`)    |
| 설정            | `drizzle.config.ts`                                                   |
| 마이그레이션    | `drizzle/<timestamp>_<name>/{migration.sql,snapshot.json}`            |
| 생성·검사       | `pnpm --filter @aido/server db:generate --name <name>`, `db:check`    |
| 적용(로컬·배포) | `pnpm db:migrate` (`tooling/database-migrate/migrate.mjs`)            |

## 읽기·쓰기와 transaction

- Repository는 `TransactionHost<DrizzleTransactionalAdapter>`를 받아 `this.txHost.tx`만 쓴다. 트랜잭션 경계는 Application의 `UNIT_OF_WORK.run`이 정한다. 중첩 `Propagation.Nested`는 Drizzle savepoint(`tx.transaction`)다.
- 조회는 RQB v2(`tx.query.<table>.findFirst/findMany({ where, with, columns, orderBy, limit })`)나 query builder를 쓴다. 변경은 `insert/update/delete … returning()`, 충돌 처리는 `onConflictDoUpdate`/`onConflictDoNothing`을 쓴다.
- 행 타입은 `typeof table.$inferSelect`, 입력은 `$inferInsert`로 유도한다. 도메인 타입을 ORM 타입에 맞춰 바꾸지 않는다.
- 생성 ID는 `$defaultFn(createEntityId)`, `updatedAt`은 `$onUpdate`가 채운다.
- 단건 변경 결과가 없으면 `requireRecord`(`database-error.util.ts`)로 부재 오류를 낸다. `DrizzleQueryError` 안의 pg `DatabaseError` SQLSTATE는 `isUniqueConstraintViolation`·`isTransactionWriteConflict`·`uniqueConstraintTargets`로 읽는다.
- 시간 값
  - `timestamp(3)`·`timestamptz(3)`·`date`는 `mode: "date"`로 JS `Date`를 주고받는다. `date`는 UTC 자정 `Date`다.
  - 연결 풀은 세션 `TimeZone=UTC`를 고정하므로 결과가 process 시간대와 무관하다([날짜 규칙](../../../docs/conventions/dates.md)).
- Raw SQL은 ORM이 표현하지 못하는 곳에만 쓴다. Drizzle `sql` 템플릿에 테이블·컬럼을 참조로 넘긴다(`${todo.id}`). 해당하는 곳:
  - `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING` 원자 claim
  - LATERAL(댓글 묶음의 대표 답글·참여자)·윈도 집계
  - `pg_advisory_xact_lock`
  - pg-boss SQL bridge(`drizzle-pg-boss.database.ts`)
- 잠금·CAS·rollback은 실제 PostgreSQL integration으로 확인한다. mock 쿼리 인자로 경쟁 안전성을 주장하지 않는다.

## 마이그레이션

1. `schema/*.schema.ts`를 고친다.
2. `pnpm --filter @aido/server db:generate --name <change>`로 SQL을 만들고 검토한다. 데이터 이전이 필요하면 생성된 `migration.sql`에 직접 추가한다.
3. 적용된 마이그레이션 폴더는 수정하지 않는다. 고칠 일이 생기면 새 마이그레이션을 만든다.
4. 구 API가 새 스키마에서도 동작하도록 additive로 나눈다(열 추가 → 코드 배포 → 정리).

## 배포와 롤백

- `db:deploy`(migrate 이미지)는 URL guard → pg-boss migrate → Drizzle migrate 순서로 실행한다. 원격 DB는 `AIDO_ALLOW_REMOTE_DB=1`일 때만 허용하고, DDL lock 대기는 5초다.
- migrate는 Drizzle 기록(`drizzle.__drizzle_migrations`)을 기준으로 남은 마이그레이션만 적용한다. 기록이 없는 오래된 로컬 DB는 볼륨을 지우고 빈 DB에서 다시 만든다(Prisma DB 인수 경로는 전환 완료로 제거).
- 이미지 롤백은 DB를 되돌리지 않는다. 배포 스크립트는 migrate를 다시 실행하지 않고 이전 API만 복구한다.
