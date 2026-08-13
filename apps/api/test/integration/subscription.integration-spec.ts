/**
 * HandleWebhookEventUseCase 통합 테스트
 *
 * @description
 * HandleWebhookEventUseCase가 PrismaSubscriptionRepository, 캐시·알림 어댑터,
 * LockProvider와 함께 올바르게 작동하는지 검증합니다.
 * 실제 데이터베이스 대신 모킹된 DatabaseService를 사용하여 계층 통합을 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - use-case와 PrismaSubscriptionRepository(실제 어댑터)의 통합 검증
 * - RevenueCat 웹훅 이벤트 타입별 처리 로직 검증
 * - Lock 기반 동시성 제어 검증
 * - 이벤트 멱등성 (중복 이벤트 스킵) 검증
 * - ApplicationException 에러 처리가 올바르게 작동하는지 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test subscription.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { TransactionHost } from "@nestjs-cls/transactional";
import { SubscriptionEventBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { createUnitOfWorkMock } from "@test/mocks/ports";
import { suppressLogger } from "@test/setup/suppress-logger";
import { AdminEventNotifier, PAYMENT_NOTIFIER } from "@/admin-notification";
import { NotificationQueueService } from "@/notification/queue";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { LOCK_PROVIDER } from "@/shared/infrastructure/lock";
import { SUBSCRIPTION_REPOSITORY } from "@/subscription/application/ports/subscription.repository.port";
import { SUBSCRIPTION_CACHE } from "@/subscription/application/ports/subscription-cache.port";
import { SUBSCRIPTION_EVENT_NOTIFIER } from "@/subscription/application/ports/subscription-event-notifier.port";
import { HandleWebhookEventUseCase } from "@/subscription/application/use-cases/handle-webhook-event/handle-webhook-event.use-case";
import { SubscriptionCacheAdapter } from "@/subscription/infrastructure/adapters/subscription-cache.adapter";
import { SubscriptionEventNotifierAdapter } from "@/subscription/infrastructure/adapters/subscription-event-notifier.adapter";
import { PrismaSubscriptionRepository } from "@/subscription/infrastructure/persistence/prisma-subscription.repository";

describe("HandleWebhookEventUseCase 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let useCase: HandleWebhookEventUseCase;

	// Mock 데이터베이스 모델
	const mockSubscriptionDb = {
		create: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		update: jest.fn(),
	};

	const mockUserDb = {
		findFirst: jest.fn(),
		update: jest.fn(),
	};

	const mockDatabaseService = createMockDatabaseService({
		subscription: mockSubscriptionDb,
		user: mockUserDb,
	});

	// Mock CacheService
	const mockCacheService = {
		invalidateSubscription: jest.fn().mockResolvedValue(undefined),
		invalidateUserProfile: jest.fn().mockResolvedValue(undefined),
	};

	// Mock AdminEventNotifier
	const mockAdminEventNotifier = {
		notifySubscriptionEvent: jest.fn(),
	};

	// Mock NotificationQueueService
	const mockNotificationQueueService = {
		enqueueBillingIssue: jest.fn(),
	};

	// Mock PAYMENT_NOTIFIER (웹훅 실패 보고의 Discord 전송 — reportWebhookFailure 경로)
	const mockPaymentNotifier = {
		name: "fake",
		send: jest.fn().mockResolvedValue({ success: true }),
		isConfigured: jest.fn().mockReturnValue(true),
	};

	// Mock LockProvider
	const mockRelease = jest.fn().mockResolvedValue(undefined);
	const mockLockProvider = {
		acquire: jest.fn().mockResolvedValue(mockRelease),
		isLocked: jest.fn(),
	};

	// 테스트 데이터
	const mockUser = {
		id: "user-123",
		email: "test@example.com",
		subscriptionStatus: "FREE" as const,
		subscriptionExpiresAt: null,
		revenueCatUserId: "rc-user-123",
		profile: { name: "테스트" },
	};

	const mockTransactionId = "otxn-test-1234";

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				HandleWebhookEventUseCase,
				{
					provide: SUBSCRIPTION_REPOSITORY,
					useClass: PrismaSubscriptionRepository,
				},
				{ provide: SUBSCRIPTION_CACHE, useClass: SubscriptionCacheAdapter },
				{
					provide: SUBSCRIPTION_EVENT_NOTIFIER,
					useClass: SubscriptionEventNotifierAdapter,
				},
				{
					provide: UNIT_OF_WORK,
					useValue: createUnitOfWorkMock(),
				},
				{
					// CLS 트랜잭션 스텁 — tx가 항상 mock DB를 반환 (기존 $transaction passthrough와 등가)
					provide: TransactionHost,
					useValue: { tx: mockDatabaseService },
				},
				{
					provide: CacheService,
					useValue: mockCacheService,
				},
				{
					provide: AdminEventNotifier,
					useValue: mockAdminEventNotifier,
				},
				{
					provide: NotificationQueueService,
					useValue: mockNotificationQueueService,
				},
				{
					provide: PAYMENT_NOTIFIER,
					useValue: mockPaymentNotifier,
				},
				{
					provide: LOCK_PROVIDER,
					useValue: mockLockProvider,
				},
			],
		}).compile();

		useCase = module.get<HandleWebhookEventUseCase>(HandleWebhookEventUseCase);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();

		// 기본 mock 설정: Lock 획득 성공
		mockLockProvider.acquire.mockResolvedValue(mockRelease);
	});

	it("INITIAL_PURCHASE — 신규 구독 시 Subscription 생성 및 User 상태 ACTIVE 전환", async () => {
		// Given - 사용자 존재, 기존 구독 없음
		const payload = SubscriptionEventBuilder.initialPurchase()
			.withAppUserId("rc-user-123")
			.withOriginalTransactionId(mockTransactionId)
			.build();

		mockUserDb.findFirst.mockResolvedValue(mockUser);
		mockSubscriptionDb.findUnique.mockResolvedValue(null);
		mockSubscriptionDb.create.mockResolvedValue({
			id: 1,
			userId: mockUser.id,
			revenueCatId: mockTransactionId,
			productId: "premium_monthly",
			status: "ACTIVE",
		});
		mockUserDb.update.mockResolvedValue({
			...mockUser,
			subscriptionStatus: "ACTIVE",
		});

		// When - INITIAL_PURCHASE 웹훅 이벤트 처리
		await useCase.execute(payload);

		// Then - Subscription 생성, User ACTIVE 전환, 캐시 무효화, 큐 등록
		expect(mockSubscriptionDb.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					revenueCatId: mockTransactionId,
					status: "ACTIVE",
				}),
			}),
		);
		expect(mockUserDb.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
			}),
		);
		expect(mockCacheService.invalidateSubscription).toHaveBeenCalledWith(
			mockUser.id,
		);
		expect(mockCacheService.invalidateUserProfile).toHaveBeenCalledWith(
			mockUser.id,
		);
		expect(mockAdminEventNotifier.notifySubscriptionEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: mockUser.id,
				eventType: "INITIAL_PURCHASE",
			}),
		);
	});

	it("RENEWAL — 갱신 시 expiresAt 업데이트 및 상태 ACTIVE 유지", async () => {
		// Given - 사용자 존재, 기존 ACTIVE 구독 존재
		const now = Date.now();
		const newExpiresAt = now + 60 * 24 * 60 * 60 * 1000;
		const payload = SubscriptionEventBuilder.renewal()
			.withAppUserId("rc-user-123")
			.withOriginalTransactionId(mockTransactionId)
			.withExpirationAtMs(newExpiresAt)
			.build();

		const existingSubscription = {
			id: 1,
			userId: mockUser.id,
			revenueCatId: mockTransactionId,
			status: "ACTIVE",
			expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000),
		};

		mockUserDb.findFirst.mockResolvedValue(mockUser);
		mockSubscriptionDb.findUnique.mockResolvedValue(existingSubscription);
		mockSubscriptionDb.update.mockResolvedValue({
			...existingSubscription,
			expiresAt: new Date(newExpiresAt),
		});
		mockUserDb.update.mockResolvedValue({
			...mockUser,
			subscriptionStatus: "ACTIVE",
		});

		// When - RENEWAL 웹훅 이벤트 처리
		await useCase.execute(payload);

		// Then - Subscription expiresAt 업데이트, User ACTIVE 유지
		expect(mockSubscriptionDb.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { revenueCatId: mockTransactionId },
				data: expect.objectContaining({
					status: "ACTIVE",
					expiresAt: new Date(newExpiresAt),
				}),
			}),
		);
		expect(mockUserDb.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
			}),
		);
	});

	it("CANCELLATION — 취소 시 cancelledAt 설정 및 상태 CANCELLED", async () => {
		// Given - 사용자 존재, 미래 만료일의 구독 존재
		const futureExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
		const payload = SubscriptionEventBuilder.cancellation()
			.withAppUserId("rc-user-123")
			.withOriginalTransactionId(mockTransactionId)
			.withExpirationAtMs(futureExpiresAt)
			.build();

		mockUserDb.findFirst.mockResolvedValue(mockUser);
		mockSubscriptionDb.update.mockResolvedValue({
			id: 1,
			revenueCatId: mockTransactionId,
			status: "CANCELLED",
		});
		mockUserDb.update.mockResolvedValue({
			...mockUser,
			subscriptionStatus: "ACTIVE",
		});

		// When - CANCELLATION 웹훅 이벤트 처리
		await useCase.execute(payload);

		// Then - Subscription CANCELLED 상태, cancelledAt 설정
		expect(mockSubscriptionDb.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { revenueCatId: mockTransactionId },
				data: expect.objectContaining({
					status: "CANCELLED",
					cancelledAt: expect.any(Date),
				}),
			}),
		);
	});

	it("EXPIRATION — 만료 시 상태 EXPIRED 전환 및 User FREE", async () => {
		// Given - 사용자 존재, 기존 구독 존재
		const payload = SubscriptionEventBuilder.expiration()
			.withAppUserId("rc-user-123")
			.withOriginalTransactionId(mockTransactionId)
			.build();

		mockUserDb.findFirst.mockResolvedValue(mockUser);
		mockSubscriptionDb.update.mockResolvedValue({
			id: 1,
			revenueCatId: mockTransactionId,
			status: "EXPIRED",
		});
		mockUserDb.update.mockResolvedValue({
			...mockUser,
			subscriptionStatus: "FREE",
		});

		// When - EXPIRATION 웹훅 이벤트 처리
		await useCase.execute(payload);

		// Then - Subscription EXPIRED, User FREE 전환
		expect(mockSubscriptionDb.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { revenueCatId: mockTransactionId },
				data: expect.objectContaining({
					status: "EXPIRED",
				}),
			}),
		);
		expect(mockUserDb.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					subscriptionStatus: "FREE",
					subscriptionExpiresAt: null,
				}),
			}),
		);
	});

	it("BILLING_ISSUE — 결제 이슈 시 로그만 기록하고 구독 상태 변경 없음", async () => {
		// Given - 사용자 존재
		const payload = SubscriptionEventBuilder.billingIssue()
			.withAppUserId("rc-user-123")
			.withOriginalTransactionId(mockTransactionId)
			.build();

		mockUserDb.findFirst.mockResolvedValue(mockUser);

		// When - BILLING_ISSUE 웹훅 이벤트 처리
		await useCase.execute(payload);

		// Then - Subscription update 호출 없음, 캐시 무효화 + 큐 등록만 수행
		expect(mockSubscriptionDb.update).not.toHaveBeenCalled();
		expect(mockSubscriptionDb.create).not.toHaveBeenCalled();
		expect(mockCacheService.invalidateSubscription).toHaveBeenCalledWith(
			mockUser.id,
		);
		expect(mockAdminEventNotifier.notifySubscriptionEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "BILLING_ISSUE",
			}),
		);
		expect(
			mockNotificationQueueService.enqueueBillingIssue,
		).toHaveBeenCalledWith({
			userId: mockUser.id,
		});
	});

	it("중복 이벤트 — 동일 eventId로 재처리 시 멱등하게 스킵", async () => {
		// Given - 사용자 존재, 동일 lastProcessedEventId를 가진 구독 존재
		const eventId = "evt-duplicate-123";
		const payload = SubscriptionEventBuilder.renewal()
			.withAppUserId("rc-user-123")
			.withOriginalTransactionId(mockTransactionId)
			.withEventId(eventId)
			.build();

		mockUserDb.findFirst.mockResolvedValue(mockUser);
		mockSubscriptionDb.findUnique.mockResolvedValue({
			id: 1,
			revenueCatId: mockTransactionId,
			status: "ACTIVE",
			lastProcessedEventId: eventId,
		});

		// When - 동일 eventId로 웹훅 이벤트 재처리
		await useCase.execute(payload);

		// Then - DB 변경 없음, 캐시 무효화 없음, 큐 등록 없음
		expect(mockSubscriptionDb.update).not.toHaveBeenCalled();
		expect(mockSubscriptionDb.create).not.toHaveBeenCalled();
		expect(mockCacheService.invalidateSubscription).not.toHaveBeenCalled();
		expect(mockCacheService.invalidateUserProfile).not.toHaveBeenCalled();
		expect(
			mockAdminEventNotifier.notifySubscriptionEvent,
		).not.toHaveBeenCalled();
	});

	it("잠금 경합 — Lock 획득 실패 시 ApplicationException", async () => {
		// Given - Lock 획득 실패 (null 반환)
		mockLockProvider.acquire.mockResolvedValue(null);

		const payload = SubscriptionEventBuilder.initialPurchase()
			.withAppUserId("rc-user-123")
			.build();

		// When & Then - ApplicationException 발생
		await expect(useCase.execute(payload)).rejects.toThrow(
			ApplicationException,
		);

		// Lock 실패 시 DB 조회도 하지 않음
		expect(mockUserDb.findFirst).not.toHaveBeenCalled();
	});

	it("존재하지 않는 사용자 — appUserId 매칭 실패 시 에러", async () => {
		// Given - 사용자 조회 결과 null
		mockUserDb.findFirst.mockResolvedValue(null);

		const payload = SubscriptionEventBuilder.initialPurchase()
			.withAppUserId("rc-unknown-user")
			.build();

		// When & Then - 비-1605 실패는 삼켜 200 반환 + notifier로 보고 (Discord 전송)
		const result = await useCase.execute(payload);
		expect(result).toEqual({ received: true });
		expect(mockPaymentNotifier.send).toHaveBeenCalledTimes(1);

		// 사용자 조회는 시도했으나 이후 처리는 하지 않음
		expect(mockUserDb.findFirst).toHaveBeenCalled();
		expect(mockSubscriptionDb.create).not.toHaveBeenCalled();
		expect(mockSubscriptionDb.update).not.toHaveBeenCalled();
	});
});
