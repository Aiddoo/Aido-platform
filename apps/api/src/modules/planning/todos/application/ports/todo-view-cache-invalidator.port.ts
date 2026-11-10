export abstract class TodoViewCacheInvalidatorPort {
  abstract invalidateForTodo(todoId: number): Promise<void>;
}
