import type { TodoSeries } from "../../../domain/aggregates/series/todo-series.aggregate.js";

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

export interface TodoSeriesRepositoryPort {
  findByIdAndUserId(id: string, userId: string): Promise<TodoSeries | null>;

  /** 규칙 행을 잠그고 최신 상태를 읽는다. 다른 트랜잭션이 잡고 있으면 건너뛰어 null이다. */
  lockForUpdate(id: string, options?: { readonly skipLocked: boolean }): Promise<TodoSeries | null>;

  insert(series: TodoSeries): Promise<void>;

  update(series: TodoSeries): Promise<void>;

  /** 분할로 이어진 규칙을 모두 잠그고 id를 돌려준다. 원본 id가 같은 규칙이 한 묶음이다. */
  lockFamilyIds(userId: string, originSeriesId: string): Promise<readonly string[]>;

  /** 같은 원본에서 이 구간 뒤로 나뉜 구간을 잠그고 읽는다. "이후 모두"가 닿는 범위다. */
  lockFollowingSegments(series: TodoSeries): Promise<readonly TodoSeries[]>;

  deleteMany(ids: readonly string[]): Promise<void>;

  countActiveByUserId(userId: string): Promise<number>;

  findDueBatch(query: DueTodoSeriesQuery): Promise<readonly TodoSeriesRef[]>;

  /** 커서가 through 이하인 이 사용자의 규칙. */
  findIdsBehind(userId: string, through: string): Promise<readonly string[]>;
}
