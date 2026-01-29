import { Test, type TestingModule } from "@nestjs/testing";

import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";

import { TodoCategoryRepository } from "./todo-category.repository";
import { TodoCategoryService } from "./todo-category.service";
import type { TodoCategoryWithCount } from "./types/todo-category.types";

describe("TodoCategoryService", () => {
	let service: TodoCategoryService;
	let mockRepository: {
		create: jest.Mock;
		createMany: jest.Mock;
		findById: jest.Mock;
		findByIdAndUserId: jest.Mock;
		findByIdWithCount: jest.Mock;
		findManyByUserId: jest.Mock;
		update: jest.Mock;
		delete: jest.Mock;
		countByUserId: jest.Mock;
		existsByUserIdAndName: jest.Mock;
		getMaxSortOrder: jest.Mock;
		getTodoCount: jest.Mock;
		moveTodosToCategory: jest.Mock;
		shiftSortOrders: jest.Mock;
	};
	let mockDatabase: { $transaction: jest.Mock };

	const userId = "user-123";

	const createMockCategory = (overrides = {}) => ({
		id: 1,
		userId,
		name: "중요한 일",
		color: "#FFB3B3",
		sortOrder: 0,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-02T00:00:00.000Z"),
		...overrides,
	});

	const createMockCategoryWithCount = (
		overrides = {},
	): TodoCategoryWithCount => ({
		...createMockCategory(overrides),
		_count: { todos: 5 },
		...overrides,
	});

	beforeEach(async () => {
		mockRepository = {
			create: jest.fn(),
			createMany: jest.fn(),
			findById: jest.fn(),
			findByIdAndUserId: jest.fn(),
			findByIdWithCount: jest.fn(),
			findManyByUserId: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			countByUserId: jest.fn(),
			existsByUserIdAndName: jest.fn(),
			getMaxSortOrder: jest.fn(),
			getTodoCount: jest.fn(),
			moveTodosToCategory: jest.fn(),
			shiftSortOrders: jest.fn(),
		};

		mockDatabase = {
			$transaction: jest.fn((callback) => callback(mockRepository)),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TodoCategoryService,
				{
					provide: TodoCategoryRepository,
					useValue: mockRepository,
				},
				{
					provide: DatabaseService,
					useValue: mockDatabase,
				},
			],
		}).compile();

		service = module.get<TodoCategoryService>(TodoCategoryService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("create", () => {
		const createData = { userId, name: "새 카테고리", color: "#FF6B43" };

		it("새 카테고리를 생성해야 한다", async () => {
			// Given
			mockRepository.existsByUserIdAndName.mockResolvedValue(false);
			mockRepository.getMaxSortOrder.mockResolvedValue(1);
			mockRepository.create.mockResolvedValue(
				createMockCategory({ id: 3, name: "새 카테고리", sortOrder: 2 }),
			);

			// When
			const result = await service.create(createData);

			// Then
			expect(result.name).toBe("새 카테고리");
			expect(mockRepository.create).toHaveBeenCalledWith({
				user: { connect: { id: userId } },
				name: "새 카테고리",
				color: "#FF6B43",
				sortOrder: 2,
			});
		});

		it("동일 이름의 카테고리가 존재하면 예외를 던져야 한다", async () => {
			// Given
			mockRepository.existsByUserIdAndName.mockResolvedValue(true);

			// When & Then
			await expect(service.create(createData)).rejects.toThrow(
				BusinessExceptions.todoCategoryNameDuplicate("새 카테고리"),
			);
		});

		it("sortOrder는 기존 최대값 + 1이어야 한다", async () => {
			// Given
			mockRepository.existsByUserIdAndName.mockResolvedValue(false);
			mockRepository.getMaxSortOrder.mockResolvedValue(5);
			mockRepository.create.mockResolvedValue(
				createMockCategory({ sortOrder: 6 }),
			);

			// When
			await service.create(createData);

			// Then
			expect(mockRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({ sortOrder: 6 }),
			);
		});
	});

	describe("createDefaultCategories", () => {
		const defaultCategories = [
			{ name: "중요한 일", color: "#FFB3B3", sortOrder: 0 },
			{ name: "할 일", color: "#FF6B43", sortOrder: 1 },
		] as const;

		it("기본 카테고리를 생성해야 한다", async () => {
			// Given
			mockRepository.createMany.mockResolvedValue(2);

			// When
			const result = await service.createDefaultCategories(
				userId,
				defaultCategories,
			);

			// Then
			expect(result).toBe(2);
			expect(mockRepository.createMany).toHaveBeenCalledWith([
				{ userId, name: "중요한 일", color: "#FFB3B3", sortOrder: 0 },
				{ userId, name: "할 일", color: "#FF6B43", sortOrder: 1 },
			]);
		});
	});

	describe("findById", () => {
		it("카테고리를 조회해야 한다", async () => {
			// Given
			const categoryWithCount = createMockCategoryWithCount();
			mockRepository.findByIdWithCount.mockResolvedValue(categoryWithCount);

			// When
			const result = await service.findById(1, userId);

			// Then
			expect(result).toEqual(categoryWithCount);
		});

		it("카테고리가 없으면 예외를 던져야 한다", async () => {
			// Given
			mockRepository.findByIdWithCount.mockResolvedValue(null);

			// When & Then
			await expect(service.findById(999, userId)).rejects.toThrow(
				BusinessExceptions.todoCategoryNotFound(999),
			);
		});

		it("다른 사용자의 카테고리면 예외를 던져야 한다", async () => {
			// Given
			const otherUserCategory = createMockCategoryWithCount({
				userId: "other-user",
			});
			mockRepository.findByIdWithCount.mockResolvedValue(otherUserCategory);

			// When & Then
			await expect(service.findById(1, userId)).rejects.toThrow(
				BusinessExceptions.todoCategoryAccessDenied(1),
			);
		});
	});

	describe("findMany", () => {
		it("사용자의 모든 카테고리를 조회해야 한다", async () => {
			// Given
			const categories = [
				createMockCategoryWithCount({ id: 1, name: "중요한 일" }),
				createMockCategoryWithCount({ id: 2, name: "할 일" }),
			];
			mockRepository.findManyByUserId.mockResolvedValue(categories);

			// When
			const result = await service.findMany(userId);

			// Then
			expect(result).toHaveLength(2);
			expect(mockRepository.findManyByUserId).toHaveBeenCalledWith(userId);
		});

		it("카테고리가 없으면 빈 배열을 반환해야 한다", async () => {
			// Given
			mockRepository.findManyByUserId.mockResolvedValue([]);

			// When
			const result = await service.findMany(userId);

			// Then
			expect(result).toEqual([]);
		});
	});

	describe("update", () => {
		const updateData = { name: "수정된 카테고리", color: "#00FF00" };

		it("카테고리를 수정해야 한다", async () => {
			// Given
			mockRepository.findByIdAndUserId.mockResolvedValue(createMockCategory());
			mockRepository.existsByUserIdAndName.mockResolvedValue(false);
			mockRepository.update.mockResolvedValue(
				createMockCategory({ name: "수정된 카테고리" }),
			);

			// When
			const result = await service.update(1, userId, updateData);

			// Then
			expect(result.name).toBe("수정된 카테고리");
		});

		it("카테고리가 없으면 예외를 던져야 한다", async () => {
			// Given
			mockRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(service.update(999, userId, updateData)).rejects.toThrow(
				BusinessExceptions.todoCategoryNotFound(999),
			);
		});

		it("이름 변경 시 중복되면 예외를 던져야 한다", async () => {
			// Given
			mockRepository.findByIdAndUserId.mockResolvedValue(createMockCategory());
			mockRepository.existsByUserIdAndName.mockResolvedValue(true);

			// When & Then
			await expect(service.update(1, userId, updateData)).rejects.toThrow(
				BusinessExceptions.todoCategoryNameDuplicate("수정된 카테고리"),
			);
		});

		it("같은 이름으로 수정하면 중복 확인을 건너뛰어야 한다", async () => {
			// Given
			const category = createMockCategory({ name: "중요한 일" });
			mockRepository.findByIdAndUserId.mockResolvedValue(category);
			mockRepository.update.mockResolvedValue(category);

			// When
			await service.update(1, userId, { name: "중요한 일" });

			// Then
			expect(mockRepository.existsByUserIdAndName).not.toHaveBeenCalled();
		});
	});

	describe("delete", () => {
		it("Todo가 없는 카테고리를 삭제해야 한다", async () => {
			// Given
			mockRepository.findByIdAndUserId.mockResolvedValue(createMockCategory());
			mockRepository.countByUserId.mockResolvedValue(3);
			mockRepository.getTodoCount.mockResolvedValue(0);
			mockRepository.delete.mockResolvedValue(undefined);

			// When
			await service.delete({ userId, categoryId: 1 });

			// Then
			expect(mockRepository.delete).toHaveBeenCalledWith(1, mockRepository);
		});

		it("마지막 카테고리 삭제 시 예외를 던져야 한다", async () => {
			// Given
			mockRepository.findByIdAndUserId.mockResolvedValue(createMockCategory());
			mockRepository.countByUserId.mockResolvedValue(1);

			// When & Then
			await expect(service.delete({ userId, categoryId: 1 })).rejects.toThrow(
				BusinessExceptions.todoCategoryMinimumRequired(),
			);
		});

		it("Todo가 있으면 이동 대상이 필수여야 한다", async () => {
			// Given
			mockRepository.findByIdAndUserId.mockResolvedValue(createMockCategory());
			mockRepository.countByUserId.mockResolvedValue(2);
			mockRepository.getTodoCount.mockResolvedValue(5);

			// When & Then
			await expect(service.delete({ userId, categoryId: 1 })).rejects.toThrow(
				BusinessExceptions.todoCategoryMoveTargetRequired(),
			);
		});

		it("Todo가 있으면 이동 후 삭제해야 한다", async () => {
			// Given
			mockRepository.findByIdAndUserId.mockResolvedValue(createMockCategory());
			mockRepository.countByUserId.mockResolvedValue(2);
			mockRepository.getTodoCount.mockResolvedValue(5);
			mockRepository.moveTodosToCategory.mockResolvedValue(undefined);
			mockRepository.delete.mockResolvedValue(undefined);

			// When
			await service.delete({
				userId,
				categoryId: 1,
				moveToCategoryId: 2,
			});

			// Then
			expect(mockRepository.moveTodosToCategory).toHaveBeenCalledWith(
				1,
				2,
				mockRepository,
			);
			expect(mockRepository.delete).toHaveBeenCalledWith(1, mockRepository);
		});

		it("이동 대상 카테고리가 없으면 예외를 던져야 한다", async () => {
			// Given
			mockRepository.findByIdAndUserId
				.mockResolvedValueOnce(createMockCategory()) // 삭제할 카테고리
				.mockResolvedValueOnce(null); // 이동 대상 카테고리
			mockRepository.countByUserId.mockResolvedValue(2);
			mockRepository.getTodoCount.mockResolvedValue(5);

			// When & Then
			await expect(
				service.delete({ userId, categoryId: 1, moveToCategoryId: 999 }),
			).rejects.toThrow(BusinessExceptions.todoCategoryNotFound(999));
		});
	});

	describe("reorder", () => {
		it("카테고리를 특정 카테고리 앞으로 이동해야 한다 (before)", async () => {
			// Given
			const category = createMockCategory({ id: 3, sortOrder: 2 });
			const targetCategory = createMockCategory({ id: 1, sortOrder: 0 });

			mockRepository.findByIdAndUserId
				.mockResolvedValueOnce(category)
				.mockResolvedValueOnce(targetCategory);
			mockRepository.shiftSortOrders.mockResolvedValue(undefined);
			mockRepository.update.mockResolvedValue(
				createMockCategory({ id: 3, sortOrder: 0 }),
			);

			// When
			const result = await service.reorder({
				userId,
				categoryId: 3,
				targetCategoryId: 1,
				position: "before",
			});

			// Then
			expect(result.sortOrder).toBe(0);
			expect(mockRepository.shiftSortOrders).toHaveBeenCalled();
		});

		it("카테고리를 특정 카테고리 뒤로 이동해야 한다 (after)", async () => {
			// Given
			const category = createMockCategory({ id: 1, sortOrder: 0 });
			const targetCategory = createMockCategory({ id: 2, sortOrder: 1 });

			mockRepository.findByIdAndUserId
				.mockResolvedValueOnce(category)
				.mockResolvedValueOnce(targetCategory);
			mockRepository.shiftSortOrders.mockResolvedValue(undefined);
			mockRepository.update.mockResolvedValue(
				createMockCategory({ id: 1, sortOrder: 1 }),
			);

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
			const category = createMockCategory({ id: 2, sortOrder: 2 });
			mockRepository.findByIdAndUserId.mockResolvedValue(category);
			mockRepository.shiftSortOrders.mockResolvedValue(undefined);
			mockRepository.update.mockResolvedValue(
				createMockCategory({ id: 2, sortOrder: 0 }),
			);

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
			const category = createMockCategory({ id: 1, sortOrder: 0 });
			mockRepository.findByIdAndUserId.mockResolvedValue(category);
			mockRepository.getMaxSortOrder.mockResolvedValue(3);
			mockRepository.shiftSortOrders.mockResolvedValue(undefined);
			mockRepository.update.mockResolvedValue(
				createMockCategory({ id: 1, sortOrder: 3 }),
			);

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
			const category = createMockCategory({ id: 1, sortOrder: 0 });
			mockRepository.findByIdAndUserId.mockResolvedValue(category);

			// When
			const result = await service.reorder({
				userId,
				categoryId: 1,
				targetCategoryId: 1,
				position: "before",
			});

			// Then
			expect(result).toEqual(category);
			expect(mockRepository.update).not.toHaveBeenCalled();
		});

		it("카테고리가 없으면 예외를 던져야 한다", async () => {
			// Given
			mockRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(
				service.reorder({ userId, categoryId: 999, position: "before" }),
			).rejects.toThrow(BusinessExceptions.todoCategoryNotFound(999));
		});
	});

	describe("validateOwnership", () => {
		it("소유권이 확인된 카테고리를 반환해야 한다", async () => {
			// Given
			const category = createMockCategory();
			mockRepository.findByIdAndUserId.mockResolvedValue(category);

			// When
			const result = await service.validateOwnership(1, userId);

			// Then
			expect(result).toEqual(category);
		});

		it("카테고리가 없으면 예외를 던져야 한다", async () => {
			// Given
			mockRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then
			await expect(service.validateOwnership(999, userId)).rejects.toThrow(
				BusinessExceptions.todoCategoryNotFound(999),
			);
		});
	});
});
