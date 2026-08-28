/**
 * 사용자 행동으로 한 번만 발생하는 알림의 카피 버전.
 *
 * 큐 payload와 중복 방지 키는 운영 계약이므로 그대로 두고, 카피 성과만 이 키로 분리한다.
 * 카피 풀 또는 의미가 바뀌면 해당 항목만 버전을 올린다.
 */
export const TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY = {
	FOLLOW_REQUEST: "follow_request_v1",
	FOLLOW_ACCEPTED: "follow_accepted_v1",
	NUDGE_RECEIVED: "nudge_received_v1",
	CHEER_RECEIVED: "cheer_received_v1",
	FRIEND_COMPLETED: "friend_completed_v1",
	TODO_COMMENT_ACTIVITY: "todo_comment_activity_v1",
} as const;
