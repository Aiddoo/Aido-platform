# Prisma와 PostgreSQL

DB adapter를 수정할 때는 아래 native API·codec·transaction 경계를, schema 또는 rollout을 바꿀 때는 graph·배포 절차를 참고한다. 모든 DB 관련 작업에서 migration을 새로 만들 필요는 없다.

## 정본과 실행

ORM은 `@prisma/orm-postgres@8.0.0-rc.14`, CLI는 `prisma@8.0.0-rc.20`, CLI engine은 `0.6.2`다. 서로 독립적인 버전이며 ORM/CLI는 RC다.

| 항목           | 경로/명령                                                        |
| -------------- | ---------------------------------------------------------------- |
| 계약·설정      | `src/prisma/contract.prisma`, `prisma.config.ts`                 |
| 생성 결과      | `src/generated/prisma8/contract.d.ts`, `contract.json`           |
| Graph·snapshot | `prisma/migrations8/app/`, `prisma/migrations8/snapshots/`       |
| 생성           | `pnpm --filter @aido/server db:generate`                         |
| 계획           | `pnpm --filter @aido/server db:plan --name <name> --from <hash>` |
| 배포·검증      | `pnpm --filter @aido/server db:deploy`, `db:verify`              |

Emit에는 DB 연결/DDL이 필요 없다. 계약 변경은 emit→명시한 이전 hash의 plan→생성 migration 검토 순서로 처리한다. `migration.ts`의 수정은 `node prisma/migrations8/app/<dir>/migration.ts --config prisma.config.ts`로 self-emit한다. 적용된 graph·snapshot과 generated JSON을 손으로 고치지 않는다. codec만 바꿔 물리 schema가 같아도 0-operation edge로 계약 전환을 기록한다.

## 읽기·쓰기와 transaction

Repository는 `TransactionHost<Prisma8TransactionalAdapter>.tx`를 읽는다. Application은 `UNIT_OF_WORK.run`으로 경계를 정한다. Required 중첩 전파는 같은 transaction을 사용하며 rollback된 after-commit 작업은 실행하지 않는다. pg-boss enqueue/cancel도 native bridge를 통해 활성 transaction에 참여한다.

관계·집계는 필요한 projection으로 ORM을 사용한다. Raw SQL은 원자적 claim/counter/batch 조건 갱신 등 한 SQL의 원자성이 필요한 곳에 둔다. 값은 바인딩하고 반환 column codec을 선언한다. `database-records`의 encode/decode와 `database-values`를 통해 Date·문자열 경계를 변환한다. null은 지우기, undefined는 변경 생략이며 JSON 속 날짜처럼 보이는 문자열은 그대로 둔다.

현재 rc.14의 단건 `.where(predicate).update()`는 먼저 읽은 PK로 UPDATE하므로 predicate 전체가 쓰는 순간에도 유지되는 CAS가 아니다. 회전 버전·상태 fence에는 predicate가 실제 UPDATE에 남는 `updateAll`/조건부 native SQL과 반환 행을 사용한다. PK 단건 수정까지 일괄 변경하지 않는다. 잠금·CAS·rollback은 실제 PostgreSQL fixture로 확인하며 mock query 인자로 경쟁 안전성을 주장하지 않는다.

## Graph 배포와 롤백

`db:deploy`는 API/pg-boss URL guard→pg-boss migrate→application graph→`db verify`를 실행한다. 원격 DB는 기본 거부하며 의도한 배포 환경에서만 `AIDO_ALLOW_REMOTE_DB=1`을 쓴다. DDL lock 대기는 5초다.

빈 DB는 baseline부터 적용한다. marker 없는 기존 DB는 `User` 존재와 잠긴 시스템 댓글 작성자 불변식을 확인하고 baseline schema 검증에 성공한 경우에만 `db sign --contract <baseline> --no-advance-ref`로 등록한다. 기존 marker를 다시 sign하거나 unmanaged 이력을 지우지 않는다. 이미 target marker인 DB도 migrate의 no-op 전에 실제 schema를 검증하므로 drift는 배포를 차단한다.

현재 graph의 마지막 edge는 `20261007T1840_push_receipt_token_fingerprint`다. `d80a48c1…`→`5eefdf63886315410d0378bf753a05f415396e235f83795390bd693cec24dd95`, additive 1개로 nullable `PushDeliveryAttempt.tokenFingerprint VARCHAR(64)`를 추가한다. 기존 행은 null이고 무리한 backfill은 하지 않는다. 새 API의 INSERT가 이 열을 사용하므로 DDL 성공 후 API를 교체한다.

이미지 롤백은 DB graph·데이터를 되돌리지 않는다. deployment script는 migrate를 재실행하지 않고 이전 API만 복구한다. 새 nullable 열은 남으며 기존 client CRUD 호환 검증과 운영 전체 롤백 보장은 구분한다. 이전 API에서는 새 receipt 회전 보호가 사라진다. Graph 역행·drop·재서명으로 이미지 롤백을 흉내 내지 않는다.

운영 순서·장애 대응은 [DEPLOYMENT.md](../DEPLOYMENT.md), 역사적 검증/성능 범위는 [prisma8-verification.md](../docs/prisma8-verification.md)에 있다. 공식 고정 버전 근거: [runtime](https://github.com/prisma/orm/blob/v8.0.0-rc.14/skills/prisma-8/references/runtime.md), [queries](https://github.com/prisma/orm/blob/v8.0.0-rc.14/skills/prisma-8/references/queries-postgres.md), [migrations](https://github.com/prisma/orm/blob/v8.0.0-rc.14/skills/prisma-8/references/migrations.md).
