import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../domain/transactional-notification-campaign.constants.js";
import { createFollowRequestNotificationMessage } from "../messages/social-notification.messages.js";
import { SendFollowRequestNotificationUseCase } from "./send-follow-request-notification.use-case.js";

function setup() {
  const notificationPublisher = new RecordingNotificationPublisher();
  const useCase = new SendFollowRequestNotificationUseCase({
    notificationPublisher,
    recipientLocaleReader: { getLocale: async () => "ko" },
    logger: new SilentLogger(),
  });
  return { useCase, notificationPublisher };
}

describe("SendFollowRequestNotificationUseCase — 친구 요청 알림", () => {
  it("동일한 친구 요청에는 중복 제거 키가 같은 알림을 보낸다", async () => {
    // Given
    const { useCase, notificationPublisher } = setup();
    const input = { followerId: "u1", followingId: "u2", followerName: "민재" };
    const variantContext = {
      campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FOLLOW_REQUEST,
      recipientId: input.followingId,
      occurrenceKey: `${input.followerId}:${input.followingId}`,
    };
    const message = createFollowRequestNotificationMessage({
      senderName: input.followerName,
      locale: "ko",
      variantContext,
    });

    // When
    await useCase.execute(input);

    // Then
    expect(notificationPublisher.published).toEqual([
      {
        mode: "publishWithDeduplication",
        data: {
          userId: "u2",
          type: "FOLLOW_NEW",
          title: message.title,
          body: message.body,
          copyKey: message.copyKey,
          copyFacts: message.copyFacts,
          friendId: "u1",
          campaignKey: variantContext.campaignKey,
          variantId: message.variantId,
        },
      },
    ]);
  });

  it("큐가 재시도할 수 있도록 발송 실패를 전파한다", async () => {
    // Given
    const { useCase, notificationPublisher } = setup();
    notificationPublisher.failWith = new Error("temporary");

    // When
    const result = useCase.execute({ followerId: "u1", followingId: "u2", followerName: "민재" });

    // Then
    await expect(result).rejects.toThrow("temporary");
  });
});
