import type { TodoId } from "../../../shared/domain/todo-id.vo.js";

export abstract class TodoViewCacheInvalidatorPort {
  abstract invalidateForTodo(todoId: TodoId): Promise<void>;
}
