/**
 * CreateRecurringTodosHandler 단위 테스트
 *
 * Suites + 포트 mock 팩토리 + GWT 패턴
 * 오라클: 레거시 TodoService.createRecurring 분기(0개·MAX 초과·한도·이벤트) 재현
 */

import { ErrorCode } from "@aido/errors";
import { TODO_LIMITS } from "@aido/validators";
import { EventBus } from "@nestjs/cqrs";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	createCategoryOwnershipMock,
	createTodoCacheMock,
	createTodoReadRepositoryMock,
	createTodoRepositoryMock,
	createUnitOfWorkMock,
} from "@test/mocks/ports";
import { UNIT_OF_WORK } from "@/common/database";
import { Todo } from "../../../domain/entities/todo.entity";
import { TodoCreatedEvent } from "../../../domain/events/todo-created.event";
import { TodoId } from "../../../domain/value-objects/todo-id.vo";
import { TodoSchedule } from "../../../domain/value-objects/todo-schedule.vo";
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
import type { CreateRecurringTodoData } from "../../types";
import { CreateRecurringTodosCommand } from "./create-recurring-todos.command";
import { CreateRecurringTodosHandler } from "./create-recurring-todos.handler";

function buildEntity(id: number, scheduledTime: Date | null = null): Todo {
	return Todo.reconstitute({
		id: TodoId.create(id),
		userId: "user-123",
		title: "반복 할 일",
		categoryId: 1,
		sortOrder: id,
		completed: false,
		completedAt: null,
		schedule: TodoSchedule.reconstitute({
			startDate: new Date("2026-03-02"),
			endDate: null,
			scheduledTime,
			isAllDay: scheduledTime === null,
		}),
		visibility: "PUBLIC",
		recurrenceGroupId: "group-1",
		items: [],
		createdAt: new Date("2026-02-20T00:00:00.000Z"),
		updatedAt: new Date("2026-02-20T00:00:00.000Z"),
	});
}

/** 2026-03-02(월) ~ 2026-03-08(일), 월/수/금 → 3개 */
const baseData: CreateRecurringTodoData = {
	userId: "user-123",
	title: "반복 할 일",
	categoryId: 1,
	startDate: "2026-03-02",
	endDate: "2026-03-08",
	daysOfWeek: ["MON", "WED", "FRI"],
};

describe("CreateRecurringTodosHandler — 반복 할 일 일괄 생성 핸들러", () => {
	let handler: CreateRecurringTodosHandler;
	let todoRepository: Mocked<TodoRepositoryPort>;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let categoryOwnership: Mocked<CategoryOwnershipPort>;
	let todoCache: Mocked<TodoCachePort>;
	let eventBus: Mocked<EventBus>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			CreateRecurringTodosHandler,
		)
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
		eventBus = unitRef.get(EventBus);
	});

	it("요일 매칭 날짜만큼 일괄 생성하고 인스턴스별 TodoCreatedEvent를 발행한 뒤 캐시를 무효화한다", async () => {
		// Given - 3개 생성 (월/수/금)
		const created = [buildEntity(1), buildEntity(2), buildEntity(3)];
		todoRepository.countActiveByCategory.mockResolvedValue(0);
		todoRepository.getMaxSortOrder.mockResolvedValue(-1);
		todoRepository.createMany.mockResolvedValue(created);
		todoReadRepository.findManyByRecurrenceGroupId.mockResolvedValue([]);

		// When
		const result = await handler.execute(
			new CreateRecurringTodosCommand(baseData, "Asia/Seoul"),
		);

		// Then - 3개 인스턴스, sortOrder는 max+1부터 연속
		expect(categoryOwnership.validateOwnership).toHaveBeenCalledWith(
			1,
			"user-123",
		);
		const [items, groupId] = todoRepository.createMany.mock.calls[0] ?? [];
		expect(items).toHaveLength(3);
		expect(items?.[0]).toMatchObject({ sortOrder: 0, title: "반복 할 일" });
		expect(items?.[2]).toMatchObject({ sortOrder: 2 });
		expect(typeof groupId).toBe("string");
		expect(todoCache.invalidateTodoCategories).toHaveBeenCalledWith("user-123");
		expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
		expect(eventBus.publishAll).toHaveBeenCalledWith([
			new TodoCreatedEvent(1, "user-123", null),
			new TodoCreatedEvent(2, "user-123", null),
			new TodoCreatedEvent(3, "user-123", null),
		]);
		expect(result.count).toBe(3);
	});

	it("매칭 날짜가 없으면 ApplicationException(SYS_0002)을 던진다", async () => {
		// Given - 월요일 하루 범위인데 일요일만 선택
		const data: CreateRecurringTodoData = {
			...baseData,
			startDate: "2026-03-02",
			endDate: "2026-03-02",
			daysOfWeek: ["SUN"],
		};

		// When & Then
		await expect(
			handler.execute(new CreateRecurringTodosCommand(data, "UTC")),
		).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
		expect(categoryOwnership.validateOwnership).not.toHaveBeenCalled();
	});

	it("인스턴스 수가 최대치를 초과하면 ApplicationException(TODO_0812)을 던진다", async () => {
		// Given - 매일 3년치 → MAX_INSTANCES 초과
		const data: CreateRecurringTodoData = {
			...baseData,
			startDate: "2026-01-01",
			endDate: "2028-12-31",
			daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
		};

		// When & Then
		await expect(
			handler.execute(new CreateRecurringTodosCommand(data, "UTC")),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0812 });
	});

	it("생성 시 카테고리 활성 한도를 넘으면 ApplicationException(TODO_0813)을 던진다", async () => {
		// Given - 여유 2개뿐인데 3개 생성 시도
		todoRepository.countActiveByCategory.mockResolvedValue(
			TODO_LIMITS.MAX_PER_CATEGORY - 2,
		);

		// When & Then
		await expect(
			handler.execute(new CreateRecurringTodosCommand(baseData, "UTC")),
		).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0813 });
		expect(todoRepository.createMany).not.toHaveBeenCalled();
	});

	it("scheduledTime이 있으면 인스턴스별 날짜 기준으로 UTC 변환해 전달한다", async () => {
		// Given
		todoRepository.countActiveByCategory.mockResolvedValue(0);
		todoRepository.getMaxSortOrder.mockResolvedValue(-1);
		todoRepository.createMany.mockResolvedValue([buildEntity(1)]);
		todoReadRepository.findManyByRecurrenceGroupId.mockResolvedValue([]);

		// When - KST 09:00 지정
		await handler.execute(
			new CreateRecurringTodosCommand(
				{
					...baseData,
					endDate: "2026-03-02",
					daysOfWeek: ["MON"],
					scheduledTime: "09:00",
				},
				"Asia/Seoul",
			),
		);

		// Then - KST 09:00 = UTC 00:00
		const [items] = todoRepository.createMany.mock.calls[0] ?? [];
		expect(items?.[0]?.scheduledTime).toEqual(
			new Date("2026-03-02T00:00:00.000Z"),
		);
	});
});
