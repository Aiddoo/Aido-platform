import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";

import type { SnoozeTodoReadModel } from "../read-models/scheduler.read-model.js";

/** 다시 알림을 걸 할 일을 읽는 포트. 할 일 규칙은 planning이 소유한다 */
export abstract class SnoozeTodoReaderPort {
  /** 지워졌거나 없는 할 일은 null이다 */
  abstract findTodo(todoId: TodoId): Promise<SnoozeTodoReadModel | null>;
}
