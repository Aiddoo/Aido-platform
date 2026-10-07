import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS } from "@aido/api/vocabulary";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { type DomainEventPublisherPort } from "#api/shared/application/ports/index";
import { TodoBuilder } from "#test/builders/index";
import {
  createCategoryOwnershipMock,
  createTodoCacheMock,
  createTodoReadRepositoryMock,
  createTodoRepositoryMock,
  createUnitOfWorkMock,
} from "#test/mocks/ports/index";

import { Todo } from "../../../domain/aggregates/todos/todo.aggregate.js";
import { TodoCategoryChangedEvent } from "../../../domain/events/todos/todo-category-changed.event.js";
import { TodoId } from "../../../domain/value-objects/todos/todo-id.vo.js";
import { TodoSchedule } from "../../../domain/value-objects/todos/todo-schedule.vo.js";
import { TodoMapper } from "../../../infrastructure/persistence/todos/todo-response.mapper.js";
import { type CategoryOwnershipPort } from "../../ports/todos/category-ownership.port.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";
import { ChangeTodoCategory } from "./change-todo-category.use-case.js";

function buildEntity(overrides: { completed?: boolean } = {}): Todo {
  return Todo.reconstitute({
    id: TodoId.create(1),
    userId: "user-123",
    title: "할 일",
    categoryId: 1,
    sortOrder: 0,
    completed: overrides.completed ?? false,
    completedAt: overrides.completed ? new Date("2026-01-01") : null,
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

describe("ChangeTodoCategory — 할 일 카테고리 변경 핸들러", () => {
  let useCase: ChangeTodoCategory;
  let todoRepository: Mocked<TodoRepositoryPort>;
  let todoReadRepository: Mocked<TodoReadRepositoryPort>;
  let categoryOwnership: Mocked<CategoryOwnershipPort>;
  let todoCache: Mocked<TodoCachePort>;
  let eventPublisher: Mocked<DomainEventPublisherPort>;

  beforeEach(async () => {
    const changeTodoCategoryDependencies = mockDeep<
      ConstructorParameters<typeof ChangeTodoCategory>[0]
    >({
      todoRepository: createTodoRepositoryMock(),
      todoReadRepository: createTodoReadRepositoryMock(),
      unitOfWork: createUnitOfWorkMock(),
      categoryOwnership: createCategoryOwnershipMock(),
      todoCache: createTodoCacheMock(),
      eventPublisher: { publishAll: vi.fn().mockResolvedValue(undefined) },
    });
    const unit = new ChangeTodoCategory(changeTodoCategoryDependencies);

    useCase = unit;
    todoRepository = changeTodoCategoryDependencies.todoRepository;
    todoReadRepository = changeTodoCategoryDependencies.todoReadRepository;
    categoryOwnership = changeTodoCategoryDependencies.categoryOwnership;
    todoCache = changeTodoCategoryDependencies.todoCache;
    eventPublisher = changeTodoCategoryDependencies.eventPublisher;
  });

  it("활성(미완료) 할 일은 TX 안에서 한도 체크 후 이동하고 캐시를 무효화한다", async () => {
    // Given - 한도 여유 있는 대상 카테고리
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
    todoRepository.countActiveByCategory.mockResolvedValue(0);
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    const result = await useCase.execute({
      id: 1,
      userId: "user-123",
      categoryId: 2,
    });

    // Then - 소유권 확인 + TX 내 한도 체크 + 이동 + 캐시
    expect(categoryOwnership.validateOwnership).toHaveBeenCalledWith(2, "user-123");
    expect(todoRepository.countActiveByCategory).toHaveBeenCalledWith("user-123", 2);
    expect(todoRepository.updateCategory).toHaveBeenCalledWith(1, 2);
    expect(todoCache.invalidateTodoCategories).toHaveBeenCalledWith("user-123");
    expect(result.id).toBe(1);
  });

  it("카테고리 변경 후 TodoCategoryChangedEvent를 발행한다 (daily-completion 캐시 무효화 트리거)", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
    todoRepository.countActiveByCategory.mockResolvedValue(0);
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    await useCase.execute({ id: 1, userId: "user-123", categoryId: 2 });

    // Then - 커밋 후 카테고리 변경 이벤트 발행 (색상 집계 캐시 스테일 방지)
    expect(eventPublisher.publishAll).toHaveBeenCalledWith([
      new TodoCategoryChangedEvent(1, "user-123", 2),
    ]);
  });

  it("post-commit 이벤트 발행 관측이 끝난 뒤 캐시를 무효화한다", async () => {
    // Given - 이벤트 publisher 완료를 외부 gate로 지연
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
    todoRepository.countActiveByCategory.mockResolvedValue(0);
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());
    let release: (() => void) | undefined;
    const publication = new Promise<void>((resolve) => {
      release = resolve;
    });
    eventPublisher.publishAll.mockReturnValue(publication);

    // When - 카테고리 변경 실행
    const execution = useCase.execute({
      id: 1,
      userId: "user-123",
      categoryId: 2,
    });
    await new Promise((resolve) => setImmediate(resolve));

    // Then - publisher 완료 전에는 후속 캐시 작업으로 진행하지 않음
    expect(todoCache.invalidateTodoCategories).not.toHaveBeenCalled();
    release?.();
    await execution;
    expect(todoCache.invalidateTodoCategories).toHaveBeenCalledWith("user-123");
  });

  it("대상 카테고리가 가득 차면 ApplicationException(TODO_0811)을 던진다", async () => {
    // Given - 한도 도달
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
    todoRepository.countActiveByCategory.mockResolvedValue(TODO_LIMITS.MAX_PER_CATEGORY);

    // When & Then
    await expect(
      useCase.execute({ id: 1, userId: "user-123", categoryId: 2 }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0811 });
    expect(todoRepository.updateCategory).not.toHaveBeenCalled();
  });

  it("완료된 할 일은 한도 체크 없이 이동한다 (레거시 동작 보존)", async () => {
    // Given - 완료 상태
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity({ completed: true }));
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    await useCase.execute({ id: 1, userId: "user-123", categoryId: 2 });

    // Then - 카운트 조회 없이 바로 이동 + 캐시는 항상 무효화
    expect(todoRepository.countActiveByCategory).not.toHaveBeenCalled();
    expect(todoRepository.updateCategory).toHaveBeenCalledWith(1, 2);
    expect(todoCache.invalidateTodoCategories).toHaveBeenCalledWith("user-123");
  });

  it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then - 대상 카테고리 소유권 확인(선행) 후 로드 실패로 거부
    await expect(
      useCase.execute({ id: 999, userId: "user-123", categoryId: 2 }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(todoRepository.updateCategory).not.toHaveBeenCalled();
  });
});
