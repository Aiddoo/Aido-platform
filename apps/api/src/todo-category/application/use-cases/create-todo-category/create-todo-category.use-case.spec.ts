import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
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
import { CreateTodoCategoryUseCase } from "./create-todo-category.use-case";

const created = TodoCategory.reconstitute({
	id: 1,
	userId: "u1",
	name: "새 카테고리",
	color: "#FFB3B3",
	sortOrder: 1,
	createdAt: new Date(),
	updatedAt: new Date(),
});

describe("CreateTodoCategoryUseCase", () => {
	let useCase: CreateTodoCategoryUseCase;
	let repo: Mocked<TodoCategoryRepositoryPort>;
	let cache: Mocked<TodoCategoryCachePort>;
	let entitlement: Mocked<EntitlementService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			CreateTodoCategoryUseCase,
		).compile();
		useCase = unit;
		repo = unitRef.get(TODO_CATEGORY_REPOSITORY);
		cache = unitRef.get(TODO_CATEGORY_CACHE);
		entitlement = unitRef.get(EntitlementService);

		entitlement.getResourceLimit.mockResolvedValue({
			maxCount: null,
			isAdmin: false,
			subscriptionStatus: "ACTIVE",
		});
		repo.countByUserId.mockResolvedValue(2);
		repo.existsByUserIdAndName.mockResolvedValue(false);
		repo.getMaxSortOrder.mockResolvedValue(0);
		repo.create.mockResolvedValue(created);
	});

	it("한도 초과면 TODO_CATEGORY_0857", async () => {
		entitlement.getResourceLimit.mockResolvedValue({
			maxCount: 3,
			isAdmin: false,
			subscriptionStatus: "FREE",
		});
		repo.countByUserId.mockResolvedValue(3);

		await expect(
			useCase.execute({ userId: "u1", name: "x", color: "#FFB3B3" }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("중복 이름이면 TODO_CATEGORY_0853", async () => {
		repo.existsByUserIdAndName.mockResolvedValue(true);
		await expect(
			useCase.execute({ userId: "u1", name: "x", color: "#FFB3B3" }),
		).rejects.toBeInstanceOf(ApplicationException);
	});

	it("성공 시 맨 뒤 순번으로 생성 + 캐시 무효화", async () => {
		const result = await useCase.execute({
			userId: "u1",
			name: "새 카테고리",
			color: "#FFB3B3",
		});
		expect(result.id).toBe(1);
		expect(repo.create).toHaveBeenCalledWith({
			userId: "u1",
			name: "새 카테고리",
			color: "#FFB3B3",
			sortOrder: 1,
		});
		expect(cache.invalidate).toHaveBeenCalledWith("u1");
	});
});
