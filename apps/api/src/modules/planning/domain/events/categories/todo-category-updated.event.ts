import { TODO_CATEGORY_EVENTS } from "./todo-category-event-names.js";

export class TodoCategoryUpdatedEvent {
  readonly eventName = TODO_CATEGORY_EVENTS.UPDATED;

  constructor(
    public readonly userId: string,
    public readonly categoryId: number,
  ) {}
}
