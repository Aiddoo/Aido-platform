import type { SubscriptionEventPayload } from "@/subscription";

import type { UserRegisteredEventPayload } from "../types/user-registered.payload";
import {
	type AdminNotificationField,
	AdminNotificationMessage,
} from "../value-objects/admin-notification-message.vo";
import { formatDate, formatPrice } from "./discord-format";
import { accountProviderLabel, PROVIDER_DEVICE_LABELS, PROVIDER_LABELS } from "./provider-labels";
import {
	DEFAULT_META,
	DEVICE_LABELS,
	EVENT_META,
	REVENUECAT_EVENT_TO_INTERNAL,
	STORE_LABELS,
} from "./subscription-event-meta";

/** 전일 가입 집계 (provider별 count + 총 사용자 수) */
export interface DailySignupSummary {
	signupsByProvider: Array<{ provider: string; count: number }>;
	totalUsers: number;
	reportDateStr: string;
}

/**
 * 회원가입 관리자 알림 메시지 조립.
 */
export function buildUserRegisteredMessage(
	payload: UserRegisteredEventPayload,
): AdminNotificationMessage {
	const providerLabel = PROVIDER_LABELS[payload.provider] ?? payload.provider;
	const deviceLabel = PROVIDER_DEVICE_LABELS[payload.provider];

	const fields: AdminNotificationField[] = [
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

	return AdminNotificationMessage.create({
		title: "새로운 회원가입",
		body: `**${payload.email}** 님이 가입했습니다.`,
		color: 0x57f287,
		fields,
	});
}

/**
 * 구독 이벤트 관리자 알림 메시지 조립.
 */
export function buildSubscriptionEventMessage(
	payload: SubscriptionEventPayload,
): AdminNotificationMessage {
	const eventKey = REVENUECAT_EVENT_TO_INTERNAL[payload.eventType];
	const meta = eventKey ? EVENT_META[eventKey] : DEFAULT_META;

	const fields: AdminNotificationField[] = [];

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
			value: formatPrice(payload.priceInPurchasedCurrency, payload.purchasedCurrency),
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

	return AdminNotificationMessage.create({
		title: `${meta.emoji} ${meta.title}`,
		body: `**${payload.name ?? payload.email}** 님의 구독 이벤트 (${payload.eventType})`,
		color: meta.color,
		fields,
	});
}

/**
 * 일일 가입 요약 관리자 알림 메시지 조립.
 */
export function buildDailySummaryMessage(summary: DailySignupSummary): AdminNotificationMessage {
	const previousDayTotal = summary.signupsByProvider.reduce((sum, group) => sum + group.count, 0);

	const providerBreakdown = summary.signupsByProvider
		.map((group) => {
			const label = accountProviderLabel(group.provider);
			return `- ${label}: ${group.count}명`;
		})
		.join("\n");

	return AdminNotificationMessage.create({
		title: `일일 가입 리포트 | ${summary.reportDateStr} (KST)`,
		body:
			previousDayTotal > 0
				? `전일 신규 가입은 ${previousDayTotal}명입니다.\n\n가입 채널별\n${providerBreakdown}`
				: "전일 신규 가입은 0명입니다.",
		color: 0x5865f2,
		fields: [
			{
				name: "전일 신규 가입",
				value: `${previousDayTotal}명`,
				inline: true,
			},
			{
				name: "총 사용자 수",
				value: `${summary.totalUsers.toLocaleString()}명`,
				inline: true,
			},
			{
				name: "집계 기준",
				value: `${summary.reportDateStr} 00:00 ~ 23:59 (KST)`,
				inline: false,
			},
		],
	});
}
