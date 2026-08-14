/**
 * CreateTodoUseCase 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
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

import {
	DOMAIN_EVENT_PUBLISHER,
	type DomainEventPublisherPort,
	UNIT_OF_WORK,
} from "@/shared/application/ports";
import { DomainException } from "@/shared/domain";

import { Todo } from "../../../domain/entities/todo.aggregate";
import { TodoCreatedEvent } from "../../../domain/events/todo-created.event";
import { TodoId } from "../../../domain/value-objects/todo-id.vo";
import { TodoSchedule } from "../../../domain/value-objects/todo-schedule.vo";
import { TodoMapper } from "../../../infrastructure/persistence/todo-response.mapper";
import {
	CATEGORY_OWNERSHIP,
	type CategoryOwnershipPort,
} from "../../ports/category-ownership.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { TODO_REPOSITORY, type TodoRepositoryPort } from "../../ports/todo.repository.port";
import type { CreateTodoData } from "../../types";
import { CreateTodoUseCase } from "./create-todo.use-case";

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

describe("CreateTodoUseCase — 할 일 생성 핸들러", () => {
	let useCase: CreateTodoUseCase;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let categoryOwnership: Mocked<CategoryOwnershipPort>;
	let todoCache: Mocked<TodoCachePort>;
	let eventPublisher: Mocked<DomainEventPublisherPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(CreateTodoUseCase)
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
			.mock<DomainEventPublisherPort>(DOMAIN_EVENT_PUBLISHER)
			.impl(() => ({ publishAll: jest.fn().mockResolvedValue(undefined) }))
			.compile();

		useCase = unit;
		todoRepository = unitRef.get<TodoRepositoryPort>(TODO_REPOSITORY);
		todoReadRepository = unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
		categoryOwnership = unitRef.get<CategoryOwnershipPort>(CATEGORY_OWNERSHIP);
		todoCache = unitRef.get<TodoCachePort>(TODO_CACHE);
		eventPublisher = unitRef.get<DomainEventPublisherPort>(DOMAIN_EVENT_PUBLISHER);
	});

	it("카테고리 소유권 확인 후 할 일을 생성하고 캐시를 무효화한 뒤 응답을 반환한다", async () => {
		// Given - 한도 여유가 있는 상태
		todoRepository.countActiveByCategory.mockResolvedValue(0);
		todoRepository.getMaxSortOrder.mockResolvedValue(-1);
		todoRepository.create.mockResolvedValue(buildEntity());
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		const result = await useCase.execute(baseData);

		// Then - 생성 + 캐시 + TodoCreatedEvent 발행(리마인더는 이벤트 핸들러)
		expect(categoryOwnership.validateOwnership).toHaveBeenCalledWith(1, "user-123");
		expect(todoRepository.create).toHaveBeenCalledTimes(1);
		expect(todoCache.invalidateTodoCategories).toHaveBeenCalledWith("user-123");
		expect(todoCache.invalidateFriendTodos).toHaveBeenCalledWith("user-123");
		expect(eventPublisher.publishAll).toHaveBeenCalledWith([
			new TodoCreatedEvent(1, "user-123", null),
		]);
		expect(result.id).toBe(1);
	});

	it("카테고리 소유권 확인이 실패하면 예외를 전파하고 생성하지 않는다", async () => {
		// Given - 소유권 검증 실패
		categoryOwnership.validateOwnership.mockRejectedValue(new Error("not owner"));

		// When & Then
		await expect(useCase.execute(baseData)).rejects.toThrow("not owner");
		expect(todoRepository.create).not.toHaveBeenCalled();
		expect(eventPublisher.publishAll).not.toHaveBeenCalled();
	});

	it("post-commit 이벤트 발행 관측이 끝난 뒤 응답을 재조회한다", async () => {
		// Given - 이벤트 publisher 완료를 외부 gate로 지연
		todoRepository.countActiveByCategory.mockResolvedValue(0);
		todoRepository.getMaxSortOrder.mockResolvedValue(-1);
		todoRepository.create.mockResolvedValue(buildEntity());
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());
		let release: (() => void) | undefined;
		const publication = new Promise<void>((resolve) => {
			release = resolve;
		});
		eventPublisher.publishAll.mockReturnValue(publication);

		// When - 생성 실행
		const execution = useCase.execute(baseData);
		await new Promise((resolve) => setImmediate(resolve));

		// Then - publisher 완료 전에는 post-commit 재조회로 진행하지 않음
		expect(todoReadRepository.findByIdAndUserId).not.toHaveBeenCalled();
		release?.();
		await execution;
		expect(todoReadRepository.findByIdAndUserId).toHaveBeenCalled();
	});

	it("제목이 200자를 초과하면 소유권 확인 전에 DomainException(SYS_0002)을 던진다 (도메인 자기방어)", async () => {
		// Given - 201자 제목 (Zod 통과를 우회한 비정상 입력 가정)
		const data: CreateTodoData = { ...baseData, title: "가".repeat(201) };

		// When & Then - 어떤 포트도 호출되기 전에 거부된다
		const execution = useCase.execute(data);
		await expect(execution).rejects.toBeInstanceOf(DomainException);
		await expect(execution).rejects.toMatchObject({
			errorCode: ErrorCode.SYS_0002,
		});
		expect(categoryOwnership.validateOwnership).not.toHaveBeenCalled();
		expect(todoRepository.create).not.toHaveBeenCalled();
	});

	it("카테고리 활성 한도를 초과하면 ApplicationException(TODO_0811)을 던진다", async () => {
		// Given - 카테고리가 가득 참
		todoRepository.countActiveByCategory.mockResolvedValue(TODO_LIMITS.MAX_PER_CATEGORY);

		// When & Then
		await expect(useCase.execute(baseData)).rejects.toMatchObject({
			errorCode: ErrorCode.TODO_0811,
		});
		expect(todoRepository.create).not.toHaveBeenCalled();
	});

	it("인라인 하위 항목이 있으면 항목을 일괄 생성하고 응답을 재조회한다", async () => {
		// Given - items 포함 생성
		todoRepository.countActiveByCategory.mockResolvedValue(0);
		todoRepository.getMaxSortOrder.mockResolvedValue(-1);
		todoRepository.create.mockResolvedValue(buildEntity());
		todoReadRepository.findByIdAndUserId.mockResolvedValue(buildResponse());

		// When
		await useCase.execute({
			...baseData,
			items: [{ title: "하위1" }, { title: "하위2" }],
		});

		// Then - 인라인 항목 생성 + 응답 재조회
		expect(todoRepository.createInlineItems).toHaveBeenCalledWith(1, [
			{ title: "하위1" },
			{ title: "하위2" },
		]);
		expect(todoReadRepository.findByIdAndUserId).toHaveBeenCalledWith(1, "user-123");
	});
});
