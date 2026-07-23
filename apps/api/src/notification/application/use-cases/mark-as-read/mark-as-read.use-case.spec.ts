/**
 * MarkAsReadUseCase 단위 테스트
 *
 * - 소유 알림 읽음 처리 + 캐시 무효화
 * - 부재(NOTIFICATION_1004) / 타 사용자(NOTIFICATION_1005) / 이미 읽음(무동작)
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { NotificationBuilder } from "@test/builders";
import { createNotificationCacheMock } from "@test/mocks/ports";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import { MarkAsReadUseCase } from "./mark-as-read.use-case";

describe("MarkAsReadUseCase", () => {
	let useCase: MarkAsReadUseCase;
	let notificationRepo: Mocked<NotificationRepositoryPort>;
	let cache: Mocked<NotificationCachePort>;

	const mockUserId = "user-1";

	beforeEach(async () => {
		NotificationBuilder.resetIdCounter();

		const { unit, unitRef } = await TestBed.solitary(MarkAsReadUseCase)
			.mock<NotificationCachePort>(NOTIFICATION_CACHE)
			.impl(() => createNotificationCacheMock())
			.compile();
		useCase = unit;
		notificationRepo = unitRef.get(NOTIFICATION_REPOSITORY);
		cache = unitRef.get<NotificationCachePort>(NOTIFICATION_CACHE);
	});

	it("소유한 미읽음 알림을 읽음 처리하고 캐시를 무효화해야 한다", async () => {
		const notification = NotificationBuilder.create(mockUserId)
			.withId(1)
			.asUnread()
			.build();
		notificationRepo.findNotificationById.mockResolvedValue(notification);
		notificationRepo.markAsRead.mockResolvedValue(true);

		await useCase.execute(mockUserId, 1);

		expect(notificationRepo.markAsRead).toHaveBeenCalledWith(1, mockUserId);
		expect(cache.invalidateUnreadCount).toHaveBeenCalledWith(mockUserId);
	});

	it("알림이 없으면 NOTIFICATION_1004", async () => {
		notificationRepo.findNotificationById.mockResolvedValue(null);

		await expect(useCase.execute(mockUserId, 999)).rejects.toMatchObject({
			errorCode: "NOTIFICATION_1004",
		});
		expect(notificationRepo.markAsRead).not.toHaveBeenCalled();
	});

	it("다른 사용자의 알림이면 NOTIFICATION_1005", async () => {
		const notification = NotificationBuilder.create("other-user")
			.withId(1)
			.build();
		notificationRepo.findNotificationById.mockResolvedValue(notification);

		await expect(useCase.execute(mockUserId, 1)).rejects.toMatchObject({
			errorCode: "NOTIFICATION_1005",
		});
		expect(notificationRepo.markAsRead).not.toHaveBeenCalled();
	});

	it("이미 읽은 알림이면 무동작", async () => {
		const notification = NotificationBuilder.create(mockUserId)
			.withId(1)
			.asRead()
			.build();
		notificationRepo.findNotificationById.mockResolvedValue(notification);

		await useCase.execute(mockUserId, 1);

		expect(notificationRepo.markAsRead).not.toHaveBeenCalled();
	});
});
