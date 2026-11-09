import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { SubscriptionEventPayload } from "#api/modules/billing/billing-subscriptions.public";

import type { SubscriptionAlertInput } from "../../types/notifications/subscription-alert.input.js";
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
      kind: "STARTED",
      productId: "aido_premium_monthly",
      store: "APP_STORE",
    };

    await useCase.execute(payload);

    expect(queue.enqueueSend).toHaveBeenCalledWith("payment", expect.any(Object), undefined);
  });

  it("구매 통화 기준 금액에 USD 금액을 병기한다 (KRW ₩3,900)", async () => {
    const payload: SubscriptionEventPayload = {
      userId: "user-1",
      email: "test@example.com",
      kind: "STARTED",
      store: null,
      productId: "aido_premium_monthly",
      priceUsd: 2.99,
      priceInPurchasedCurrency: 3900,
      purchasedCurrency: "KRW",
    };

    await useCase.execute(payload);

    expect(getNotification()?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "금액",
          value: { kind: "text", text: "₩3,900 (≈ $2.99)" },
        }),
      ]),
    );
  });

  it("구매 통화 금액이 없으면 USD fallback으로 금액을 표시한다", async () => {
    const payload: SubscriptionEventPayload = {
      userId: "user-1",
      email: "test@example.com",
      kind: "STARTED",
      store: null,
      productId: "aido_premium_monthly",
      priceUsd: 2.99,
    };

    await useCase.execute(payload);

    // Intl.NumberFormat 로케일에 따라 "$2.99" 또는 "US$2.99"
    expect(getNotification()?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "금액",
          value: { kind: "text", text: expect.stringContaining("2.99") },
        }),
      ]),
    );
  });

  it("이름이 있으면 body와 필드에 이름을 표시한다", async () => {
    const payload: SubscriptionEventPayload = {
      userId: "user-1",
      email: "test@example.com",
      name: "매튜",
      kind: "STARTED",
      store: null,
      productId: "aido_premium_monthly",
    };

    await useCase.execute(payload);

    const notification = getNotification();
    expect(notification?.body).toContain("매튜");
    expect(notification?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "이름", value: { kind: "text", text: "매튜" } }),
      ]),
    );
  });

  it("이벤트 ID가 있으면 같은 이벤트 알림을 한 번만 등록하도록 멱등 잡 ID를 넘긴다", async () => {
    // Given
    const payload: SubscriptionAlertInput = {
      userId: "user-1",
      email: "test@example.com",
      kind: "RENEWED",
      store: null,
      productId: "aido_premium_monthly",
      eventId: "rc-event-1",
    };

    // When
    await useCase.execute(payload);

    // Then
    expect(queue.enqueueSend).toHaveBeenCalledWith("payment", expect.any(Object), {
      jobId: "subscription-event_rc-event-1",
    });
  });

  it("큐 등록 실패 시 에러를 전파한다", async () => {
    queue.enqueueSend.mockRejectedValue(new Error("Redis connection error"));

    const payload: SubscriptionEventPayload = {
      userId: "user-1",
      email: "test@example.com",
      kind: "STARTED",
      store: null,
      productId: "aido_premium_monthly",
    };

    await expect(useCase.execute(payload)).rejects.toThrow("Redis connection error");
  });
});
