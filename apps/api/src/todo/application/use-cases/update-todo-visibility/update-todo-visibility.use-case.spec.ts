/**
 * UpdateTodoVisibilityUseCase 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 */
import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TestBed } from "@suites/unit";
import { vi } from "vitest";
import type { Mocked } from "vitest";

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisherPort,
  UNIT_OF_WORK,
} from "#api/shared/application/ports/index";
import { TodoBuilder } from "#test/builders/index";
import {
  createTodoCacheMock,
  createTodoReadRepositoryMock,
  createTodoRepositoryMock,
  createUnitOfWorkMock,
} from "#test/mocks/ports/index";

import { Todo } from "../../../domain/entities/todo.aggregate.js";
import { TodoVisibilityChangedEvent } from "../../../domain/events/todo-visibility-changed.event.js";
import { TodoId } from "../../../domain/value-objects/todo-id.vo.js";
import { TodoSchedule } from "../../../domain/value-objects/todo-schedule.vo.js";
import { TodoMapper } from "../../../infrastructure/persistence/todo-response.mapper.js";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port.js";
import {
  TODO_READ_REPOSITORY,
  type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port.js";
import { TODO_REPOSITORY, type TodoRepositoryPort } from "../../ports/todo.repository.port.js";
import { UpdateTodoVisibilityUseCase } from "./update-todo-visibility.use-case.js";

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

describe("UpdateTodoVisibilityUseCase — 할 일 공개 범위 변경 핸들러", () => {
  let useCase: UpdateTodoVisibilityUseCase;
  let todoRepository: Mocked<TodoRepositoryPort>;
  let todoReadRepository: Mocked<TodoReadRepositoryPort>;
  let todoCache: Mocked<TodoCachePort>;
  let eventPublisher: Mocked<DomainEventPublisherPort>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(UpdateTodoVisibilityUseCase)
      .mock<TodoRepositoryPort>(TODO_REPOSITORY)
      .impl(() => createTodoRepositoryMock())
      .mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
      .impl(() => createTodoReadRepositoryMock())
      .mock(UNIT_OF_WORK)
      .impl(() => createUnitOfWorkMock())
      .mock<TodoCachePort>(TODO_CACHE)
      .impl(() => createTodoCacheMock())
      .mock<DomainEventPublisherPort>(DOMAIN_EVENT_PUBLISHER)
      .impl(() => ({ publishAll: vi.fn().mockResolvedValue(undefined) }))
      .compile();

    useCase = unit;
    todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
    todoReadRepository = unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
    todoCache = unitRef.get<TodoCachePort>(TODO_CACHE);
    eventPublisher = unitRef.get<DomainEventPublisherPort>(DOMAIN_EVENT_PUBLISHER);
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
