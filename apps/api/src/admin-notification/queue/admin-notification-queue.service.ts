import type { RevenueCatEventType } from "@aido/validators";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import type { SubscriptionEventPayload } from "@/subscription/events/subscription.events";
import type { UserRegisteredEventPayload } from "../events/admin-notification.events";
import {
	DEFAULT_META,
	DEVICE_LABELS,
	EVENT_META,
	formatDate,
	formatPrice,
	PROVIDER_DEVICE_LABELS,
	PROVIDER_LABELS,
	REVENUECAT_EVENT_TO_INTERNAL,
	STORE_LABELS,
	type SubscriptionEventKey,
} from "./admin-notification-formatter";
import {
	ADMIN_NOTIFICATION_JOB_OPTS,
	ADMIN_NOTIFICATION_QUEUE,
	type AdminNotificationJobData,
	AdminNotificationJobName,
	type AdminNotificationSendData,
} from "./admin-notification-queue.constants";

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

		fields.push({ name: "이메일", value: payload.email, inline: true });

		if (payload.name) {
			fields.push({ name: "이름", value: payload.name, inline: true });
		}

		fields.push({ name: "상품", value: payload.productId, inline: true });

		if (payload.store) {
			const storeLabel = STORE_LABELS[payload.store] ?? payload.store;
			fields.push({ name: "스토어", value: storeLabel, inline: true });
		}

		if (payload.store) {
			const deviceLabel = DEVICE_LABELS[payload.store] ?? payload.store;
			fields.push({ name: "기기", value: deviceLabel, inline: true });
		}

		if (payload.priceInPurchasedCurrency != null && payload.purchasedCurrency) {
			fields.push({
				name: "금액",
				value: formatPrice(
					payload.priceInPurchasedCurrency,
					payload.purchasedCurrency,
				),
				inline: true,
			});
		} else if (payload.priceUsd != null) {
			fields.push({
				name: "금액",
				value: formatPrice(payload.priceUsd, "USD"),
				inline: true,
			});
		}

		if (payload.expiresAt) {
			fields.push({
				name: "만료일",
				value: formatDate(payload.expiresAt),
				inline: true,
			});
		}

		if (payload.cancelReason) {
			fields.push({
				name: "취소 사유",
				value: payload.cancelReason,
				inline: false,
			});
		}

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
					body: `**${payload.name ?? payload.email}** 님의 구독 이벤트 (${payload.eventType})`,
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

	#resolveEventKey(
		eventType: RevenueCatEventType,
	): SubscriptionEventKey | undefined {
		return REVENUECAT_EVENT_TO_INTERNAL[eventType];
	}
}
