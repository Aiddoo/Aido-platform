import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import { copyTodoRecord } from "#test/doubles/planning/in-memory-todo.repository";
import {
  createPlanningTodoFixture,
  createPlanningTodo,
} from "#test/fixtures/planning/planning-todos.fixture";

import { ReorderTodoUseCase } from "./reorder-todo.use-case.js";

describe("할 일 순서 변경", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: ReorderTodoUseCase;
  beforeEach(() => {
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new ReorderTodoUseCase(fixture);
  });
  afterEach(() => {
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
    "$name 이동은 전체 순서에 충돌 없이 반영된다(간격 없는 옛 순서는 다시 매긴다)",
    async ({ id, targetTodoId, position, expected }) => {
      // Given
      // 간격 없이 0,1,2,3으로 쌓인 옛 순서
      fixture.records.clear();
      for (let todoId = 1; todoId <= 4; todoId++) {
        fixture.records.set(todoId, {
          ...createPlanningTodo(fixture.userId, todoId),
          sortOrder: todoId - 1,
        });
      }
      // When
      const result = await useCase.execute({ id, userId: fixture.userId, targetTodoId, position });
      // Then
      const sorted = [...fixture.records.values()].sort(
        (left, right) => left.sortOrder - right.sortOrder,
      );
      expect(sorted.map((todo) => todo.id)).toEqual(expected);
      expect(new Set(sorted.map((todo) => todo.sortOrder)).size).toBe(4);
      expect(result.sortOrder).toBe(fixture.records.get(id)?.sortOrder);
    },
  );

  it.each([
    {
      name: "사이로",
      id: 4,
      targetTodoId: 2,
      position: "after",
      expected: [1, 2, 4, 3],
      value: 2560,
    },
    {
      name: "맨 앞",
      id: 3,
      targetTodoId: undefined,
      position: "before",
      expected: [3, 1, 2, 4],
      value: 0,
    },
    {
      name: "맨 끝",
      id: 1,
      targetTodoId: undefined,
      position: "after",
      expected: [2, 3, 4, 1],
      value: 5120,
    },
  ] satisfies Array<{
    name: string;
    id: number;
    targetTodoId: number | undefined;
    position: "before" | "after";
    expected: number[];
    value: number;
  }>)(
    "간격이 있으면 $name 옮긴 할 일 한 행만 바꾼다",
    async ({ id, targetTodoId, position, expected, value }) => {
      // Given
      fixture.records.clear();
      for (let todoId = 1; todoId <= 4; todoId++) {
        fixture.records.set(todoId, {
          ...createPlanningTodo(fixture.userId, todoId),
          sortOrder: todoId * 1024,
        });
      }
      // When
      await useCase.execute({ id, userId: fixture.userId, targetTodoId, position });
      // Then
      const sorted = [...fixture.records.values()].sort(
        (left, right) => left.sortOrder - right.sortOrder,
      );
      expect(sorted.map((todo) => todo.id)).toEqual(expected);
      expect(sorted.filter((todo) => todo.id !== id).map((todo) => todo.sortOrder)).toEqual(
        [1024, 2048, 3072, 4096].filter((sortOrder) => sortOrder !== id * 1024),
      );
      expect(fixture.records.get(id)?.sortOrder).toBe(value);
    },
  );
  it("없는 기준과 다른 소유자의 요청은 순서를 변경하지 않는다", async () => {
    // Given
    const before = [...fixture.records.values()].map(copyTodoRecord);
    // When
    const missingTargetResult = useCase.execute({
      id: 1,
      userId: fixture.userId,
      targetTodoId: 999,
      position: "before",
    });
    // Then
    await expect(missingTargetResult).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0810 });
    // When
    const otherUserResult = useCase.execute({
      id: 1,
      userId: "other-user",
      targetTodoId: undefined,
      position: "after",
    });
    // Then
    await expect(otherUserResult).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect([...fixture.records.values()]).toEqual(before);
  });
  it("다시 번호 매긴 뒤 새 자리가 옮길 할 일의 옛 값과 같아도 그 자리에 저장한다", async () => {
    // Given
    // 1000·1001 사이에 자리가 없어 다시 매기면 1024·2048·3072가 되고, 새 자리는 옛 값과 같은 1536이다
    fixture.records.clear();
    for (const [todoId, sortOrder] of [
      [1, 1000],
      [2, 1001],
      [3, 1536],
    ] as const) {
      fixture.records.set(todoId, { ...createPlanningTodo(fixture.userId, todoId), sortOrder });
    }
    // When
    const result = await useCase.execute({
      id: 3,
      userId: fixture.userId,
      targetTodoId: 2,
      position: "before",
    });
    // Then
    const sorted = [...fixture.records.values()].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    );
    expect(sorted.map((todo) => [todo.id, todo.sortOrder])).toEqual([
      [1, 1024],
      [3, 1536],
      [2, 2048],
    ]);
    expect(result.sortOrder).toBe(1536);
  });
});
