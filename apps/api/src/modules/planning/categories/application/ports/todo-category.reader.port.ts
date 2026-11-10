import type { TodoCategoryWithCountView } from "./todo-category.repository.port.js";

// 옛 Symbol 토큰. 소비 Context가 클래스 토큰으로 옮길 때까지 같은 인스턴스 별칭으로 남긴다
export const TODO_CATEGORY_READER = Symbol("TODO_CATEGORY_READER");

export abstract class TodoCategoryReaderPort {
  abstract listForUser(userId: string): Promise<TodoCategoryWithCountView[]>;
  abstract validateOwnership(categoryId: number, userId: string): Promise<void>;
}
