import { TestBed } from "@suites/unit";
import type { Mocked } from "vitest";

import { NotificationPublisher } from "../../publishers/notification.publisher.js";
import { NotificationRecipientLocaleReader } from "../../readers/notification-recipient-locale.reader.js";
import { SendBillingIssueNotificationUseCase } from "./send-billing-issue-notification.use-case.js";

describe("SendBillingIssueNotificationUseCase", () => {
  it("sends a localized SYSTEM_NOTICE and propagates failures", async () => {
    const { unit, unitRef } = await TestBed.solitary(SendBillingIssueNotificationUseCase).compile();
    const notificationSender: Mocked<NotificationPublisher> = unitRef.get(NotificationPublisher);
    const recipientLocaleReader: Mocked<NotificationRecipientLocaleReader> = unitRef.get(
      NotificationRecipientLocaleReader,
    );
    recipientLocaleReader.getRecipientLocale.mockResolvedValue("en");

    await unit.execute({ userId: "u1" });
    expect(notificationSender.publish).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", type: "SYSTEM_NOTICE" }),
    );

    notificationSender.publish.mockRejectedValue(new Error("temporary"));
    await expect(unit.execute({ userId: "u1" })).rejects.toThrow("temporary");
  });
});
