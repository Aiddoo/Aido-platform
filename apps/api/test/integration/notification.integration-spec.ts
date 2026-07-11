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

import { Test, type TestingModule } from "@nestjs/testing";
import { TransactionHost } from "@nestjs-cls/transactional";
import { NotificationBuilder, PushTokenBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { suppressLogger } from "@test/setup/suppress-logger";
import {
	NOTIFICATION_REPOSITORY,
	NotificationFacade,
	NotificationMessageBuilder,
	NotificationRepository,
	NotificationService,
	PUSH_PROVIDER,
	PUSH_RATE_LIMITER,
	PushDeliveryService,
} from "@/notification";
// use-case는 배럴 비공개 → 테스트 모듈 구성용 딥 임포트 (test/는 경계 검사 제외)
import { GetNotificationsUseCase } from "@/notification/application/use-cases/get-notifications/get-notifications.use-case";
import { GetUnreadCountUseCase } from "@/notification/application/use-cases/get-unread-count/get-unread-count.use-case";
import { MarkAllAsReadUseCase } from "@/notification/application/use-cases/mark-all-as-read/mark-all-as-read.use-case";
import { MarkAsReadUseCase } from "@/notification/application/use-cases/mark-as-read/mark-as-read.use-case";
import { RegisterPushTokenUseCase } from "@/notification/application/use-cases/register-push-token/register-push-token.use-case";
import { UnregisterPushTokenUseCase } from "@/notification/application/use-cases/unregister-push-token/unregister-push-token.use-case";
import { PaginationService } from "@/shared/application/pagination/services/pagination.service";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { DEDUP_PROVIDER } from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import { LOCK_PROVIDER } from "@/shared/infrastructure/lock/interfaces/lock.interface";
import {
	UserConsentRepository,
	UserPreferenceRepository,
} from "@/user-settings";

describe("NotificationService 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let service: NotificationService;
	let facade: NotificationFacade;
	let pushDeliveryService: PushDeliveryService;
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
		findMany: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		upsert: jest.fn(),
	};

	const mockUserConsentDb = {
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
	};

	const mockDatabaseService = createMockDatabaseService({
		notification: mockNotificationDb,
		pushToken: mockPushTokenDb,
		userPreference: mockUserPreferenceDb,
		userConsent: mockUserConsentDb,
	});

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
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				NotificationService,
				PushDeliveryService,
				NotificationRepository,
				{
					provide: NOTIFICATION_REPOSITORY,
					useExisting: NotificationRepository,
				},
				NotificationFacade,
				GetNotificationsUseCase,
				GetUnreadCountUseCase,
				MarkAsReadUseCase,
				MarkAllAsReadUseCase,
				RegisterPushTokenUseCase,
				UnregisterPushTokenUseCase,
				PaginationService,
				UserPreferenceRepository,
				UserConsentRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabaseService,
				},
				{
					// CLS 트랜잭션 스텁 — tx가 항상 mock DB를 반환 (기존 tx ?? database와 등가)
					provide: TransactionHost,
					useValue: { tx: mockDatabaseService },
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
				{
					provide: CacheService,
					useValue: {
						get: jest.fn().mockResolvedValue(null),
						set: jest.fn().mockResolvedValue(undefined),
						del: jest.fn().mockResolvedValue(undefined),
						mget: jest
							.fn()
							.mockImplementation(async (keys: string[]) =>
								keys.map(() => null),
							),
						mset: jest.fn().mockResolvedValue(undefined),
						invalidatePushTokens: jest.fn().mockResolvedValue(undefined),
						invalidateUnreadCount: jest.fn().mockResolvedValue(undefined),
						invalidateUserPreference: jest.fn().mockResolvedValue(undefined),
						wrapUnreadCount: jest
							.fn()
							.mockImplementation(
								(_userId: string, fn: () => Promise<unknown>) => fn(),
							),
						wrapUserPreference: jest
							.fn()
							.mockImplementation(
								(_userId: string, fn: () => Promise<unknown>) => fn(),
							),
						wrapPushTokens: jest
							.fn()
							.mockImplementation(
								(_userId: string, fn: () => Promise<unknown>) => fn(),
							),
					},
				},
				{
					provide: LOCK_PROVIDER,
					useValue: {
						acquire: jest
							.fn()
							.mockResolvedValue(jest.fn().mockResolvedValue(undefined)),
						isLocked: jest.fn().mockResolvedValue(false),
					},
				},
				{
					provide: DEDUP_PROVIDER,
					useValue: {
						isDuplicate: jest.fn().mockResolvedValue(false),
						markAsProcessed: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: PUSH_RATE_LIMITER,
					useValue: {
						isRateLimited: jest.fn().mockResolvedValue(false),
						destroy: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<NotificationService>(NotificationService);
		facade = module.get<NotificationFacade>(NotificationFacade);
		pushDeliveryService = module.get<PushDeliveryService>(PushDeliveryService);
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
			const result = await pushDeliveryService.registerPushToken({
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
				pushDeliveryService.registerPushToken({
					userId: mockUserId,
					token: "invalid-token",
					platform: "IOS",
				}),
			).rejects.toMatchObject({ errorCode: "NOTIFICATION_1001" });
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
			const result = await facade.getNotifications({ userId: mockUserId });

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
			await facade.getNotifications({ userId: mockUserId, unreadOnly: true });

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

		it("category='SOCIAL'이면 소셜 타입 배열로 Repository를 호출해야 한다", async () => {
			// Given
			mockNotificationDb.findMany.mockResolvedValue([]);

			// When
			await facade.getNotifications({
				userId: "user-1",
				category: "SOCIAL",
			});

			// Then
			expect(mockNotificationDb.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						userId: "user-1",
						type: {
							in: expect.arrayContaining([
								"FOLLOW_NEW",
								"FOLLOW_ACCEPTED",
								"NUDGE_RECEIVED",
								"CHEER_RECEIVED",
								"FRIEND_COMPLETED",
								"SOCIAL_DIGEST",
								"NUDGE_SUGGEST",
							]),
						},
					}),
				}),
			);
		});

		it("category='ALL'이면 type 조건 없이 Repository를 호출해야 한다", async () => {
			// Given
			mockNotificationDb.findMany.mockResolvedValue([]);

			// When
			await facade.getNotifications({
				userId: "user-1",
				category: "ALL",
			});

			// Then
			const callArgs = mockNotificationDb.findMany.mock.calls[0]?.[0];
			expect(callArgs?.where).not.toHaveProperty("type");
		});

		it("category와 unreadOnly를 함께 사용하면 두 조건 모두 전달해야 한다", async () => {
			// Given
			mockNotificationDb.findMany.mockResolvedValue([]);

			// When
			await facade.getNotifications({
				userId: "user-1",
				category: "NOTICE",
				unreadOnly: true,
			});

			// Then
			expect(mockNotificationDb.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						userId: "user-1",
						isRead: false,
						type: {
							in: expect.arrayContaining([
								"SYSTEM_NOTICE",
								"ADMIN_BROADCAST",
								"ADMIN_TARGETED",
							]),
						},
					}),
				}),
			);
		});

		it("getNotifications + getUnreadCount 병렬 조회 시 두 결과 모두 정상 반환해야 한다", async () => {
			// Given
			const notifications = [
				NotificationBuilder.create(mockUserId).withId(1).asUnread().build(),
				NotificationBuilder.create(mockUserId).withId(2).asRead().build(),
			];
			mockNotificationDb.findMany.mockResolvedValue(notifications);
			mockNotificationDb.count.mockResolvedValue(1);

			// When - Promise.all로 병렬 호출 (컨트롤러에서 하는 것과 동일)
			const [result, unreadCount] = await Promise.all([
				facade.getNotifications({ userId: mockUserId }),
				facade.getUnreadCount(mockUserId),
			]);

			// Then
			expect(result.items).toBeDefined();
			expect(result.pagination).toBeDefined();
			expect(unreadCount).toBe(1);
			expect(mockNotificationDb.findMany).toHaveBeenCalled();
			expect(mockNotificationDb.count).toHaveBeenCalled();
		});

		it("category + cursor 조합이 DB 쿼리에 함께 적용되어야 한다", async () => {
			// Given
			mockNotificationDb.findMany.mockResolvedValue([]);

			// When
			await facade.getNotifications({
				userId: mockUserId,
				category: "SOCIAL",
				cursor: 10,
				size: 5,
			});

			// Then
			expect(mockNotificationDb.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						userId: mockUserId,
						type: {
							in: expect.arrayContaining([
								"FOLLOW_NEW",
								"FOLLOW_ACCEPTED",
								"NUDGE_RECEIVED",
								"CHEER_RECEIVED",
								"FRIEND_COMPLETED",
								"SOCIAL_DIGEST",
								"NUDGE_SUGGEST",
							]),
						},
					}),
					skip: 1,
					cursor: { id: 10 },
				}),
			);
		});
	});

	describe("읽지 않은 알림 수 조회 통합 테스트", () => {
		it("읽지 않은 알림 수를 반환해야 함", async () => {
			// Given - 읽지 않은 알림 수 설정
			mockNotificationDb.count.mockResolvedValue(5);

			// When - 읽지 않은 알림 수 조회
			const result = await facade.getUnreadCount(mockUserId);

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
				facade.markAsRead(mockUserId, mockNotificationId),
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
			await expect(facade.markAsRead(mockUserId, 999)).rejects.toMatchObject({
				errorCode: "NOTIFICATION_1004",
			});
		});

		it("다른 사용자의 알림이면 예외를 발생시켜야 함", async () => {
			// Given - 다른 사용자의 알림
			const mockNotification = NotificationBuilder.create("other-user")
				.withId(mockNotificationId)
				.build();
			mockNotificationDb.findUnique.mockResolvedValue(mockNotification);

			// When & Then - 예외 발생 검증
			await expect(
				facade.markAsRead(mockUserId, mockNotificationId),
			).rejects.toMatchObject({ errorCode: "NOTIFICATION_1005" });
		});

		it("전체 알림을 읽음 처리해야 함", async () => {
			// Given - 전체 읽음 처리 준비
			mockNotificationDb.updateMany.mockResolvedValue({ count: 5 });

			// When - 전체 알림 읽음 처리
			const result = await facade.markAllAsRead(mockUserId);

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

		it("MORNING_REMINDER createAndSendBatch 시 title에 {count}가 치환된 값이 저장되어야 함", async () => {
			// Given - morningReminder 템플릿으로 치환된 메시지 준비
			const todoCount = 3;
			const message = NotificationMessageBuilder.morningReminder(todoCount);

			const dataList = [
				{
					userId: mockUserId,
					type: "MORNING_REMINDER" as const,
					title: message.title,
					body: message.body,
				},
			];

			mockNotificationDb.createMany.mockResolvedValue({ count: 1 });
			mockUserPreferenceDb.findMany.mockResolvedValue([
				{ userId: mockUserId, pushEnabled: true, nightPushEnabled: true },
			]);
			mockUserConsentDb.findMany.mockResolvedValue([]);
			mockPushTokenDb.findMany.mockResolvedValue([
				PushTokenBuilder.create(mockUserId).withToken(mockPushToken).build(),
			]);
			mockPushProvider.sendBatch.mockResolvedValue({
				total: 1,
				successCount: 1,
				failureCount: 0,
				invalidTokens: [],
			});

			// When - 배치 알림 생성 및 발송
			const result = await service.createAndSendBatch(dataList);

			// Then - title이 치환된 값이어야 하며, {count}가 포함되지 않아야 함
			expect(result.count).toBe(1);
			expect(message.title).toContain("3");
			expect(message.title).not.toContain("{count}");

			const createManyCall = mockNotificationDb.createMany.mock.calls[0]?.[0];
			expect(createManyCall.data[0].title).toBe(message.title);
			expect(createManyCall.data[0].title).not.toContain("{count}");
			expect(createManyCall.data[0].type).toBe("MORNING_REMINDER");
		});

		it("할일 없는 사용자에게 MORNING_NO_TODO 메시지로 알림이 정상 생성되어야 함", async () => {
			// Given - morningNoTodo 템플릿 메시지 준비
			const message = NotificationMessageBuilder.morningNoTodo();
			const mockNotification = NotificationBuilder.create(mockUserId)
				.withId(10)
				.withType("MORNING_REMINDER")
				.withContent(message.title, message.body)
				.build();

			mockNotificationDb.create.mockResolvedValue(mockNotification);
			mockUserPreferenceDb.findUnique.mockResolvedValue({
				userId: mockUserId,
				pushEnabled: true,
				nightPushEnabled: true,
			});
			mockPushTokenDb.findMany.mockResolvedValue([
				PushTokenBuilder.create(mockUserId).withToken(mockPushToken).build(),
			]);
			mockPushProvider.sendBatch.mockResolvedValue({
				total: 1,
				successCount: 1,
				failureCount: 0,
				invalidTokens: [],
			});

			// When - 할일 없는 사용자용 알림 생성
			const result = await service.createAndSend({
				userId: mockUserId,
				type: "MORNING_REMINDER",
				title: message.title,
				body: message.body,
			});

			// Then - morningNoTodo 메시지가 그대로 저장되어야 함
			expect(result).not.toBeNull();
			expect(result?.title).toBe(message.title);
			expect(result?.body).toBe(message.body);
			expect(result?.type).toBe("MORNING_REMINDER");
			expect(mockNotificationDb.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						userId: mockUserId,
						type: "MORNING_REMINDER",
						title: message.title,
						body: message.body,
					}),
				}),
			);
		});

		it("createAndSendBatch에서 할일 있는 사용자와 없는 사용자 알림이 함께 저장되어야 함", async () => {
			// Given - 할일 있는 사용자와 없는 사용자 메시지 준비
			const userWithTodos = "user-with-todos";
			const userWithoutTodos = "user-without-todos";

			const messageWithTodos = NotificationMessageBuilder.morningReminder(5);
			const messageNoTodos = NotificationMessageBuilder.morningNoTodo();

			const dataList = [
				{
					userId: userWithTodos,
					type: "MORNING_REMINDER" as const,
					title: messageWithTodos.title,
					body: messageWithTodos.body,
				},
				{
					userId: userWithoutTodos,
					type: "MORNING_REMINDER" as const,
					title: messageNoTodos.title,
					body: messageNoTodos.body,
				},
			];

			mockNotificationDb.createMany.mockResolvedValue({ count: 2 });
			mockUserPreferenceDb.findMany.mockResolvedValue([
				{ userId: userWithTodos, pushEnabled: true, nightPushEnabled: true },
				{ userId: userWithoutTodos, pushEnabled: true, nightPushEnabled: true },
			]);
			mockUserConsentDb.findMany.mockResolvedValue([]);
			mockPushTokenDb.findMany.mockResolvedValue([
				PushTokenBuilder.create(userWithTodos).withToken("token-1").build(),
				PushTokenBuilder.create(userWithoutTodos).withToken("token-2").build(),
			]);
			mockPushProvider.sendBatch.mockResolvedValue({
				total: 2,
				successCount: 2,
				failureCount: 0,
				invalidTokens: [],
			});

			// When - 배치 알림 생성 및 발송
			const result = await service.createAndSendBatch(dataList);

			// Then - 두 사용자 모두 알림이 생성되어야 함
			expect(result.count).toBe(2);

			const createManyCall = mockNotificationDb.createMany.mock.calls[0]?.[0];
			// 할일 있는 사용자: 치환된 title
			expect(createManyCall.data[0].title).toBe(messageWithTodos.title);
			expect(createManyCall.data[0].title).not.toContain("{count}");
			// 할일 없는 사용자: morningNoTodo 메시지
			expect(createManyCall.data[1].title).toBe(messageNoTodos.title);
			expect(createManyCall.data[1].body).toBe(messageNoTodos.body);
		});
	});
});
