import {
  TodoSeries,
  type TodoSeriesPrimitives,
} from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import {
  TODO_FIXTURE_CATEGORY_ID,
  TODO_FIXTURE_NOW,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";

const TODO_SERIES_FIXTURE_ID = "0f9d7c1e-6a4b-4c2d-9e8f-1a2b3c4d5e6f";

export function createTodoSeriesFixture(overrides: Partial<TodoSeriesPrimitives> = {}): TodoSeries {
  const id = overrides.id ?? TODO_SERIES_FIXTURE_ID;
  return TodoSeries.reconstitute({
    id,
    originSeriesId: id,
    userId: TODO_FIXTURE_USER_ID,
    categoryId: TODO_FIXTURE_CATEGORY_ID,
    title: "물 마시기",
    visibility: "PUBLIC",
    scheduledLocalTime: null,
    timezone: "Asia/Seoul",
    rule: {
      frequency: "DAILY",
      interval: 1,
      weekdays: null,
      monthDay: null,
      end: { type: "NEVER" },
    },
    startDate: "2026-11-10",
    checklistTemplate: [],
    nextOccurrenceDate: "2026-11-10",
    generatedCount: 0,
    createdAt: TODO_FIXTURE_NOW,
    updatedAt: TODO_FIXTURE_NOW,
    ...overrides,
  });
}
