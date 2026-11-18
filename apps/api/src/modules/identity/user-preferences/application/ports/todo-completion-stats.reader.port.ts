import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 특정 날짜의 투두 완료 현황 */
export interface TodoCompletionStats {
  total: number;
  completed: number;
}

/** 할 일 Context가 완료 토글 커밋 뒤 이미 센 그날 현황. 스트릭이 같은 집계를 다시 하지 않게 넘긴다 */
export interface DatedTodoCompletionStats extends TodoCompletionStats {
  readonly date: Temporal.PlainDate;
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
