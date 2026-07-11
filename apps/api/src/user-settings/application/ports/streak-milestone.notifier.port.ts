/**
 * 스트릭 마일스톤 알림 포트.
 *
 * 3일 연속 완료 등 스트릭 마일스톤 도달 시 알림을 등록한다(fire-and-forget void).
 * 어댑터가 notification 큐로 위임한다.
 */
export interface StreakMilestoneNotifierPort {
	notifyStreak3Reached(userId: string): void;
}

export const STREAK_MILESTONE_NOTIFIER = Symbol("STREAK_MILESTONE_NOTIFIER");
