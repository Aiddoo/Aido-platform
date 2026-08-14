/**
 * GetTodoResourceLimitUseCase 단위 테스트
 *
 * - 카테고리당 활성 Todo 상한(TODO_LIMITS.MAX_PER_CATEGORY, 전 구독 동일)과 현재 개수를 합성
 * - categoryId가 있으면 활성 개수까지 조회하고, 없으면 상한만 반환한다
 */
import { TODO_LIMITS } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createTodoReadRepositoryMock } from "@test/mocks/ports";

import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { GetTodoResourceLimitUseCase } from "./get-todo-resource-limit.use-case";

describe("GetTodoResourceLimitUseCase — 카테고리 활성 Todo 리소스 제한 조회", () => {
	let useCase: GetTodoResourceLimitUseCase;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetTodoResourceLimitUseCase)
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.compile();

		useCase = unit;
		todoReadRepository = unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
	});

	it("categoryId가 있으면 활성 개수를 조회해 상한과 함께 반환한다", async () => {
		// Given
		todoReadRepository.countActiveByCategory.mockResolvedValue(12);

		// When
		const result = await useCase.execute({ userId: "user-123", categoryId: 3 });

		// Then
		expect(todoReadRepository.countActiveByCategory).toHaveBeenCalledWith("user-123", 3);
		expect(result).toEqual({
			activeCount: 12,
			maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
		});
	});

	it("categoryId가 없으면 활성 개수를 조회하지 않고 상한만 반환한다", async () => {
		// When
		const result = await useCase.execute({ userId: "user-123" });

		// Then - activeCount는 생략(undefined)
		expect(todoReadRepository.countActiveByCategory).not.toHaveBeenCalled();
		expect(result).toEqual({ maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY });
		expect(result.activeCount).toBeUndefined();
	});

	it("categoryId가 0이면(falsy) 상한만 반환하는 경로를 탄다 (경계값)", async () => {
		// When
		const result = await useCase.execute({ userId: "user-123", categoryId: 0 });

		// Then
		expect(todoReadRepository.countActiveByCategory).not.toHaveBeenCalled();
		expect(result).toEqual({ maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY });
	});
});
