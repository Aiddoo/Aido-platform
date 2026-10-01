import { TestBed } from "@suites/unit";
/**
 * MarkAllAsReadUseCase 단위 테스트 — 전체 읽음 처리 + 캐시 무효화
 */
import type { Mocked } from "vitest";

import { createNotificationCacheMock } from "#test/mocks/ports/index";

import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port.js";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port.js";
import { MarkAllAsReadUseCase } from "./mark-all-as-read.use-case.js";

describe("MarkAllAsReadUseCase", () => {
	let useCase: MarkAllAsReadUseCase;
	let notificationRepo: Mocked<NotificationRepositoryPort>;
	let cache: Mocked<NotificationCachePort>;

	const mockUserId = "user-1";

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(MarkAllAsReadUseCase)
			.mock<NotificationCachePort>(NOTIFICATION_CACHE)
			.impl(() => createNotificationCacheMock())
			.compile();
		useCase = unit;
		notificationRepo = unitRef.get(NOTIFICATION_REPOSITORY);
		cache = unitRef.get<NotificationCachePort>(NOTIFICATION_CACHE);
	});

	it("모든 알림을 읽음 처리하고 캐시를 무효화해야 한다", async () => {
		notificationRepo.markAllAsRead.mockResolvedValue({ count: 5 });

		const result = await useCase.execute(mockUserId);

		expect(notificationRepo.markAllAsRead).toHaveBeenCalledWith(mockUserId);
		expect(cache.invalidateUnreadCount).toHaveBeenCalledWith(mockUserId);
		expect(result.count).toBe(5);
	});
});
