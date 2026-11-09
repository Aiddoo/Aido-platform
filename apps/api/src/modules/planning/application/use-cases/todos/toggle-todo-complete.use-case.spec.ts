import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { TodoRescheduledEvent } from "../../../domain/events/todos/todo-rescheduled.event.js";
import { TodoToggledEvent } from "../../../domain/events/todos/todo-toggled.event.js";
import { ToggleTodoComplete } from "./toggle-todo-complete.use-case.js";

describe("할 일 완료 상태 전이", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: ToggleTodoComplete;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new ToggleTodoComplete(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("완료 시각을 고정해서 저장하고 해제하면 null로 지운다", async () => {
    // Given
    const input = {
      id: 1,
      userId: fixture.userId,
      timezone: "Asia/Seoul",
      completed: true,
    };
    // When
    const completed = await useCase.execute(input);
    const uncompleted = await useCase.execute({ ...input, completed: false });
    // Then
    expect(completed).toMatchObject({ completed: true, completedAt: PLANNING_TIME.toISOString() });
    expect(uncompleted).toMatchObject({ completed: false, completedAt: null });
    expect(fixture.records.get(1)).toMatchObject({ completed: false, completedAt: null });
    expect(fixture.eventPublisher.events).toHaveLength(2);
    expect(fixture.eventPublisher.events.every((event) => event instanceof TodoToggledEvent)).toBe(
      true,
    );
  });
  it("같은 완료 요청은 시각과 이벤트를 중복 변경하지 않는다", async () => {
    // Given
    const input = {
      id: 1,
      userId: fixture.userId,
      timezone: "Asia/Seoul",
      completed: true,
    };
    await useCase.execute(input);
    const completionWrite = vi.spyOn(fixture.todoRepository, "updateCompletion");
    vi.setSystemTime(new Date("2026-05-15T04:00:00Z"));
    // When
    const result = await useCase.execute(input);
    // Then
    expect(result.completedAt).toBe(PLANNING_TIME.toISOString());
    expect(fixture.eventPublisher.events).toHaveLength(1);
    expect(completionWrite).not.toHaveBeenCalled();
  });
  it("완료를 되돌리면 순간은 그대로 두고 지금 순간으로 알림 재예약 이벤트를 낸다", async () => {
    // Given
    const instant = new Date("2026-05-16T14:00:00.000Z");
    fixture = createPlanningTodoFixture({
      todos: [
        {
          ...createPlanningTodo(),
          startDate: new Date("2026-05-16T00:00:00.000Z"),
          scheduledLocalTime: "10:00",
          scheduledTime: instant,
          isAllDay: false,
          completed: true,
          completedAt: PLANNING_TIME,
        },
      ],
    });
    useCase = new ToggleTodoComplete(fixture);
    // When
    const result = await useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "Asia/Seoul",
      completed: false,
    });
    // Then
    expect(fixture.records.get(1)).toMatchObject({
      scheduledLocalTime: "10:00",
      scheduledTime: instant,
      completed: false,
    });
    expect(result).toMatchObject({ scheduledLocalTime: "10:00" });
    expect(fixture.eventPublisher.events).toContainEqual(
      new TodoRescheduledEvent(1, fixture.userId, instant),
    );
  });

  it("다른 사용자의 할 일은 완료할 수 없다", async () => {
    // Given
    const before = structuredClone(fixture.records.get(1));
    // When / Then
    await expect(
      useCase.execute({
        id: 1,
        userId: "other-user",
        timezone: "UTC",
        completed: true,
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
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
    const execution = useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "UTC",
      completed: true,
    });
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
