import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../domain/transactional-notification-campaign.constants.js";
import { createFollowRequestNotificationMessage } from "../messages/notification.messages.js";
import { SendFollowRequestNotificationUseCase } from "./send-follow-request-notification.use-case.js";

describe("SendFollowRequestNotificationUseCase", () => {
  let useCase: SendFollowRequestNotificationUseCase;
  let notificationSender: Mocked<
    ConstructorParameters<typeof SendFollowRequestNotificationUseCase>[0]["notificationPublisher"]
  >;
  let recipientLocaleReader: Mocked<
    ConstructorParameters<typeof SendFollowRequestNotificationUseCase>[0]["recipientLocaleReader"]
  >;

  beforeEach(async () => {
    const sendFollowRequestNotificationDependencies = mockDeep<
      ConstructorParameters<typeof SendFollowRequestNotificationUseCase>[0]
    >({});
    const unit = new SendFollowRequestNotificationUseCase(
      sendFollowRequestNotificationDependencies,
    );
    useCase = unit;
    notificationSender = sendFollowRequestNotificationDependencies.notificationPublisher;
    recipientLocaleReader = sendFollowRequestNotificationDependencies.recipientLocaleReader;
    recipientLocaleReader.getLocale.mockResolvedValue("ko");
  });

  it("동일한 친구 요청에는 중복 제거 키가 같은 알림을 보낸다", async () => {
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

    await useCase.execute(input);

    expect(notificationSender.publishWithDeduplication).toHaveBeenCalledWith({
      userId: "u2",
      type: "FOLLOW_NEW",
      title: message.title,
      body: message.body,
      copyKey: message.copyKey,
      copyFacts: message.copyFacts,
      friendId: "u1",
      campaignKey: variantContext.campaignKey,
      variantId: message.variantId,
    });
  });

  it("큐가 재시도할 수 있도록 발송 실패를 전파한다", async () => {
    notificationSender.publishWithDeduplication.mockRejectedValue(new Error("temporary"));

    await expect(
      useCase.execute({ followerId: "u1", followingId: "u2", followerName: "민재" }),
    ).rejects.toThrow("temporary");
  });
});
