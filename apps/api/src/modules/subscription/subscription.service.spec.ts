/**
 * SubscriptionService 단위 테스트 (Suites + Builder + GWT 패턴)
 *
 * RevenueCat 웹훅 이벤트 처리 로직을 검증합니다.
 * - Lock 획득/해제
 * - 이벤트 타입별 DB 트랜잭션 처리
 * - 멱등성 가드
 * - 캐시 무효화 + 이벤트 발행
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { SubscriptionEventBuilder } from "@test/builders";
import { CacheService } from "@/common/cache/cache.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import type { ILockProvider } from "@/common/lock";
import { LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";
import { SubscriptionRepository } from "./subscription.repository";
import { SubscriptionService } from "./subscription.service";

describe("SubscriptionService", () => {
	let service: SubscriptionService;
	let subscriptionRepository: Mocked<SubscriptionRepository>;
	let database: Mocked<DatabaseService>;
	let cacheService: Mocked<CacheService>;
	let eventEmitter: Mocked<EventEmitter2>;
	let lockProvider: Mocked<ILockProvider>;

	const mockRelease = jest.fn();

	const mockUser = {
		id: "user-123",
		email: "test@example.com",
		subscriptionStatus: "FREE" as const,
		subscriptionExpiresAt: null,
		revenueCatUserId: null,
	};

	beforeEach(async () => {
		mockRelease.mockReset();

		const mockLockProvider: ILockProvider = {
			acquire: jest.fn().mockResolvedValue(mockRelease),
			isLocked: jest.fn(),
		};

		const { unit, unitRef } = await TestBed.solitary(SubscriptionService)
			.mock(LOCK_PROVIDER)
			.impl(() => mockLockProvider)
			.compile();

		service = unit;
		subscriptionRepository = unitRef.get(
			SubscriptionRepository,
		) as unknown as Mocked<SubscriptionRepository>;
		database = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;
		cacheService = unitRef.get(CacheService) as unknown as Mocked<CacheService>;
		eventEmitter = unitRef.get(
			EventEmitter2,
		) as unknown as Mocked<EventEmitter2>;
		lockProvider = unitRef.get(
			LOCK_PROVIDER,
		) as unknown as Mocked<ILockProvider>;

		// 기본 mock 설정
		lockProvider.acquire.mockResolvedValue(mockRelease);
		subscriptionRepository.findUserByAppUserId.mockResolvedValue(mockUser);
		subscriptionRepository.findByRevenueCatId.mockResolvedValue(null);
		subscriptionRepository.create.mockResolvedValue({} as never);
		subscriptionRepository.updateStatus.mockResolvedValue({} as never);
		subscriptionRepository.updateUserSubscriptionStatus.mockResolvedValue(
			undefined,
		);

		// $transaction passthrough
		(database.$transaction as jest.Mock).mockImplementation(
			(callback: (tx: unknown) => Promise<unknown>) => callback({}),
		);

		// 캐시 무효화 기본
		cacheService.invalidateSubscription.mockResolvedValue(undefined);
		cacheService.invalidateUserProfile.mockResolvedValue(undefined);
	});

	// =========================================================================
	// Lock
	// =========================================================================

	describe("Lock", () => {
		it("Lock 획득 실패 시 이벤트를 처리하지 않고 종료한다", async () => {
			// Given
			lockProvider.acquire.mockResolvedValue(null);
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(subscriptionRepository.findUserByAppUserId).not.toHaveBeenCalled();
			expect(database.$transaction).not.toHaveBeenCalled();
		});

		it("Lock 획득 성공 시 처리 완료 후 release를 호출한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(mockRelease).toHaveBeenCalledTimes(1);
		});

		it("에러 발생 시에도 release를 호출한다 (finally)", async () => {
			// Given
			subscriptionRepository.findUserByAppUserId.mockResolvedValue(null);
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.build();

			// When & Then
			await expect(service.handleWebhookEvent(payload)).rejects.toThrow(
				BusinessException,
			);
			expect(mockRelease).toHaveBeenCalledTimes(1);
		});
	});

	// =========================================================================
	// User lookup
	// =========================================================================

	describe("사용자 조회", () => {
		it("사용자가 없으면 BusinessException을 던진다", async () => {
			// Given
			subscriptionRepository.findUserByAppUserId.mockResolvedValue(null);
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("unknown-user")
				.build();

			// When & Then
			await expect(service.handleWebhookEvent(payload)).rejects.toThrow(
				BusinessException,
			);
		});
	});

	// =========================================================================
	// INITIAL_PURCHASE
	// =========================================================================

	describe("INITIAL_PURCHASE", () => {
		it("정상적으로 구독을 생성하고 사용자 상태를 ACTIVE로 업데이트한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.withProductId("premium_monthly")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(subscriptionRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					productId: "premium_monthly",
					status: "ACTIVE",
				}),
				expect.anything(),
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
				expect.anything(),
			);
		});

		it("멱등성: 이미 존재하는 구독이면 create를 호출하지 않는다", async () => {
			// Given
			subscriptionRepository.findByRevenueCatId.mockResolvedValue({
				id: "sub-1",
				revenueCatId: "otxn-existing",
				status: "ACTIVE",
			} as never);
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(subscriptionRepository.create).not.toHaveBeenCalled();
		});

		it("purchased_at_ms가 누락되면 에러를 던진다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.withoutPurchasedAt()
				.build();

			// When & Then
			await expect(service.handleWebhookEvent(payload)).rejects.toThrow(
				BusinessException,
			);
		});

		it("expiration_at_ms가 누락되면 에러를 던진다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.withoutExpiration()
				.build();

			// When & Then
			await expect(service.handleWebhookEvent(payload)).rejects.toThrow(
				BusinessException,
			);
		});

		it("캐시 무효화를 호출한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(cacheService.invalidateSubscription).toHaveBeenCalledWith(
				"user-123",
			);
			expect(cacheService.invalidateUserProfile).toHaveBeenCalledWith(
				"user-123",
			);
		});

		it("subscription.purchased 이벤트를 발행한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				"subscription.purchased",
				expect.objectContaining({
					userId: "user-123",
					email: "test@example.com",
					eventType: "INITIAL_PURCHASE",
				}),
			);
		});
	});

	// =========================================================================
	// RENEWAL
	// =========================================================================

	describe("RENEWAL", () => {
		it("정상적으로 구독을 갱신하고 사용자 상태를 ACTIVE로 업데이트한다", async () => {
			// Given
			const futureMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
			subscriptionRepository.findByRevenueCatId.mockResolvedValue({
				id: "sub-1",
				revenueCatId: "otxn-123",
				status: "ACTIVE",
				expiresAt: new Date(Date.now() - 1000),
			} as never);
			const payload = SubscriptionEventBuilder.renewal()
				.withAppUserId("user-123")
				.withExpirationAtMs(futureMs)
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					status: "ACTIVE",
					cancelledAt: null,
				}),
				expect.anything(),
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
				expect.anything(),
			);
		});

		it("expiration_at_ms가 누락되면 에러를 던진다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.renewal()
				.withAppUserId("user-123")
				.withoutExpiration()
				.build();

			// When & Then
			await expect(service.handleWebhookEvent(payload)).rejects.toThrow(
				BusinessException,
			);
		});

		it("Subscription 레코드가 없으면 에러를 던진다", async () => {
			// Given
			subscriptionRepository.findByRevenueCatId.mockResolvedValue(null);
			const payload = SubscriptionEventBuilder.renewal()
				.withAppUserId("user-123")
				.build();

			// When & Then
			await expect(service.handleWebhookEvent(payload)).rejects.toThrow(
				BusinessException,
			);
		});

		it("멱등성: 동일 expiresAt이고 ACTIVE이면 updateStatus를 호출하지 않는다", async () => {
			// Given
			const expiresAtMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
			const expiresAt = new Date(expiresAtMs);
			subscriptionRepository.findByRevenueCatId.mockResolvedValue({
				id: "sub-1",
				revenueCatId: "otxn-123",
				status: "ACTIVE",
				expiresAt,
			} as never);
			const payload = SubscriptionEventBuilder.renewal()
				.withAppUserId("user-123")
				.withExpirationAtMs(expiresAtMs)
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(subscriptionRepository.updateStatus).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// CANCELLATION
	// =========================================================================

	describe("CANCELLATION (일반 취소)", () => {
		it("expiresAt이 미래이면 User를 ACTIVE로 유지한다", async () => {
			// Given
			const futureMs = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7일 후
			const payload = SubscriptionEventBuilder.cancellation()
				.withAppUserId("user-123")
				.withExpirationAtMs(futureMs)
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					status: "CANCELLED",
				}),
				expect.anything(),
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
				expect.anything(),
			);
		});

		it("expiresAt이 과거이면 User를 CANCELLED로 변경한다", async () => {
			// Given
			const pastMs = Date.now() - 120_000; // 2분 전 (grace period 60초 초과)
			const payload = SubscriptionEventBuilder.cancellation()
				.withAppUserId("user-123")
				.withExpirationAtMs(pastMs)
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "CANCELLED",
				}),
				expect.anything(),
			);
		});

		it("expiresAt이 없으면 DB fallback 값을 사용한다", async () => {
			// Given
			const dbExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
			subscriptionRepository.findByRevenueCatId.mockResolvedValue({
				id: "sub-1",
				revenueCatId: "otxn-123",
				status: "ACTIVE",
				expiresAt: dbExpiresAt,
			} as never);
			const payload = SubscriptionEventBuilder.cancellation()
				.withAppUserId("user-123")
				.withoutExpiration()
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(subscriptionRepository.findByRevenueCatId).toHaveBeenCalled();
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
				expect.anything(),
			);
		});
	});

	// =========================================================================
	// CANCELLATION (환불 — cancel_reason: CUSTOMER_SUPPORT)
	// =========================================================================

	describe("CANCELLATION (환불)", () => {
		it("cancel_reason=CUSTOMER_SUPPORT이면 Subscription을 EXPIRED로, User를 즉시 FREE로 변경한다", async () => {
			// Given
			const futureMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
			const payload = SubscriptionEventBuilder.refundCancellation()
				.withAppUserId("user-123")
				.withExpirationAtMs(futureMs)
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then — Subscription: EXPIRED
			expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					status: "EXPIRED",
				}),
				expect.anything(),
			);
			// Then — User: 즉시 FREE, expiresAt null
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "FREE",
					subscriptionExpiresAt: null,
				}),
				expect.anything(),
			);
		});

		it("환불 시 subscription.refunded 이벤트를 발행한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.refundCancellation()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				"subscription.refunded",
				expect.objectContaining({
					userId: "user-123",
					eventType: "CANCELLATION",
					cancelReason: "CUSTOMER_SUPPORT",
				}),
			);
		});

		it("일반 취소(UNSUBSCRIBE)는 기존 로직을 유지한다 (만료일 미래 → ACTIVE)", async () => {
			// Given
			const futureMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
			const payload = SubscriptionEventBuilder.cancellation()
				.withAppUserId("user-123")
				.withExpirationAtMs(futureMs)
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then — Subscription: CANCELLED (NOT EXPIRED)
			expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					status: "CANCELLED",
				}),
				expect.anything(),
			);
			// Then — User: ACTIVE (만료일까지 유지)
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
				expect.anything(),
			);
			// Then — subscription.cancelled 이벤트 (not refunded)
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				"subscription.cancelled",
				expect.objectContaining({
					userId: "user-123",
					cancelReason: "UNSUBSCRIBE",
				}),
			);
		});
	});

	// =========================================================================
	// NON_RENEWING_PURCHASE
	// =========================================================================

	describe("NON_RENEWING_PURCHASE", () => {
		it("INITIAL_PURCHASE와 동일하게 구독을 생성하고 User를 ACTIVE로 변경한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.nonRenewingPurchase()
				.withAppUserId("user-123")
				.withProductId("premium_lifetime")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(subscriptionRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					productId: "premium_lifetime",
					status: "ACTIVE",
				}),
				expect.anything(),
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
				expect.anything(),
			);
		});

		it("subscription.purchased 이벤트를 발행한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.nonRenewingPurchase()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				"subscription.purchased",
				expect.objectContaining({
					userId: "user-123",
					eventType: "NON_RENEWING_PURCHASE",
				}),
			);
		});
	});

	// =========================================================================
	// SUBSCRIPTION_EXTENDED
	// =========================================================================

	describe("SUBSCRIPTION_EXTENDED", () => {
		it("expiresAt을 갱신하고 ACTIVE를 유지한다", async () => {
			// Given
			const futureMs = Date.now() + 60 * 24 * 60 * 60 * 1000; // 60일 후
			const payload = SubscriptionEventBuilder.subscriptionExtended()
				.withAppUserId("user-123")
				.withExpirationAtMs(futureMs)
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					status: "ACTIVE",
				}),
				expect.anything(),
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
				expect.anything(),
			);
		});

		it("subscription.extended 이벤트를 발행한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.subscriptionExtended()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				"subscription.extended",
				expect.objectContaining({
					userId: "user-123",
					eventType: "SUBSCRIPTION_EXTENDED",
				}),
			);
		});
	});

	// =========================================================================
	// UNCANCELLATION
	// =========================================================================

	describe("UNCANCELLATION", () => {
		it("ACTIVE로 복원하고 cancelledAt을 null로 설정한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.uncancellation()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					status: "ACTIVE",
					cancelledAt: null,
				}),
				expect.anything(),
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
				expect.anything(),
			);
		});
	});

	// =========================================================================
	// EXPIRATION
	// =========================================================================

	describe("EXPIRATION", () => {
		it("Subscription을 EXPIRED로, User를 FREE로 변경하고 subscriptionExpiresAt을 null로 설정한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.expiration()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					status: "EXPIRED",
				}),
				expect.anything(),
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "FREE",
					subscriptionExpiresAt: null,
				}),
				expect.anything(),
			);
		});
	});

	// =========================================================================
	// BILLING_ISSUE
	// =========================================================================

	describe("BILLING_ISSUE", () => {
		it("DB 변경 없이 이벤트를 발행한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.billingIssue()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(database.$transaction).not.toHaveBeenCalled();
			expect(subscriptionRepository.updateStatus).not.toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				"subscription.billing_issue",
				expect.objectContaining({
					userId: "user-123",
					email: "test@example.com",
					eventType: "BILLING_ISSUE",
				}),
			);
		});
	});

	// =========================================================================
	// PRODUCT_CHANGE
	// =========================================================================

	describe("PRODUCT_CHANGE", () => {
		it("productId를 업데이트한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.productChange()
				.withAppUserId("user-123")
				.withProductId("premium_yearly")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					productId: "premium_yearly",
				}),
				expect.anything(),
			);
		});

		it("expiration_at_ms가 없어도 User를 ACTIVE로 업데이트한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.productChange()
				.withAppUserId("user-123")
				.withProductId("premium_yearly")
				.withoutExpiration()
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then — User는 항상 ACTIVE로 갱신
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
				expect.anything(),
			);
		});
	});

	// =========================================================================
	// Other events (로그만 남기는 이벤트)
	// =========================================================================

	describe("기타 이벤트", () => {
		it("TEST 이벤트는 로그만 남기고 eventPayload가 null이다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.test()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(database.$transaction).not.toHaveBeenCalled();
			expect(cacheService.invalidateSubscription).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it("SUBSCRIBER_ALIAS 이벤트는 로그만 남긴다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.subscriberAlias()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(database.$transaction).not.toHaveBeenCalled();
			expect(cacheService.invalidateSubscription).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it("TRANSFER 이벤트는 로그만 남긴다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.transfer()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(database.$transaction).not.toHaveBeenCalled();
			expect(cacheService.invalidateSubscription).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// 알 수 없는 이벤트 타입 (forward compatibility)
	// =========================================================================

	describe("알 수 없는 이벤트 타입", () => {
		it("알 수 없는 이벤트 타입은 에러 없이 로그만 남기고 정상 종료한다", async () => {
			// Given — RevenueCat이 미래에 추가할 이벤트 시뮬레이션
			const payload = SubscriptionEventBuilder.customType("FUTURE_NEW_EVENT")
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then — DB 변경, 캐시 무효화, 이벤트 발행 모두 없음
			expect(database.$transaction).not.toHaveBeenCalled();
			expect(cacheService.invalidateSubscription).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// transactionId 누락
	// =========================================================================

	describe("transactionId", () => {
		it("transactionId와 original_transaction_id 모두 누락되면 에러를 던진다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.withoutTransactionIds()
				.build();

			// When & Then
			await expect(service.handleWebhookEvent(payload)).rejects.toThrow(
				BusinessException,
			);
		});
	});
});
