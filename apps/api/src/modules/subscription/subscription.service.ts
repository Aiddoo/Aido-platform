import type { RevenueCatWebhookPayload } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { CacheService } from "@/common/cache/cache.service";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";

import {
	REVENUECAT_EVENT_TO_INTERNAL,
	type SubscriptionEventPayload,
	SubscriptionEvents,
} from "./events/subscription.events";
import { SubscriptionRepository } from "./subscription.repository";

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
@Injectable()
export class SubscriptionService {
	readonly #logger = new Logger(SubscriptionService.name);

	/** Lock TTL: 10초 */
	static readonly LOCK_TTL = 10_000;

	constructor(
		private readonly subscriptionRepository: SubscriptionRepository,
		private readonly database: DatabaseService,
		private readonly cacheService: CacheService,
		private readonly eventEmitter: EventEmitter2,
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
			// 사용자 조회
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

			// 3. 이벤트 타입별 처리
			let eventPayload: SubscriptionEventPayload | null = null;

			switch (eventType) {
				case "INITIAL_PURCHASE":
					eventPayload = await this.#handleInitialPurchase(
						user.id,
						user.email,
						event,
					);
					break;

				case "RENEWAL":
					eventPayload = await this.#handleRenewal(user.id, user.email, event);
					break;

				case "CANCELLATION":
					eventPayload = await this.#handleCancellation(
						user.id,
						user.email,
						event,
					);
					break;

				case "UNCANCELLATION":
					eventPayload = await this.#handleUncancellation(
						user.id,
						user.email,
						event,
					);
					break;

				case "EXPIRATION":
					eventPayload = await this.#handleExpiration(
						user.id,
						user.email,
						event,
					);
					break;

				case "BILLING_ISSUE":
					eventPayload = this.#handleBillingIssue(user.id, user.email, event);
					break;

				case "NON_RENEWING_PURCHASE":
					eventPayload = await this.#handleInitialPurchase(
						user.id,
						user.email,
						event,
					);
					break;

				case "PRODUCT_CHANGE":
					eventPayload = await this.#handleProductChange(
						user.id,
						user.email,
						event,
					);
					break;

				case "SUBSCRIPTION_EXTENDED":
					eventPayload = await this.#handleSubscriptionExtended(
						user.id,
						user.email,
						event,
					);
					break;

				case "TEST":
					this.#logger.log(
						`Test webhook event received for appUserId=${appUserId}`,
					);
					break;

				case "SUBSCRIBER_ALIAS":
					// deprecated by RevenueCat — TRANSFER로 대체됨
					this.#logger.log(
						`Subscriber alias event received for appUserId=${appUserId}, no action required (deprecated)`,
					);
					break;

				case "TRANSFER":
					eventPayload = await this.#handleTransfer(user.id, user.email, event);
					break;

				default:
					this.#logger.warn(`Unknown event type: ${eventType}`);
					break;
			}

			// 4. 캐시 무효화 (DB 변경이 있었을 때만)
			if (eventPayload) {
				await Promise.all([
					this.cacheService.invalidateSubscription(user.id),
					this.cacheService.invalidateUserProfile(user.id),
				]);

				// 5. 이벤트 발행
				let emitEventName = this.#getEmitEventName(eventType);
				// 환불(CANCELLATION + CUSTOMER_SUPPORT)은 refunded 이벤트로 발행
				if (
					eventType === "CANCELLATION" &&
					eventPayload.cancelReason === "CUSTOMER_SUPPORT"
				) {
					emitEventName = SubscriptionEvents.REFUNDED;
				}
				if (emitEventName) {
					this.eventEmitter.emit(emitEventName, eventPayload);
					this.#logger.log(
						`Event emitted: ${emitEventName} for userId=${user.id}`,
					);
				}
			}
		} finally {
			// 6. Lock 해제
			await release();
		}
	}

	// =========================================================================
	// 이벤트 타입별 핸들러
	// =========================================================================

	/**
	 * INITIAL_PURCHASE: 최초 구매
	 *
	 * Subscription 레코드 생성 + User 상태 ACTIVE
	 * 멱등성: 동일 transactionId 구독이 이미 있으면 skip → null 반환 (이벤트 미발행)
	 */
	async #handleInitialPurchase(
		userId: string,
		email: string,
		event: RevenueCatWebhookPayload["event"],
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
					userId,
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
				userId,
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
			`Initial purchase processed: userId=${userId}, productId=${event.product_id}, transactionId=${transactionId}`,
		);

		return {
			userId,
			email,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
			purchasedAt: startedAt.toISOString(),
			expiresAt: expiresAt.toISOString(),
			price: event.price,
			currency: event.currency,
		} satisfies SubscriptionEventPayload;
	}

	/**
	 * RENEWAL: 갱신
	 *
	 * Subscription 갱신 + User 상태 ACTIVE + expiresAt 업데이트
	 * 멱등성: 동일 expiresAt으로 이미 갱신되었으면 skip → null 반환 (이벤트 미발행)
	 */
	async #handleRenewal(
		userId: string,
		email: string,
		event: RevenueCatWebhookPayload["event"],
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
				existing.expiresAt.getTime() === expiresAt.getTime()
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
				userId,
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
			`Renewal processed: userId=${userId}, transactionId=${transactionId}, newExpiresAt=${expiresAt.toISOString()}`,
		);

		return {
			userId,
			email,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
			expiresAt: expiresAt.toISOString(),
			price: event.price,
			currency: event.currency,
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
		userId: string,
		email: string,
		event: RevenueCatWebhookPayload["event"],
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
					cancelledAt: new Date(),
					...(event.id && { lastProcessedEventId: event.id }),
				},
				tx,
			);

			if (isRefund) {
				// 환불: 즉시 접근 권한 회수
				await this.subscriptionRepository.updateUserSubscriptionStatus(
					userId,
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
					expiresAt && expiresAt.getTime() > Date.now() - gracePeriodMs
						? "ACTIVE"
						: "CANCELLED";

				await this.subscriptionRepository.updateUserSubscriptionStatus(
					userId,
					{
						subscriptionStatus: userStatus,
						...(expiresAt && { subscriptionExpiresAt: expiresAt }),
					},
					tx,
				);
			}
		});

		this.#logger.log(
			`Cancellation processed: userId=${userId}, transactionId=${transactionId}, isRefund=${isRefund}, expiresAt=${webhookExpiresAt?.toISOString() ?? "N/A"}`,
		);

		return {
			userId,
			email,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
			expiresAt: webhookExpiresAt?.toISOString(),
			cancelReason: event.cancel_reason,
		} satisfies SubscriptionEventPayload;
	}

	/**
	 * UNCANCELLATION: 취소 철회
	 *
	 * Subscription ACTIVE + cancelledAt null
	 */
	async #handleUncancellation(
		userId: string,
		email: string,
		event: RevenueCatWebhookPayload["event"],
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
				userId,
				{
					subscriptionStatus: "ACTIVE",
					...(expiresAt && { subscriptionExpiresAt: expiresAt }),
				},
				tx,
			);
		});

		this.#logger.log(
			`Uncancellation processed: userId=${userId}, transactionId=${transactionId}`,
		);

		return {
			userId,
			email,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
			expiresAt: expiresAt?.toISOString(),
		} satisfies SubscriptionEventPayload;
	}

	/**
	 * EXPIRATION: 만료
	 *
	 * Subscription EXPIRED + User FREE (무료 사용자로 복귀)
	 * subscriptionExpiresAt도 null로 초기화
	 */
	async #handleExpiration(
		userId: string,
		email: string,
		event: RevenueCatWebhookPayload["event"],
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
				userId,
				{
					subscriptionStatus: "FREE",
					subscriptionExpiresAt: null,
				},
				tx,
			);
		});

		this.#logger.log(
			`Expiration processed: userId=${userId}, transactionId=${transactionId}`,
		);

		return {
			userId,
			email,
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
		userId: string,
		email: string,
		event: RevenueCatWebhookPayload["event"],
	): SubscriptionEventPayload {
		const transactionId = this.#resolveTransactionId(event);
		this.#logger.log(
			`Billing issue detected: userId=${userId}, productId=${event.product_id}, store=${event.store ?? "unknown"}`,
		);

		return {
			userId,
			email,
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
		userId: string,
		email: string,
		event: RevenueCatWebhookPayload["event"],
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
				userId,
				{
					subscriptionStatus: "ACTIVE",
					...(expiresAt && { subscriptionExpiresAt: expiresAt }),
				},
				tx,
			);
		});

		this.#logger.log(
			`Product change processed: userId=${userId}, newProductId=${event.product_id}, transactionId=${transactionId}`,
		);

		return {
			userId,
			email,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
			expiresAt: expiresAt?.toISOString(),
		} satisfies SubscriptionEventPayload;
	}

	/**
	 * SUBSCRIPTION_EXTENDED: 구독 연장
	 *
	 * Apple/Google이 서비스 크레딧 등으로 구독을 연장할 때 발생합니다.
	 * expiresAt 갱신 + ACTIVE 유지
	 */
	async #handleSubscriptionExtended(
		userId: string,
		email: string,
		event: RevenueCatWebhookPayload["event"],
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
				userId,
				{
					subscriptionStatus: "ACTIVE",
					...(expiresAt && { subscriptionExpiresAt: expiresAt }),
				},
				tx,
			);
		});

		this.#logger.log(
			`Subscription extended: userId=${userId}, transactionId=${transactionId}, newExpiresAt=${expiresAt?.toISOString() ?? "N/A"}`,
		);

		return {
			userId,
			email,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
			expiresAt: expiresAt?.toISOString(),
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
		userId: string,
		email: string,
		event: RevenueCatWebhookPayload["event"],
	): Promise<SubscriptionEventPayload> {
		const newAppUserId = event.app_user_id;

		// revenueCatUserId를 새 appUserId로 갱신
		// subscriptionStatus는 현재 상태 유지 (TRANSFER는 상태 변경이 아닌 ID 매핑 변경)
		await this.database.$transaction(async (tx) => {
			const existingUser =
				await this.subscriptionRepository.findUserByAppUserId(newAppUserId, tx);

			// 이미 올바른 매핑이면 skip (idempotency)
			if (existingUser?.id === userId) return;

			await this.subscriptionRepository.updateUserSubscriptionStatus(
				userId,
				{
					subscriptionStatus: existingUser?.subscriptionStatus ?? "ACTIVE",
					revenueCatUserId: newAppUserId,
				},
				tx,
			);
		});

		this.#logger.log(
			`Transfer: userId=${userId}, revenueCatUserId → ${newAppUserId}`,
		);

		return {
			userId,
			email,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
		} satisfies SubscriptionEventPayload;
	}

	// =========================================================================
	// 유틸리티
	// =========================================================================

	/**
	 * transactionId 추출 (빈 문자열 방지)
	 *
	 * RevenueCat은 original_transaction_id를 갱신 체인 식별에 사용합니다.
	 * 둘 다 없으면 webhook 처리 실패로 간주합니다.
	 */
	#resolveTransactionId(event: RevenueCatWebhookPayload["event"]): string {
		const transactionId = event.original_transaction_id ?? event.transaction_id;
		if (!transactionId) {
			throw BusinessExceptions.webhookProcessingFailed({
				reason: "Missing transaction_id and original_transaction_id",
				eventType: event.type,
			});
		}
		return transactionId;
	}

	/**
	 * 이벤트 타입에 대응하는 내부 이벤트명 반환
	 */
	#getEmitEventName(eventType: string): string | null {
		return REVENUECAT_EVENT_TO_INTERNAL[eventType] ?? null;
	}
}
