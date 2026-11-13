import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoSeriesId } from "../../domain/todo-series-id.vo.js";
import type { TodoSeries } from "../../domain/todo-series.aggregate.js";

export interface DueTodoSeriesQuery {
  /** nextOccurrenceDate가 이 날짜 이하인 규칙 */
  readonly through: string;
  /** id 순 커서. 지난 배치의 마지막 id */
  readonly afterId: TodoSeriesId | null;
  readonly limit: number;
}

/** 규칙 행을 잡기 전에 사용자 잠금을 잡을 수 있게 소유자를 함께 읽는다. */
export interface TodoSeriesRef {
  readonly id: string;
  readonly userId: string;
}

export abstract class TodoSeriesRepositoryPort {
  abstract findByIdAndUserId(id: TodoSeriesId, userId: UserId): Promise<TodoSeries | null>;

  /** 규칙 행을 잠그고 최신 상태를 읽는다. 다른 트랜잭션이 잡고 있으면 건너뛰어 null이다. */
  abstract lockForUpdate(
    id: TodoSeriesId,
    options?: { readonly skipLocked: boolean },
  ): Promise<TodoSeries | null>;

  abstract insert(series: TodoSeries): Promise<void>;

  abstract update(series: TodoSeries): Promise<void>;

  /** 분할로 이어진 규칙을 모두 잠그고 id를 돌려준다. 원본 id가 같은 규칙이 한 묶음이다. */
  abstract lockFamilyIds(
    userId: UserId,
    originSeriesId: TodoSeriesId,
  ): Promise<readonly TodoSeriesId[]>;

  /** 같은 원본에서 이 구간 뒤로 나뉜 구간을 잠그고 읽는다. "이후 모두"가 닿는 범위다. */
  abstract lockFollowingSegments(series: TodoSeries): Promise<readonly TodoSeries[]>;

  abstract deleteMany(ids: readonly TodoSeriesId[]): Promise<void>;

  abstract countActiveByUserId(userId: UserId): Promise<number>;

  /** 다음 회차가 남은 규칙이 있는지. 휴면으로 건너뛴 규칙도 커서가 남아 있어 진행 중이다. */
  abstract existsActiveByUserId(userId: UserId): Promise<boolean>;

  /**
   * 이 사용자의 규칙 시간대를 한 문장으로 바꾸고 바뀐 수를 돌려준다. 끝난 규칙도 바꾼다.
   * 규칙을 바꿔 다시 진행하면 그 시간대로 회차를 만들기 때문이다.
   */
  abstract updateTimezoneByUserId(userId: UserId, timezone: string): Promise<number>;

  abstract findDueBatch(query: DueTodoSeriesQuery): Promise<readonly TodoSeriesRef[]>;

  /** 커서가 through 이하인 이 사용자의 규칙. */
  abstract findIdsBehind(userId: UserId, through: string): Promise<readonly string[]>;
}
