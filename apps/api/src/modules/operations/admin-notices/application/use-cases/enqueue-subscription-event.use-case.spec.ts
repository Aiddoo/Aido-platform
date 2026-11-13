import { RecordingAdminNotificationQueue } from "#test/doubles/operations/recording-admin-notification-queue";
import { StubAdminNoticeUserReader } from "#test/doubles/operations/stub-admin-notice-user.reader";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import type { SubscriptionNoticeInput } from "../ports/admin-event-notifier.port.js";
import type { AdminNoticeUser } from "../read-models/admin-notice.read-model.js";
import { EnqueueSubscriptionEventUseCase } from "./enqueue-subscription-event.use-case.js";
import { ResolveAdminNoticeUserUseCase } from "./resolve-admin-notice-user.use-case.js";

const payload: SubscriptionNoticeInput = {
  userId: "user-1",
  email: "billing@example.com",
  name: "결제 이름",
  kind: "RENEWED",
  productId: "com.aido.pro.yearly",
  planType: "ANNUAL",
  store: "APP_STORE",
  environment: "PRODUCTION",
  eventId: "evt-1",
  priceUsd: 27.99,
  priceInPurchasedCurrency: 39_000,
  purchasedCurrency: "KRW",
  expiresAt: "2027-11-10T00:00:00.000Z",
  countryCode: "KR",
  lifecycle: "trial_converted",
};

const storedUser: AdminNoticeUser = {
  userId: "user-1",
  email: "billing@example.com",
  nickname: "매튜",
  userTag: "MATT2025",
  joinedAt: "2026-10-01T03:00:00.000Z",
  signupMethod: "APPLE",
};

function setup(userReader: StubAdminNoticeUserReader) {
  const queue = new RecordingAdminNotificationQueue();
  const logger = new SilentLogger();
  const useCase = new EnqueueSubscriptionEventUseCase({
    queue,
    resolveUser: new ResolveAdminNoticeUserUseCase({ userReader, logger }),
  });
  return { useCase, queue, logger };
}

describe("EnqueueSubscriptionEventUseCase — 결제 알림 등록", () => {
  it("저장된 사용자 블록과 웹훅 결제 값을 결제 채널에 이벤트 ID로 한 번만 등록한다", async () => {
    // Given
    const { useCase, queue } = setup(new StubAdminNoticeUserReader(storedUser));

    // When
    await useCase.execute(payload);

    // Then
    expect(queue.sent).toEqual([
      {
        channel: "payment",
        options: { jobId: "subscription-event_evt-1" },
        notice: {
          type: "subscription_event",
          user: storedUser,
          subscription: {
            event: "trial_converted",
            environment: "PRODUCTION",
            store: "APP_STORE",
            productId: "com.aido.pro.yearly",
            planType: "ANNUAL",
            price: { amount: 39_000, currency: "KRW", usd: 27.99 },
            expiresAt: "2027-11-10T00:00:00.000Z",
            countryCode: "KR",
          },
        },
      },
    ]);
  });

  it("사용자가 없으면 billing이 준 이메일·이름으로 사용자 블록을 채운다", async () => {
    // Given
    const { useCase, queue, logger } = setup(new StubAdminNoticeUserReader(null));

    // When
    await useCase.execute(payload);

    // Then
    expect(queue.sent[0]?.notice).toMatchObject({
      user: { userId: "user-1", email: "billing@example.com", nickname: "결제 이름" },
    });
    expect(logger.messages).toEqual([]);
  });

  it("사용자 조회가 실패해도 알림을 보내고 로그에는 사용자 ID와 오류 종류만 남긴다", async () => {
    // Given
    const { useCase, queue, logger } = setup(
      new StubAdminNoticeUserReader(new Error("billing@example.com connection refused")),
    );

    // When
    await useCase.execute(payload);

    // Then
    expect(queue.sent).toHaveLength(1);
    expect(logger.messages).toEqual([
      {
        event: "operations.notifications.user-lookup.failed",
        userId: "user-1",
        errorType: "Error",
      },
    ]);
    expect(JSON.stringify(logger.messages)).not.toContain("billing@example.com");
  });

  it("이벤트 ID가 없으면 멱등 키 없이 등록한다", async () => {
    // Given
    const { useCase, queue } = setup(new StubAdminNoticeUserReader(storedUser));
    const { eventId: _eventId, ...withoutEventId } = payload;

    // When
    await useCase.execute(withoutEventId);

    // Then
    expect(queue.sent[0]?.options).toBeUndefined();
  });
});
