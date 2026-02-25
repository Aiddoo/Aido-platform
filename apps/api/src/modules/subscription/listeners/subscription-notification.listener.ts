import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
	ADMIN_NOTIFIER,
	type AdminNotifier,
} from "@/modules/admin-notification/providers/admin-notifier.interface";

import {
	REVENUECAT_EVENT_TO_INTERNAL,
	type SubscriptionEventPayload,
} from "../events/subscription.events";

/**
 * 이벤트 타입별 알림 메타데이터
 */
interface EventMeta {
	title: string;
	color: number;
	emoji: string;
}

const EVENT_META: Record<string, EventMeta> = {
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
};

const DEFAULT_META: EventMeta = {
	title: "구독 이벤트",
	color: 0x7289da,
	emoji: "📋",
};

/**
 * 스토어 이름 변환
 */
const STORE_LABELS: Record<string, string> = {
	APP_STORE: "Apple App Store",
	PLAY_STORE: "Google Play Store",
	STRIPE: "Stripe",
	AMAZON: "Amazon",
	PROMOTIONAL: "Promotional",
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

/**
 * ISO 날짜 문자열을 읽기 쉬운 형식으로 변환
 */
function formatDate(isoString: string): string {
	try {
		const date = new Date(isoString);
		return date.toLocaleString("ko-KR", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			timeZone: "Asia/Seoul",
		});
	} catch {
		return isoString;
	}
}

/**
 * 구독 이벤트 알림 리스너
 *
 * 구독 관련 이벤트를 수신하여 관리자 알림 채널(Discord 등)에 발송합니다.
 * UserRegistrationListener 패턴을 따릅니다.
 *
 * @see apps/api/src/modules/admin-notification/listeners/user-registration.listener.ts
 */
@Injectable()
export class SubscriptionNotificationListener {
	readonly #logger = new Logger(SubscriptionNotificationListener.name);

	constructor(
		@Inject(ADMIN_NOTIFIER)
		private readonly adminNotifier: AdminNotifier,
	) {}

	@OnEvent("subscription.*")
	async handleSubscriptionEvent(
		payload: SubscriptionEventPayload,
	): Promise<void> {
		this.#logger.debug(
			`Handling subscription event: ${payload.eventType} for userId=${payload.userId}`,
		);

		try {
			const eventKey = this.#resolveEventKey(payload.eventType);
			const meta = EVENT_META[eventKey] ?? DEFAULT_META;

			const fields: Array<{ name: string; value: string; inline?: boolean }> =
				[];

			// 이메일
			fields.push({ name: "이메일", value: payload.email, inline: true });

			// 상품
			fields.push({ name: "상품", value: payload.productId, inline: true });

			// 스토어
			if (payload.store) {
				const storeLabel = STORE_LABELS[payload.store] ?? payload.store;
				fields.push({ name: "스토어", value: storeLabel, inline: true });
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

			const result = await this.adminNotifier.send({
				title: `${meta.emoji} ${meta.title}`,
				body: `구독 이벤트가 발생했습니다. (${payload.eventType})`,
				color: meta.color,
				fields,
			});

			if (result.success) {
				this.#logger.log(
					`Admin notification sent for subscription event: ${payload.eventType}, userId=${payload.userId}`,
				);
			} else {
				this.#logger.warn(`Admin notification failed: ${result.error}`);
			}
		} catch (error) {
			this.#logger.error(
				`Failed to send admin notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	/**
	 * RevenueCat 이벤트 타입을 내부 이벤트 키로 변환
	 */
	#resolveEventKey(eventType: string): string {
		return REVENUECAT_EVENT_TO_INTERNAL[eventType] ?? eventType;
	}
}
