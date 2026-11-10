import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeTargetTodo, type NudgeTargetTodoValue } from "./nudge-target-todo.vo.js";

const TODAY = Temporal.PlainDate.from("2026-07-26");

function targetTodo(overrides: Partial<NudgeTargetTodoValue> = {}): NudgeTargetTodo {
  return NudgeTargetTodo.reconstitute({
    ownerId: "receiver",
    title: "운동하기",
    visibility: "PUBLIC",
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

  it.each([
    { name: "하루 할 일의 시작일", todo: {}, date: TODAY, expected: true },
    { name: "하루 할 일의 다음 날", todo: {}, date: TODAY.add({ days: 1 }), expected: false },
    {
      name: "기간 할 일의 시작일",
      todo: { endDate: TODAY.add({ days: 2 }) },
      date: TODAY,
      expected: true,
    },
    {
      name: "기간 할 일의 종료일",
      todo: { startDate: TODAY.subtract({ days: 2 }), endDate: TODAY },
      date: TODAY,
      expected: true,
    },
    {
      name: "기간 할 일이 끝난 다음 날",
      todo: { startDate: TODAY.subtract({ days: 5 }), endDate: TODAY.subtract({ days: 1 }) },
      date: TODAY,
      expected: false,
    },
  ])("$name에 찌를 수 있는지 판단한다", ({ todo, date, expected }) => {
    // When
    const isActive = targetTodo(todo).isActiveOn(date);

    // Then
    expect(isActive).toBe(expected);
  });
});
