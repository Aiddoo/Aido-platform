import { Test, type TestingModule } from "@nestjs/testing";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import type { Notification, PushToken } from "@/generated/prisma/client";
import { NotificationRepository } from "./notification.repository";
import { NotificationService } from "./notification.service";
import { PUSH_PROVIDER } from "./providers";
import type { PushProvider } from "./providers/push-provider.interface";
import type { CreateNotificationData } from "./types/notification.types";

describe("NotificationService", () => {
	let service: NotificationService;
	let mockRepository: jest.Mocked<NotificationRepository>;
	let mockPaginationService: jest.Mocked<PaginationService>;
	let mockPushProvider: jest.Mocked<PushProvider>;

	// ==========================================================================
	// Mock Factory Functions
	// ==========================================================================

	const createMockNotification = (
		overrides: Partial<Notification> = {},
	): Notification => ({
		id: 1,
		userId: "user-1",
		type: "FOLLOW_NEW",
		title: "새로운 친구 요청",
		body: "홍길동님이 친구가 되고 싶어해요",
		isRead: false,
		route: "/friends",
		todoId: null,
		friendId: "friend-1",
		nudgeId: null,
		cheerId: null,
		metadata: null,
		createdAt: new Date("2024-01-15T10:00:00Z"),
		readAt: null,
		...overrides,
	});

	const createMockPushToken = (
		overrides: Partial<PushToken> = {},
	): PushToken => ({
		id: 1,
		userId: "user-1",
		token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
		deviceId: "device-1",
		platform: "IOS",
		isActive: true,
		createdAt: new Date("2024-01-15T10:00:00Z"),
		updatedAt: new Date("2024-01-15T10:00:00Z"),
		lastUsedAt: new Date("2024-01-15T10:00:00Z"),
		...overrides,
	});

	// ==========================================================================
	// Setup
	// ==========================================================================

	beforeEach(async () => {
		mockRepository = {
			createNotification: jest.fn(),
			createManyNotifications: jest.fn(),
			findNotificationById: jest.fn(),
			findNotificationsByUser: jest.fn(),
			markAsRead: jest.fn(),
			markAllAsRead: jest.fn(),
			countUnread: jest.fn(),
			deleteNotification: jest.fn(),
			deleteOldNotifications: jest.fn(),
			registerPushToken: jest.fn(),
			findPushTokenByToken: jest.fn(),
			findPushTokensByUser: jest.fn(),
			findActivePushTokensByUsers: jest.fn(),
			deactivatePushToken: jest.fn(),
			deletePushToken: jest.fn(),
			deleteAllPushTokensByUser: jest.fn(),
			deactivateInvalidTokens: jest.fn(),
		} as unknown as jest.Mocked<NotificationRepository>;

		mockPaginationService = {
			normalizeCursorPagination: jest.fn().mockReturnValue({
				cursor: undefined,
				size: 20,
			}),
			createCursorPaginatedResponse: jest.fn().mockImplementation((params) => {
				const { items, size } = params;
				const hasMore = items.length > size;
				const data = hasMore ? items.slice(0, size) : items;
				const nextCursor =
					hasMore && data.length > 0 ? data[data.length - 1].id : null;
				return {
					data,
					pageInfo: {
						hasNextPage: hasMore,
						nextCursor,
					},
				};
			}),
		} as unknown as jest.Mocked<PaginationService>;

		mockPushProvider = {
			name: "expo",
			validateToken: jest.fn().mockReturnValue(true),
			send: jest.fn(),
			sendBatch: jest.fn().mockResolvedValue({
				total: 1,
				successCount: 1,
				failureCount: 0,
				results: [{ success: true, ticketId: "ticket-1" }],
				invalidTokens: [],
			}),
		} as unknown as jest.Mocked<PushProvider>;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				NotificationService,
				{
					provide: NotificationRepository,
					useValue: mockRepository,
				},
				{
					provide: PaginationService,
					useValue: mockPaginationService,
				},
				{
					provide: PUSH_PROVIDER,
					useValue: mockPushProvider,
				},
			],
		}).compile();

		service = module.get<NotificationService>(NotificationService);
	});

	// ==========================================================================
	// 푸시 토큰 관리 테스트
	// ==========================================================================

	describe("registerPushToken", () => {
		it("유효한 토큰을 등록해야 한다", async () => {
			// Given
			const data = {
				userId: "user-1",
				token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
				deviceId: "device-1",
				platform: "IOS" as const,
			};
			const expectedToken = createMockPushToken();
			mockRepository.registerPushToken.mockResolvedValue(expectedToken);

			// When
			const result = await service.registerPushToken(data);

			// Then
			expect(mockPushProvider.validateToken).toHaveBeenCalledWith(data.token);
			expect(mockRepository.registerPushToken).toHaveBeenCalledWith(data);
			expect(result).toEqual(expectedToken);
		});

		it("유효하지 않은 토큰이면 예외를 던져야 한다", async () => {
			// Given
			const data = {
				userId: "user-1",
				token: "invalid-token",
				deviceId: "device-1",
			};
			mockPushProvider.validateToken.mockReturnValue(false);

			// When & Then
			await expect(service.registerPushToken(data)).rejects.toThrow(
				BusinessException,
			);
			expect(mockRepository.registerPushToken).not.toHaveBeenCalled();
		});
	});

	describe("unregisterPushToken", () => {
		it("푸시 토큰을 삭제해야 한다", async () => {
			// Given
			mockRepository.deletePushToken.mockResolvedValue(createMockPushToken());

			// When
			await service.unregisterPushToken("user-1", "device-1");

			// Then
			expect(mockRepository.deletePushToken).toHaveBeenCalledWith(
				"user-1",
				"device-1",
			);
		});

		it("토큰이 없어도 예외를 던지지 않아야 한다", async () => {
			// Given
			mockRepository.deletePushToken.mockRejectedValue(new Error("Not found"));

			// When & Then
			await expect(
				service.unregisterPushToken("user-1", "device-1"),
			).resolves.not.toThrow();
		});
	});

	describe("unregisterAllPushTokens", () => {
		it("사용자의 모든 푸시 토큰을 삭제해야 한다", async () => {
			// Given
			mockRepository.deleteAllPushTokensByUser.mockResolvedValue({ count: 3 });

			// When
			await service.unregisterAllPushTokens("user-1");

			// Then
			expect(mockRepository.deleteAllPushTokensByUser).toHaveBeenCalledWith(
				"user-1",
			);
		});
	});

	// ==========================================================================
	// 알림 생성 및 발송 테스트
	// ==========================================================================

	describe("createAndSend", () => {
		it("알림을 생성하고 푸시를 발송해야 한다", async () => {
			// Given
			const data: CreateNotificationData = {
				userId: "user-1",
				type: "FOLLOW_NEW",
				title: "새로운 친구 요청",
				body: "홍길동님이 친구가 되고 싶어해요",
				route: "/friends",
				friendId: "friend-1",
			};
			const notification = createMockNotification();
			const pushToken = createMockPushToken();

			mockRepository.createNotification.mockResolvedValue(notification);
			mockRepository.findPushTokensByUser.mockResolvedValue([pushToken]);

			// When
			const result = await service.createAndSend(data);

			// Then
			expect(mockRepository.createNotification).toHaveBeenCalledWith(data);
			expect(result).toEqual(notification);

			// 비동기 푸시 발송 대기
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(mockRepository.findPushTokensByUser).toHaveBeenCalledWith({
				userId: "user-1",
				activeOnly: true,
			});
		});

		it("푸시 발송 실패해도 알림 생성은 성공해야 한다", async () => {
			// Given
			const data: CreateNotificationData = {
				userId: "user-1",
				type: "FOLLOW_NEW",
				title: "새로운 친구 요청",
				body: "홍길동님이 친구가 되고 싶어해요",
			};
			const notification = createMockNotification();

			mockRepository.createNotification.mockResolvedValue(notification);
			mockRepository.findPushTokensByUser.mockRejectedValue(
				new Error("Push failed"),
			);

			// When
			const result = await service.createAndSend(data);

			// Then
			expect(result).toEqual(notification);
		});
	});

	describe("createAndSendBatch", () => {
		it("여러 알림을 일괄 생성하고 푸시를 발송해야 한다", async () => {
			// Given
			const dataList: CreateNotificationData[] = [
				{
					userId: "user-1",
					type: "MORNING_REMINDER",
					title: "좋은 아침이에요!",
					body: "오늘 3개의 할일이 기다리고 있어요",
				},
				{
					userId: "user-2",
					type: "MORNING_REMINDER",
					title: "좋은 아침이에요!",
					body: "오늘 5개의 할일이 기다리고 있어요",
				},
			];
			const tokens = [
				createMockPushToken({ userId: "user-1" }),
				createMockPushToken({ id: 2, userId: "user-2" }),
			];

			mockRepository.createManyNotifications.mockResolvedValue({ count: 2 });
			mockRepository.findActivePushTokensByUsers.mockResolvedValue(tokens);

			// When
			const result = await service.createAndSendBatch(dataList);

			// Then
			expect(mockRepository.createManyNotifications).toHaveBeenCalledWith(
				dataList,
			);
			expect(result.count).toBe(2);

			// 비동기 푸시 발송 대기
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(mockRepository.findActivePushTokensByUsers).toHaveBeenCalledWith([
				"user-1",
				"user-2",
			]);
		});

		it("빈 목록이면 아무 작업도 하지 않아야 한다", async () => {
			// When
			const result = await service.createAndSendBatch([]);

			// Then
			expect(result.count).toBe(0);
			expect(mockRepository.createManyNotifications).not.toHaveBeenCalled();
		});
	});

	describe("createOnly", () => {
		it("알림만 생성하고 푸시는 발송하지 않아야 한다", async () => {
			// Given
			const data: CreateNotificationData = {
				userId: "user-1",
				type: "SYSTEM_NOTICE",
				title: "시스템 공지",
				body: "서비스 점검 예정",
			};
			const notification = createMockNotification({
				type: "SYSTEM_NOTICE",
				title: "시스템 공지",
				body: "서비스 점검 예정",
			});

			mockRepository.createNotification.mockResolvedValue(notification);

			// When
			const result = await service.createOnly(data);

			// Then
			expect(mockRepository.createNotification).toHaveBeenCalledWith(data);
			expect(result).toEqual(notification);
			expect(mockRepository.findPushTokensByUser).not.toHaveBeenCalled();
		});
	});

	// ==========================================================================
	// 알림 조회 테스트
	// ==========================================================================

	describe("getNotifications", () => {
		it("알림 목록을 페이지네이션으로 조회해야 한다", async () => {
			// Given
			const notifications = [
				createMockNotification({ id: 1 }),
				createMockNotification({ id: 2 }),
			];
			mockRepository.findNotificationsByUser.mockResolvedValue(notifications);

			// When
			const result = await service.getNotifications({
				userId: "user-1",
				size: 20,
			});

			// Then
			expect(
				mockPaginationService.normalizeCursorPagination,
			).toHaveBeenCalledWith({
				cursor: undefined,
				size: 20,
			});
			expect(mockRepository.findNotificationsByUser).toHaveBeenCalledWith({
				userId: "user-1",
				cursor: undefined,
				size: 20,
				unreadOnly: undefined,
			});
			expect(result.items).toHaveLength(2);
		});

		it("읽지 않은 알림만 필터링해야 한다", async () => {
			// Given
			const notifications = [createMockNotification({ isRead: false })];
			mockRepository.findNotificationsByUser.mockResolvedValue(notifications);

			// When
			await service.getNotifications({
				userId: "user-1",
				unreadOnly: true,
			});

			// Then
			expect(mockRepository.findNotificationsByUser).toHaveBeenCalledWith(
				expect.objectContaining({
					unreadOnly: true,
				}),
			);
		});

		it("커서 기반 페이지네이션을 적용해야 한다", async () => {
			// Given
			mockPaginationService.normalizeCursorPagination.mockReturnValue({
				cursor: 5,
				size: 20,
				take: 21,
			});
			const notifications = [createMockNotification({ id: 4 })];
			mockRepository.findNotificationsByUser.mockResolvedValue(notifications);

			// When
			await service.getNotifications({
				userId: "user-1",
				cursor: 5,
				size: 20,
			});

			// Then
			expect(mockRepository.findNotificationsByUser).toHaveBeenCalledWith(
				expect.objectContaining({
					cursor: 5,
				}),
			);
		});
	});

	describe("getUnreadCount", () => {
		it("읽지 않은 알림 수를 반환해야 한다", async () => {
			// Given
			mockRepository.countUnread.mockResolvedValue(5);

			// When
			const result = await service.getUnreadCount("user-1");

			// Then
			expect(mockRepository.countUnread).toHaveBeenCalledWith("user-1");
			expect(result).toBe(5);
		});
	});

	// ==========================================================================
	// 읽음 처리 테스트
	// ==========================================================================

	describe("markAsRead", () => {
		it("알림을 읽음 처리해야 한다", async () => {
			// Given
			const notification = createMockNotification({ isRead: false });
			mockRepository.findNotificationById.mockResolvedValue(notification);
			mockRepository.markAsRead.mockResolvedValue(
				createMockNotification({ isRead: true, readAt: new Date() }),
			);

			// When
			await service.markAsRead("user-1", 1);

			// Then
			expect(mockRepository.findNotificationById).toHaveBeenCalledWith(1);
			expect(mockRepository.markAsRead).toHaveBeenCalledWith(1);
		});

		it("알림이 없으면 예외를 던져야 한다", async () => {
			// Given
			mockRepository.findNotificationById.mockResolvedValue(null);

			// When & Then
			await expect(service.markAsRead("user-1", 999)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 알림이면 예외를 던져야 한다", async () => {
			// Given
			const notification = createMockNotification({ userId: "other-user" });
			mockRepository.findNotificationById.mockResolvedValue(notification);

			// When & Then
			await expect(service.markAsRead("user-1", 1)).rejects.toThrow(
				BusinessException,
			);
			expect(mockRepository.markAsRead).not.toHaveBeenCalled();
		});

		it("이미 읽은 알림이면 아무 작업도 하지 않아야 한다", async () => {
			// Given
			const notification = createMockNotification({ isRead: true });
			mockRepository.findNotificationById.mockResolvedValue(notification);

			// When
			await service.markAsRead("user-1", 1);

			// Then
			expect(mockRepository.markAsRead).not.toHaveBeenCalled();
		});
	});

	describe("markAllAsRead", () => {
		it("모든 알림을 읽음 처리해야 한다", async () => {
			// Given
			mockRepository.markAllAsRead.mockResolvedValue({ count: 5 });

			// When
			const result = await service.markAllAsRead("user-1");

			// Then
			expect(mockRepository.markAllAsRead).toHaveBeenCalledWith("user-1");
			expect(result.count).toBe(5);
		});
	});

	// ==========================================================================
	// 관리 기능 테스트
	// ==========================================================================

	describe("cleanupOldNotifications", () => {
		it("90일 이상 된 알림을 삭제해야 한다", async () => {
			// Given
			mockRepository.deleteOldNotifications.mockResolvedValue({ count: 10 });

			// When
			const result = await service.cleanupOldNotifications();

			// Then
			expect(mockRepository.deleteOldNotifications).toHaveBeenCalledWith(90);
			expect(result.count).toBe(10);
		});

		it("지정된 일수 이상 된 알림을 삭제해야 한다", async () => {
			// Given
			mockRepository.deleteOldNotifications.mockResolvedValue({ count: 5 });

			// When
			const result = await service.cleanupOldNotifications(30);

			// Then
			expect(mockRepository.deleteOldNotifications).toHaveBeenCalledWith(30);
			expect(result.count).toBe(5);
		});
	});

	// ==========================================================================
	// 푸시 발송 (Private 메서드 간접 테스트)
	// ==========================================================================

	describe("sendPushToUser (간접 테스트)", () => {
		it("활성 토큰이 없으면 푸시를 발송하지 않아야 한다", async () => {
			// Given
			const data: CreateNotificationData = {
				userId: "user-1",
				type: "FOLLOW_NEW",
				title: "테스트",
				body: "테스트 알림",
			};
			const notification = createMockNotification();

			mockRepository.createNotification.mockResolvedValue(notification);
			mockRepository.findPushTokensByUser.mockResolvedValue([]);

			// When
			await service.createAndSend(data);

			// 비동기 푸시 발송 대기
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Then
			expect(mockPushProvider.sendBatch).not.toHaveBeenCalled();
		});

		it("잘못된 토큰을 비활성화해야 한다", async () => {
			// Given
			const data: CreateNotificationData = {
				userId: "user-1",
				type: "FOLLOW_NEW",
				title: "테스트",
				body: "테스트 알림",
			};
			const notification = createMockNotification();
			const pushToken = createMockPushToken();

			mockRepository.createNotification.mockResolvedValue(notification);
			mockRepository.findPushTokensByUser.mockResolvedValue([pushToken]);
			mockPushProvider.sendBatch.mockResolvedValue({
				total: 1,
				successCount: 0,
				failureCount: 1,
				results: [
					{
						success: false,
						error: "DeviceNotRegistered",
						errorCode: "DeviceNotRegistered",
					},
				],
				invalidTokens: [pushToken.token],
			});
			mockRepository.deactivateInvalidTokens.mockResolvedValue({ count: 1 });

			// When
			await service.createAndSend(data);

			// 비동기 푸시 발송 대기
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Then
			expect(mockRepository.deactivateInvalidTokens).toHaveBeenCalledWith([
				pushToken.token,
			]);
		});
	});
});
