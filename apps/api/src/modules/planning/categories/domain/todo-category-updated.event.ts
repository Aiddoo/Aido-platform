import { TODO_CATEGORY_EVENTS } from "./todo-category-event-names.constants.js";

export class TodoCategoryUpdatedEvent {
  readonly eventName = TODO_CATEGORY_EVENTS.UPDATED;

  readonly userId: string;
  readonly categoryId: number;

  constructor(userId: string, categoryId: number) {
    this.userId = userId;
    this.categoryId = categoryId;
  }
}
