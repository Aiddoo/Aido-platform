import type { TodoSeries } from "../../../domain/aggregates/series/todo-series.aggregate.js";
import type { SeriesOwnerActivity } from "../../../domain/policies/series/series-dormancy.policy.js";

export const TODO_SERIES_REPOSITORY = Symbol("TODO_SERIES_REPOSITORY");

export interface DueTodoSeriesQuery {
  /** nextOccurrenceDate가 이 날짜 이하인 규칙 */
  readonly through: string;
  /** id 순 커서. 지난 배치의 마지막 id */
  readonly afterId: string | null;
  readonly limit: number;
}

/** 규칙 행을 잡기 전에 사용자 잠금을 잡을 수 있게 소유자를 함께 읽는다. */
export interface TodoSeriesRef {
  readonly id: string;
  readonly userId: string;
}

export interface DueTodoSeries extends TodoSeriesRef {
  readonly owner: SeriesOwnerActivity;
}

export interface TodoSeriesRepositoryPort {
  findByIdAndUserId(id: string, userId: string): Promise<TodoSeries | null>;

  /** 규칙 행을 잠그고 최신 상태를 읽는다. 다른 트랜잭션이 잡고 있으면 건너뛰어 null이다. */
  lockForUpdate(id: string, options?: { readonly skipLocked: boolean }): Promise<TodoSeries | null>;

  insert(series: TodoSeries): Promise<void>;

  update(series: TodoSeries): Promise<void>;

  delete(id: string): Promise<void>;

  countActiveByUserId(userId: string): Promise<number>;

  findDueBatch(query: DueTodoSeriesQuery): Promise<readonly DueTodoSeries[]>;

  /** 커서가 through 이하인 이 사용자의 규칙. 정지·탈퇴 대기 계정은 비어 있다. */
  findIdsBehind(userId: string, through: string): Promise<readonly string[]>;
}
