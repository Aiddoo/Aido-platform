/**
 * TodoCategoryService 테스트 (Suites 패턴)
 *
 * NestJS 공식 권장 Suites 라이브러리 사용
 * - 자동 Mock 생성으로 보일러플레이트 제거
 * - Builder 패턴으로 테스트 데이터 생성
 * - Given/When/Then 주석으로 명확한 테스트 구조
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoCategoryBuilder } from "@test/builders";

import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";
import { Prisma } from "@/generated/prisma/client";

import { TodoCategoryRepository } from "./todo-category.repository";
import { TodoCategoryService } from "./todo-category.service";
import type {
	TodoCategoryWithCount,
	TransactionClient,
} from "./types/todo-category.types";

describe("TodoCategoryService", () => {
	let service: TodoCategoryService;
	let todoCategoryRepo: Mocked<TodoCategoryRepository>;
	let database: Mocked<DatabaseService>;

	const userId = "user-123";

	beforeEach(async () => {
		// ID 카운터 리셋 (테스트 간 격리)
		TodoCategoryBuilder.resetIdCounter();

		// Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } =
			await TestBed.solitary(TodoCategoryService).compile();

		service = unit;
		todoCategoryRepo = unitRef.get(
			TodoCategoryRepository,
		) as unknown as Mocked<TodoCategoryRepository>;
		database = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;

		// $transaction 기본 mock 설정
		// Note: 테스트에서는 repository mock을 TransactionClient로 사용
		// 실제로는 서비스가 tx를 repository에 전달하고, mock이 tx 없이도 동작하도록 설정됨
		database.$transaction.mockImplementation(async (callback) =>
			callback(todoCategoryRepo as unknown as TransactionClient),
		);
	});

	// ============================================
	// create
	// ============================================

	describe("create", () => {
		const createData = { userId, name: "새 카테고리", color: "#FF6B43" };

		it("새 카테고리를 생성해야 한다", async () => {
			// Given
			const expectedCategory = TodoCategoryBuilder.create(userId)
				.withId(3)
				.withName("새 카테고리")
				.withColor("#FF6B43")
				.withSortOrder(2)
				.build();

			todoCategoryRepo.existsByUserIdAndName.mockResolvedValue(false);
			todoCategoryRepo.getMaxSortOrder.mockResolvedValue(1);
			todoCategoryRepo.create.mockResolvedValue(expectedCategory);

			// When
			const result = await service.create(createData);

			// Then
			expect(result.name).toBe("새 카테고리");
			expect(todoCategoryRepo.create).toHaveBeenCalledWith({
				user: { connect: { id: userId } },
				name: "새 카테고리",
				color: "#FF6B43",
				sortOrder: 2,
			});
		});

		it("동일 이름의 카테고리가 존재하면 예외를 던져야 한다", async () => {
			// Given
			todoCategoryRepo.existsByUserIdAndName.mockResolvedValue(true);

			// When & Then
			await expect(service.create(createData)).rejects.toThrow(
				BusinessExceptions.todoCategoryNameDuplicate("새 카테고리"),
			);
		});

		it("P2002 unique constraint 위반 시 todoCategoryNameDuplicate를 던져야 한다", async () => {
			// Given
			todoCategoryRepo.existsByUserIdAndName.mockResolvedValue(false);
			todoCategoryRepo.getMaxSortOrder.mockResolvedValue(0);
			todoCategoryRepo.create.mockRejectedValue(
				new Prisma.PrismaClientKnownRequestError("Unique constraint", {
					code: "P2002",
					meta: { target: ["userId", "name"] },
					clientVersion: "7.0.0",
				}),
			);

			// When & Then
			await expect(service.create(createData)).rejects.toThrow(
				BusinessExceptions.todoCategoryNameDuplicate("새 카테고리"),
			);
		});

		it("sortOrder는 기존 최대값 + 1이어야 한다", async () => {
			// Given
			const expectedCategory = TodoCategoryBuilder.create(userId)
				.withSortOrder(6)
				.build();

			todoCategoryRepo.existsByUserIdAndName.mockResolvedValue(false);
			todoCategoryRepo.getMaxSortOrder.mockResolvedValue(5);
			todoCategoryRepo.create.mockResolvedValue(expectedCategory);

			// When
			await service.create(createData);

			// Then
			expect(todoCategoryRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ sortOrder: 6 }),
			);
		});
	});

	// ============================================
	// createDefaultCategories
	// ============================================

	describe("createDefaultCategories", () => {
		const defaultCategories = [
			{ name: "중요한 일", color: "#FFB3B3", sortOrder: 0 },
			{ name: "할 일", color: "#FF6B43", sortOrder: 1 },
		];

		it("기본 카테고리를 생성해야 한다", async () => {
			// Given
			todoCategoryRepo.createMany.mockResolvedValue(2);

			// When
			const result = await service.createDefaultCategories(
				userId,
				defaultCategories,
			);

			// Then
			expect(result).toBe(2);
			expect(todoCategoryRepo.createMany).toHaveBeenCalledWith([
				{ userId, name: "중요한 일", color: "#FFB3B3", sortOrder: 0 },
				{ userId, name: "할 일", color: "#FF6B43", sortOrder: 1 },
			]);
		});
	});

	// ============================================
	// findById
	// ============================================

	describe("findById", () => {
		it("카테고리를 조회해야 한다", async () => {
			// Given
			const category = TodoCategoryBuilder.create(userId)
				.withId(1)
				.withName("중요한 일")
				.build();
			const categoryWithCount: TodoCategoryWithCount = {
				...category,
				_count: { todos: 5 },
			};

			todoCategoryRepo.findByIdWithCount.mockResolvedValue(categoryWithCount);

			// When
			const result = await service.findById(1, userId);

			// Then
			expect(result).toEqual(categoryWithCount);
		});

		it("카테고리가 없으면 예외를 던져야 한다", async () => {
			// Given
			todoCategoryRepo.findByIdWithCount.mockResolvedValue(null);

			// When & Then
			await expect(service.findById(999, userId)).rejects.toThrow(
				BusinessExceptions.todoCategoryNotFound(999),
			);
		});

		it("다른 사용자의 카테고리면 예외를 던져야 한다", async () => {
			// Given
			const otherUserCategory = TodoCategoryBuilder.create("other-user")
				.withId(1)
				.build();
			const categoryWithCount: TodoCategoryWithCount = {
				...otherUserCategory,
				_count: { todos: 0 },
			};

			todoCategoryRepo.findByIdWithCount.mockResolvedValue(categoryWithCount);

			// When & Then
			await expect(service.findById(1, userId)).rejects.toThrow(
				BusinessExceptions.todoCategoryAccessDenied(1),
			);
		});
	});

	// ============================================
	// findMany
	// ============================================

	describe("findMany", () => {
		it("사용자의 모든 카테고리를 조회해야 한다", async () => {
			// Given
			const category1 = TodoCategoryBuilder.create(userId)
				.withId(1)
				.withName("중요한 일")
				.build();
			const category2 = TodoCategoryBuilder.create(userId)
				.withId(2)
				.withName("할 일")
				.build();
			const categories: TodoCategoryWithCount[] = [
				{ ...category1, _count: { todos: 3 } },
				{ ...category2, _count: { todos: 2 } },
			];

			todoCategoryRepo.findManyByUserId.mockResolvedValue(categories);

			// When
			const result = await service.findMany(userId);

			// Then
			expect(result).toHaveLength(2);
			expect(todoCategoryRepo.findManyByUserId).toHaveBeenCalledWith(userId);
		});

		it("카테고리가 없으면 빈 배열을 반환해야 한다", async () => {
			// Given
			todoCategoryRepo.findManyByUserId.mockResolvedValue([]);

			// When
			const result = await service.findMany(userId);

			// Then
			expect(result).toEqual([]);
		});
	});

	// ============================================
	// update
	// ============================================

	describe("update", () => {
		const updateData = { name: "수정된 카테고리", color: "#00FF00" };

		it("카테고리를 수정해야 한다", async () => {
			// Given
			const existingCategory = TodoCategoryBuilder.create(userId)
				.withId(1)
				.withName("중요한 일")
				.build();
			const updatedCategory = TodoCategoryBuilder.create(userId)
				.withId(1)
				.withName("수정된 카테고리")
				.withColor("#00FF00")
				.build();

			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(existingCategory);
			todoCategoryRepo.existsByUserIdAndName.mockResolvedValue(false);
			todoCategoryRepo.update.mockResolvedValue(updatedCategory);

			// When
			const result = await service.update(1, userId, updateData);

			// Then
			expect(result.name).toBe("수정된 카테고리");
		});

		it("카테고리가 없으면 예외를 던져야 한다", async () => {
			// Given
			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(service.update(999, userId, updateData)).rejects.toThrow(
				BusinessExceptions.todoCategoryNotFound(999),
			);
		});

		it("이름 변경 시 중복되면 예외를 던져야 한다", async () => {
			// Given
			const existingCategory = TodoCategoryBuilder.create(userId)
				.withId(1)
				.withName("중요한 일")
				.build();

			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(existingCategory);
			todoCategoryRepo.existsByUserIdAndName.mockResolvedValue(true);

			// When & Then
			await expect(service.update(1, userId, updateData)).rejects.toThrow(
				BusinessExceptions.todoCategoryNameDuplicate("수정된 카테고리"),
			);
		});

		it("P2002 unique constraint 위반 시 todoCategoryNameDuplicate를 던져야 한다", async () => {
			// Given
			const existingCategory = TodoCategoryBuilder.create(userId)
				.withId(1)
				.withName("중요한 일")
				.build();

			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(existingCategory);
			todoCategoryRepo.existsByUserIdAndName.mockResolvedValue(false);
			todoCategoryRepo.update.mockRejectedValue(
				new Prisma.PrismaClientKnownRequestError("Unique constraint", {
					code: "P2002",
					meta: { target: ["userId", "name"] },
					clientVersion: "7.0.0",
				}),
			);

			// When & Then
			await expect(
				service.update(1, userId, { name: "수정된 카테고리" }),
			).rejects.toThrow(
				BusinessExceptions.todoCategoryNameDuplicate("수정된 카테고리"),
			);
		});

		it("같은 이름으로 수정하면 중복 확인을 건너뛰어야 한다", async () => {
			// Given
			const existingCategory = TodoCategoryBuilder.create(userId)
				.withId(1)
				.withName("중요한 일")
				.build();

			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(existingCategory);
			todoCategoryRepo.update.mockResolvedValue(existingCategory);

			// When
			await service.update(1, userId, { name: "중요한 일" });

			// Then
			expect(todoCategoryRepo.existsByUserIdAndName).not.toHaveBeenCalled();
		});
	});

	// ============================================
	// delete
	// ============================================

	describe("delete", () => {
		it("Todo가 없는 카테고리를 삭제해야 한다", async () => {
			// Given
			const category = TodoCategoryBuilder.create(userId).withId(1).build();

			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(category);
			todoCategoryRepo.countByUserId.mockResolvedValue(3);
			todoCategoryRepo.getTodoCount.mockResolvedValue(0);
			todoCategoryRepo.delete.mockResolvedValue(category);

			// When
			await service.delete({ userId, categoryId: 1 });

			// Then
			expect(todoCategoryRepo.delete).toHaveBeenCalledWith(1, todoCategoryRepo);
		});

		it("마지막 카테고리 삭제 시 예외를 던져야 한다", async () => {
			// Given
			const category = TodoCategoryBuilder.create(userId).withId(1).build();

			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(category);
			todoCategoryRepo.countByUserId.mockResolvedValue(1);

			// When & Then
			await expect(service.delete({ userId, categoryId: 1 })).rejects.toThrow(
				BusinessExceptions.todoCategoryMinimumRequired(),
			);
		});

		it("Todo가 있으면 이동 대상이 필수여야 한다", async () => {
			// Given
			const category = TodoCategoryBuilder.create(userId).withId(1).build();

			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(category);
			todoCategoryRepo.countByUserId.mockResolvedValue(2);
			todoCategoryRepo.getTodoCount.mockResolvedValue(5);

			// When & Then
			await expect(service.delete({ userId, categoryId: 1 })).rejects.toThrow(
				BusinessExceptions.todoCategoryHasTodos(1, 5),
			);
		});

		it("moveToCategoryId가 삭제 대상과 같으면 invalidParameter를 던져야 한다", async () => {
			// Given
			const category = TodoCategoryBuilder.create(userId).withId(1).build();

			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(category);
			todoCategoryRepo.countByUserId.mockResolvedValue(2);
			todoCategoryRepo.getTodoCount.mockResolvedValue(3);

			// When & Then
			await expect(
				service.delete({ userId, categoryId: 1, moveToCategoryId: 1 }),
			).rejects.toThrow(BusinessExceptions.invalidParameter());
		});

		it("Todo가 있으면 이동 후 삭제해야 한다", async () => {
			// Given
			const sourceCategory = TodoCategoryBuilder.create(userId)
				.withId(1)
				.build();
			const targetCategory = TodoCategoryBuilder.create(userId)
				.withId(2)
				.build();

			todoCategoryRepo.findByIdAndUserId
				.mockResolvedValueOnce(sourceCategory) // 삭제할 카테고리
				.mockResolvedValueOnce(targetCategory); // 이동 대상 카테고리
			todoCategoryRepo.countByUserId.mockResolvedValue(2);
			todoCategoryRepo.getTodoCount.mockResolvedValue(5);
			todoCategoryRepo.moveTodosToCategory.mockResolvedValue(5); // 이동된 Todo 개수
			todoCategoryRepo.delete.mockResolvedValue(sourceCategory);

			// When
			await service.delete({
				userId,
				categoryId: 1,
				moveToCategoryId: 2,
			});

			// Then
			expect(todoCategoryRepo.moveTodosToCategory).toHaveBeenCalledWith(
				1,
				2,
				todoCategoryRepo,
			);
			expect(todoCategoryRepo.delete).toHaveBeenCalledWith(1, todoCategoryRepo);
		});

		it("이동 대상 카테고리가 없으면 예외를 던져야 한다", async () => {
			// Given
			const sourceCategory = TodoCategoryBuilder.create(userId)
				.withId(1)
				.build();

			todoCategoryRepo.findByIdAndUserId
				.mockResolvedValueOnce(sourceCategory) // 삭제할 카테고리
				.mockResolvedValueOnce(null); // 이동 대상 카테고리 없음
			todoCategoryRepo.countByUserId.mockResolvedValue(2);
			todoCategoryRepo.getTodoCount.mockResolvedValue(5);

			// When & Then
			await expect(
				service.delete({ userId, categoryId: 1, moveToCategoryId: 999 }),
			).rejects.toThrow(BusinessExceptions.todoCategoryNotFound(999));
		});
	});

	// ============================================
	// reorder
	// ============================================

	describe("reorder", () => {
		it("카테고리를 특정 카테고리 앞으로 이동해야 한다 (before)", async () => {
			// Given
			const category = TodoCategoryBuilder.create(userId)
				.withId(3)
				.withSortOrder(2)
				.build();
			const targetCategory = TodoCategoryBuilder.create(userId)
				.withId(1)
				.withSortOrder(0)
				.build();
			const updatedCategory = TodoCategoryBuilder.create(userId)
				.withId(3)
				.withSortOrder(0)
				.build();

			todoCategoryRepo.findByIdAndUserId
				.mockResolvedValueOnce(category)
				.mockResolvedValueOnce(targetCategory);
			todoCategoryRepo.shiftSortOrders.mockResolvedValue(2); // 이동된 개수
			todoCategoryRepo.update.mockResolvedValue(updatedCategory);

			// When
			const result = await service.reorder({
				userId,
				categoryId: 3,
				targetCategoryId: 1,
				position: "before",
			});

			// Then
			expect(result.sortOrder).toBe(0);
			expect(todoCategoryRepo.shiftSortOrders).toHaveBeenCalled();
		});

		it("카테고리를 특정 카테고리 뒤로 이동해야 한다 (after)", async () => {
			// Given
			const category = TodoCategoryBuilder.create(userId)
				.withId(1)
				.withSortOrder(0)
				.build();
			const targetCategory = TodoCategoryBuilder.create(userId)
				.withId(2)
				.withSortOrder(1)
				.build();
			const updatedCategory = TodoCategoryBuilder.create(userId)
				.withId(1)
				.withSortOrder(1)
				.build();

			todoCategoryRepo.findByIdAndUserId
				.mockResolvedValueOnce(category)
				.mockResolvedValueOnce(targetCategory);
			todoCategoryRepo.shiftSortOrders.mockResolvedValue(1); // 이동된 개수
			todoCategoryRepo.update.mockResolvedValue(updatedCategory);

			// When
			const result = await service.reorder({
				userId,
				categoryId: 1,
				targetCategoryId: 2,
				position: "after",
			});

			// Then
			expect(result.sortOrder).toBe(1);
		});

		it("맨 앞으로 이동해야 한다 (targetCategoryId 없이 before)", async () => {
			// Given
			const category = TodoCategoryBuilder.create(userId)
				.withId(2)
				.withSortOrder(2)
				.build();
			const updatedCategory = TodoCategoryBuilder.create(userId)
				.withId(2)
				.withSortOrder(0)
				.build();

			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(category);
			todoCategoryRepo.shiftSortOrders.mockResolvedValue(2); // 이동된 개수
			todoCategoryRepo.update.mockResolvedValue(updatedCategory);

			// When
			const result = await service.reorder({
				userId,
				categoryId: 2,
				position: "before",
			});

			// Then
			expect(result.sortOrder).toBe(0);
		});

		it("맨 뒤로 이동해야 한다 (targetCategoryId 없이 after)", async () => {
			// Given
			const category = TodoCategoryBuilder.create(userId)
				.withId(1)
				.withSortOrder(0)
				.build();
			const updatedCategory = TodoCategoryBuilder.create(userId)
				.withId(1)
				.withSortOrder(3)
				.build();

			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(category);
			todoCategoryRepo.getMaxSortOrder.mockResolvedValue(3);
			todoCategoryRepo.shiftSortOrders.mockResolvedValue(0); // 이동된 개수 (맨 뒤로 이동 시 0)
			todoCategoryRepo.update.mockResolvedValue(updatedCategory);

			// When
			const result = await service.reorder({
				userId,
				categoryId: 1,
				position: "after",
			});

			// Then
			expect(result.sortOrder).toBe(3);
		});

		it("같은 카테고리로 이동하면 변경 없이 반환해야 한다", async () => {
			// Given
			const category = TodoCategoryBuilder.create(userId)
				.withId(1)
				.withSortOrder(0)
				.build();

			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(category);

			// When
			const result = await service.reorder({
				userId,
				categoryId: 1,
				targetCategoryId: 1,
				position: "before",
			});

			// Then
			expect(result).toEqual(category);
			expect(todoCategoryRepo.update).not.toHaveBeenCalled();
		});

		it("카테고리가 없으면 예외를 던져야 한다", async () => {
			// Given
			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(
				service.reorder({ userId, categoryId: 999, position: "before" }),
			).rejects.toThrow(BusinessExceptions.todoCategoryNotFound(999));
		});
	});

	// ============================================
	// validateOwnership
	// ============================================

	describe("validateOwnership", () => {
		it("소유권이 확인된 카테고리를 반환해야 한다", async () => {
			// Given
			const category = TodoCategoryBuilder.create(userId).withId(1).build();

			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(category);

			// When
			const result = await service.validateOwnership(1, userId);

			// Then
			expect(result).toEqual(category);
		});

		it("카테고리가 없으면 예외를 던져야 한다", async () => {
			// Given
			todoCategoryRepo.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(service.validateOwnership(999, userId)).rejects.toThrow(
				BusinessExceptions.todoCategoryNotFound(999),
			);
		});
	});
});
