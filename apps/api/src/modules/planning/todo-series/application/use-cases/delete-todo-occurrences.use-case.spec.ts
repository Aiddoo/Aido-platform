import { ErrorCode } from "@aido/api/errors";

import {
  createPlanningTodo,
  createPlanningTodoFixture,
} from "#test/fixtures/planning/planning-todos.fixture";

describe("반복 회차 범위 삭제", () => {
  it("이후 모두 고치기와 같은 카테고리·순서 잠금을 한 번에 잡은 뒤 반복이 아닌 할 일은 TODO_0844로 거절한다", async () => {
    // Given
    const fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });

    // When
    const result = fixture.deleteOccurrences.execute({
      todoId: 1,
      userId: fixture.userId,
      scope: "ALL",
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0844 });
    expect(fixture.mutationLock.acquiredKeys).toEqual([
      [
        `mutation:v1:todo-category:${fixture.userId}`,
        `mutation:v1:todo-sort-order:${fixture.userId}`,
      ],
    ]);
    expect(fixture.records.has(1)).toBe(true);
  });
});
