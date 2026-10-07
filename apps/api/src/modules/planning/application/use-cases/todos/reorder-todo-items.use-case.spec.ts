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
import { TodoItem } from "../../../domain/entities/todos/todo-item.entity.js";
import { TodoId } from "../../../domain/value-objects/todos/todo-id.vo.js";
import { TodoSchedule } from "../../../domain/value-objects/todos/todo-schedule.vo.js";
import { TodoMapper } from "../../../infrastructure/persistence/todos/todo-response.mapper.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";
import { ReorderTodoItems } from "./reorder-todo-items.use-case.js";

function buildItem(id: number): TodoItem {
  return TodoItem.reconstitute({
    id,
    title: `항목 ${id}`,
    completed: false,
    sortOrder: id - 1,
    createdAt: new Date("2026-02-20T00:00:00.000Z"),
    updatedAt: new Date("2026-02-20T00:00:00.000Z"),
  });
}

function buildEntity(items: TodoItem[]): Todo {
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
    items,
    createdAt: new Date("2026-02-20T00:00:00.000Z"),
    updatedAt: new Date("2026-02-20T00:00:00.000Z"),
  });
}

function buildResponse(): TodoResponse {
  return TodoMapper.toResponse(TodoBuilder.create("user-123").withId(1).build());
}

describe("ReorderTodoItems — 하위 항목 순서 변경 핸들러", () => {
  let useCase: ReorderTodoItems;
  let todoRepository: Mocked<TodoRepositoryPort>;
  let todoReadRepository: Mocked<TodoReadRepositoryPort>;

  beforeEach(async () => {
    const reorderTodoItemsDependencies = mockDeep<
      ConstructorParameters<typeof ReorderTodoItems>[0]
    >({
      todoRepository: createTodoRepositoryMock(),
      todoReadRepository: createTodoReadRepositoryMock(),
      unitOfWork: createUnitOfWorkMock(),
    });
    const unit = new ReorderTodoItems(reorderTodoItemsDependencies);

    useCase = unit;
    todoRepository = reorderTodoItemsDependencies.todoRepository;
    todoReadRepository = reorderTodoItemsDependencies.todoReadRepository;
  });

  it("전체 항목 ID를 새 순서로 전달하면 일괄 재정렬한다", async () => {
    // Given - 항목 3개 보유
    todoRepository.findByIdAndUserId.mockResolvedValue(
      buildEntity([buildItem(1), buildItem(2), buildItem(3)]),
    );
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When - 항목 3을 맨 앞으로
    const result = await useCase.execute({
      todoId: 1,
      userId: "user-123",
      itemIds: [3, 1, 2],
    });

    // Then
    expect(todoRepository.reorderItems).toHaveBeenCalledWith([3, 1, 2]);
    expect(result.id).toBe(1);
  });

  it("일부 ID만 전달하면 ApplicationException(SYS_0002)을 던진다", async () => {
    // Given - 항목 3개인데 2개만 전달
    todoRepository.findByIdAndUserId.mockResolvedValue(
      buildEntity([buildItem(1), buildItem(2), buildItem(3)]),
    );

    // When & Then
    await expect(
      useCase.execute({ todoId: 1, userId: "user-123", itemIds: [3, 1] }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(todoRepository.reorderItems).not.toHaveBeenCalled();
  });

  it("다른 투두의 항목 ID가 섞이면 ApplicationException(TODO_0822)을 던진다", async () => {
    // Given - 항목 [1,2] 보유인데 999 포함
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity([buildItem(1), buildItem(2)]));

    // When & Then
    await expect(
      useCase.execute({ todoId: 1, userId: "user-123", itemIds: [999, 1] }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0822 });
    expect(todoRepository.reorderItems).not.toHaveBeenCalled();
  });

  it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(
      useCase.execute({ todoId: 999, userId: "user-123", itemIds: [1] }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
  });
});
