/**
 * 스트릭 마일스톤 알림 포트.
 *
 * 3일 연속 완료 등 스트릭 마일스톤 도달 시 알림을 등록한다(fire-and-forget void).
 * 어댑터가 notification 큐로 위임한다.
 */
export abstract class StreakMilestoneNotifierPort {
  abstract notifyStreak3Reached(userId: string): void;
}

/** 옛 토큰. 아직 옮기지 않은 소비 Context가 쓴다(같은 인스턴스 별칭으로 바인딩) */
export const STREAK_MILESTONE_NOTIFIER = Symbol("STREAK_MILESTONE_NOTIFIER");
