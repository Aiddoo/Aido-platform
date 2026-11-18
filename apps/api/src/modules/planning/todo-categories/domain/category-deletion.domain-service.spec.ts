import {
  type CategoryDeletionInput,
  planCategoryDeletion,
} from "./category-deletion.domain-service.js";
import { TodoCategoryId } from "./todo-category-id.vo.js";

const CATEGORY_ID = TodoCategoryId.reconstitute(1);
const OTHER_ID = TodoCategoryId.reconstitute(2);

function deletionOf(overrides: Partial<CategoryDeletionInput> = {}): CategoryDeletionInput {
  return {
    categoryId: CATEGORY_ID,
    categoryCount: 2,
    todoCount: 3,
    activeSeriesCount: 0,
    todoHandling: null,
    moveToCategoryId: null,
    ...overrides,
  };
}

describe("카테고리 삭제 계획", () => {
  it.each([
    {
      name: "마지막 카테고리면 할 일 처리보다 먼저 거절한다",
      input: deletionOf({ categoryCount: 1, todoHandling: "delete" }),
      expected: { ok: false, reason: "last-category" },
    },
    {
      name: "할 일과 진행 중 반복이 없으면 옮길 곳을 보지 않고 바로 지운다",
      input: deletionOf({ todoCount: 0, moveToCategoryId: CATEGORY_ID }),
      expected: { ok: true, plan: "delete-empty" },
    },
    {
      name: "할 일이 없어도 진행 중 반복이 있으면 옮길 곳을 묻는다",
      input: deletionOf({ todoCount: 0, activeSeriesCount: 1 }),
      expected: { ok: false, reason: "move-target-required" },
    },
    {
      name: "출시 앱 요청에 옮길 곳이 없으면 거절한다",
      input: deletionOf(),
      expected: { ok: false, reason: "move-target-required" },
    },
    {
      name: "출시 앱 요청에 옮길 곳이 있으면 옮긴다",
      input: deletionOf({ moveToCategoryId: OTHER_ID }),
      expected: { ok: true, plan: "move", moveToCategoryId: OTHER_ID },
    },
    {
      name: "move인데 옮길 곳이 없으면 거절한다",
      input: deletionOf({ todoHandling: "move" }),
      expected: { ok: false, reason: "move-target-required" },
    },
    {
      name: "옮길 곳이 지우는 카테고리와 같으면 거절한다",
      input: deletionOf({
        todoHandling: "move",
        moveToCategoryId: TodoCategoryId.reconstitute(1),
      }),
      expected: { ok: false, reason: "same-target" },
    },
    {
      name: "move와 다른 옮길 곳이면 옮긴다",
      input: deletionOf({ todoHandling: "move", moveToCategoryId: OTHER_ID }),
      expected: { ok: true, plan: "move", moveToCategoryId: OTHER_ID },
    },
    {
      name: "delete면 할 일과 함께 지운다",
      input: deletionOf({ todoHandling: "delete", activeSeriesCount: 2 }),
      expected: { ok: true, plan: "delete-with-todos" },
    },
    {
      name: "delete인데 옮길 곳이 있으면 거절한다",
      input: deletionOf({ todoHandling: "delete", moveToCategoryId: OTHER_ID }),
      expected: { ok: false, reason: "move-target-not-allowed" },
    },
    {
      name: "delete라도 빈 카테고리면 그냥 지운다",
      input: deletionOf({ todoHandling: "delete", todoCount: 0 }),
      expected: { ok: true, plan: "delete-empty" },
    },
  ])("$name", ({ input, expected }) => {
    // Given
    const deletion = input;

    // When
    const plan = planCategoryDeletion(deletion);

    // Then
    expect(plan).toEqual(expected);
  });
});
