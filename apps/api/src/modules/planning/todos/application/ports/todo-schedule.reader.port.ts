import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TimedTodoReadModel } from "../read-models/timed-todo.read-model.js";

export interface TimedTodoQuery {
  readonly userIds: readonly UserId[];
  /** `timezone`의 오늘 */
  readonly date: Temporal.PlainDate;
  /** 할 일을 저장한 기기 시간대. 여러 날 할 일의 벽시계를 순간으로 바꾼다 */
  readonly timezone: string;
  readonly from: Temporal.Instant;
  readonly until: Temporal.Instant;
}

/** 다른 Context(날씨 브리핑·날씨 알림)가 할 일 테이블을 직접 읽지 않고 그날의 시각 있는 할 일을 받는 조회 포트 */
export abstract class TodoScheduleReaderPort {
  /**
   * 종일이 아니고 끝내지 않은 할 일 가운데 그날 시각이 `from` 이상 `until` 미만인 것이다. 그날 시작한 할 일은
   * 저장된 시각을, 전날 이전에 시작해 그날까지 이어지는 여러 날 할 일은 그날의 같은 벽시계 시각을 쓴다.
   * 시각이 이른 순, 같으면 id 순이다.
   */
  abstract listPendingTimedTodos(query: TimedTodoQuery): Promise<TimedTodoReadModel[]>;
}
