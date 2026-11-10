import type { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import type { TodoCategory } from "../../domain/todo-category.aggregate.js";
import type { TodoCategoryWithCountReadModel } from "../read-models/todo-category-with-count.read-model.js";

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
  abstract update(id: number, input: UpdateCategoryInput): Promise<TodoCategory>;
  abstract delete(id: number): Promise<void>;

  abstract findByIdAndUserId(id: number, userId: string): Promise<TodoCategory | null>;
  abstract findByIdWithCount(id: number): Promise<TodoCategoryWithCountReadModel | null>;
  abstract findManyByUserId(userId: string): Promise<TodoCategoryWithCountReadModel[]>;

  abstract countByUserId(userId: string): Promise<number>;
  abstract existsByUserIdAndName(
    userId: string,
    name: string,
    excludeId?: number,
  ): Promise<boolean>;
  abstract getMaxSortOrder(userId: string): Promise<number>;
  abstract shiftSortOrders(
    userId: string,
    fromSortOrder: number,
    toSortOrder: number | null,
    delta: number,
  ): Promise<number>;

  abstract getTodoCount(categoryId: number): Promise<number>;
  abstract countActiveSeries(categoryId: number): Promise<number>;
  abstract moveTodosToCategory(fromCategoryId: number, toCategoryId: number): Promise<void>;
}
