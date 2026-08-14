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
	NotificationMessageBuilder,
	NotificationSender,
	PUSH_PROVIDER,
	PUSH_RATE_LIMITER,
} from "@/notification";
import { MARKETING_PUSH_OPT_OUT_TOKEN } from "@/notification/application/ports/marketing-push-opt-out-token.port";
import { NOTIFICATION_CACHE } from "@/notification/application/ports/notification-cache.port";
import { NOTIFICATION_DEDUP } from "@/notification/application/ports/notification-dedup.port";
import {
	PUSH_DISPATCHER,
	type PushDispatcherPort,
} from "@/notification/application/ports/push-dispatcher.port";
import { USER_NOTIFICATION_SETTINGS } from "@/notification/application/ports/user-notification-settings.port";
import { DispatchBatchNotificationUseCase } from "@/notification/application/use-cases/dispatch-batch-notification/dispatch-batch-notification.use-case";
// use-case는 배럴 비공개 → 테스트 모듈 구성용 딥 임포트 (test/는 경계 검사 제외)
import { FindAlreadyNotifiedUsersUseCase } from "@/notification/application/use-cases/find-already-notified-users/find-already-notified-users.use-case";
import { GetNotificationsUseCase } from "@/notification/application/use-cases/get-notifications/get-notifications.use-case";
import { GetUnreadCountUseCase } from "@/notification/application/use-cases/get-unread-count/get-unread-count.use-case";
import { MarkAllAsReadUseCase } from "@/notification/application/use-cases/mark-all-as-read/mark-all-as-read.use-case";
import { MarkAsReadUseCase } from "@/notification/application/use-cases/mark-as-read/mark-as-read.use-case";
import { MarkNotificationOpenedUseCase } from "@/notification/application/use-cases/mark-notification-opened/mark-notification-opened.use-case";
import { OptOutMarketingPushUseCase } from "@/notification/application/use-cases/opt-out-marketing-push/opt-out-marketing-push.use-case";
import { PersistBatchNotificationUseCase } from "@/notification/application/use-cases/persist-batch-notification/persist-batch-notification.use-case";
import { RegisterPushTokenUseCase } from "@/notification/application/use-cases/register-push-token/register-push-token.use-case";
import { SendBatchNotificationUseCase } from "@/notification/application/use-cases/send-batch-notification/send-batch-notification.use-case";
import { SendNotificationUseCase } from "@/notification/application/use-cases/send-notification/send-notification.use-case";
import { SendNotificationWithDedupUseCase } from "@/notification/application/use-cases/send-notification-with-dedup/send-notification-with-dedup.use-case";
import { UnregisterPushTokenUseCase } from "@/notification/application/use-cases/unregister-push-token/unregister-push-token.use-case";
import { NotificationCacheAdapter } from "@/notification/infrastructure/adapters/notification-cache.adapter";
import { PushDispatcherAdapter } from "@/notification/infrastructure/adapters/push-dispatcher.adapter";
import { NotificationRepository } from "@/notification/infrastructure/persistence/notification.repository";
import { PaginationService } from "@/shared/application/pagination/services/pagination.service";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { DEDUP_PROVIDER } from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import { LOCK_PROVIDER } from "@/shared/infrastructure/lock/interfaces/lock.interface";
import { UserConsentRepository } from "@/user-settings/infrastructure/persistence/user-consent.repository";
import { UserPreferenceRepository } from "@/user-settings/infrastructure/persistence/user-preference.repository";

function buildNotificationTestApi(module: TestingModule) {
	const sender = new NotificationSender(
		module.get(SendNotificationUseCase),
		module.get(SendNotificationWithDedupUseCase),
		module.get(SendBatchNotificationUseCase),
		module.get(FindAlreadyNotifiedUsersUseCase),
		module.get<PushDispatcherPort>(PUSH_DISPATCHER),
	);
	const getNotificationsUseCase = module.get(GetNotificationsUseCase);
	const getUnreadCountUseCase = module.get(GetUnreadCountUseCase);
	const markAsReadUseCase = module.get(MarkAsReadUseCase);
	const markNotificationOpenedUseCase = module.get(
		MarkNotificationOpenedUseCase,
	);
	const markAllAsReadUseCase = module.get(MarkAllAsReadUseCase);
	const registerPushTokenUseCase = module.get(RegisterPushTokenUseCase);
	const optOutMarketingPushUseCase = module.get(OptOutMarketingPushUseCase);

	return {
		...sender,
		createAndSend: sender.createAndSend.bind(sender),
		createAndSendWithDedup: sender.createAndSendWithDedup.bind(sender),
		createAndSendBatch: sender.createAndSendBatch.bind(sender),
		registerPushToken: registerPushTokenUseCase.execute.bind(
			registerPushTokenUseCase,
		),
		getNotifications: getNotificationsUseCase.execute.bind(
			getNotificationsUseCase,
		),
		getUnreadCount: getUnreadCountUseCase.execute.bind(getUnreadCountUseCase),
		markAsRead: markAsReadUseCase.execute.bind(markAsReadUseCase),
		markOpened: markNotificationOpenedUseCase.execute.bind(
			markNotificationOpenedUseCase,
		),
		markAllAsRead: markAllAsReadUseCase.execute.bind(markAllAsReadUseCase),
		optOutMarketingPush: optOutMarketingPushUseCase.execute.bind(
			optOutMarketingPushUseCase,
		),
	};
}

describe("Notification 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let facade: ReturnType<typeof buildNotificationTestApi>;
	let repository: NotificationRepository;
	let pushDispatcher: PushDispatcherAdapter;

	// Mock 데이터베이스 서비스
	const mockNotificationDb = {
		create: jest.fn(),
		createMany: jest.fn(),
		createManyAndReturn: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		update: jest.fn(),
		updateMany: jest.fn(),
		delete: jest.fn(),
		deleteMany: jest.fn(),
		count: jest.fn(),
	};

	const mockPushDispatchDb = {
		upsert: jest.fn(),
		update: jest.fn(),
		updateMany: jest.fn(),
	};

	const mockPushDeliveryAttemptDb = {
		createMany: jest.fn(),
		findMany: jest.fn(),
		updateMany: jest.fn(),
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
		upsert: jest.fn(),
	};

	const mockDatabaseService = {
		...createMockDatabaseService({
			notification: mockNotificationDb,
			pushToken: mockPushTokenDb,
			pushDispatch: mockPushDispatchDb,
			pushDeliveryAttempt: mockPushDeliveryAttemptDb,
			userPreference: mockUserPreferenceDb,
			userConsent: mockUserConsentDb,
		}),
		$queryRaw: jest.fn(),
	};

	// Mock Push Provider
	const mockPushProvider = {
		send: jest.fn(),
		sendBatch: jest.fn(),
		getReceipts: jest.fn(),
		validateToken: jest.fn(),
	};

	const mockMarketingPushOptOutToken = {
		issue: jest.fn((userId: string) => `opt-out:${userId}`),
		verify: jest.fn((token: string) => token.replace(/^opt-out:/, "") || null),
	};

	// 테스트 데이터
	const mockUserId = "user-notification-123";
	const mockNotificationId = 1;
	const mockPushToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				NotificationRepository,
				{
					provide: NOTIFICATION_REPOSITORY,
					useExisting: NotificationRepository,
				},
				{ provide: PUSH_DISPATCHER, useClass: PushDispatcherAdapter },
				// application은 NOTIFICATION_CACHE 포트에 의존 — 실제 어댑터가 mock CacheService를 래핑
				{ provide: NOTIFICATION_CACHE, useClass: NotificationCacheAdapter },
				{
					provide: NOTIFICATION_DEDUP,
					useValue: {
						recordNotifiedUsers: jest.fn().mockResolvedValue(undefined),
					},
				},
				GetNotificationsUseCase,
				GetUnreadCountUseCase,
				MarkAsReadUseCase,
				MarkNotificationOpenedUseCase,
				MarkAllAsReadUseCase,
				RegisterPushTokenUseCase,
				UnregisterPushTokenUseCase,
				OptOutMarketingPushUseCase,
				SendNotificationUseCase,
				SendNotificationWithDedupUseCase,
				PersistBatchNotificationUseCase,
				DispatchBatchNotificationUseCase,
				SendBatchNotificationUseCase,
				FindAlreadyNotifiedUsersUseCase,
				{
					provide: MARKETING_PUSH_OPT_OUT_TOKEN,
					useValue: mockMarketingPushOptOutToken,
				},
				PaginationService,
				UserPreferenceRepository,
				UserConsentRepository,
				{
					// 푸시 발송 판단용 사용자 설정 포트 — 실제 저장소(mock DB)에 위임하여
					// 프로덕션 UserNotificationSettingsAdapter의 읽기 시맨틱을 그대로 재현
					provide: USER_NOTIFICATION_SETTINGS,
					useFactory: (
						preferenceRepository: UserPreferenceRepository,
						consentRepository: UserConsentRepository,
					) => ({
						upsertPushTimezone: (userId: string, timezone: string) =>
							preferenceRepository.upsertTimezone(userId, timezone),
						upsertPushLocale: (userId: string, locale: string) =>
							preferenceRepository.upsertLocale(userId, locale),
						getPreferenceRecord: (userId: string) =>
							preferenceRepository.findByUserId(userId),
						getPreferenceRecordsByUserIds: (userIds: string[]) =>
							preferenceRepository.findByUserIds(userIds),
						getConsentRecord: (userId: string) =>
							consentRepository.findByUserId(userId),
						getConsentRecordsByUserIds: (userIds: string[]) =>
							consentRepository.findByUserIds(userIds),
						updateMarketingPushConsent: (userId: string, agreed: boolean) =>
							consentRepository
								.upsertMarketingPushConsent(userId, { agreed })
								.then(() => undefined),
					}),
					inject: [UserPreferenceRepository, UserConsentRepository],
				},
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
						// CacheService.mget 계약: miss는 undefined (null 아님)
						mget: jest
							.fn()
							.mockImplementation(async (keys: string[]) =>
								keys.map(() => undefined),
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
						filterMembers: jest.fn().mockResolvedValue(new Set()),
						isMember: jest.fn().mockResolvedValue(false),
						addMembers: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: PUSH_RATE_LIMITER,
					useValue: {
						isRateLimited: jest.fn().mockResolvedValue(false),
						reserveBatch: jest
							.fn()
							.mockImplementation(async (requests: unknown[]) =>
								requests.map(() => false),
							),
						destroy: jest.fn(),
					},
				},
			],
		}).compile();

		facade = buildNotificationTestApi(module);
		repository = module.get<NotificationRepository>(NotificationRepository);
		pushDispatcher = module.get<PushDispatcherAdapter>(PUSH_DISPATCHER);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		NotificationBuilder.resetIdCounter();
		PushTokenBuilder.resetIdCounter();
		mockPushDispatchDb.upsert.mockResolvedValue({ id: 1 });
		mockPushDispatchDb.update.mockResolvedValue({});
		mockPushDispatchDb.updateMany.mockResolvedValue({ count: 1 });
		mockPushDeliveryAttemptDb.createMany.mockResolvedValue({ count: 0 });
		mockDatabaseService.$queryRaw.mockResolvedValue(
			Array.from({ length: 20 }, (_, index) => ({
				id: index + 1,
				notificationId: index + 1,
			})),
		);
		mockNotificationDb.createManyAndReturn.mockImplementation(
			async ({ data }: { data: Array<Record<string, unknown>> }) =>
				data.map((item, index) => ({
					id: index + 1,
					isRead: false,
					readAt: null,
					openedAt: null,
					createdAt: new Date(),
					updatedAt: new Date(),
					...item,
				})),
		);
	});

	describe("DI 통합 테스트", () => {
		it("Notification endpoint UseCase와 발송 capability가 정상적으로 조립되어야 함", () => {
			// Given - DI 컨테이너가 구성됨

			// When - 파사드 인스턴스 확인

			// Then - 테스트 수직 경계가 정의되어 있어야 함
			expect(facade).toBeDefined();
			expect(facade.createAndSend).toBeInstanceOf(Function);
			expect(facade.getNotifications).toBeInstanceOf(Function);
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

			// When - 푸시 토큰 등록 (파사드는 void 반환 — 등록 자체가 목적)
			await expect(
				facade.registerPushToken({
					userId: mockUserId,
					token: mockPushToken,
					platform: "IOS",
				}),
			).resolves.toBeUndefined();

			// Then - upsert 수행 검증
			expect(mockPushTokenDb.upsert).toHaveBeenCalled();
		});

		it("유효하지 않은 토큰이면 예외를 발생시켜야 함", async () => {
			// Given - 유효하지 않은 토큰
			mockPushProvider.validateToken.mockReturnValue(false);

			// When & Then - 예외 발생 검증
			await expect(
				facade.registerPushToken({
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
			mockNotificationDb.updateMany.mockResolvedValue({ count: 1 });

			// When - 알림 읽음 처리
			await expect(
				facade.markAsRead(mockUserId, mockNotificationId),
			).resolves.toBeUndefined();

			// Then - 읽음 처리 검증
			expect(mockNotificationDb.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockNotificationId, userId: mockUserId, isRead: false },
					data: expect.objectContaining({
						isRead: true,
					}),
				}),
			);
		});

		it("푸시 탭을 멱등 기록하고 읽음 상태로 맞춰야 함", async () => {
			mockNotificationDb.updateMany.mockResolvedValue({ count: 1 });

			await expect(
				facade.markOpened(mockUserId, mockNotificationId),
			).resolves.toBe(true);

			expect(mockNotificationDb.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockNotificationId, userId: mockUserId, openedAt: null },
					data: expect.objectContaining({
						isRead: true,
						openedAt: expect.any(Date),
					}),
				}),
			);
			expect(mockPushDispatchDb.updateMany).toHaveBeenCalled();
		});

		it("서명 토큰으로 광고성 푸시 동의를 철회해야 함", async () => {
			mockUserConsentDb.upsert.mockResolvedValue({});

			await expect(
				facade.optOutMarketingPush(`opt-out:${mockUserId}`),
			).resolves.toBe(true);

			expect(mockUserConsentDb.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { userId: mockUserId },
					update: { marketingPushAgreedAt: null },
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
			const result = await facade.createAndSend({
				userId: mockUserId,
				type: "NUDGE_RECEIVED",
				title: "테스트 알림",
				body: "테스트 알림 내용입니다",
			});
			await pushDispatcher.beforeApplicationShutdown();

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
			const result = await facade.createAndSend({
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
				results: [{ token: mockPushToken, success: true }],
				invalidTokens: [],
			});

			// When - 배치 알림 생성 및 발송
			const result = await facade.createAndSendBatch(dataList);
			await pushDispatcher.beforeApplicationShutdown();

			// Then - title이 치환된 값이어야 하며, {count}가 포함되지 않아야 함
			expect(result.count).toBe(1);
			expect(message.title).toContain("3");
			expect(message.title).not.toContain("{count}");

			const createManyCall =
				mockNotificationDb.createManyAndReturn.mock.calls[0]?.[0];
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
			const result = await facade.createAndSend({
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
				results: [
					{ token: "token-1", success: true },
					{ token: "token-2", success: true },
				],
				invalidTokens: [],
			});

			// When - 배치 알림 생성 및 발송
			const result = await facade.createAndSendBatch(dataList);
			await pushDispatcher.beforeApplicationShutdown();

			// Then - 두 사용자 모두 알림이 생성되어야 함
			expect(result.count).toBe(2);

			const createManyCall =
				mockNotificationDb.createManyAndReturn.mock.calls[0]?.[0];
			// 할일 있는 사용자: 치환된 title
			expect(createManyCall.data[0].title).toBe(messageWithTodos.title);
			expect(createManyCall.data[0].title).not.toContain("{count}");
			// 할일 없는 사용자: morningNoTodo 메시지
			expect(createManyCall.data[1].title).toBe(messageNoTodos.title);
			expect(createManyCall.data[1].body).toBe(messageNoTodos.body);
		});

		it("force 항목은 pushEnabled=false여도 푸시가 발송되어야 함", async () => {
			// Given - 푸시를 꺼둔 사용자와 force 지정된 관리자 브로드캐스트
			const dataList = [
				{
					userId: mockUserId,
					type: "ADMIN_BROADCAST" as const,
					title: "중요 공지",
					body: "강제 발송 본문",
					force: true,
					action: {
						type: "BROWSER" as const,
						url: "https://aido.kr/ko/patch-notes",
					},
				},
			];

			mockUserPreferenceDb.findMany.mockResolvedValue([
				{ userId: mockUserId, pushEnabled: false, nightPushEnabled: false },
			]);
			mockUserConsentDb.findMany.mockResolvedValue([]);
			mockPushTokenDb.findMany.mockResolvedValue([
				PushTokenBuilder.create(mockUserId).withToken(mockPushToken).build(),
			]);
			mockPushProvider.sendBatch.mockResolvedValue({
				total: 1,
				successCount: 1,
				failureCount: 0,
				results: [{ token: mockPushToken, success: true }],
				invalidTokens: [],
			});

			// When - 배치 알림 생성 및 발송 (재조립 경로 포함 end-to-end)
			const result = await facade.createAndSendBatch(dataList);
			await pushDispatcher.beforeApplicationShutdown();

			// Then - 설정 게이트를 우회해 실제 푸시까지 발송되어야 함
			expect(result.count).toBe(1);
			expect(mockPushProvider.sendBatch).toHaveBeenCalledTimes(1);

			const payloadData =
				mockPushProvider.sendBatch.mock.calls[0]?.[0]?.[0]?.data;
			expect(payloadData).toMatchObject({
				type: "ADMIN_BROADCAST",
				action: { type: "BROWSER", url: "https://aido.kr/ko/patch-notes" },
			});
			// force는 서버 발송 정책일 뿐 클라이언트 payload 계약에 포함되지 않는다
			expect(payloadData).not.toHaveProperty("force");
		});

		it("같은 배치에 섞인 같은 사용자의 비-force 알림은 force로 오염되지 않아야 함", async () => {
			// Given - 푸시를 꺼둔 사용자에게 force 알림과 일반 알림이 한 배치로 들어올 때
			const dataList = [
				{
					userId: mockUserId,
					type: "ADMIN_TARGETED" as const,
					title: "중요 공지",
					body: "강제 발송 본문",
					force: true,
				},
				{
					userId: mockUserId,
					type: "TODO_REMINDER" as const,
					title: "할 일 리마인더",
					body: "일반 발송 본문",
				},
			];

			mockUserPreferenceDb.findMany.mockResolvedValue([
				{ userId: mockUserId, pushEnabled: false, nightPushEnabled: false },
			]);
			mockUserConsentDb.findMany.mockResolvedValue([]);
			mockPushTokenDb.findMany.mockResolvedValue([
				PushTokenBuilder.create(mockUserId).withToken(mockPushToken).build(),
			]);
			mockPushProvider.sendBatch.mockResolvedValue({
				total: 1,
				successCount: 1,
				failureCount: 0,
				results: [{ token: mockPushToken, success: true }],
				invalidTokens: [],
			});

			// When - 배치 알림 생성 및 발송
			const result = await facade.createAndSendBatch(dataList);
			await pushDispatcher.beforeApplicationShutdown();

			// Then - force 지정된 알림만 발송되고 일반 알림은 수신 설정에 막혀야 함
			expect(result.count).toBe(2);
			expect(mockPushProvider.sendBatch).toHaveBeenCalledTimes(1);

			const payloads = mockPushProvider.sendBatch.mock.calls[0]?.[0];
			expect(payloads).toHaveLength(1);
			expect(payloads?.[0]?.data).toMatchObject({ type: "ADMIN_TARGETED" });
		});
	});
});
