import type {
	FriendCompletedJobData,
	MilestoneReachedJobData,
} from "../../../notification/queue/notification-queue.constants";

export const TODO_NOTIFICATION = Symbol("TODO_NOTIFICATION");

/**
 * Todo 관련 알림 큐 등록 포트 (notification 컨텍스트 경계)
 *
 * 페이로드 타입은 알림 계약(JobData)을 재사용해 드리프트를 방지합니다.
 */
export interface TodoNotificationPort {
	enqueueFriendCompleted(payload: FriendCompletedJobData): void;
	enqueueMilestoneReached(payload: MilestoneReachedJobData): void;
}
