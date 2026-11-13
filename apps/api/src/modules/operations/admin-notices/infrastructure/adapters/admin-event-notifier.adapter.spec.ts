import { SilentLogger } from "#test/doubles/platform/silent-logger";

import type {
  SubscriptionNoticeInput,
  UserRegisteredAlertInput,
} from "../../application/ports/admin-event-notifier.port.js";
import { AdminEventNotifierAdapter } from "./admin-event-notifier.adapter.js";

const userPayload: UserRegisteredAlertInput = {
  userId: "user-1",
  email: "test@example.com",
  provider: "apple",
  registeredAt: "2026-03-07T12:00:00.000Z",
};

const subscriptionPayload: SubscriptionNoticeInput = {
  userId: "user-1",
  email: "test@example.com",
  kind: "STARTED",
  store: null,
  productId: "aido_premium_monthly",
};

// 등록 호출을 기록하고, 실패를 주면 큐 등록 실패를 흉내 낸다
class RecordingEnqueue<TPayload> {
  readonly payloads: TPayload[] = [];
  failure: Error | null = null;

  async execute(payload: TPayload): Promise<void> {
    this.payloads.push(payload);
    if (this.failure != null) {
      throw this.failure;
    }
  }
}

function setup() {
  const enqueueUserRegistered = new RecordingEnqueue<UserRegisteredAlertInput>();
  const enqueueSubscriptionEvent = new RecordingEnqueue<SubscriptionNoticeInput>();
  const logger = new SilentLogger();
  const notifier = new AdminEventNotifierAdapter({
    enqueueUserRegistered,
    enqueueSubscriptionEvent,
    logger,
  });
  return { notifier, enqueueUserRegistered, enqueueSubscriptionEvent, logger };
}

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("AdminEventNotifierAdapter — 격리된 관리자 이벤트 알림", () => {
  it("회원가입·구독 이벤트를 기다리지 않고 등록한다", async () => {
    // Given
    const { notifier, enqueueUserRegistered, enqueueSubscriptionEvent } = setup();

    // When
    notifier.notifyUserRegistered(userPayload);
    notifier.notifySubscriptionEvent(subscriptionPayload);
    await flushPromises();

    // Then
    expect(enqueueUserRegistered.payloads).toEqual([userPayload]);
    expect(enqueueSubscriptionEvent.payloads).toEqual([subscriptionPayload]);
  });

  it("회원가입 등록 실패를 호출자에게 전파하지 않고 원문 오류 없이 로그만 남긴다", async () => {
    // Given
    const { notifier, enqueueUserRegistered, logger } = setup();
    enqueueUserRegistered.failure = new Error("synthetic-private-queue-error");

    // When
    notifier.notifyUserRegistered(userPayload);
    await flushPromises();

    // Then
    expect(logger.messages).toEqual([
      {
        event: "operations.notifications.signup.enqueue-failed",
        userId: "user-1",
        errorType: "queue-enqueue",
      },
    ]);
    expect(JSON.stringify(logger.messages)).not.toContain("synthetic-private-queue-error");
  });

  it("구독 등록 실패를 호출자에게 전파하지 않고 원문 오류 없이 로그만 남긴다", async () => {
    // Given
    const { notifier, enqueueSubscriptionEvent, logger } = setup();
    enqueueSubscriptionEvent.failure = new Error("synthetic-private-queue-error");

    // When
    notifier.notifySubscriptionEvent(subscriptionPayload);
    await flushPromises();

    // Then
    expect(logger.messages).toEqual([
      {
        event: "operations.notifications.subscription.enqueue-failed",
        userId: "user-1",
        errorType: "queue-enqueue",
      },
    ]);
    expect(JSON.stringify(logger.messages)).not.toContain("synthetic-private-queue-error");
  });
});
