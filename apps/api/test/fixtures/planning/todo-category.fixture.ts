import {
  TodoCategory,
  type TodoCategoryPrimitives,
} from "#api/modules/planning/categories/domain/todo-category.aggregate";
import { TODO_FIXTURE_NOW, TODO_FIXTURE_USER_ID } from "#test/fixtures/planning/todo.fixture";

export function createTodoCategoryFixture(
  overrides: Partial<TodoCategoryPrimitives> = {},
): TodoCategory {
  return TodoCategory.reconstitute({
    id: 1,
    userId: TODO_FIXTURE_USER_ID,
    name: "업무",
    color: "#FFB3B3",
    sortOrder: 0,
    createdAt: TODO_FIXTURE_NOW,
    updatedAt: TODO_FIXTURE_NOW,
    ...overrides,
  });
}
