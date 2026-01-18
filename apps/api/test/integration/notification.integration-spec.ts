/**
 * NotificationService 통합 테스트
 *
 * @description
 * NotificationService가 NotificationRepository, PaginationService, PushProvider와 함께 올바르게 작동하는지 검증합니다.
 * 실제 데이터베이스 대신 모킹된 DatabaseService를 사용하여 서비스 계층 통합을 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - NotificationService와 NotificationRepository의 통합 검증
 * - PaginationService와의 통합 검증
 * - PushProvider와의 통합 검증
 * - BusinessException 에러 처리가 올바르게 작동하는지 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test notification.integration-spec
 * ```
 */

import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import type {
	Notification,
	NotificationType,
	PushToken,
} from "@/generated/prisma/client";

import { NotificationRepository } from "@/modules/notification/notification.repository";
import { NotificationService } from "@/modules/notification/notification.service";
import { PUSH_PROVIDER } from "@/modules/notification/providers/push-provider.interface";

describe("NotificationService Integration Tests", () => {
	let module: TestingModule;
	let service: NotificationService;
	let repository: NotificationRepository;

	// Mock 데이터베이스 서비스
	const mockNotificationDb = {
		create: jest.fn(),
		createMany: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		update: jest.fn(),
		updateMany: jest.fn(),
		delete: jest.fn(),
		deleteMany: jest.fn(),
		count: jest.fn(),
	};

	const mockPushTokenDb = {
		create: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		upsert: jest.fn(),
		delete: jest.fn(),
		deleteMany: jest.fn(),
	};

	const mockDatabaseService = {
		notification: mockNotificationDb,
		pushToken: mockPushTokenDb,
		$transaction: jest.fn(),
	};

	mockDatabaseService.$transaction.mockImplementation(
		(callback: (tx: unknown) => Promise<unknown>) =>
			callback(mockDatabaseService),
	);

	// Mock Push Provider
	const mockPushProvider = {
		send: jest.fn(),
		sendBatch: jest.fn(),
		validateToken: jest.fn(),
	};

	// 테스트 데이터
	const mockUserId = "user-notification-123";
	const mockNotificationId = 1;
	const mockPushToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

	const createMockNotification = (
		overrides: Partial<Notification> = {},
	): Notification => ({
		id: mockNotificationId,
		userId: mockUserId,
		type: "NUDGE_RECEIVED" as NotificationType,
		title: "테스트 알림",
		body: "테스트 알림 내용입니다",
		isRead: false,
		route: "/nudges",
		todoId: null,
		friendId: null,
		nudgeId: 1,
		cheerId: null,
		metadata: null,
		createdAt: new Date(),
		readAt: null,
		...overrides,
	});

	const createMockPushToken = (
		overrides: Partial<PushToken> = {},
	): PushToken => ({
		id: 1,
		userId: mockUserId,
		token: mockPushToken,
		deviceId: "test-device-id",
		platform: "IOS",
		isActive: true,
		createdAt: new Date(),
		updatedAt: new Date(),
		lastUsedAt: new Date(),
		...overrides,
	});

	beforeAll(async () => {
		// Logger 출력 비활성화
		jest.spyOn(Logger.prototype, "log").mockImplementation();
		jest.spyOn(Logger.prototype, "warn").mockImplementation();
		jest.spyOn(Logger.prototype, "error").mockImplementation();
		jest.spyOn(Logger.prototype, "debug").mockImplementation();

		module = await Test.createTestingModule({
			providers: [
				NotificationService,
				NotificationRepository,
				PaginationService,
				{
					provide: DatabaseService,
					useValue: mockDatabaseService,
				},
				{
					provide: TypedConfigService,
					useValue: {
						get: jest.fn().mockReturnValue(20),
					},
				},
				{
					provide: PUSH_PROVIDER,
					useValue: mockPushProvider,
				},
			],
		}).compile();

		service = module.get<NotificationService>(NotificationService);
		repository = module.get<NotificationRepository>(NotificationRepository);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("DI 통합 테스트", () => {
		it("NotificationService가 정상적으로 주입되어야 함", () => {
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(NotificationService);
		});

		it("NotificationRepository가 정상적으로 주입되어야 함", () => {
			expect(repository).toBeDefined();
			expect(repository).toBeInstanceOf(NotificationRepository);
		});
	});

	describe("푸시 토큰 등록 통합 테스트", () => {
		it("새 푸시 토큰을 등록해야 함", async () => {
			const mockToken = createMockPushToken();
			mockPushTokenDb.upsert.mockResolvedValue(mockToken);
			mockPushProvider.validateToken.mockReturnValue(true);

			const result = await service.registerPushToken({
				userId: mockUserId,
				token: mockPushToken,
				platform: "IOS",
			});

			expect(result).toEqual(mockToken);
			expect(mockPushTokenDb.upsert).toHaveBeenCalled();
		});

		it("유효하지 않은 토큰이면 예외를 발생시켜야 함", async () => {
			mockPushProvider.validateToken.mockReturnValue(false);

			await expect(
				service.registerPushToken({
					userId: mockUserId,
					token: "invalid-token",
					platform: "IOS",
				}),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("알림 목록 조회 통합 테스트", () => {
		it("알림 목록을 조회해야 함", async () => {
			const mockNotifications = [
				createMockNotification({ id: 1 }),
				createMockNotification({ id: 2 }),
			];
			mockNotificationDb.findMany.mockResolvedValue(mockNotifications);
			mockNotificationDb.count.mockResolvedValue(2);

			const result = await service.getNotifications({ userId: mockUserId });

			expect(result.items).toBeDefined();
			expect(result.pagination).toBeDefined();
			expect(mockNotificationDb.findMany).toHaveBeenCalled();
		});

		it("읽지 않은 알림만 필터링해야 함", async () => {
			const mockNotifications = [createMockNotification()];
			mockNotificationDb.findMany.mockResolvedValue(mockNotifications);
			mockNotificationDb.count.mockResolvedValue(1);

			await service.getNotifications({ userId: mockUserId, unreadOnly: true });

			expect(mockNotificationDb.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						userId: mockUserId,
						isRead: false,
					}),
				}),
			);
		});
	});

	describe("읽지 않은 알림 수 조회 통합 테스트", () => {
		it("읽지 않은 알림 수를 반환해야 함", async () => {
			mockNotificationDb.count.mockResolvedValue(5);

			const result = await service.getUnreadCount(mockUserId);

			expect(result).toBe(5);
			expect(mockNotificationDb.count).toHaveBeenCalledWith({
				where: {
					userId: mockUserId,
					isRead: false,
				},
			});
		});
	});

	describe("알림 읽음 처리 통합 테스트", () => {
		it("단일 알림을 읽음 처리해야 함", async () => {
			const mockNotification = createMockNotification();
			mockNotificationDb.findUnique.mockResolvedValue(mockNotification);
			mockNotificationDb.update.mockResolvedValue({
				...mockNotification,
				isRead: true,
				readAt: new Date(),
			});

			// markAsRead는 void를 반환하므로 에러 없이 완료되면 성공
			await expect(
				service.markAsRead(mockUserId, mockNotificationId),
			).resolves.toBeUndefined();

			expect(mockNotificationDb.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockNotificationId },
					data: expect.objectContaining({
						isRead: true,
					}),
				}),
			);
		});

		it("존재하지 않는 알림이면 예외를 발생시켜야 함", async () => {
			mockNotificationDb.findUnique.mockResolvedValue(null);

			await expect(service.markAsRead(mockUserId, 999)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 알림이면 예외를 발생시켜야 함", async () => {
			const mockNotification = createMockNotification({ userId: "other-user" });
			mockNotificationDb.findUnique.mockResolvedValue(mockNotification);

			await expect(
				service.markAsRead(mockUserId, mockNotificationId),
			).rejects.toThrow(BusinessException);
		});

		it("전체 알림을 읽음 처리해야 함", async () => {
			mockNotificationDb.updateMany.mockResolvedValue({ count: 5 });

			const result = await service.markAllAsRead(mockUserId);

			expect(result.count).toBe(5);
			expect(mockNotificationDb.updateMany).toHaveBeenCalledWith({
				where: {
					userId: mockUserId,
					isRead: false,
				},
				data: {
					isRead: true,
					readAt: expect.any(Date),
				},
			});
		});
	});

	describe("알림 생성 및 발송 통합 테스트", () => {
		it("알림을 생성하고 푸시를 발송해야 함", async () => {
			const mockNotification = createMockNotification();
			const mockToken = createMockPushToken();

			mockNotificationDb.create.mockResolvedValue(mockNotification);
			mockPushTokenDb.findMany.mockResolvedValue([mockToken]);
			mockPushProvider.sendBatch.mockResolvedValue({
				successful: [{ token: mockPushToken }],
				failed: [],
			});

			const result = await service.createAndSend({
				userId: mockUserId,
				type: "NUDGE_RECEIVED",
				title: "테스트 알림",
				body: "테스트 알림 내용입니다",
				route: "/nudges",
			});

			expect(result).toEqual(mockNotification);
			expect(mockNotificationDb.create).toHaveBeenCalled();
			expect(mockPushTokenDb.findMany).toHaveBeenCalled();
		});

		it("푸시 토큰이 없어도 알림을 생성해야 함", async () => {
			const mockNotification = createMockNotification();

			mockNotificationDb.create.mockResolvedValue(mockNotification);
			mockPushTokenDb.findMany.mockResolvedValue([]);

			const result = await service.createAndSend({
				userId: mockUserId,
				type: "NUDGE_RECEIVED",
				title: "테스트 알림",
				body: "테스트 알림 내용입니다",
			});

			expect(result).toEqual(mockNotification);
			expect(mockPushProvider.sendBatch).not.toHaveBeenCalled();
		});
	});
});
