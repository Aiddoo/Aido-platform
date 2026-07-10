import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { UNIT_OF_WORK } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { TodoCategory } from "../../../domain/entities/todo-category.entity";
import {
	TODO_CATEGORY_REPOSITORY,
	type TodoCategoryRepositoryPort,
} from "../../ports/todo-category.repository.port";
import {
	TODO_CATEGORY_CACHE,
	type TodoCategoryCachePort,
} from "../../ports/todo-category-cache.port";
import { ReorderTodoCategoryUseCase } from "./reorder-todo-category.use-case";

const cat = (id: number, sortOrder: number) =>
	TodoCategory.reconstitute({
		id,
		userId: "u1",
		name: "c",
		color: "#FFB3B3",
		sortOrder,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

describe("ReorderTodoCategoryUseCase", () => {
	let useCase: ReorderTodoCategoryUseCase;
	let repo: Mocked<TodoCategoryRepositoryPort>;
	let cache: Mocked<TodoCategoryCachePort>;
	let uow: Mocked<{ run: (fn: () => unknown) => unknown }>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			ReorderTodoCategoryUseCase,
		).compile();
		useCase = unit;
		repo = unitRef.get(TODO_CATEGORY_REPOSITORY);
		cache = unitRef.get(TODO_CATEGORY_CACHE);
		uow = unitRef.get(UNIT_OF_WORK);

		uow.run.mockImplementation((fn: () => unknown) => fn());
	});

	it("존재하지 않으면 TODO_CATEGORY_0851", async () => {
		repo.findByIdAndUserId.mockResolvedValue(null);
		await expect(
			useCase.execute({ userId: "u1", categoryId: 9, position: "before" }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("자기 자신 대상이면 no-op(업데이트 없음)", async () => {
		repo.findByIdAndUserId.mockResolvedValue(cat(1, 0));
		const result = await useCase.execute({
			userId: "u1",
			categoryId: 1,
			targetCategoryId: 1,
			position: "before",
		});
		expect(result.id).toBe(1);
		expect(repo.update).not.toHaveBeenCalled();
	});

	it("특정 카테고리 기준 재배치: 시프트 + 갱신 + 캐시 무효화", async () => {
		repo.findByIdAndUserId
			.mockResolvedValueOnce(cat(3, 2))
			.mockResolvedValueOnce(cat(1, 0));
		repo.shiftSortOrders.mockResolvedValue(2);
		repo.update.mockResolvedValue(cat(3, 0));

		const result = await useCase.execute({
			userId: "u1",
			categoryId: 3,
			targetCategoryId: 1,
			position: "before",
		});

		expect(repo.shiftSortOrders).toHaveBeenCalledWith("u1", 0, 1, 1);
		expect(repo.update).toHaveBeenCalledWith(3, { sortOrder: 0 });
		expect(result.sortOrder).toBe(0);
		expect(cache.invalidate).toHaveBeenCalledWith("u1");
	});

	it("맨 뒤로 이동: getMaxSortOrder 사용", async () => {
		repo.findByIdAndUserId.mockResolvedValue(cat(1, 0));
		repo.getMaxSortOrder.mockResolvedValue(2);
		repo.shiftSortOrders.mockResolvedValue(2);
		repo.update.mockResolvedValue(cat(1, 2));

		const result = await useCase.execute({
			userId: "u1",
			categoryId: 1,
			position: "after",
		});

		expect(repo.shiftSortOrders).toHaveBeenCalledWith("u1", 1, null, -1);
		expect(repo.update).toHaveBeenCalledWith(1, { sortOrder: 2 });
		expect(result.sortOrder).toBe(2);
	});
});
