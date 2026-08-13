import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { TodoCategory } from "../../../domain/entities/todo-category.aggregate";
import {
	TODO_CATEGORY_REPOSITORY,
	type TodoCategoryRepositoryPort,
} from "../../ports/todo-category.repository.port";
import {
	TODO_CATEGORY_CACHE,
	type TodoCategoryCachePort,
} from "../../ports/todo-category-cache.port";
import { UpdateTodoCategoryUseCase } from "./update-todo-category.use-case";

const createExistingCategory = () =>
	TodoCategory.reconstitute({
		id: 1,
		userId: "u1",
		name: "기존",
		color: "#FFB3B3",
		sortOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

describe("UpdateTodoCategoryUseCase", () => {
	let useCase: UpdateTodoCategoryUseCase;
	let repo: Mocked<TodoCategoryRepositoryPort>;
	let cache: Mocked<TodoCategoryCachePort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			UpdateTodoCategoryUseCase,
		).compile();
		useCase = unit;
		repo = unitRef.get(TODO_CATEGORY_REPOSITORY);
		cache = unitRef.get(TODO_CATEGORY_CACHE);

		const existing = createExistingCategory();
		repo.findByIdAndUserId.mockResolvedValue(existing);
		repo.existsByUserIdAndName.mockResolvedValue(false);
		repo.update.mockResolvedValue(
			TodoCategory.reconstitute({
				...existing,
				id: 1,
				userId: "u1",
				name: "수정",
				color: "#FF0000",
				sortOrder: 0,
				createdAt: existing.createdAt,
				updatedAt: existing.updatedAt,
			}),
		);
	});

	it("존재하지 않으면 TODO_CATEGORY_0851", async () => {
		repo.findByIdAndUserId.mockResolvedValue(null);
		await expect(
			useCase.execute(1, "u1", { name: "수정" }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("이름 변경 시 중복이면 TODO_CATEGORY_0853", async () => {
		repo.existsByUserIdAndName.mockResolvedValue(true);
		await expect(
			useCase.execute(1, "u1", { name: "수정" }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("성공 시 갱신 + 캐시 무효화", async () => {
		const result = await useCase.execute(1, "u1", {
			name: "수정",
			color: "#FF0000",
		});
		expect(result.name).toBe("수정");
		expect(repo.update).toHaveBeenCalledWith(1, {
			name: "수정",
			color: "#FF0000",
		});
		expect(cache.invalidate).toHaveBeenCalledWith("u1");
	});

	it("이름이 기존과 같으면 중복 검사를 건너뛴다", async () => {
		await useCase.execute(1, "u1", { name: "기존" });
		expect(repo.existsByUserIdAndName).not.toHaveBeenCalled();
	});
});
