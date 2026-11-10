import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { SendBillingIssueNotificationUseCase } from "./send-billing-issue-notification.use-case.js";

function setup() {
  const notificationPublisher = new RecordingNotificationPublisher();
  const useCase = new SendBillingIssueNotificationUseCase({
    notificationPublisher,
    recipientLocaleReader: { getLocale: async () => "en" },
    logger: new SilentLogger(),
  });
  return { useCase, notificationPublisher };
}

describe("SendBillingIssueNotificationUseCase — 결제 문제 알림", () => {
  it("수신자 언어로 구독 화면을 여는 SYSTEM_NOTICE를 보낸다", async () => {
    // Given
    const { useCase, notificationPublisher } = setup();

    // When
    await useCase.execute({ userId: "u1" });

    // Then
    expect(notificationPublisher.published).toEqual([
      {
        mode: "publish",
        data: expect.objectContaining({
          userId: "u1",
          type: "SYSTEM_NOTICE",
          action: { type: "DEEP_LINK", url: "/settings/subscription" },
        }),
      },
    ]);
  });

  it("큐가 재시도할 수 있도록 발송 실패를 전파한다", async () => {
    // Given
    const { useCase, notificationPublisher } = setup();
    notificationPublisher.failWith = new Error("temporary");

    // When
    const result = useCase.execute({ userId: "u1" });

    // Then
    await expect(result).rejects.toThrow("temporary");
  });
});
