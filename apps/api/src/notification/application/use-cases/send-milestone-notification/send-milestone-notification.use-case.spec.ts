import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import {
	NOTIFICATION_DEDUP_LOCK,
	type NotificationDedupLockPort,
} from "../../ports/notification-dedup.port";
import {
	NOTIFICATION_HISTORY_READER,
	type NotificationHistoryReaderPort,
} from "../../ports/notification-history.reader.port";
import { NotificationPublisher } from "../../publishers/notification.publisher";
import { NotificationRecipientLocaleReader } from "../../readers/notification-recipient-locale.reader";
import { SendMilestoneNotificationUseCase } from "./send-milestone-notification.use-case";

describe("SendMilestoneNotificationUseCase", () => {
	let useCase: SendMilestoneNotificationUseCase;
	let publisher: Mocked<NotificationPublisher>;
	let localeReader: Mocked<NotificationRecipientLocaleReader>;
	let history: Mocked<NotificationHistoryReaderPort>;
	let lock: Mocked<NotificationDedupLockPort>;
	let release: jest.MockedFunction<() => Promise<void>>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(SendMilestoneNotificationUseCase).compile();
		useCase = unit;
		publisher = unitRef.get(NotificationPublisher);
		localeReader = unitRef.get(NotificationRecipientLocaleReader);
		history = unitRef.get(NOTIFICATION_HISTORY_READER);
		lock = unitRef.get(NOTIFICATION_DEDUP_LOCK);
		release = jest.fn().mockResolvedValue(undefined);
		lock.acquire.mockResolvedValue(release);
		history.hasMilestoneNotification.mockResolvedValue(false);
		localeReader.getRecipientLocale.mockResolvedValue("ko");
	});

	it("locks the milestone key, sends once, and releases", async () => {
		await useCase.execute({ userId: "u1", milestone: "COUNT_10" });

		expect(lock.acquire).toHaveBeenCalledWith("milestone:u1:COUNT_10");
		expect(history.hasMilestoneNotification).toHaveBeenCalledWith("u1", "COUNT_10");
		expect(publisher.publish).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "u1",
				type: "WEEKLY_ACHIEVEMENT",
				metadata: { milestone: "COUNT_10" },
			}),
		);
		expect(release).toHaveBeenCalledTimes(1);
	});

	it("skips a concurrent execution when the lock is busy", async () => {
		lock.acquire.mockResolvedValue(null);

		await useCase.execute({ userId: "u1", milestone: "COUNT_10" });

		expect(history.hasMilestoneNotification).not.toHaveBeenCalled();
		expect(publisher.publish).not.toHaveBeenCalled();
	});

	it("releases the lock when delivery fails so the runtime can retry", async () => {
		publisher.publish.mockRejectedValue(new Error("temporary"));

		await expect(useCase.execute({ userId: "u1", milestone: "COUNT_10" })).rejects.toThrow(
			"temporary",
		);
		expect(release).toHaveBeenCalledTimes(1);
	});
});
