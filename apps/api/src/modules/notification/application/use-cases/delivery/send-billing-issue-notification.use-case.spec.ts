import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { SendBillingIssueNotification } from "./send-billing-issue-notification.use-case.js";

describe("SendBillingIssueNotification", () => {
  it("수신자 언어로 SYSTEM_NOTICE를 보내고 실패를 전파한다", async () => {
    const sendBillingIssueNotificationDependencies = mockDeep<
      ConstructorParameters<typeof SendBillingIssueNotification>[0]
    >({});
    const unit = new SendBillingIssueNotification(sendBillingIssueNotificationDependencies);
    const notificationSender: Mocked<
      ConstructorParameters<typeof SendBillingIssueNotification>[0]["notificationPublisher"]
    > = sendBillingIssueNotificationDependencies.notificationPublisher;
    const recipientLocaleReader: Mocked<
      ConstructorParameters<typeof SendBillingIssueNotification>[0]["recipientLocaleReader"]
    > = sendBillingIssueNotificationDependencies.recipientLocaleReader;
    recipientLocaleReader.getLocale.mockResolvedValue("en");

    await unit.execute({ userId: "u1" });
    expect(notificationSender.publish).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", type: "SYSTEM_NOTICE" }),
    );

    notificationSender.publish.mockRejectedValue(new Error("temporary"));
    await expect(unit.execute({ userId: "u1" })).rejects.toThrow("temporary");
  });
});
