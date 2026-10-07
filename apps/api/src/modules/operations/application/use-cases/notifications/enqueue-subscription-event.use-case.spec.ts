import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { SubscriptionEventPayload } from "#api/modules/billing/billing-subscriptions.public";

import { EnqueueSubscriptionEvent } from "./enqueue-subscription-event.use-case.js";

describe("EnqueueSubscriptionEvent", () => {
  let useCase: EnqueueSubscriptionEvent;
  let queue: Mocked<ConstructorParameters<typeof EnqueueSubscriptionEvent>[0]["queue"]>;

  beforeEach(async () => {
    const enqueueSubscriptionEventDependencies = mockDeep<
      ConstructorParameters<typeof EnqueueSubscriptionEvent>[0]
    >({});
    const unit = new EnqueueSubscriptionEvent(enqueueSubscriptionEventDependencies);
    useCase = unit;
    queue = enqueueSubscriptionEventDependencies.queue;
  });

  /** enqueueSend 호출의 notification 인자 추출 */
  function getNotification() {
    return queue.enqueueSend.mock.calls[0]?.[1];
  }

  it("payment 채널로 구독 이벤트 알림을 등록한다", async () => {
    const payload: SubscriptionEventPayload = {
      userId: "user-1",
      email: "test@example.com",
      eventType: "INITIAL_PURCHASE",
      productId: "aido_premium_monthly",
      store: "APP_STORE",
    };

    await useCase.execute(payload);

    expect(queue.enqueueSend).toHaveBeenCalledWith("payment", expect.any(Object));
  });

  it("구매 통화 기준으로 금액을 표시한다 (KRW ₩3,900)", async () => {
    const payload: SubscriptionEventPayload = {
      userId: "user-1",
      email: "test@example.com",
      eventType: "INITIAL_PURCHASE",
      productId: "aido_premium_monthly",
      priceUsd: 2.99,
      priceInPurchasedCurrency: 3900,
      purchasedCurrency: "KRW",
    };

    await useCase.execute(payload);

    expect(getNotification()?.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "금액", value: "₩3,900" })]),
    );
  });

  it("구매 통화 금액이 없으면 USD fallback으로 금액을 표시한다", async () => {
    const payload: SubscriptionEventPayload = {
      userId: "user-1",
      email: "test@example.com",
      eventType: "INITIAL_PURCHASE",
      productId: "aido_premium_monthly",
      priceUsd: 2.99,
    };

    await useCase.execute(payload);

    // Intl.NumberFormat 로케일에 따라 "$2.99" 또는 "US$2.99"
    expect(getNotification()?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "금액",
          value: expect.stringContaining("2.99"),
        }),
      ]),
    );
  });

  it("이름이 있으면 body와 필드에 이름을 표시한다", async () => {
    const payload: SubscriptionEventPayload = {
      userId: "user-1",
      email: "test@example.com",
      name: "매튜",
      eventType: "INITIAL_PURCHASE",
      productId: "aido_premium_monthly",
    };

    await useCase.execute(payload);

    const notification = getNotification();
    expect(notification?.body).toContain("매튜");
    expect(notification?.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "이름", value: "매튜" })]),
    );
  });

  it("큐 등록 실패 시 에러를 전파한다", async () => {
    queue.enqueueSend.mockRejectedValue(new Error("Redis connection error"));

    const payload: SubscriptionEventPayload = {
      userId: "user-1",
      email: "test@example.com",
      eventType: "INITIAL_PURCHASE",
      productId: "aido_premium_monthly",
    };

    await expect(useCase.execute(payload)).rejects.toThrow("Redis connection error");
  });
});
