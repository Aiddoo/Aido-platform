import { TODO_CATEGORY_EVENTS } from "./todo-category-event-names.constants.js";

export class TodoCategoryDeletedEvent {
  readonly eventName = TODO_CATEGORY_EVENTS.DELETED;

  readonly userId: string;
  readonly categoryId: number;

  constructor(userId: string, categoryId: number) {
    this.userId = userId;
    this.categoryId = categoryId;
  }
}
