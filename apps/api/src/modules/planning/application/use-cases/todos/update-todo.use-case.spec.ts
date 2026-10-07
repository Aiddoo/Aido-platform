import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS } from "@aido/api/vocabulary";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { TodoUpdatedEvent } from "../../../domain/events/todos/todo-updated.event.js";
import { UpdateTodo } from "./update-todo.use-case.js";

describe("할 일 부분 수정", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: UpdateTodo;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new UpdateTodo(fixture);
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
  it("명시한 null은 시간을 지우고 생략한 endDate와 false 값은 보존한다", async () => {
    // Given
    const saved = fixture.records.get(1);
    if (saved === undefined) throw new Error("Todo fixture missing");
    saved.scheduledTime = new Date("2026-05-15T00:00:00Z");
    saved.endDate = new Date("2026-05-16T00:00:00Z");
    // When
    const result = await useCase.execute({
      id: 1,
      userId: fixture.userId,
      timezone: "UTC",
      data: { scheduledTime: null, isAllDay: false },
    });
    // Then
    expect(result).toMatchObject({
      scheduledTime: null,
      endDate: "2026-05-16",
      isAllDay: false,
      completed: false,
    });
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
    expect(fixture.eventPublisher.events.every((event) => event instanceof TodoUpdatedEvent)).toBe(
      true,
    );
  });
  it("일반 PATCH는 카테고리 소유권만 확인하고 전용 이동의 활성 한도를 적용하지 않는다", async () => {
    // Given
    fixture.categories.set(2, { id: 2, name: "대상", color: "#123456", sortOrder: 1 });
    fixture.categoryOwners.set(2, fixture.userId);
    fixture.todoCache.categoryUsers.add(fixture.userId);
    for (let id = 2; id <= TODO_LIMITS.MAX_PER_CATEGORY + 1; id++)
      fixture.records.set(id, { ...createPlanningTodo(fixture.userId, id), categoryId: 2 });
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
      data: { title: "새 제목" },
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
