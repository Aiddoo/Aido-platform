import type { NotificationType } from "../types/notification-type";

/**
 * 알림 읽기 레코드 (도메인 소유 뷰).
 *
 * Prisma `Notification` 행이 구조적으로 이 인터페이스를 만족한다
 * (metadata는 불투명 `unknown`, 날짜는 `Date`). 어댑터는 Prisma 행을 그대로
 * 반환하고, 애플리케이션/도메인은 `@/generated` 결합 없이 이 레코드로 다룬다.
 */
export interface NotificationRecord {
	id: number;
	userId: string;
	type: NotificationType;
	title: string;
	body: string;
	isRead: boolean;
	todoId: number | null;
	friendId: string | null;
	nudgeId: number | null;
	cheerId: number | null;
	notificationDate: Date | null;
	metadata: unknown;
	createdAt: Date;
	readAt: Date | null;
	actionType: "DEEP_LINK" | "BROWSER" | "WEBVIEW" | "NONE";
	actionUrl: string | null;
	campaignKey: string | null;
	variantId: string | null;
	purpose: "TRANSACTIONAL" | "SCHEDULED_SERVICE" | "ENGAGEMENT";
	openedAt: Date | null;
}

/** 푸시 토큰 플랫폼 (Prisma `Platform` enum과 구조 동일) */
export type PushTokenPlatform = "IOS" | "ANDROID";

/**
 * 푸시 토큰 읽기 레코드 (도메인 소유 뷰).
 *
 * Prisma `PushToken` 행이 구조적으로 이 인터페이스를 만족한다.
 */
export interface PushTokenRecord {
	id: number;
	userId: string;
	token: string;
	deviceId: string;
	platform: PushTokenPlatform;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	lastUsedAt: Date;
	payloadVersion: number;
	appVersion: string | null;
}
