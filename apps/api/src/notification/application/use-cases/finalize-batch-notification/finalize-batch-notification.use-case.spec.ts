import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createNotificationCacheMock } from "@test/mocks/ports/notification-cache.mock";

import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import {
	NOTIFICATION_DEDUP,
	type NotificationDedupPort,
} from "../../ports/notification-dedup.port";
import { FinalizeBatchNotificationUseCase } from "./finalize-batch-notification.use-case";

describe("FinalizeBatchNotificationUseCase", () => {
	let useCase: FinalizeBatchNotificationUseCase;
	let cache: Mocked<NotificationCachePort>;
	let dedup: Mocked<NotificationDedupPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(FinalizeBatchNotificationUseCase)
			.mock<NotificationCachePort>(NOTIFICATION_CACHE)
			.impl(() => createNotificationCacheMock())
			.mock<NotificationDedupPort>(NOTIFICATION_DEDUP)
			.impl(() => ({
				recordNotifiedUsers: jest.fn(),
			}))
			.compile();
		useCase = unit;
		cache = unitRef.get(NOTIFICATION_CACHE);
		dedup = unitRef.get(NOTIFICATION_DEDUP);
	});

	it("미읽음 캐시·날짜 dedup 부수효과를 관찰한다", async () => {
		const date = new Date("2026-03-09T00:00:00.000Z");
		const items = [
			{
				notificationId: 1,
				data: {
					userId: "u1",
					type: "FRIEND_COMPLETED" as const,
					title: "t",
					body: "b",
				},
			},
			{
				notificationId: 2,
				data: {
					userId: "u2",
					type: "FRIEND_COMPLETED" as const,
					title: "t",
					body: "b",
				},
			},
		];
		const sourceData = items.map((item) => ({
			...item.data,
			notificationDate: date,
		}));

		const result = await useCase.execute({ count: 2, sourceData });

		expect(result).toEqual({ count: 2 });
		expect(cache.invalidateUnreadCount).toHaveBeenCalledTimes(2);
		expect(dedup.recordNotifiedUsers).toHaveBeenCalledWith([
			{
				userId: "u1",
				type: "FRIEND_COMPLETED",
				notificationDate: date,
			},
			{
				userId: "u2",
				type: "FRIEND_COMPLETED",
				notificationDate: date,
			},
		]);
	});

	it("커밋 후 캐시·dedup 실패를 흡수하여 저장된 알림을 재시도하지 않는다", async () => {
		cache.invalidateUnreadCount.mockRejectedValue(new Error("cache unavailable"));
		dedup.recordNotifiedUsers.mockRejectedValue(new Error("dedup unavailable"));

		await expect(
			useCase.execute({
				count: 1,
				sourceData: [{ userId: "u1", type: "FOLLOW_NEW", title: "t", body: "b" }],
			}),
		).resolves.toEqual({ count: 1 });
	});
});
