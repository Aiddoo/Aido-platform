/**
 * CreateTodoHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 */

import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { TODO_LIMITS } from "@aido/validators";
import { EventPublisher } from "@nestjs/cqrs";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";
import {
	createCategoryOwnershipMock,
	createTodoCacheMock,
	createTodoReadRepositoryMock,
	createTodoRepositoryMock,
	createTransactionManagerMock,
} from "@test/mocks/ports";
import { TRANSACTION_MANAGER } from "@/common/database";
import { Todo } from "../../../domain/entities/todo.entity";
import { TodoId } from "../../../domain/value-objects/todo-id.vo";
import { TodoMapper } from "../../../todo.mapper";
import type { CreateTodoData } from "../../../types/todo.types";
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
import { CreateTodoCommand } from "./create-todo.command";
import { CreateTodoHandler } from "./create-todo.handler";

/** 생성 결과 애그리게잇 */
function buildEntity(): Todo {
	return Todo.reconstitute({
		id: TodoId.create(1),
		userId: "user-123",
		title: "새 할 일",
		categoryId: 1,
		sortOrder: 0,
		completed: false,
		completedAt: null,
		startDate: new Date("2026-02-22"),
		endDate: null,
		scheduledTime: null,
		isAllDay: true,
		visibility: "PUBLIC",
		recurrenceGroupId: null,
		items: [],
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
	});
}

/** 재조회 시 반환할 응답 read model */
function buildResponse(): TodoResponse {
	return TodoMapper.toResponse(
		TodoBuilder.create("user-123").withId(1).withTitle("새 할 일").build(),
	);
}

const baseData: CreateTodoData = {
	userId: "user-123",
	title: "새 할 일",
	categoryId: 1,
	startDate: new Date("2026-02-22"),
};

describe("CreateTodoHandler — 할 일 생성 핸들러", () => {
	let handler: CreateTodoHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let categoryOwnership: Mocked<CategoryOwnershipPort>;
	let todoCache: Mocked<TodoCachePort>;
	let eventPublisher: Mocked<EventPublisher>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(CreateTodoHandler)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.mock(TRANSACTION_MANAGER)
			.impl(() => createTransactionManagerMock())
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
		eventPublisher = unitRef.get(EventPublisher);
		eventPublisher.mergeObjectContext.mockImplementation(
			(aggregate) => aggregate,
		);
	});

	it("카테고리 소유권 확인 후 할 일을 생성하고 캐시를 무효화한 뒤 응답을 반환한다", async () => {
		// Given - 한도 여유가 있는 상태
		todoRepository.countActiveByCategory.mockResolvedValue(0);
		todoRepository.getMaxSortOrder.mockResolvedValue(-1);
		todoRepository.create.mockResolvedValue(buildEntity());
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		const result = await handler.execute(new CreateTodoCommand(baseData));

		// Then
		expect(categoryOwnership.validateOwnership).toHaveBeenCalledWith(
			1,
			"user-123",
		);
		expect(todoRepository.create).toHaveBeenCalledTimes(1);
		expect(todoCache.invalidateTodoCategories).toHaveBeenCalledWith("user-123");
		expect(result.id).toBe(1);
	});

	it("카테고리 활성 한도를 초과하면 ApplicationException(TODO_0811)을 던진다", async () => {
		// Given - 카테고리가 가득 참
		todoRepository.countActiveByCategory.mockResolvedValue(
			TODO_LIMITS.MAX_PER_CATEGORY,
		);

		// When & Then
		await expect(
			handler.execute(new CreateTodoCommand(baseData)),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0811 });
		expect(todoRepository.create).not.toHaveBeenCalled();
	});

	it("인라인 하위 항목이 있으면 항목을 일괄 생성하고 응답을 재조회한다", async () => {
		// Given - items 포함 생성
		todoRepository.countActiveByCategory.mockResolvedValue(0);
		todoRepository.getMaxSortOrder.mockResolvedValue(-1);
		todoRepository.create.mockResolvedValue(buildEntity());
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		await handler.execute(
			new CreateTodoCommand({
				...baseData,
				items: [{ title: "하위1" }, { title: "하위2" }],
			}),
		);

		// Then - 인라인 항목 생성 + 응답 재조회
		expect(todoRepository.createInlineItems).toHaveBeenCalledWith(
			1,
			[{ title: "하위1" }, { title: "하위2" }],
			expect.anything(),
		);
		expect(todoReadRepository.findByIdAndUserId).toHaveBeenCalledWith(
			1,
			"user-123",
		);
	});
});
