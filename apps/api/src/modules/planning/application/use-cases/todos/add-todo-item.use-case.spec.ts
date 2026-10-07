import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS } from "@aido/api/vocabulary";
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
import { AddTodoItem } from "./add-todo-item.use-case.js";

function buildItem(id: number, sortOrder: number): TodoItem {
  return TodoItem.reconstitute({
    id,
    title: `항목 ${id}`,
    completed: false,
    sortOrder,
    createdAt: new Date("2026-02-20T00:00:00.000Z"),
    updatedAt: new Date("2026-02-20T00:00:00.000Z"),
  });
}

function buildEntity(items: TodoItem[] = []): Todo {
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

describe("AddTodoItem — 하위 항목 추가 핸들러", () => {
  let useCase: AddTodoItem;
  let todoRepository: Mocked<TodoRepositoryPort>;
  let todoReadRepository: Mocked<TodoReadRepositoryPort>;

  beforeEach(async () => {
    const addTodoItemDependencies = mockDeep<ConstructorParameters<typeof AddTodoItem>[0]>({
      todoRepository: createTodoRepositoryMock(),
      todoReadRepository: createTodoReadRepositoryMock(),
      unitOfWork: createUnitOfWorkMock(),
    });
    const unit = new AddTodoItem(addTodoItemDependencies);

    useCase = unit;
    todoRepository = addTodoItemDependencies.todoRepository;
    todoReadRepository = addTodoItemDependencies.todoReadRepository;
  });

  it("한도 여유가 있으면 맨 뒤 sortOrder로 항목을 생성하고 부모를 재조회한다", async () => {
    // Given - 항목 2개(sortOrder 0, 1) 보유
    todoRepository.findByIdAndUserId.mockResolvedValue(
      buildEntity([buildItem(10, 0), buildItem(11, 1)]),
    );
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    const result = await useCase.execute({
      todoId: 1,
      userId: "user-123",
      title: "항목C",
    });

    // Then - 애그리게잇 계획(max+1)대로 영속화
    expect(todoRepository.createItem).toHaveBeenCalledWith(1, {
      title: "항목C",
      sortOrder: 2,
    });
    expect(result.id).toBe(1);
  });

  it("항목 한도를 초과하면 DomainException(TODO_0821)을 던진다", async () => {
    // Given - 한도 도달 (애그리게잇이 보유 항목 수로 판단)
    const fullItems = Array.from({ length: TODO_ITEM_LIMITS.MAX_PER_TODO }, (_, index) =>
      buildItem(index + 1, index),
    );
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity(fullItems));

    // When & Then
    await expect(
      useCase.execute({ todoId: 1, userId: "user-123", title: "초과 항목" }),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_0821,
      details: {
        currentCount: TODO_ITEM_LIMITS.MAX_PER_TODO,
        maxPerTodo: TODO_ITEM_LIMITS.MAX_PER_TODO,
      },
    });
    expect(todoRepository.createItem).not.toHaveBeenCalled();
  });

  it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(
      useCase.execute({ todoId: 999, userId: "user-123", title: "항목" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(todoRepository.createItem).not.toHaveBeenCalled();
  });
});
