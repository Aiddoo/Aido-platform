import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import {
	MUTATION_LOCK,
	type MutationLockPort,
	UNIT_OF_WORK,
} from "@/shared/application/ports";
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
	let mutationLock: Mocked<MutationLockPort>;
	let uow: Mocked<{ run: (fn: () => unknown) => unknown }>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(DeleteTodoCategoryUseCase)
			.mock<MutationLockPort>(MUTATION_LOCK)
			.impl(() => ({ acquire: jest.fn() }))
			.compile();
		useCase = unit;
		repo = unitRef.get(TODO_CATEGORY_REPOSITORY);
		cache = unitRef.get(TODO_CATEGORY_CACHE);
		mutationLock = unitRef.get(MUTATION_LOCK);
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

	it("사용자 카테고리 키를 UoW 안에서 첫 구조 읽기 전에 잠그고 커밋 후 캐시를 무효화한다", async () => {
		// Given - 삭제 transaction 경계와 구조 읽기 순서 기록
		const events: string[] = [];
		uow.run.mockImplementation(async (work: () => unknown) => {
			events.push("uow:start");
			const result = await work();
			events.push("uow:commit");
			return result;
		});
		mutationLock.acquire.mockImplementation(async () => {
			events.push("lock");
		});
		repo.findByIdAndUserId.mockImplementation(async () => {
			events.push("category-read");
			return category();
		});
		repo.countByUserId.mockImplementation(async () => {
			events.push("count");
			return 2;
		});
		repo.getTodoCount.mockImplementation(async () => {
			events.push("todo-count");
			return 0;
		});
		repo.delete.mockImplementation(async () => {
			events.push("delete");
		});
		cache.invalidate.mockImplementation(async () => {
			events.push("cache");
		});

		// When
		await useCase.execute({ userId: "u1", categoryId: 1 });

		// Then
		expect(mutationLock.acquire).toHaveBeenCalledWith([
			"mutation:v1:todo-category:u1",
		]);
		expect(events).toEqual([
			"uow:start",
			"lock",
			"category-read",
			"count",
			"todo-count",
			"delete",
			"uow:commit",
			"cache",
		]);
	});
});
