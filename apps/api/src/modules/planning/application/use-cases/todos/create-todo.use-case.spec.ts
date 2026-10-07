import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS } from "@aido/api/vocabulary";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { TodoCreatedEvent } from "../../../domain/events/todos/todo-created.event.js";
import { CreateTodo } from "./create-todo.use-case.js";

describe("할 일 생성", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: CreateTodo;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new CreateTodo(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("인라인 항목과 기본값을 저장하고 생성 이벤트와 새 응답을 반환한다", async () => {
    // Given
    fixture.records.clear();
    fixture.todoCache.categoryUsers.add(fixture.userId);
    // When
    const result = await useCase.execute({
      userId: fixture.userId,
      title: "새 할 일",
      categoryId: 1,
      startDate: new Date("2026-05-16T00:00:00Z"),
      items: [{ title: "첫 항목" }, { title: "둘째 항목" }],
    });
    // Then
    expect(fixture.records.get(result.id)).toMatchObject({
      title: "새 할 일",
      categoryId: 1,
      sortOrder: 0,
      completed: false,
      visibility: "PUBLIC",
    });
    expect(result).toMatchObject({
      title: "새 할 일",
      startDate: "2026-05-16",
      content: null,
      itemStats: { total: 2, completed: 0 },
    });
    expect(result.items.map((item) => item.title)).toEqual(["첫 항목", "둘째 항목"]);
    expect(fixture.eventPublisher.events).toEqual([
      new TodoCreatedEvent(result.id, fixture.userId, null),
    ]);
    expect(fixture.todoCache.categoryUsers.has(fixture.userId)).toBe(false);
  });
  it("다른 소유자의 카테고리와 잘못된 제목을 거부하고 저장 상태를 보존한다", async () => {
    // Given
    fixture.categoryOwners.set(1, "other-user");
    const before = structuredClone([...fixture.records.values()]);
    const input = {
      userId: fixture.userId,
      title: "새 할 일",
      categoryId: 1,
      startDate: PLANNING_TIME,
    };
    // When / Then
    await expect(useCase.execute(input)).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_CATEGORY_0851,
    });
    await expect(useCase.execute({ ...input, title: "가".repeat(201) })).rejects.toMatchObject({
      errorCode: ErrorCode.SYS_0002,
    });
    expect([...fixture.records.values()]).toEqual(before);
    expect(fixture.eventPublisher.events).toEqual([]);
  });
  it("활성 한도가 찬 카테고리는 생성을 거부한다", async () => {
    // Given
    for (let id = 2; id <= TODO_LIMITS.MAX_PER_CATEGORY; id++)
      fixture.records.set(id, createPlanningTodo(fixture.userId, id));
    // When / Then
    await expect(
      useCase.execute({
        userId: fixture.userId,
        title: "초과 할 일",
        categoryId: 1,
        startDate: PLANNING_TIME,
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0811 });
    expect(fixture.records.size).toBe(TODO_LIMITS.MAX_PER_CATEGORY);
  });
  it("이벤트 발행이 끝날 때까지 응답 조회를 기다린다", async () => {
    // Given
    fixture.records.clear();
    const entered = Promise.withResolvers<void>();
    const publication = Promise.withResolvers<void>();
    fixture.eventPublisher.publishAll = async () => {
      entered.resolve();
      await publication.promise;
    };
    const responseRead = vi.spyOn(fixture.todoReadRepository, "findByIdAndUserId");
    // When
    const execution = useCase.execute({
      userId: fixture.userId,
      title: "새 할 일",
      categoryId: 1,
      startDate: PLANNING_TIME,
    });
    try {
      await Promise.race([entered.promise, execution]);
      // Then
      expect(fixture.records.size).toBe(1);
      expect(responseRead).not.toHaveBeenCalled();
    } finally {
      publication.resolve();
      await execution;
    }
    expect(responseRead).toHaveBeenCalledOnce();
  });
});
