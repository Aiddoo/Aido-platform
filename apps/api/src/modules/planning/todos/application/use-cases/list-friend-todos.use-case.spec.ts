import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning/planning-todos.fixture";
import { createTodoReadModelFromRecord } from "#test/fixtures/todo-response.fixture";

import { ListFriendTodosUseCase } from "./list-friend-todos.use-case.js";

describe("친구 할 일 목록 조회", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: ListFriendTodosUseCase;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new ListFriendTodosUseCase(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("첫 페이지를 캐시한 뒤 조회 결과가 없어도 같은 페이지를 반환한다", async () => {
    // Given
    fixture.friendIds.add("friend-user");
    fixture.todoReadRepository.queryResults = [
      createTodoReadModelFromRecord(createPlanningTodo("friend-user", 2)),
    ];
    const input = { userId: fixture.userId, friendUserId: "friend-user" };
    // When
    const first = await useCase.execute(input);
    fixture.todoReadRepository.queryResults = [];
    const cached = await useCase.execute(input);
    // Then
    expect(cached).toEqual(first);
    expect(cached.items[0]?.userId).toBe("friend-user");
    expect(
      (
        await fixture.todoCache.readFriendTodosFirstPage(
          UserId.reconstitute("friend-user"),
          "-",
          "-",
          20,
        )
      ).page,
    ).toEqual(first);
  });
  it("캐시가 있어도 맞팔이 해제되면 거부한다", async () => {
    // Given
    fixture.friendIds.add("friend-user");
    const input = { userId: fixture.userId, friendUserId: "friend-user" };
    await useCase.execute(input);
    fixture.friendIds.clear();
    // When / Then
    await expect(useCase.execute(input)).rejects.toMatchObject({
      errorCode: ErrorCode.FOLLOW_0906,
      details: { targetUserId: "friend-user" },
    });
  });
  it("날짜와 size가 다른 첫 페이지를 분리하고 커서 페이지는 캐시를 우회한다", async () => {
    // Given
    fixture.friendIds.add("friend-user");
    const input = {
      userId: fixture.userId,
      friendUserId: "friend-user",
      size: 2,
      startDate: Temporal.PlainDate.from("2026-05-01"),
      endDate: Temporal.PlainDate.from("2026-05-31"),
    };
    fixture.todoReadRepository.queryResults = [
      createTodoReadModelFromRecord(createPlanningTodo("friend-user", 3)),
    ];
    await useCase.execute(input);
    fixture.todoReadRepository.queryResults = [
      createTodoReadModelFromRecord(createPlanningTodo("friend-user", 2)),
    ];
    // When
    const cursorPage = await useCase.execute({ ...input, cursor: 3 });
    const stored = await fixture.todoCache.readFriendTodosFirstPage(
      UserId.reconstitute("friend-user"),
      "2026-05-01",
      "2026-05-31",
      2,
    );
    // Then
    expect(cursorPage.items[0]?.id).toBe(2);
    expect(stored.page?.items[0]?.id).toBe(3);
    expect(
      (
        await fixture.todoCache.readFriendTodosFirstPage(
          UserId.reconstitute("friend-user"),
          "-",
          "-",
          2,
        )
      ).page,
    ).toBeUndefined();
  });
  it("잘못된 날짜는 친구 권한 오류보다 먼저 반환한다", async () => {
    // Given
    const permission = vi.spyOn(fixture.friendPort, "isMutualFriend");
    // When / Then
    await expect(
      useCase.execute({
        userId: fixture.userId,
        friendUserId: "friend-user",
        startDate: Temporal.PlainDate.from("2026-05-16"),
        endDate: Temporal.PlainDate.from("2026-05-15"),
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(permission).not.toHaveBeenCalled();
  });
});
