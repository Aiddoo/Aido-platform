import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createTodoCategoryFixture } from "#test/fixtures/planning/todo-category.fixture";
import { TODO_FIXTURE_NOW, TODO_FIXTURE_USER_ID } from "#test/fixtures/planning/todo.fixture";

import { CategoryColor } from "./category-color.vo.js";
import { CategoryName } from "./category-name.vo.js";
import { TodoCategoryId } from "./todo-category-id.vo.js";
import { TodoCategory } from "./todo-category.aggregate.js";

const LATER = TODO_FIXTURE_NOW.add({ hours: 1 });

describe("TodoCategory", () => {
  it("만들면 두 시각이 지금이다", () => {
    // Given
    const params = {
      id: TodoCategoryId.reconstitute(3),
      userId: UserId.reconstitute(TODO_FIXTURE_USER_ID),
      name: CategoryName.create("업무"),
      color: CategoryColor.create("#FFB3B3"),
      sortOrder: 2,
      now: TODO_FIXTURE_NOW,
    };

    // When
    const category = TodoCategory.create(params);

    // Then
    expect(category.toPrimitives()).toEqual({
      id: 3,
      userId: TODO_FIXTURE_USER_ID,
      name: "업무",
      color: "#FFB3B3",
      sortOrder: 2,
      createdAt: TODO_FIXTURE_NOW,
      updatedAt: TODO_FIXTURE_NOW,
    });
  });

  it("복원한 값을 그대로 꺼낸다", () => {
    // Given
    const primitives = createTodoCategoryFixture({ id: 5, sortOrder: 4 }).toPrimitives();

    // When
    const restored = TodoCategory.reconstitute(primitives);

    // Then
    expect(restored.toPrimitives()).toEqual(primitives);
  });

  it("이름이 유효해도 색상 검증이 실패하면 모든 변경을 취소한다", () => {
    // Given
    const category = createTodoCategoryFixture();

    // When
    const patch = () => category.updateDetails({ name: "변경된 업무", color: "invalid" }, LATER);

    // Then
    expect(patch).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }));
    expect(category.toPrimitives()).toMatchObject({
      name: "업무",
      color: "#FFB3B3",
      updatedAt: TODO_FIXTURE_NOW,
    });
  });

  it("이름이나 색상이 바뀌면 true이고 수정 시각을 남긴다", () => {
    // Given
    const category = createTodoCategoryFixture({ id: 7 });

    // When
    const changed = category.updateDetails({ color: "#FF0000" }, LATER);

    // Then
    expect(changed).toBe(true);
    expect(category.toPrimitives()).toMatchObject({
      name: "업무",
      color: "#FF0000",
      updatedAt: LATER,
    });
  });

  it("같은 이름·색상이면 false이고 시각이 그대로다", () => {
    // Given
    const category = createTodoCategoryFixture();

    // When
    const changed = category.updateDetails({ name: "업무", color: "#FFB3B3" }, LATER);

    // Then
    expect(changed).toBe(false);
    expect(category.toPrimitives().updatedAt).toEqual(TODO_FIXTURE_NOW);
  });
});
