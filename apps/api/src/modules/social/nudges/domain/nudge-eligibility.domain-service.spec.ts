import { canNudgeTodoOn, type NudgeableTodo } from "./nudge-eligibility.domain-service.js";

const TODAY = Temporal.PlainDate.from("2026-07-26");

function todo(overrides: Partial<NudgeableTodo> = {}): NudgeableTodo {
  return { completed: false, startDate: TODAY, endDate: null, ...overrides };
}

describe("canNudgeTodoOn — 콕을 찌를 수 있는 할 일", () => {
  it.each([
    { name: "하루 할 일의 시작일", todo: todo(), date: TODAY, expected: true },
    { name: "하루 할 일의 다음 날", todo: todo(), date: TODAY.add({ days: 1 }), expected: false },
    {
      name: "기간 할 일의 시작일",
      todo: todo({ endDate: TODAY.add({ days: 2 }) }),
      date: TODAY,
      expected: true,
    },
    {
      name: "기간 할 일의 종료일",
      todo: todo({ startDate: TODAY.subtract({ days: 2 }), endDate: TODAY }),
      date: TODAY,
      expected: true,
    },
    {
      name: "기간 할 일이 끝난 다음 날",
      todo: todo({ startDate: TODAY.subtract({ days: 5 }), endDate: TODAY.subtract({ days: 1 }) }),
      date: TODAY,
      expected: false,
    },
    { name: "오늘 끝낸 하루 할 일", todo: todo({ completed: true }), date: TODAY, expected: false },
    {
      name: "끝낸 기간 할 일의 중간 날",
      todo: todo({ completed: true, endDate: TODAY.add({ days: 2 }) }),
      date: TODAY.add({ days: 1 }),
      expected: false,
    },
  ])("$name은 찌를 수 있는지가 $expected다", ({ todo: target, date, expected }) => {
    // When
    const canNudge = canNudgeTodoOn(target, date);

    // Then
    expect(canNudge).toBe(expected);
  });
});
