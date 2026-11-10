import { Inject, Injectable } from "@nestjs/common";

import {
  TODO_VIEW_CACHE_INVALIDATOR,
  type TodoViewCacheInvalidatorPort,
} from "#api/modules/planning/todos/planning-todos.public";

import type { TodoViewCachePort } from "../../application/ports/todo-view-cache.port.js";

@Injectable()
export class TodoViewCacheAdapter implements TodoViewCachePort {
  readonly #invalidator: TodoViewCacheInvalidatorPort;

  constructor(
    @Inject(TODO_VIEW_CACHE_INVALIDATOR)
    invalidator: TodoViewCacheInvalidatorPort,
  ) {
    this.#invalidator = invalidator;
  }

  invalidateForTodo(todoId: number): Promise<void> {
    return this.#invalidator.invalidateForTodo(todoId);
  }
}
