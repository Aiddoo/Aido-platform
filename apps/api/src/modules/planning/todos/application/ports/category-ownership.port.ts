import type { TodoCategoryId } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class CategoryOwnershipPort {
  // 주인이 아니거나 없으면 TODO_CATEGORY_0851로 거부한다
  abstract validateOwnership(categoryId: TodoCategoryId, userId: UserId): Promise<void>;

  abstract listOwnedCategoryIds(
    userId: UserId,
    categoryIds: readonly TodoCategoryId[],
  ): Promise<ReadonlySet<number>>;
}
