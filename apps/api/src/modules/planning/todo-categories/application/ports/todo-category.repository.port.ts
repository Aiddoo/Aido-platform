import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ReorderPlan } from "../../domain/category-ordering.domain-service.js";
import type { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import type { TodoCategory } from "../../domain/todo-category.aggregate.js";
import type { TodoCategoryWithCountReadModel } from "../read-models/todo-category-with-count.read-model.js";

export interface CategoryTodoCount {
  /** 완료 포함. 목록의 todoCount와 같은 기준이다 */
  readonly total: number;
  readonly completed: number;
}

// 같은 사용자 안 이름이 겹치면 TODO_CATEGORY_0853이다(저장소가 유니크 위반을 번역한다).
// 카테고리를 바꾸는 UseCase는 모두 사용자 카테고리 잠금 아래에서 읽고 save해 순서 밀기와 겹쳐도 덮어쓰지 않는다
export abstract class TodoCategoryRepositoryPort {
  abstract nextId(): Promise<TodoCategoryId>;
  abstract insert(category: TodoCategory): Promise<void>;
  // 있는 행의 이름·색·순서·수정 시각을 쓴다
  abstract save(category: TodoCategory): Promise<void>;
  abstract delete(id: TodoCategoryId): Promise<void>;

  abstract findByIdAndUserId(id: TodoCategoryId, userId: UserId): Promise<TodoCategory | null>;
  abstract findByIdWithCount(id: TodoCategoryId): Promise<TodoCategoryWithCountReadModel | null>;
  abstract listByUserId(userId: UserId): Promise<TodoCategoryWithCountReadModel[]>;

  abstract countByUserId(userId: UserId): Promise<number>;
  abstract existsByUserIdAndName(
    userId: UserId,
    name: string,
    excludeId?: TodoCategoryId,
  ): Promise<boolean>;
  abstract getMaxSortOrder(userId: UserId): Promise<number>;
  // 사이 카테고리를 한 칸씩 미는 묶음 문장이다
  abstract shiftSortOrders(userId: UserId, shift: ReorderPlan["shift"]): Promise<number>;

  abstract countTodos(userId: UserId, categoryId: TodoCategoryId): Promise<CategoryTodoCount>;
  abstract countActiveSeries(categoryId: TodoCategoryId): Promise<number>;
  /** 할 일과 반복 규칙(끝난 규칙 포함)을 한 문장씩 옮기고 updatedAt을 지금으로 바꾼다. 앱 동기화가 이 값을 본다 */
  abstract moveTodosToCategory(
    userId: UserId,
    fromCategoryId: TodoCategoryId,
    toCategoryId: TodoCategoryId,
  ): Promise<void>;
}
