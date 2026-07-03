export const TODO_NOTIFICATION = Symbol("TODO_NOTIFICATION");

/**
 * 친구 할일 전체 완료 알림 페이로드 (todo 컨텍스트 소유 계약)
 */
export interface FriendCompletedPayload {
	/** 완료한 친구 ID */
	friendId: string;
	/** 친구 이름 */
	friendName: string;
	/** 알림 대상 사용자 ID 목록 */
	notifyUserIds: string[];
	/** 타임존 (IANA) */
	timezone: string;
}

/** todo 컨텍스트가 발생시키는 완료 마일스톤 */
export type TodoCompletionMilestone =
	| "FIRST_COMPLETE"
	| "COUNT_10"
	| "COUNT_50"
	| "COUNT_100";

/**
 * 마일스톤 달성 알림 페이로드 (todo 컨텍스트 소유 계약)
 */
export interface MilestoneReachedPayload {
	/** 사용자 ID */
	userId: string;
	/** 달성한 마일스톤 유형 */
	milestone: TodoCompletionMilestone;
}

/**
 * Todo 관련 알림 큐 등록 포트 (notification 컨텍스트 경계)
 *
 * 페이로드 계약은 이 포트가 소유하며, notification의 JobData와의
 * 구조 매핑은 인프라 어댑터가 담당합니다.
 */
export interface TodoNotificationPort {
	enqueueFriendCompleted(payload: FriendCompletedPayload): void;
	enqueueMilestoneReached(payload: MilestoneReachedPayload): void;
}
