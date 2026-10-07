import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/delivery/transactional-notification-campaign.js";
import { createFollowRequestNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import { NotificationRecipientLocaleReader } from "../../readers/delivery/notification-recipient-locale.reader.js";
import { SendFollowRequestNotification } from "./send-follow-request-notification.use-case.js";

describe("SendFollowRequestNotification", () => {
  let useCase: SendFollowRequestNotification;
  let notificationSender: Mocked<NotificationPublisher>;
  let recipientLocaleReader: Mocked<NotificationRecipientLocaleReader>;

  beforeEach(async () => {
    const sendFollowRequestNotificationDependencies = mockDeep<
      ConstructorParameters<typeof SendFollowRequestNotification>[0]
    >({});
    const unit = new SendFollowRequestNotification(sendFollowRequestNotificationDependencies);
    useCase = unit;
    notificationSender = sendFollowRequestNotificationDependencies.notificationPublisher;
    recipientLocaleReader = sendFollowRequestNotificationDependencies.recipientLocaleReader;
    recipientLocaleReader.getRecipientLocale.mockResolvedValue("ko");
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
