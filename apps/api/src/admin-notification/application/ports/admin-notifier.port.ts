/**
 * Admin Notifier 포트
 *
 * 관리자 알림 제공자 추상화 (Strategy Pattern)
 * 현재: Discord Webhook
 * 향후: Slack Webhook, Telegram Bot 등 지원 가능
 *
 * @see apps/api/src/notification/providers/push-provider.interface.ts
 */

import type { AdminNotification } from "../../domain/value-objects/admin-notification-message.vo";

export type {
	AdminNotification,
	AdminNotificationField,
} from "../../domain/value-objects/admin-notification-message.vo";

/**
 * 알림 발송 결과
 */
export interface AdminNotifyResult {
	/** 발송 성공 여부 */
	success: boolean;
	/** 에러 메시지 (실패 시) */
	error?: string;
}

/**
 * Admin Notifier Interface
 *
 * 모든 관리자 알림 제공자는 이 인터페이스를 구현해야 합니다.
 */
export interface AdminNotifier {
	/** 제공자 이름 */
	readonly name: string;

	/** 알림 발송 */
	send(notification: AdminNotification): Promise<AdminNotifyResult>;

	/** 제공자가 설정 완료되어 사용 가능한지 확인 */
	isConfigured(): boolean;
}

/**
 * Admin Notifier 토큰 (DI용)
 */
export const ADMIN_NOTIFIER = Symbol("ADMIN_NOTIFIER");

/**
 * Payment Notifier 토큰 (DI용)
 *
 * 결제/구독 관련 알림 전용 채널 (DISCORD_PAYMENT_WEBHOOK_URL)
 */
export const PAYMENT_NOTIFIER = Symbol("PAYMENT_NOTIFIER");
