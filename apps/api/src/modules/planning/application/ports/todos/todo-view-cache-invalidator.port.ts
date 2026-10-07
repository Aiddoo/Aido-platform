export const TODO_VIEW_CACHE_INVALIDATOR = Symbol("TODO_VIEW_CACHE_INVALIDATOR");

export interface TodoViewCacheInvalidatorPort {
  invalidateForTodo(todoId: number): Promise<void>;
}
