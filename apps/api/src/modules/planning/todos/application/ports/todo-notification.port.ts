import type { TodoCompletionMilestone } from "../../domain/todo-completion.domain-service.js";

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

/**
 * 마일스톤 달성 알림 페이로드 (todo 컨텍스트 소유 계약)
 *
 * 마일스톤 어휘(TodoCompletionMilestone)는 도메인 정책(completion-policy)이 소유합니다.
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
export abstract class TodoNotificationPort {
  abstract enqueueFriendCompleted(payload: FriendCompletedPayload): void;
  abstract enqueueMilestoneReached(payload: MilestoneReachedPayload): void;
}
