import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 완료 토글 커밋 뒤 센 그날(사용자 현지 날짜) 할 일 현황 */
export interface TodayCompletionStats {
  readonly date: Temporal.PlainDate;
  readonly total: number;
  readonly completed: number;
}

/**
 * 스트릭 갱신 포트 (user-settings 컨텍스트 경계)
 *
 * 완료/미완료 토글 시 스트릭을 갱신합니다. 실패 처리(로깅)는 호출자
 * (이벤트 핸들러)가 소유합니다.
 */
export abstract class StreakPort {
  /** 완료/미완료 전이를 스트릭에 기록합니다. todayStats가 없으면 스트릭 쪽이 그날 현황을 직접 센다 */
  abstract recordTodoToggle(
    userId: UserId,
    completed: boolean,
    timezone: string,
    todayStats: TodayCompletionStats | null,
  ): Promise<void>;

  /**
   * 스트릭 판정 컨텍스트를 조회합니다 (기록 없으면 0/null).
   * effective streak 계산(도메인 정책)은 호출자가 오늘 통계와 함께 수행한다.
   */
  abstract getStreakContext(userId: UserId): Promise<{
    currentStreak: number;
    lastCompletedDate: Temporal.PlainDate | null;
  }>;
}
