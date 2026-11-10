import { createTodoReadModelFixture } from "#test/fixtures/planning/todo-read-model.fixture";

import { toFriendTodoResponse, toTodoResponse } from "./todo-response.mapper.js";

const ITEM = {
  title: "항목",
  sortOrder: 0,
  createdAt: "2026-11-10T00:00:00.000Z",
  updatedAt: "2026-11-10T00:00:00.000Z",
};

describe("할 일 응답 매퍼", () => {
  it("하위 항목 수와 완료 수를 itemStats로 센다", () => {
    // Given
    const todo = createTodoReadModelFixture({
      items: [
        { ...ITEM, id: 1, completed: true },
        { ...ITEM, id: 2, completed: false },
        { ...ITEM, id: 3, completed: true },
      ],
    });

    // When
    const response = toFriendTodoResponse(todo);

    // Then
    expect(response.itemStats).toEqual({ total: 3, completed: 2 });
  });

  it("출시 앱 호환 이름으로 규칙 id를 recurrenceGroupId에 담고 content는 null이다", () => {
    // Given
    const todo = createTodoReadModelFixture({ seriesId: "series-1" });

    // When
    const response = toTodoResponse(todo);

    // Then
    expect(response).toMatchObject({ recurrenceGroupId: "series-1", content: null });
    expect(response).not.toHaveProperty("seriesId");
  });

  it("친구에게 주는 응답에는 repeat와 occurrenceDate 키가 없다", () => {
    // Given
    const todo = createTodoReadModelFixture({ seriesId: "series-1" });

    // When
    const response = toFriendTodoResponse(todo);

    // Then
    expect(response).not.toHaveProperty("repeat");
    expect(response).not.toHaveProperty("occurrenceDate");
  });
});
