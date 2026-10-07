import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { TodoDeletedEvent } from "../../../domain/events/todos/todo-deleted.event.js";
import { DeleteTodo } from "./delete-todo.use-case.js";

describe("할 일 삭제", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: DeleteTodo;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new DeleteTodo(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("저장된 할 일을 제거하고 삭제 이벤트와 캐시 무효화를 반영한다", async () => {
    // Given
    fixture.todoCache.categoryUsers.add(fixture.userId);
    // When
    await useCase.execute({ id: 1, userId: fixture.userId });
    // Then
    expect(fixture.records.has(1)).toBe(false);
    expect(fixture.eventPublisher.events[0]).toBeInstanceOf(TodoDeletedEvent);
    expect(fixture.todoCache.categoryUsers.has(fixture.userId)).toBe(false);
    await expect(useCase.execute({ id: 1, userId: fixture.userId })).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_0801,
    });
    expect(fixture.eventPublisher.events).toHaveLength(1);
  });
  it("다른 사용자 요청은 저장된 할 일을 제거하지 않는다", async () => {
    // Given
    const before = structuredClone(fixture.records.get(1));
    // When / Then
    await expect(useCase.execute({ id: 1, userId: "other-user" })).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_0801,
    });
    expect(fixture.records.get(1)).toEqual(before);
    expect(fixture.eventPublisher.events).toEqual([]);
  });

  it("삭제 이벤트 발행이 끝난 뒤 카테고리 캐시를 무효화한다", async () => {
    // Given
    fixture.todoCache.categoryUsers.add(fixture.userId);
    const entered = Promise.withResolvers<void>();
    const publication = Promise.withResolvers<void>();
    fixture.eventPublisher.publishAll = async () => {
      entered.resolve();
      await publication.promise;
    };
    // When
    const execution = useCase.execute({ id: 1, userId: fixture.userId });
    try {
      await Promise.race([entered.promise, execution]);
      // Then
      expect(fixture.records.has(1)).toBe(false);
      expect(fixture.todoCache.categoryUsers.has(fixture.userId)).toBe(true);
    } finally {
      publication.resolve();
      await execution;
    }
    expect(fixture.todoCache.categoryUsers.has(fixture.userId)).toBe(false);
  });
});
