import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_INSTANT,
  PLANNING_TIME,
  snapshotTodoRecord,
} from "#test/fixtures/planning/planning-todos.fixture";

import { TodoRescheduledEvent } from "../../../shared/domain/todo-rescheduled.event.js";
import { TodoToggledEvent } from "../../../shared/domain/todo-toggled.event.js";
import { SetTodoCompletedUseCase } from "./set-todo-completed.use-case.js";

describe("할 일 완료 상태 전이", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: SetTodoCompletedUseCase;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new SetTodoCompletedUseCase(fixture);
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
    expect(fixture.completionEffects.events).toHaveLength(2);
    expect(
      fixture.completionEffects.events.every((event) => event instanceof TodoToggledEvent),
    ).toBe(true);
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
    expect(fixture.completionEffects.events).toHaveLength(1);
    expect(completionWrite).not.toHaveBeenCalled();
  });
  it("완료를 되돌리면 순간은 그대로 두고 지금 순간으로 알림 재예약 이벤트를 낸다", async () => {
    // Given
    const instant = Temporal.Instant.from("2026-05-16T14:00:00.000Z");
    fixture = createPlanningTodoFixture({
      todos: [
        {
          ...createPlanningTodo(),
          startDate: Temporal.PlainDate.from("2026-05-16"),
          scheduledLocalTime: "10:00",
          scheduledTime: instant,
          isAllDay: false,
          completed: true,
          completedAt: PLANNING_INSTANT,
        },
      ],
    });
    useCase = new SetTodoCompletedUseCase(fixture);
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
    expect(fixture.completionEffects.events).toContainEqual(
      new TodoRescheduledEvent(1, fixture.userId, instant),
    );
  });

  it("다른 사용자의 할 일은 완료할 수 없다", async () => {
    // Given
    const before = snapshotTodoRecord(fixture.records.get(1));
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
    expect(fixture.completionEffects.events).toEqual([]);
  });

  it("완료 효과가 끝나기 전에 응답 조회를 진행하지 않는다", async () => {
    // Given
    const entered = Promise.withResolvers<void>();
    const effects = Promise.withResolvers<void>();
    fixture.completionEffects.execute = async () => {
      entered.resolve();
      await effects.promise;
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
      effects.resolve();
      await execution;
    }
    expect(responseRead).toHaveBeenCalledOnce();
  });
});
