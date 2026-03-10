import type {
	RevenueCatEventType,
	RevenueCatWebhookPayload,
} from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { CacheService } from "@/common/cache/cache.service";
import { subtractMilliseconds } from "@/common/date/utils/arithmetic";
import { isAfter, isSame } from "@/common/date/utils/compare";
import { now } from "@/common/date/utils/core";
import { toISOString } from "@/common/date/utils/format";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";
import { AdminNotificationQueueService } from "@/modules/admin-notification/queue/admin-notification-queue.service";
import { NotificationQueueService } from "@/modules/notification/queue";

import type { SubscriptionEventPayload } from "./events/subscription.events";
import {
	SubscriptionRepository,
	type SubscriptionUser,
} from "./subscription.repository";

/**
 * 구독 서비스
 *
 * RevenueCat 웹훅 이벤트를 처리하여 구독 상태를 DB에 반영합니다.
 *
 * 플로우:
 * 1. Lock 획득 (중복 방지)
 * 2. 이벤트 타입별 DB 트랜잭션 처리
 * 3. 캐시 무효화
 * 4. 이벤트 발행 (Discord 알림 등)
 * 5. Lock 해제
 */
type RevenueCatEvent = RevenueCatWebhookPayload["event"];

@Injectable()
export class SubscriptionService {
	readonly #logger = new Logger(SubscriptionService.name);

	/** Lock TTL: 10초 */
	static readonly LOCK_TTL = 10_000;

	/** 무시할 이벤트 타입 (로그만 남김) */
	readonly #IGNORED_EVENTS = new Set(["TEST", "SUBSCRIBER_ALIAS"]);

	/** 이벤트 타입별 핸들러 맵 */
	readonly #eventHandlers = new Map<
		RevenueCatEventType,
		(
			user: SubscriptionUser,
			event: RevenueCatEvent,
		) => Promise<SubscriptionEventPayload | null>
	>([
		["INITIAL_PURCHASE", (u, ev) => this.#handleInitialPurchase(u, ev)],
		["RENEWAL", (u, ev) => this.#handleRenewal(u, ev)],
		["CANCELLATION", (u, ev) => this.#handleCancellation(u, ev)],
		["UNCANCELLATION", (u, ev) => this.#handleUncancellation(u, ev)],
		["EXPIRATION", (u, ev) => this.#handleExpiration(u, ev)],
		[
			"BILLING_ISSUE",
			(u, ev) => Promise.resolve(this.#handleBillingIssue(u, ev)),
		],
		["NON_RENEWING_PURCHASE", (u, ev) => this.#handleInitialPurchase(u, ev)],
		["PRODUCT_CHANGE", (u, ev) => this.#handleProductChange(u, ev)],
		[
			"SUBSCRIPTION_EXTENDED",
			(u, ev) => this.#handleSubscriptionExtended(u, ev),
		],
		["TRANSFER", (u, ev) => this.#handleTransfer(u, ev)],
	]);

	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		private readonly database: DatabaseService,
		private readonly cacheService: CacheService,
		private readonly adminNotificationQueueService: AdminNotificationQueueService,
		private readonly notificationQueueService: NotificationQueueService,
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
	) {}

	/**
	 * RevenueCat 웹훅 이벤트 처리
	 */
	async handleWebhookEvent(payload: RevenueCatWebhookPayload): Promise<void> {
		const { event } = payload;
		const appUserId = event.app_user_id;
		const eventType = event.type;

		this.#logger.log(
			`Processing webhook event: type=${eventType}, appUserId=${appUserId}, productId=${event.product_id}${event.id ? `, eventId=${event.id}` : ""}`,
		);

		// 1. Lock 획득
		const release = await this.lockProvider.acquire(
			`webhook:revenuecat:${appUserId}`,
			SubscriptionService.LOCK_TTL,
		);

		if (!release) {
			this.#logger.warn(
				`Lock contention for appUserId=${appUserId}, event=${eventType} — will retry via 429`,
			);
			throw BusinessExceptions.webhookLockContention(appUserId);
		}

		try {
			const user =
				await this.subscriptionRepository.findUserByAppUserId(appUserId);

			if (!user) {
				throw BusinessExceptions.subscriptionUserNotFound(appUserId);
			}

			// 2. event.id 기반 중복 체크 (event.id가 있고, 기존 구독이 있는 경우)
			const eventId = event.id;
			if (eventId) {
				const transactionId =
					event.original_transaction_id ?? event.transaction_id;
				if (transactionId) {
					const existing =
						await this.subscriptionRepository.findByRevenueCatId(transactionId);
					if (existing?.lastProcessedEventId === eventId) {
						this.#logger.log(
							`Duplicate event detected: eventId=${eventId}, transactionId=${transactionId} — skipping`,
						);
						return;
					}
				}
			}

			// 3. 무시할 이벤트 타입 처리
			if (this.#IGNORED_EVENTS.has(eventType)) {
				this.#logger.log(
					`Ignored event: ${eventType} for appUserId=${appUserId}`,
				);
				return;
			}

			// 4. 이벤트 타입별 핸들러 실행
			const handler = this.#eventHandlers.get(eventType);
			if (!handler) {
				this.#logger.warn(`Unknown event type: ${eventType}`);
				return;
			}

			const eventPayload = await handler(user, event);

			// 5. 캐시 무효화 + 큐 잡 등록 (DB 변경이 있었을 때만)
			if (eventPayload) {
				await Promise.all([
					this.cacheService.invalidateSubscription(user.id),
					this.cacheService.invalidateUserProfile(user.id),
				]);

				this.adminNotificationQueueService.enqueueSubscriptionEvent(
					eventPayload,
				);

				if (eventType === "BILLING_ISSUE") {
					this.notificationQueueService.enqueueBillingIssue({
						userId: user.id,
					});
				}

				this.#logger.log(
					`Subscription event processed: ${eventType} for userId=${user.id}`,
				);
			}
		} finally {
			// 6. Lock 해제
			await release();
		}
	}

	/**
	 * INITIAL_PURCHASE: 최초 구매
	 *
	 * Subscription 레코드 생성 + User 상태 ACTIVE
	 * 멱등성: 동일 transactionId 구독이 이미 있으면 skip → null 반환 (이벤트 미발행)
	 */
	async #handleInitialPurchase(
		user: SubscriptionUser,
		event: RevenueCatEvent,
	): Promise<SubscriptionEventPayload | null> {
		const transactionId = this.#resolveTransactionId(event);

		if (!event.purchased_at_ms) {
			throw BusinessExceptions.webhookProcessingFailed({
				reason: "Missing purchased_at_ms for INITIAL_PURCHASE",
				eventType: event.type,
			});
		}
		if (!event.expiration_at_ms) {
			throw BusinessExceptions.webhookProcessingFailed({
				reason: "Missing expiration_at_ms for INITIAL_PURCHASE",
				eventType: event.type,
			});
		}

		const startedAt = new Date(event.purchased_at_ms);
		const expiresAt = new Date(event.expiration_at_ms);

		const skipped = await this.database.$transaction(async (tx) => {
			// 멱등성 가드: 중복 webhook 재전송 대비
			const existing = await this.subscriptionRepository.findByRevenueCatId(
				transactionId,
				tx,
			);
			if (existing) {
				this.#logger.log(
					`Subscription already exists for transactionId=${transactionId}, skipping create`,
				);
				return true;
			}

			await this.subscriptionRepository.create(
				{
					userId: user.id,
					revenueCatId: transactionId,
					productId: event.product_id,
					status: "ACTIVE",
					startedAt,
					expiresAt,
					...(event.id && { lastProcessedEventId: event.id }),
				},
				tx,
			);

			await this.subscriptionRepository.updateUserSubscriptionStatus(
				user.id,
				{
					subscriptionStatus: "ACTIVE",
					subscriptionExpiresAt: expiresAt,
				},
				tx,
			);
			return false;
		});

		if (skipped) {
			return null;
		}

		this.#logger.log(
			`Initial purchase processed: userId=${user.id}, productId=${event.product_id}, transactionId=${transactionId}`,
		);

		return {
			userId: user.id,
			email: user.email,
			name: user.profile?.name ?? undefined,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
			purchasedAt: toISOString(startedAt),
			expiresAt: toISOString(expiresAt),
			priceUsd: event.price,
			priceInPurchasedCurrency: event.price_in_purchased_currency,
			purchasedCurrency: event.currency,
		} satisfies SubscriptionEventPayload;
	}

	/**
	 * RENEWAL: 갱신
	 *
	 * Subscription 갱신 + User 상태 ACTIVE + expiresAt 업데이트
	 * 멱등성: 동일 expiresAt으로 이미 갱신되었으면 skip → null 반환 (이벤트 미발행)
	 */
	async #handleRenewal(
		user: SubscriptionUser,
		event: RevenueCatEvent,
	): Promise<SubscriptionEventPayload | null> {
		const transactionId = this.#resolveTransactionId(event);

		if (!event.expiration_at_ms) {
			throw BusinessExceptions.webhookProcessingFailed({
				reason: "Missing expiration_at_ms for RENEWAL",
				eventType: event.type,
			});
		}

		const expiresAt = new Date(event.expiration_at_ms);

		const skipped = await this.database.$transaction(async (tx) => {
			// 멱등성 가드: 동일 expiresAt으로 이미 갱신되었으면 skip
			const existing = await this.subscriptionRepository.findByRevenueCatId(
				transactionId,
				tx,
			);
			if (!existing) {
				throw BusinessExceptions.webhookProcessingFailed({
					reason: `Subscription not found for RENEWAL: ${transactionId}`,
					eventType: event.type,
				});
			}
			if (
				existing.status === "ACTIVE" &&
				isSame(existing.expiresAt, expiresAt)
			) {
				this.#logger.log(
					`Already renewed with same expiresAt, skipping: transactionId=${transactionId}`,
				);
				return true;
			}

			await this.subscriptionRepository.updateStatus(
				transactionId,
				{
					status: "ACTIVE",
					expiresAt,
					cancelledAt: null,
					...(event.id && { lastProcessedEventId: event.id }),
				},
				tx,
			);

			await this.subscriptionRepository.updateUserSubscriptionStatus(
				user.id,
				{
					subscriptionStatus: "ACTIVE",
					subscriptionExpiresAt: expiresAt,
				},
				tx,
			);
			return false;
		});

		if (skipped) {
			return null;
		}

		this.#logger.log(
			`Renewal processed: userId=${user.id}, transactionId=${transactionId}, newExpiresAt=${toISOString(expiresAt)}`,
		);

		return {
			userId: user.id,
			email: user.email,
			name: user.profile?.name ?? undefined,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
			expiresAt: toISOString(expiresAt),
			priceUsd: event.price,
			priceInPurchasedCurrency: event.price_in_purchased_currency,
			purchasedCurrency: event.currency,
		} satisfies SubscriptionEventPayload;
	}

	/**
	 * CANCELLATION: 취소 또는 환불
	 *
	 * - 일반 취소 (UNSUBSCRIBE 등): Subscription CANCELLED + User는 만료일까지 ACTIVE 유지
	 * - 환불 (CUSTOMER_SUPPORT): Subscription EXPIRED + User 즉시 FREE (접근 권한 회수)
	 *
	 * RevenueCat은 환불을 별도 이벤트로 보내지 않고 CANCELLATION + cancel_reason으로 구분합니다.
	 */
	async #handleCancellation(
		user: SubscriptionUser,
		event: RevenueCatEvent,
	): Promise<SubscriptionEventPayload> {
		const transactionId = this.#resolveTransactionId(event);
		const webhookExpiresAt = event.expiration_at_ms
			? new Date(event.expiration_at_ms)
			: null;
		const isRefund = event.cancel_reason === "CUSTOMER_SUPPORT";

		await this.database.$transaction(async (tx) => {
			// webhook expiresAt 없으면 DB 기존값 fallback
			let expiresAt = webhookExpiresAt;
			if (!expiresAt) {
				const existing = await this.subscriptionRepository.findByRevenueCatId(
					transactionId,
					tx,
				);
				expiresAt = existing?.expiresAt ?? null;
			}

			// 환불: Subscription EXPIRED, 일반 취소: Subscription CANCELLED
			await this.subscriptionRepository.updateStatus(
				transactionId,
				{
					status: isRefund ? "EXPIRED" : "CANCELLED",
					cancelledAt: now(),
					...(event.id && { lastProcessedEventId: event.id }),
				},
				tx,
			);

			if (isRefund) {
				// 환불: 즉시 접근 권한 회수
				await this.subscriptionRepository.updateUserSubscriptionStatus(
					user.id,
					{
						subscriptionStatus: "FREE",
						subscriptionExpiresAt: null,
					},
					tx,
				);
			} else {
				// 일반 취소: 만료일까지 ACTIVE 유지
				// 60초 grace period로 clock skew 대응
				const gracePeriodMs = 60_000;
				const userStatus =
					expiresAt && isAfter(expiresAt, subtractMilliseconds(gracePeriodMs))
						? "ACTIVE"
						: "CANCELLED";

				await this.subscriptionRepository.updateUserSubscriptionStatus(
					user.id,
					{
						subscriptionStatus: userStatus,
						...(expiresAt && { subscriptionExpiresAt: expiresAt }),
					},
					tx,
				);
			}
		});

		this.#logger.log(
			`Cancellation processed: userId=${user.id}, transactionId=${transactionId}, isRefund=${isRefund}, expiresAt=${webhookExpiresAt ? toISOString(webhookExpiresAt) : "N/A"}`,
		);

		return {
			userId: user.id,
			email: user.email,
			name: user.profile?.name ?? undefined,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
			expiresAt: webhookExpiresAt ? toISOString(webhookExpiresAt) : undefined,
			cancelReason: event.cancel_reason,
		} satisfies SubscriptionEventPayload;
	}

	/**
	 * UNCANCELLATION: 취소 철회
	 *
	 * Subscription ACTIVE + cancelledAt null
	 */
	async #handleUncancellation(
		user: SubscriptionUser,
		event: RevenueCatEvent,
	): Promise<SubscriptionEventPayload> {
		const transactionId = this.#resolveTransactionId(event);
		const expiresAt = event.expiration_at_ms
			? new Date(event.expiration_at_ms)
			: undefined;

		await this.database.$transaction(async (tx) => {
			await this.subscriptionRepository.updateStatus(
				transactionId,
				{
					status: "ACTIVE",
					cancelledAt: null,
					...(expiresAt && { expiresAt }),
					...(event.id && { lastProcessedEventId: event.id }),
				},
				tx,
			);

			await this.subscriptionRepository.updateUserSubscriptionStatus(
				user.id,
				{
					subscriptionStatus: "ACTIVE",
					...(expiresAt && { subscriptionExpiresAt: expiresAt }),
				},
				tx,
			);
		});

		this.#logger.log(
			`Uncancellation processed: userId=${user.id}, transactionId=${transactionId}`,
		);

		return {
			userId: user.id,
			email: user.email,
			name: user.profile?.name ?? undefined,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
			expiresAt: expiresAt ? toISOString(expiresAt) : undefined,
		} satisfies SubscriptionEventPayload;
	}

	/**
	 * EXPIRATION: 만료
	 *
	 * Subscription EXPIRED + User FREE (무료 사용자로 복귀)
	 * subscriptionExpiresAt도 null로 초기화
	 */
	async #handleExpiration(
		user: SubscriptionUser,
		event: RevenueCatEvent,
	): Promise<SubscriptionEventPayload> {
		const transactionId = this.#resolveTransactionId(event);

		await this.database.$transaction(async (tx) => {
			await this.subscriptionRepository.updateStatus(
				transactionId,
				{
					status: "EXPIRED",
					...(event.id && { lastProcessedEventId: event.id }),
				},
				tx,
			);

			await this.subscriptionRepository.updateUserSubscriptionStatus(
				user.id,
				{
					subscriptionStatus: "FREE",
					subscriptionExpiresAt: null,
				},
				tx,
			);
		});

		this.#logger.log(
			`Expiration processed: userId=${user.id}, transactionId=${transactionId}`,
		);

		return {
			userId: user.id,
			email: user.email,
			name: user.profile?.name ?? undefined,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
		} satisfies SubscriptionEventPayload;
	}

	/**
	 * BILLING_ISSUE: 결제 문제 감지
	 *
	 * 로그만 남기고 구독은 유지합니다.
	 */
	#handleBillingIssue(
		user: SubscriptionUser,
		event: RevenueCatEvent,
	): SubscriptionEventPayload {
		const transactionId = this.#resolveTransactionId(event);
		this.#logger.log(
			`Billing issue detected: userId=${user.id}, productId=${event.product_id}, store=${event.store ?? "unknown"}`,
		);

		return {
			userId: user.id,
			email: user.email,
			name: user.profile?.name ?? undefined,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
		} satisfies SubscriptionEventPayload;
	}

	/**
	 * PRODUCT_CHANGE: 상품 변경
	 *
	 * Subscription productId 업데이트
	 */
	async #handleProductChange(
		user: SubscriptionUser,
		event: RevenueCatEvent,
	): Promise<SubscriptionEventPayload> {
		const transactionId = this.#resolveTransactionId(event);
		const expiresAt = event.expiration_at_ms
			? new Date(event.expiration_at_ms)
			: undefined;

		await this.database.$transaction(async (tx) => {
			await this.subscriptionRepository.updateStatus(
				transactionId,
				{
					productId: event.product_id,
					...(expiresAt && { expiresAt }),
					...(event.id && { lastProcessedEventId: event.id }),
				},
				tx,
			);

			await this.subscriptionRepository.updateUserSubscriptionStatus(
				user.id,
				{
					subscriptionStatus: "ACTIVE",
					...(expiresAt && { subscriptionExpiresAt: expiresAt }),
				},
				tx,
			);
		});

		this.#logger.log(
			`Product change processed: userId=${user.id}, newProductId=${event.product_id}, transactionId=${transactionId}`,
		);

		return {
			userId: user.id,
			email: user.email,
			name: user.profile?.name ?? undefined,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
			expiresAt: expiresAt ? toISOString(expiresAt) : undefined,
		} satisfies SubscriptionEventPayload;
	}

	/**
	 * SUBSCRIPTION_EXTENDED: 구독 연장
	 *
	 * Apple/Google이 서비스 크레딧 등으로 구독을 연장할 때 발생합니다.
	 * expiresAt 갱신 + ACTIVE 유지
	 */
	async #handleSubscriptionExtended(
		user: SubscriptionUser,
		event: RevenueCatEvent,
	): Promise<SubscriptionEventPayload> {
		const transactionId = this.#resolveTransactionId(event);
		const expiresAt = event.expiration_at_ms
			? new Date(event.expiration_at_ms)
			: undefined;

		await this.database.$transaction(async (tx) => {
			await this.subscriptionRepository.updateStatus(
				transactionId,
				{
					status: "ACTIVE",
					...(expiresAt && { expiresAt }),
					...(event.id && { lastProcessedEventId: event.id }),
				},
				tx,
			);

			await this.subscriptionRepository.updateUserSubscriptionStatus(
				user.id,
				{
					subscriptionStatus: "ACTIVE",
					...(expiresAt && { subscriptionExpiresAt: expiresAt }),
				},
				tx,
			);
		});

		this.#logger.log(
			`Subscription extended: userId=${user.id}, transactionId=${transactionId}, newExpiresAt=${expiresAt ? toISOString(expiresAt) : "N/A"}`,
		);

		return {
			userId: user.id,
			email: user.email,
			name: user.profile?.name ?? undefined,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
			expiresAt: expiresAt ? toISOString(expiresAt) : undefined,
		} satisfies SubscriptionEventPayload;
	}

	/**
	 * TRANSFER: 구독 이전
	 *
	 * RevenueCat에서 구독이 다른 사용자로 이전될 때 발생합니다.
	 * revenueCatUserId를 새 appUserId로 갱신합니다.
	 * subscriptionStatus는 현재 상태 유지 (TRANSFER는 상태 변경이 아닌 ID 매핑 변경)
	 */
	async #handleTransfer(
		user: SubscriptionUser,
		event: RevenueCatEvent,
	): Promise<SubscriptionEventPayload> {
		const newAppUserId = event.app_user_id;

		// revenueCatUserId를 새 appUserId로 갱신
		// subscriptionStatus는 현재 상태 유지 (TRANSFER는 상태 변경이 아닌 ID 매핑 변경)
		await this.database.$transaction(async (tx) => {
			const existingUser =
				await this.subscriptionRepository.findUserByAppUserId(newAppUserId, tx);

			// 이미 올바른 매핑이면 skip (idempotency)
			if (existingUser?.id === user.id) return;

			await this.subscriptionRepository.updateUserSubscriptionStatus(
				user.id,
				{
					subscriptionStatus: existingUser?.subscriptionStatus ?? "ACTIVE",
					revenueCatUserId: newAppUserId,
				},
				tx,
			);
		});

		this.#logger.log(
			`Transfer: userId=${user.id}, revenueCatUserId → ${newAppUserId}`,
		);

		return {
			userId: user.id,
			email: user.email,
			name: user.profile?.name ?? undefined,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
		} satisfies SubscriptionEventPayload;
	}

	/**
	 * transactionId 추출 (빈 문자열 방지)
	 *
	 * RevenueCat은 original_transaction_id를 갱신 체인 식별에 사용합니다.
	 * 둘 다 없으면 webhook 처리 실패로 간주합니다.
	 */
	#resolveTransactionId(event: RevenueCatEvent): string {
		const transactionId = event.original_transaction_id ?? event.transaction_id;
		if (!transactionId) {
			throw BusinessExceptions.webhookProcessingFailed({
				reason: "Missing transaction_id and original_transaction_id",
				eventType: event.type,
			});
		}
		return transactionId;
	}
}
