import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { ReorderTodo } from "./reorder-todo.use-case.js";

describe("할 일 순서 변경", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: ReorderTodo;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new ReorderTodo(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    { name: "아래 before", id: 1, targetTodoId: 4, position: "before", expected: [2, 3, 1, 4] },
    { name: "위 before", id: 4, targetTodoId: 2, position: "before", expected: [1, 4, 2, 3] },
    { name: "상대 after", id: 1, targetTodoId: 3, position: "after", expected: [2, 3, 1, 4] },
    { name: "맨 앞", id: 3, targetTodoId: undefined, position: "before", expected: [3, 1, 2, 4] },
    { name: "맨 뒤", id: 2, targetTodoId: undefined, position: "after", expected: [1, 3, 4, 2] },
    { name: "자기 자신", id: 2, targetTodoId: 2, position: "before", expected: [1, 2, 3, 4] },
  ] satisfies Array<{
    name: string;
    id: number;
    targetTodoId: number | undefined;
    position: "before" | "after";
    expected: number[];
  }>)(
    "$name 이동은 전체 순서에 충돌 없이 반영된다",
    async ({ id, targetTodoId, position, expected }) => {
      // Given
      fixture.records.clear();
      for (let todoId = 1; todoId <= 4; todoId++)
        fixture.records.set(todoId, {
          ...createPlanningTodo(fixture.userId, todoId),
          sortOrder: todoId - 1,
        });
      // When
      const result = await useCase.execute({ id, userId: fixture.userId, targetTodoId, position });
      // Then
      const sorted = [...fixture.records.values()].sort(
        (left, right) => left.sortOrder - right.sortOrder,
      );
      expect(sorted.map((todo) => todo.id)).toEqual(expected);
      expect(sorted.map((todo) => todo.sortOrder)).toEqual([0, 1, 2, 3]);
      expect(result.sortOrder).toBe(expected.indexOf(id));
    },
  );
  it("없는 기준과 다른 소유자의 요청은 순서를 변경하지 않는다", async () => {
    // Given
    const before = structuredClone([...fixture.records.values()]);
    // When / Then
    await expect(
      useCase.execute({ id: 1, userId: fixture.userId, targetTodoId: 999, position: "before" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0810 });
    await expect(
      useCase.execute({ id: 1, userId: "other-user", targetTodoId: undefined, position: "after" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect([...fixture.records.values()]).toEqual(before);
  });
});
