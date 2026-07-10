import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/decorators";
import { TodoCategoryFacade } from "../application/facades/todo-category.facade";
import type { TodoCategoryWithCountView } from "../application/ports/todo-category.repository.port";
import { TodoCategory } from "../domain/entities/todo-category.entity";
import type {
	CreateTodoCategoryDto,
	ReorderTodoCategoryDto,
	UpdateTodoCategoryDto,
} from "./dtos";
import { TodoCategoryController } from "./todo-category.controller";

const user: CurrentUserPayload = {
	userId: "u1",
	email: "t@e.com",
	sessionId: "sid",
	role: "USER",
};

const aggregate = TodoCategory.reconstitute({
	id: 1,
	userId: "u1",
	name: "업무",
	color: "#FFB3B3",
	sortOrder: 0,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

const view: TodoCategoryWithCountView = {
	id: 1,
	userId: "u1",
	name: "업무",
	color: "#FFB3B3",
	sortOrder: 0,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
	todoCount: 3,
};

describe("TodoCategoryController", () => {
	let controller: TodoCategoryController;
	let facade: Mocked<TodoCategoryFacade>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			TodoCategoryController,
		).compile();
		controller = unit;
		facade = unitRef.get(TodoCategoryFacade);
	});

	it("getResourceLimit는 파사드 결과를 그대로 반환한다", async () => {
		facade.getResourceLimitInfo.mockResolvedValue({
			categoryCount: 3,
			maxCount: 10,
		});
		const result = await controller.getResourceLimit(user);
		expect(result).toEqual({ categoryCount: 3, maxCount: 10 });
	});

	it("create는 위임하고 메시지를 구성한다", async () => {
		facade.create.mockResolvedValue(aggregate);
		const dto = { name: "업무", color: "#FFB3B3" } as CreateTodoCategoryDto;

		const result = await controller.create(user, dto);

		expect(facade.create).toHaveBeenCalledWith({
			userId: "u1",
			name: "업무",
			color: "#FFB3B3",
		});
		expect(result.message).toBe("카테고리가 생성되었습니다.");
		expect(result.category.id).toBe(1);
	});

	it("findAll은 목록을 매핑한다", async () => {
		facade.findMany.mockResolvedValue([view]);
		const result = await controller.findAll(user);
		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.todoCount).toBe(3);
	});

	it("findOne은 todoCount 포함 상세를 반환한다", async () => {
		facade.findById.mockResolvedValue(view);
		const result = await controller.findOne(user, { id: 1 });
		expect(result.category.todoCount).toBe(3);
	});

	it("update는 위임하고 메시지를 구성한다", async () => {
		facade.update.mockResolvedValue(aggregate);
		const dto = { name: "업무" } as UpdateTodoCategoryDto;
		const result = await controller.update(user, { id: 1 }, dto);
		expect(facade.update).toHaveBeenCalledWith(1, "u1", dto);
		expect(result.message).toBe("카테고리가 수정되었습니다.");
	});

	it("reorder는 위임하고 메시지를 구성한다", async () => {
		facade.reorder.mockResolvedValue(aggregate);
		const dto = {
			targetCategoryId: 2,
			position: "before",
		} as ReorderTodoCategoryDto;

		const result = await controller.reorder(user, { id: 1 }, dto);

		expect(facade.reorder).toHaveBeenCalledWith({
			userId: "u1",
			categoryId: 1,
			targetCategoryId: 2,
			position: "before",
		});
		expect(result.message).toBe("카테고리 순서가 변경되었습니다.");
	});

	it("delete는 위임하고 메시지를 반환한다", async () => {
		facade.delete.mockResolvedValue(undefined);
		const result = await controller.delete(
			user,
			{ id: 1 },
			{
				moveToCategoryId: 2,
			},
		);
		expect(facade.delete).toHaveBeenCalledWith({
			userId: "u1",
			categoryId: 1,
			moveToCategoryId: 2,
		});
		expect(result.message).toBe("카테고리가 삭제되었습니다.");
	});
});
