import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { TodoUpdatedEvent } from "../../../domain/events/todos/todo-updated.event.js";
import { UpdateTodoTitle } from "./update-todo-title.use-case.js";

describe("할 일 제목 수정", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: UpdateTodoTitle;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new UpdateTodoTitle(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("제목을 저장하며 일정과 하위 항목을 보존하고 변경 이벤트를 발행한다", async () => {
    // Given
    const before = structuredClone(fixture.records.get(1));
    // When
    const result = await useCase.execute({ id: 1, userId: fixture.userId, title: "변경된 제목" });
    // Then
    expect(fixture.records.get(1)).toEqual({ ...before, title: "변경된 제목" });
    expect(result.title).toBe("변경된 제목");
    expect(fixture.eventPublisher.events).toHaveLength(1);
    expect(fixture.eventPublisher.events[0]).toBeInstanceOf(TodoUpdatedEvent);
  });
  it("잘못된 제목과 다른 사용자의 요청은 저장 상태를 바꾸지 않는다", async () => {
    // Given
    const before = structuredClone(fixture.records.get(1));
    // When / Then
    await expect(
      useCase.execute({ id: 1, userId: fixture.userId, title: "가".repeat(201) }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    await expect(
      useCase.execute({ id: 1, userId: "other-user", title: "잘못된 변경" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801, details: { todoId: 1 } });
    expect(fixture.records.get(1)).toEqual(before);
    expect(fixture.eventPublisher.events).toEqual([]);
  });

  it("이벤트 발행이 끝나기 전에 응답 조회를 진행하지 않는다", async () => {
    // Given
    const entered = Promise.withResolvers<void>();
    const publication = Promise.withResolvers<void>();
    fixture.eventPublisher.publishAll = async () => {
      entered.resolve();
      await publication.promise;
    };
    const responseRead = vi.spyOn(fixture.todoReadRepository, "findByIdAndUserId");
    // When
    const execution = useCase.execute({ id: 1, userId: fixture.userId, title: "새 제목" });
    try {
      await Promise.race([entered.promise, execution]);
      // Then
      expect(responseRead).not.toHaveBeenCalled();
    } finally {
      publication.resolve();
      await execution;
    }
    expect(responseRead).toHaveBeenCalledOnce();
  });
});
