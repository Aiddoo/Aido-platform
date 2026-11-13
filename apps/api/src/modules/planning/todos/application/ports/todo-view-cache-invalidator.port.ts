import type { TodoId } from "../../../shared/domain/todo-id.vo.js";

export abstract class TodoViewCacheInvalidatorPort {
  abstract invalidateForTodo(todoId: TodoId): Promise<void>;
  /** 소유자를 한 번에 찾아 소유자마다 한 번 버린다. 한 소유자가 실패해도 나머지를 버리고 첫 실패를 던진다 */
  abstract invalidateForTodos(todoIds: readonly TodoId[]): Promise<void>;
}
