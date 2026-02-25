/**
 * 구독 이벤트 정의
 *
 * RevenueCat 웹훅으로부터 수신되는 구독 관련 이벤트.
 * AdminNotificationEvents 패턴을 따릅니다.
 *
 * @see apps/api/src/modules/admin-notification/events/admin-notification.events.ts
 */

export const SubscriptionEvents = {
	PURCHASED: "subscription.purchased",
	RENEWED: "subscription.renewed",
	CANCELLED: "subscription.cancelled",
	EXPIRED: "subscription.expired",
	BILLING_ISSUE: "subscription.billing_issue",
	UNCANCELLED: "subscription.uncancelled",
	PRODUCT_CHANGED: "subscription.product_changed",
} as const;

export type SubscriptionEventName =
	(typeof SubscriptionEvents)[keyof typeof SubscriptionEvents];

/**
 * 구독 이벤트 페이로드
 */
export interface SubscriptionEventPayload {
	/** 사용자 ID */
	userId: string;
	/** 이메일 */
	email: string;
	/** 이벤트 타입 (RevenueCat 원본 이벤트명) */
	eventType: string;
	/** 상품 ID */
	productId: string;
	/** 스토어 (app_store / play_store / stripe 등) */
	store?: string;
	/** 트랜잭션 ID */
	transactionId?: string;
	/** 구매 시각 (ISO string) */
	purchasedAt?: string;
	/** 만료 시각 (ISO string) */
	expiresAt?: string;
	/** 취소 사유 */
	cancelReason?: string;
	/** 가격 */
	price?: number;
	/** 통화 코드 (KRW, USD 등) */
	currency?: string;
}
