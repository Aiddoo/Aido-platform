/**
 * Notification 시스템 이벤트 정의
 *
 * Event-driven 아키텍처를 위한 이벤트 타입 및 페이로드 정의.
 * 각 모듈은 이벤트를 발행하고, NotificationModule의 리스너가 처리합니다.
 */

/**
 * 이벤트 이름 상수
 */
export const NotificationEvents = {
	// Follow 관련 이벤트
	FOLLOW_NEW: "follow.new",
	FOLLOW_MUTUAL: "follow.mutual",

	// Todo 관련 이벤트
	TODO_ALL_COMPLETED: "todo.all_completed",
	TODO_REMINDER: "todo.reminder",

	// Nudge 관련 이벤트
	NUDGE_SENT: "nudge.sent",

	// Cheer 관련 이벤트
	CHEER_SENT: "cheer.sent",

	// Friend 관련 이벤트 (친구의 할일 완료)
	FRIEND_COMPLETED: "friend.completed",
} as const;

export type NotificationEventName =
	(typeof NotificationEvents)[keyof typeof NotificationEvents];

/**
 * 팔로우 요청 이벤트 페이로드
 */
export interface FollowNewEventPayload {
	/** 팔로우 요청을 보낸 사용자 ID */
	followerId: string;
	/** 팔로우 요청을 받은 사용자 ID */
	followingId: string;
	/** 팔로우 요청자 이름 */
	followerName: string;
}

/**
 * 맞팔로우 성립 이벤트 페이로드
 * 각 사용자에게 개별 알림을 보내기 위해 수신자와 친구 정보를 분리
 */
export interface FollowMutualEventPayload {
	/** 알림을 받을 사용자 ID */
	userId: string;
	/** 새로 친구가 된 상대방 ID */
	friendId: string;
	/** 새로 친구가 된 상대방 이름 */
	friendName: string;
}

/**
 * 오늘 할일 전체 완료 이벤트 페이로드
 */
export interface TodoAllCompletedEventPayload {
	/** 할일을 완료한 사용자 ID */
	userId: string;
	/** 완료한 할일 개수 */
	completedCount: number;
}

/**
 * 할일 리마인더 이벤트 페이로드
 */
export interface TodoReminderEventPayload {
	/** 알림 대상 사용자 ID */
	userId: string;
	/** 할일 ID */
	todoId: number;
	/** 할일 제목 */
	todoTitle: string;
	/** 마감까지 남은 시간 (분) */
	minutesUntilDue: number;
}

/**
 * Nudge 발송 이벤트 페이로드
 */
export interface NudgeSentEventPayload {
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
}

/**
 * Cheer 발송 이벤트 페이로드
 */
export interface CheerSentEventPayload {
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
 * 친구 할일 완료 이벤트 페이로드
 */
export interface FriendCompletedEventPayload {
	/** 할일을 완료한 친구 ID */
	friendId: string;
	/** 친구 이름 */
	friendName: string;
	/** 알림을 받을 친구 ID 목록 */
	notifyUserIds: string[];
}

/**
 * 이벤트 타입 맵
 */
export interface NotificationEventPayloadMap {
	[NotificationEvents.FOLLOW_NEW]: FollowNewEventPayload;
	[NotificationEvents.FOLLOW_MUTUAL]: FollowMutualEventPayload;
	[NotificationEvents.TODO_ALL_COMPLETED]: TodoAllCompletedEventPayload;
	[NotificationEvents.TODO_REMINDER]: TodoReminderEventPayload;
	[NotificationEvents.NUDGE_SENT]: NudgeSentEventPayload;
	[NotificationEvents.CHEER_SENT]: CheerSentEventPayload;
	[NotificationEvents.FRIEND_COMPLETED]: FriendCompletedEventPayload;
}
