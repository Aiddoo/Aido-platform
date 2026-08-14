/**
 * GetTodoByIdUseCase 단위 테스트
 *
 * - read model 저장소에서 (id, userId)로 단건 조회 후 그대로 반환
 * - 없으면 TODO_0801 (소유자 스코프 조회이므로 타인 소유 = 미존재와 동일)
 */
import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";
import { createTodoReadRepositoryMock } from "@test/mocks/ports";

import { TodoMapper } from "../../../infrastructure/persistence/todo-response.mapper";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { GetTodoByIdUseCase } from "./get-todo-by-id.use-case";

function buildResponse(id: number, userId = "user-123"): TodoResponse {
	return TodoMapper.toResponse(TodoBuilder.create(userId).withId(id).build());
}

describe("GetTodoByIdUseCase — 단일 Todo 조회", () => {
	let useCase: GetTodoByIdUseCase;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetTodoByIdUseCase)
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.compile();

		useCase = unit;
		todoReadRepository = unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
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
