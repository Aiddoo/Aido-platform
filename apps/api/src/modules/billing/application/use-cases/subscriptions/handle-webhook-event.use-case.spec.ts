import { SubscriptionEventBuilder } from "#test/builders/subscription-event.builder";
import {
  createSubscriptionFixture,
  createSubscriptionRecord,
  SUBSCRIPTION_EXPIRY,
  SUBSCRIPTION_TIME,
  SUBSCRIPTION_TRANSACTION_ID,
} from "#test/fixtures/subscription.fixture";

import { HandleWebhookEvent } from "./handle-webhook-event.use-case.js";

describe("HandleWebhookEvent", () => {
  let fixture: ReturnType<typeof createSubscriptionFixture>;
  let useCase: HandleWebhookEvent;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUBSCRIPTION_TIME);
    fixture = createSubscriptionFixture();
    useCase = new HandleWebhookEvent(fixture);
  });
  afterEach(() => vi.useRealTimers());

  function givenSubscription() {
    fixture = createSubscriptionFixture({ existing: true });
    useCase = new HandleWebhookEvent(fixture);
  }

  function payloadFor(builder: SubscriptionEventBuilder, eventId = "subscription-event") {
    return builder
      .withAppUserId(fixture.user.id)
      .withOriginalTransactionId(SUBSCRIPTION_TRANSACTION_ID)
      .withPurchasedAtMs(SUBSCRIPTION_TIME.getTime())
      .withExpirationAtMs(SUBSCRIPTION_EXPIRY.getTime())
      .withEventId(eventId)
      .build();
  }

  it.each([
    { name: "INITIAL_PURCHASE", builder: SubscriptionEventBuilder.initialPurchase },
    { name: "NON_RENEWING_PURCHASE", builder: SubscriptionEventBuilder.nonRenewingPurchase },
  ])(
    "$name 구매는 구독·사용자 상태와 정확한 기간을 저장하고 두 캐시를 제거한다",
    async ({ builder }) => {
      // Given
      const payload = payloadFor(builder().withPrice(4.99, "KRW", 6900));
      // When
      const response = await useCase.execute({ body: payload });
      // Then
      expect(response).toEqual({ received: true });
      expect(
        fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID),
      ).toMatchObject({
        userId: fixture.user.id,
        status: "ACTIVE",
        startedAt: SUBSCRIPTION_TIME,
        expiresAt: SUBSCRIPTION_EXPIRY,
        lastProcessedEventId: payload.event.id,
      });
      expect(fixture.subscriptionRepository.users.get(fixture.user.id)).toMatchObject({
        subscriptionStatus: "ACTIVE",
        subscriptionExpiresAt: SUBSCRIPTION_EXPIRY,
      });
      expect(fixture.cache.entitlements.has(fixture.user.id)).toBe(false);
      expect(fixture.cache.profiles.has(fixture.user.id)).toBe(false);
      expect(fixture.notifier.events).toEqual([
        expect.objectContaining({
          userId: fixture.user.id,
          eventType: payload.event.type,
          transactionId: SUBSCRIPTION_TRANSACTION_ID,
          purchasedAt: SUBSCRIPTION_TIME.toISOString(),
          expiresAt: SUBSCRIPTION_EXPIRY.toISOString(),
          priceUsd: 4.99,
          priceInPurchasedCurrency: 6900,
          purchasedCurrency: "KRW",
        }),
      ]);
      expect(fixture.receiptRepository.receipts.get("subscription-event")).toMatchObject({
        eventType: payload.event.type,
        processedAt: SUBSCRIPTION_TIME,
      });
      expect(fixture.webhookLock.heldKeys.size).toBe(0);
    },
  );

  it("취소 이벤트가 철회 뒤에 다시 도착해도 구독을 되돌리거나 알림을 중복하지 않는다", async () => {
    // Given
    givenSubscription();
    const cancellation = payloadFor(SubscriptionEventBuilder.cancellation(), "cancel-event");
    await useCase.execute({ body: cancellation });
    const uncancellation = payloadFor(SubscriptionEventBuilder.uncancellation(), "uncancel-event");
    await useCase.execute({ body: uncancellation });
    // When
    await useCase.execute({ body: cancellation });
    // Then
    expect(
      fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID),
    ).toMatchObject({ status: "ACTIVE", lastProcessedEventId: "uncancel-event" });
    expect(fixture.notifier.events.map((event) => event.eventType)).toEqual([
      "CANCELLATION",
      "UNCANCELLATION",
    ]);
    expect(fixture.receiptRepository.receipts.size).toBe(2);
  });

  it("이미 구매한 거래는 새로운 event ID로 재전송해도 기간과 캐시를 보존한다", async () => {
    // Given
    givenSubscription();
    const before = fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID);
    // When
    await useCase.execute({ body: payloadFor(SubscriptionEventBuilder.initialPurchase()) });
    // Then
    expect(fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID)).toEqual(
      before,
    );
    expect(fixture.notifier.events).toEqual([]);
    expect(fixture.cache.profiles.has(fixture.user.id)).toBe(true);
  });

  it("갱신하면 취소 시각을 제거하고 사용자와 구독 만료를 함께 연장한다", async () => {
    // Given
    fixture = createSubscriptionFixture({
      existing: true,
      subscription: { status: "CANCELLED", cancelledAt: SUBSCRIPTION_TIME },
    });
    useCase = new HandleWebhookEvent(fixture);
    const expiresAt = new Date("2026-04-10T12:00:00.000Z");
    const body = payloadFor(SubscriptionEventBuilder.renewal());
    body.event.expiration_at_ms = expiresAt.getTime();
    // When
    await useCase.execute({ body });
    // Then
    expect(
      fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID),
    ).toMatchObject({ status: "ACTIVE", expiresAt, cancelledAt: null });
    expect(fixture.subscriptionRepository.users.get(fixture.user.id)).toMatchObject({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: expiresAt,
    });
    expect(fixture.notifier.events).toHaveLength(1);
  });

  it("동일 만료 시각의 ACTIVE 갱신은 캐시와 알림을 변경하지 않는다", async () => {
    // Given
    givenSubscription();
    // When
    await useCase.execute({ body: payloadFor(SubscriptionEventBuilder.renewal()) });
    // Then
    expect(
      fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID)
        ?.lastProcessedEventId,
    ).toBeNull();
    expect(fixture.notifier.events).toEqual([]);
    expect(fixture.cache.entitlements.has(fixture.user.id)).toBe(true);
  });

  it.each([
    {
      name: "일반 취소",
      builder: SubscriptionEventBuilder.cancellation,
      status: "CANCELLED",
      userStatus: "ACTIVE",
      expiry: SUBSCRIPTION_EXPIRY,
    },
    {
      name: "환불",
      builder: SubscriptionEventBuilder.refundCancellation,
      status: "EXPIRED",
      userStatus: "FREE",
      expiry: null,
    },
  ])(
    "$name 후 저장 상태와 사용자 접근 권한을 반영한다",
    async ({ builder, status, userStatus, expiry }) => {
      // Given
      givenSubscription();
      // When
      await useCase.execute({ body: payloadFor(builder()) });
      // Then
      expect(
        fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID),
      ).toMatchObject({ status, cancelledAt: SUBSCRIPTION_TIME });
      expect(fixture.subscriptionRepository.users.get(fixture.user.id)).toMatchObject({
        subscriptionStatus: userStatus,
        subscriptionExpiresAt: expiry,
      });
    },
  );

  it("취소 이벤트의 만료가 누락되면 저장된 만료일로 접근 권한을 판단한다", async () => {
    // Given
    givenSubscription();
    const body = payloadFor(SubscriptionEventBuilder.cancellation());
    body.event.expiration_at_ms = null;
    // When
    await useCase.execute({ body });
    // Then
    expect(fixture.subscriptionRepository.users.get(fixture.user.id)).toMatchObject({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: SUBSCRIPTION_EXPIRY,
    });
    expect(fixture.notifier.events[0]).not.toHaveProperty(
      "expiresAt",
      SUBSCRIPTION_EXPIRY.toISOString(),
    );
  });

  it.each([
    { offset: -60_001, status: "CANCELLED" },
    { offset: -60_000, status: "CANCELLED" },
    { offset: -59_999, status: "ACTIVE" },
  ])(
    "일반 취소의 만료 grace 경계 $offset ms에서 상태 $status 를 보존한다",
    async ({ offset, status }) => {
      // Given
      givenSubscription();
      const body = payloadFor(SubscriptionEventBuilder.cancellation());
      body.event.expiration_at_ms = SUBSCRIPTION_TIME.getTime() + offset;
      // When
      await useCase.execute({ body });
      // Then
      expect(fixture.subscriptionRepository.users.get(fixture.user.id)?.subscriptionStatus).toBe(
        status,
      );
    },
  );

  it("취소 철회에서 선택 만료가 누락되면 기존 기간을 보존하면서 취소 시각을 제거한다", async () => {
    // Given
    fixture = createSubscriptionFixture({
      existing: true,
      subscription: { status: "CANCELLED", cancelledAt: SUBSCRIPTION_TIME },
    });
    useCase = new HandleWebhookEvent(fixture);
    const body = payloadFor(SubscriptionEventBuilder.uncancellation());
    body.event.expiration_at_ms = undefined;
    // When
    await useCase.execute({ body });
    // Then
    expect(
      fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID),
    ).toMatchObject({ status: "ACTIVE", expiresAt: SUBSCRIPTION_EXPIRY, cancelledAt: null });
    expect(
      fixture.subscriptionRepository.users.get(fixture.user.id)?.subscriptionExpiresAt,
    ).toEqual(SUBSCRIPTION_EXPIRY);
  });

  it("이전 기간의 만료 이벤트는 갱신된 구독과 warm 캐시를 보존한다", async () => {
    // Given
    givenSubscription();
    const body = payloadFor(SubscriptionEventBuilder.expiration());
    body.event.expiration_at_ms = SUBSCRIPTION_EXPIRY.getTime() - 1;
    // When
    await useCase.execute({ body });
    // Then
    expect(
      fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID)?.status,
    ).toBe("ACTIVE");
    expect(fixture.subscriptionRepository.users.get(fixture.user.id)?.subscriptionStatus).toBe(
      "ACTIVE",
    );
    expect(fixture.cache.entitlements.has(fixture.user.id)).toBe(true);
    expect(fixture.notifier.events).toEqual([]);
  });

  it.each([
    { name: "현재 기간", expiry: SUBSCRIPTION_EXPIRY.getTime() },
    { name: "만료 누락", expiry: null },
  ])("$name 만료는 무료 상태로 전환하고 사용자 만료를 null로 제거한다", async ({ expiry }) => {
    // Given
    givenSubscription();
    const body = payloadFor(SubscriptionEventBuilder.expiration());
    body.event.expiration_at_ms = expiry;
    // When
    await useCase.execute({ body });
    // Then
    expect(
      fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID)?.status,
    ).toBe("EXPIRED");
    expect(fixture.subscriptionRepository.users.get(fixture.user.id)).toMatchObject({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
    expect(fixture.cache.profiles.has(fixture.user.id)).toBe(false);
  });

  it.each([SubscriptionEventBuilder.productChange, SubscriptionEventBuilder.subscriptionExtended])(
    "상품 변경·연장에서 선택 만료가 누락되면 기존 기간을 보존한다",
    async (builder) => {
      // Given
      givenSubscription();
      const body = payloadFor(builder().withProductId("premium_yearly"));
      body.event.expiration_at_ms = undefined;
      // When
      await useCase.execute({ body });
      // Then
      expect(
        fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID),
      ).toMatchObject({ status: "ACTIVE", expiresAt: SUBSCRIPTION_EXPIRY });
      if (body.event.type === "PRODUCT_CHANGE")
        expect(
          fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID)?.productId,
        ).toBe("premium_yearly");
      expect(
        fixture.subscriptionRepository.users.get(fixture.user.id)?.subscriptionExpiresAt,
      ).toEqual(SUBSCRIPTION_EXPIRY);
    },
  );

  it("같은 BILLING_ISSUE 재전송은 구독을 유지하며 이벤트·결제 문제 알림을 한 번만 기록한다", async () => {
    // Given
    givenSubscription();
    const before = fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID);
    const body = payloadFor(SubscriptionEventBuilder.billingIssue());
    // When
    await useCase.execute({ body });
    await useCase.execute({ body });
    // Then
    expect(fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID)).toEqual(
      before,
    );
    expect(fixture.notifier.billingIssueUserIds).toEqual([fixture.user.id]);
    expect(fixture.notifier.events).toHaveLength(1);
  });

  it("같은 TRANSFER 이벤트는 기존 매핑과 권한을 유지하며 알림을 한 번만 기록한다", async () => {
    // Given
    givenSubscription();
    const before = fixture.subscriptionRepository.users.get(fixture.user.id);
    const body = payloadFor(SubscriptionEventBuilder.transfer());
    // When
    await useCase.execute({ body });
    await useCase.execute({ body });
    // Then
    expect(fixture.subscriptionRepository.users.get(fixture.user.id)).toEqual(before);
    expect(fixture.notifier.events).toHaveLength(1);
  });

  it.each([
    SubscriptionEventBuilder.test,
    SubscriptionEventBuilder.subscriberAlias,
    () => SubscriptionEventBuilder.customType("FUTURE_EVENT"),
  ])("무시·미래 이벤트는 저장 상태와 receipt·캐시·알림을 변경하지 않는다", async (builder) => {
    // Given
    givenSubscription();
    const before = fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID);
    // When
    expect(await useCase.execute({ body: payloadFor(builder()) })).toEqual({ received: true });
    // Then
    expect(fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID)).toEqual(
      before,
    );
    expect(fixture.receiptRepository.receipts.size).toBe(0);
    expect(fixture.notifier.events).toEqual([]);
    expect(fixture.cache.profiles.has(fixture.user.id)).toBe(true);
  });

  it.each([{}, { invalid: "body" }, null])(
    "검증할 수 없는 body는 사용자 상태와 실패 보고를 만들지 않고 승인한다",
    async (body) => {
      // Given
      // When
      expect(await useCase.execute({ body })).toEqual({ received: true });
      // Then
      expect(fixture.subscriptionRepository.subscriptions.size).toBe(0);
      expect(fixture.receiptRepository.receipts.size).toBe(0);
      expect(fixture.notifier.failures).toEqual([]);
      expect(fixture.webhookLock.heldKeys.size).toBe(0);
    },
  );

  it("사용자 lock 경합은 1605를 전파하며 구독·receipt·알림을 만들지 않는다", async () => {
    // Given
    const body = payloadFor(SubscriptionEventBuilder.initialPurchase());
    fixture.webhookLock.heldKeys.add(fixture.user.id);
    // When
    await expect(useCase.execute({ body })).rejects.toMatchObject({
      errorCode: "SUBSCRIPTION_1605",
    });
    // Then
    expect(fixture.subscriptionRepository.subscriptions.size).toBe(0);
    expect(fixture.receiptRepository.receipts.size).toBe(0);
    expect(fixture.notifier.failures).toEqual([]);
  });

  it("사용자가 없으면 1602를 보고하고 lock을 해제한 뒤 승인한다", async () => {
    // Given
    fixture.subscriptionRepository.users.clear();
    const body = payloadFor(SubscriptionEventBuilder.initialPurchase());
    // When
    expect(await useCase.execute({ body })).toEqual({ received: true });
    // Then
    expect(fixture.notifier.failures).toEqual([
      { error: expect.objectContaining({ errorCode: "SUBSCRIPTION_1602" }), payload: body },
    ]);
    expect(fixture.webhookLock.heldKeys.size).toBe(0);
    expect(fixture.subscriptionRepository.subscriptions.size).toBe(0);
  });

  it.each([
    { name: "구매 시각", patch: { purchased_at_ms: undefined } },
    { name: "만료 시각", patch: { expiration_at_ms: undefined } },
    { name: "0 구매 시각", patch: { purchased_at_ms: 0 } },
    { name: "0 만료 시각", patch: { expiration_at_ms: 0 } },
    { name: "거래 ID", patch: { transaction_id: undefined, original_transaction_id: undefined } },
  ])("필수 $name 누락은 1604를 보고하고 저장·캐시·알림 변경 없이 승인한다", async ({ patch }) => {
    // Given
    const body = payloadFor(SubscriptionEventBuilder.initialPurchase());
    Object.assign(body.event, patch);
    // When
    expect(await useCase.execute({ body })).toEqual({ received: true });
    // Then
    expect(fixture.notifier.failures[0]?.error).toMatchObject({ errorCode: "SUBSCRIPTION_1604" });
    expect(fixture.subscriptionRepository.subscriptions.size).toBe(0);
    expect(fixture.notifier.events).toEqual([]);
    expect(fixture.cache.entitlements.has(fixture.user.id)).toBe(true);
    expect(fixture.webhookLock.heldKeys.size).toBe(0);
  });

  it("거래가 없는 갱신은 실패 보고 후 승인하며 다음 요청의 lock 획득을 막지 않는다", async () => {
    // Given
    const body = payloadFor(SubscriptionEventBuilder.renewal());
    // When
    expect(await useCase.execute({ body })).toEqual({ received: true });
    // Then
    expect(fixture.notifier.failures[0]?.error).toMatchObject({ errorCode: "SUBSCRIPTION_1604" });
    const release = await fixture.webhookLock.acquire(fixture.user.id);
    expect(release).not.toBeNull();
    await release?.();
  });

  it.each([
    { name: "상품 변경", builder: SubscriptionEventBuilder.productChange },
    { name: "기간 연장", builder: SubscriptionEventBuilder.subscriptionExtended },
  ])("$name 이벤트는 전달된 만료를 사용자와 구독에 함께 저장한다", async ({ builder }) => {
    // Given
    givenSubscription();
    const expiresAt = new Date("2026-04-10T12:00:00.000Z");
    const body = payloadFor(builder());
    body.event.expiration_at_ms = expiresAt.getTime();
    // When
    await useCase.execute({ body });
    // Then
    expect(
      fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID)?.expiresAt,
    ).toEqual(expiresAt);
    expect(
      fixture.subscriptionRepository.users.get(fixture.user.id)?.subscriptionExpiresAt,
    ).toEqual(expiresAt);
    expect(fixture.notifier.events[0]?.expiresAt).toBe(expiresAt.toISOString());
  });

  it("프로필과 선택 metadata가 없어도 구매를 처리하고 가격 0을 보존한다", async () => {
    // Given
    fixture = createSubscriptionFixture({ profile: null });
    useCase = new HandleWebhookEvent(fixture);
    const body = payloadFor(SubscriptionEventBuilder.initialPurchase().withPrice(0, "KRW", 0));
    body.event.store = undefined;
    // When
    await useCase.execute({ body });
    // Then
    expect(fixture.subscriptionRepository.users.get(fixture.user.id)?.subscriptionStatus).toBe(
      "ACTIVE",
    );
    expect(fixture.notifier.events[0]).toMatchObject({
      priceUsd: 0,
      priceInPurchasedCurrency: 0,
      purchasedCurrency: "KRW",
    });
    expect(fixture.notifier.events[0]?.name).toBeUndefined();
    expect(fixture.notifier.events[0]?.store).toBeUndefined();
  });

  it.each([
    {
      name: "과거 체인 만료·다른 ACTIVE 체인",
      builder: SubscriptionEventBuilder.expiration,
      otherStatus: "ACTIVE",
      otherExpiry: new Date("2026-04-10T12:00:00.000Z"),
      expectedExpiry: SUBSCRIPTION_EXPIRY,
    },
    {
      name: "과거 체인 환불·다른 일반 CANCELLED 체인",
      builder: SubscriptionEventBuilder.refundCancellation,
      otherStatus: "CANCELLED",
      otherExpiry: new Date("2026-04-10T12:00:00.000Z"),
      expectedExpiry: SUBSCRIPTION_EXPIRY,
    },
    {
      name: "과거 체인 일반 취소·짧은 ACTIVE 체인",
      builder: SubscriptionEventBuilder.cancellation,
      otherStatus: "ACTIVE",
      otherExpiry: new Date("2026-02-20T12:00:00.000Z"),
      expectedExpiry: new Date("2026-02-20T12:00:00.000Z"),
    },
    {
      name: "과거 체인 환불·짧은 ACTIVE 체인",
      builder: SubscriptionEventBuilder.refundCancellation,
      otherStatus: "ACTIVE",
      otherExpiry: new Date("2026-02-20T12:00:00.000Z"),
      expectedExpiry: new Date("2026-02-20T12:00:00.000Z"),
    },
  ] satisfies Array<{
    name: string;
    builder: () => SubscriptionEventBuilder;
    otherStatus: "ACTIVE" | "CANCELLED";
    otherExpiry: Date;
    expectedExpiry: Date;
  }>)(
    "$name 처리 후 현재 유효 접근만 유지하고 사용자 만료를 과도하게 늘리지 않는다",
    async ({ builder, otherStatus, otherExpiry, expectedExpiry }) => {
      // Given
      const oldExpiry = new Date(SUBSCRIPTION_TIME.getTime() - 60_001);
      fixture = createSubscriptionFixture({
        existing: true,
        subscription: { expiresAt: oldExpiry },
        userSubscription: {
          subscriptionStatus: "ACTIVE",
          subscriptionExpiresAt: SUBSCRIPTION_EXPIRY,
        },
      });
      useCase = new HandleWebhookEvent(fixture);
      fixture.subscriptionRepository.subscriptions.set(
        "other-chain",
        createSubscriptionRecord(fixture.user.id, {
          id: 2,
          revenueCatId: "other-chain",
          status: otherStatus,
          expiresAt: otherExpiry,
        }),
      );
      fixture.subscriptionRepository.subscriptions.set(
        "shorter-chain",
        createSubscriptionRecord(fixture.user.id, {
          id: 3,
          revenueCatId: "shorter-chain",
          expiresAt: new Date(SUBSCRIPTION_TIME.getTime() + 1_000),
        }),
      );
      const body = payloadFor(builder());
      body.event.expiration_at_ms = oldExpiry.getTime();
      // When
      await useCase.execute({ body });
      // Then
      expect(fixture.subscriptionRepository.users.get(fixture.user.id)).toMatchObject({
        subscriptionStatus: "ACTIVE",
        subscriptionExpiresAt: expectedExpiry,
      });
      expect(fixture.subscriptionRepository.subscriptions.get("other-chain")).toMatchObject({
        status: otherStatus,
        expiresAt: otherExpiry,
      });
      expect(
        fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID)?.status,
      ).toBe(
        body.event.type === "CANCELLATION" && body.event.cancel_reason !== "CUSTOMER_SUPPORT"
          ? "CANCELLED"
          : "EXPIRED",
      );
      expect(fixture.cache.entitlements.has(fixture.user.id)).toBe(false);
      expect(fixture.notifier.events).toHaveLength(1);
    },
  );

  it.each([
    {
      name: "다른 사용자 체인",
      owner: "another-user",
      status: "ACTIVE",
      expiry: SUBSCRIPTION_EXPIRY,
    },
    { name: "이미 만료된 ACTIVE 체인", owner: null, status: "ACTIVE", expiry: SUBSCRIPTION_TIME },
    { name: "환불된 EXPIRED 체인", owner: null, status: "EXPIRED", expiry: SUBSCRIPTION_EXPIRY },
    {
      name: "만료 경계의 일반 CANCELLED 체인",
      owner: null,
      status: "CANCELLED",
      expiry: SUBSCRIPTION_TIME,
    },
  ] satisfies Array<{
    name: string;
    owner: string | null;
    status: "ACTIVE" | "EXPIRED" | "CANCELLED";
    expiry: Date;
  }>)("$name 은 만료된 사용자의 접근을 보호하지 않는다", async ({ owner, status, expiry }) => {
    // Given
    givenSubscription();
    fixture.subscriptionRepository.subscriptions.set(
      "ineligible-chain",
      createSubscriptionRecord(owner ?? fixture.user.id, {
        id: 2,
        revenueCatId: "ineligible-chain",
        status,
        expiresAt: expiry,
      }),
    );
    // When
    await useCase.execute({ body: payloadFor(SubscriptionEventBuilder.expiration()) });
    // Then
    expect(fixture.subscriptionRepository.users.get(fixture.user.id)).toMatchObject({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
    expect(fixture.subscriptionRepository.subscriptions.get("ineligible-chain")).toMatchObject({
      status,
      expiresAt: expiry,
    });
  });

  it.each([
    { status: "FREE", builder: SubscriptionEventBuilder.expiration },
    { status: "CANCELLED", builder: SubscriptionEventBuilder.refundCancellation },
  ] satisfies Array<{ status: "FREE" | "CANCELLED"; builder: () => SubscriptionEventBuilder }>)(
    "기존 $status 사용자는 다른 미래 체인이 있어도 자동 재활성화하지 않는다",
    async ({ status, builder }) => {
      // Given
      fixture = createSubscriptionFixture({
        existing: true,
        userSubscription: {
          subscriptionStatus: status,
          subscriptionExpiresAt: SUBSCRIPTION_EXPIRY,
        },
      });
      useCase = new HandleWebhookEvent(fixture);
      fixture.subscriptionRepository.subscriptions.set(
        "other-chain",
        createSubscriptionRecord(fixture.user.id, { id: 2, revenueCatId: "other-chain" }),
      );
      // When
      await useCase.execute({ body: payloadFor(builder()) });
      // Then
      expect(fixture.subscriptionRepository.users.get(fixture.user.id)).toMatchObject({
        subscriptionStatus: "FREE",
        subscriptionExpiresAt: null,
      });
      expect(fixture.subscriptionRepository.subscriptions.get("other-chain")?.status).toBe(
        "ACTIVE",
      );
    },
  );

  it("초기 조회 뒤 User lock에서 권한이 바뀌면 최신 무료 상태를 기준으로 판단한다", async () => {
    // Given
    givenSubscription();
    fixture.subscriptionRepository.subscriptions.set(
      "other-chain",
      createSubscriptionRecord(fixture.user.id, { id: 2, revenueCatId: "other-chain" }),
    );
    fixture.userMutationLock.lockById = async (userId) => {
      await fixture.subscriptionRepository.updateUserSubscriptionStatus(userId, {
        subscriptionStatus: "FREE",
        subscriptionExpiresAt: null,
      });
      return true;
    };
    // When
    await useCase.execute({ body: payloadFor(SubscriptionEventBuilder.expiration()) });
    // Then
    expect(fixture.subscriptionRepository.users.get(fixture.user.id)).toMatchObject({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
    expect(fixture.subscriptionRepository.subscriptions.get("other-chain")?.status).toBe("ACTIVE");
    expect(fixture.notifier.events).toHaveLength(1);
  });

  it("UnitOfWork가 완료되기 전에는 캐시·알림 효과를 실행하지 않는다", async () => {
    // Given
    const persisted = Promise.withResolvers<void>();
    const committed = Promise.withResolvers<void>();
    fixture.unitOfWork.run = async (work) => {
      const result = await work();
      persisted.resolve();
      await committed.promise;
      return result;
    };
    // When
    const pending = useCase.execute({
      body: payloadFor(SubscriptionEventBuilder.initialPurchase()),
    });
    await persisted.promise;
    // Then
    expect(fixture.cache.entitlements.has(fixture.user.id)).toBe(true);
    expect(fixture.notifier.events).toEqual([]);
    committed.resolve();
    await pending;
    expect(fixture.cache.entitlements.has(fixture.user.id)).toBe(false);
    expect(fixture.notifier.events).toHaveLength(1);
  });

  it("캐시 무효화 실패는 저장된 구매를 되돌리지 않고 실패 보고와 승인 응답을 유지한다", async () => {
    // Given
    vi.spyOn(fixture.cache, "invalidate").mockRejectedValueOnce(new Error("캐시 장애"));
    // When
    expect(
      await useCase.execute({ body: payloadFor(SubscriptionEventBuilder.initialPurchase()) }),
    ).toEqual({ received: true });
    // Then
    expect(
      fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID)?.status,
    ).toBe("ACTIVE");
    expect(fixture.subscriptionRepository.users.get(fixture.user.id)?.subscriptionStatus).toBe(
      "ACTIVE",
    );
    expect(fixture.notifier.failures).toHaveLength(1);
    expect(fixture.notifier.events).toEqual([]);
    expect(fixture.webhookLock.heldKeys.size).toBe(0);
  });

  it("original transaction ID가 없으면 transaction ID로 거래를 저장한다", async () => {
    // Given
    const body = payloadFor(SubscriptionEventBuilder.initialPurchase());
    body.event.original_transaction_id = undefined;
    body.event.transaction_id = "fallback-transaction";
    // When
    await useCase.execute({ body });
    // Then
    expect(fixture.subscriptionRepository.subscriptions.get("fallback-transaction")?.status).toBe(
      "ACTIVE",
    );
    expect(fixture.notifier.events[0]?.transactionId).toBe("fallback-transaction");
  });

  it("event ID가 없는 요청은 기존 거래 기준 멱등성을 사용한다", async () => {
    // Given
    const body = payloadFor(SubscriptionEventBuilder.initialPurchase());
    body.event.id = undefined;
    // When
    await useCase.execute({ body });
    await useCase.execute({ body });
    // Then
    expect(fixture.subscriptionRepository.subscriptions.size).toBe(1);
    expect(fixture.notifier.events).toHaveLength(1);
    expect(fixture.receiptRepository.receipts.size).toBe(0);
  });

  it("DB capability 실패는 실패 보고와 200 계약을 유지하며 커밋 이후 효과를 실행하지 않는다", async () => {
    // Given
    fixture.unitOfWork.run = async () => {
      throw new Error("민감한 DB 원문");
    };
    const body = payloadFor(SubscriptionEventBuilder.initialPurchase());
    // When
    expect(await useCase.execute({ body })).toEqual({ received: true });
    // Then
    expect(fixture.notifier.failures).toHaveLength(1);
    expect(fixture.notifier.events).toEqual([]);
    expect(fixture.cache.profiles.has(fixture.user.id)).toBe(true);
    expect(fixture.webhookLock.heldKeys.size).toBe(0);
    expect(JSON.stringify(fixture.logger.error.mock.calls)).not.toContain("민감한 DB 원문");
  });
});
