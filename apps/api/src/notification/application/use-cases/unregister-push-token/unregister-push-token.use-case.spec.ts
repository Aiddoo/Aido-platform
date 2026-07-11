/**
 * UnregisterPushTokenUseCase 단위 테스트
 *
 * - deviceId 있으면 단건 해제, RecordNotFound(P2025)는 우아하게 스킵
 * - deviceId 없으면 사용자 전체 토큰 해제
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { Prisma } from "@/generated/prisma/client";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import { UnregisterPushTokenUseCase } from "./unregister-push-token.use-case";

describe("UnregisterPushTokenUseCase", () => {
	let useCase: UnregisterPushTokenUseCase;
	let repository: Mocked<NotificationRepositoryPort>;
	let cacheService: Mocked<CacheService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			UnregisterPushTokenUseCase,
		).compile();
		useCase = unit;
		repository = unitRef.get(NOTIFICATION_REPOSITORY);
		cacheService = unitRef.get(CacheService);
	});

	it("deviceId가 있으면 단건 해제 + 캐시 무효화", async () => {
		await useCase.execute("user-1", "device-1");

		expect(repository.deletePushToken).toHaveBeenCalledWith(
			"user-1",
			"device-1",
		);
		expect(cacheService.invalidatePushTokens).toHaveBeenCalledWith("user-1");
		expect(repository.deleteAllPushTokensByUser).not.toHaveBeenCalled();
	});

	it("단건 해제 시 RecordNotFound(P2025)는 우아하게 스킵한다", async () => {
		repository.deletePushToken.mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError("Not found", {
				code: "P2025",
				clientVersion: "7.0.0",
			}),
		);

		await expect(
			useCase.execute("user-1", "device-1"),
		).resolves.toBeUndefined();
	});

	it("deviceId가 없으면 사용자 전체 토큰을 해제한다", async () => {
		repository.deleteAllPushTokensByUser.mockResolvedValue({ count: 3 });

		await useCase.execute("user-1");

		expect(repository.deleteAllPushTokensByUser).toHaveBeenCalledWith("user-1");
		expect(cacheService.invalidatePushTokens).toHaveBeenCalledWith("user-1");
		expect(repository.deletePushToken).not.toHaveBeenCalled();
	});
});
