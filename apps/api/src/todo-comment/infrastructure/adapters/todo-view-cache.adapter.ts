import { Injectable } from "@nestjs/common";

import { TodoViewCacheInvalidator } from "@/todo";

import type { TodoViewCachePort } from "../../application/ports/todo-view-cache.port";

@Injectable()
export class TodoViewCacheAdapter implements TodoViewCachePort {
	constructor(private readonly invalidator: TodoViewCacheInvalidator) {}

	invalidateForTodo(todoId: number): Promise<void> {
		return this.invalidator.invalidateForTodo(todoId);
	}
}
