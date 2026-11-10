# 유료 기능과 권한

권한·한도·플랜 숫자·만료 판단을 바꿀 때 읽는다. 결제 공급자 운영 결정은 [결제](billing.md)에 있다.

## 판단하는 곳

누구인가(주체 `tier`)와 어느 요금제의 값을 받는가(`plan`)를 나눈다. 주체는 FREE·PREMIUM(유효한 스토어 구독 또는 보상 기간)·ADMIN 셋이고 출시 앱 표시(관리자 라벨)에만 쓴다. 요금제는 `PLANS`(`free`·`premium`) 둘이고 `planOfTier`가 ADMIN을 `premium`으로 옮긴다. 기능·횟수·개수·공정 사용 상한·길이 상한·휴면 제외는 모두 요금제로만 정하므로 ADMIN은 프리미엄과 같은 기능·한도를 받고 무제한 경로가 없다. 결제 사실(`isPremium`)은 [paid-access.domain-service](../src/modules/access/entitlements/domain/paid-access.domain-service.ts)의 `hasPaidAccess`이고 ADMIN 역할을 반영하지 않는다. 플랜 숫자는 `@aido/api/vocabulary`의 `PLAN_CATALOG` 한 곳에만 두고(출시 앱이 읽는 `PREMIUM_FEATURES`는 그 부분집합), 판단은 [entitlement.domain-service](../src/modules/access/entitlements/domain/entitlement.domain-service.ts)의 `resolveAccessSubject`→`resolveFeatureEntitlement`/`resolveFeatureLimit`/`resolveQuotaLimit` 하나다. 무제한으로 보이는 프리미엄 quota에 `fairUse.premium`이 있으면 서버는 그 상한으로 막고(`resolveQuotaLimit`), 출시 앱 응답은 표시 한도(null)를 그대로 보여 준다. AI 사용자 일 비용 예산은 요금제와 무관하게 모두 같다.

| 질문                         | 쓰는 곳                                                                                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 이 기능을 쓸 수 있나·한도는  | `EntitlementReaderPort`의 `can`/`getFeatureLimit`(잠금 뒤 재확인은 `canInTx`/`getFeatureLimitInTx`), 전체는 `getEntitlements`(tier·plan·isPremium·features), 거부는 `assertEntitled`/`assertEntitledInTx`(기능별 기존 ErrorCode) |
| 여러 사용자를 SQL로 고를 때  | `access-entitlements.public`의 `premiumAccessCondition`/`freeAccessCondition`/`activeSubscriptionCondition`                                                                                                                      |
| 프리미엄 출처·기간 표시(/me) | `PremiumAccessReaderPort`(Billing). 권한 판단에는 쓰지 않는다                                                                                                                                                                    |
| 돈이 드는 횟수(AI·녹음 정리) | `QuotaLedgerPort`(`access-quotas.public`)의 `reserve`→`commit`/`refund`, 표시는 `read`가 주는 `featureQuota`. 남은 0을 미리 막을 때는 `@RequireQuota(meter)`                                                                     |

## 사용 횟수 원장

원장(`ReserveQuotaUseCase` 등, 공개 문은 `QuotaLedgerPort`)은 AI 호출 전에 사용자 행 잠금 UoW 안에서 최신 권한으로 집행 한도(`resolveQuotaLimit`)를 다시 읽고 카운터를 올린 뒤 `QuotaCharge`(RESERVED)를 남긴다. 결과를 주면 COMMITTED, 실패·빈 결과면 REFUNDED로 조건부 전이해 환불은 정확히 한 번이다. `Idempotency-Key`가 같으면 COMMITTED는 `isAlreadyCommitted`(차감 없음), 처리 중이면 AI_1314, 환불된 키는 같은 행에서 다시 차감한다. 기간은 KST 달력 월(`QuotaWindow`)이고, AI_PLAN은 출시 앱과 같은 `User.aiUsageCount`·`aiUsageResetAt`, 나머지 계량기는 `QuotaUsage`(조건부 upsert)를 센다. 한도 오류는 `details: { charged: false, featureQuota }`다. 소유 Context가 세는 한도(응원·콕 찌르기 일간, 친구·카테고리 개수)도 한도 오류에 같은 상세를 싣고, `featureQuota`는 `EntitlementReaderPort.getFeatureQuotaInTx`(센 사용량을 넘김)로 만든다. 소유 Context는 자기 작은 포트(`FriendLimitReaderPort`·`CheerLimitReaderPort`·`NudgeLimitReaderPort`·`TodoCategoryLimitReaderPort`)를 두고 모두 `readLimit`·`readLimitInTx`·`readFeatureQuotaInTx` 세 메서드로 access를 감싼다. 프로세스가 죽어 남은 RESERVED는 `quota-abandoned-refund.v1` 잡(10분 주기)이 이어받기 기준 시간이 지난 것만 돌려준다.

`@RequireQuota(meter)`(access quotas public)는 남은 횟수가 0이면 AI를 부르기 전에 같은 코드·`{ charged: false, featureQuota }`로 막는 선검사다. 실제 차감은 여전히 UseCase 잠금 트랜잭션 안의 예약 한 번이고, 라우트의 모듈은 `AccessQuotasModule`을 import한다.

## 유료 기능 추가

1. `@aido/api/vocabulary`의 `PLAN_CATALOG`(plan-catalog.constants.ts)에 kind(quota·resource·flag)와 free/premium 값을 추가한다. 출시 앱 /me가 아는 기능만 `PREMIUM_FEATURES`에 두고, 새 기능은 `PLAN_CATALOG`에만 더해 `GET /v1/entitlements`로 내보낸다. 앱만 막는 기능은 `clientOnly`.
2. 서버가 막는 flag면 [entitlements.errors](../src/modules/access/entitlements/application/entitlements.errors.ts)에 기존 ErrorCode를 연결하고 UseCase에서 `assertEntitled`를 호출한다. quota·resource는 `getFeatureLimit`로 한도를 읽고 사용량은 소유 Context가 센다.
3. `/me.entitlements` 계약(`premiumEntitlementsSchema`)에 키를 추가한다. 이전 앱은 모르는 키를 무시한다.
4. 사용량이 있는 quota는 `GetCurrentUser`에 `used`·`resetsAt`을 붙인다. 돈이 드는 횟수는 `QUOTA_METERS`에 계량기를 더하고(`QUOTA_METER_FEATURES`에 기능을 잇는다) 원장으로 센다. resource는 소유 Context가 한도 검사와 같은 개수를 읽는 포트(예: `FRIEND_COUNT_READER`·`TODO_CATEGORY_COUNT_READER`)를 내보내고 access의 `OwnedFeatureUsageReaderAdapter`가 모아 `GetEntitlementSnapshotUseCase`에 넘긴다.

## 받은 자리(grant)와 충전 확장 지점

초대 보상 등으로 받은 자리는 `FeatureGrant`(DB 테이블·enum 이름은 `ResourceBonus`·`ResourceType` 그대로)로 저장하고, 기능별 합계(`FeatureGrants`)를 `resolveFeatureLimit` 한 곳에서 요금제 한도에 더한다. 무제한(null) 한도는 무제한으로 두고, 0 이하 행은 reader와 도메인 둘 다 더하지 않는다. 지급은 1 이상의 정수만 받는다(`FeatureGrant.create`). 자리를 줄 수 있는 기능은 `@aido/api/vocabulary`의 `GRANTABLE_FEATURE_KEYS`(resource 기능만, DB enum `ResourceType`과 같은 튜플)이고, 기능을 더하면 enum 값을 추가하는 마이그레이션만 생긴다. 지금 자리는 만료되지 않는다.

나중에 횟수를 사서 채우는 충전(quota top-up)은 이 grant와 따로 둔다. 기간 창(KST 월·사용자 하루)에 묶인 지급이라 만료 시각이나 기간 키를 가진 지급 행을 더하고, `resolveQuotaLimit`의 집행 한도에 그 창의 합계를 더하는 한 곳만 고친다. 결제 확인은 billing이 하고 access는 `FeatureGranterPort`와 같은 모양의 문으로 지급만 받는다.

## 역할 변경

역할(USER·ADMIN)을 바꾸는 서버 경로는 없다(운영자가 DB에서 바꾼다). 잠금 안의 쓰기 판단(`canInTx`·`getFeatureLimitInTx`·원장 예약)과 `GET /v1/entitlements`는 캐시 없이 읽어 바로 새 역할을 따른다. 캐시를 읽는 판단(`can`·`getFeatureLimit`·`getEntitlements`·/me)은 권한 캐시(10분)가 남는 동안 이전 역할을 쓰므로, 역할을 바꾼 뒤에는 `EntitlementCacheInvalidatorPort.invalidateEntitlements(userId)`로 비우거나 TTL이 지나기를 기다린다. ADMIN 권한 가드는 access token의 role claim을 보므로 다시 로그인해야 바뀐다.

## 다운그레이드

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

## 포트와 진입점

다른 Context는 `entitlements/access-entitlements.public`(`AccessEntitlementsModule`·`EntitlementReaderPort`·`EntitlementCacheInvalidatorPort`·`FeatureGranterPort`·SQL 조건)과 `quotas/access-quotas.public`(`AccessQuotasModule`·`QuotaLedgerPort`)만 import하고 클래스 토큰으로 주입받는다. Symbol 토큰과 옛 진입점은 없다.
