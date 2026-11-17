import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import type { TodoCategory } from "../../domain/todo-category.aggregate.js";
import type { TodoCategoryWithCountReadModel } from "../read-models/todo-category-with-count.read-model.js";

export interface CategoryTodoCount {
  /** 완료 포함. 목록의 todoCount와 같은 기준이다 */
  readonly total: number;
  readonly completed: number;
}

/** 카테고리 부분 갱신. undefined는 바꾸지 않는다. */
export interface UpdateCategoryInput {
  readonly name?: string;
  readonly color?: string;
  readonly sortOrder?: number;
}

/**
 * 같은 사용자 안 이름이 겹치면 TODO_CATEGORY_0853이다(저장소가 유니크 위반을 번역한다).
 * 수정은 고친 칸만 쓰고 저장된 행을 돌려준다. 다른 카테고리 순서 밀기와 겹쳐도 덮어쓰지 않게 하려는 것이다.
 */
export abstract class TodoCategoryRepositoryPort {
  abstract nextId(): Promise<TodoCategoryId>;
  abstract insert(category: TodoCategory): Promise<void>;
  abstract update(id: TodoCategoryId, input: UpdateCategoryInput): Promise<TodoCategory>;
  abstract delete(id: TodoCategoryId): Promise<void>;

  abstract findByIdAndUserId(id: TodoCategoryId, userId: UserId): Promise<TodoCategory | null>;
  abstract findByIdWithCount(id: TodoCategoryId): Promise<TodoCategoryWithCountReadModel | null>;
  abstract findManyByUserId(userId: UserId): Promise<TodoCategoryWithCountReadModel[]>;

  abstract countByUserId(userId: UserId): Promise<number>;
  abstract existsByUserIdAndName(
    userId: UserId,
    name: string,
    excludeId?: TodoCategoryId,
  ): Promise<boolean>;
  abstract getMaxSortOrder(userId: UserId): Promise<number>;
  abstract shiftSortOrders(
    userId: UserId,
    fromSortOrder: number,
    toSortOrder: number | null,
    delta: number,
  ): Promise<number>;

  abstract countTodos(userId: UserId, categoryId: TodoCategoryId): Promise<CategoryTodoCount>;
  abstract countActiveSeries(categoryId: TodoCategoryId): Promise<number>;
  /** 할 일과 반복 규칙(끝난 규칙 포함)을 한 문장씩 옮기고 updatedAt을 지금으로 바꾼다. 앱 동기화가 이 값을 본다 */
  abstract moveTodosToCategory(
    userId: UserId,
    fromCategoryId: TodoCategoryId,
    toCategoryId: TodoCategoryId,
  ): Promise<void>;
}
