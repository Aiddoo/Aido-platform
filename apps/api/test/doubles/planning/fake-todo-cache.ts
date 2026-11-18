import {
  type FriendTodosFirstPageKey,
  TodoCachePort,
} from "#api/modules/planning/todos/application/ports/todo-cache.port";
import type { FriendTodoReadModel } from "#api/modules/planning/todos/application/read-models/todo.read-model";
import type { CursorPage } from "#api/shared/application/cursor-page";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export class FakeTodoCache extends TodoCachePort {
  readonly categoryUsers = new Set<string>();
  readonly pages = new Map<string, CursorPage<FriendTodoReadModel, number>>();
  readonly generations = new Map<string, number>();
  async invalidateTodoCategories(userId: UserId): Promise<void> {
    this.categoryUsers.delete(userId.value);
  }
  async readFriendTodosFirstPage(key: FriendTodosFirstPageKey) {
    const page = this.pages.get(this.#key(key));
    return {
      generation: String(this.generations.get(key.ownerUserId.value) ?? 0),
      page: page === undefined ? undefined : structuredClone(page),
    };
  }
  async storeFriendTodosFirstPageIfCurrent(
    key: FriendTodosFirstPageKey,
    generation: string,
    page: CursorPage<FriendTodoReadModel, number>,
  ): Promise<void> {
    if (generation === String(this.generations.get(key.ownerUserId.value) ?? 0)) {
      this.pages.set(this.#key(key), structuredClone(page));
    }
  }
  async invalidateFriendTodos(owner: UserId): Promise<void> {
    const userId = owner.value;
    this.generations.set(userId, (this.generations.get(userId) ?? 0) + 1);
    for (const key of this.pages.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.pages.delete(key);
      }
    }
  }
  #key({ ownerUserId, startDate, endDate, size }: FriendTodosFirstPageKey): string {
    return `${ownerUserId.value}:${startDate}:${endDate}:${size}`;
  }
}
