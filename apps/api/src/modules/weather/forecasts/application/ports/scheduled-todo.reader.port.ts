import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ScheduledTodo } from "../read-models/scheduled-todo.read-model.js";

/** 날씨 브리핑이 필요로 하는 사용자의 할 일만 읽는 포트. 할 일 쓰기와 규칙은 planning이 소유한다. */
export abstract class ScheduledTodoReaderPort {
  /**
   * 아직 끝내지 않았고 시각이 정해진 `date`의 할 일. 시각이 `from` 이상 `until` 미만이며 이른 순이다.
   * 전날부터 이어지는 여러 날 할 일은 `timezone`의 그날 벽시계 시각으로 본다.
   */
  abstract listPendingTimedTodos(params: {
    readonly userId: UserId;
    readonly date: Temporal.PlainDate;
    readonly timezone: string;
    readonly from: Temporal.Instant;
    readonly until: Temporal.Instant;
  }): Promise<ScheduledTodo[]>;
}
