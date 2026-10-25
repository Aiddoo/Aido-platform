# Prisma와 PostgreSQL

DB adapter를 수정할 때는 아래 native API·codec·transaction 경계를, schema 또는 rollout을 바꿀 때는 graph·배포 절차를 참고한다. 모든 DB 관련 작업에서 migration을 새로 만들 필요는 없다.

## 정본과 실행

ORM은 `@prisma/orm-postgres@8.0.0-rc.20`, CLI는 `prisma@8.0.0-rc.27`(내부 `@prisma/orm-toolchain@8.0.0-rc.20`), CLI engine은 `0.9.0`이다. CLI와 ORM의 RC 번호는 따로 증가하므로 CLI가 쓰는 orm-toolchain과 ORM 버전을 같은 RC로 맞춘다. RC 사이 업그레이드는 설치된 `node_modules/@prisma/orm-postgres/skills/prisma-8/upgrading/app/upgrades/<from>-to-<to>/`의 공식 레시피와 스크립트를 순서대로 적용한다. 스크립트는 `pnpm exec tsx <스크립트>`로 실행하고, `.mjs`는 pnpm symlink 때문에 실경로(`realpath`)로 실행해야 main이 동작한다.

| 항목           | 경로/명령                                                        |
| -------------- | ---------------------------------------------------------------- |
| 계약·설정      | `src/prisma/contract.prisma`, `prisma.config.ts`                 |
| 생성 결과      | `src/generated/prisma8/contract.d.ts`, `contract.json`           |
| Graph·snapshot | `prisma/migrations8/app/`, `prisma/migrations8/snapshots/`       |
| 생성           | `pnpm --filter @aido/server db:generate`                         |
| 계획           | `pnpm --filter @aido/server db:plan --name <name> --from <hash>` |
| 배포·검증      | `pnpm --filter @aido/server db:deploy`, `db:verify`              |

Emit에는 DB 연결/DDL이 필요 없다. 계약 변경은 emit→명시한 이전 hash의 plan→생성 migration 검토 순서로 처리한다. CLI 출력은 engine 0.9.0부터 pipe에서도 JSON이 아니므로 출력을 파싱하는 스크립트는 `--json`을 붙인다(`migrate.sh`의 `migration status --json`). `migration.ts`의 수정은 `node prisma/migrations8/app/<dir>/migration.ts --config prisma.config.ts`로 self-emit한다. 적용된 graph·snapshot과 generated JSON을 손으로 고치지 않는다. codec만 바꿔 물리 schema가 같아도 0-operation edge로 계약 전환을 기록한다.

## 읽기·쓰기와 transaction

Repository는 `TransactionHost<Prisma8TransactionalAdapter>.tx`를 읽는다. 연결 풀은 `createPostgresPoolConfig`로 세션 `TimeZone=UTC`를 고정해 `now()` 기본값과 raw SQL 비교가 서버·프로세스 시간대에 흔들리지 않는다. transaction 밖의 fallback은 `db.runtime()`에 client의 `orm`·`sql`·`raw`·`toSql`을 붙인 객체다. client 객체 자체는 ORM 호출과 prepared statement가 요구하는 runtime activity source가 없어(`ORM.ACTIVITY_SOURCE_MISSING`) fallback으로 쓰지 않는다. statement는 client의 `prepare`로 한 번 준비하고 CLS 문맥에서는 실행만 한다. Application은 `UNIT_OF_WORK.run`으로 경계를 정한다. Required 중첩 전파는 같은 transaction을 사용하며 rollback된 after-commit 작업은 실행하지 않는다. pg-boss enqueue/cancel도 native bridge를 통해 활성 transaction에 참여한다.

관계·집계는 필요한 projection으로 ORM을 사용한다. Raw SQL은 원자적 claim/counter/batch 조건 갱신 등 한 SQL의 원자성이 필요한 곳에 둔다. 값은 바인딩하고 반환 column codec을 선언한다. `database-records`의 encode/decode와 `database-values`를 통해 Date·문자열 경계를 변환한다. rc.19부터 `TimestampString` codec은 Date를 거부하고(`RUNTIME.ENCODE_FAILED`) `@onCreate/@onUpdate(now)` 생성기가 UTC 텍스트를 쓰므로, 예전 UTC 보정 middleware는 없다. 값을 쓸 때는 항상 `databaseTimestamp`로 텍스트를 만든다. SQL 관찰이 필요한 테스트는 activity hook(`beforeEncode`/`activityEnded`) 기반 `test/setup/statement-observer.ts`를 쓴다. null은 지우기, undefined는 변경 생략이며 JSON 속 날짜처럼 보이는 문자열은 그대로 둔다.

rc.20의 단건 `.where(predicate).update()`도 `first()`가 고른 행의 PK로 UPDATE한다(`updateFirstGraph`: 식별자 SELECT 후 같은 행 UPDATE). 따라서 predicate 전체가 쓰는 순간에도 유지되는 CAS가 아니다. 회전 버전·상태 fence에는 predicate가 실제 UPDATE에 남는 `updateAll`/조건부 native SQL과 반환 행을 사용한다. PK 단건 수정까지 일괄 변경하지 않는다. 잠금·CAS·rollback은 실제 PostgreSQL fixture로 확인하며 mock query 인자로 경쟁 안전성을 주장하지 않는다.

## ORM 전환 기준과 유지하는 raw SQL (rc.20)

rc.17부터 ORM collection의 `forUpdate()`/`forNoKeyUpdate()`(`{ skipLocked }`, `{ nowait }`)와 SQL builder lock, rc.18 `whereUnique`/`firstOrThrow`를 쓸 수 있다. 행 잠금만 하는 조회, 같은 값으로 바꾸는 조건부 UPDATE 펜스(`updateAll`/`updateAndCount`는 술어를 UPDATE의 WHERE에 남긴다), 다중 INSERT(`createAll`은 RETURNING, `createAndCount`는 count), 문자열 패턴(`ilike`)은 ORM으로 쓴다. ORM lock은 mutation terminal과 함께 쓸 수 없고(`ORM.LOCK_INCOMPATIBLE`), `ScalarUpdateInput`은 리터럴 값만 받으며 증감 연산자가 없다. 아래는 그 한계 때문에 의도적으로 남긴 raw SQL이다.

| 유형                      | 위치                                                                                                                                                                                         | 유지 이유                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 원자 claim                | push outbox·lifecycle `claim*`, retention `claimOutboxes`·`recoverStale*`                                                                                                                    | `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING` 한 문장이 잠금과 갱신을 함께 한다. ORM lock은 mutation과 결합할 수 없다 |
| 행마다 다른 값의 배치 CAS | lifecycle `markRateLimitReserved`·`finalize*`·`release`, `PrismaTodoRepository.reorderItems`, `PremiumGrant.saveAll`                                                                         | `UPDATE … FROM (VALUES …)`. `updateAll`은 모든 행에 같은 값을 쓴다                                                                         |
| 자기 열 참조 갱신         | lifecycle 종료 outbox(`COALESCE("publishedAt", now)`), 댓글 정리 묘비(`COALESCE("deletedAt", now)`), 카운터(`col + $n`: verification·todo·memo·category·follow·comment·초대 보상 `attempts`) | ORM update 입력은 리터럴만 받고 증감 연산자가 없다                                                                                         |
| 행마다 생성 값            | 댓글 정리의 작성자 이전(`gen_random_uuid()`)                                                                                                                                                 | `(authorId, clientRequestId)` unique를 지키려면 행마다 새 값이 필요하다                                                                    |
| 관계 없는 테이블 EXISTS   | retention `deferOutbox`·`reopenUnclaimedDispatch`·`markRateLimitReserved`, `PremiumGrant.findUserIdsToReconcile`(유효한 Subscription EXISTS·NOT EXISTS, 진행 중 기간 NOT EXISTS)             | `RetentionPushOutbox`↔`PushDispatch`가 contract 관계가 아니어서 relation filter를 쓸 수 없다                                               |
| 열끼리 크기 비교          | `PremiumGrant.lockEndingNotices`(`next.endsAt > grant.endsAt`, `store.expiresAt >= grant.endsAt`, `(endsAt, id)` keyset + `SKIP LOCKED`)                                                     | ORM의 `gt`/`gte`는 값만 받고 다른 열을 받지 않는다(`eq`/`neq`만 같은 codec 열 허용)                                                        |
| JSON 경로 술어            | `deleteNotificationsByActorId`(`metadata ->> 'senderId'`)                                                                                                                                    | ORM에 jsonb 경로 연산자가 없고, expression index와 같은 식이어야 한다                                                                      |
| 재귀·분석·다중 테이블 CTE | 댓글 대화 트리, 성장 지표, 사용자 검색 순위, 댓글 수 재계산, lifecycle 정산                                                                                                                  | ORM이 재귀 CTE·윈도·임의 JOIN 갱신을 표현하지 않는다                                                                                       |
| 트랜잭션 제어             | SAVEPOINT(CLS 중첩), `pg_advisory_xact_lock`, SERIALIZABLE, `SELECT 1` health, pg-boss SQL bridge                                                                                            | ORM 바깥 기능이다                                                                                                                          |

bulk upsert는 rc.20에도 없다(`createAll`의 `onConflict`는 `'skip'`뿐). `WeeklyAchievement.upsertMany`는 같은 UoW 안의 ORM upsert를 유지한다. raw `ON CONFLICT DO UPDATE`는 같은 키가 한 입력에 두 번 오면 오류가 나서 마지막 값 우선 의미가 바뀐다.

## Graph 배포와 롤백

`db:deploy`는 API/pg-boss URL guard→pg-boss migrate→application graph→`db verify`를 실행한다. 원격 DB는 기본 거부하며 의도한 배포 환경에서만 `AIDO_ALLOW_REMOTE_DB=1`을 쓴다. DDL lock 대기는 5초다.

빈 DB는 baseline부터 적용한다. marker 없는 기존 DB는 `User` 존재와 잠긴 시스템 댓글 작성자 불변식을 확인하고 baseline schema 검증에 성공한 경우에만 `db sign --contract <baseline> --no-advance-ref`로 등록한다. 기존 marker를 다시 sign하거나 unmanaged 이력을 지우지 않는다. 이미 target marker인 DB도 migrate의 no-op 전에 실제 schema를 검증하므로 drift는 배포를 차단한다.

현재 graph의 마지막 edge는 `20261025T1920_friend_safety`(`7b8526bf…`→`c1bc913538dc23341da824490c0b696811c382ea9969e77212c0b003b70e5533`)로, 새 native enum 3개(`UserReportReason`·`UserReportStatus`·`UserReportTargetType`)와 새 테이블 `UserBlock`(`blockerId`·`blockedId` unique, 역방향 `(blockedId, blockerId)`·목록 `(blockerId, createdAt, id)` index)·`UserReport`(신고자·대상 사용자 FK, 중복·하루 한도 조회 index)만 추가한다. 두 FK는 사용자 삭제 때 `Cascade`다. 기존 테이블·열은 바뀌지 않아 구 API 이미지로 롤백해도 새 테이블만 남는다. 그 앞 edge `20261025T1816_ai_report_content_source`(`2d0bd9f2…`→`7b8526bf…`)는 nullable `AiReport.contentSource VARCHAR(16)`·`promptVersion VARCHAR(40)` additive 2개다. 기존 행은 null이며 리포트 생성 경로만 값을 쓴다. 그 앞 edge는 `20261025T1729_invite_foundation`(`65d810f7…`→`2d0bd9f2…`)다. 초대·보상 원장·프리미엄 보상 기간·리소스 보너스 테이블 7개와 enum, `NotificationType` 값 3개(`INVITE_JOINED`·`INVITE_REWARDED`·`PREMIUM_GRANT_ENDING`)를 추가하는 additive 연산 44개다. `InviteRedemption`은 수락할 때 고정한 `timezone`과 초대한 사람 보상 자격 `inviterRewardEligible`을 함께 만든다. 배포 전이라 계약 변경은 새 edge 대신 같은 이름으로 `db:plan`을 다시 실행해 이 edge에 합쳤다(TRANSFER가 행을 받은 사용자에게 옮기게 되면서 쓰이지 않게 된 `Subscription.transferredAt`도 이 방식으로 뺐다). 그 앞 edge는 `20261023T0948_prisma8_rc20_contract_alignment`다. `4ccdcd5a…`→`65d810f74acf51dc46d4ffa10564516809ad487555fff459995e1dee14e7695a`, DB 연산 0개로 rc.17의 FK backing index 기록·rc.18 `sql` literal·rc.19 문자열 timestamp 생성기 등 계약 표현 변경만 기록한다. 그 앞 edge `20261007T1840_push_receipt_token_fingerprint`(`f2857cfc…`→`4ccdcd5a…`)는 nullable `PushDeliveryAttempt.tokenFingerprint VARCHAR(64)` additive 1개다.

rc.15·rc.19 레시피 스크립트가 과거 snapshot을 새 형식으로 다시 쓰면서 모든 storage hash와 적용된 migration의 `migrationHash`가 바뀌었다(예: `5eefdf63…`→`4ccdcd5a…`, `d80a48c1…`→`f2857cfc…`, `3b9e2226…`→`242a04c5…`). 물리 schema는 그대로지만 기존 DB marker는 옛 hash를 가리켜 `db migrate`가 `MIGRATION.MARKER_MISMATCH`로 거부한다. 새 이미지 배포 전에 각 DB에서 한 번 `prisma db sign --contract 4ccdcd5a92f1c8b30bb308ef451fd1c60a1a9582aef001c9cd3cae82c5e0485f --no-advance-ref`로 직전 계약에 재서명한 뒤 `db:deploy`가 0-operation edge를 적용하게 한다. `db sign`은 실제 schema 검증에 성공해야만 marker를 바꾼다. `migration status`는 옛 `migrationHash`로 기록된 과거 migration을 applied로 표시하지 않을 수 있으나 `db migrate`는 재실행하지 않는다(레시피 명시).

이미지 롤백은 DB graph·데이터를 되돌리지 않는다. deployment script는 migrate를 재실행하지 않고 이전 API만 복구한다. 새 nullable 열은 남으며 기존 client CRUD 호환 검증과 운영 전체 롤백 보장은 구분한다. 이전 API에서는 새 receipt 회전 보호가 사라진다. Graph 역행·drop·재서명으로 이미지 롤백을 흉내 내지 않는다.

운영 순서·장애 대응은 [DEPLOYMENT.md](../DEPLOYMENT.md), 역사적 검증/성능 범위는 [prisma8-verification.md](../docs/prisma8-verification.md)에 있다. 공식 고정 버전 근거: [runtime](https://github.com/prisma/orm/blob/v8.0.0-rc.20/skills/prisma-8/references/runtime.md), [queries](https://github.com/prisma/orm/blob/v8.0.0-rc.20/skills/prisma-8/references/queries-postgres.md), [migrations](https://github.com/prisma/orm/blob/v8.0.0-rc.20/skills/prisma-8/references/migrations.md), [rc.15~rc.20 릴리스](https://github.com/prisma/orm/releases).
