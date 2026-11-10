// 옛 Symbol 토큰. 소비 Context가 클래스 토큰으로 옮길 때까지 같은 인스턴스 별칭으로 남긴다
export const TODO_VIEW_CACHE_INVALIDATOR = Symbol("TODO_VIEW_CACHE_INVALIDATOR");

export abstract class TodoViewCacheInvalidatorPort {
  abstract invalidateForTodo(todoId: number): Promise<void>;
}
