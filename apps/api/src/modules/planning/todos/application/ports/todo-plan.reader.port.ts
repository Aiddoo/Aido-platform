import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoId } from "../../domain/todo-id.vo.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import type { UpcomingTodoReadModel } from "../read-models/upcoming-todo.read-model.js";

/** 다른 Context가 계획을 세우고 적용 결과를 다시 돌려줄 때 읽는 할 일 */
export abstract class TodoPlanReaderPort {
  abstract listUpcoming(
    userId: UserId,
    input: { readonly fromDate: Temporal.PlainDate; readonly limit: number },
  ): Promise<UpcomingTodoReadModel[]>;
  abstract listByIds(userId: UserId, ids: readonly TodoId[]): Promise<TodoReadModel[]>;
}
