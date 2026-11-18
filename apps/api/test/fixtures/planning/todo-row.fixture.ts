import { nextFixtureSequence } from "#test/fixtures/platform/fixture-sequence";
import type { Todo, TodoCategory } from "#test/types/database-rows";

export function createTodoCategoryRowFixture(overrides: Partial<TodoCategory> = {}): TodoCategory {
  const sequence = nextFixtureSequence("todo-category");
  const now = Temporal.Instant.fromEpochMilliseconds(Date.now());
  return {
    id: overrides.id ?? sequence,
    userId: overrides.userId ?? `user-${sequence}`,
    name: overrides.name ?? `Category ${sequence}`,
    color: overrides.color ?? "#3B82F6",
    sortOrder: overrides.sortOrder ?? sequence,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export function createTodoRowFixture(overrides: Partial<Todo> = {}): Todo {
  const sequence = nextFixtureSequence("todo");
  const now = Temporal.Instant.fromEpochMilliseconds(Date.now());
  return {
    id: overrides.id ?? sequence,
    userId: overrides.userId ?? `user-${sequence}`,
    categoryId: overrides.categoryId ?? sequence,
    title: overrides.title ?? `Test Todo ${sequence}`,
    completed: overrides.completed ?? false,
    completedAt: overrides.completedAt ?? null,
    startDate: overrides.startDate ?? now.toZonedDateTimeISO("UTC").toPlainDate(),
    endDate: overrides.endDate ?? null,
    scheduledLocalTime: overrides.scheduledLocalTime ?? null,
    scheduledTime: overrides.scheduledTime ?? null,
    isAllDay: overrides.isAllDay ?? true,
    sortOrder: overrides.sortOrder ?? sequence,
    visibility: overrides.visibility ?? "PRIVATE",
    seriesId: overrides.seriesId ?? null,
    occurrenceDate: overrides.occurrenceDate ?? null,
    viewCount: overrides.viewCount ?? 0,
    commentCount: overrides.commentCount ?? 0,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}
