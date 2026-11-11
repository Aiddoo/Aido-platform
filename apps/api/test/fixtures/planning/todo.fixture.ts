import type { TodoItemPrimitives } from "#api/modules/planning/shared/domain/todo-item.entity";
import { Todo, type TodoPrimitives } from "#api/modules/planning/shared/domain/todo.aggregate";

export const TODO_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");
export const TODO_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";
export const TODO_FIXTURE_OTHER_USER_ID = "clz7x5p8k0002qz0z8z8z8z8z";
export const TODO_FIXTURE_CATEGORY_ID = 1;

export function createTodoItemFixture(
  overrides: Partial<TodoItemPrimitives> = {},
): TodoItemPrimitives {
  return {
    id: 10,
    title: "우유 사기",
    completed: false,
    sortOrder: 0,
    createdAt: TODO_FIXTURE_NOW,
    updatedAt: TODO_FIXTURE_NOW,
    ...overrides,
  };
}

export function createTodoPrimitivesFixture(
  overrides: Partial<TodoPrimitives> = {},
): TodoPrimitives {
  return {
    id: 1,
    userId: TODO_FIXTURE_USER_ID,
    categoryId: TODO_FIXTURE_CATEGORY_ID,
    title: "장보기",
    sortOrder: 0,
    completed: false,
    completedAt: null,
    startDate: Temporal.PlainDate.from("2026-11-10"),
    endDate: null,
    scheduledLocalTime: null,
    scheduledTime: null,
    isAllDay: true,
    visibility: "PUBLIC",
    seriesId: null,
    occurrenceDate: null,
    items: [],
    createdAt: TODO_FIXTURE_NOW,
    updatedAt: TODO_FIXTURE_NOW,
    ...overrides,
  };
}

export function createTodoFixture(overrides: Partial<TodoPrimitives> = {}): Todo {
  return Todo.reconstitute(createTodoPrimitivesFixture(overrides));
}
