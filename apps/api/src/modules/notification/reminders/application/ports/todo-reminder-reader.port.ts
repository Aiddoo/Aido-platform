import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";

import type { ActiveTodo } from "../read-models/scheduler.read-model.js";

// 중복은 알림 행의 유니크 인덱스가 막으므로 여기서는 아직 보낼 할 일인지만 본다
export abstract class TodoReminderReaderPort {
  /** 할 일 id → 아직 보낼 할 일. 완료·삭제된 할 일은 빠진다 */
  abstract findActiveTodos(todoIds: readonly TodoId[]): Promise<ReadonlyMap<number, ActiveTodo>>;
}
