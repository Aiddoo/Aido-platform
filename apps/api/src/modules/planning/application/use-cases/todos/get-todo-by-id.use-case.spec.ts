import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { TodoBuilder } from "#test/builders/index";
import { createTodoReadRepositoryMock } from "#test/mocks/ports/index";

import { TodoMapper } from "../../../infrastructure/persistence/todos/todo-response.mapper.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { GetTodoById } from "./get-todo-by-id.use-case.js";

function buildResponse(id: number, userId = "user-123"): TodoResponse {
  return TodoMapper.toResponse(TodoBuilder.create(userId).withId(id).build());
}

describe("GetTodoById — 단일 Todo 조회", () => {
  let useCase: GetTodoById;
  let todoReadRepository: Mocked<TodoReadRepositoryPort>;

  beforeEach(async () => {
    const getTodoByIdDependencies = mockDeep<ConstructorParameters<typeof GetTodoById>[0]>({
      todoReadRepository: createTodoReadRepositoryMock(),
    });
    const unit = new GetTodoById(getTodoByIdDependencies);

    useCase = unit;
    todoReadRepository = getTodoByIdDependencies.todoReadRepository;
  });

  it("소유자 스코프로 조회한 read model을 그대로 반환한다", async () => {
    // Given
    const todo = buildResponse(42);
    todoReadRepository.findByIdAndUserId.mockResolvedValue(todo);

    // When
    const result = await useCase.execute({ id: 42, userId: "user-123" });

    // Then - id·userId를 그대로 저장소에 위임하고 결과를 손대지 않는다
    expect(todoReadRepository.findByIdAndUserId).toHaveBeenCalledWith(42, "user-123");
    expect(result).toBe(todo);
  });

  it("조회 결과가 없으면 TODO_0801을 던지고 todoId를 컨텍스트에 담는다", async () => {
    // Given - 미존재(또는 타인 소유)
    todoReadRepository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(useCase.execute({ id: 999, userId: "user-123" })).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_0801,
    });
  });
});
