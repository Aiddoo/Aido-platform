import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeTargetTodo, type NudgeTargetTodoValue } from "./nudge-target-todo.vo.js";

const TODAY = Temporal.PlainDate.from("2026-07-26");

function targetTodo(overrides: Partial<NudgeTargetTodoValue> = {}): NudgeTargetTodo {
  return NudgeTargetTodo.reconstitute({
    ownerId: "receiver",
    title: "운동하기",
    visibility: "PUBLIC",
    completed: false,
    startDate: TODAY,
    endDate: null,
    ...overrides,
  });
}

describe("NudgeTargetTodo — 콕 대상 할 일", () => {
  it("소유자와 공개 여부를 판단한다", () => {
    // Given
    const publicTodo = targetTodo();
    const privateTodo = targetTodo({ visibility: "PRIVATE" });

    // When
    const result = {
      isOwner: publicTodo.isOwnedBy(UserId.reconstitute("receiver")),
      isStranger: publicTodo.isOwnedBy(UserId.reconstitute("sender")),
      isPublic: publicTodo.isPublic(),
      isPrivatePublic: privateTodo.isPublic(),
    };

    // Then
    expect(result).toEqual({
      isOwner: true,
      isStranger: false,
      isPublic: true,
      isPrivatePublic: false,
    });
  });
});
