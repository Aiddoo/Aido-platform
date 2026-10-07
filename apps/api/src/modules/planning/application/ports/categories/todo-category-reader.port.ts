import type { TodoCategoryWithCountView } from "./todo-category.repository.port.js";

export const TODO_CATEGORY_READER = Symbol("TODO_CATEGORY_READER");

export interface TodoCategoryReaderPort {
  listForUser(userId: string): Promise<TodoCategoryWithCountView[]>;
  validateOwnership(categoryId: number, userId: string): Promise<void>;
}
