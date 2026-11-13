# billing 용어집

스토어 구독·보상 기간·프리미엄 판단·결제 안내를 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

billing은 slice 둘이다. `subscriptions`는 스토어 구독 체인과 공급자 웹훅·상태 대조·체험/갱신 안내를, `premium-grants`는 보상 기간과 프리미엄 판단·projection·보상 종료 안내를 소유한다. 두 slice가 쓰는 판단은 `billing/shared/domain`, 결제 안내 공통 포트와 묶음 발송은 `billing/shared/application`이다. 흐름과 운영 규칙은 [구독 결제 처리](../billing.md)에 있다.

| 용어               | 코드                                                                                          | 뜻                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 구독 체인          | `Subscription`(Aggregate), `SubscriptionId`                                                   | 스토어 구매 하나와 그 갱신을 잇는 행. 상태는 `ACTIVE`(자동 갱신)·`CANCELLED`(해지, 만료까지 이용)·`EXPIRED`다                                        |
| 체인 키            | `StoreSubscriptionId`(VO)                                                                     | 원 거래 ID. 갱신마다 바뀌는 거래 ID와 섞지 않는다. 없으면 `SUBSCRIPTION_1604`                                                                        |
| 스토어 구독 이벤트 | `StoreSubscriptionEvent`, `ApplyStoreSubscriptionEventUseCase`                                | 공급자 번역기가 원문에서 만든 공급자 중립 이벤트(시작·갱신·해지·환불·해지 철회·만료·결제 문제·상품 변경 예약·연장·이전·처리 안 함)                   |
| 처리 원장          | `SubscriptionEventReceipt`(Entity), `ProviderEventId`(VO)                                     | 반영한 (공급자, 이벤트 ID) 한 건. 구독 변경과 같은 트랜잭션이라 재전송된 웹훅을 한 번만 반영한다                                                     |
| 공급자             | `SubscriptionProvider`, `StoreSubscriptionStatusReaderPort`, `StoreCustomerConsolePort`       | 웹훅을 보내고 상태를 알려 주는 결제 중개자. 이름은 어댑터·`*.wire.ts`·설정·바인딩에만 쓴다                                                           |
| 스토어             | `SubscriptionStore`                                                                           | 실제 결제가 일어난 곳(App Store·Play·웹 결제 등). 공급자와 다르다                                                                                    |
| 결제 유예          | `gracePeriodEndsAt`, `enterBillingGrace`                                                      | 결제 실패 뒤 스토어가 결제를 다시 시도하는 동안 엔타이틀먼트를 유지하는 기간                                                                         |
| 웹훅 대기 유예     | `STORE_RENEWAL_GRACE_MS`                                                                      | 자동 갱신 체인이 만료 뒤에도 갱신·만료 웹훅을 기다리는 3시간. Access·Billing·SQL이 같은 값이다                                                       |
| 엔타이틀먼트 끝    | `storeEntitlementEndsAt`, `isStoreEntitlementValid`                                           | 체인이 프리미엄을 주는 마지막 시각. ACTIVE는 만료+3시간, CANCELLED는 만료, 결제 유예가 더 늦으면 그 끝                                               |
| 현재 체인          | `currentStoreChainOf`                                                                         | 유효한 체인 중 가장 늦게 시작한 것. `/me` 표시와 갱신 안내가 이 체인으로 요금제·갱신을 본다                                                          |
| 요금제             | `planTypeOfProduct`, `planType()`, `renewingPlanType()`                                       | 상품 ID(Play는 `:` 앞)로 정한 연간·월간. 다음 결제는 예약한 상품(`nextProductId`)이 있으면 그 상품이다                                               |
| 체험·체험 단계     | `isTrial()`, `classifySubscriptionLifecycle`, `periodTypeAfter`                               | 체험은 새 출처가 아니라 기간 유형 `TRIAL`이다. 단계(시작·해지·전환·종료)는 이벤트 종류와 기간 유형으로 판단해 운영 알림에만 싣는다                   |
| 체인 이전          | `transferTo`, `takeOverChains`                                                                | 체인 이벤트가 다른 사용자로 오면 그 행만, 이전 이벤트면 넘겨준 사용자의 행 전체를 받은 사용자에게 옮긴다                                             |
| 체인 이어받기      | `#adoptRenewedChain`(`billing.subscription.chain.adopted`)                                    | 행이 없는 체인의 갱신으로 행을 만든다(탈퇴로 지워진 계정의 구매를 새 계정이 복원)                                                                    |
| 상태 대조          | `ReconcileStoreSubscriptionsUseCase`, `reconcileWithStore`, `store-subscription-reconcile.v1` | 웹훅을 신호로 보고 1분 구간마다 공급자에게 다시 읽어 ACTIVE·CANCELLED 체인을 맞춘다. 고친 칸(`SubscriptionReconcileField`)이 있을 때만 다시 계산한다 |
| 보상 기간          | `PremiumGrant`(Aggregate), `PremiumGrantId`(VO), `GrantPremiumUseCase`                        | 서버가 주는 프리미엄 기간(초대 보상). 1 이상의 정수 일수이고 출처 키(`sourceKey`) 하나에 한 번만 저장한다. 같은 키면 `duplicate`                     |
| 쌓아 둔 기간       | `BANKED`, `bankedDays`                                                                        | 스토어나 진행 중인 기간이 있어 아직 시작하지 않은 보상. 그 뒤에 받은 순서대로 이어 붙는다                                                            |
| 끊기·남은 기간     | `splitAt`, `bankedRemainderSourceKey`(`rebank:{id}`)                                          | 스토어가 유효해지는 동안 진행 중이던 기간을 지금 끝내고 남은 길이(ms)를 새 BANKED 기간으로 다시 쌓는다                                               |
| 보상 취소          | `revoke`, `RevokePremiumGrantUseCase`                                                         | 잘못 준 보상을 지우지 않고 REVOKED로 남긴다. 끊고 남은 기간도 함께 취소한다(운영 전용)                                                               |
| 프리미엄 판단      | `resolvePremiumAccess`, `PremiumAccess`, `GetPremiumAccessUseCase`                            | 유효한 스토어 구독 또는 진행 중인 보상 기간 + 쌓아 둔 기간. 출처 `STORE`·`GRANT`·없음과 끝·지금 기간 끝·갱신·체험·요금제·쌓아 둔 일수                |
| 정리 계획          | `planPremiumReconciliation`, `planNewGrantStart`                                              | 끝난 기간 닫기·스토어 아래 다시 쌓기·끊기·쌓아 둔 기간 시작을 정하는 순수 판단                                                                       |
| 구독 projection    | `ProjectPremiumAccessUseCase`, `UserSubscriptionProjection`                                   | 판단 결과를 User 행(`subscriptionStatus`·`subscriptionExpiresAt`)에 남긴 값. 권한 판단은 이 값이 아니라 행 자체를 믿는다                             |
| 정리 sweep         | `SweepPremiumGrantsUseCase`, `premium-grant-sweep.v1`                                         | 10분마다 정리할 사용자와 만료 웹훅을 잃은 사용자(lapsed)를 다시 계산하고 세 안내를 차례로 돈다                                                       |
| 결제 안내          | `SweepBillingNoticesUseCase`, `BillingNotice`, `isNoticeable()`                               | 며칠 전 안내 묶음 발송. 후보는 트랜잭션 밖에서 읽고 현지 야간이면 미루며, 조건부 표시(`claim`)를 얻은 행만 같은 트랜잭션에 알림을 기록한다           |
| 체험 종료 안내     | `TrialEndingNotice`(Entity), `NotifyEndingTrialsUseCase`                                      | 체험이 끝나기 3일 안에 한 번. 시작할 때 이미 3일 안이었던 체험은 보내지 않는다                                                                       |
| 갱신 예정 안내     | `UpcomingRenewalNotice`(Entity), `NotifyUpcomingRenewalsUseCase`                              | 연간으로 자동 갱신될 현재 체인에 결제 7일 전 기간마다 한 번                                                                                          |
| 보상 종료 안내     | `PremiumGrantEndingNotice`(Entity), `NotifyEndingPremiumGrantsUseCase`                        | 뒤에 스토어 구독도 다른 보상도 이어지지 않는 마지막 보상 기간이 끝나기 하루 안에 한 번                                                               |
| 운영 알림 페이로드 | `SubscriptionEventPayload`(Read Model), `SubscriptionNoticeInput`                             | 반영한 이벤트의 웹훅 값과 반영 뒤 프리미엄 상태. 커밋 뒤 operations 결제 채널로 넘기고 앱 사용자 ID는 싣지 않는다                                    |
| 다른 Context의 문  | `PremiumAccessReaderPort`, `PremiumGranterPort`, `billing-subscriptions-entitlement.public`   | identity `/me`가 읽는 프리미엄 상태, social 초대 보상이 쓰는 지급, access·identity가 쓰는 엔타이틀먼트 끝 규칙                                       |

## 구독 체인 전이

웹훅 재전송·순서 뒤바뀜이 정상 경로라 이름 있는 오류를 쓰지 않는다. 같은 값이거나 지난 기간의 늦은 이벤트(이벤트 만료가 행 만료보다 이름)면 `false`이고, UseCase는 저장·알림을 건너뛴다(`billing.subscription.webhook.no-change`).

| 상태                 | 행동                                          | 다음                                                           | 같은 값·늦은 이벤트                                          |
| -------------------- | --------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| 없음                 | `Subscription.create`(시작·행 없는 체인 갱신) | `ACTIVE`                                                       | 이미 행이 있는 시작은 바꾸지 않는다                          |
| 아무 상태            | `renew`                                       | `ACTIVE`, 새 만료, 유예·해지 지움, 상품 적용                   | ACTIVE·같은 만료이거나 만료가 더 이르면 `false`              |
| `ACTIVE`·`CANCELLED` | `enterBillingGrace`                           | 그대로, 결제 유예 끝 기록                                      | 유예 없음·`EXPIRED`·지난 기간이면 `false`(알림은 보낸다)     |
| 아무 상태            | `cancel({ refunded: false })`                 | `CANCELLED`                                                    | 지난 기간·이미 결제로 넘어간 체인의 늦은 체험 해지면 `false` |
| 아무 상태            | `cancel({ refunded: true })`                  | `EXPIRED`, 유예 지움                                           | 기간과 관계없이 끝낸다                                       |
| 아무 상태            | `uncancel`                                    | `ACTIVE`, 해지 지움                                            | 지난 기간이면 `false`                                        |
| 아무 상태            | `expire`                                      | `EXPIRED`(유예 중이면 만료를 유예 끝까지)                      | 지난 기간이면 `false`                                        |
| 아무 상태            | `reserveProductChange`                        | 그대로, `nextProductId`                                        | 지난 기간이면 `false`                                        |
| 아무 상태            | `extend`                                      | `ACTIVE`, 새 만료                                              | 지난 기간이면 `false`                                        |
| 엔타이틀먼트 있음    | `reconcileWithStore`(접근 없음)               | `EXPIRED`, 만료를 지금으로 당김                                | 이미 끝났으면 고친 칸 `[]`                                   |
| 아무 상태            | `reconcileWithStore`(접근 있음)               | 자동 갱신이면 `ACTIVE` 아니면 `CANCELLED`, 만료·상품·체험 맞춤 | 같으면 고친 칸 `[]`                                          |
| 아무 상태            | `transferTo(userId)`                          | 소유자 바뀜                                                    | 이미 그 사용자면 `false`                                     |

## 보상 기간 전이

| 상태                   | 행동                                       | 다음                                                              | 다시·금지                                                           |
| ---------------------- | ------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| 없음                   | `PremiumGrant.create`(`planNewGrantStart`) | 스토어·진행 중 기간이 있으면 `BANKED`, 없으면 `ACTIVE`(지금 시작) | 일수가 1 이상 정수가 아니거나 출처 키가 1~128자가 아니면 `SYS_0002` |
| `BANKED`               | `activate(startsAt)`                       | `ACTIVE`, 끝 = 시작 + 길이                                        | 다른 상태면 `false`                                                 |
| `ACTIVE`(시작 전)      | `returnToBank`                             | `BANKED`, 시작·끝 지움                                            | 이미 시작했거나 다른 상태면 `false`                                 |
| `ACTIVE`(진행 중)      | `splitAt(now)`                             | `ENDED`(끝 = 지금) + 남은 길이의 새 `BANKED`                      | 시작 전·끝난 기간이면 `null`                                        |
| `ACTIVE`(끝 시각 지남) | `end`                                      | `ENDED`                                                           | 끝 시각 전이면 `false`                                              |
| `BANKED`·`ACTIVE`      | `revoke`                                   | `REVOKED`(진행 중이면 끝 = 지금)                                  | `ENDED`·`REVOKED`·끝 시각이 지난 ACTIVE면 `false`                   |

## 결제 안내 원장

세 안내는 작업 원장이다. 행 Entity는 읽기만 하고, 보냈다는 표시는 저장소의 조건부 묶음 갱신(`claim`)이 남겨 두 실행이 겹쳐도 한 번만 보낸다.

| 안내      | 후보(`listDue`)                                              | 표시(`claim`)                                            | 다시 고르는 때                   |
| --------- | ------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------- |
| 체험 종료 | 기간 유형 `TRIAL`인 ACTIVE·CANCELLED 체인이 3일 안에 끝남    | `trialEndingNotifiedAt`이 비었을 때만 채움               | 없음(체인마다 한 번)             |
| 갱신 예정 | 연간 상품으로 자동 갱신될 ACTIVE·NORMAL 체인이 7일 안에 갱신 | 읽은 만료와 같을 때 `renewalNoticeExpiresAt = expiresAt` | 갱신으로 만료가 바뀌면 다음 기간 |
| 보상 종료 | 뒤가 이어지지 않는 ACTIVE 보상 기간이 하루 안에 끝남         | `endingNotifiedAt`이 비었을 때만 채움                    | 없음(기간마다 한 번)             |
