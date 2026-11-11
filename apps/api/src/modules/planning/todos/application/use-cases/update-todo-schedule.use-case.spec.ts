import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
  snapshotTodoRecord,
} from "#test/fixtures/planning/planning-todos.fixture";

import { UpdateTodoScheduleUseCase } from "./update-todo-schedule.use-case.js";

describe("할 일 일정 수정", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: UpdateTodoScheduleUseCase;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new UpdateTodoScheduleUseCase(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("시간 일정을 저장하고 리마인더 이벤트에 동일한 시간을 전달한다", async () => {
    // Given
    const scheduledTime = Temporal.Instant.from("2026-05-16T03:30:00Z");
    // When
    const result = await useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "Asia/Seoul",
      schedule: {
        startDate: Temporal.PlainDate.from("2026-05-16"),
        endDate: null,
        scheduledTime: "12:30",
        isAllDay: false,
      },
    });
    // Then
    expect(fixture.records.get(1)).toMatchObject({
      scheduledLocalTime: "12:30",
      scheduledTime,
      isAllDay: false,
    });
    expect(result).toMatchObject({
      startDate: "2026-05-16",
      scheduledTime: "2026-05-16T03:30:00.000Z",
      scheduledLocalTime: "12:30",
    });
    expect(fixture.todoReminder.scheduled).toEqual([
      { todoId: 1, scheduledTime, userId: fixture.userId },
    ]);
    expect(fixture.eventPublisher.publishedEvents.map(({ eventName }) => eventName)).toEqual([
      "planning.todo.rescheduled",
    ]);
  });
  it("종일 일정으로 변경하면 시간을 지우고 역전된 기간은 저장하지 않는다", async () => {
    // Given
    const input = {
      id: 1,
      userId: fixture.userId,
      timezone: "Asia/Seoul",
      schedule: {
        startDate: Temporal.PlainDate.from("2026-05-16"),
        endDate: null,
        scheduledTime: null,
        isAllDay: true,
      },
    };
    // When
    const result = await useCase.execute(input);
    const before = snapshotTodoRecord(fixture.records.get(1));
    // Then
    expect(result.scheduledTime).toBeNull();
    expect(fixture.todoReminder.cancelled).toEqual([1]);
    expect(fixture.eventPublisher.publishedEvents.map(({ eventName }) => eventName)).toEqual([
      "planning.todo.rescheduled",
    ]);
    await expect(
      useCase.execute({
        ...input,
        schedule: { ...input.schedule, endDate: Temporal.PlainDate.from("2026-05-15") },
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(fixture.records.get(1)).toEqual(before);
    await expect(useCase.execute({ ...input, id: 999 })).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_0801,
    });
  });
});
