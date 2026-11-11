import type { TodoReadModel } from "#api/modules/planning/todos/planning-todos.public";
import {
  TODO_FIXTURE_CATEGORY_ID,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";

export function createTodoReadModelFixture(overrides: Partial<TodoReadModel> = {}): TodoReadModel {
  return {
    id: 1,
    userId: TODO_FIXTURE_USER_ID,
    title: "장보기",
    sortOrder: 0,
    completed: false,
    completedAt: null,
    startDate: "2026-11-10",
    endDate: null,
    scheduledTime: null,
    scheduledLocalTime: null,
    isAllDay: true,
    visibility: "PUBLIC",
    seriesId: null,
    category: {
      id: TODO_FIXTURE_CATEGORY_ID,
      name: "기본 카테고리",
      color: "#FFB3B3",
      sortOrder: 0,
    },
    items: [],
    commentCount: 0,
    createdAt: "2026-11-10T00:00:00.000Z",
    updatedAt: "2026-11-10T00:00:00.000Z",
    repeat: null,
    occurrenceDate: null,
    ...overrides,
  };
}
