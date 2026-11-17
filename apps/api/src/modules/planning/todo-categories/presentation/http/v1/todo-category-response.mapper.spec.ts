import { createTodoCategoryFixture } from "#test/fixtures/planning/todo-category.fixture";

import type { TodoCategoryWithCountReadModel } from "../../../application/read-models/todo-category-with-count.read-model.js";
import { TodoCategoryMapper } from "./todo-category-response.mapper.js";

describe("TodoCategoryMapper", () => {
  it("toResponse: 시각을 ms 3자리 UTC 문자열로 직렬화한다", () => {
    // Given
    const category = createTodoCategoryFixture({
      id: 1,
      userId: "u1",
      createdAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
      updatedAt: Temporal.Instant.from("2026-01-02T00:00:00.120456Z"),
    });

    // When
    const response = TodoCategoryMapper.toResponse(category);

    // Then
    expect(response).toEqual({
      id: 1,
      userId: "u1",
      name: "업무",
      color: "#FFB3B3",
      sortOrder: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.120Z",
    });
  });

  it("toResponseWithCount: todoCount를 함께 싣는다", () => {
    // Given
    const view: TodoCategoryWithCountReadModel = {
      id: 2,
      userId: "u1",
      name: "할 일",
      color: "#FF6B43",
      sortOrder: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      todoCount: 5,
    };

    // When
    const response = TodoCategoryMapper.toResponseWithCount(view);

    // Then
    expect(response).toEqual({
      id: 2,
      userId: "u1",
      name: "할 일",
      color: "#FF6B43",
      sortOrder: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      todoCount: 5,
    });
  });
});
