import { TodoCachePort } from "#api/modules/planning/todos/application/ports/todo-cache.port";
import type { FriendTodoReadModel } from "#api/modules/planning/todos/application/read-models/todo.read-model";
import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";

export class FakeTodoCache extends TodoCachePort {
  readonly categoryUsers = new Set<string>();
  readonly pages = new Map<string, CursorPaginatedResponse<FriendTodoReadModel, number>>();
  readonly generations = new Map<string, number>();
  async invalidateTodoCategories(userId: string): Promise<void> {
    this.categoryUsers.delete(userId);
  }
  async readFriendTodosFirstPage(userId: string, start: string, end: string, size: number) {
    const page = this.pages.get(this.#key(userId, start, end, size));
    return {
      generation: String(this.generations.get(userId) ?? 0),
      page: page === undefined ? undefined : structuredClone(page),
    };
  }
  async storeFriendTodosFirstPageIfCurrent(
    userId: string,
    start: string,
    end: string,
    size: number,
    generation: string,
    page: CursorPaginatedResponse<FriendTodoReadModel, number>,
  ): Promise<void> {
    if (generation === String(this.generations.get(userId) ?? 0)) {
      this.pages.set(this.#key(userId, start, end, size), structuredClone(page));
    }
  }
  async invalidateFriendTodos(userId: string): Promise<void> {
    this.generations.set(userId, (this.generations.get(userId) ?? 0) + 1);
    for (const key of this.pages.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.pages.delete(key);
      }
    }
  }
  #key(userId: string, start: string, end: string, size: number): string {
    return `${userId}:${start}:${end}:${size}`;
  }
}
