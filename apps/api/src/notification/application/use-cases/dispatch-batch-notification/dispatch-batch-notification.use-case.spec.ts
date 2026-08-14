import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createNotificationCacheMock } from "@test/mocks/ports/notification-cache.mock";
import { createPushDispatcherMock } from "@test/mocks/ports/notification.mock";

import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import {
	NOTIFICATION_DEDUP,
	type NotificationDedupPort,
} from "../../ports/notification-dedup.port";
import { PUSH_DISPATCHER, type PushDispatcherPort } from "../../ports/push-dispatcher.port";
import { DispatchBatchNotificationUseCase } from "./dispatch-batch-notification.use-case";

describe("DispatchBatchNotificationUseCase", () => {
	let useCase: DispatchBatchNotificationUseCase;
	let pushDispatcher: Mocked<PushDispatcherPort>;
	let cache: Mocked<NotificationCachePort>;
	let dedup: Mocked<NotificationDedupPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(DispatchBatchNotificationUseCase)
			.mock<PushDispatcherPort>(PUSH_DISPATCHER)
			.impl(() => createPushDispatcherMock())
			.mock<NotificationCachePort>(NOTIFICATION_CACHE)
			.impl(() => createNotificationCacheMock())
			.mock<NotificationDedupPort>(NOTIFICATION_DEDUP)
			.impl(() => ({
				recordNotifiedUsers: jest.fn(),
			}))
			.compile();
		useCase = unit;
		pushDispatcher = unitRef.get(PUSH_DISPATCHER);
		cache = unitRef.get(NOTIFICATION_CACHE);
		dedup = unitRef.get(NOTIFICATION_DEDUP);
	});

	it("푸시·미읽음 캐시·날짜 dedup 부수효과를 예약한다", () => {
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

		const result = useCase.execute({ count: 2, items, sourceData });

		expect(result).toEqual({ count: 2 });
		expect(pushDispatcher.fireAndForgetBatchPush).toHaveBeenCalledWith(items);
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
});
