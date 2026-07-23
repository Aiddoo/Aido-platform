import { ErrorCode } from "@aido/errors";
import {
	type RevenueCatEventType,
	type RevenueCatWebhookPayload,
	revenueCatWebhookPayloadSchema,
} from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { now } from "@/shared/domain/date/utils/core";
import { toISOString } from "@/shared/domain/date/utils/format";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { cacheKey } from "@/shared/infrastructure/cache";
import {
	type ILockProvider,
	LOCK_PROVIDER,
} from "@/shared/infrastructure/lock";
import {
	isRefundCancellation,
	resolveCancellationUserStatus,
} from "../../../domain/services/cancellation-user-status";
import {
	nullableExpiresAt,
	optionalExpiresAt,
	requireExpiresAt,
	requirePurchasedAt,
} from "../../../domain/services/webhook-timestamps";
import { TransactionId } from "../../../domain/value-objects/transaction-id.vo";
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
import type { SubscriptionEventPayload } from "../../types/subscription-event.payload";
import { baseEventPayload } from "./subscription-event-payload.mapper";

type RevenueCatEvent = RevenueCatWebhookPayload["event"];

/**
 * RevenueCat 웹훅 이벤트 처리 use-case.
 *
 * `execute(body)`가 오케스트레이션(Zod 검증 → 처리 → 실패 보고)을 소유해 컨트롤러는
 * thin하게 유지된다. 항상 `{ received: true }`를 반환하되, Lock 경합(SUBSCRIPTION_1605)만
 * rethrow해 필터가 429로 변환한다(RevenueCat 재시도 유도). 그 외 에러는 notifier 포트로
 * 보고(Sentry·Discord)한 뒤 200으로 삼켜 무한 재시도를 막는다.
 *
 * 처리 플로우(`#process`): Lock 획득 → 사용자 조회 → event.id 중복 체크 → 이벤트 타입별
 * 트랜잭션 처리 → (DB 변경 시) 캐시 무효화 + 큐 잡 등록 → Lock 해제. 멱등성은 byte-identical.
 */
@Injectable()
export class HandleWebhookEventUseCase {
	readonly #logger = new Logger(HandleWebhookEventUseCase.name);

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
		@Inject(SUBSCRIPTION_REPOSITORY)
		private readonly subscriptionRepository: SubscriptionRepositoryPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		@Inject(SUBSCRIPTION_CACHE)
		private readonly cache: SubscriptionCachePort,
		@Inject(SUBSCRIPTION_EVENT_NOTIFIER)
		private readonly notifier: SubscriptionEventNotifierPort,
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
	) {}

	/**
	 * 웹훅 요청 본문을 검증·처리하고 항상 `{ received: true }`를 반환한다.
	 *
	 * - Zod 검증 실패 → 경고 로그 후 200 (RevenueCat 재시도 방지)
	 * - Lock 경합(SUBSCRIPTION_1605) → rethrow (필터가 429로 변환, 재시도 유도)
	 * - 그 외 에러 → notifier로 실패 보고(Sentry·Discord) 후 200
	 */
	async execute(body: unknown): Promise<{ received: true }> {
		const parseResult = revenueCatWebhookPayloadSchema.safeParse(body);
		if (!parseResult.success) {
			this.#logger.warn(
				`Invalid webhook payload: ${JSON.stringify(parseResult.error.issues)}`,
			);
			return { received: true };
		}

		const payload = parseResult.data;
		try {
			await this.#process(payload);
		} catch (error) {
			// Lock 경합 → 429 반환 (RevenueCat 재시도 유도)
			// SUBSCRIPTION_1605는 httpStatus=429이므로 GlobalExceptionFilter가 그대로 처리
			if (
				error instanceof ApplicationException &&
				error.errorCode === ErrorCode.SUBSCRIPTION_1605
			) {
				this.#logger.warn(`Lock contention, returning 429: ${error.message}`);
				throw error;
			}

			// 그 외 에러 → Sentry + Discord 알림 (200 반환, 무한 재시도 방지)
			this.notifier.reportWebhookFailure(error, payload);
			this.#logger.error(
				`Failed to process webhook event: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}

		return { received: true };
	}

	async #process(payload: RevenueCatWebhookPayload): Promise<void> {
		const { event } = payload;
		const appUserId = event.app_user_id;
		const eventType = event.type;

		this.#logger.log(
			`Processing webhook event: type=${eventType}, appUserId=${appUserId}, productId=${event.product_id}${event.id ? `, eventId=${event.id}` : ""}`,
		);

		// 1. Lock 획득
		const release = await this.lockProvider.acquire(
			cacheKey("subscription", "lock-revenuecat-webhook", appUserId),
			HandleWebhookEventUseCase.LOCK_TTL,
		);

		if (!release) {
			this.#logger.warn(
				`Lock contention for appUserId=${appUserId}, event=${eventType} — will retry via 429`,
			);
			throw new ApplicationException(ErrorCode.SUBSCRIPTION_1605, {
				appUserId,
			});
		}

		try {
			const user =
				await this.subscriptionRepository.findUserByAppUserId(appUserId);

			if (!user) {
				throw new ApplicationException(ErrorCode.SUBSCRIPTION_1602, {
					appUserId,
				});
			}

			// 2. event.id 기반 중복 체크 (event.id가 있고, 기존 구독이 있는 경우)
			const eventId = event.id;
			if (eventId) {
				const transactionId =
					event.original_transaction_id ?? event.transaction_id;
				if (transactionId) {
					const existing =
						await this.subscriptionRepository.findByRevenueCatId(transactionId);
					if (existing?.wasProcessedWith(eventId)) {
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
				await this.cache.invalidate(user.id);

				this.notifier.notifySubscriptionEvent(eventPayload);

				if (eventType === "BILLING_ISSUE") {
					this.notifier.notifyBillingIssue(user.id);
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

		const startedAt = requirePurchasedAt(
			event,
			"Missing purchased_at_ms for INITIAL_PURCHASE",
		);
		const expiresAt = requireExpiresAt(
			event,
			"Missing expiration_at_ms for INITIAL_PURCHASE",
		);

		const skipped = await this.uow.run(async () => {
			// 멱등성 가드: 중복 webhook 재전송 대비
			const existing =
				await this.subscriptionRepository.findByRevenueCatId(transactionId);
			if (existing) {
				this.#logger.log(
					`Subscription already exists for transactionId=${transactionId}, skipping create`,
				);
				return true;
			}

			await this.subscriptionRepository.create({
				userId: user.id,
				revenueCatId: transactionId,
				productId: event.product_id,
				status: "ACTIVE",
				startedAt,
				expiresAt,
				...(event.id && { lastProcessedEventId: event.id }),
			});

			await this.subscriptionRepository.updateUserSubscriptionStatus(user.id, {
				subscriptionStatus: "ACTIVE",
				subscriptionExpiresAt: expiresAt,
			});
			return false;
		});

		if (skipped) {
			return null;
		}

		this.#logger.log(
			`Initial purchase processed: userId=${user.id}, productId=${event.product_id}, transactionId=${transactionId}`,
		);

		return {
			...baseEventPayload(user, event, transactionId),
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

		const expiresAt = requireExpiresAt(
			event,
			"Missing expiration_at_ms for RENEWAL",
		);

		const skipped = await this.uow.run(async () => {
			// 멱등성 가드: 동일 expiresAt으로 이미 갱신되었으면 skip
			const existing =
				await this.subscriptionRepository.findByRevenueCatId(transactionId);
			if (!existing) {
				throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, {
					reason: `Subscription not found for RENEWAL: ${transactionId}`,
					eventType: event.type,
				});
			}
			if (existing.isActiveWithSameExpiry(expiresAt)) {
				this.#logger.log(
					`Already renewed with same expiresAt, skipping: transactionId=${transactionId}`,
				);
				return true;
			}

			await this.subscriptionRepository.updateStatus(transactionId, {
				status: "ACTIVE",
				expiresAt,
				cancelledAt: null,
				...(event.id && { lastProcessedEventId: event.id }),
			});

			await this.subscriptionRepository.updateUserSubscriptionStatus(user.id, {
				subscriptionStatus: "ACTIVE",
				subscriptionExpiresAt: expiresAt,
			});
			return false;
		});

		if (skipped) {
			return null;
		}

		this.#logger.log(
			`Renewal processed: userId=${user.id}, transactionId=${transactionId}, newExpiresAt=${toISOString(expiresAt)}`,
		);

		return {
			...baseEventPayload(user, event, transactionId),
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
		const webhookExpiresAt = nullableExpiresAt(event);
		const isRefund = isRefundCancellation(event.cancel_reason);

		await this.uow.run(async () => {
			// webhook expiresAt 없으면 DB 기존값 fallback
			let expiresAt = webhookExpiresAt;
			if (!expiresAt) {
				const existing =
					await this.subscriptionRepository.findByRevenueCatId(transactionId);
				expiresAt = existing?.expiresAt ?? null;
			}

			// 환불: Subscription EXPIRED, 일반 취소: Subscription CANCELLED
			await this.subscriptionRepository.updateStatus(transactionId, {
				status: isRefund ? "EXPIRED" : "CANCELLED",
				cancelledAt: now(),
				...(event.id && { lastProcessedEventId: event.id }),
			});

			if (isRefund) {
				// 환불: 즉시 접근 권한 회수
				await this.subscriptionRepository.updateUserSubscriptionStatus(
					user.id,
					{
						subscriptionStatus: "FREE",
						subscriptionExpiresAt: null,
					},
				);
			} else {
				// 일반 취소: 만료일까지 ACTIVE 유지 (60초 grace period로 clock skew 대응)
				const userStatus = resolveCancellationUserStatus(expiresAt);

				await this.subscriptionRepository.updateUserSubscriptionStatus(
					user.id,
					{
						subscriptionStatus: userStatus,
						...(expiresAt && { subscriptionExpiresAt: expiresAt }),
					},
				);
			}
		});

		this.#logger.log(
			`Cancellation processed: userId=${user.id}, transactionId=${transactionId}, isRefund=${isRefund}, expiresAt=${webhookExpiresAt ? toISOString(webhookExpiresAt) : "N/A"}`,
		);

		return {
			...baseEventPayload(user, event, transactionId),
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
		const expiresAt = optionalExpiresAt(event);

		await this.uow.run(async () => {
			await this.subscriptionRepository.updateStatus(transactionId, {
				status: "ACTIVE",
				cancelledAt: null,
				...(expiresAt && { expiresAt }),
				...(event.id && { lastProcessedEventId: event.id }),
			});

			await this.subscriptionRepository.updateUserSubscriptionStatus(user.id, {
				subscriptionStatus: "ACTIVE",
				...(expiresAt && { subscriptionExpiresAt: expiresAt }),
			});
		});

		this.#logger.log(
			`Uncancellation processed: userId=${user.id}, transactionId=${transactionId}`,
		);

		return {
			...baseEventPayload(user, event, transactionId),
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

		await this.uow.run(async () => {
			await this.subscriptionRepository.updateStatus(transactionId, {
				status: "EXPIRED",
				...(event.id && { lastProcessedEventId: event.id }),
			});

			await this.subscriptionRepository.updateUserSubscriptionStatus(user.id, {
				subscriptionStatus: "FREE",
				subscriptionExpiresAt: null,
			});
		});

		this.#logger.log(
			`Expiration processed: userId=${user.id}, transactionId=${transactionId}`,
		);

		return baseEventPayload(user, event, transactionId);
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

		return baseEventPayload(user, event, transactionId);
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
		const expiresAt = optionalExpiresAt(event);

		await this.uow.run(async () => {
			await this.subscriptionRepository.updateStatus(transactionId, {
				productId: event.product_id,
				...(expiresAt && { expiresAt }),
				...(event.id && { lastProcessedEventId: event.id }),
			});

			await this.subscriptionRepository.updateUserSubscriptionStatus(user.id, {
				subscriptionStatus: "ACTIVE",
				...(expiresAt && { subscriptionExpiresAt: expiresAt }),
			});
		});

		this.#logger.log(
			`Product change processed: userId=${user.id}, newProductId=${event.product_id}, transactionId=${transactionId}`,
		);

		return {
			...baseEventPayload(user, event, transactionId),
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
		const expiresAt = optionalExpiresAt(event);

		await this.uow.run(async () => {
			await this.subscriptionRepository.updateStatus(transactionId, {
				status: "ACTIVE",
				...(expiresAt && { expiresAt }),
				...(event.id && { lastProcessedEventId: event.id }),
			});

			await this.subscriptionRepository.updateUserSubscriptionStatus(user.id, {
				subscriptionStatus: "ACTIVE",
				...(expiresAt && { subscriptionExpiresAt: expiresAt }),
			});
		});

		this.#logger.log(
			`Subscription extended: userId=${user.id}, transactionId=${transactionId}, newExpiresAt=${expiresAt ? toISOString(expiresAt) : "N/A"}`,
		);

		return {
			...baseEventPayload(user, event, transactionId),
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
		await this.uow.run(async () => {
			const existingUser =
				await this.subscriptionRepository.findUserByAppUserId(newAppUserId);

			// 이미 올바른 매핑이면 skip (idempotency)
			if (existingUser?.id === user.id) {
				return;
			}

			await this.subscriptionRepository.updateUserSubscriptionStatus(user.id, {
				subscriptionStatus: existingUser?.subscriptionStatus ?? "ACTIVE",
				revenueCatUserId: newAppUserId,
			});
		});

		this.#logger.log(
			`Transfer: userId=${user.id}, revenueCatUserId → ${newAppUserId}`,
		);

		return baseEventPayload(user, event);
	}

	/**
	 * transactionId 추출 (빈 문자열 방지)
	 *
	 * RevenueCat은 original_transaction_id를 갱신 체인 식별에 사용합니다.
	 * 둘 다 없으면 webhook 처리 실패로 간주합니다.
	 */
	#resolveTransactionId(event: RevenueCatEvent): string {
		return TransactionId.resolve(
			event.original_transaction_id,
			event.transaction_id,
			event.type,
		).value;
	}
}
