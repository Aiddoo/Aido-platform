import {
  createSubscriptionFixture,
  SUBSCRIPTION_EXPIRY,
  SUBSCRIPTION_TIME,
  SUBSCRIPTION_TRANSACTION_ID,
} from "#test/fixtures/subscription.fixture";

import type {
  StoreSubscriptionEvent,
  SubscriptionCancelledEvent,
  SubscriptionExpiredEvent,
  SubscriptionRenewedEvent,
  SubscriptionStartedEvent,
} from "../../types/subscriptions/store-subscription-event.js";
import { ApplyStoreSubscriptionEvent } from "./apply-store-subscription-event.use-case.js";

const DAY_MS = 24 * 60 * 60 * 1_000;
const NEXT_EXPIRY = new Date("2026-04-10T12:00:00.000Z");

describe("ApplyStoreSubscriptionEvent — 스토어 구독 이벤트 반영", () => {
  let fixture: ReturnType<typeof createSubscriptionFixture>;
  let useCase: ApplyStoreSubscriptionEvent;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUBSCRIPTION_TIME);
    fixture = createSubscriptionFixture();
    useCase = new ApplyStoreSubscriptionEvent(fixture);
  });
  afterEach(() => vi.useRealTimers());

  function givenSubscription() {
    fixture = createSubscriptionFixture({ existing: true });
    useCase = new ApplyStoreSubscriptionEvent(fixture);
  }

  function chain(providerEventId: string) {
    return {
      provider: "REVENUECAT",
      providerEventId,
      providerEventType: "PROVIDER_EVENT",
      environment: "PRODUCTION",
      store: "APP_STORE",
      details: {},
      appUserId: fixture.user.id,
      storeSubscriptionId: SUBSCRIPTION_TRANSACTION_ID,
      productId: "premium_monthly",
      periodEndsAt: SUBSCRIPTION_EXPIRY,
      periodKind: null,
      price: {},
    } as const;
  }

  function started(overrides: Partial<SubscriptionStartedEvent> = {}): SubscriptionStartedEvent {
    return {
      ...chain("start"),
      kind: "STARTED",
      isOneTime: false,
      startedAt: SUBSCRIPTION_TIME,
      ...overrides,
    };
  }

  function renewed(overrides: Partial<SubscriptionRenewedEvent> = {}): SubscriptionRenewedEvent {
    return {
      ...chain("renew"),
      kind: "RENEWED",
      isTrialConversion: false,
      periodEndsAt: NEXT_EXPIRY,
      ...overrides,
    };
  }

  function cancelled(
    overrides: Partial<SubscriptionCancelledEvent> = {},
  ): SubscriptionCancelledEvent {
    return { ...chain("cancel"), kind: "CANCELLED", reason: "UNSUBSCRIBE", ...overrides };
  }

  function expired(overrides: Partial<SubscriptionExpiredEvent> = {}): SubscriptionExpiredEvent {
    return { ...chain("expire"), kind: "EXPIRED", reason: "UNSUBSCRIBE", ...overrides };
  }

  const stored = () =>
    fixture.subscriptionRepository.subscriptions.get(SUBSCRIPTION_TRANSACTION_ID);
  const userState = () => fixture.subscriptionRepository.users.get(fixture.user.id);

  it.each([
    { name: "구독 시작", isOneTime: false, alertKind: "STARTED" },
    { name: "일회성 구매", isOneTime: true, alertKind: "STARTED" },
  ])(
    "$name은 기간을 저장하고 프리미엄·캐시·알림·처리 원장을 함께 남긴다",
    async ({ isOneTime, alertKind }) => {
      // Given
      const event = started({
        isOneTime,
        price: { usd: 4.99, amountInPurchasedCurrency: 6900, purchasedCurrency: "KRW" },
      });

      // When
      await useCase.execute(event);

      // Then
      expect(stored()).toMatchObject({
        status: "ACTIVE",
        startedAt: SUBSCRIPTION_TIME,
        expiresAt: SUBSCRIPTION_EXPIRY,
        lastProcessedEventId: "start",
      });
      expect(userState()).toMatchObject({
        subscriptionStatus: "ACTIVE",
        subscriptionExpiresAt: SUBSCRIPTION_EXPIRY,
      });
      expect(fixture.cache.profiles.has(fixture.user.id)).toBe(false);
      expect(fixture.notifier.events).toEqual([
        expect.objectContaining({
          kind: alertKind,
          isOneTime,
          storeSubscriptionId: SUBSCRIPTION_TRANSACTION_ID,
          priceUsd: 4.99,
          priceInPurchasedCurrency: 6900,
          purchasedCurrency: "KRW",
        }),
      ]);
      expect(fixture.receiptRepository.receipts.get("start")).toMatchObject({
        eventType: "PROVIDER_EVENT",
      });
      expect(fixture.reconcileScheduler.scheduledUserIds).toEqual([fixture.user.id]);
      expect(fixture.webhookLock.heldKeys.size).toBe(0);
    },
  );

  describe("무료 체험", () => {
    const TRIAL_EXPIRY = new Date(SUBSCRIPTION_TIME.getTime() + 31 * DAY_MS);
    const NEXT_YEAR = new Date(TRIAL_EXPIRY.getTime() + 365 * DAY_MS);

    it("체험 시작은 체험으로 저장하고 체험 시작으로 알린다", async () => {
      // Given
      const event = started({ periodKind: "TRIAL", periodEndsAt: TRIAL_EXPIRY });

      // When
      await useCase.execute(event);

      // Then
      expect(stored()).toMatchObject({ periodType: "TRIAL", expiresAt: TRIAL_EXPIRY });
      expect(fixture.notifier.events).toEqual([
        expect.objectContaining({ lifecycle: "trial_started", periodKind: "TRIAL" }),
      ]);
    });

    it("체험 전환 갱신은 NORMAL로 바꾸고, 전환 뒤 늦게 온 체험 해지는 결제된 구독을 되돌리지 않는다", async () => {
      // Given
      await useCase.execute(started({ periodKind: "TRIAL", periodEndsAt: TRIAL_EXPIRY }));

      // When
      await useCase.execute(renewed({ isTrialConversion: true, periodEndsAt: NEXT_YEAR }));
      await useCase.execute(cancelled({ periodKind: "TRIAL", periodEndsAt: TRIAL_EXPIRY }));

      // Then
      expect(stored()).toMatchObject({
        periodType: "NORMAL",
        status: "ACTIVE",
        expiresAt: NEXT_YEAR,
      });
      expect(fixture.notifier.events.map((payload) => payload.lifecycle)).toEqual([
        "trial_started",
        "trial_converted",
      ]);
    });
  });

  it("지난 기간의 늦은 갱신은 이미 반영한 다음 결제일을 앞당기지 않는다", async () => {
    // Given
    givenSubscription();
    await useCase.execute(renewed({ providerEventId: "renew-next" }));

    // When
    await useCase.execute(
      renewed({ providerEventId: "renew-late", periodEndsAt: SUBSCRIPTION_EXPIRY }),
    );

    // Then
    expect(stored()?.expiresAt).toEqual(NEXT_EXPIRY);
    expect(fixture.notifier.events).toHaveLength(1);
  });

  it("같은 공급자 이벤트 ID를 다시 받으면 처리 원장이 막아 상태·알림을 바꾸지 않는다", async () => {
    // Given
    await useCase.execute(started());

    // When
    await useCase.execute(started());

    // Then
    expect(fixture.notifier.events).toHaveLength(1);
    expect(fixture.reconcileScheduler.scheduledUserIds).toHaveLength(1);
  });

  it("해지 뒤 갱신하면 취소 시각을 지우고 사용자와 구독 만료를 함께 늘린다", async () => {
    // Given
    givenSubscription();
    await useCase.execute(cancelled());

    // When
    await useCase.execute(renewed());

    // Then
    expect(stored()).toMatchObject({ status: "ACTIVE", cancelledAt: null, expiresAt: NEXT_EXPIRY });
    expect(userState()).toMatchObject({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: NEXT_EXPIRY,
    });
  });

  it("환불은 스토어 기간과 상관없이 바로 끝내 무료로 돌리고 환불로 알린다", async () => {
    // Given
    givenSubscription();

    // When
    await useCase.execute(cancelled({ kind: "REFUNDED", reason: "CUSTOMER_SUPPORT" }));

    // Then
    expect(stored()?.status).toBe("EXPIRED");
    expect(userState()).toMatchObject({ subscriptionStatus: "FREE", subscriptionExpiresAt: null });
    expect(fixture.notifier.events).toEqual([
      expect.objectContaining({ kind: "REFUNDED", endReason: "CUSTOMER_SUPPORT" }),
    ]);
  });

  it("이전 기간의 만료는 갱신된 구독을 끝내지 않는다", async () => {
    // Given
    givenSubscription();
    await useCase.execute(renewed());

    // When
    await useCase.execute(expired({ periodEndsAt: SUBSCRIPTION_EXPIRY }));

    // Then
    expect(stored()).toMatchObject({ status: "ACTIVE", expiresAt: NEXT_EXPIRY });
  });

  it("행이 없는 체인의 갱신은 그 이벤트로 체인 행을 만들어 이어 받는다", async () => {
    // Given
    const event = renewed({ startedAt: SUBSCRIPTION_TIME });

    // When
    await useCase.execute(event);

    // Then
    expect(stored()).toMatchObject({
      userId: fixture.user.id,
      status: "ACTIVE",
      expiresAt: NEXT_EXPIRY,
    });
  });

  it("상품 변경 예약은 지금 상품·만료를 두고 다음 갱신 상품만 남긴다", async () => {
    // Given
    givenSubscription();

    // When
    await useCase.execute({
      ...chain("change"),
      kind: "PRODUCT_CHANGE_SCHEDULED",
      newProductId: "premium_yearly",
    });

    // Then
    expect(stored()).toMatchObject({
      productId: "premium_monthly",
      nextProductId: "premium_yearly",
      expiresAt: SUBSCRIPTION_EXPIRY,
    });
  });

  it("다른 사용자로 온 체인 이벤트는 행의 소유자를 그 사용자로 옮기고 프리미엄을 다시 계산한다", async () => {
    // Given
    givenSubscription();
    const receiverId = "chain-receiver";
    fixture.subscriptionRepository.users.set(receiverId, {
      id: receiverId,
      email: "receiver@example.com",
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
      revenueCatUserId: null,
      profile: null,
    });

    // When
    await useCase.execute(renewed({ appUserId: receiverId }));

    // Then
    expect(stored()).toMatchObject({ userId: receiverId, expiresAt: NEXT_EXPIRY });
    expect(fixture.subscriptionRepository.users.get(receiverId)).toMatchObject({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: NEXT_EXPIRY,
    });
  });

  it("이전은 넘겨준 사용자의 행을 받은 사용자에게 옮기고 두 사용자의 캐시를 비운다", async () => {
    // Given
    givenSubscription();
    const receiverId = "transfer-receiver";
    fixture.subscriptionRepository.users.set(receiverId, {
      id: receiverId,
      email: "receiver@example.com",
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
      revenueCatUserId: null,
      profile: null,
    });
    const event: StoreSubscriptionEvent = {
      provider: "REVENUECAT",
      providerEventId: "transfer",
      providerEventType: "TRANSFER",
      environment: "PRODUCTION",
      store: "APP_STORE",
      details: {},
      kind: "TRANSFERRED",
      receivers: [receiverId],
      transferredFrom: [fixture.user.revenueCatUserId ?? fixture.user.id],
    };

    // When
    await useCase.execute(event);

    // Then
    expect(stored()?.userId).toBe(receiverId);
    expect(fixture.subscriptionRepository.users.get(receiverId)).toMatchObject({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: SUBSCRIPTION_EXPIRY,
    });
    expect(fixture.cache.profiles.has(fixture.user.id)).toBe(false);
  });

  it("처리하지 않는 이벤트는 저장·처리 원장·캐시·알림을 바꾸지 않는다", async () => {
    // Given
    givenSubscription();
    const before = stored();

    // When
    await useCase.execute({ ...chain("future"), kind: "IGNORED" });

    // Then
    expect(stored()).toEqual(before);
    expect(fixture.receiptRepository.receipts.size).toBe(0);
    expect(fixture.notifier.events).toEqual([]);
    expect(fixture.cache.profiles.has(fixture.user.id)).toBe(true);
  });

  it("사용자 잠금 경합은 1605를 전파해 공급자가 다시 보내게 하고 아무것도 남기지 않는다", async () => {
    // Given
    fixture.webhookLock.heldKeys.add(fixture.user.id);

    // When
    const applying = useCase.execute(started());

    // Then
    await expect(applying).rejects.toMatchObject({ errorCode: "SUBSCRIPTION_1605" });
    expect(fixture.subscriptionRepository.subscriptions.size).toBe(0);
    expect(fixture.receiptRepository.receipts.size).toBe(0);
    expect(fixture.notifier.failures).toEqual([]);
  });

  it.each([
    { name: "사용자가 없으면", errorCode: "SUBSCRIPTION_1602", prepare: "missing-user" },
    { name: "체인 ID가 없으면", errorCode: "SUBSCRIPTION_1604", prepare: "missing-chain" },
    { name: "시작 시각이 없으면", errorCode: "SUBSCRIPTION_1604", prepare: "missing-start" },
  ] as const)(
    "$name $errorCode를 보고하고 잠금을 푼 뒤 받은 것으로 닫는다",
    async ({ errorCode, prepare }) => {
      // Given
      if (prepare === "missing-user") {
        fixture.subscriptionRepository.users.clear();
      }
      const event = started({
        ...(prepare === "missing-chain" && { storeSubscriptionId: undefined }),
        ...(prepare === "missing-start" && { startedAt: undefined }),
      });

      // When
      await useCase.execute(event);

      // Then
      expect(fixture.notifier.failures).toEqual([
        {
          error: expect.objectContaining({ errorCode }),
          context: {
            kind: "STARTED",
            providerEventId: "start",
            store: "APP_STORE",
            productId: "premium_monthly",
          },
        },
      ]);
      expect(fixture.subscriptionRepository.subscriptions.size).toBe(0);
      expect(fixture.webhookLock.heldKeys.size).toBe(0);
    },
  );

  it("트랜잭션이 끝나기 전에는 캐시·알림 효과를 실행하지 않는다", async () => {
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
    const pending = useCase.execute(started());
    await persisted.promise;

    // Then
    expect(fixture.cache.entitlements.has(fixture.user.id)).toBe(true);
    expect(fixture.notifier.events).toEqual([]);
    committed.resolve();
    await pending;
    expect(fixture.cache.entitlements.has(fixture.user.id)).toBe(false);
    expect(fixture.notifier.events).toHaveLength(1);
  });

  it("결제 문제 푸시는 구독 변경과 같은 트랜잭션에 기록해, 커밋 전에 남고 롤백되면 함께 사라진다", async () => {
    // Given
    givenSubscription();
    const recordedInTransaction: string[][] = [];
    fixture.unitOfWork.run = async (work) => {
      const result = await work();
      recordedInTransaction.push([...fixture.notifier.billingIssueUserIds]);
      return result;
    };

    // When
    await useCase.execute({
      ...chain("billing-issue"),
      kind: "BILLING_ISSUE",
      gracePeriodEndsAt: NEXT_EXPIRY,
    });

    // Then
    expect(recordedInTransaction).toEqual([[fixture.user.id]]);
    expect(fixture.notifier.billingIssueUserIds).toEqual([fixture.user.id]);
  });

  it("DB 같은 일시 실패는 보고하지 않고 던져 공급자가 다시 보내게 하며 원문 오류를 로그에 남기지 않는다", async () => {
    // Given
    fixture.unitOfWork.run = async () => {
      throw new Error("민감한 DB 원문");
    };

    // When
    const applying = useCase.execute(started());

    // Then
    await expect(applying).rejects.toThrow("민감한 DB 원문");
    expect(fixture.notifier.failures).toEqual([]);
    expect(fixture.notifier.events).toEqual([]);
    expect(fixture.webhookLock.heldKeys.size).toBe(0);
    expect(JSON.stringify(fixture.logger.error.mock.calls)).not.toContain("민감한 DB 원문");
  });

  it("처리 대상이 없는 영구 실패도 사용자가 확인되면 스토어 상태 대조를 예약해 스스로 맞춘다", async () => {
    // Given
    const event = renewed({ storeSubscriptionId: undefined });

    // When
    await useCase.execute(event);

    // Then
    expect(fixture.notifier.failures[0]?.error).toMatchObject({ errorCode: "SUBSCRIPTION_1604" });
    expect(fixture.reconcileScheduler.scheduledUserIds.at(-1)).toBe(fixture.user.id);
  });

  it("커밋 뒤 캐시 무효화 실패는 반영을 되돌릴 수 없어 보고하고 받은 것으로 닫는다", async () => {
    // Given
    vi.spyOn(fixture.cache, "invalidate").mockRejectedValueOnce(new Error("캐시 장애"));

    // When
    await useCase.execute(started());

    // Then
    expect(stored()?.status).toBe("ACTIVE");
    expect(fixture.notifier.failures).toHaveLength(1);
    expect(fixture.webhookLock.heldKeys.size).toBe(0);
  });
});
