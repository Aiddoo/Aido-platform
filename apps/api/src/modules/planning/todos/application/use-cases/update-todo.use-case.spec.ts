import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS } from "@aido/api/vocabulary";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning/planning-todos.fixture";

import { UpdateTodoUseCase } from "./update-todo.use-case.js";

describe("할 일 부분 수정", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: UpdateTodoUseCase;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new UpdateTodoUseCase(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("제목만 수정하면 nullable 일정과 완료 상태를 보존한다", async () => {
    // Given
    const before = structuredClone(fixture.records.get(1));
    // When
    const result = await useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "Asia/Seoul",
      data: { title: "수정된 제목" },
    });
    // Then
    expect(fixture.records.get(1)).toEqual({ ...before, title: "수정된 제목" });
    expect(result).toMatchObject({
      title: "수정된 제목",
      startDate: "2026-05-15",
      endDate: null,
      scheduledTime: null,
      completed: false,
    });
  });
  it("날짜만 옮기면 벽시계를 새 날짜의 순간으로 다시 만들고 알림 재예약 이벤트를 낸다", async () => {
    // Given
    await useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "Asia/Seoul",
      data: { scheduledTime: "10:00" },
    });
    fixture.todoReminder.scheduled.length = 0;
    // When
    const result = await useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "America/New_York",
      data: { startDate: new Date("2026-05-20T00:00:00Z") },
    });
    // Then
    const instant = new Date("2026-05-20T14:00:00.000Z");
    expect(result).toMatchObject({ startDate: "2026-05-20", scheduledLocalTime: "10:00" });
    expect(fixture.records.get(1)).toMatchObject({ scheduledTime: instant, isAllDay: false });
    expect(fixture.todoReminder.scheduled).toContainEqual({
      todoId: 1,
      scheduledTime: instant,
      userId: fixture.userId,
    });
  });
  it("PATCH로 완료를 되돌리면 순간은 그대로 두고 지금 순간으로 알림을 다시 잡는다", async () => {
    // Given
    await useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "Asia/Seoul",
      data: { scheduledTime: "10:00", completed: true },
    });
    fixture.todoReminder.scheduled.length = 0;
    // When
    await useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "America/New_York",
      data: { completed: false },
    });
    // Then
    const instant = new Date("2026-05-15T01:00:00.000Z");
    expect(fixture.records.get(1)).toMatchObject({
      scheduledLocalTime: "10:00",
      scheduledTime: instant,
    });
    expect(fixture.todoReminder.scheduled).toContainEqual({
      todoId: 1,
      scheduledTime: instant,
      userId: fixture.userId,
    });
  });
  it("시간만 수정하면 저장된 날짜와 사용자 timezone으로 변환한다", async () => {
    // Given / When
    const result = await useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "Asia/Seoul",
      data: { scheduledTime: "12:30" },
    });
    // Then
    expect(result).toMatchObject({
      startDate: "2026-05-15",
      scheduledTime: "2026-05-15T03:30:00.000Z",
    });
    expect(fixture.records.get(1)?.scheduledTime).toEqual(new Date("2026-05-15T03:30:00Z"));
  });
  it("시간을 바꾸면 리마인더를 다시 잡도록 재예약 이벤트를 낸다", async () => {
    // When
    await useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "Asia/Seoul",
      data: { scheduledTime: "12:30" },
    });
    // Then
    expect(fixture.todoReminder.scheduled).toContainEqual({
      todoId: 1,
      scheduledTime: new Date("2026-05-15T03:30:00.000Z"),
      userId: fixture.userId,
    });
  });

  it("시각이 그대로면 재예약 이벤트를 내지 않는다", async () => {
    // When
    await useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "Asia/Seoul",
      data: { title: "제목만" },
    });
    // Then
    expect(fixture.todoReminder.scheduled).toEqual([]);
    expect(fixture.eventPublisher.publishedEvents.map(({ eventName }) => eventName)).not.toContain(
      "planning.todo.rescheduled",
    );
  });

  it("명시한 null은 시간을 지워 종일로 맞추고 생략한 endDate와 false 값은 보존한다", async () => {
    // Given
    const saved = fixture.records.get(1);
    if (saved == null) {
      throw new Error("Todo fixture missing");
    }
    saved.scheduledTime = new Date("2026-05-15T00:00:00Z");
    saved.endDate = new Date("2026-05-16T00:00:00Z");
    // When
    const result = await useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "UTC",
      data: { scheduledTime: null, isAllDay: false, completed: false },
    });
    // Then
    expect(result).toMatchObject({
      scheduledTime: null,
      endDate: "2026-05-16",
      isAllDay: true,
      completed: false,
    });
  });
  it("시간만 보내도 종일을 함께 풀어 저장한다", async () => {
    // Given
    const input = {
      id: 1,
      userId: fixture.userId,
      timezone: "UTC",
      data: { scheduledTime: "09:00" },
    };
    // When
    const result = await useCase.execute(input);
    // Then
    expect(result).toMatchObject({ isAllDay: false, scheduledTime: expect.any(String) });
    expect(fixture.records.get(1)?.isAllDay).toBe(false);
  });
  it("완료 상태가 바뀔 때만 completedAt을 바꾼다", async () => {
    // Given
    const input = { id: 1, userId: fixture.userId, timezone: "UTC", data: { completed: true } };
    // When
    const completed = await useCase.execute(input);
    vi.setSystemTime(new Date("2026-05-15T04:00:00Z"));
    const repeated = await useCase.execute(input);
    const uncompleted = await useCase.execute({ ...input, data: { completed: false } });
    // Then
    expect(completed.completedAt).toBe(PLANNING_TIME.toISOString());
    expect(repeated.completedAt).toBe(PLANNING_TIME.toISOString());
    expect(uncompleted).toMatchObject({ completed: false, completedAt: null });
    expect(
      new Set(fixture.eventPublisher.publishedEvents.map(({ eventName }) => eventName)),
    ).toEqual(new Set(["planning.todo.updated"]));
  });
  it("일반 PATCH는 카테고리 소유권만 확인하고 전용 이동의 활성 한도를 적용하지 않는다", async () => {
    // Given
    fixture.categories.set(2, { id: 2, name: "대상", color: "#123456", sortOrder: 1 });
    fixture.categoryOwners.set(2, fixture.userId);
    fixture.todoCache.categoryUsers.add(fixture.userId);
    for (let id = 2; id <= TODO_LIMITS.MAX_PER_CATEGORY + 1; id++) {
      fixture.records.set(id, { ...createPlanningTodo(fixture.userId, id), categoryId: 2 });
    }
    // When
    const result = await useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "UTC",
      data: { categoryId: 2 },
    });
    // Then
    expect(result.category.id).toBe(2);
    expect(fixture.todoCache.categoryUsers.has(fixture.userId)).toBe(false);
  });
  it("소유권과 기간 검증이 실패하면 저장 상태를 보존한다", async () => {
    // Given
    const before = structuredClone(fixture.records.get(1));
    fixture.categoryOwners.set(1, "other-user");
    // When / Then
    await expect(
      useCase.execute({
        id: 1,
        userId: fixture.userId,
        timezone: "UTC",
        data: { categoryId: 1, title: "변경" },
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0851 });
    await expect(
      useCase.execute({
        id: 1,
        userId: fixture.userId,
        timezone: "UTC",
        data: { endDate: new Date("2026-05-14T00:00:00Z") },
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    await expect(
      useCase.execute({
        id: 999,
        userId: fixture.userId,
        timezone: "UTC",
        data: { title: "변경" },
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(fixture.records.get(1)).toEqual(before);
  });
});
