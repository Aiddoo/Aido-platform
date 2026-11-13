import { ErrorCode } from "@aido/api/errors";

import { TodoCompletionCount } from "./todo-completion-count.vo.js";

describe("TodoCompletionCount", () => {
  it.each([
    { total: 3, completed: 3, rate: 100, isAllCompleted: true },
    { total: 3, completed: 2, rate: 67, isAllCompleted: false },
    { total: 0, completed: 0, rate: 0, isAllCompleted: false },
  ])(
    "$completed/$total은 완료율 $rate, 모두 끝냄 $isAllCompleted",
    ({ total, completed, rate, isAllCompleted }) => {
      // Given
      const count = TodoCompletionCount.create(total, completed);

      // When
      const result = { rate: count.rate, isAllCompleted: count.isAllCompleted() };

      // Then
      expect(result).toEqual({ rate, isAllCompleted });
    },
  );

  it.each([
    { total: -1, completed: 0, details: { field: "totalTodos", value: -1 } },
    { total: 1.5, completed: 0, details: { field: "totalTodos", value: 1.5 } },
    {
      total: 2,
      completed: 5,
      details: { field: "completedTodos", completedTodos: 5, totalTodos: 2 },
    },
    {
      total: 2,
      completed: -1,
      details: { field: "completedTodos", completedTodos: -1, totalTodos: 2 },
    },
  ])(
    "할 일 수가 0 이상 정수가 아니거나 완료 수가 범위를 벗어나면 SYS_0002와 어긴 칸을 알린다 ($details.field)",
    ({ total, completed, details }) => {
      // When
      const creating = () => TodoCompletionCount.create(total, completed);

      // Then
      expect(creating).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0002, details }));
    },
  );
});
