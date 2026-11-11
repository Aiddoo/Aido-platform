import { describe, expect, it } from "vitest";

import { deleteTodoCategoryQuerySchema } from "../src/index.js";

describe("카테고리 삭제 query", () => {
  it.each([
    { name: "아무것도 없으면 출시 앱 요청 그대로 통과한다", query: {} },
    { name: "옮길 곳만 있으면 출시 앱 요청 그대로 통과한다", query: { moveToCategoryId: "2" } },
    {
      name: "move와 옮길 곳을 함께 받는다",
      query: { todoHandling: "move", moveToCategoryId: "2" },
    },
    { name: "delete는 옮길 곳 없이 받는다", query: { todoHandling: "delete" } },
  ])("$name", ({ query }) => {
    // Given
    const input = query;

    // When
    const result = deleteTodoCategoryQuerySchema.safeParse(input);

    // Then
    expect(result.success).toBe(true);
  });

  it.each([
    { name: "move인데 옮길 곳이 없으면 거절한다", query: { todoHandling: "move" } },
    {
      name: "delete인데 옮길 곳이 있으면 거절한다",
      query: { todoHandling: "delete", moveToCategoryId: "2" },
    },
    { name: "모르는 처리 값은 거절한다", query: { todoHandling: "archive" } },
  ])("$name", ({ query }) => {
    // Given
    const input = query;

    // When
    const result = deleteTodoCategoryQuerySchema.safeParse(input);

    // Then
    expect(result.success).toBe(false);
  });
});
