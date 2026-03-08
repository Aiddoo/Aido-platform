import type { RevenueCatEventType, RevenueCatStore } from "@aido/validators";
import type { UserRegisteredEventPayload } from "../events/admin-notification.events";

/** Discord 알림에서 사용하는 내부 이벤트 키 */
export type SubscriptionEventKey =
	| "subscription.purchased"
	| "subscription.renewed"
	| "subscription.cancelled"
	| "subscription.expired"
	| "subscription.billing_issue"
	| "subscription.uncancelled"
	| "subscription.product_changed"
	| "subscription.refunded"
	| "subscription.extended"
	| "subscription.transferred";

/** RevenueCat 이벤트 타입 → 내부 이벤트 키 매핑 */
export const REVENUECAT_EVENT_TO_INTERNAL: Partial<
	Record<RevenueCatEventType, SubscriptionEventKey>
> = {
	INITIAL_PURCHASE: "subscription.purchased",
	RENEWAL: "subscription.renewed",
	CANCELLATION: "subscription.cancelled",
	EXPIRATION: "subscription.expired",
	BILLING_ISSUE: "subscription.billing_issue",
	UNCANCELLATION: "subscription.uncancelled",
	PRODUCT_CHANGE: "subscription.product_changed",
	NON_RENEWING_PURCHASE: "subscription.purchased",
	SUBSCRIPTION_EXTENDED: "subscription.extended",
	TRANSFER: "subscription.transferred",
};

export type Provider = UserRegisteredEventPayload["provider"];

/**
 * ISO 날짜 문자열을 Discord 타임스탬프 포맷으로 변환
 */
export function formatDate(isoString: string): string {
	try {
		const unixSeconds = Math.floor(new Date(isoString).getTime() / 1000);
		return `<t:${unixSeconds}:f>`;
	} catch {
		return isoString;
	}
}

export const PROVIDER_LABELS: Record<Provider, string> = {
	credential: "이메일",
	apple: "Apple",
	google: "Google",
	kakao: "Kakao",
	naver: "Naver",
};

/**
 * 가입 방식 → 기기 추정 라벨 (Apple/Google만 추정 가능)
 */
export const PROVIDER_DEVICE_LABELS: Partial<Record<Provider, string>> = {
	apple: "🍎 iOS (추정)",
	google: "🤖 Android (추정)",
};

interface EventMeta {
	title: string;
	color: number;
	emoji: string;
}

export const EVENT_META: Record<SubscriptionEventKey, EventMeta> = {
	"subscription.purchased": {
		title: "새로운 구독 구매",
		color: 0x57f287,
		emoji: "🎉",
	},
	"subscription.renewed": {
		title: "구독 갱신",
		color: 0x3498db,
		emoji: "🔄",
	},
	"subscription.cancelled": {
		title: "구독 취소",
		color: 0xe74c3c,
		emoji: "❌",
	},
	"subscription.expired": {
		title: "구독 만료",
		color: 0x95a5a6,
		emoji: "⏰",
	},
	"subscription.billing_issue": {
		title: "결제 문제 감지",
		color: 0xf1c40f,
		emoji: "⚠️",
	},
	"subscription.uncancelled": {
		title: "구독 취소 철회",
		color: 0xe67e22,
		emoji: "↩️",
	},
	"subscription.product_changed": {
		title: "구독 상품 변경",
		color: 0x9b59b6,
		emoji: "🔀",
	},
	"subscription.refunded": {
		title: "구독 환불",
		color: 0xe91e63,
		emoji: "💸",
	},
	"subscription.extended": {
		title: "구독 연장",
		color: 0x2ecc71,
		emoji: "⏳",
	},
	"subscription.transferred": {
		title: "구독 이전",
		color: 0x1abc9c,
		emoji: "🔀",
	},
};

export const DEFAULT_META: EventMeta = {
	title: "구독 이벤트",
	color: 0x7289da,
	emoji: "📋",
};

export const STORE_LABELS: Partial<Record<RevenueCatStore, string>> = {
	APP_STORE: "Apple App Store",
	PLAY_STORE: "Google Play Store",
	STRIPE: "Stripe",
	AMAZON: "Amazon",
	PROMOTIONAL: "Promotional",
};

export const DEVICE_LABELS: Partial<Record<RevenueCatStore, string>> = {
	APP_STORE: "🍎 iOS",
	PLAY_STORE: "🤖 Android",
	STRIPE: "🌐 Web",
	AMAZON: "📦 Amazon",
	PROMOTIONAL: "🎁 프로모션",
};

export function formatPrice(price: number, currency?: string): string {
	if (currency) {
		try {
			return new Intl.NumberFormat("ko-KR", {
				style: "currency",
				currency,
			}).format(price);
		} catch {
			// 알 수 없는 통화 코드인 경우 fallback
		}
	}
	return `${price.toLocaleString("ko-KR")}`;
}
