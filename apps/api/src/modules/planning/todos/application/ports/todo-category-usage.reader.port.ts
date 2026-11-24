import type { TodoCategoryId } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 카테고리 할 일 한도에 세는 수를 미리 본다. 생성 경로와 같은 기준이라 미리보기와 실제 거절이 어긋나지 않는다
export abstract class TodoCategoryUsageReaderPort {
  abstract countUsages(
    userId: UserId,
    categoryIds: readonly TodoCategoryId[],
  ): Promise<ReadonlyMap<number, number>>;
}
