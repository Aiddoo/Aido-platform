import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createNotificationCacheMock, createNotificationRepositoryMock } from "@test/mocks/ports";

import { NOTIFICATION_CACHE, type NotificationCachePort } from "../ports/notification-cache.port";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../ports/notification.repository.port";
import { NotificationAccountCleanup } from "./notification-account-cleanup";

describe("NotificationAccountCleanup", () => {
	it("bounded context 저장소에 actor 개인정보 정리를 위임한다", async () => {
		const { unit, unitRef } = await TestBed.solitary(NotificationAccountCleanup)
			.mock(NOTIFICATION_REPOSITORY)
			.impl(createNotificationRepositoryMock)
			.mock(NOTIFICATION_CACHE)
			.impl(createNotificationCacheMock)
			.compile();
		const repository = unitRef.get<Mocked<NotificationRepositoryPort>>(NOTIFICATION_REPOSITORY);
		const cache = unitRef.get<Mocked<NotificationCachePort>>(NOTIFICATION_CACHE);
		repository.deleteNotificationsByActorId.mockResolvedValue({
			count: 3,
			affectedUserIds: ["recipient-1", "recipient-2"],
		});

		const result = await unit.cleanupInTransaction("user-1");
		expect(result).toEqual({ affectedUserIds: ["recipient-1", "recipient-2"] });
		expect(repository.deleteNotificationsByActorId).toHaveBeenCalledWith("user-1");
		expect(cache.invalidateUnreadCount).not.toHaveBeenCalled();

		cache.invalidateUnreadCount.mockRejectedValueOnce(new Error("캐시 연결 오류"));
		await expect(unit.settleAfterCommit(result)).resolves.toBeUndefined();
		expect(cache.invalidateUnreadCount).toHaveBeenCalledTimes(2);
		expect(cache.invalidateUnreadCount).toHaveBeenCalledWith("recipient-1");
		expect(cache.invalidateUnreadCount).toHaveBeenCalledWith("recipient-2");
	});
});
