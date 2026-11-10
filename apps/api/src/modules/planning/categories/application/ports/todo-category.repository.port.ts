import type { TodoCategory } from "../../domain/todo-category.aggregate.js";

/** 카테고리 + 할 일 개수 읽기 프로젝션 */
export interface TodoCategoryWithCountView {
  id: number;
  userId: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  todoCount: number;
}

/** 카테고리 생성 입력 */
export interface CreateCategoryInput {
  userId: string;
  name: string;
  color: string;
  sortOrder: number;
}

/** 카테고리 갱신 입력 (이름/색상/정렬 부분 갱신) */
export interface UpdateCategoryInput {
  name?: string;
  color?: string;
  sortOrder?: number;
}

export abstract class TodoCategoryRepositoryPort {
  abstract create(input: CreateCategoryInput): Promise<TodoCategory>;
  abstract update(id: number, input: UpdateCategoryInput): Promise<TodoCategory>;
  abstract delete(id: number): Promise<void>;

  abstract findByIdAndUserId(id: number, userId: string): Promise<TodoCategory | null>;
  abstract findByIdWithCount(id: number): Promise<TodoCategoryWithCountView | null>;
  abstract findManyByUserId(userId: string): Promise<TodoCategoryWithCountView[]>;

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
