import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { NotificationSender } from "../../senders/notification.sender";
import { SendBillingIssueNotificationUseCase } from "./send-billing-issue-notification.use-case";

describe("SendBillingIssueNotificationUseCase", () => {
	it("sends a localized SYSTEM_NOTICE and propagates failures", async () => {
		const { unit, unitRef } = await TestBed.solitary(SendBillingIssueNotificationUseCase).compile();
		const notificationSender: Mocked<NotificationSender> = unitRef.get(NotificationSender);
		notificationSender.getUserLocale.mockResolvedValue("en");

		await unit.execute({ userId: "u1" });
		expect(notificationSender.createAndSend).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "u1", type: "SYSTEM_NOTICE" }),
		);

		notificationSender.createAndSend.mockRejectedValue(new Error("temporary"));
		await expect(unit.execute({ userId: "u1" })).rejects.toThrow("temporary");
	});
});
