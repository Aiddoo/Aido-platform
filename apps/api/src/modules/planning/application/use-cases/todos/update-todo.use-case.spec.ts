import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
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
import { TodoUpdatedEvent } from "../../../domain/events/todos/todo-updated.event.js";
import { TodoId } from "../../../domain/value-objects/todos/todo-id.vo.js";
import { TodoSchedule } from "../../../domain/value-objects/todos/todo-schedule.vo.js";
import { TodoMapper } from "../../../infrastructure/persistence/todos/todo-response.mapper.js";
import { type CategoryOwnershipPort } from "../../ports/todos/category-ownership.port.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";
import { UpdateTodo } from "./update-todo.use-case.js";

/** 소유권 확인용 애그리게잇 */
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

/** 재조회 시 반환할 응답 read model */
function buildResponse(): TodoResponse {
  return TodoMapper.toResponse(TodoBuilder.create("user-123").withId(1).withTitle("할 일").build());
}

describe("UpdateTodo — 할 일 부분 수정 핸들러", () => {
  let useCase: UpdateTodo;
  let todoRepository: Mocked<TodoRepositoryPort>;
  let todoReadRepository: Mocked<TodoReadRepositoryPort>;
  let categoryOwnership: Mocked<CategoryOwnershipPort>;
  let todoCache: Mocked<TodoCachePort>;
  let eventPublisher: Mocked<DomainEventPublisherPort>;

  beforeEach(async () => {
    const updateTodoDependencies = mockDeep<ConstructorParameters<typeof UpdateTodo>[0]>({
      todoRepository: createTodoRepositoryMock(),
      todoReadRepository: createTodoReadRepositoryMock(),
      unitOfWork: createUnitOfWorkMock(),
      categoryOwnership: createCategoryOwnershipMock(),
      todoCache: createTodoCacheMock(),
      eventPublisher: { publishAll: vi.fn().mockResolvedValue(undefined) },
    });
    const unit = new UpdateTodo(updateTodoDependencies);

    useCase = unit;
    todoRepository = updateTodoDependencies.todoRepository;
    todoReadRepository = updateTodoDependencies.todoReadRepository;
    categoryOwnership = updateTodoDependencies.categoryOwnership;
    todoCache = updateTodoDependencies.todoCache;
    eventPublisher = updateTodoDependencies.eventPublisher;
  });

  it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(
      useCase.execute({ id: 999, userId: "user-123", data: { title: "x" } }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(todoRepository.updateDetails).not.toHaveBeenCalled();
  });

  it("제목만 수정하면 패치를 영속화하고 응답을 재조회한다", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    const result = await useCase.execute({
      id: 1,
      userId: "user-123",
      data: { title: "새 제목" },
    });

    // Then - completedAt 미포함 패치 + 캐시/소유권 확인 없음
    expect(todoRepository.updateDetails).toHaveBeenCalledWith(1, {
      title: "새 제목",
    });
    expect(categoryOwnership.validateOwnership).not.toHaveBeenCalled();
    expect(todoCache.invalidateTodoCategories).not.toHaveBeenCalled();
    expect(result.id).toBe(1);
  });

  it("미완료→완료 전이 시 completedAt을 패치에 포함하고 TodoUpdatedEvent를 발행한다", async () => {
    // Given - 미완료 할 일
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity({ completed: false }));
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    await useCase.execute({
      id: 1,
      userId: "user-123",
      data: { completed: true },
    });

    // Then - 전이 패치 + 저장 후 이벤트 발행(이벤트 핸들러가 리마인더 취소)
    expect(todoRepository.updateDetails).toHaveBeenCalledWith(1, {
      completed: true,
      completedAt: expect.any(Date),
    });
    expect(eventPublisher.publishAll).toHaveBeenCalledWith([
      new TodoUpdatedEvent(1, "user-123", true),
    ]);
  });

  it("post-commit 이벤트 발행 관측이 끝난 뒤 응답을 재조회한다", async () => {
    // Given - 이벤트 publisher 완료를 외부 gate로 지연
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());
    let release: (() => void) | undefined;
    const publication = new Promise<void>((resolve) => {
      release = resolve;
    });
    eventPublisher.publishAll.mockReturnValue(publication);

    // When - 수정 실행
    const execution = useCase.execute({
      id: 1,
      userId: "user-123",
      data: { completed: true },
    });
    await new Promise((resolve) => setImmediate(resolve));

    // Then - publisher 완료 전에는 post-commit 재조회로 진행하지 않음
    expect(todoReadRepository.findByIdAndUserId).not.toHaveBeenCalled();
    release?.();
    await execution;
    expect(todoReadRepository.findByIdAndUserId).toHaveBeenCalled();
  });

  it("완료→미완료 전이 시 completedAt=null을 패치에 포함한다", async () => {
    // Given - 완료 상태 할 일
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity({ completed: true }));
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    await useCase.execute({
      id: 1,
      userId: "user-123",
      data: { completed: false },
    });

    // Then
    expect(todoRepository.updateDetails).toHaveBeenCalledWith(1, {
      completed: false,
      completedAt: null,
    });
  });

  it("같은 완료 상태로 재요청하면 completedAt을 패치에 포함하지 않는다 (레거시 동작 보존)", async () => {
    // Given - 이미 완료된 할 일에 completed=true 재요청
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity({ completed: true }));
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    await useCase.execute({
      id: 1,
      userId: "user-123",
      data: { completed: true },
    });

    // Then - completedAt 없이 completed만
    expect(todoRepository.updateDetails).toHaveBeenCalledWith(1, {
      completed: true,
    });
  });

  it("카테고리 변경 시 소유권을 확인하고 캐시를 무효화한다 (활성 한도 재체크는 없음)", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    await useCase.execute({
      id: 1,
      userId: "user-123",
      data: { categoryId: 2 },
    });

    // Then - 소유권 확인 + 캐시 무효화, 한도 카운트 조회는 없음 (레거시 동작 보존)
    expect(categoryOwnership.validateOwnership).toHaveBeenCalledWith(2, "user-123");
    expect(todoCache.invalidateTodoCategories).toHaveBeenCalledWith("user-123");
    expect(todoRepository.countActiveByCategory).not.toHaveBeenCalled();
  });

  it("대상 카테고리 소유권 확인에 실패하면 패치를 영속화하지 않는다", async () => {
    // Given - 소유권 검증 실패
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
    categoryOwnership.validateOwnership.mockRejectedValue(new Error("not owner"));

    // When & Then
    await expect(
      useCase.execute({ id: 1, userId: "user-123", data: { categoryId: 9 } }),
    ).rejects.toThrow("not owner");
    expect(todoRepository.updateDetails).not.toHaveBeenCalled();
  });
});
