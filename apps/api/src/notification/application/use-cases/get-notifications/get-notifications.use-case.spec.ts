/**
 * GetNotificationsUseCase 단위 테스트
 *
 * - 카테고리 → 알림 타입 배열 변환
 * - 커서 페이지네이션 정규화·조회 위임
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { NotificationBuilder } from "@test/builders";
import { PaginationService } from "@/shared/application/pagination";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import { GetNotificationsUseCase } from "./get-notifications.use-case";

describe("GetNotificationsUseCase", () => {
	let useCase: GetNotificationsUseCase;
	let notificationRepo: Mocked<NotificationRepositoryPort>;
	let paginationService: Mocked<PaginationService>;

	const mockUserId = "user-1";

	beforeEach(async () => {
		NotificationBuilder.resetIdCounter();

		const { unit, unitRef } = await TestBed.solitary(
			GetNotificationsUseCase,
		).compile();
		useCase = unit;
		notificationRepo = unitRef.get(NOTIFICATION_REPOSITORY);
		paginationService = unitRef.get(PaginationService);

		paginationService.normalizeCursorPagination.mockReturnValue({
			cursor: undefined,
			size: 20,
			take: 21,
		});
		paginationService.createCursorPaginatedResponse.mockImplementation(
			(params) => {
				const { items, size } = params;
				const hasNext = items.length > size;
				const actualItems = hasNext ? items.slice(0, size) : items;
				return {
					items: actualItems,
					pagination: {
						hasNext,
						nextCursor: null,
						size,
					},
				};
			},
		);
	});

	it("알림 목록을 페이지네이션으로 조회해야 한다", async () => {
		const notifications = [
			NotificationBuilder.create(mockUserId).withId(1).build(),
			NotificationBuilder.create(mockUserId).withId(2).build(),
		];
		notificationRepo.findNotificationsByUser.mockResolvedValue(notifications);

		const result = await useCase.execute({ userId: mockUserId, size: 20 });

		expect(paginationService.normalizeCursorPagination).toHaveBeenCalledWith({
			cursor: undefined,
			size: 20,
		});
		expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith({
			userId: mockUserId,
			cursor: undefined,
			size: 20,
			unreadOnly: undefined,
			types: undefined,
		});
		expect(result.items).toHaveLength(2);
	});

	it("unreadOnly 필터를 전달해야 한다", async () => {
		notificationRepo.findNotificationsByUser.mockResolvedValue([]);

		await useCase.execute({ userId: mockUserId, unreadOnly: true });

		expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
			expect.objectContaining({ unreadOnly: true }),
		);
	});

	it("category가 'SOCIAL'이면 소셜 타입 배열을 전달해야 한다", async () => {
		notificationRepo.findNotificationsByUser.mockResolvedValue([]);

		await useCase.execute({ userId: mockUserId, category: "SOCIAL" });

		expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
			expect.objectContaining({
				types: expect.arrayContaining([
					"FOLLOW_NEW",
					"FOLLOW_ACCEPTED",
					"NUDGE_RECEIVED",
					"CHEER_RECEIVED",
					"FRIEND_COMPLETED",
				]),
			}),
		);
	});

	it("category가 'NOTICE'이면 공지 타입 배열을 전달해야 한다", async () => {
		notificationRepo.findNotificationsByUser.mockResolvedValue([]);

		await useCase.execute({ userId: mockUserId, category: "NOTICE" });

		expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
			expect.objectContaining({
				types: expect.arrayContaining([
					"SYSTEM_NOTICE",
					"ADMIN_BROADCAST",
					"ADMIN_TARGETED",
				]),
			}),
		);
	});

	it("category가 'ALL'이면 types를 undefined로 전달해야 한다", async () => {
		notificationRepo.findNotificationsByUser.mockResolvedValue([]);

		await useCase.execute({ userId: mockUserId, category: "ALL" });

		expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
			expect.objectContaining({ types: undefined }),
		);
	});

	it("커서를 전달해야 한다", async () => {
		paginationService.normalizeCursorPagination.mockReturnValue({
			cursor: 5,
			size: 20,
			take: 21,
		});
		notificationRepo.findNotificationsByUser.mockResolvedValue([]);

		await useCase.execute({ userId: mockUserId, cursor: 5, size: 20 });

		expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
			expect.objectContaining({ cursor: 5 }),
		);
	});
});
