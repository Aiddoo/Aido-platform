import type { DatabaseService } from "@/database/database.service";
import type {
	Notification,
	Prisma,
	PushToken,
} from "@/generated/prisma/client";

/**
 * 트랜잭션 클라이언트 타입
 */
export type TransactionClient = Omit<
	DatabaseService,
	"$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * 알림 목록 조회 파라미터
 */
export interface FindNotificationsParams {
	userId: string;
	cursor?: number;
	size: number;
	unreadOnly?: boolean;
}

/**
 * 푸시 토큰 목록 조회 파라미터
 */
export interface FindPushTokensParams {
	userId: string;
	activeOnly?: boolean;
}

/**
 * 알림 생성 데이터
 */
export interface CreateNotificationData {
	userId: string;
	type: Prisma.NotificationCreateInput["type"];
	title: string;
	body: string;
	route?: string | null;
	todoId?: number | null;
	friendId?: string | null;
	nudgeId?: number | null;
	cheerId?: number | null;
	metadata?: Prisma.InputJsonValue | null;
}

/**
 * 푸시 토큰 등록 데이터
 */
export interface RegisterPushTokenData {
	userId: string;
	token: string;
	deviceId?: string;
	platform?: "IOS" | "ANDROID";
}

/**
 * 알림 with 관계 타입
 */
export type NotificationWithRelations = Notification;

/**
 * 푸시 토큰 with 관계 타입
 */
export type PushTokenWithRelations = PushToken;
