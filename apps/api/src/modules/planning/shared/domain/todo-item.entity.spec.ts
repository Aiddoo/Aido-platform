import { createTodoItemFixture, TODO_FIXTURE_NOW } from "#test/fixtures/planning/todo.fixture";

import { TodoItemId } from "./todo-item-id.vo.js";
import { TodoItem } from "./todo-item.entity.js";
import { TodoTitle } from "./todo-title.vo.js";

const LATER = TODO_FIXTURE_NOW.add({ minutes: 1 });

describe("TodoItem — 하위 항목 자식 엔티티", () => {
  it("새 항목은 미완료이고 생성 시각을 수정 시각으로도 쓴다", () => {
    // When
    const item = TodoItem.create({
      id: TodoItemId.reconstitute(10),
      title: TodoTitle.create("우유 사기"),
      sortOrder: 2,
      now: TODO_FIXTURE_NOW,
    });

    // Then
    expect(item.toPrimitives()).toEqual(
      createTodoItemFixture({ id: 10, title: "우유 사기", sortOrder: 2 }),
    );
  });

  it("저장값을 그대로 복원하고 다시 꺼내면 같은 값이다", () => {
    // Given
    const primitives = createTodoItemFixture({ sortOrder: 3, completed: true });

    // When
    const item = TodoItem.reconstitute(primitives);

    // Then
    expect(item.toPrimitives()).toEqual(primitives);
  });

  describe("rename", () => {
    it("제목을 바꾸면 true이고 수정 시각을 옮긴다", () => {
      // Given
      const item = TodoItem.reconstitute(createTodoItemFixture());

      // When
      const changed = item.rename(TodoTitle.create("새 제목"), LATER);

      // Then
      expect(changed).toBe(true);
      expect(item.title.value).toBe("새 제목");
      expect(item.toPrimitives().updatedAt).toEqual(LATER);
    });

    it("같은 제목이면 false이고 수정 시각을 그대로 둔다", () => {
      // Given
      const item = TodoItem.reconstitute(createTodoItemFixture({ title: "우유 사기" }));

      // When
      const changed = item.rename(TodoTitle.create("우유 사기"), LATER);

      // Then
      expect(changed).toBe(false);
      expect(item.toPrimitives().updatedAt).toEqual(TODO_FIXTURE_NOW);
    });
  });

  describe("changeCompleted", () => {
    it("완료로 바꾸면 true다", () => {
      // Given
      const item = TodoItem.reconstitute(createTodoItemFixture({ completed: false }));

      // When
      const changed = item.changeCompleted(true, LATER);

      // Then
      expect(changed).toBe(true);
      expect(item.completed).toBe(true);
    });

    it("미완료로 되돌릴 수 있다", () => {
      // Given
      const item = TodoItem.reconstitute(createTodoItemFixture({ completed: true }));

      // When
      const changed = item.changeCompleted(false, LATER);

      // Then
      expect(changed).toBe(true);
      expect(item.completed).toBe(false);
    });

    it("같은 완료 상태면 false다", () => {
      // Given
      const item = TodoItem.reconstitute(createTodoItemFixture({ completed: true }));

      // When
      const changed = item.changeCompleted(true, LATER);

      // Then
      expect(changed).toBe(false);
      expect(item.toPrimitives().updatedAt).toEqual(TODO_FIXTURE_NOW);
    });
  });
});
