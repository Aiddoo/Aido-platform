/**
 * Notification BullMQ 큐 상수 및 잡 데이터 타입 정의
 *
 * BullMQ 큐 잡 타입 및 상수 정의.
 * 각 잡 타입별 데이터 인터페이스와 잡 이름을 관리합니다.
 */

// =============================================================================
// Queue Name
// =============================================================================

export const NOTIFICATION_QUEUE = "notification";

// =============================================================================
// Job Names
// =============================================================================

/** 알림 잡 이름 상수 */
export const NotificationJobName = {
	FOLLOW_NEW: "follow-new",
	FOLLOW_MUTUAL: "follow-mutual",
	NUDGE_SENT: "nudge-sent",
	CHEER_SENT: "cheer-sent",
	BILLING_ISSUE: "billing-issue",
	FRIEND_COMPLETED: "friend-completed",
} as const;

// =============================================================================
// Job Data Interfaces
// =============================================================================

/**
 * 새 팔로우 요청 잡 데이터
 */
export interface FollowNewJobData {
	/** 팔로우 요청을 보낸 사용자 ID */
	followerId: string;
	/** 팔로우 요청을 받은 사용자 ID */
	followingId: string;
	/** 팔로우 요청자 이름 */
	followerName: string;
}

/**
 * 맞팔로우 성립 잡 데이터
 */
export interface FollowMutualJobData {
	/** 알림을 받을 사용자 ID */
	userId: string;
	/** 새로 친구가 된 상대방 ID */
	friendId: string;
	/** 새로 친구가 된 상대방 이름 */
	friendName: string;
}

/**
 * Nudge 발송 잡 데이터
 */
export interface NudgeSentJobData {
	/** Nudge ID */
	nudgeId: number;
	/** 보낸 사용자 ID */
	senderId: string;
	/** 받는 사용자 ID */
	receiverId: string;
	/** 보낸 사용자 이름 */
	senderName: string;
	/** 대상 할일 ID (선택) */
	todoId?: number;
	/** 대상 할일 제목 (선택) */
	todoTitle?: string;
	/** 찌르기 메시지 (선택) */
	message?: string;
}

/**
 * Cheer 발송 잡 데이터
 */
export interface CheerSentJobData {
	/** Cheer ID */
	cheerId: number;
	/** 보낸 사용자 ID */
	senderId: string;
	/** 받는 사용자 ID */
	receiverId: string;
	/** 보낸 사용자 이름 */
	senderName: string;
	/** 응원 메시지 (선택) */
	message?: string;
}

/**
 * 결제 문제 잡 데이터
 */
export interface BillingIssueJobData {
	/** 사용자 ID */
	userId: string;
}

/**
 * 친구 할일 전체 완료 잡 데이터
 */
export interface FriendCompletedJobData {
	/** 완료한 친구 ID */
	friendId: string;
	/** 친구 이름 */
	friendName: string;
	/** 알림 대상 사용자 ID 목록 */
	notifyUserIds: string[];
	/** 타임존 (IANA) */
	timezone: string;
}

// =============================================================================
// Job Data Union & Map
// =============================================================================

/** 잡 이름 → 데이터 타입 매핑 */
export interface NotificationJobMap {
	[NotificationJobName.FOLLOW_NEW]: FollowNewJobData;
	[NotificationJobName.FOLLOW_MUTUAL]: FollowMutualJobData;
	[NotificationJobName.NUDGE_SENT]: NudgeSentJobData;
	[NotificationJobName.CHEER_SENT]: CheerSentJobData;
	[NotificationJobName.BILLING_ISSUE]: BillingIssueJobData;
	[NotificationJobName.FRIEND_COMPLETED]: FriendCompletedJobData;
}

/** 모든 잡 데이터 유니온 타입 */
export type NotificationJobData = NotificationJobMap[keyof NotificationJobMap];
