import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 특정 날짜의 투두 완료 현황 */
export interface TodoCompletionStats {
  total: number;
  completed: number;
}

/**
 * 투두 완료 통계 리더 포트.
 *
 * 스트릭 갱신 시 특정 날짜의 투두 총계/완료 수를 조회한다.
 * (todo 모듈 순환을 피하기 위해 어댑터가 직접 집계 쿼리로 위임)
 */
export abstract class TodoCompletionStatsReaderPort {
  /** day에 걸친 할 일의 total/completed. 여러 날 할 일은 기간의 모든 날에 센다 */
  abstract countForDay(userId: UserId, day: Temporal.PlainDate): Promise<TodoCompletionStats>;
}
