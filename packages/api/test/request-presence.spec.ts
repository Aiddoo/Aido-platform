import { test, expect, describe } from "vitest";

import { getTodosQuerySchema, updateTodoSchema, type UpdateTodoInput } from "../src/index.js";

const fixtureTest = test.extend<{ patch: UpdateTodoInput }>({ patch: {} });

describe("공유 REST PATCH presence", () => {
  fixtureTest("미제공 nullable 필드를 null로 바꾸지 않는다", ({ patch }) => {
    // Given
    const input = patch;
    // When
    const result = updateTodoSchema.parse(input);
    // Then
    expect(result).not.toHaveProperty("endDate");
    expect(result).not.toHaveProperty("scheduledTime");
    expect(result).not.toHaveProperty("completed");
  });

  fixtureTest("nullable 필드의 null과 false를 그대로 유지한다", ({ patch }) => {
    // Given
    const input = {
      ...patch,
      endDate: null,
      scheduledTime: null,
      completed: false,
      isAllDay: false,
    };
    // When
    const result = updateTodoSchema.parse(input);
    // Then
    expect(result).toEqual(input);
  });

  fixtureTest("nullable이 아닌 제목의 null을 허용하지 않는다", ({ patch }) => {
    // Given
    const input = { ...patch, title: null };
    // When
    const result = updateTodoSchema.safeParse(input);
    // Then
    expect(result.success).toBe(false);
  });

  test("cursor 0과 completed false query를 누락으로 처리하지 않는다", () => {
    // Given
    const input = { cursor: "0", completed: "false" };
    // When
    const result = getTodosQuerySchema.parse(input);
    // Then
    expect(result.cursor).toBe(0);
    expect(result.completed).toBe(false);
  });
});
