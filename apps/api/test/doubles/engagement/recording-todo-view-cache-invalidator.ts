import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { TodoViewCacheInvalidatorPort } from "#api/modules/planning/todos/planning-todos.public";

export class RecordingTodoViewCacheInvalidator extends TodoViewCacheInvalidatorPort {
  readonly invalidatedTodoIds: number[] = [];
  /** 이 할 일의 캐시 정리를 이 오류로 실패시킨다 */
  readonly failures = new Map<number, Error>();

  async invalidateForTodo(todoId: TodoId): Promise<void> {
    const failure = this.failures.get(todoId.value);
    if (failure != null) {
      throw failure;
    }
    this.invalidatedTodoIds.push(todoId.value);
  }
}
