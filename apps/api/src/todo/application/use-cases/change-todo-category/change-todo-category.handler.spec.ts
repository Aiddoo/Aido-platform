/**
 * ChangeTodoCategoryHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 * 오라클: 레거시 TodoService.updateCategory 분기(활성/완료·한도·캐시) 재현
 */

import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { TODO_LIMITS } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";
import {
	createCategoryOwnershipMock,
	createTodoCacheMock,
	createTodoReadRepositoryMock,
	createTodoRepositoryMock,
	createUnitOfWorkMock,
} from "@test/mocks/ports";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import { Todo } from "../../../domain/entities/todo.entity";
import { TodoId } from "../../../domain/value-objects/todo-id.vo";
import { TodoSchedule } from "../../../domain/value-objects/todo-schedule.vo";
import { TodoMapper } from "../../../infrastructure/persistence/todo-response.mapper";
import {
	CATEGORY_OWNERSHIP,
	type CategoryOwnershipPort,
} from "../../ports/category-ownership.port";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { ChangeTodoCategoryCommand } from "./change-todo-category.command";
import { ChangeTodoCategoryHandler } from "./change-todo-category.handler";

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
	return TodoMapper.toResponse(
		TodoBuilder.create("user-123").withId(1).build(),
	);
}

describe("ChangeTodoCategoryHandler — 할 일 카테고리 변경 핸들러", () => {
	let handler: ChangeTodoCategoryHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let categoryOwnership: Mocked<CategoryOwnershipPort>;
	let todoCache: Mocked<TodoCachePort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(ChangeTodoCategoryHandler)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.mock<CategoryOwnershipPort>(CATEGORY_OWNERSHIP)
			.impl(() => createCategoryOwnershipMock())
			.mock<TodoCachePort>(TODO_CACHE)
			.impl(() => createTodoCacheMock())
			.compile();

		handler = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		todoReadRepository =
			unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
		categoryOwnership = unitRef.get<CategoryOwnershipPort>(CATEGORY_OWNERSHIP);
		todoCache = unitRef.get<TodoCachePort>(TODO_CACHE);
	});

	it("활성(미완료) 할 일은 TX 안에서 한도 체크 후 이동하고 캐시를 무효화한다", async () => {
		// Given - 한도 여유 있는 대상 카테고리
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		todoRepository.countActiveByCategory.mockResolvedValue(0);
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		const result = await handler.execute(
			new ChangeTodoCategoryCommand(1, "user-123", 2),
		);

		// Then - 소유권 확인 + TX 내 한도 체크 + 이동 + 캐시
		expect(categoryOwnership.validateOwnership).toHaveBeenCalledWith(
			2,
			"user-123",
		);
		expect(todoRepository.countActiveByCategory).toHaveBeenCalledWith(
			"user-123",
			2,
		);
		expect(todoRepository.updateCategory).toHaveBeenCalledWith(1, 2);
		expect(todoCache.invalidateTodoCategories).toHaveBeenCalledWith("user-123");
		expect(result.id).toBe(1);
	});

	it("대상 카테고리가 가득 차면 ApplicationException(TODO_0811)을 던진다", async () => {
		// Given - 한도 도달
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());
		todoRepository.countActiveByCategory.mockResolvedValue(
			TODO_LIMITS.MAX_PER_CATEGORY,
		);

		// When & Then
		await expect(
			handler.execute(new ChangeTodoCategoryCommand(1, "user-123", 2)),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0811 });
		expect(todoRepository.updateCategory).not.toHaveBeenCalled();
	});

	it("완료된 할 일은 한도 체크 없이 이동한다 (레거시 동작 보존)", async () => {
		// Given - 완료 상태
		todoRepository.findByIdAndUserId.mockResolvedValue(
			buildEntity({ completed: true }),
		);
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		await handler.execute(new ChangeTodoCategoryCommand(1, "user-123", 2));

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
			handler.execute(new ChangeTodoCategoryCommand(999, "user-123", 2)),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
		expect(todoRepository.updateCategory).not.toHaveBeenCalled();
	});
});
