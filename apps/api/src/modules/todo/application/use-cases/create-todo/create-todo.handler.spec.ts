/**
 * CreateTodoHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 */

import { ErrorCode } from "@aido/errors";
import { TODO_LIMITS } from "@aido/validators";
import { EventPublisher } from "@nestjs/cqrs";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	createTodoRepositoryMock,
	createTransactionManagerMock,
} from "@test/mocks/ports";
import { CacheService } from "@/common/cache/cache.service";
import { TRANSACTION_MANAGER } from "@/common/database";
import { TodoCategoryService } from "../../../../todo-category/todo-category.service";
import { Todo } from "../../../domain/entities/todo.entity";
import type { CreateTodoData } from "../../../types/todo.types";
import type { TodoRepositoryPort } from "../../ports/todo.repository.port";
import { TODO_REPOSITORY } from "../../ports/todo.repository.port";
import { CreateTodoCommand } from "./create-todo.command";
import { CreateTodoHandler } from "./create-todo.handler";

function buildEntity(): Todo {
	return Todo.reconstitute({
		id: 1,
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
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
		category: { id: 1, name: "일반", color: "#FFFFFF", sortOrder: 0 },
		items: [],
	});
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
	let todoCategoryService: Mocked<TodoCategoryService>;
	let cacheService: Mocked<CacheService>;
	let eventPublisher: Mocked<EventPublisher>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(CreateTodoHandler)
			.mock<TodoRepositoryPort>(TODO_REPOSITORY)
			.impl(() => createTodoRepositoryMock())
			.mock(TRANSACTION_MANAGER)
			.impl(() => createTransactionManagerMock())
			.compile();

		handler = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		todoCategoryService = unitRef.get(TodoCategoryService);
		cacheService = unitRef.get(CacheService);
		eventPublisher = unitRef.get(EventPublisher);
		(eventPublisher.mergeObjectContext as jest.Mock).mockImplementation(
			(aggregate) => aggregate,
		);
	});

	it("카테고리 소유권 확인 후 할 일을 생성하고 캐시를 무효화한다", async () => {
		// Given - 한도 여유가 있는 상태
		todoRepository.countActiveByCategory.mockResolvedValue(0);
		todoRepository.getMaxSortOrder.mockResolvedValue(-1);
		todoRepository.create.mockResolvedValue(buildEntity());

		// When
		const result = await handler.execute(new CreateTodoCommand(baseData));

		// Then
		expect(todoCategoryService.validateOwnership).toHaveBeenCalledWith(
			1,
			"user-123",
		);
		expect(todoRepository.create).toHaveBeenCalledTimes(1);
		expect(cacheService.invalidateTodoCategories).toHaveBeenCalledWith(
			"user-123",
		);
		expect(result.getId()).toBe(1);
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

	it("인라인 하위 항목이 있으면 생성 후 재조회하여 반환한다", async () => {
		// Given - items 포함 생성
		todoRepository.countActiveByCategory.mockResolvedValue(0);
		todoRepository.getMaxSortOrder.mockResolvedValue(-1);
		todoRepository.create.mockResolvedValue(buildEntity());
		todoRepository.findByIdAndUserId.mockResolvedValue(buildEntity());

		// When
		await handler.execute(
			new CreateTodoCommand({
				...baseData,
				items: [{ title: "하위1" }, { title: "하위2" }],
			}),
		);

		// Then - 인라인 항목 생성 + 재조회
		expect(todoRepository.createInlineItems).toHaveBeenCalledWith(
			1,
			[{ title: "하위1" }, { title: "하위2" }],
			expect.anything(),
		);
		expect(todoRepository.findByIdAndUserId).toHaveBeenCalled();
	});
});
