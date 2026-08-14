/**
 * HandleWebhookEventUseCase 단위 테스트
 *
 * RevenueCat 웹훅 이벤트 타입별 처리·멱등성·예외를 포트 mock으로 격리 검증한다.
 * 모든 예외는 ApplicationException(SUBSCRIPTION_16xx)으로 정규화된다.
 *
 * @execute pnpm --filter @aido/api test -- handle-webhook-event.use-case.spec
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { SubscriptionEventBuilder } from "@test/builders";
import { createUnitOfWorkMock } from "@test/mocks/ports";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import { Subscription } from "../../../domain/entities/subscription.aggregate";
import {
	SUBSCRIPTION_REPOSITORY,
	type SubscriptionRepositoryPort,
	type SubscriptionUser,
} from "../../ports/subscription.repository.port";
import {
	SUBSCRIPTION_CACHE,
	type SubscriptionCachePort,
} from "../../ports/subscription-cache.port";
import {
	SUBSCRIPTION_EVENT_NOTIFIER,
	type SubscriptionEventNotifierPort,
} from "../../ports/subscription-event-notifier.port";
import { SUBSCRIPTION_WEBHOOK_LOCK } from "../../ports/subscription-webhook-lock.port";
import { HandleWebhookEventUseCase } from "./handle-webhook-event.use-case";

describe("HandleWebhookEventUseCase — RevenueCat 웹훅 처리", () => {
	let useCase: HandleWebhookEventUseCase;
	let mockRepository: Mocked<SubscriptionRepositoryPort>;
	let mockCache: Mocked<SubscriptionCachePort>;
	let mockNotifier: Mocked<SubscriptionEventNotifierPort>;
	let releaseMock: jest.Mock;
	let acquireMock: jest.Mock;

	const APP_USER_ID = "rc-user-123";
	const TXN_ID = "otxn-test-1234";
	const FUTURE_MS = Date.now() + 30 * 24 * 60 * 60 * 1000;

	const mockUser: SubscriptionUser = {
		id: "user-123",
		email: "test@example.com",
		subscriptionStatus: "FREE",
		subscriptionExpiresAt: null,
		revenueCatUserId: APP_USER_ID,
		profile: { name: "테스트" },
	};

	const subscriptionOf = (
		overrides: Partial<{
			status: "FREE" | "ACTIVE" | "EXPIRED" | "CANCELLED";
			expiresAt: Date;
			lastProcessedEventId: string | null;
		}>,
	): Subscription =>
		Subscription.reconstitute({
			id: 1,
			userId: mockUser.id,
			revenueCatId: TXN_ID,
			productId: "premium_monthly",
			status: overrides.status ?? "ACTIVE",
			startedAt: new Date(FUTURE_MS - 60 * 24 * 60 * 60 * 1000),
			expiresAt: overrides.expiresAt ?? new Date(FUTURE_MS),
			cancelledAt: null,
			lastProcessedEventId: overrides.lastProcessedEventId ?? null,
		});

	beforeEach(async () => {
		releaseMock = jest.fn().mockResolvedValue(undefined);
		acquireMock = jest.fn().mockResolvedValue(releaseMock);

		const { unit, unitRef } = await TestBed.solitary(HandleWebhookEventUseCase)
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.mock(SUBSCRIPTION_WEBHOOK_LOCK)
			.impl(() => ({ acquire: acquireMock, isLocked: jest.fn() }))
			.compile();

		useCase = unit;
		mockRepository = unitRef.get(SUBSCRIPTION_REPOSITORY);
		mockCache = unitRef.get(SUBSCRIPTION_CACHE);
		mockNotifier = unitRef.get(SUBSCRIPTION_EVENT_NOTIFIER);

		mockRepository.findUserByAppUserId.mockResolvedValue(mockUser);
		mockRepository.findByRevenueCatId.mockResolvedValue(null);
	});

	/**
	 * 비-1605 처리 실패는 execute가 삼켜 200({ received: true })을 반환하고 notifier로
	 * 보고한다(Sentry·Discord 오케스트레이션은 어댑터 소유). Lock 경합(1605)만 rethrow한다.
	 */
	const expectSwallowedFailure = async (
		payload: unknown,
		errorCode: string,
	): Promise<void> => {
		const result = await useCase.execute(payload);
		expect(result).toEqual({ received: true });
		expect(mockNotifier.reportWebhookFailure).toHaveBeenCalledWith(
			expect.objectContaining({ errorCode }),
			payload,
		);
	};

	describe("오케스트레이션 (execute)", () => {
		it("Zod 검증 실패(잘못된 본문) → 처리·보고 없이 200 반환", async () => {
			const result = await useCase.execute({ invalid: "data" });

			expect(result).toEqual({ received: true });
			expect(mockRepository.findUserByAppUserId).not.toHaveBeenCalled();
			expect(mockNotifier.reportWebhookFailure).not.toHaveBeenCalled();
		});

		it("빈 객체 본문 → 처리·보고 없이 200 반환", async () => {
			const result = await useCase.execute({});

			expect(result).toEqual({ received: true });
			expect(mockRepository.findUserByAppUserId).not.toHaveBeenCalled();
		});

		it("정상 처리 → 200 반환, 실패 보고 없음", async () => {
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withExpirationAtMs(FUTURE_MS)
				.build();

			const result = await useCase.execute(payload);

			expect(result).toEqual({ received: true });
			expect(mockNotifier.reportWebhookFailure).not.toHaveBeenCalled();
		});
	});

	describe("Lock / 사용자 조회", () => {
		it("Lock 획득 실패 → SUBSCRIPTION_1605는 rethrow(429 유도), DB 조회 없음", async () => {
			acquireMock.mockResolvedValue(null);
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId(APP_USER_ID)
				.build();

			await expect(useCase.execute(payload)).rejects.toMatchObject({
				errorCode: "SUBSCRIPTION_1605",
			});
			expect(mockRepository.findUserByAppUserId).not.toHaveBeenCalled();
		});

		it("사용자 없음 → SUBSCRIPTION_1602 보고 + 200, release 호출", async () => {
			mockRepository.findUserByAppUserId.mockResolvedValue(null);
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("rc-unknown")
				.build();

			await expectSwallowedFailure(payload, "SUBSCRIPTION_1602");
			expect(releaseMock).toHaveBeenCalledTimes(1);
		});
	});

	describe("멱등성 / 무시 이벤트", () => {
		it("동일 eventId로 이미 처리된 구독 → 스킵 (쓰기·캐시·알림 없음)", async () => {
			const eventId = "evt-dup";
			mockRepository.findByRevenueCatId.mockResolvedValue(
				subscriptionOf({ lastProcessedEventId: eventId }),
			);
			const payload = SubscriptionEventBuilder.renewal()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withEventId(eventId)
				.withExpirationAtMs(FUTURE_MS)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.updateStatus).not.toHaveBeenCalled();
			expect(mockRepository.create).not.toHaveBeenCalled();
			expect(mockCache.invalidate).not.toHaveBeenCalled();
			expect(mockNotifier.notifySubscriptionEvent).not.toHaveBeenCalled();
			expect(releaseMock).toHaveBeenCalledTimes(1);
		});

		it("TEST 이벤트 → 무시 (핸들러 미실행)", async () => {
			const payload = SubscriptionEventBuilder.test()
				.withAppUserId(APP_USER_ID)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.updateStatus).not.toHaveBeenCalled();
			expect(mockNotifier.notifySubscriptionEvent).not.toHaveBeenCalled();
		});

		it("SUBSCRIBER_ALIAS 이벤트 → 무시", async () => {
			const payload = SubscriptionEventBuilder.subscriberAlias()
				.withAppUserId(APP_USER_ID)
				.build();

			await useCase.execute(payload);

			expect(mockNotifier.notifySubscriptionEvent).not.toHaveBeenCalled();
		});

		it("알 수 없는 이벤트 타입 → 핸들러 없음, 쓰기 없음", async () => {
			const payload = SubscriptionEventBuilder.customType("FUTURE_EVENT")
				.withAppUserId(APP_USER_ID)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.updateStatus).not.toHaveBeenCalled();
			expect(mockNotifier.notifySubscriptionEvent).not.toHaveBeenCalled();
		});
	});

	describe("INITIAL_PURCHASE", () => {
		it("신규 구매 → create + User ACTIVE + 캐시 무효화 + 알림", async () => {
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withExpirationAtMs(FUTURE_MS)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({ revenueCatId: TXN_ID, status: "ACTIVE" }),
			);
			expect(mockRepository.updateUserSubscriptionStatus).toHaveBeenCalledWith(
				mockUser.id,
				expect.objectContaining({ subscriptionStatus: "ACTIVE" }),
			);
			expect(mockCache.invalidate).toHaveBeenCalledWith(mockUser.id);
			expect(mockNotifier.notifySubscriptionEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.id,
					eventType: "INITIAL_PURCHASE",
				}),
			);
		});

		it("이미 존재하는 구독 → create 스킵, 이벤트 미발행", async () => {
			mockRepository.findByRevenueCatId.mockResolvedValue(subscriptionOf({}));
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withExpirationAtMs(FUTURE_MS)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.create).not.toHaveBeenCalled();
			expect(mockCache.invalidate).not.toHaveBeenCalled();
			expect(mockNotifier.notifySubscriptionEvent).not.toHaveBeenCalled();
		});

		it("purchased_at_ms 누락 → SUBSCRIPTION_1604", async () => {
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withExpirationAtMs(FUTURE_MS)
				.withoutPurchasedAt()
				.build();

			await expectSwallowedFailure(payload, "SUBSCRIPTION_1604");
		});

		it("expiration_at_ms 누락 → SUBSCRIPTION_1604", async () => {
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withoutExpiration()
				.build();

			await expectSwallowedFailure(payload, "SUBSCRIPTION_1604");
		});

		it("NON_RENEWING_PURCHASE → 최초 구매 경로로 처리", async () => {
			const payload = SubscriptionEventBuilder.nonRenewingPurchase()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withExpirationAtMs(FUTURE_MS)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({ revenueCatId: TXN_ID, status: "ACTIVE" }),
			);
		});

		it("transaction_id / original_transaction_id 모두 없음 → SUBSCRIPTION_1604", async () => {
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId(APP_USER_ID)
				.withExpirationAtMs(FUTURE_MS)
				.withoutTransactionIds()
				.build();

			await expectSwallowedFailure(payload, "SUBSCRIPTION_1604");
		});
	});

	describe("RENEWAL", () => {
		it("갱신 → ACTIVE + expiresAt 업데이트", async () => {
			mockRepository.findByRevenueCatId.mockResolvedValue(
				subscriptionOf({ expiresAt: new Date(FUTURE_MS - 1000) }),
			);
			const payload = SubscriptionEventBuilder.renewal()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withExpirationAtMs(FUTURE_MS)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.updateStatus).toHaveBeenCalledWith(
				TXN_ID,
				expect.objectContaining({
					status: "ACTIVE",
					expiresAt: new Date(FUTURE_MS),
					cancelledAt: null,
				}),
			);
		});

		it("구독 없음 → SUBSCRIPTION_1604", async () => {
			mockRepository.findByRevenueCatId.mockResolvedValue(null);
			const payload = SubscriptionEventBuilder.renewal()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withExpirationAtMs(FUTURE_MS)
				.build();

			await expectSwallowedFailure(payload, "SUBSCRIPTION_1604");
		});

		it("동일 expiresAt으로 이미 갱신됨 → 스킵 (이벤트 미발행)", async () => {
			mockRepository.findByRevenueCatId.mockResolvedValue(
				subscriptionOf({ status: "ACTIVE", expiresAt: new Date(FUTURE_MS) }),
			);
			const payload = SubscriptionEventBuilder.renewal()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withExpirationAtMs(FUTURE_MS)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.updateStatus).not.toHaveBeenCalled();
			expect(mockNotifier.notifySubscriptionEvent).not.toHaveBeenCalled();
		});

		it("expiration_at_ms 누락 → SUBSCRIPTION_1604", async () => {
			const payload = SubscriptionEventBuilder.renewal()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withoutExpiration()
				.build();

			await expectSwallowedFailure(payload, "SUBSCRIPTION_1604");
		});
	});

	describe("CANCELLATION", () => {
		it("일반 취소 (미래 만료) → Subscription CANCELLED + User ACTIVE 유지", async () => {
			const payload = SubscriptionEventBuilder.cancellation()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withExpirationAtMs(FUTURE_MS)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.updateStatus).toHaveBeenCalledWith(
				TXN_ID,
				expect.objectContaining({
					status: "CANCELLED",
					cancelledAt: expect.any(Date),
				}),
			);
			expect(mockRepository.updateUserSubscriptionStatus).toHaveBeenCalledWith(
				mockUser.id,
				expect.objectContaining({ subscriptionStatus: "ACTIVE" }),
			);
		});

		it("환불 (CUSTOMER_SUPPORT) → Subscription EXPIRED + User FREE 즉시 회수", async () => {
			const payload = SubscriptionEventBuilder.refundCancellation()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withExpirationAtMs(FUTURE_MS)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.updateStatus).toHaveBeenCalledWith(
				TXN_ID,
				expect.objectContaining({ status: "EXPIRED" }),
			);
			expect(mockRepository.updateUserSubscriptionStatus).toHaveBeenCalledWith(
				mockUser.id,
				expect.objectContaining({
					subscriptionStatus: "FREE",
					subscriptionExpiresAt: null,
				}),
			);
		});
	});

	describe("UNCANCELLATION / EXPIRATION / BILLING_ISSUE", () => {
		it("UNCANCELLATION → ACTIVE + cancelledAt null", async () => {
			const payload = SubscriptionEventBuilder.uncancellation()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withExpirationAtMs(FUTURE_MS)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.updateStatus).toHaveBeenCalledWith(
				TXN_ID,
				expect.objectContaining({ status: "ACTIVE", cancelledAt: null }),
			);
		});

		it("EXPIRATION → Subscription EXPIRED + User FREE", async () => {
			const payload = SubscriptionEventBuilder.expiration()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.updateStatus).toHaveBeenCalledWith(
				TXN_ID,
				expect.objectContaining({ status: "EXPIRED" }),
			);
			expect(mockRepository.updateUserSubscriptionStatus).toHaveBeenCalledWith(
				mockUser.id,
				expect.objectContaining({
					subscriptionStatus: "FREE",
					subscriptionExpiresAt: null,
				}),
			);
		});

		it("BILLING_ISSUE → 상태 변경 없음, 캐시·알림·결제이슈 잡", async () => {
			const payload = SubscriptionEventBuilder.billingIssue()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.updateStatus).not.toHaveBeenCalled();
			expect(mockCache.invalidate).toHaveBeenCalledWith(mockUser.id);
			expect(mockNotifier.notifySubscriptionEvent).toHaveBeenCalledWith(
				expect.objectContaining({ eventType: "BILLING_ISSUE" }),
			);
			expect(mockNotifier.notifyBillingIssue).toHaveBeenCalledWith(mockUser.id);
		});
	});

	describe("PRODUCT_CHANGE / SUBSCRIPTION_EXTENDED", () => {
		it("PRODUCT_CHANGE → productId 업데이트 + User ACTIVE", async () => {
			const payload = SubscriptionEventBuilder.productChange()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withProductId("premium_yearly")
				.withExpirationAtMs(FUTURE_MS)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.updateStatus).toHaveBeenCalledWith(
				TXN_ID,
				expect.objectContaining({ productId: "premium_yearly" }),
			);
		});

		it("SUBSCRIPTION_EXTENDED → ACTIVE + expiresAt 갱신", async () => {
			const payload = SubscriptionEventBuilder.subscriptionExtended()
				.withAppUserId(APP_USER_ID)
				.withOriginalTransactionId(TXN_ID)
				.withExpirationAtMs(FUTURE_MS)
				.build();

			await useCase.execute(payload);

			expect(mockRepository.updateStatus).toHaveBeenCalledWith(
				TXN_ID,
				expect.objectContaining({
					status: "ACTIVE",
					expiresAt: new Date(FUTURE_MS),
				}),
			);
		});
	});

	describe("TRANSFER", () => {
		it("이미 올바른 매핑 → updateUser 스킵 (멱등)", async () => {
			mockRepository.findUserByAppUserId.mockResolvedValue(mockUser);
			const payload = SubscriptionEventBuilder.transfer()
				.withAppUserId(APP_USER_ID)
				.build();

			await useCase.execute(payload);

			expect(
				mockRepository.updateUserSubscriptionStatus,
			).not.toHaveBeenCalled();
			// 이벤트는 발행됨 (payload 반환)
			expect(mockNotifier.notifySubscriptionEvent).toHaveBeenCalledWith(
				expect.objectContaining({ eventType: "TRANSFER" }),
			);
		});

		it("다른 매핑 → revenueCatUserId 갱신", async () => {
			// 최초 조회는 현재 사용자, tx 내부 조회는 매핑 없음(null)
			mockRepository.findUserByAppUserId
				.mockResolvedValueOnce(mockUser)
				.mockResolvedValueOnce(null);
			const payload = SubscriptionEventBuilder.transfer()
				.withAppUserId("rc-new-app-user")
				.build();

			await useCase.execute(payload);

			expect(mockRepository.updateUserSubscriptionStatus).toHaveBeenCalledWith(
				mockUser.id,
				expect.objectContaining({ revenueCatUserId: "rc-new-app-user" }),
			);
		});
	});

	it("정상 처리 후 항상 release 호출 (finally)", async () => {
		const payload = SubscriptionEventBuilder.expiration()
			.withAppUserId(APP_USER_ID)
			.withOriginalTransactionId(TXN_ID)
			.build();

		await useCase.execute(payload);

		expect(releaseMock).toHaveBeenCalledTimes(1);
	});

	it("핸들러 예외 시에도 release 호출 (finally) + 실패 보고 후 200", async () => {
		mockRepository.findByRevenueCatId.mockResolvedValue(null);
		const payload = SubscriptionEventBuilder.renewal()
			.withAppUserId(APP_USER_ID)
			.withOriginalTransactionId(TXN_ID)
			.withExpirationAtMs(FUTURE_MS)
			.build();

		// #process가 던져도 finally에서 release, execute는 삼켜 200 + 보고
		const result = await useCase.execute(payload);
		expect(result).toEqual({ received: true });
		expect(mockNotifier.reportWebhookFailure).toHaveBeenCalledTimes(1);
		expect(releaseMock).toHaveBeenCalledTimes(1);
	});
});
