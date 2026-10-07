# Prisma 가이드

**Version**: 2.1.0 · **Last Updated**: 2026-10-07 · **Owner**: Aido Platform Team

Prisma 8 PostgreSQL ORM과 contract migration graph를 사용한다. ORM은 `@prisma/orm-postgres@8.0.0-rc.14`, CLI는 `prisma@8.0.0-rc.20`으로 고정한다. 두 패키지의 릴리스 번호는 독립적이며 현재 RC 버전이다.

## 계약과 생성

- 정본: `src/prisma/contract.prisma`
- 설정: `prisma.config.ts`
- 생성 타입과 JSON: `src/generated/prisma8/contract.d.ts`, `contract.json`
- 마이그레이션: `prisma/migrations8/app/`, 공유 snapshot: `prisma/migrations8/snapshots/`

`pnpm db:generate`는 `prisma contract emit`을 Turbo로 캐시한다. 계약·설정·패키지·DB URL guard 변경은 캐시를 무효화한다. 생성에는 DB 연결이나 DDL이 필요하지 않다. Nest build는 runtime 계약 JSON을 asset으로 복사한다.

## 명령

| 명령                                                      | 용도                                     |
| --------------------------------------------------------- | ---------------------------------------- |
| `pnpm db:generate`                                        | 계약 JSON과 타입 생성                    |
| `pnpm db:plan -- --name <name> --from <hash>`             | 명시한 이전 계약에서 migration 계획 생성 |
| `pnpm db:migrate`                                         | 로컬 DB에 검토된 graph 적용              |
| `pnpm db:verify`                                          | 현재 계약과 실제 스키마 비교             |
| `pnpm --filter @aido/server db:deploy`                    | URL 검증·pg-boss·기존 DB 등록·graph 적용 |
| `pnpm --filter @aido/server exec prisma migration status` | 적용 상태와 경로 확인                    |

계약 변경 후 먼저 emit하고 plan한다. 변경한 `migration.ts`는 `node prisma/migrations8/app/<dir>/migration.ts --config prisma.config.ts`로 self-emit한다. `ops.json`과 `migration.json`을 손으로 수정하지 않는다. 물리 스키마가 같은 codec 전환도 `migration new --from <hash>`로 0-operation graph edge를 남긴다. 적용된 migration과 snapshot은 변경하지 않는다. 신규 변경은 새 migration으로 연결한다.

## ORM과 계층 경계

`DatabaseService`는 단일 native client를 소유하고 `PostgresPool`은 한 개의 외부 `pg.Pool`을 소유한다. module destroy에서 client를 종료하고 application shutdown에서 pool을 종료한다.

Repository는 `TransactionHost<Prisma8TransactionalAdapter>.tx`를 읽는다. 활성 트랜잭션 안팎에서 동일한 native API를 사용한다. application/domain에는 ORM 타입과 계약을 전달하지 않는다.

```ts
const user = await this.txHost.tx.orm.public.User.where({ id: userId })
  .select('id', 'email')
  .first();
```

필요한 필드와 관계만 `select`/`include`로 조회한다. 그룹 집계는 ORM `groupBy().aggregate()`를 사용한다. raw SQL은 재귀 관계, 원자적 claim/counter, advisory lock처럼 단일 SQL의 원자성이 필요한 경우에 한정한다. 값은 항상 바인딩하고 반환 column codec을 명시한다.

`database-records.ts`의 `encodeCreate`/`encodePatch`/`decodeRecord`는 기존 port의 `Date`, 문자열, `type` 표현을 native 계약 codec과 변환한다. nullable 필드의 `null`은 지우기, `undefined`는 변경 생략이다. JSON 내부의 문자열은 날짜로 변환하지 않는다. 신규 문자열 ID는 기존 공개 CUID 검증 규칙을 만족한다. DateString/TimestampString/TimestamptzString codec으로 대량 날짜 조회의 Temporal 객체 생성을 피한다.

## 조건부 쓰기와 동시성

현재 고정된 ORM rc.14의 단건 `.where(predicate).update()`는 일치하는 행을 먼저 읽고
실제 UPDATE에는 PK 조건을 사용한다. `version`, `revokedAt`, 상태 등 선행 조건이 쓰는
순간에도 유지되어야 하는 compare-and-set에는 이 경로를 사용하지 않는다.

`SessionRepository.rotateToken`은 `.where(id + expectedTokenVersion + revokedAt IS NULL)`의
`.updateAll(patch)` 반환 행을 사용한다. 조건이 실제 UPDATE에 남으므로 같은 버전의 동시
요청은 정확히 하나만 성공하고 나머지는 `null`로 변환한다. 패밀리 폐기는
`.select("id").updateAll(patch)`로 실제 변경한 ID만 받아 캐시를 무효화한다. PK 단건 수정까지
기계적으로 바꾸지 않고, 반환 값과 not-found 의미를 port 계약에 맞춘다.

이 차이는 실제 PostgreSQL에서 row lock으로 두 UPDATE를 대기시켜 검증했다. Unit에서
조건 객체를 확인하는 것으로 경쟁 안전성을 증명하지 않는다. 공급자 버전 변경 시에도 같은
Integration을 유지한다. 다른 Context의 조건부 쓰기는 각 단계에서 별도로 검증한다.

## 트랜잭션과 오류

application은 `UNIT_OF_WORK.run(async () => ...)`에서 경계를 선언한다. `Prisma8TransactionalAdapter`가 native `db.transaction`을 CLS에 연결한다. 중첩 Required 전파는 동일한 transaction을 재사용하고 rollback 시 after-commit 작업을 실행하지 않는다. cache/event/queue의 기존 commit 뒤 의미를 유지한다.

transaction과 fallback runtime은 원본 인스턴스를 보존해 prepared query가 사용하는 공식 runtime bridge를 유지한다. pg-boss는 `nativeJobDatabase`의 공식 `Db.executeSql` 연결로 활성 native transaction에 enqueue/cancel을 참여시킨다. UUID 배열과 scalar 값을 codec으로 바인딩하며 별도 connection으로 우회하지 않는다.

native SQL 오류의 `kind`/`sqlState`를 읽는다. `23505`는 unique, `23503`은 foreign key, `40001`/`40P01`은 필요한 원자적 작업에서만 재시도한다. native 단건 조회·수정의 `null`은 port의 기존 not-found 의미에 맞춰 처리한다. 공개 오류 코드와 status는 변경하지 않는다.

## 기존 DB와 새 DB 배포

`scripts/migrate.sh`는 API DB와 pg-boss DB URL을 DDL 전에 검증한다. 원격 배포는 명시적인 `AIDO_ALLOW_REMOTE_DB=1`을 사용한다.

새 DB는 empty → baseline(댓글 익명화용 잠긴 시스템 작성자 포함) → native unique constraint·시간 codec graph를 적용한다. 계약 marker가 없는 기존 DB는 `User` 테이블 존재 여부를 확인하고 **시스템 작성자 데이터 불변식과 baseline schema 검증에 성공한 경우에만** `db sign --contract <baseline hash> --no-advance-ref`로 등록한다. marker가 있는 DB는 재등록하지 않는다. 이미 target marker인 DB는 migration 전에 `db verify`를 실행하고, graph 적용 뒤에도 실제 스키마와 marker를 검증한다. `db migrate`의 no-op 성공만으로 drift가 없다고 판단하지 않는다. 검증 실패 시 API 배포를 중단한다.

unique 전환은 기존 index를 `ADD CONSTRAINT ... UNIQUE USING INDEX`로 재사용한다. 데이터·물리 이름·index identity를 보존한다. 메타데이터 변경에는 짧은 exclusive lock이 필요하다. 배포는 `PGOPTIONS`로 DDL lock 대기를 5초로 제한하며 실패 시 native migration transaction 전체가 rollback된다. lock을 확보할 수 있는 시점에 재실행한다. 기존 설치의 unmanaged 이력 테이블은 데이터 보존을 위해 건드리지 않으며 새 DB에 생성하지 않는다. 운영 DB의 이력을 삭제하거나 검증을 우회하지 않는다.

API production 이미지에는 ORM runtime만 포함한다. CLI·계약 source·graph와 pg-boss migration 도구는 별도 `migrate` 이미지에 포함한다.

## 검증과 성능

native PostgreSQL integration, 전체 API E2E, OpenAPI snapshot, 배포 클라이언트 fingerprint를 함께 검증한다. 쿼리 파라미터 객체만 mock해 SQL과 transaction 의미를 검증했다고 판단하지 않는다. 수동 `test:performance`는 동일 데이터와 pool에서 기존 8쿼리 집계 방식과 준비된 ORM 5쿼리를 교차 측정하며 CI에 포함하지 않는다.

공식 근거: [runtime](https://github.com/prisma/orm/blob/v8.0.0-rc.14/skills/prisma-8/references/runtime.md), [PostgreSQL queries](https://github.com/prisma/orm/blob/v8.0.0-rc.14/skills/prisma-8/references/queries-postgres.md), [migrations](https://github.com/prisma/orm/blob/v8.0.0-rc.14/skills/prisma-8/references/migrations.md).
