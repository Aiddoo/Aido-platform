/**
 * SubscriptionService 단위 테스트 (Suites + Builder + GWT 패턴)
 *
 * RevenueCat 웹훅 이벤트 처리 로직을 검증합니다.
 * - Lock 획득/해제
 * - 이벤트 타입별 DB 트랜잭션 처리
 * - 멱등성 가드
 * - 캐시 무효화 + 큐 잡 등록
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { SubscriptionEventBuilder } from "@test/builders";
import { createUnitOfWorkMock } from "@test/mocks/ports";
import { CacheService } from "@/common/cache/cache.service";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/common/database";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import type { ILockProvider } from "@/common/lock";
import { LOCK_PROVIDER } from "@/common/lock";
import { AdminNotificationQueueService } from "@/modules/admin-notification/queue/admin-notification-queue.service";
import { NotificationQueueService } from "@/modules/notification/queue";
import { SubscriptionRepository } from "./subscription.repository";
import { SubscriptionService } from "./subscription.service";

describe("SubscriptionService — 구독 서비스", () => {
	let service: SubscriptionService;
	let subscriptionRepository: Mocked<SubscriptionRepository>;
	let uow: Mocked<UnitOfWorkPort>;
	let cacheService: Mocked<CacheService>;
	let adminNotificationQueueService: Mocked<AdminNotificationQueueService>;
	let notificationQueueService: Mocked<NotificationQueueService>;
	let lockProvider: Mocked<ILockProvider>;

	const mockRelease = jest.fn();

	const mockUser = {
		id: "user-123",
		email: "test@example.com",
		subscriptionStatus: "FREE" as const,
		subscriptionExpiresAt: null,
		revenueCatUserId: null,
		profile: { name: "테스트유저" },
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
			// UNIT_OF_WORK — run이 콜백을 즉시 실행하는 passthrough mock
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.compile();

		service = unit;
		subscriptionRepository = unitRef.get(SubscriptionRepository);
		uow = unitRef.get(UNIT_OF_WORK);
		cacheService = unitRef.get(CacheService);
		adminNotificationQueueService = unitRef.get(AdminNotificationQueueService);
		notificationQueueService = unitRef.get(NotificationQueueService);
		lockProvider = unitRef.get(LOCK_PROVIDER);

		// 기본 mock 설정
		lockProvider.acquire.mockResolvedValue(mockRelease);
		subscriptionRepository.findUserByAppUserId.mockResolvedValue(mockUser);
		subscriptionRepository.findByRevenueCatId.mockResolvedValue(null);
		subscriptionRepository.create.mockResolvedValue({} as never);
		subscriptionRepository.updateStatus.mockResolvedValue({} as never);
		subscriptionRepository.updateUserSubscriptionStatus.mockResolvedValue(
			undefined,
		);

		// 캐시 무효화 기본
		cacheService.invalidateSubscription.mockResolvedValue(undefined);
		cacheService.invalidateUserProfile.mockResolvedValue(undefined);
	});

	describe("Lock — 락", () => {
		it("Lock 획득 실패 시 BusinessException을 던진다", async () => {
			// Given
			lockProvider.acquire.mockResolvedValue(null);
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.build();

			// When & Then
			await expect(service.handleWebhookEvent(payload)).rejects.toThrow(
				BusinessException,
			);

			expect(subscriptionRepository.findUserByAppUserId).not.toHaveBeenCalled();
			expect(uow.run).not.toHaveBeenCalled();
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
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
			);
		});

		it("멱등성: 이미 존재하는 구독이면 create를 호출하지 않고 이벤트도 발행하지 않는다", async () => {
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

			// Then — DB 미변경, 캐시 미무효화, 큐 잡 미등록
			expect(subscriptionRepository.create).not.toHaveBeenCalled();
			expect(cacheService.invalidateSubscription).not.toHaveBeenCalled();
			expect(cacheService.invalidateUserProfile).not.toHaveBeenCalled();
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).not.toHaveBeenCalled();
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

		it("구독 이벤트 큐 잡을 등록한다 (이름 포함)", async () => {
			// Given
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					email: "test@example.com",
					name: "테스트유저",
					eventType: "INITIAL_PURCHASE",
				}),
			);
		});

		it("구매 통화 금액 필드를 포함하여 큐 잡을 등록한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.withPrice(2.99, "KRW", 3900)
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).toHaveBeenCalledWith(
				expect.objectContaining({
					priceUsd: 2.99,
					priceInPurchasedCurrency: 3900,
					purchasedCurrency: "KRW",
				}),
			);
		});
	});

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
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
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

		it("멱등성: 동일 expiresAt이고 ACTIVE이면 updateStatus를 호출하지 않고 이벤트도 발행하지 않는다", async () => {
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

			// Then — DB 미변경, 캐시 미무효화, 큐 잡 미등록
			expect(subscriptionRepository.updateStatus).not.toHaveBeenCalled();
			expect(cacheService.invalidateSubscription).not.toHaveBeenCalled();
			expect(cacheService.invalidateUserProfile).not.toHaveBeenCalled();
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).not.toHaveBeenCalled();
		});
	});

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
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
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
			);
		});
	});

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
			);
		});

		it("환불 시 구독 이벤트 큐 잡을 등록한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.refundCancellation()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).toHaveBeenCalledWith(
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
			);
			// Then — User: ACTIVE (만료일까지 유지)
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
			);
			// Then — 구독 이벤트 큐 잡 등록 (취소)
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					cancelReason: "UNSUBSCRIBE",
				}),
			);
		});
	});

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
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
			);
		});

		it("구독 이벤트 큐 잡을 등록한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.nonRenewingPurchase()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					eventType: "NON_RENEWING_PURCHASE",
				}),
			);
		});
	});

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
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
			);
		});

		it("구독 이벤트 큐 잡을 등록한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.subscriptionExtended()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					eventType: "SUBSCRIPTION_EXTENDED",
				}),
			);
		});
	});

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
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "ACTIVE",
				}),
			);
		});
	});

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
			);
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					subscriptionStatus: "FREE",
					subscriptionExpiresAt: null,
				}),
			);
		});
	});

	describe("BILLING_ISSUE", () => {
		it("DB 변경 없이 큐 잡을 등록한다 (Discord 알림 + 푸시 알림)", async () => {
			// Given
			const payload = SubscriptionEventBuilder.billingIssue()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(uow.run).not.toHaveBeenCalled();
			expect(subscriptionRepository.updateStatus).not.toHaveBeenCalled();
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					email: "test@example.com",
					eventType: "BILLING_ISSUE",
				}),
			);
			expect(notificationQueueService.enqueueBillingIssue).toHaveBeenCalledWith(
				{ userId: "user-123" },
			);
		});
	});

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
			);
		});
	});

	describe("기타 이벤트", () => {
		it("TEST 이벤트는 로그만 남기고 eventPayload가 null이다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.test()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(uow.run).not.toHaveBeenCalled();
			expect(cacheService.invalidateSubscription).not.toHaveBeenCalled();
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).not.toHaveBeenCalled();
		});

		it("SUBSCRIBER_ALIAS 이벤트는 로그만 남긴다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.subscriberAlias()
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(uow.run).not.toHaveBeenCalled();
			expect(cacheService.invalidateSubscription).not.toHaveBeenCalled();
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).not.toHaveBeenCalled();
		});

		it("TRANSFER 이벤트는 updateUserSubscriptionStatus를 호출하여 revenueCatUserId를 갱신한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.transfer()
				.withAppUserId("new-app-user-id")
				.build();
			// 첫 번째 호출: 기존 appUserId로 사용자 조회 (handleWebhookEvent)
			// 두 번째 호출: 새 appUserId로 사용자 조회 (#handleTransfer 내부)
			subscriptionRepository.findUserByAppUserId
				.mockResolvedValueOnce(mockUser)
				.mockResolvedValueOnce(null);

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith("user-123", {
				subscriptionStatus: "ACTIVE",
				revenueCatUserId: "new-app-user-id",
			});
		});

		it("TRANSFER 이벤트는 캐시를 무효화하고 subscription.transferred 이벤트를 발행한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.transfer()
				.withAppUserId("new-app-user-id")
				.build();
			subscriptionRepository.findUserByAppUserId
				.mockResolvedValueOnce(mockUser)
				.mockResolvedValueOnce(null);

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(uow.run).toHaveBeenCalled();
			expect(cacheService.invalidateSubscription).toHaveBeenCalledWith(
				"user-123",
			);
			expect(cacheService.invalidateUserProfile).toHaveBeenCalledWith(
				"user-123",
			);
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					email: "test@example.com",
					eventType: "TRANSFER",
				}),
			);
		});

		it("TRANSFER 이벤트는 트랜잭션 내에서 findUserByAppUserId와 updateUserSubscriptionStatus를 호출한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.transfer()
				.withAppUserId("new-app-user-id")
				.build();
			subscriptionRepository.findUserByAppUserId
				.mockResolvedValueOnce(mockUser) // handleWebhookEvent 사용자 조회
				.mockResolvedValueOnce(null); // #handleTransfer 내부 조회

			// When
			await service.handleWebhookEvent(payload);

			// Then — 트랜잭션 사용 확인
			expect(uow.run).toHaveBeenCalled();

			// findUserByAppUserId 두 번째 호출 (트랜잭션 내부) 확인
			expect(subscriptionRepository.findUserByAppUserId).toHaveBeenCalledWith(
				"new-app-user-id",
			);

			// updateUserSubscriptionStatus 호출 확인
			expect(
				subscriptionRepository.updateUserSubscriptionStatus,
			).toHaveBeenCalledWith("user-123", {
				subscriptionStatus: "ACTIVE",
				revenueCatUserId: "new-app-user-id",
			});
		});
	});

	describe("알 수 없는 이벤트 타입", () => {
		it("알 수 없는 이벤트 타입은 에러 없이 로그만 남기고 정상 종료한다", async () => {
			// Given — RevenueCat이 미래에 추가할 이벤트 시뮬레이션
			const payload = SubscriptionEventBuilder.customType("FUTURE_NEW_EVENT")
				.withAppUserId("user-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then — DB 변경, 캐시 무효화, 큐 잡 등록 모두 없음
			expect(uow.run).not.toHaveBeenCalled();
			expect(cacheService.invalidateSubscription).not.toHaveBeenCalled();
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).not.toHaveBeenCalled();
		});
	});

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

	describe("event.id 중복 방지", () => {
		it("동일 event.id 웹훅 재전송 시 이벤트를 처리하지 않고 종료한다", async () => {
			// Given — 이미 처리된 event.id가 있는 구독
			subscriptionRepository.findByRevenueCatId.mockResolvedValue({
				lastProcessedEventId: "evt-duplicate",
			} as never);

			const payload = SubscriptionEventBuilder.renewal()
				.withAppUserId("user-123")
				.withEventId("evt-duplicate")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then — DB 트랜잭션, 캐시 무효화, 큐 잡 등록 모두 없음
			expect(uow.run).not.toHaveBeenCalled();
			expect(cacheService.invalidateSubscription).not.toHaveBeenCalled();
			expect(
				adminNotificationQueueService.enqueueSubscriptionEvent,
			).not.toHaveBeenCalled();
			// Lock은 여전히 해제됨
			expect(mockRelease).toHaveBeenCalledTimes(1);
		});

		it("event.id가 없는 이벤트는 기존 로직 그대로 처리한다", async () => {
			// Given
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.withoutEventId()
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then — 정상 처리
			expect(subscriptionRepository.create).toHaveBeenCalled();
		});

		it("event.id가 다르면 정상 처리한다", async () => {
			// Given — 이전 event.id와 다른 새 이벤트
			subscriptionRepository.findByRevenueCatId.mockResolvedValue({
				lastProcessedEventId: "evt-old",
				status: "ACTIVE",
				expiresAt: new Date(),
			} as never);

			const payload = SubscriptionEventBuilder.renewal()
				.withAppUserId("user-123")
				.withEventId("evt-new")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then — 정상 처리 (트랜잭션 실행)
			expect(uow.run).toHaveBeenCalled();
		});

		it("event.id가 있으면 updateStatus 시 lastProcessedEventId가 전달된다", async () => {
			// Given
			subscriptionRepository.findByRevenueCatId
				.mockResolvedValueOnce({
					lastProcessedEventId: "evt-old",
					status: "ACTIVE",
					expiresAt: new Date(),
				} as never) // 중복 체크용
				.mockResolvedValueOnce({
					status: "ACTIVE",
					expiresAt: new Date(Date.now() - 1000),
				} as never); // renewal 핸들러 내부 조회용

			const payload = SubscriptionEventBuilder.renewal()
				.withAppUserId("user-123")
				.withEventId("evt-new-123")
				.build();

			// When
			await service.handleWebhookEvent(payload);

			// Then
			expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					lastProcessedEventId: "evt-new-123",
				}),
			);
		});
	});
});
