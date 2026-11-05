import type {
  MultiDayTodoSpan,
  TodoAggregateByDate,
} from "../../../domain/records/daily-completions/daily-completion.record.js";

/** TodoCompletionRepositoryPort DI 토큰 */
export const TODO_COMPLETION_REPOSITORY = Symbol("TODO_COMPLETION_REPOSITORY");

/** 날짜 범위 집계 조회 파라미터 (반열림 구간 [startDate, endDate)) */
export interface AggregateByDateRangeParams {
  readonly userId: string;
  readonly startDate: Date;
  readonly endDate: Date;
}

/**
 * 일일 완료 집계 조회 포트 (읽기 전용).
 *
 * 날짜별 Todo 집계(전체/완료/카테고리 색상)를 반환한다. 집계 방식(
 * groupBy 등)은 인프라 어댑터가 담당한다.
 */
export interface TodoCompletionRepositoryPort {
  aggregateByDateRange(params: AggregateByDateRangeParams): Promise<TodoAggregateByDate[]>;

  /** 친구에게 보이는 PUBLIC 투두만 집계한다 (파라미터·반환 형태는 동일). */
  aggregatePublicByDateRange(params: AggregateByDateRangeParams): Promise<TodoAggregateByDate[]>;

  /** 기간과 겹치는 여러 날 할 일. 집계는 시작일에만 세므로 달력이 기간 안의 날을 알 수 있게 따로 준다. */
  findMultiDayTodos(params: AggregateByDateRangeParams): Promise<MultiDayTodoSpan[]>;

  /** 친구에게 보이는 PUBLIC 여러 날 할 일만 찾는다 (파라미터·반환 형태는 동일). */
  findPublicMultiDayTodos(params: AggregateByDateRangeParams): Promise<MultiDayTodoSpan[]>;
}
