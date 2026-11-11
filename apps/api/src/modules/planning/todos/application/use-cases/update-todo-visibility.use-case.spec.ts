import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning/planning-todos.fixture";

import { UpdateTodoVisibilityUseCase } from "./update-todo-visibility.use-case.js";

describe("할 일 공개 범위 수정", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: UpdateTodoVisibilityUseCase;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new UpdateTodoVisibilityUseCase(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("비공개 전이를 저장하고 친구 목록 캐시와 이벤트에 반영한다", async () => {
    // Given
    await fixture.todoCache.storeFriendTodosFirstPageIfCurrent(
      UserId.reconstitute(fixture.userId),
      "-",
      "-",
      20,
      "0",
      {
        items: [],
        pagination: { hasNext: false, nextCursor: null, size: 20 },
      },
    );
    // When
    const result = await useCase.execute({ id: 1, userId: fixture.userId, visibility: "PRIVATE" });
    // Then
    expect(result.visibility).toBe("PRIVATE");
    expect(fixture.records.get(1)?.visibility).toBe("PRIVATE");
    expect(
      (
        await fixture.todoCache.readFriendTodosFirstPage(
          UserId.reconstitute(fixture.userId),
          "-",
          "-",
          20,
        )
      ).page,
    ).toBeUndefined();
    expect(fixture.eventPublisher.publishedEvents.map(({ eventName }) => eventName)).toEqual([
      "planning.todo.visibility-changed",
    ]);
  });
  it("없는 할 일과 저장 후 사라진 응답은 기존 오류를 반환한다", async () => {
    // Given
    fixture.todoReadRepository.findByIdAndUserId = async () => null;
    // When / Then
    await expect(
      useCase.execute({ id: 999, userId: fixture.userId, visibility: "PRIVATE" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    await expect(
      useCase.execute({ id: 1, userId: fixture.userId, visibility: "PRIVATE" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(fixture.records.get(1)?.visibility).toBe("PRIVATE");
  });
});
