# access 용어집

요금제 권한·기능 한도·차감 원장을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

누가 어느 요금제의 기능·한도를 받는지 판단하고, 돈이 드는 횟수를 원장으로 센다. 판단 규칙과 플랜 숫자는 [유료 기능과 권한](../entitlements.md)에 있다. 두 slice 이상이 쓰는 판단은 `access/shared/domain`, 형제 slice는 서로의 public으로만 읽는다.

| 용어                | 코드                                                                   | 뜻                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 권한 주체           | `AccessSubject`, `resolveAccessSubject`                                | 판단 시각의 `tier`(FREE·PREMIUM·ADMIN, 출시 앱 표시)와 `plan`(free·premium)과 결제 사실 `isPremium`                           |
| 요금제              | `Plan`, `planOfTier`                                                   | 기능 값을 정하는 `free`·`premium`. ADMIN은 premium이고 무제한 경로가 없다                                                     |
| 결제 사실           | `hasPaidAccess`, `resolvePaidAccessDeadline`                           | ACTIVE projection이 끝나는 시각 전인지. 스토어 구독은 웹훅 대기·결제 유예까지 잇는다. ADMIN 역할은 반영하지 않는다            |
| 기능 권한           | `FeatureEntitlement`, `resolveFeatureEntitlement`                      | 기능을 쓸 수 있는지(`allowed`)와 표시 한도(`limit`, null은 무제한). quota·resource는 한도가 0보다 크면 쓸 수 있다             |
| 집행 한도           | `resolveQuotaLimit`, `isFairUse`                                       | 서버가 실제로 막는 quota 한도. 무제한으로 보이는 프리미엄 quota는 `fairUse.premium`으로 막는다                                |
| 받은 자리           | `FeatureGrant`(Aggregate), `FeatureGrants`, `GrantFeatureUseCase`      | 초대 보상 등으로 기능 한도에 더한 자리. 1 이상의 정수이고 출처 키(`sourceKey`) 하나에 한 번만 저장한다. 같은 키면 `duplicate` |
| 권한 판단 문        | `EntitlementReaderPort`, `AccessReadConsistency`                       | 다른 Context가 묻는 `can`·`getFeatureLimit`(캐시)과 잠금 뒤 재확인 `canInTx`·`getFeatureLimitInTx`(캐시 없이 최신)            |
| 권한 캐시           | `EntitlementCachePort`, `EntitlementCacheInvalidatorPort`              | 사용자 권한 상태 10분 캐시. 끝나는 시각을 함께 담아 TTL 안에서도 넘기지 않고, 상태를 바꾼 쪽이 커밋 뒤 비운다                 |
| featureQuota        | `FeatureQuotaState`, `resolveFeatureQuota`, `FeatureQuotaDetails`      | 기능 하나의 한도·사용량·남은 수·초기화 시각·길이 상한. 한도 오류 details와 응답에 같은 모양으로 싣는다                        |
| 권한 현황           | `EntitlementUsageReadModel`, `GetEntitlementUsageUseCase`              | `GET /v1/entitlements`가 돌려주는 모든 기능의 featureQuota(`entitlement-usage` slice). 캐시 없이 최신 권한으로 계산한다       |
| 소유 Context 사용량 | `OwnedFeatureUsageReaderPort`                                          | access가 셀 수 없는 응원·콕 찌르기 오늘 사용량(X-Timezone 하루)과 친구·카테고리 개수. 그 Context의 한도 검사와 같은 값이다    |
| 횟수 원장           | `QuotaLedgerPort`                                                      | AI처럼 돈이 드는 기능의 공개 문. 호출 전 `reserve`, 결과를 주면 `commit`, 실패·빈 결과면 `refund`, 결과를 잃으면 `reopen`     |
| 차감                | `QuotaCharge`(Aggregate), `QuotaChargeId`                              | 고객 문의 때 설명하는 차감 한 건. 같은 Idempotency-Key 재요청은 같은 행을 잇고 시도(`attempt`)마다 1씩 는다                   |
| 예약                | `QuotaReservation`(Read Model), `ReserveQuotaUseCase`                  | 이번 시도의 차감을 가리키는 핸들(`chargeId`·`attempt`). `isAlreadyCommitted`면 이미 결과를 준 요청이라 차감하지 않았다        |
| 계량기              | `QuotaMeter`, `QUOTA_METER_FEATURES`                                   | 차감을 세는 단위. `AI_PLAN`은 AI_PARSE(할 일·메모 정리·빠른 계획), `VOICE_NOTE`는 녹음 정리                                   |
| 기간                | `QuotaWindow`(VO), `QuotaWindow.create(now)`                           | 사용량을 세는 KST 달력 월(`periodKey` `2026-M04`). 사용자 시간대와 무관한 출시 계약이다                                       |
| 사용량 카운터       | `QuotaUsageRepositoryPort`                                             | 기간 사용량. AI_PLAN은 출시 앱과 같은 `User.aiUsageCount`, 나머지는 `QuotaUsage`를 사용자 잠금 안에서 한도까지만 더하고 뺀다  |
| 한도 판단           | `QuotaAllowance`(VO)                                                   | 잠금 안 최신 권한으로 정한 계량기 기능 하나의 요금제·집행 한도·기간                                                           |
| 선검사              | `@RequireQuota(meter)`, `CheckQuotaRemainingUseCase`                   | 남은 횟수가 0이면 AI를 부르기 전에 같은 오류로 막는다. 실제 차감은 예약 한 번이다                                             |
| 멈춘 예약 정리      | `RefundAbandonedQuotaReservationsUseCase`, `quota-abandoned-refund.v1` | 10분마다 이어받기 기준(`QUOTA_RESERVATION_TAKEOVER_AFTER_MS`, 120초)이 지난 RESERVED를 돌려주고, 7일 지난 요청 해시를 지운다  |

받은 자리는 만든 뒤 바뀌지 않는다. 차감의 전이는 모두 "이번 시도가 아니거나 이미 다른 상태면 `false`"로 정한다. 늦게 도착한 이전 시도의 확정·환불이 정상 경로라 이름 있는 오류를 쓰지 않고, 저장도 읽은 상태·시도가 그대로일 때만 한다(`saveIfUnchanged`).

| 상태                   | 행동                                        | 다음                      | 같은 상태로 다시·금지                                               |
| ---------------------- | ------------------------------------------- | ------------------------- | ------------------------------------------------------------------- |
| 없음                   | `QuotaCharge.create`(`ReserveQuotaUseCase`) | `RESERVED`, attempt 1     | 한도에 닿으면 만들지 않고 `AI_1303`(AI_PARSE)·`AI_1313`(VOICE_NOTE) |
| `RESERVED`             | `commit({ attempt })`                       | `COMMITTED`               | 다른 시도·다른 상태면 `false`                                       |
| `RESERVED`             | `refund({ attempt, reason })`               | `REFUNDED`, 사용량 되돌림 | 다른 시도·다른 상태면 `false`(환불은 정확히 한 번)                  |
| `RESERVED`(120초 지남) | `takeOver`                                  | `RESERVED`, attempt+1     | 120초 전이면 `false`이고 같은 키 재요청은 `AI_1314`                 |
| `RESERVED`(120초 지남) | `refundAbandoned`                           | `REFUNDED`(`ABANDONED`)   | 120초 전·다른 상태면 `false`                                        |
| `REFUNDED`             | `reserveAgain`(같은 키 재요청)              | `RESERVED`, attempt+1     | 다른 상태면 `false`                                                 |
| `COMMITTED`            | `reopen`(결과를 잃은 재요청)                | `RESERVED`, attempt+1     | 다른 상태면 `false`이고 `reopen`은 `AI_1314`                        |
| 아무 상태              | 같은 키에 다른 작업·내용(`isSameRequest`)   | —                         | `AI_1318`, 차감하지 않는다                                          |
