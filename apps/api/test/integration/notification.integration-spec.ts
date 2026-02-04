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
import { NotificationBuilder, PushTokenBuilder } from "@test/builders";
import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import { UserConsentRepository } from "@/modules/auth/repositories/user-consent.repository";
import { UserPreferenceRepository } from "@/modules/auth/repositories/user-preference.repository";
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

	const mockUserPreferenceDb = {
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		upsert: jest.fn(),
	};

	const mockUserConsentDb = {
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
	};

	const mockDatabaseService = {
		notification: mockNotificationDb,
		pushToken: mockPushTokenDb,
		userPreference: mockUserPreferenceDb,
		userConsent: mockUserConsentDb,
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
				UserPreferenceRepository,
				UserConsentRepository,
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
		NotificationBuilder.resetIdCounter();
		PushTokenBuilder.resetIdCounter();
	});

	describe("DI 통합 테스트", () => {
		it("NotificationService가 정상적으로 주입되어야 함", () => {
			// Given - DI 컨테이너가 구성됨

			// When - 서비스 인스턴스 확인

			// Then - 서비스가 정의되어 있어야 함
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(NotificationService);
		});

		it("NotificationRepository가 정상적으로 주입되어야 함", () => {
			// Given - DI 컨테이너가 구성됨

			// When - 레포지토리 인스턴스 확인

			// Then - 레포지토리가 정의되어 있어야 함
			expect(repository).toBeDefined();
			expect(repository).toBeInstanceOf(NotificationRepository);
		});
	});

	describe("푸시 토큰 등록 통합 테스트", () => {
		it("새 푸시 토큰을 등록해야 함", async () => {
			// Given - 유효한 푸시 토큰 준비
			const mockToken = PushTokenBuilder.create(mockUserId)
				.withToken(mockPushToken)
				.asIos()
				.build();
			mockPushTokenDb.upsert.mockResolvedValue(mockToken);
			mockPushProvider.validateToken.mockReturnValue(true);

			// When - 푸시 토큰 등록
			const result = await service.registerPushToken({
				userId: mockUserId,
				token: mockPushToken,
				platform: "IOS",
			});

			// Then - 등록 결과 검증
			expect(result).toEqual(mockToken);
			expect(mockPushTokenDb.upsert).toHaveBeenCalled();
		});

		it("유효하지 않은 토큰이면 예외를 발생시켜야 함", async () => {
			// Given - 유효하지 않은 토큰
			mockPushProvider.validateToken.mockReturnValue(false);

			// When & Then - 예외 발생 검증
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
			// Given - 알림 목록 준비
			const mockNotifications = [
				NotificationBuilder.create(mockUserId)
					.withId(1)
					.asNudgeReceived("friend-1", 1)
					.build(),
				NotificationBuilder.create(mockUserId)
					.withId(2)
					.asCheerReceived("friend-2", 1)
					.build(),
			];
			mockNotificationDb.findMany.mockResolvedValue(mockNotifications);
			mockNotificationDb.count.mockResolvedValue(2);

			// When - 알림 목록 조회
			const result = await service.getNotifications({ userId: mockUserId });

			// Then - 목록 및 페이지네이션 검증
			expect(result.items).toBeDefined();
			expect(result.pagination).toBeDefined();
			expect(mockNotificationDb.findMany).toHaveBeenCalled();
		});

		it("읽지 않은 알림만 필터링해야 함", async () => {
			// Given - 읽지 않은 알림만 필터링
			const mockNotifications = [
				NotificationBuilder.create(mockUserId).withId(1).asUnread().build(),
			];
			mockNotificationDb.findMany.mockResolvedValue(mockNotifications);
			mockNotificationDb.count.mockResolvedValue(1);

			// When - 읽지 않은 알림만 조회
			await service.getNotifications({ userId: mockUserId, unreadOnly: true });

			// Then - 필터 조건 검증
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
			// Given - 읽지 않은 알림 수 설정
			mockNotificationDb.count.mockResolvedValue(5);

			// When - 읽지 않은 알림 수 조회
			const result = await service.getUnreadCount(mockUserId);

			// Then - 알림 수 검증
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
			// Given - 읽음 처리할 알림 준비
			const mockNotification = NotificationBuilder.create(mockUserId)
				.withId(mockNotificationId)
				.asUnread()
				.build();
			mockNotificationDb.findUnique.mockResolvedValue(mockNotification);
			mockNotificationDb.update.mockResolvedValue(
				NotificationBuilder.create(mockUserId)
					.withId(mockNotificationId)
					.asRead()
					.build(),
			);

			// When - 알림 읽음 처리
			await expect(
				service.markAsRead(mockUserId, mockNotificationId),
			).resolves.toBeUndefined();

			// Then - 읽음 처리 검증
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
			// Given - 존재하지 않는 알림
			mockNotificationDb.findUnique.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(service.markAsRead(mockUserId, 999)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 알림이면 예외를 발생시켜야 함", async () => {
			// Given - 다른 사용자의 알림
			const mockNotification = NotificationBuilder.create("other-user")
				.withId(mockNotificationId)
				.build();
			mockNotificationDb.findUnique.mockResolvedValue(mockNotification);

			// When & Then - 예외 발생 검증
			await expect(
				service.markAsRead(mockUserId, mockNotificationId),
			).rejects.toThrow(BusinessException);
		});

		it("전체 알림을 읽음 처리해야 함", async () => {
			// Given - 전체 읽음 처리 준비
			mockNotificationDb.updateMany.mockResolvedValue({ count: 5 });

			// When - 전체 알림 읽음 처리
			const result = await service.markAllAsRead(mockUserId);

			// Then - 전체 읽음 처리 검증
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
			// Given - 알림 및 푸시 토큰 준비
			const mockNotification = NotificationBuilder.create(mockUserId)
				.withId(mockNotificationId)
				.asNudgeReceived("friend-1", 1)
				.build();
			const mockToken = PushTokenBuilder.create(mockUserId)
				.withToken(mockPushToken)
				.build();

			// UserPreference mock - pushEnabled가 true여야 푸시 발송
			mockUserPreferenceDb.findUnique.mockResolvedValue({
				userId: mockUserId,
				pushEnabled: true,
				nightPushEnabled: true,
			});
			mockNotificationDb.create.mockResolvedValue(mockNotification);
			mockPushTokenDb.findMany.mockResolvedValue([mockToken]);
			mockPushProvider.sendBatch.mockResolvedValue({
				successful: [{ token: mockPushToken }],
				failed: [],
			});

			// When - 알림 생성 및 발송
			const result = await service.createAndSend({
				userId: mockUserId,
				type: "NUDGE_RECEIVED",
				title: "테스트 알림",
				body: "테스트 알림 내용입니다",
			});

			// Then - 알림 생성 및 푸시 발송 검증
			expect(result).toEqual(mockNotification);
			expect(mockNotificationDb.create).toHaveBeenCalled();
			expect(mockPushTokenDb.findMany).toHaveBeenCalled();
		});

		it("푸시 토큰이 없어도 알림을 생성해야 함", async () => {
			// Given - 푸시 토큰 없음
			const mockNotification = NotificationBuilder.create(mockUserId)
				.withId(mockNotificationId)
				.asNudgeReceived("friend-1", 1)
				.build();

			mockNotificationDb.create.mockResolvedValue(mockNotification);
			mockPushTokenDb.findMany.mockResolvedValue([]);

			// When - 알림 생성 (푸시 토큰 없음)
			const result = await service.createAndSend({
				userId: mockUserId,
				type: "NUDGE_RECEIVED",
				title: "테스트 알림",
				body: "테스트 알림 내용입니다",
			});

			// Then - 알림 생성만 수행됨
			expect(result).toEqual(mockNotification);
			expect(mockPushProvider.sendBatch).not.toHaveBeenCalled();
		});
	});
});
