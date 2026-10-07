import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { TodoBuilder } from "#test/builders/index";
import {
  createTodoReadRepositoryMock,
  createTodoRepositoryMock,
  createUnitOfWorkMock,
} from "#test/mocks/ports/index";

import { Todo } from "../../../domain/aggregates/todos/todo.aggregate.js";
import { TodoId } from "../../../domain/value-objects/todos/todo-id.vo.js";
import { TodoSchedule } from "../../../domain/value-objects/todos/todo-schedule.vo.js";
import { TodoMapper } from "../../../infrastructure/persistence/todos/todo-response.mapper.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";
import { ReorderTodo } from "./reorder-todo.use-case.js";

function buildEntity(id: number, sortOrder: number): Todo {
  return Todo.reconstitute({
    id: TodoId.create(id),
    userId: "user-123",
    title: `할 일 ${id}`,
    categoryId: 1,
    sortOrder,
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

describe("ReorderTodo — 할 일 순서 변경 핸들러", () => {
  let useCase: ReorderTodo;
  let todoRepository: Mocked<TodoRepositoryPort>;
  let todoReadRepository: Mocked<TodoReadRepositoryPort>;

  beforeEach(async () => {
    const reorderTodoDependencies = mockDeep<ConstructorParameters<typeof ReorderTodo>[0]>({
      todoRepository: createTodoRepositoryMock(),
      todoReadRepository: createTodoReadRepositoryMock(),
      unitOfWork: createUnitOfWorkMock(),
    });
    const unit = new ReorderTodo(reorderTodoDependencies);

    useCase = unit;
    todoRepository = reorderTodoDependencies.todoRepository;
    todoReadRepository = reorderTodoDependencies.todoReadRepository;
  });

  it("아래 방향 상대 이동(before): 사이 구간을 -1 시프트하고 보정된 위치로 이동한다", async () => {
    // Given - sortOrder 0의 할 일을 sortOrder 3 앞으로
    todoRepository.findByIdAndUserId
      .mockResolvedValueOnce(buildEntity(1, 0)) // 이동 대상
      .mockResolvedValueOnce(buildEntity(5, 3)); // 기준 할 일
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    await useCase.execute({
      id: 1,
      userId: "user-123",
      targetTodoId: 5,
      position: "before",
    });

    // Then - [1, 2] 구간 -1, 보정 위치 2
    expect(todoRepository.shiftSortOrders).toHaveBeenCalledWith("user-123", 1, 2, -1);
    expect(todoRepository.updateSortOrder).toHaveBeenCalledWith(1, 2);
  });

  it("위 방향 상대 이동(before): 사이 구간을 +1 시프트한다", async () => {
    // Given - sortOrder 5의 할 일을 sortOrder 2 앞으로
    todoRepository.findByIdAndUserId
      .mockResolvedValueOnce(buildEntity(1, 5))
      .mockResolvedValueOnce(buildEntity(3, 2));
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    await useCase.execute({
      id: 1,
      userId: "user-123",
      targetTodoId: 3,
      position: "before",
    });

    // Then - [2, 4] 구간 +1, 새 위치 2
    expect(todoRepository.shiftSortOrders).toHaveBeenCalledWith("user-123", 2, 4, 1);
    expect(todoRepository.updateSortOrder).toHaveBeenCalledWith(1, 2);
  });

  it("targetTodoId 없이 before면 맨 앞(0)으로 이동한다", async () => {
    // Given - sortOrder 4의 할 일
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity(1, 4));
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    await useCase.execute({
      id: 1,
      userId: "user-123",
      targetTodoId: undefined,
      position: "before",
    });

    // Then - [0, 3] 구간 +1, 새 위치 0
    expect(todoRepository.shiftSortOrders).toHaveBeenCalledWith("user-123", 0, 3, 1);
    expect(todoRepository.updateSortOrder).toHaveBeenCalledWith(1, 0);
  });

  it("targetTodoId 없이 after면 맨 뒤(maxSortOrder)로 이동한다", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity(1, 2));
    todoRepository.getMaxSortOrder.mockResolvedValue(7);
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    await useCase.execute({
      id: 1,
      userId: "user-123",
      targetTodoId: undefined,
      position: "after",
    });

    // Then - [3, null] 구간 -1, 새 위치 7
    expect(todoRepository.shiftSortOrders).toHaveBeenCalledWith("user-123", 3, null, -1);
    expect(todoRepository.updateSortOrder).toHaveBeenCalledWith(1, 7);
  });

  it("자기 자신을 기준으로 지정하면 쓰기 없이 현재 상태를 반환한다", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity(1, 0));
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    const result = await useCase.execute({
      id: 1,
      userId: "user-123",
      targetTodoId: 1,
      position: "before",
    });

    // Then
    expect(todoRepository.shiftSortOrders).not.toHaveBeenCalled();
    expect(todoRepository.updateSortOrder).not.toHaveBeenCalled();
    expect(result.id).toBe(1);
  });

  it("기준 할 일이 없으면 ApplicationException(TODO_0810)을 던진다", async () => {
    // Given - 기준 할 일 조회 실패
    todoRepository.findByIdAndUserId
      .mockResolvedValueOnce(buildEntity(1, 0))
      .mockResolvedValueOnce(null);

    // When & Then
    await expect(
      useCase.execute({
        id: 1,
        userId: "user-123",
        targetTodoId: 999,
        position: "before",
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0810 });
    expect(todoRepository.updateSortOrder).not.toHaveBeenCalled();
  });

  it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(
      useCase.execute({
        id: 999,
        userId: "user-123",
        targetTodoId: 1,
        position: "before",
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
  });
});
