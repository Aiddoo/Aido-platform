/**
 * TodoCategoryRepository 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: 자동 Mock 생성
 * - GWT: Given/When/Then 주석
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { DatabaseService } from "@/database/database.service";

import { TodoCategoryRepository } from "./todo-category.repository";
import type { TodoCategoryWithCount } from "./types/todo-category.types";

describe("TodoCategoryRepository — 할 일 카테고리 리포지토리", () => {
	let repository: TodoCategoryRepository;
	let db: Mocked<DatabaseService>;

	const mockCategory = {
		id: 1,
		userId: "user-123",
		name: "업무",
		color: "#FF0000",
		icon: "briefcase",
		sortOrder: 0,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
	};

	const mockCategoryWithCount: TodoCategoryWithCount = {
		...mockCategory,
		_count: { todos: 3 },
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			TodoCategoryRepository,
		).compile();

		repository = unit;
		db = unitRef.get(DatabaseService);
	});

	describe("create", () => {
		it("카테고리를 생성한다", async () => {
			// Given
			const createData = {
				user: { connect: { id: "user-123" } },
				name: "업무",
				color: "#FF0000",
				sortOrder: 0,
			};
			db.todoCategory.create.mockResolvedValue(mockCategory);

			// When
			const result = await repository.create(createData);

			// Then
			expect(result).toEqual(mockCategory);
			expect(db.todoCategory.create).toHaveBeenCalledWith({
				data: createData,
			});
		});
	});

	describe("createMany", () => {
		it("여러 카테고리를 일괄 생성하고 개수를 반환한다", async () => {
			// Given
			const createManyData = [
				{ userId: "user-123", name: "업무", color: "#FF0000", sortOrder: 0 },
				{ userId: "user-123", name: "개인", color: "#00FF00", sortOrder: 1 },
			];
			db.todoCategory.createMany.mockResolvedValue({ count: 2 });

			// When
			const result = await repository.createMany(createManyData);

			// Then
			expect(result).toBe(2);
			expect(db.todoCategory.createMany).toHaveBeenCalledWith({
				data: createManyData,
			});
		});
	});

	describe("findById", () => {
		it("ID로 카테고리를 조회한다", async () => {
			// Given
			db.todoCategory.findUnique.mockResolvedValue(mockCategory);

			// When
			const result = await repository.findById(1);

			// Then
			expect(result).toEqual(mockCategory);
			expect(db.todoCategory.findUnique).toHaveBeenCalledWith({
				where: { id: 1 },
			});
		});

		it("카테고리가 없으면 null을 반환한다", async () => {
			// Given
			db.todoCategory.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findById(999);

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findByIdAndUserId", () => {
		it("ID와 사용자 ID로 카테고리를 조회한다", async () => {
			// Given
			db.todoCategory.findFirst.mockResolvedValue(mockCategory);

			// When
			const result = await repository.findByIdAndUserId(1, "user-123");

			// Then
			expect(result).toEqual(mockCategory);
			expect(db.todoCategory.findFirst).toHaveBeenCalledWith({
				where: { id: 1, userId: "user-123" },
			});
		});

		it("소유권이 일치하지 않으면 null을 반환한다", async () => {
			// Given
			db.todoCategory.findFirst.mockResolvedValue(null);

			// When
			const result = await repository.findByIdAndUserId(1, "other-user");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findManyByUserId", () => {
		it("사용자의 카테고리 목록을 Todo 개수 포함하여 조회한다", async () => {
			// Given
			const categoriesWithCount: TodoCategoryWithCount[] = [
				{ ...mockCategory, _count: { todos: 3 } },
				{
					...mockCategory,
					id: 2,
					name: "개인",
					color: "#00FF00",
					sortOrder: 1,
					_count: { todos: 1 },
				},
			];
			db.todoCategory.findMany.mockResolvedValue(categoriesWithCount);

			// When
			const result = await repository.findManyByUserId("user-123");

			// Then
			expect(result).toEqual(categoriesWithCount);
			expect(db.todoCategory.findMany).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				include: {
					_count: {
						select: { todos: true },
					},
				},
				orderBy: { sortOrder: "asc" },
			});
		});

		it("카테고리가 없으면 빈 배열을 반환한다", async () => {
			// Given
			db.todoCategory.findMany.mockResolvedValue([]);

			// When
			const result = await repository.findManyByUserId("user-123");

			// Then
			expect(result).toEqual([]);
		});
	});

	describe("countByUserId", () => {
		it("사용자의 카테고리 개수를 반환한다", async () => {
			// Given
			db.todoCategory.count.mockResolvedValue(3);

			// When
			const result = await repository.countByUserId("user-123");

			// Then
			expect(result).toBe(3);
			expect(db.todoCategory.count).toHaveBeenCalledWith({
				where: { userId: "user-123" },
			});
		});
	});

	describe("existsByUserIdAndName", () => {
		it("동일 이름의 카테고리가 존재하면 true를 반환한다", async () => {
			// Given
			db.todoCategory.findFirst.mockResolvedValue(mockCategory);

			// When
			const result = await repository.existsByUserIdAndName("user-123", "업무");

			// Then
			expect(result).toBe(true);
			expect(db.todoCategory.findFirst).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					name: "업무",
				},
			});
		});

		it("동일 이름의 카테고리가 없으면 false를 반환한다", async () => {
			// Given
			db.todoCategory.findFirst.mockResolvedValue(null);

			// When
			const result = await repository.existsByUserIdAndName("user-123", "여행");

			// Then
			expect(result).toBe(false);
		});

		it("특정 ID를 제외하고 중복 이름을 확인한다", async () => {
			// Given
			db.todoCategory.findFirst.mockResolvedValue(null);

			// When
			const result = await repository.existsByUserIdAndName(
				"user-123",
				"업무",
				1,
			);

			// Then
			expect(result).toBe(false);
			expect(db.todoCategory.findFirst).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					name: "업무",
					id: { not: 1 },
				},
			});
		});
	});

	describe("update", () => {
		it("카테고리를 수정한다", async () => {
			// Given
			const updatedCategory = {
				...mockCategory,
				name: "업무(수정)",
				color: "#0000FF",
			};
			db.todoCategory.update.mockResolvedValue(updatedCategory);

			// When
			const result = await repository.update(1, {
				name: "업무(수정)",
				color: "#0000FF",
			});

			// Then
			expect(result).toEqual(updatedCategory);
			expect(db.todoCategory.update).toHaveBeenCalledWith({
				where: { id: 1 },
				data: { name: "업무(수정)", color: "#0000FF" },
			});
		});
	});

	describe("delete", () => {
		it("카테고리를 삭제한다", async () => {
			// Given
			db.todoCategory.delete.mockResolvedValue(mockCategory);

			// When
			const result = await repository.delete(1);

			// Then
			expect(result).toEqual(mockCategory);
			expect(db.todoCategory.delete).toHaveBeenCalledWith({
				where: { id: 1 },
			});
		});
	});

	describe("getTodoCount", () => {
		it("카테고리의 Todo 개수를 반환한다", async () => {
			// Given
			db.todo.count.mockResolvedValue(5);

			// When
			const result = await repository.getTodoCount(1);

			// Then
			expect(result).toBe(5);
			expect(db.todo.count).toHaveBeenCalledWith({
				where: { categoryId: 1 },
			});
		});

		it("Todo가 없으면 0을 반환한다", async () => {
			// Given
			db.todo.count.mockResolvedValue(0);

			// When
			const result = await repository.getTodoCount(1);

			// Then
			expect(result).toBe(0);
		});
	});

	describe("moveTodosToCategory", () => {
		it("카테고리의 모든 Todo를 다른 카테고리로 이동한다", async () => {
			// Given
			db.todo.updateMany.mockResolvedValue({ count: 3 });

			// When
			const result = await repository.moveTodosToCategory(1, 2);

			// Then
			expect(result).toBe(3);
			expect(db.todo.updateMany).toHaveBeenCalledWith({
				where: { categoryId: 1 },
				data: { categoryId: 2 },
			});
		});

		it("이동할 Todo가 없으면 0을 반환한다", async () => {
			// Given
			db.todo.updateMany.mockResolvedValue({ count: 0 });

			// When
			const result = await repository.moveTodosToCategory(1, 2);

			// Then
			expect(result).toBe(0);
		});
	});

	describe("getMaxSortOrder", () => {
		it("사용자의 최대 sortOrder를 반환한다", async () => {
			// Given
			db.todoCategory.aggregate.mockResolvedValue({
				_max: { sortOrder: 4 },
				_min: {},
				_avg: {},
				_sum: {},
				_count: 0,
			} as never);

			// When
			const result = await repository.getMaxSortOrder("user-123");

			// Then
			expect(result).toBe(4);
			expect(db.todoCategory.aggregate).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				_max: { sortOrder: true },
			});
		});

		it("카테고리가 없으면 -1을 반환한다", async () => {
			// Given
			db.todoCategory.aggregate.mockResolvedValue({
				_max: { sortOrder: null },
				_min: {},
				_avg: {},
				_sum: {},
				_count: 0,
			} as never);

			// When
			const result = await repository.getMaxSortOrder("user-123");

			// Then
			expect(result).toBe(-1);
		});
	});

	describe("shiftSortOrders", () => {
		it("sortOrder 범위의 카테고리들을 일괄 조정한다", async () => {
			// Given
			db.todoCategory.updateMany.mockResolvedValue({ count: 3 });

			// When
			const result = await repository.shiftSortOrders("user-123", 1, 3, 1);

			// Then
			expect(result).toBe(3);
			expect(db.todoCategory.updateMany).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					sortOrder: {
						gte: 1,
						lte: 3,
					},
				},
				data: {
					sortOrder: { increment: 1 },
				},
			});
		});

		it("toSortOrder가 null이면 상한 조건 없이 조정한다", async () => {
			// Given
			db.todoCategory.updateMany.mockResolvedValue({ count: 5 });

			// When
			const result = await repository.shiftSortOrders("user-123", 2, null, -1);

			// Then
			expect(result).toBe(5);
			expect(db.todoCategory.updateMany).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					sortOrder: {
						gte: 2,
					},
				},
				data: {
					sortOrder: { increment: -1 },
				},
			});
		});
	});

	describe("findByIdWithCount", () => {
		it("ID로 카테고리를 Todo 개수 포함하여 조회한다", async () => {
			// Given
			db.todoCategory.findUnique.mockResolvedValue(mockCategoryWithCount);

			// When
			const result = await repository.findByIdWithCount(1);

			// Then
			expect(result).toEqual(mockCategoryWithCount);
			expect(db.todoCategory.findUnique).toHaveBeenCalledWith({
				where: { id: 1 },
				include: {
					_count: {
						select: { todos: true },
					},
				},
			});
		});

		it("카테고리가 없으면 null을 반환한다", async () => {
			// Given
			db.todoCategory.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findByIdWithCount(999);

			// Then
			expect(result).toBeNull();
		});
	});
});
