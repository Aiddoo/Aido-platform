import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/presentation/decorators";
import type { TodoCategoryWithCountView } from "../application/ports/todo-category.repository.port";
import { TodoCategoryReader } from "../application/services/todo-category.reader";
import { CreateTodoCategoryUseCase } from "../application/use-cases/create-todo-category/create-todo-category.use-case";
import { DeleteTodoCategoryUseCase } from "../application/use-cases/delete-todo-category/delete-todo-category.use-case";
import { ReorderTodoCategoryUseCase } from "../application/use-cases/reorder-todo-category/reorder-todo-category.use-case";
import { UpdateTodoCategoryUseCase } from "../application/use-cases/update-todo-category/update-todo-category.use-case";
import { TodoCategory } from "../domain/entities/todo-category.aggregate";
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
	let reader: Mocked<TodoCategoryReader>;
	let createUseCase: Mocked<CreateTodoCategoryUseCase>;
	let updateUseCase: Mocked<UpdateTodoCategoryUseCase>;
	let reorderUseCase: Mocked<ReorderTodoCategoryUseCase>;
	let deleteUseCase: Mocked<DeleteTodoCategoryUseCase>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			TodoCategoryController,
		).compile();
		controller = unit;
		reader = unitRef.get(TodoCategoryReader);
		createUseCase = unitRef.get(CreateTodoCategoryUseCase);
		updateUseCase = unitRef.get(UpdateTodoCategoryUseCase);
		reorderUseCase = unitRef.get(ReorderTodoCategoryUseCase);
		deleteUseCase = unitRef.get(DeleteTodoCategoryUseCase);
	});

	it("getResourceLimit는 reader 결과를 그대로 반환한다", async () => {
		reader.getResourceLimitInfo.mockResolvedValue({
			categoryCount: 3,
			maxCount: 10,
		});
		const result = await controller.getResourceLimit(user);
		expect(result).toEqual({ categoryCount: 3, maxCount: 10 });
	});

	it("create는 위임하고 메시지를 구성한다", async () => {
		createUseCase.execute.mockResolvedValue(aggregate);
		const dto = { name: "업무", color: "#FFB3B3" } as CreateTodoCategoryDto;

		const result = await controller.create(user, dto);

		expect(createUseCase.execute).toHaveBeenCalledWith({
			userId: "u1",
			name: "업무",
			color: "#FFB3B3",
		});
		expect(result.message).toBe("카테고리가 생성되었습니다.");
		expect(result.category.id).toBe(1);
	});

	it("findAll은 목록을 매핑한다", async () => {
		reader.findMany.mockResolvedValue([view]);
		const result = await controller.findAll(user);
		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.todoCount).toBe(3);
	});

	it("findOne은 todoCount 포함 상세를 반환한다", async () => {
		reader.findById.mockResolvedValue(view);
		const result = await controller.findOne(user, { id: 1 });
		expect(result.category.todoCount).toBe(3);
	});

	it("update는 위임하고 메시지를 구성한다", async () => {
		updateUseCase.execute.mockResolvedValue(aggregate);
		const dto = { name: "업무" } as UpdateTodoCategoryDto;
		const result = await controller.update(user, { id: 1 }, dto);
		expect(updateUseCase.execute).toHaveBeenCalledWith(1, "u1", dto);
		expect(result.message).toBe("카테고리가 수정되었습니다.");
	});

	it("reorder는 위임하고 메시지를 구성한다", async () => {
		reorderUseCase.execute.mockResolvedValue(aggregate);
		const dto = {
			targetCategoryId: 2,
			position: "before",
		} as ReorderTodoCategoryDto;

		const result = await controller.reorder(user, { id: 1 }, dto);

		expect(reorderUseCase.execute).toHaveBeenCalledWith({
			userId: "u1",
			categoryId: 1,
			targetCategoryId: 2,
			position: "before",
		});
		expect(result.message).toBe("카테고리 순서가 변경되었습니다.");
	});

	it("delete는 위임하고 메시지를 반환한다", async () => {
		deleteUseCase.execute.mockResolvedValue(undefined);
		const result = await controller.delete(
			user,
			{ id: 1 },
			{
				moveToCategoryId: 2,
			},
		);
		expect(deleteUseCase.execute).toHaveBeenCalledWith({
			userId: "u1",
			categoryId: 1,
			moveToCategoryId: 2,
		});
		expect(result.message).toBe("카테고리가 삭제되었습니다.");
	});
});
