/**
 * MarkAllAsReadUseCase 단위 테스트 — 전체 읽음 처리 + 캐시 무효화
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import { MarkAllAsReadUseCase } from "./mark-all-as-read.use-case";

describe("MarkAllAsReadUseCase", () => {
	let useCase: MarkAllAsReadUseCase;
	let notificationRepo: Mocked<NotificationRepositoryPort>;
	let cacheService: Mocked<CacheService>;

	const mockUserId = "user-1";

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(MarkAllAsReadUseCase).compile();
		useCase = unit;
		notificationRepo = unitRef.get(NOTIFICATION_REPOSITORY);
		cacheService = unitRef.get(CacheService);
	});

	it("모든 알림을 읽음 처리하고 캐시를 무효화해야 한다", async () => {
		notificationRepo.markAllAsRead.mockResolvedValue({ count: 5 });

		const result = await useCase.execute(mockUserId);

		expect(notificationRepo.markAllAsRead).toHaveBeenCalledWith(mockUserId);
		expect(cacheService.invalidateUnreadCount).toHaveBeenCalledWith(mockUserId);
		expect(result.count).toBe(5);
	});
});
