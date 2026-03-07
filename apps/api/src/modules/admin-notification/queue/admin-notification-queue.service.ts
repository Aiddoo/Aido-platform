import type { RevenueCatEventType, RevenueCatStore } from "@aido/validators";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import type { SubscriptionEventPayload } from "@/modules/subscription/events/subscription.events";
import type { UserRegisteredEventPayload } from "../events/admin-notification.events";
import {
	ADMIN_NOTIFICATION_JOB_OPTS,
	ADMIN_NOTIFICATION_QUEUE,
	type AdminNotificationJobData,
	AdminNotificationJobName,
	type AdminNotificationSendData,
} from "./admin-notification-queue.constants";

// =============================================================================
// Subscription 관련 타입 (Discord 알림 전용)
// =============================================================================

/** Discord 알림에서 사용하는 내부 이벤트 키 */
type SubscriptionEventKey =
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
const REVENUECAT_EVENT_TO_INTERNAL: Partial<
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

// =============================================================================
// User Registration 헬퍼
// =============================================================================

type Provider = UserRegisteredEventPayload["provider"];

/**
 * ISO 날짜 문자열을 Discord 타임스탬프 포맷으로 변환
 */
function formatDate(isoString: string): string {
	try {
		const unixSeconds = Math.floor(new Date(isoString).getTime() / 1000);
		return `<t:${unixSeconds}:f>`;
	} catch {
		return isoString;
	}
}

const PROVIDER_LABELS: Record<Provider, string> = {
	credential: "이메일",
	apple: "Apple",
	google: "Google",
	kakao: "Kakao",
	naver: "Naver",
};

/**
 * 가입 방식 → 기기 추정 라벨 (Apple/Google만 추정 가능)
 */
const PROVIDER_DEVICE_LABELS: Partial<Record<Provider, string>> = {
	apple: "🍎 iOS (추정)",
	google: "🤖 Android (추정)",
};

// =============================================================================
// Subscription 헬퍼
// =============================================================================

/**
 * 이벤트 타입별 알림 메타데이터
 */
interface EventMeta {
	title: string;
	color: number;
	emoji: string;
}

const EVENT_META: Record<SubscriptionEventKey, EventMeta> = {
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

const DEFAULT_META: EventMeta = {
	title: "구독 이벤트",
	color: 0x7289da,
	emoji: "📋",
};

/**
 * 스토어 이름 변환
 */
const STORE_LABELS: Partial<Record<RevenueCatStore, string>> = {
	APP_STORE: "Apple App Store",
	PLAY_STORE: "Google Play Store",
	STRIPE: "Stripe",
	AMAZON: "Amazon",
	PROMOTIONAL: "Promotional",
};

/**
 * 스토어 → 기기 추정 라벨
 */
const DEVICE_LABELS: Partial<Record<RevenueCatStore, string>> = {
	APP_STORE: "🍎 iOS",
	PLAY_STORE: "🤖 Android",
	STRIPE: "🌐 Web",
	AMAZON: "📦 Amazon",
	PROMOTIONAL: "🎁 프로모션",
};

/**
 * 가격 포맷
 */
function formatPrice(price: number, currency?: string): string {
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

// =============================================================================
// Service
// =============================================================================

/**
 * Admin 알림 BullMQ 큐 서비스
 *
 * Discord 알림의 embed 빌드 + 큐 등록을 통합합니다.
 * Fire-and-forget 패턴으로 큐 등록 실패 시 로깅만 수행합니다.
 */
@Injectable()
export class AdminNotificationQueueService {
	readonly #logger = new Logger(AdminNotificationQueueService.name);

	constructor(
		@InjectQueue(ADMIN_NOTIFICATION_QUEUE)
		private readonly queue: Queue<AdminNotificationJobData>,
	) {}

	/**
	 * 회원가입 관리자 알림 잡 등록
	 */
	enqueueUserRegistered(payload: UserRegisteredEventPayload): void {
		this.#enqueueUserRegisteredAsync(payload).catch((error) => {
			this.#logger.error(
				`Failed to enqueue user-registered notification: userId=${payload.userId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	/**
	 * 구독 이벤트 관리자 알림 잡 등록
	 */
	enqueueSubscriptionEvent(payload: SubscriptionEventPayload): void {
		this.#enqueueSubscriptionEventAsync(payload).catch((error) => {
			this.#logger.error(
				`Failed to enqueue subscription notification: userId=${payload.userId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	// =========================================================================
	// Private
	// =========================================================================

	async #enqueueUserRegisteredAsync(
		payload: UserRegisteredEventPayload,
	): Promise<void> {
		const providerLabel = PROVIDER_LABELS[payload.provider] ?? payload.provider;
		const deviceLabel = PROVIDER_DEVICE_LABELS[payload.provider];

		const fields: Array<{ name: string; value: string; inline?: boolean }> = [
			{ name: "이메일", value: payload.email, inline: true },
			{ name: "가입 방식", value: providerLabel, inline: true },
		];

		if (deviceLabel) {
			fields.push({ name: "기기 (추정)", value: deviceLabel, inline: true });
		}

		fields.push(
			{ name: "사용자 ID", value: payload.userId, inline: false },
			{
				name: "가입 시각",
				value: formatDate(payload.registeredAt),
				inline: false,
			},
		);

		await this.queue.add(
			AdminNotificationJobName.SEND,
			{
				channel: "admin",
				notification: {
					title: "새로운 회원가입",
					body: `**${payload.email}** 님이 가입했습니다.`,
					color: 0x57f287,
					fields,
				},
			} satisfies AdminNotificationSendData,
			ADMIN_NOTIFICATION_JOB_OPTS,
		);

		this.#logger.log(
			`Admin notification enqueued for new registration: ${payload.userId}`,
		);
	}

	async #enqueueSubscriptionEventAsync(
		payload: SubscriptionEventPayload,
	): Promise<void> {
		const eventKey = this.#resolveEventKey(payload.eventType);
		const meta = eventKey ? EVENT_META[eventKey] : DEFAULT_META;

		const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

		// 이메일
		fields.push({ name: "이메일", value: payload.email, inline: true });

		// 상품
		fields.push({ name: "상품", value: payload.productId, inline: true });

		// 스토어
		if (payload.store) {
			const storeLabel = STORE_LABELS[payload.store] ?? payload.store;
			fields.push({ name: "스토어", value: storeLabel, inline: true });
		}

		// 기기 (스토어 기반 추정)
		if (payload.store) {
			const deviceLabel = DEVICE_LABELS[payload.store] ?? payload.store;
			fields.push({ name: "기기", value: deviceLabel, inline: true });
		}

		// 금액
		if (payload.price != null) {
			fields.push({
				name: "금액",
				value: formatPrice(payload.price, payload.currency),
				inline: true,
			});
		}

		// 만료일
		if (payload.expiresAt) {
			fields.push({
				name: "만료일",
				value: formatDate(payload.expiresAt),
				inline: true,
			});
		}

		// 취소 사유
		if (payload.cancelReason) {
			fields.push({
				name: "취소 사유",
				value: payload.cancelReason,
				inline: false,
			});
		}

		// 사용자 ID
		fields.push({
			name: "사용자 ID",
			value: payload.userId,
			inline: false,
		});

		await this.queue.add(
			AdminNotificationJobName.SEND,
			{
				channel: "payment",
				notification: {
					title: `${meta.emoji} ${meta.title}`,
					body: `**${payload.email}** 님의 구독 이벤트 (${payload.eventType})`,
					color: meta.color,
					fields,
				},
			} satisfies AdminNotificationSendData,
			ADMIN_NOTIFICATION_JOB_OPTS,
		);

		this.#logger.log(
			`Admin notification enqueued for subscription event: ${payload.eventType}, userId=${payload.userId}`,
		);
	}

	/**
	 * RevenueCat 이벤트 타입을 내부 이벤트 키로 변환
	 */
	#resolveEventKey(
		eventType: RevenueCatEventType,
	): SubscriptionEventKey | undefined {
		return REVENUECAT_EVENT_TO_INTERNAL[eventType];
	}
}
