/**
 * NotificationRepository 단위 테스트
 *
 * Suites + Builder + GWT 패턴 적용
 * - Suites: 자동 Mock 생성
 * - Builder: 테스트 데이터 생성
 * - GWT: Given/When/Then 주석
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { NotificationBuilder, PushTokenBuilder } from "@test/builders";
import { DatabaseService } from "@/database/database.service";

import { NotificationRepository } from "./notification.repository";
import type {
	CreateNotificationData,
	FindNotificationsParams,
	FindPushTokensParams,
	RegisterPushTokenData,
} from "./types/notification.types";

// =============================================================================
// Test Suite
// =============================================================================

describe("NotificationRepository", () => {
	let repository: NotificationRepository;
	let db: Mocked<DatabaseService>;

	beforeEach(async () => {
		// ID 카운터 리셋
		NotificationBuilder.resetIdCounter();
		PushTokenBuilder.resetIdCounter();

		const { unit, unitRef } = await TestBed.solitary(
			NotificationRepository,
		).compile();

		repository = unit;
		db = unitRef.get(DatabaseService) as unknown as Mocked<DatabaseService>;
	});

	afterEach(() => {
		jest.clearAllMocks();
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
				friendId: "friend-1",
			};
			const expectedNotification = NotificationBuilder.create("user-1")
				.asFollowNew("friend-1")
				.withContent("새로운 친구 요청", "홍길동님이 친구가 되고 싶어해요")
				.build();
			(db.notification.create as jest.Mock).mockResolvedValue(
				expectedNotification,
			);

			// When
			const result = await repository.createNotification(data);

			// Then
			expect(db.notification.create).toHaveBeenCalledWith({
				data: {
					userId: data.userId,
					type: data.type,
					title: data.title,
					body: data.body,
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
			const expectedNotification = NotificationBuilder.create("user-1")
				.asSystemNotice()
				.withContent("시스템 공지", "시스템 점검 예정")
				.withMetadata({ externalUrl: "https://example.com" })
				.build();
			(db.notification.create as jest.Mock).mockResolvedValue(
				expectedNotification,
			);

			// When
			const result = await repository.createNotification(data);

			// Then
			expect(db.notification.create).toHaveBeenCalledWith({
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
			(db.notification.createMany as jest.Mock).mockResolvedValue({ count: 2 });

			// When
			const result = await repository.createManyNotifications(dataList);

			// Then
			expect(db.notification.createMany).toHaveBeenCalledWith({
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
			const notification = NotificationBuilder.create("user-1")
				.withId(1)
				.build();
			(db.notification.findUnique as jest.Mock).mockResolvedValue(notification);

			// When
			const result = await repository.findNotificationById(1);

			// Then
			expect(db.notification.findUnique).toHaveBeenCalledWith({
				where: { id: 1 },
			});
			expect(result).toEqual(notification);
		});

		it("알림이 없으면 null을 반환해야 한다", async () => {
			// Given
			(db.notification.findUnique as jest.Mock).mockResolvedValue(null);

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
				NotificationBuilder.create("user-1").withId(1).build(),
				NotificationBuilder.create("user-1").withId(2).build(),
			];
			(db.notification.findMany as jest.Mock).mockResolvedValue(notifications);

			// When
			const result = await repository.findNotificationsByUser(params);

			// Then
			expect(db.notification.findMany).toHaveBeenCalledWith({
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
			const notifications = [
				NotificationBuilder.create("user-1").withId(4).build(),
			];
			(db.notification.findMany as jest.Mock).mockResolvedValue(notifications);

			// When
			const result = await repository.findNotificationsByUser(params);

			// Then
			expect(db.notification.findMany).toHaveBeenCalledWith({
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
			const notifications = [
				NotificationBuilder.create("user-1").asUnread().build(),
			];
			(db.notification.findMany as jest.Mock).mockResolvedValue(notifications);

			// When
			await repository.findNotificationsByUser(params);

			// Then
			expect(db.notification.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { userId: "user-1", isRead: false },
				}),
			);
		});
	});

	describe("markAsRead", () => {
		it("알림을 읽음 처리해야 한다", async () => {
			// Given
			const readNotification = NotificationBuilder.create("user-1")
				.withId(1)
				.asRead()
				.build();
			(db.notification.update as jest.Mock).mockResolvedValue(readNotification);

			// When
			const result = await repository.markAsRead(1);

			// Then
			expect(db.notification.update).toHaveBeenCalledWith({
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
			(db.notification.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

			// When
			const result = await repository.markAllAsRead("user-1");

			// Then
			expect(db.notification.updateMany).toHaveBeenCalledWith({
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
			(db.notification.count as jest.Mock).mockResolvedValue(3);

			// When
			const result = await repository.countUnread("user-1");

			// Then
			expect(db.notification.count).toHaveBeenCalledWith({
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
			const notification = NotificationBuilder.create("user-1")
				.withId(1)
				.build();
			(db.notification.delete as jest.Mock).mockResolvedValue(notification);

			// When
			const result = await repository.deleteNotification(1);

			// Then
			expect(db.notification.delete).toHaveBeenCalledWith({
				where: { id: 1 },
			});
			expect(result).toEqual(notification);
		});
	});

	describe("deleteOldNotifications", () => {
		it("90일 이상 된 알림을 삭제해야 한다", async () => {
			// Given
			(db.notification.deleteMany as jest.Mock).mockResolvedValue({
				count: 10,
			});

			// When
			const result = await repository.deleteOldNotifications();

			// Then
			expect(db.notification.deleteMany).toHaveBeenCalledWith({
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
			(db.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

			// When
			const result = await repository.deleteOldNotifications(30);

			// Then
			expect(db.notification.deleteMany).toHaveBeenCalled();
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
			const expectedToken = PushTokenBuilder.create("user-1")
				.withToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")
				.withDeviceId("device-1")
				.withPlatform("IOS")
				.build();
			(db.pushToken.upsert as jest.Mock).mockResolvedValue(expectedToken);

			// When
			const result = await repository.registerPushToken(data);

			// Then
			expect(db.pushToken.upsert).toHaveBeenCalledWith({
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
			const expectedToken = PushTokenBuilder.create("user-1")
				.withDeviceId("default")
				.build();
			(db.pushToken.upsert as jest.Mock).mockResolvedValue(expectedToken);

			// When
			await repository.registerPushToken(data);

			// Then
			expect(db.pushToken.upsert).toHaveBeenCalledWith(
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
			const token = PushTokenBuilder.create("user-1").build();
			(db.pushToken.findFirst as jest.Mock).mockResolvedValue(token);

			// When
			const result = await repository.findPushTokenByToken(token.token);

			// Then
			expect(db.pushToken.findFirst).toHaveBeenCalledWith({
				where: { token: token.token },
			});
			expect(result).toEqual(token);
		});

		it("토큰이 없으면 null을 반환해야 한다", async () => {
			// Given
			(db.pushToken.findFirst as jest.Mock).mockResolvedValue(null);

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
				PushTokenBuilder.create("user-1").withId(1).build(),
				PushTokenBuilder.create("user-1")
					.withId(2)
					.withDeviceId("device-2")
					.build(),
			];
			(db.pushToken.findMany as jest.Mock).mockResolvedValue(tokens);

			// When
			const result = await repository.findPushTokensByUser(params);

			// Then
			expect(db.pushToken.findMany).toHaveBeenCalledWith({
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
			const tokens = [PushTokenBuilder.create("user-1").asActive().build()];
			(db.pushToken.findMany as jest.Mock).mockResolvedValue(tokens);

			// When
			await repository.findPushTokensByUser(params);

			// Then
			expect(db.pushToken.findMany).toHaveBeenCalledWith(
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
				PushTokenBuilder.create("user-1").build(),
				PushTokenBuilder.create("user-2").withId(2).build(),
			];
			(db.pushToken.findMany as jest.Mock).mockResolvedValue(tokens);

			// When
			const result = await repository.findActivePushTokensByUsers(userIds);

			// Then
			expect(db.pushToken.findMany).toHaveBeenCalledWith({
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
			const existingToken = PushTokenBuilder.create("user-1").build();
			const deactivatedToken = PushTokenBuilder.create("user-1")
				.asInactive()
				.build();
			(db.pushToken.findFirst as jest.Mock).mockResolvedValue(existingToken);
			(db.pushToken.update as jest.Mock).mockResolvedValue(deactivatedToken);

			// When
			const result = await repository.deactivatePushToken(existingToken.token);

			// Then
			expect(db.pushToken.findFirst).toHaveBeenCalledWith({
				where: { token: existingToken.token },
			});
			expect(db.pushToken.update).toHaveBeenCalledWith({
				where: { id: existingToken.id },
				data: { isActive: false },
			});
			expect(result).toEqual(deactivatedToken);
		});

		it("토큰이 없으면 null을 반환해야 한다", async () => {
			// Given
			(db.pushToken.findFirst as jest.Mock).mockResolvedValue(null);

			// When
			const result = await repository.deactivatePushToken("nonexistent-token");

			// Then
			expect(result).toBeNull();
			expect(db.pushToken.update).not.toHaveBeenCalled();
		});
	});

	describe("deletePushToken", () => {
		it("푸시 토큰을 삭제해야 한다", async () => {
			// Given
			const token = PushTokenBuilder.create("user-1").build();
			(db.pushToken.delete as jest.Mock).mockResolvedValue(token);

			// When
			const result = await repository.deletePushToken("user-1", "device-1");

			// Then
			expect(db.pushToken.delete).toHaveBeenCalledWith({
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
			(db.pushToken.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });

			// When
			const result = await repository.deleteAllPushTokensByUser("user-1");

			// Then
			expect(db.pushToken.deleteMany).toHaveBeenCalledWith({
				where: { userId: "user-1" },
			});
			expect(result.count).toBe(3);
		});
	});

	describe("deactivateInvalidTokens", () => {
		it("잘못된 토큰들을 일괄 비활성화해야 한다", async () => {
			// Given
			const invalidTokens = ["invalid-token-1", "invalid-token-2"];
			(db.pushToken.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

			// When
			const result = await repository.deactivateInvalidTokens(invalidTokens);

			// Then
			expect(db.pushToken.updateMany).toHaveBeenCalledWith({
				where: {
					token: { in: invalidTokens },
				},
				data: { isActive: false },
			});
			expect(result.count).toBe(2);
		});
	});
});
