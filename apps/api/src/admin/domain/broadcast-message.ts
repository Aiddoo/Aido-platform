import type {
	BroadcastNotificationInput,
	NotificationAction,
} from "@aido/validators";

/** 브로드캐스트 대상 필터 (검증된 요청에서 파생된 도메인 개념) */
export type BroadcastTargetFilter = BroadcastNotificationInput["targetFilter"];

/** 관리자 발송 알림 종류 */
export type AdminBroadcastType = "ADMIN_BROADCAST" | "ADMIN_TARGETED";

/** 알림 메타데이터 — 외부 URL 액션이 있을 때만 부여 */
export type BroadcastMetadata = { externalUrl: string } | undefined;

/** 관리자 발송 알림 한 건 (벤더 중립 도메인 값) */
export interface AdminBroadcastMessage {
	userId: string;
	type: AdminBroadcastType;
	title: string;
	body: string;
	action?: NotificationAction;
	metadata?: { externalUrl: string };
}
