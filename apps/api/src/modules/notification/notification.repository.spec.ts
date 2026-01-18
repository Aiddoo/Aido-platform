import { Test, type TestingModule } from "@nestjs/testing";
import { DatabaseService } from "@/database/database.service";
import type { Notification, PushToken } from "@/generated/prisma/client";
import { NotificationRepository } from "./notification.repository";
import type {
	CreateNotificationData,
	FindNotificationsParams,
	FindPushTokensParams,
	RegisterPushTokenData,
} from "./types/notification.types";

describe("NotificationRepository", () => {
	let repository: NotificationRepository;
	let mockDatabaseService: jest.Mocked<DatabaseService>;

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
		mockDatabaseService = {
			notification: {
				create: jest.fn(),
				createMany: jest.fn(),
				findUnique: jest.fn(),
				findMany: jest.fn(),
				update: jest.fn(),
				updateMany: jest.fn(),
				delete: jest.fn(),
				deleteMany: jest.fn(),
				count: jest.fn(),
			},
			pushToken: {
				upsert: jest.fn(),
				findFirst: jest.fn(),
				findMany: jest.fn(),
				update: jest.fn(),
				updateMany: jest.fn(),
				delete: jest.fn(),
				deleteMany: jest.fn(),
			},
		} as unknown as jest.Mocked<DatabaseService>;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				NotificationRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabaseService,
				},
			],
		}).compile();

		repository = module.get<NotificationRepository>(NotificationRepository);
	});

	// ==========================================================================
	// Notification CRUD Tests
	// ==========================================================================

	describe("createNotification", () => {
		it("알림을 생성해야 한다", async () => {
			// Given
			const data: CreateNotificationData = {
				userId: "user-1",
				type: "FOLLOW_NEW",
				title: "새로운 친구 요청",
				body: "홍길동님이 친구가 되고 싶어해요",
				route: "/friends",
				friendId: "friend-1",
			};
			const expectedNotification = createMockNotification();
			(mockDatabaseService.notification.create as jest.Mock).mockResolvedValue(
				expectedNotification,
			);

			// When
			const result = await repository.createNotification(data);

			// Then
			expect(mockDatabaseService.notification.create).toHaveBeenCalledWith({
				data: {
					userId: data.userId,
					type: data.type,
					title: data.title,
					body: data.body,
					route: data.route,
					todoId: undefined,
					friendId: data.friendId,
					nudgeId: undefined,
					cheerId: undefined,
					metadata: undefined,
				},
			});
			expect(result).toEqual(expectedNotification);
		});

		it("metadata가 있는 알림을 생성해야 한다", async () => {
			// Given
			const data: CreateNotificationData = {
				userId: "user-1",
				type: "SYSTEM_NOTICE",
				title: "시스템 공지",
				body: "시스템 점검 예정",
				metadata: { externalUrl: "https://example.com" },
			};
			const expectedNotification = createMockNotification({
				type: "SYSTEM_NOTICE",
				title: "시스템 공지",
				body: "시스템 점검 예정",
				route: null,
				friendId: null,
				metadata: { externalUrl: "https://example.com" },
			});
			(mockDatabaseService.notification.create as jest.Mock).mockResolvedValue(
				expectedNotification,
			);

			// When
			const result = await repository.createNotification(data);

			// Then
			expect(mockDatabaseService.notification.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					metadata: { externalUrl: "https://example.com" },
				}),
			});
			expect(result).toEqual(expectedNotification);
		});
	});

	describe("createManyNotifications", () => {
		it("여러 알림을 일괄 생성해야 한다", async () => {
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
			(
				mockDatabaseService.notification.createMany as jest.Mock
			).mockResolvedValue({ count: 2 });

			// When
			const result = await repository.createManyNotifications(dataList);

			// Then
			expect(mockDatabaseService.notification.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining([
					expect.objectContaining({ userId: "user-1" }),
					expect.objectContaining({ userId: "user-2" }),
				]),
			});
			expect(result.count).toBe(2);
		});
	});

	describe("findNotificationById", () => {
		it("ID로 알림을 조회해야 한다", async () => {
			// Given
			const notification = createMockNotification();
			(
				mockDatabaseService.notification.findUnique as jest.Mock
			).mockResolvedValue(notification);

			// When
			const result = await repository.findNotificationById(1);

			// Then
			expect(mockDatabaseService.notification.findUnique).toHaveBeenCalledWith({
				where: { id: 1 },
			});
			expect(result).toEqual(notification);
		});

		it("알림이 없으면 null을 반환해야 한다", async () => {
			// Given
			(
				mockDatabaseService.notification.findUnique as jest.Mock
			).mockResolvedValue(null);

			// When
			const result = await repository.findNotificationById(999);

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findNotificationsByUser", () => {
		it("사용자의 알림 목록을 조회해야 한다", async () => {
			// Given
			const params: FindNotificationsParams = {
				userId: "user-1",
				size: 10,
			};
			const notifications = [
				createMockNotification({ id: 1 }),
				createMockNotification({ id: 2 }),
			];
			(
				mockDatabaseService.notification.findMany as jest.Mock
			).mockResolvedValue(notifications);

			// When
			const result = await repository.findNotificationsByUser(params);

			// Then
			expect(mockDatabaseService.notification.findMany).toHaveBeenCalledWith({
				where: { userId: "user-1" },
				take: 11, // size + 1 for pagination check
				orderBy: { createdAt: "desc" },
			});
			expect(result).toEqual(notifications);
		});

		it("커서 기반 페이지네이션을 적용해야 한다", async () => {
			// Given
			const params: FindNotificationsParams = {
				userId: "user-1",
				cursor: 5,
				size: 10,
			};
			const notifications = [createMockNotification({ id: 4 })];
			(
				mockDatabaseService.notification.findMany as jest.Mock
			).mockResolvedValue(notifications);

			// When
			const result = await repository.findNotificationsByUser(params);

			// Then
			expect(mockDatabaseService.notification.findMany).toHaveBeenCalledWith({
				where: { userId: "user-1" },
				take: 11,
				skip: 1,
				cursor: { id: 5 },
				orderBy: { createdAt: "desc" },
			});
			expect(result).toEqual(notifications);
		});

		it("읽지 않은 알림만 필터링해야 한다", async () => {
			// Given
			const params: FindNotificationsParams = {
				userId: "user-1",
				size: 10,
				unreadOnly: true,
			};
			const notifications = [createMockNotification({ isRead: false })];
			(
				mockDatabaseService.notification.findMany as jest.Mock
			).mockResolvedValue(notifications);

			// When
			await repository.findNotificationsByUser(params);

			// Then
			expect(mockDatabaseService.notification.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { userId: "user-1", isRead: false },
				}),
			);
		});
	});

	describe("markAsRead", () => {
		it("알림을 읽음 처리해야 한다", async () => {
			// Given
			const readNotification = createMockNotification({
				isRead: true,
				readAt: new Date(),
			});
			(mockDatabaseService.notification.update as jest.Mock).mockResolvedValue(
				readNotification,
			);

			// When
			const result = await repository.markAsRead(1);

			// Then
			expect(mockDatabaseService.notification.update).toHaveBeenCalledWith({
				where: { id: 1 },
				data: {
					isRead: true,
					readAt: expect.any(Date),
				},
			});
			expect(result.isRead).toBe(true);
		});
	});

	describe("markAllAsRead", () => {
		it("사용자의 모든 알림을 읽음 처리해야 한다", async () => {
			// Given
			(
				mockDatabaseService.notification.updateMany as jest.Mock
			).mockResolvedValue({ count: 5 });

			// When
			const result = await repository.markAllAsRead("user-1");

			// Then
			expect(mockDatabaseService.notification.updateMany).toHaveBeenCalledWith({
				where: {
					userId: "user-1",
					isRead: false,
				},
				data: {
					isRead: true,
					readAt: expect.any(Date),
				},
			});
			expect(result.count).toBe(5);
		});
	});

	describe("countUnread", () => {
		it("읽지 않은 알림 수를 반환해야 한다", async () => {
			// Given
			(mockDatabaseService.notification.count as jest.Mock).mockResolvedValue(
				3,
			);

			// When
			const result = await repository.countUnread("user-1");

			// Then
			expect(mockDatabaseService.notification.count).toHaveBeenCalledWith({
				where: {
					userId: "user-1",
					isRead: false,
				},
			});
			expect(result).toBe(3);
		});
	});

	describe("deleteNotification", () => {
		it("알림을 삭제해야 한다", async () => {
			// Given
			const notification = createMockNotification();
			(mockDatabaseService.notification.delete as jest.Mock).mockResolvedValue(
				notification,
			);

			// When
			const result = await repository.deleteNotification(1);

			// Then
			expect(mockDatabaseService.notification.delete).toHaveBeenCalledWith({
				where: { id: 1 },
			});
			expect(result).toEqual(notification);
		});
	});

	describe("deleteOldNotifications", () => {
		it("90일 이상 된 알림을 삭제해야 한다", async () => {
			// Given
			(
				mockDatabaseService.notification.deleteMany as jest.Mock
			).mockResolvedValue({ count: 10 });

			// When
			const result = await repository.deleteOldNotifications();

			// Then
			expect(mockDatabaseService.notification.deleteMany).toHaveBeenCalledWith({
				where: {
					createdAt: {
						lt: expect.any(Date),
					},
				},
			});
			expect(result.count).toBe(10);
		});

		it("지정된 일수 이상 된 알림을 삭제해야 한다", async () => {
			// Given
			(
				mockDatabaseService.notification.deleteMany as jest.Mock
			).mockResolvedValue({ count: 5 });

			// When
			const result = await repository.deleteOldNotifications(30);

			// Then
			expect(mockDatabaseService.notification.deleteMany).toHaveBeenCalled();
			expect(result.count).toBe(5);
		});
	});

	// ==========================================================================
	// PushToken CRUD Tests
	// ==========================================================================

	describe("registerPushToken", () => {
		it("푸시 토큰을 등록해야 한다", async () => {
			// Given
			const data: RegisterPushTokenData = {
				userId: "user-1",
				token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
				deviceId: "device-1",
				platform: "IOS",
			};
			const expectedToken = createMockPushToken();
			(mockDatabaseService.pushToken.upsert as jest.Mock).mockResolvedValue(
				expectedToken,
			);

			// When
			const result = await repository.registerPushToken(data);

			// Then
			expect(mockDatabaseService.pushToken.upsert).toHaveBeenCalledWith({
				where: {
					userId_deviceId: {
						userId: "user-1",
						deviceId: "device-1",
					},
				},
				create: {
					userId: "user-1",
					token: data.token,
					deviceId: "device-1",
					platform: "IOS",
					isActive: true,
				},
				update: {
					token: data.token,
					platform: "IOS",
					isActive: true,
					updatedAt: expect.any(Date),
				},
			});
			expect(result).toEqual(expectedToken);
		});

		it("deviceId가 없으면 기본값을 사용해야 한다", async () => {
			// Given
			const data: RegisterPushTokenData = {
				userId: "user-1",
				token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
			};
			const expectedToken = createMockPushToken({ deviceId: "default" });
			(mockDatabaseService.pushToken.upsert as jest.Mock).mockResolvedValue(
				expectedToken,
			);

			// When
			await repository.registerPushToken(data);

			// Then
			expect(mockDatabaseService.pushToken.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						userId_deviceId: {
							userId: "user-1",
							deviceId: "default",
						},
					},
				}),
			);
		});
	});

	describe("findPushTokenByToken", () => {
		it("토큰 값으로 푸시 토큰을 조회해야 한다", async () => {
			// Given
			const token = createMockPushToken();
			(mockDatabaseService.pushToken.findFirst as jest.Mock).mockResolvedValue(
				token,
			);

			// When
			const result = await repository.findPushTokenByToken(token.token);

			// Then
			expect(mockDatabaseService.pushToken.findFirst).toHaveBeenCalledWith({
				where: { token: token.token },
			});
			expect(result).toEqual(token);
		});

		it("토큰이 없으면 null을 반환해야 한다", async () => {
			// Given
			(mockDatabaseService.pushToken.findFirst as jest.Mock).mockResolvedValue(
				null,
			);

			// When
			const result = await repository.findPushTokenByToken("nonexistent-token");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findPushTokensByUser", () => {
		it("사용자의 푸시 토큰 목록을 조회해야 한다", async () => {
			// Given
			const params: FindPushTokensParams = {
				userId: "user-1",
			};
			const tokens = [
				createMockPushToken({ id: 1 }),
				createMockPushToken({ id: 2, deviceId: "device-2" }),
			];
			(mockDatabaseService.pushToken.findMany as jest.Mock).mockResolvedValue(
				tokens,
			);

			// When
			const result = await repository.findPushTokensByUser(params);

			// Then
			expect(mockDatabaseService.pushToken.findMany).toHaveBeenCalledWith({
				where: { userId: "user-1" },
				orderBy: { updatedAt: "desc" },
			});
			expect(result).toEqual(tokens);
		});

		it("활성 토큰만 필터링해야 한다", async () => {
			// Given
			const params: FindPushTokensParams = {
				userId: "user-1",
				activeOnly: true,
			};
			const tokens = [createMockPushToken({ isActive: true })];
			(mockDatabaseService.pushToken.findMany as jest.Mock).mockResolvedValue(
				tokens,
			);

			// When
			await repository.findPushTokensByUser(params);

			// Then
			expect(mockDatabaseService.pushToken.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { userId: "user-1", isActive: true },
				}),
			);
		});
	});

	describe("findActivePushTokensByUsers", () => {
		it("여러 사용자의 활성 푸시 토큰을 조회해야 한다", async () => {
			// Given
			const userIds = ["user-1", "user-2"];
			const tokens = [
				createMockPushToken({ userId: "user-1" }),
				createMockPushToken({ id: 2, userId: "user-2" }),
			];
			(mockDatabaseService.pushToken.findMany as jest.Mock).mockResolvedValue(
				tokens,
			);

			// When
			const result = await repository.findActivePushTokensByUsers(userIds);

			// Then
			expect(mockDatabaseService.pushToken.findMany).toHaveBeenCalledWith({
				where: {
					userId: { in: userIds },
					isActive: true,
				},
			});
			expect(result).toEqual(tokens);
		});
	});

	describe("deactivatePushToken", () => {
		it("푸시 토큰을 비활성화해야 한다", async () => {
			// Given
			const existingToken = createMockPushToken();
			const deactivatedToken = createMockPushToken({ isActive: false });
			(mockDatabaseService.pushToken.findFirst as jest.Mock).mockResolvedValue(
				existingToken,
			);
			(mockDatabaseService.pushToken.update as jest.Mock).mockResolvedValue(
				deactivatedToken,
			);

			// When
			const result = await repository.deactivatePushToken(existingToken.token);

			// Then
			expect(mockDatabaseService.pushToken.findFirst).toHaveBeenCalledWith({
				where: { token: existingToken.token },
			});
			expect(mockDatabaseService.pushToken.update).toHaveBeenCalledWith({
				where: { id: existingToken.id },
				data: { isActive: false },
			});
			expect(result).toEqual(deactivatedToken);
		});

		it("토큰이 없으면 null을 반환해야 한다", async () => {
			// Given
			(mockDatabaseService.pushToken.findFirst as jest.Mock).mockResolvedValue(
				null,
			);

			// When
			const result = await repository.deactivatePushToken("nonexistent-token");

			// Then
			expect(result).toBeNull();
			expect(mockDatabaseService.pushToken.update).not.toHaveBeenCalled();
		});
	});

	describe("deletePushToken", () => {
		it("푸시 토큰을 삭제해야 한다", async () => {
			// Given
			const token = createMockPushToken();
			(mockDatabaseService.pushToken.delete as jest.Mock).mockResolvedValue(
				token,
			);

			// When
			const result = await repository.deletePushToken("user-1", "device-1");

			// Then
			expect(mockDatabaseService.pushToken.delete).toHaveBeenCalledWith({
				where: {
					userId_deviceId: {
						userId: "user-1",
						deviceId: "device-1",
					},
				},
			});
			expect(result).toEqual(token);
		});
	});

	describe("deleteAllPushTokensByUser", () => {
		it("사용자의 모든 푸시 토큰을 삭제해야 한다", async () => {
			// Given
			(mockDatabaseService.pushToken.deleteMany as jest.Mock).mockResolvedValue(
				{ count: 3 },
			);

			// When
			const result = await repository.deleteAllPushTokensByUser("user-1");

			// Then
			expect(mockDatabaseService.pushToken.deleteMany).toHaveBeenCalledWith({
				where: { userId: "user-1" },
			});
			expect(result.count).toBe(3);
		});
	});

	describe("deactivateInvalidTokens", () => {
		it("잘못된 토큰들을 일괄 비활성화해야 한다", async () => {
			// Given
			const invalidTokens = ["invalid-token-1", "invalid-token-2"];
			(mockDatabaseService.pushToken.updateMany as jest.Mock).mockResolvedValue(
				{ count: 2 },
			);

			// When
			const result = await repository.deactivateInvalidTokens(invalidTokens);

			// Then
			expect(mockDatabaseService.pushToken.updateMany).toHaveBeenCalledWith({
				where: {
					token: { in: invalidTokens },
				},
				data: { isActive: false },
			});
			expect(result.count).toBe(2);
		});
	});
});
