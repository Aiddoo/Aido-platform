import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { type DomainEventPublisherPort } from "#api/shared/application/ports/index";
import { TodoBuilder } from "#test/builders/index";
import {
  createTodoReadRepositoryMock,
  createTodoRepositoryMock,
  createUnitOfWorkMock,
} from "#test/mocks/ports/index";

import { Todo } from "../../../domain/aggregates/todos/todo.aggregate.js";
import { TodoUpdatedEvent } from "../../../domain/events/todos/todo-updated.event.js";
import { TodoId } from "../../../domain/value-objects/todos/todo-id.vo.js";
import { TodoSchedule } from "../../../domain/value-objects/todos/todo-schedule.vo.js";
import { TodoMapper } from "../../../infrastructure/persistence/todos/todo-response.mapper.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";
import { UpdateTodoTitle } from "./update-todo-title.use-case.js";

function buildEntity(): Todo {
  return Todo.reconstitute({
    id: TodoId.create(1),
    userId: "user-123",
    title: "이전 제목",
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
  return TodoMapper.toResponse(
    TodoBuilder.create("user-123").withId(1).withTitle("새 제목").build(),
  );
}

describe("UpdateTodoTitle — 할 일 제목 수정 핸들러", () => {
  let useCase: UpdateTodoTitle;
  let todoRepository: Mocked<TodoRepositoryPort>;
  let todoReadRepository: Mocked<TodoReadRepositoryPort>;
  let eventPublisher: Mocked<DomainEventPublisherPort>;

  beforeEach(async () => {
    const updateTodoTitleDependencies = mockDeep<ConstructorParameters<typeof UpdateTodoTitle>[0]>({
      todoRepository: createTodoRepositoryMock(),
      todoReadRepository: createTodoReadRepositoryMock(),
      unitOfWork: createUnitOfWorkMock(),
      eventPublisher: { publishAll: vi.fn().mockResolvedValue(undefined) },
    });
    const unit = new UpdateTodoTitle(updateTodoTitleDependencies);

    useCase = unit;
    todoRepository = updateTodoTitleDependencies.todoRepository;
    todoReadRepository = updateTodoTitleDependencies.todoReadRepository;
    eventPublisher = updateTodoTitleDependencies.eventPublisher;
  });

  it("애그리게잇 상태로 제목을 영속화하고 TodoUpdatedEvent를 발행한 뒤 응답을 재조회한다", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
    todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

    // When
    const result = await useCase.execute({
      id: 1,
      userId: "user-123",
      title: "새 제목",
    });

    // Then - 영속화 + 이벤트(전이 후 완료 상태 사실 → completed=false)
    expect(todoRepository.updateTitle).toHaveBeenCalledWith(1, "새 제목");
    expect(eventPublisher.publishAll).toHaveBeenCalledWith([
      new TodoUpdatedEvent(1, "user-123", false),
    ]);
    expect(result.title).toBe("새 제목");
  });

  it("제목이 200자를 초과하면 DomainException(SYS_0002)을 던지고 영속화하지 않는다 (도메인 자기방어)", async () => {
    // Given - 201자 제목 (Zod 통과를 우회한 비정상 입력 가정)
    todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());

    // When & Then
    await expect(
      useCase.execute({ id: 1, userId: "user-123", title: "가".repeat(201) }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(todoRepository.updateTitle).not.toHaveBeenCalled();
    expect(eventPublisher.publishAll).not.toHaveBeenCalled();
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

    // When - 제목 변경 실행
    const execution = useCase.execute({
      id: 1,
      userId: "user-123",
      title: "새 제목",
    });
    await new Promise((resolve) => setImmediate(resolve));

    // Then - publisher 완료 전에는 post-commit 재조회로 진행하지 않음
    expect(todoReadRepository.findByIdAndUserId).not.toHaveBeenCalled();
    release?.();
    await execution;
    expect(todoReadRepository.findByIdAndUserId).toHaveBeenCalled();
  });

  it("존재하지 않는 할 일이면 ApplicationException(TODO_0801)을 던진다", async () => {
    // Given
    todoRepository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(
      useCase.execute({ id: 999, userId: "user-123", title: "제목" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(todoRepository.updateTitle).not.toHaveBeenCalled();
  });

  it("다른 사용자의 할 일이면 조회되지 않아 TODO_0801을 던진다 (사용자 격리)", async () => {
    // Given - 소유권 불일치는 findByIdAndUserId가 null 반환으로 표현
    todoRepository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(
      useCase.execute({ id: 1, userId: "other-user", title: "제목" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
  });
});
