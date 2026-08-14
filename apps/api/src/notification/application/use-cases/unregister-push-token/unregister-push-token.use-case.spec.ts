/**
 * UnregisterPushTokenUseCase 단위 테스트
 *
 * - deviceId 있으면 단건 해제, RecordNotFound(P2025)는 우아하게 스킵
 * - deviceId 없으면 사용자 전체 토큰 해제
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createNotificationCacheMock } from "@test/mocks/ports";

import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "../../ports/notification-cache.port";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
	PushTokenNotFoundError,
} from "../../ports/notification.repository.port";
import { UnregisterPushTokenUseCase } from "./unregister-push-token.use-case";

describe("UnregisterPushTokenUseCase", () => {
	let useCase: UnregisterPushTokenUseCase;
	let repository: Mocked<NotificationRepositoryPort>;
	let cache: Mocked<NotificationCachePort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(UnregisterPushTokenUseCase)
			.mock<NotificationCachePort>(NOTIFICATION_CACHE)
			.impl(() => createNotificationCacheMock())
			.compile();
		useCase = unit;
		repository = unitRef.get(NOTIFICATION_REPOSITORY);
		cache = unitRef.get<NotificationCachePort>(NOTIFICATION_CACHE);
	});

	it("deviceId가 있으면 단건 해제 + 캐시 무효화", async () => {
		await useCase.execute("user-1", "device-1");

		expect(repository.deletePushToken).toHaveBeenCalledWith("user-1", "device-1");
		expect(cache.invalidatePushTokens).toHaveBeenCalledWith("user-1");
		expect(repository.deleteAllPushTokensByUser).not.toHaveBeenCalled();
	});

	it("단건 해제 시 RecordNotFound(P2025)는 우아하게 스킵한다", async () => {
		repository.deletePushToken.mockRejectedValue(new PushTokenNotFoundError());

		await expect(useCase.execute("user-1", "device-1")).resolves.toBeUndefined();
	});

	it("deviceId가 없으면 사용자 전체 토큰을 해제한다", async () => {
		repository.deleteAllPushTokensByUser.mockResolvedValue({ count: 3 });

		await useCase.execute("user-1");

		expect(repository.deleteAllPushTokensByUser).toHaveBeenCalledWith("user-1");
		expect(cache.invalidatePushTokens).toHaveBeenCalledWith("user-1");
		expect(repository.deletePushToken).not.toHaveBeenCalled();
	});
});
