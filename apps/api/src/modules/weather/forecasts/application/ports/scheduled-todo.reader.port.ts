import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ScheduledTodo } from "../read-models/scheduled-todo.read-model.js";

/** 날씨 브리핑이 필요로 하는 사용자의 할 일만 읽는 포트. 할 일 쓰기와 규칙은 planning이 소유한다. */
export abstract class ScheduledTodoReaderPort {
  /** 아직 끝내지 않았고 시각이 정해진 할 일. `from` 이상 `until` 미만이며 시각이 이른 순이다. */
  abstract listPendingTimedTodos(params: {
    readonly userId: UserId;
    readonly from: Temporal.Instant;
    readonly until: Temporal.Instant;
  }): Promise<ScheduledTodo[]>;
}
