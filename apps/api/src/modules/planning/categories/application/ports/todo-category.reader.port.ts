import type { TodoCategoryWithCountReadModel } from "../read-models/todo-category-with-count.read-model.js";

export abstract class TodoCategoryReaderPort {
  abstract listForUser(userId: string): Promise<TodoCategoryWithCountReadModel[]>;
  abstract validateOwnership(categoryId: number, userId: string): Promise<void>;
}
