/**
 * GetUnreadCountUseCase 단위 테스트 — 캐시 경유 미읽음 수 조회
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createNotificationCacheMock } from "@test/mocks/ports";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import { GetUnreadCountUseCase } from "./get-unread-count.use-case";

describe("GetUnreadCountUseCase", () => {
	let useCase: GetUnreadCountUseCase;
	let notificationRepo: Mocked<NotificationRepositoryPort>;
	let cache: Mocked<NotificationCachePort>;

	const mockUserId = "user-1";

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetUnreadCountUseCase)
			.mock<NotificationCachePort>(NOTIFICATION_CACHE)
			.impl(() => createNotificationCacheMock())
			.compile();
		useCase = unit;
		notificationRepo = unitRef.get(NOTIFICATION_REPOSITORY);
		cache = unitRef.get<NotificationCachePort>(NOTIFICATION_CACHE);

		cache.wrapUnreadCount.mockImplementation((_userId, factory) => factory());
	});

	it("캐시를 통해 읽지 않은 알림 수를 반환해야 한다", async () => {
		notificationRepo.countUnread.mockResolvedValue(5);

		const result = await useCase.execute(mockUserId);

		expect(cache.wrapUnreadCount).toHaveBeenCalledWith(
			mockUserId,
			expect.any(Function),
		);
		expect(result).toBe(5);
	});
});
