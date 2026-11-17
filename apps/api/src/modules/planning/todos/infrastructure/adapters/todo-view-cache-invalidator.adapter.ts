import { Injectable } from "@nestjs/common";

import { TodoViewCacheInvalidatorPort } from "../../application/ports/todo-view-cache-invalidator.port.js";
import { InvalidateTodoViewCacheUseCase } from "../../application/use-cases/invalidate-todo-view-cache.use-case.js";
import type { TodoId } from "../../domain/todo-id.vo.js";

@Injectable()
export class TodoViewCacheInvalidatorAdapter implements TodoViewCacheInvalidatorPort {
  readonly #invalidateTodoViewCache: InvalidateTodoViewCacheUseCase;

  constructor(invalidateTodoViewCache: InvalidateTodoViewCacheUseCase) {
    this.#invalidateTodoViewCache = invalidateTodoViewCache;
  }

  invalidateForTodo(todoId: TodoId): Promise<void> {
    return this.#invalidateTodoViewCache.execute([todoId]);
  }

  invalidateForTodos(todoIds: readonly TodoId[]): Promise<void> {
    return this.#invalidateTodoViewCache.execute(todoIds);
  }
}
