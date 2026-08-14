import type {
	NotificationRecord,
	PushTokenRecord,
} from "../../domain/records/notification.record";
import type { NotificationType } from "../../domain/types/notification-type";
import type {
	CreateNotificationData,
	FindNotificationsParams,
	FindPushTokensParams,
	RegisterPushTokenData,
} from "./notification-data";
import type { PushReceiptResult, PushResult } from "./push-provider.port";

/** 알림 저장소 포트 (DI 토큰) */
export const NOTIFICATION_REPOSITORY = Symbol("NOTIFICATION_REPOSITORY");

export class DuplicateNotificationError extends Error {
	constructor() {
		super("Notification already exists");
		this.name = "DuplicateNotificationError";
	}
}

export class PushTokenNotFoundError extends Error {
	constructor() {
		super("Push token not found");
		this.name = "PushTokenNotFoundError";
	}
}

export type PushDispatchSkipReason =
	| "PUSH_SETTINGS_MISSING"
	| "PUSH_DISABLED"
	| "MARKETING_CONSENT_REQUIRED"
	| "MARKETING_QUIET_HOURS"
	| "NIGHT_PUSH_DISABLED"
	| "RATE_LIMITED"
	| "ENGAGEMENT_RATE_LIMITED"
	| "NO_ACTIVE_TOKEN"
	| "UNSUPPORTED_APP_CAPABILITY";

export type PushDispatchFailureReason = "UNEXPECTED_DISPATCH_ERROR";

export interface CreatePushDispatchInput {
	notificationId: number;
	userId: string;
	purpose: "TRANSACTIONAL" | "SCHEDULED_SERVICE" | "ENGAGEMENT";
	campaignKey?: string | null;
	variantId?: string | null;
	timezone: string;
	localDate: Date;
}

export interface PushDispatchRecord {
	id: number;
	notificationId: number;
}

export interface PushDispatchSkipUpdate {
	dispatchId: number;
	reason: PushDispatchSkipReason;
}

export interface PushDeliveryResultsInput {
	dispatchId: number;
	results: PushResult[];
}

/**
 * 알림·푸시 토큰 저장소 포트.
 *
 * 어댑터(Prisma)는 CLS TransactionHost 기반으로 활성 트랜잭션에 참여한다.
 */
export interface NotificationRepositoryPort {
	// --- Notification ---
	createNotification(data: CreateNotificationData): Promise<NotificationRecord>;
	createManyNotifications(
		dataList: CreateNotificationData[],
	): Promise<{ count: number }>;
	createManyNotificationsAndReturn(
		dataList: CreateNotificationData[],
	): Promise<NotificationRecord[]>;
	findNotificationById(id: number): Promise<NotificationRecord | null>;
	findNotificationsByUser(
		params: FindNotificationsParams,
	): Promise<NotificationRecord[]>;
	markAsRead(id: number, userId: string): Promise<boolean>;
	markAsOpened(id: number, userId: string): Promise<boolean>;
	markAllAsRead(userId: string): Promise<{ count: number }>;
	countUnread(userId: string): Promise<number>;
	deleteOldNotifications(daysOld?: number): Promise<{ count: number }>;
	existsRecentNotification(params: {
		userId: string;
		type: NotificationType;
		since: Date;
		friendId?: string;
		todoId?: number;
		nudgeId?: number;
		cheerId?: number;
	}): Promise<boolean>;
	findAlreadyNotifiedUserIds(params: {
		userIds: string[];
		type: NotificationType;
		notificationDate: Date;
		friendId?: string;
	}): Promise<Set<string>>;

	// --- PushToken ---
	registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord>;
	findPushTokensByUser(
		params: FindPushTokensParams,
	): Promise<PushTokenRecord[]>;
	findActivePushTokensByUsers(userIds: string[]): Promise<PushTokenRecord[]>;
	deletePushToken(userId: string, deviceId: string): Promise<PushTokenRecord>;
	deleteAllPushTokensByUser(userId: string): Promise<{ count: number }>;
	deactivateInvalidTokens(tokens: string[]): Promise<{ count: number }>;

	createPushDispatch(input: CreatePushDispatchInput): Promise<{ id: number }>;
	createPushDispatches(
		inputs: CreatePushDispatchInput[],
	): Promise<PushDispatchRecord[]>;
	markPushDispatchSkipped(
		dispatchId: number,
		reason: PushDispatchSkipReason,
	): Promise<void>;
	markPushDispatchesSkipped(updates: PushDispatchSkipUpdate[]): Promise<void>;
	markPushDispatchFailed(
		dispatchIds: number[],
		reason: PushDispatchFailureReason,
	): Promise<void>;
	recordPushDeliveryResults(
		dispatchId: number,
		results: PushResult[],
	): Promise<void>;
	recordPushDeliveryResultsBatch(
		inputs: PushDeliveryResultsInput[],
	): Promise<void>;
	findPendingPushReceipts(
		limit: number,
	): Promise<Array<{ ticketId: string; token: string }>>;
	recordPushReceipts(results: PushReceiptResult[]): Promise<string[]>;
}
