import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { type DomainEventPublisherPort } from "#api/shared/application/ports/index";
import { TodoBuilder } from "#test/builders/index";
import {
  createTodoCacheMock,
  createTodoReadRepositoryMock,
  createTodoRepositoryMock,
  createUnitOfWorkMock,
} from "#test/mocks/ports/index";

import { Todo } from "../../../domain/aggregates/todos/todo.aggregate.js";
import { TodoVisibilityChangedEvent } from "../../../domain/events/todos/todo-visibility-changed.event.js";
import { TodoId } from "../../../domain/value-objects/todos/todo-id.vo.js";
import { TodoSchedule } from "../../../domain/value-objects/todos/todo-schedule.vo.js";
import { TodoMapper } from "../../../infrastructure/persistence/todos/todo-response.mapper.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";
import { UpdateTodoVisibility } from "./update-todo-visibility.use-case.js";

function buildEntity(): Todo {
  return Todo.reconstitute({
    id: TodoId.create(1),
    userId: "user-123",
    title: "할 일",
    categoryId: 1,
    sortOrder: 0,
    completed: false,
    completedAt: null,
    schedule: TodoSchedule.reconstitute({
      startDate: new Date("2026-02-22"),
      endDate: null,
      scheduledTime: null,
      isAllDay: true,
    }),
    visibility: "PUBLIC",
    recurrenceGroupId: null,
    items: [],
    createdAt: new Date("2026-02-20T00:00:00.000Z"),
    updatedAt: new Date("2026-02-20T00:00:00.000Z"),
  });
}

function buildResponse(): TodoResponse {
  return TodoMapper.toResponse(TodoBuilder.create("user-123").withId(1).build());
}

describe("UpdateTodoVisibility — 할 일 공개 범위 변경 핸들러", () => {
  let useCase: UpdateTodoVisibility;
  let todoRepository: Mocked<TodoRepositoryPort>;
  let todoReadRepository: Mocked<TodoReadRepositoryPort>;
  let todoCache: Mocked<TodoCachePort>;
  let eventPublisher: Mocked<DomainEventPublisherPort>;

  beforeEach(async () => {
    const updateTodoVisibilityDependencies = mockDeep<
      ConstructorParameters<typeof UpdateTodoVisibility>[0]
    >({
      todoRepository: createTodoRepositoryMock(),
      todoReadRepository: createTodoReadRepositoryMock(),
      unitOfWork: createUnitOfWorkMock(),
      todoCache: createTodoCacheMock(),
      eventPublisher: { publishAll: vi.fn().mockResolvedValue(undefined) },
    });
    const unit = new UpdateTodoVisibility(updateTodoVisibilityDependencies);

    useCase = unit;
    todoRepository = updateTodoVisibilityDependencies.todoRepository;
    todoReadRepository = updateTodoVisibilityDependencies.todoReadRepository;
    todoCache = updateTodoVisibilityDependencies.todoCache;
    eventPublisher = updateTodoVisibilityDependencies.eventPublisher;
  });

  it("공개 범위를 영속화하고 이벤트를 발행한 뒤 공개 캐시를 무효화한다", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    const result = await useCase.execute({
      id: 1,
      userId: "user-123",
      visibility: "PRIVATE",
    });

    // Then
    expect(todoRepository.updateVisibility).toHaveBeenCalledWith(1, "PRIVATE");
    expect(eventPublisher.publishAll).toHaveBeenCalledWith([
      new TodoVisibilityChangedEvent(1, "user-123"),
    ]);
    expect(todoCache.invalidateFriendTodos).toHaveBeenCalledWith("user-123");
    expect(result.id).toBe(1);
  });

  it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(
      useCase.execute({ id: 999, userId: "user-123", visibility: "PUBLIC" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(todoRepository.updateVisibility).not.toHaveBeenCalled();
    expect(eventPublisher.publishAll).not.toHaveBeenCalled();
  });

  it("재조회 응답이 없으면 ApplicationException(TODO_0801)을 던진다", async () => {
    // Given - 영속화는 성공했지만 재조회가 비어 있는 비정상 상태
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
    todoReadRepository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(
      useCase.execute({ id: 1, userId: "user-123", visibility: "PRIVATE" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
  });
});
