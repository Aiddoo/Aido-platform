# 유료 기능과 권한

권한·한도·플랜 숫자·만료 판단을 바꿀 때 읽는다. 결제 공급자 운영 결정은 [결제](billing.md)에 있다.

## 판단하는 곳

권한 주체는 FREE·PREMIUM(유효한 스토어 구독 또는 보상 기간)·ADMIN(모든 기능 무제한) 셋이다. 플랜 숫자는 `@aido/api/vocabulary`의 `PLAN_CATALOG` 한 곳에만 두고(출시 앱이 읽는 `PREMIUM_FEATURES`는 그 부분집합), 무료·프리미엄 판단은 [paid-access.domain-service](../src/modules/access/entitlements/domain/paid-access.domain-service.ts)의 `hasPaidAccess`, 한도 판단은 [entitlement.domain-service](../src/modules/access/entitlements/domain/entitlement.domain-service.ts) 하나다. 역할(USER·ADMIN)의 출처는 identity이고, ADMIN이 무제한이라는 판단은 `isUnlimitedSubject` 한 곳이다(다른 Context도 access public으로 묻는다). 무제한으로 보이는 프리미엄 quota에 `fairUse.premium`이 있으면 서버는 그 상한으로 막고(`resolveQuotaLimit`), 출시 앱 응답은 표시 한도(null)를 그대로 보여 준다.

| 질문                         | 쓰는 곳                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 이 기능을 쓸 수 있나·한도는  | `EntitlementReaderPort`의 `can`/`getLimit`(잠금 뒤 재확인은 `canInTx`/`getLimitInTx`), 거부는 `assertEntitled`/`assertEntitledInTx`(기능별 기존 ErrorCode)   |
| 여러 사용자를 SQL로 고를 때  | `access-entitlements.public`의 `premiumAccessCondition`/`freeAccessCondition`/`activeSubscriptionCondition`                                                  |
| 프리미엄 출처·기간 표시(/me) | `PremiumAccessReaderPort`(Billing. 옛 Symbol `PREMIUM_ACCESS_READER`는 같은 인스턴스 별칭). 권한 판단에는 쓰지 않는다                                        |
| 돈이 드는 횟수(AI·녹음 정리) | `QuotaLedgerPort`(`access-quotas.public`)의 `reserve`→`commit`/`refund`, 표시는 `read`가 주는 `featureQuota`. 남은 0을 미리 막을 때는 `@RequireQuota(meter)` |

## 사용 횟수 원장

원장(`ReserveQuotaUseCase` 등, 공개 문은 `QuotaLedgerPort`)은 AI 호출 전에 사용자 행 잠금 UoW 안에서 최신 권한으로 집행 한도(`resolveQuotaLimit`)를 다시 읽고 카운터를 올린 뒤 `QuotaCharge`(RESERVED)를 남긴다. 결과를 주면 COMMITTED, 실패·빈 결과면 REFUNDED로 조건부 전이해 환불은 정확히 한 번이다. `Idempotency-Key`가 같으면 COMMITTED는 `isAlreadyCommitted`(차감 없음), 처리 중이면 AI_1314, 환불된 키는 같은 행에서 다시 차감한다. 기간은 KST 달력 월(`QuotaWindow`)이고, AI_PLAN은 출시 앱과 같은 `User.aiUsageCount`·`aiUsageResetAt`, 나머지 계량기는 `QuotaUsage`(조건부 upsert)를 센다. 한도 오류는 `details: { charged: false, featureQuota }`다. 소유 Context가 세는 한도(응원·콕 찌르기 일간, 친구·카테고리 개수)도 한도 오류에 같은 상세를 싣고, `featureQuota`는 `EntitlementReaderPort.readFeatureQuotaInTx`(센 사용량을 넘김)로 만든다. 프로세스가 죽어 남은 RESERVED는 `quota-abandoned-refund.v1` 잡(10분 주기)이 이어받기 기준 시간이 지난 것만 돌려준다.

`@RequireQuota(meter)`(access quotas public)는 남은 횟수가 0이면 AI를 부르기 전에 같은 코드·`{ charged: false, featureQuota }`로 막는 선검사다. 실제 차감은 여전히 UseCase 잠금 트랜잭션 안의 예약 한 번이고, 라우트의 모듈은 `AccessQuotasModule`을 import한다.

## 유료 기능 추가

1. `@aido/api/vocabulary`의 `PLAN_CATALOG`(plan-catalog.constants.ts)에 kind(quota·resource·flag)와 free/premium 값을 추가한다. 출시 앱 /me가 아는 기능만 `PREMIUM_FEATURES`에 두고, 새 기능은 `PLAN_CATALOG`에만 더해 `GET /v1/entitlements`로 내보낸다. 앱만 막는 기능은 `clientOnly`.
2. 서버가 막는 flag면 [entitlements.errors](../src/modules/access/entitlements/application/entitlements.errors.ts)에 기존 ErrorCode를 연결하고 UseCase에서 `assertEntitled`를 호출한다. quota·resource는 `getLimit`로 한도를 읽고 사용량은 소유 Context가 센다.
3. `/me.entitlements` 계약(`premiumEntitlementsSchema`)에 키를 추가한다. 이전 앱은 모르는 키를 무시한다.
4. 사용량이 있는 quota는 `GetCurrentUser`에 `used`·`resetsAt`을 붙인다. 돈이 드는 횟수는 `QUOTA_METERS`에 계량기를 더하고(`QUOTA_METER_FEATURES`에 기능을 잇는다) 원장으로 센다. resource는 소유 Context가 한도 검사와 같은 개수를 읽는 포트(예: `FRIEND_COUNT_READER`·`TODO_CATEGORY_COUNT_READER`)를 내보내고 access의 `OwnedFeatureUsageReaderAdapter`가 모아 `GetEntitlementSnapshotUseCase`에 넘긴다.

다운그레이드는 데이터를 지우지 않는다. 한도를 넘긴 카테고리·친구는 그대로 두고 새로 만들기만 막는다(`CreateTodoCategory`·`SendFriendRequest`의 `count >= limit`). 사용량은 창(일·월) 단위로 계속 세고 한도만 바뀌므로, 이번 달 무료 한도보다 많이 쓴 뒤 만료되면 다음 초기화까지 AI 할 일 만들기가 막힌다. 창 중간에 구독하면 바로 무제한으로 보인다(집행은 `fairUse.premium`).

## 만료 타임라인 (UTC instant)

| 시점                                        | 판단                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 보상 기간 `endsAt`                          | 이 시각부터 프리미엄 아님(24시간 = 1일, UTC 달력). 쌓아 둔 다음 기간은 앞 기간 끝에 빈틈 없이 이어진다                                      |
| 스토어 `expiresAt`(자동 갱신 중)            | 갱신 웹훅을 기다리며 3시간(`STORE_RENEWAL_GRACE_MS`)까지 프리미엄. 그 뒤 쌓아 둔 보상이 시작된다                                            |
| 스토어 `expiresAt`(취소함)                  | 이 시각에 끝난다                                                                                                                            |
| 스토어 결제 유예 `gracePeriodEndsAt`        | 결제 실패(BILLING_ISSUE) 뒤 스토어가 재시도하는 동안(최대 16·30일) 취소 상태여도 이 시각까지 프리미엄. 규칙은 `storeEntitlementEndsAt` 하나 |
| 경계 직후 요청                              | Access 캐시는 기한을 함께 저장해 TTL 안에서도 경계를 넘기지 않고, /me 프로필 캐시 TTL은 다음 경계까지로 줄인다                              |
| 정리 작업(`premium-grant-sweep`, 10분 주기) | 끝난 보상을 닫고, 만료 웹훅을 잃어 ACTIVE로 남은 projection을 다시 계산해 FREE로 저장한다. 그 전에도 판단은 위 규칙을 따른다                |

## 전환 중

access는 옮긴 Context다(`entitlements`·`quotas` slice). 아직 옮기지 않은 소비 Context가 쓰는 옛 Symbol 토큰(`ENTITLEMENT_READER`·`ENTITLEMENT_SUBSCRIPTION_INVALIDATOR`·`RESOURCE_BONUS_GRANTER`·`QUOTA_LEDGER`)과 옛 진입점(`access-entitlement.public`·`access-quota.public`·`access-entitlement-sql.public`)은 클래스 토큰·slice public을 가리키는 별칭이다. 소비 Context가 옮기면 지운다.
