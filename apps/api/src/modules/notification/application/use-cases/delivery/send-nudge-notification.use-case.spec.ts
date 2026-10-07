import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../../domain/services/delivery/transactional-notification-campaign.js";
import { SendNudgeNotification } from "./send-nudge-notification.use-case.js";

describe("SendNudgeNotification", () => {
  let useCase: SendNudgeNotification;
  let notificationSender: Mocked<
    ConstructorParameters<typeof SendNudgeNotification>[0]["notificationPublisher"]
  >;
  let recipientLocaleReader: Mocked<
    ConstructorParameters<typeof SendNudgeNotification>[0]["recipientLocaleReader"]
  >;

  beforeEach(async () => {
    const sendNudgeNotificationDependencies = mockDeep<
      ConstructorParameters<typeof SendNudgeNotification>[0]
    >({});
    const unit = new SendNudgeNotification(sendNudgeNotificationDependencies);
    useCase = unit;
    notificationSender = sendNudgeNotificationDependencies.notificationPublisher;
    recipientLocaleReader = sendNudgeNotificationDependencies.recipientLocaleReader;
    recipientLocaleReader.getLocale.mockResolvedValue("ko");
  });

  it("할 일 넛지에 할 일 정보와 선택 메시지 메타데이터를 포함한다", async () => {
    await useCase.execute({
      nudgeId: 3,
      senderId: "u1",
      receiverId: "u2",
      senderName: "민재",
      todoId: 7,
      todoTitle: "운동",
      message: "가보자고",
    });

    expect(notificationSender.publishWithDeduplication).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u2",
        type: "NUDGE_RECEIVED",
        nudgeId: 3,
        friendId: "u1",
        todoId: 7,
        metadata: { message: "가보자고" },
        campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.NUDGE_RECEIVED,
      }),
    );
  });

  it("todoId가 없으면 할 일 생성 넛지 경로를 사용한다", async () => {
    await useCase.execute({
      nudgeId: 4,
      senderId: "u1",
      receiverId: "u2",
      senderName: "민재",
    });

    expect(notificationSender.publishWithDeduplication).toHaveBeenCalledWith(
      expect.objectContaining({ todoId: undefined, metadata: undefined }),
    );
  });
});
