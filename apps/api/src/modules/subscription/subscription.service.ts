import type { RevenueCatWebhookPayload } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { CacheService } from "@/common/cache/cache.service";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";

import {
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
			`Processing webhook event: type=${eventType}, appUserId=${appUserId}, productId=${event.product_id}`,
		);

		// 1. Lock 획득
		const release = await this.lockProvider.acquire(
			`webhook:revenuecat:${appUserId}`,
			SubscriptionService.LOCK_TTL,
		);

		if (!release) {
			this.#logger.log(
				`Lock already held for appUserId=${appUserId}, skipping duplicate event: ${eventType}`,
			);
			return;
		}

		try {
			// 사용자 조회
			const user =
				await this.subscriptionRepository.findUserByAppUserId(appUserId);

			if (!user) {
				throw BusinessExceptions.subscriptionUserNotFound(appUserId);
			}

			// 2. 이벤트 타입별 처리
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

				case "BILLING_ISSUE_DETECTED":
					eventPayload = this.#handleBillingIssue(user.id, user.email, event);
					break;

				case "PRODUCT_CHANGE":
					eventPayload = await this.#handleProductChange(
						user.id,
						user.email,
						event,
					);
					break;

				case "SUBSCRIBER_ALIAS":
					this.#logger.log(
						`Subscriber alias event received for appUserId=${appUserId}, no action required`,
					);
					break;

				case "TRANSFER":
					this.#logger.log(
						`Transfer event received for appUserId=${appUserId}, no action required`,
					);
					break;

				default:
					this.#logger.warn(`Unknown event type: ${eventType}`);
					break;
			}

			// 3. 캐시 무효화 (DB 변경이 있었을 때만)
			if (eventPayload) {
				await Promise.all([
					this.cacheService.invalidateSubscription(user.id),
					this.cacheService.invalidateUserProfile(user.id),
				]);

				// 4. 이벤트 발행
				const emitEventName = this.#getEmitEventName(eventType);
				if (emitEventName) {
					this.eventEmitter.emit(emitEventName, eventPayload);
					this.#logger.log(
						`Event emitted: ${emitEventName} for userId=${user.id}`,
					);
				}
			}
		} finally {
			// 5. Lock 해제
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
	 * 멱등성: 동일 transactionId 구독이 이미 있으면 skip
	 */
	async #handleInitialPurchase(
		userId: string,
		email: string,
		event: RevenueCatWebhookPayload["event"],
	): Promise<SubscriptionEventPayload> {
		const transactionId = this.#resolveTransactionId(event);
		const startedAt = event.purchased_at_ms
			? new Date(event.purchased_at_ms)
			: new Date();
		const expiresAt = event.expiration_at_ms
			? new Date(event.expiration_at_ms)
			: new Date();

		await this.database.$transaction(async (tx) => {
			// 멱등성 가드: 중복 webhook 재전송 대비
			const existing = await this.subscriptionRepository.findByRevenueCatId(
				transactionId,
				tx,
			);
			if (existing) {
				this.#logger.log(
					`Subscription already exists for transactionId=${transactionId}, skipping create`,
				);
				return;
			}

			await this.subscriptionRepository.create(
				{
					userId,
					revenueCatId: transactionId,
					productId: event.product_id,
					status: "ACTIVE",
					startedAt,
					expiresAt,
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
		});

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
	 */
	async #handleRenewal(
		userId: string,
		email: string,
		event: RevenueCatWebhookPayload["event"],
	): Promise<SubscriptionEventPayload> {
		const transactionId = this.#resolveTransactionId(event);
		const expiresAt = event.expiration_at_ms
			? new Date(event.expiration_at_ms)
			: new Date();

		await this.database.$transaction(async (tx) => {
			await this.subscriptionRepository.updateStatus(
				transactionId,
				{
					status: "ACTIVE",
					expiresAt,
					cancelledAt: null,
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
		});

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
	 * CANCELLATION: 취소
	 *
	 * Subscription CANCELLED + User는 만료일까지 ACTIVE 유지.
	 * Apple/Google 스토어에서 취소해도 만료일까지 구독 혜택 유지.
	 */
	async #handleCancellation(
		userId: string,
		email: string,
		event: RevenueCatWebhookPayload["event"],
	): Promise<SubscriptionEventPayload> {
		const transactionId = this.#resolveTransactionId(event);
		const expiresAt = event.expiration_at_ms
			? new Date(event.expiration_at_ms)
			: null;

		await this.database.$transaction(async (tx) => {
			await this.subscriptionRepository.updateStatus(
				transactionId,
				{
					status: "CANCELLED",
					cancelledAt: new Date(),
				},
				tx,
			);

			// CANCELLATION 정책: expiresAt > now이면 User는 ACTIVE 유지
			const userStatus =
				expiresAt && expiresAt.getTime() > Date.now() ? "ACTIVE" : "CANCELLED";

			await this.subscriptionRepository.updateUserSubscriptionStatus(
				userId,
				{
					subscriptionStatus: userStatus,
					...(expiresAt && { subscriptionExpiresAt: expiresAt }),
				},
				tx,
			);
		});

		this.#logger.log(
			`Cancellation processed: userId=${userId}, transactionId=${transactionId}, expiresAt=${expiresAt?.toISOString() ?? "N/A"}`,
		);

		return {
			userId,
			email,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId,
			expiresAt: expiresAt?.toISOString(),
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
	 * Subscription EXPIRED + User EXPIRED
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
				},
				tx,
			);

			await this.subscriptionRepository.updateUserSubscriptionStatus(
				userId,
				{
					subscriptionStatus: "EXPIRED",
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
	 * BILLING_ISSUE_DETECTED: 결제 문제 감지
	 *
	 * 로그만 남기고 구독은 유지합니다.
	 */
	#handleBillingIssue(
		userId: string,
		email: string,
		event: RevenueCatWebhookPayload["event"],
	): SubscriptionEventPayload {
		this.#logger.log(
			`Billing issue detected: userId=${userId}, productId=${event.product_id}, store=${event.store ?? "unknown"}`,
		);

		return {
			userId,
			email,
			eventType: event.type,
			productId: event.product_id,
			store: event.store,
			transactionId: event.original_transaction_id ?? event.transaction_id,
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
				},
				tx,
			);

			if (expiresAt) {
				await this.subscriptionRepository.updateUserSubscriptionStatus(
					userId,
					{
						subscriptionStatus: "ACTIVE",
						subscriptionExpiresAt: expiresAt,
					},
					tx,
				);
			}
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
		switch (eventType) {
			case "INITIAL_PURCHASE":
				return SubscriptionEvents.PURCHASED;
			case "RENEWAL":
				return SubscriptionEvents.RENEWED;
			case "CANCELLATION":
				return SubscriptionEvents.CANCELLED;
			case "EXPIRATION":
				return SubscriptionEvents.EXPIRED;
			case "BILLING_ISSUE_DETECTED":
				return SubscriptionEvents.BILLING_ISSUE;
			case "UNCANCELLATION":
				return SubscriptionEvents.UNCANCELLED;
			case "PRODUCT_CHANGE":
				return SubscriptionEvents.PRODUCT_CHANGED;
			default:
				return null;
		}
	}
}
