/**
 * RevenueCat Webhook Payload 테스트 데이터 빌더
 *
 * RevenueCat 웹훅 이벤트 payload를 쉽게 생성하는 Builder.
 * static factory method로 이벤트 타입별 기본값 제공.
 *
 * @example
 * ```typescript
 * // 기본 초기 구매 이벤트
 * const payload = SubscriptionEventBuilder.initialPurchase().build();
 *
 * // 커스텀 설정
 * const payload = SubscriptionEventBuilder.renewal()
 *   .withAppUserId('user-123')
 *   .withProductId('premium_monthly')
 *   .build();
 * ```
 */
import type { RevenueCatWebhookPayload } from "@aido/validators";

type EventData = RevenueCatWebhookPayload["event"];

export class SubscriptionEventBuilder {
	private event: EventData;

	private constructor(type: EventData["type"]) {
		const now = Date.now();
		const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

		this.event = {
			type,
			app_user_id: `user-${crypto.randomUUID().slice(0, 8)}`,
			product_id: "premium_monthly",
			store: "APP_STORE",
			environment: "PRODUCTION",
			transaction_id: `txn-${crypto.randomUUID().slice(0, 8)}`,
			original_transaction_id: `otxn-${crypto.randomUUID().slice(0, 8)}`,
			purchased_at_ms: now,
			expiration_at_ms: now + thirtyDaysMs,
		};
	}

	// =========================================================================
	// Static Factory Methods
	// =========================================================================

	static initialPurchase(): SubscriptionEventBuilder {
		return new SubscriptionEventBuilder("INITIAL_PURCHASE");
	}

	static renewal(): SubscriptionEventBuilder {
		return new SubscriptionEventBuilder("RENEWAL");
	}

	static cancellation(): SubscriptionEventBuilder {
		const builder = new SubscriptionEventBuilder("CANCELLATION");
		builder.event.cancel_reason = "UNSUBSCRIBE";
		return builder;
	}

	static uncancellation(): SubscriptionEventBuilder {
		return new SubscriptionEventBuilder("UNCANCELLATION");
	}

	static expiration(): SubscriptionEventBuilder {
		const builder = new SubscriptionEventBuilder("EXPIRATION");
		builder.event.expiration_at_ms = Date.now() - 1000;
		return builder;
	}

	static billingIssue(): SubscriptionEventBuilder {
		return new SubscriptionEventBuilder("BILLING_ISSUE");
	}

	static productChange(): SubscriptionEventBuilder {
		return new SubscriptionEventBuilder("PRODUCT_CHANGE");
	}

	static test(): SubscriptionEventBuilder {
		return new SubscriptionEventBuilder("TEST");
	}

	static subscriberAlias(): SubscriptionEventBuilder {
		return new SubscriptionEventBuilder("SUBSCRIBER_ALIAS");
	}

	static transfer(): SubscriptionEventBuilder {
		return new SubscriptionEventBuilder("TRANSFER");
	}

	/** 알 수 없는(미래에 추가될) 이벤트 타입으로 빌더 생성 */
	static customType(type: string): SubscriptionEventBuilder {
		return new SubscriptionEventBuilder(type);
	}

	// =========================================================================
	// Chaining Methods
	// =========================================================================

	withAppUserId(appUserId: string): this {
		this.event.app_user_id = appUserId;
		return this;
	}

	withProductId(productId: string): this {
		this.event.product_id = productId;
		return this;
	}

	withStore(store: string): this {
		this.event.store = store;
		return this;
	}

	withTransactionId(transactionId: string): this {
		this.event.transaction_id = transactionId;
		return this;
	}

	withOriginalTransactionId(originalTransactionId: string): this {
		this.event.original_transaction_id = originalTransactionId;
		return this;
	}

	withPurchasedAtMs(purchasedAtMs: number): this {
		this.event.purchased_at_ms = purchasedAtMs;
		return this;
	}

	withExpirationAtMs(expirationAtMs: number): this {
		this.event.expiration_at_ms = expirationAtMs;
		return this;
	}

	withPrice(price: number, currency = "KRW"): this {
		this.event.price = price;
		this.event.currency = currency;
		return this;
	}

	withCancelReason(reason: string): this {
		this.event.cancel_reason = reason;
		return this;
	}

	withEnvironment(env: "SANDBOX" | "PRODUCTION"): this {
		this.event.environment = env;
		return this;
	}

	/** purchased_at_ms를 undefined로 설정 (누락 시뮬레이션) */
	withoutPurchasedAt(): this {
		this.event.purchased_at_ms = undefined;
		return this;
	}

	/** expiration_at_ms를 undefined로 설정 (누락 시뮬레이션) */
	withoutExpiration(): this {
		this.event.expiration_at_ms = undefined;
		return this;
	}

	/** expiration_at_ms를 null로 설정 */
	withNullExpiration(): this {
		this.event.expiration_at_ms = null;
		return this;
	}

	/** transaction_id와 original_transaction_id를 모두 제거 */
	withoutTransactionIds(): this {
		this.event.transaction_id = undefined;
		this.event.original_transaction_id = undefined;
		return this;
	}

	// =========================================================================
	// Build
	// =========================================================================

	build(): RevenueCatWebhookPayload {
		return {
			api_version: "4.0.0",
			event: { ...this.event },
		};
	}

	/** event 객체만 반환 */
	buildEvent(): EventData {
		return { ...this.event };
	}
}
