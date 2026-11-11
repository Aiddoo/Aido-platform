import { TodoCategoryCachePort } from "#api/modules/planning/categories/application/ports/todo-category-cache.port";
import type { TodoCategoryWithCountReadModel } from "#api/modules/planning/categories/application/read-models/todo-category-with-count.read-model";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 목록은 늘 새로 읽고, 무효화한 사용자만 남긴다
export class FakeTodoCategoryCache extends TodoCategoryCachePort {
  readonly invalidatedUserIds: string[] = [];

  async wrapList(
    _userId: UserId,
    factory: () => Promise<TodoCategoryWithCountReadModel[]>,
  ): Promise<TodoCategoryWithCountReadModel[]> {
    return factory();
  }

  async invalidate(userId: UserId): Promise<void> {
    this.invalidatedUserIds.push(userId.value);
  }
}
