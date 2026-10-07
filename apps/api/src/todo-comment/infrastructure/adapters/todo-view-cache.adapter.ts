import { Injectable } from "@nestjs/common";

import { TodoViewCacheInvalidator } from "#api/todo/index";

import type { TodoViewCachePort } from "../../application/ports/todo-view-cache.port.js";

@Injectable()
export class TodoViewCacheAdapter implements TodoViewCachePort {
  constructor(private readonly invalidator: TodoViewCacheInvalidator) {}

  invalidateForTodo(todoId: number): Promise<void> {
    return this.invalidator.invalidateForTodo(todoId);
  }
}
