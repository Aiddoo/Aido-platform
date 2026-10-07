import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { TodoRescheduledEvent } from "../../../domain/events/todos/todo-rescheduled.event.js";
import { UpdateTodoSchedule } from "./update-todo-schedule.use-case.js";

describe("할 일 일정 수정", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: UpdateTodoSchedule;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new UpdateTodoSchedule(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("시간 일정을 저장하고 리마인더 이벤트에 동일한 시간을 전달한다", async () => {
    // Given
    const scheduledTime = new Date("2026-05-16T03:30:00Z");
    // When
    const result = await useCase.execute({
      id: 1,
      userId: fixture.userId,
      schedule: {
        startDate: new Date("2026-05-16T00:00:00Z"),
        endDate: null,
        scheduledTime,
        isAllDay: false,
      },
    });
    // Then
    expect(fixture.records.get(1)).toMatchObject({ scheduledTime, isAllDay: false });
    expect(result).toMatchObject({
      startDate: "2026-05-16",
      scheduledTime: "2026-05-16T03:30:00.000Z",
    });
    expect(fixture.eventPublisher.events).toEqual([
      new TodoRescheduledEvent(1, fixture.userId, scheduledTime),
    ]);
  });
  it("종일 일정으로 변경하면 시간을 지우고 역전된 기간은 저장하지 않는다", async () => {
    // Given
    const input = {
      id: 1,
      userId: fixture.userId,
      schedule: {
        startDate: new Date("2026-05-16T00:00:00Z"),
        endDate: null,
        scheduledTime: null,
        isAllDay: true,
      },
    };
    // When
    const result = await useCase.execute(input);
    const before = structuredClone(fixture.records.get(1));
    // Then
    expect(result.scheduledTime).toBeNull();
    expect(fixture.eventPublisher.events).toEqual([
      new TodoRescheduledEvent(1, fixture.userId, null),
    ]);
    await expect(
      useCase.execute({
        ...input,
        schedule: { ...input.schedule, endDate: new Date("2026-05-15T00:00:00Z") },
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(fixture.records.get(1)).toEqual(before);
    await expect(useCase.execute({ ...input, id: 999 })).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_0801,
    });
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
      schedule: { startDate: PLANNING_TIME, endDate: null, scheduledTime: null, isAllDay: true },
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
