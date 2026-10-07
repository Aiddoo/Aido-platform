import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { SubscriptionEventPayload } from "#api/modules/billing/billing-subscriptions.public";
import { flushPromises } from "#test/mocks/index";

import type { UserRegisteredEventPayload } from "../../../domain/types/notifications/user-registered.payload.js";
import { EnqueueSubscriptionEvent } from "../../use-cases/notifications/enqueue-subscription-event.use-case.js";
import { EnqueueUserRegistered } from "../../use-cases/notifications/enqueue-user-registered.use-case.js";
import { AdminEventNotifier } from "./admin-event.notifier.js";

describe("AdminEventNotifier", () => {
  let adminEventNotifier: AdminEventNotifier;
  let enqueueUserRegistered: Mocked<EnqueueUserRegistered>;
  let enqueueSubscriptionEvent: Mocked<EnqueueSubscriptionEvent>;

  const userPayload: UserRegisteredEventPayload = {
    userId: "user-1",
    email: "test@example.com",
    provider: "apple",
    registeredAt: "2026-03-07T12:00:00.000Z",
  };

  const subscriptionPayload: SubscriptionEventPayload = {
    userId: "user-1",
    email: "test@example.com",
    eventType: "INITIAL_PURCHASE",
    productId: "aido_premium_monthly",
  };

  beforeEach(async () => {
    const adminEventNotifierDependencies = mockDeep<
      ConstructorParameters<typeof AdminEventNotifier>[0]
    >({});
    const unit = new AdminEventNotifier(adminEventNotifierDependencies);
    adminEventNotifier = unit;
    enqueueUserRegistered = adminEventNotifierDependencies.enqueueUserRegistered;
    enqueueSubscriptionEvent = adminEventNotifierDependencies.enqueueSubscriptionEvent;
    enqueueUserRegistered.execute.mockResolvedValue(undefined);
    enqueueSubscriptionEvent.execute.mockResolvedValue(undefined);
  });

  it("회원가입 이벤트를 비동기로 enqueue한다", async () => {
    adminEventNotifier.notifyUserRegistered(userPayload);
    await flushPromises();
    expect(enqueueUserRegistered.execute).toHaveBeenCalledWith(userPayload);
  });

  it("회원가입 enqueue 실패를 호출자에게 전파하지 않는다", async () => {
    enqueueUserRegistered.execute.mockRejectedValue(new Error("Redis down"));
    adminEventNotifier.notifyUserRegistered(userPayload);
    await expect(flushPromises()).resolves.not.toThrow();
  });

  it("구독 이벤트를 비동기로 enqueue한다", async () => {
    adminEventNotifier.notifySubscriptionEvent(subscriptionPayload);
    await flushPromises();
    expect(enqueueSubscriptionEvent.execute).toHaveBeenCalledWith(subscriptionPayload);
  });

  it("구독 enqueue 실패를 호출자에게 전파하지 않는다", async () => {
    enqueueSubscriptionEvent.execute.mockRejectedValue(new Error("Redis down"));
    adminEventNotifier.notifySubscriptionEvent(subscriptionPayload);
    await expect(flushPromises()).resolves.not.toThrow();
  });
});
