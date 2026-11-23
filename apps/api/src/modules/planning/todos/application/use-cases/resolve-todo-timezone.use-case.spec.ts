import { StubTodoOwnerTimezone } from "#test/doubles/planning/stub-todo-owner-timezone";

import { ResolveTodoTimezoneUseCase } from "./resolve-todo-timezone.use-case.js";

function resolverWith(stored: string | null) {
  const timezones = new Map(stored == null ? [] : [["user", stored]]);
  return new ResolveTodoTimezoneUseCase({ ownerTimezone: new StubTodoOwnerTimezone(timezones) });
}

describe("할 일 쓰기의 시간대", () => {
  it.each([
    {
      name: "요청 헤더가 먼저다",
      requested: "America/New_York",
      stored: "Asia/Seoul",
      resolved: "America/New_York",
    },
    {
      name: "헤더가 없으면 저장값이다",
      requested: undefined,
      stored: "Europe/London",
      resolved: "Europe/London",
    },
    {
      name: "잘못된 헤더도 저장값이다",
      requested: "Mars/Phobos",
      stored: "Europe/London",
      resolved: "Europe/London",
    },
    { name: "저장된 UTC는 진짜 UTC로 본다", requested: undefined, stored: "UTC", resolved: "UTC" },
    {
      name: "저장값이 없으면 기본값이다",
      requested: undefined,
      stored: null,
      resolved: "Asia/Seoul",
    },
    {
      name: "저장값이 잘못됐으면 기본값이다",
      requested: undefined,
      stored: "Mars/Phobos",
      resolved: "Asia/Seoul",
    },
  ])("$name", async ({ requested, stored, resolved }) => {
    // Given
    const resolver = resolverWith(stored);
    // When
    const timezone = await resolver.execute("user", requested);
    // Then
    expect(timezone).toBe(resolved);
  });
});
