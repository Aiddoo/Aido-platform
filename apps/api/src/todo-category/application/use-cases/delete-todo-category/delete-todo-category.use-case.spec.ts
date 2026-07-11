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
import { DeleteTodoCategoryUseCase } from "./delete-todo-category.use-case";

const category = (id = 1, userId = "u1") =>
	TodoCategory.reconstitute({
		id,
		userId,
		name: "c",
		color: "#FFB3B3",
		sortOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

describe("DeleteTodoCategoryUseCase", () => {
	let useCase: DeleteTodoCategoryUseCase;
	let repo: Mocked<TodoCategoryRepositoryPort>;
	let cache: Mocked<TodoCategoryCachePort>;
	let uow: Mocked<{ run: (fn: () => unknown) => unknown }>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			DeleteTodoCategoryUseCase,
		).compile();
		useCase = unit;
		repo = unitRef.get(TODO_CATEGORY_REPOSITORY);
		cache = unitRef.get(TODO_CATEGORY_CACHE);
		uow = unitRef.get(UNIT_OF_WORK);

		uow.run.mockImplementation((fn: () => unknown) => fn());
		repo.findByIdAndUserId.mockResolvedValue(category());
		repo.countByUserId.mockResolvedValue(2);
		repo.getTodoCount.mockResolvedValue(0);
	});

	it("존재하지 않으면 TODO_CATEGORY_0851", async () => {
		repo.findByIdAndUserId.mockResolvedValue(null);
		await expect(
			useCase.execute({ userId: "u1", categoryId: 1 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("마지막 카테고리면 TODO_CATEGORY_0854", async () => {
		repo.countByUserId.mockResolvedValue(1);
		await expect(
			useCase.execute({ userId: "u1", categoryId: 1 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("할 일이 있는데 이동 대상 없으면 TODO_CATEGORY_0855", async () => {
		repo.getTodoCount.mockResolvedValue(3);
		await expect(
			useCase.execute({ userId: "u1", categoryId: 1 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("이동 대상이 자신과 같으면 SYS_0002", async () => {
		repo.getTodoCount.mockResolvedValue(3);
		await expect(
			useCase.execute({ userId: "u1", categoryId: 1, moveToCategoryId: 1 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("이동 대상이 없으면 TODO_CATEGORY_0851", async () => {
		repo.getTodoCount.mockResolvedValue(3);
		repo.findByIdAndUserId
			.mockResolvedValueOnce(category())
			.mockResolvedValueOnce(null);
		await expect(
			useCase.execute({ userId: "u1", categoryId: 1, moveToCategoryId: 2 }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("할 일 이동 후 삭제 + 캐시 무효화", async () => {
		repo.getTodoCount.mockResolvedValue(3);
		repo.findByIdAndUserId
			.mockResolvedValueOnce(category(1))
			.mockResolvedValueOnce(category(2));

		await useCase.execute({ userId: "u1", categoryId: 1, moveToCategoryId: 2 });

		expect(repo.moveTodosToCategory).toHaveBeenCalledWith(1, 2);
		expect(repo.delete).toHaveBeenCalledWith(1);
		expect(cache.invalidate).toHaveBeenCalledWith("u1");
	});

	it("할 일 없으면 바로 삭제", async () => {
		await useCase.execute({ userId: "u1", categoryId: 1 });
		expect(repo.moveTodosToCategory).not.toHaveBeenCalled();
		expect(repo.delete).toHaveBeenCalledWith(1);
	});
});
