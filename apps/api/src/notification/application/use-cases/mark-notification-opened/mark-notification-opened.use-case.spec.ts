/**
 * MarkNotificationOpenedUseCase 단위 테스트
 *
 * - 멱등 기록 성공 시 미읽음 카운트 캐시 무효화 + true 반환
 * - 기록 실패(이미 열림/타 사용자/부재) 시 캐시 무효화 없이 false 반환
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createNotificationCacheMock } from "@test/mocks/ports/notification-cache.mock";
import { createNotificationRepositoryMock } from "@test/mocks/ports/notification.mock";

import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import { MarkNotificationOpenedUseCase } from "./mark-notification-opened.use-case";

describe("MarkNotificationOpenedUseCase", () => {
	let useCase: MarkNotificationOpenedUseCase;
	let repository: Mocked<NotificationRepositoryPort>;
	let cache: Mocked<NotificationCachePort>;

	const mockUserId = "user-1";
	const mockNotificationId = 42;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(MarkNotificationOpenedUseCase)
			.mock<NotificationRepositoryPort>(NOTIFICATION_REPOSITORY)
			.impl(() => createNotificationRepositoryMock())
			.mock<NotificationCachePort>(NOTIFICATION_CACHE)
			.impl(() => createNotificationCacheMock())
			.compile();
		useCase = unit;
		repository = unitRef.get<NotificationRepositoryPort>(NOTIFICATION_REPOSITORY);
		cache = unitRef.get<NotificationCachePort>(NOTIFICATION_CACHE);
	});

	it("열림 기록에 성공하면 미읽음 카운트를 무효화하고 true를 반환한다", async () => {
		repository.markAsOpened.mockResolvedValue(true);

		const result = await useCase.execute(mockUserId, mockNotificationId);

		expect(result).toBe(true);
		expect(repository.markAsOpened).toHaveBeenCalledWith(mockNotificationId, mockUserId);
		expect(cache.invalidateUnreadCount).toHaveBeenCalledWith(mockUserId);
	});

	it("열림 기록이 없으면(이미 열림/타 사용자/부재) 캐시를 무효화하지 않고 false를 반환한다", async () => {
		repository.markAsOpened.mockResolvedValue(false);

		const result = await useCase.execute(mockUserId, mockNotificationId);

		expect(result).toBe(false);
		expect(cache.invalidateUnreadCount).not.toHaveBeenCalled();
	});
});
