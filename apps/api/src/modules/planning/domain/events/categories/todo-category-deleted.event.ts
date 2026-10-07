import { TODO_CATEGORY_EVENTS } from "./todo-category-event-names.js";

export class TodoCategoryDeletedEvent {
  readonly eventName = TODO_CATEGORY_EVENTS.DELETED;

  constructor(
    public readonly userId: string,
    public readonly categoryId: number,
  ) {}
}
