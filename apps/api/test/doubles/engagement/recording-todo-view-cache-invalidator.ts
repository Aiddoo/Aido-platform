import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { TodoViewCacheInvalidatorPort } from "#api/modules/planning/todos/planning-todos.public";

export class RecordingTodoViewCacheInvalidator extends TodoViewCacheInvalidatorPort {
  readonly invalidatedTodoIds: number[] = [];
  /** 이 할 일의 캐시 정리를 이 오류로 실패시킨다 */
  readonly failures = new Map<number, Error>();
  batchCalls = 0;

  async invalidateForTodo(todoId: TodoId): Promise<void> {
    const failure = this.failures.get(todoId.value);
    if (failure != null) {
      throw failure;
    }
    this.invalidatedTodoIds.push(todoId.value);
  }

  async invalidateForTodos(todoIds: readonly TodoId[]): Promise<void> {
    this.batchCalls += 1;
    const settled = await Promise.allSettled(
      todoIds.map((todoId) => this.invalidateForTodo(todoId)),
    );
    const failure = settled.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failure != null) {
      throw failure.reason;
    }
  }
}
