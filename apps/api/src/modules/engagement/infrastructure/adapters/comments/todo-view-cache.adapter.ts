import { Inject, Injectable } from "@nestjs/common";

import {
  TODO_VIEW_CACHE_INVALIDATOR,
  type TodoViewCacheInvalidatorPort,
} from "#api/modules/planning/planning-todos.public";

import type { TodoViewCachePort } from "../../../application/ports/comments/todo-view-cache.port.js";

@Injectable()
export class TodoViewCacheAdapter implements TodoViewCachePort {
  constructor(
    @Inject(TODO_VIEW_CACHE_INVALIDATOR)
    private readonly invalidator: TodoViewCacheInvalidatorPort,
  ) {}

  invalidateForTodo(todoId: number): Promise<void> {
    return this.invalidator.invalidateForTodo(todoId);
  }
}
