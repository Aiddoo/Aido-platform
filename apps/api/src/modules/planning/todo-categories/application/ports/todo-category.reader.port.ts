import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import type { TodoCategoryWithCountReadModel } from "../read-models/todo-category-with-count.read-model.js";

export abstract class TodoCategoryReaderPort {
  abstract listForUser(userId: UserId): Promise<TodoCategoryWithCountReadModel[]>;
  abstract validateOwnership(categoryId: TodoCategoryId, userId: UserId): Promise<void>;
}
