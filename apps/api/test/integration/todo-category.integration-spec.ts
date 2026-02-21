/**
 * TodoCategoryService 통합 테스트
 *
 * @description
 * TodoCategoryService가 TodoCategoryRepository, DatabaseService와 함께 올바르게 작동하는지 검증합니다.
 * 실제 데이터베이스 대신 모킹된 DatabaseService를 사용하여 서비스 계층 통합을 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - TodoCategoryService와 TodoCategoryRepository의 통합 검증
 * - BusinessException 에러 처리가 올바르게 작동하는지 검증
 * - 트랜잭션 처리가 올바르게 작동하는지 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test:integration -- --testPathPattern=todo-category.integration
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { TodoCategoryBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { suppressLogger } from "@test/setup/suppress-logger";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";
import type { TodoCategory } from "@/generated/prisma/client";
import { TodoCategoryRepository } from "@/modules/todo-category/todo-category.repository";
import { TodoCategoryService } from "@/modules/todo-category/todo-category.service";
import type { TodoCategoryWithCount } from "@/modules/todo-category/types/todo-category.types";

describe("TodoCategoryService 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let service: TodoCategoryService;
	let repository: TodoCategoryRepository;

	// Mock 데이터베이스 서비스
	const mockTodoCategoryDb = {
		create: jest.fn(),
		createMany: jest.fn(),
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		update: jest.fn(),
		updateMany: jest.fn(),
		delete: jest.fn(),
		count: jest.fn(),
		aggregate: jest.fn(),
	};

	const mockTodoDb = {
		updateMany: jest.fn(),
		count: jest.fn(),
	};

	const mockDatabaseService = createMockDatabaseService({
		todoCategory: mockTodoCategoryDb,
		todo: mockTodoDb,
	});

	// 테스트 데이터
	const mockUserId = "user-category-123";
	const mockCategoryId = 1;

	const createMockCategory = (
		overrides: Partial<TodoCategory> = {},
	): TodoCategory => {
		const builder = TodoCategoryBuilder.create(mockUserId)
			.withId(overrides.id ?? mockCategoryId)
			.withName(overrides.name ?? "중요한 일")
			.withColor(overrides.color ?? "#FFB3B3")
			.withSortOrder(overrides.sortOrder ?? 0);

		if (overrides.userId) {
			// userId는 create 시 설정되므로 직접 처리
			return { ...builder.build(), userId: overrides.userId };
		}
		return builder.build();
	};

	const createMockCategoryWithCount = (
		overrides: Partial<TodoCategoryWithCount> = {},
	): TodoCategoryWithCount => {
		const category = createMockCategory(overrides);
		return {
			...category,
			_count: { todos: overrides._count?.todos ?? 0 },
		};
	};

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				TodoCategoryService,
				TodoCategoryRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabaseService,
				},
			],
		}).compile();

		service = module.get<TodoCategoryService>(TodoCategoryService);
		repository = module.get<TodoCategoryRepository>(TodoCategoryRepository);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		TodoCategoryBuilder.resetIdCounter();
	});

	describe("DI 통합", () => {
		it("TodoCategoryService가 올바르게 인스턴스화된다", () => {
			// Given - DI 컨테이너가 구성됨

			// When - 서비스 인스턴스 확인

			// Then - 서비스가 정의되어 있어야 함
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(TodoCategoryService);
		});

		it("TodoCategoryRepository가 올바르게 주입된다", () => {
			// Given - DI 컨테이너가 구성됨

			// When - 레포지토리 인스턴스 확인

			// Then - 레포지토리가 정의되어 있어야 함
			expect(repository).toBeDefined();
			expect(repository).toBeInstanceOf(TodoCategoryRepository);
		});
	});

	describe("create 통합 테스트", () => {
		it("카테고리를 생성한다", async () => {
			// Given - 중복되지 않는 새 카테고리 준비
			const mockCategory = createMockCategory({ name: "새 카테고리" });
			mockTodoCategoryDb.findFirst.mockResolvedValue(null);
			mockTodoCategoryDb.aggregate.mockResolvedValue({
				_max: { sortOrder: 0 },
			});
			mockTodoCategoryDb.create.mockResolvedValue(mockCategory);

			// When - 카테고리 생성
			const result = await service.create({
				userId: mockUserId,
				name: "새 카테고리",
				color: "#FFB3B3",
			});

			// Then - 카테고리가 생성됨
			expect(result).toEqual(mockCategory);
			expect(mockTodoCategoryDb.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					user: { connect: { id: mockUserId } },
					name: "새 카테고리",
					color: "#FFB3B3",
					sortOrder: 1,
				}),
			});
		});

		it("중복된 이름으로 생성 시 BusinessException을 던진다", async () => {
			// Given - 이미 존재하는 카테고리
			const existingCategory = createMockCategory();
			mockTodoCategoryDb.findFirst.mockResolvedValue(existingCategory);

			// When & Then - 예외 발생 검증
			await expect(
				service.create({
					userId: mockUserId,
					name: "중요한 일",
					color: "#FFB3B3",
				}),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("createDefaultCategories 통합 테스트", () => {
		it("기본 카테고리들을 생성한다", async () => {
			// Given - 기본 카테고리 목록 준비
			const defaultCategories = [
				{ name: "중요한 일", color: "#FFB3B3", sortOrder: 0 },
				{ name: "할 일", color: "#FF6B43", sortOrder: 1 },
			];
			mockTodoCategoryDb.createMany.mockResolvedValue({ count: 2 });

			// When - 기본 카테고리 생성
			const result = await service.createDefaultCategories(
				mockUserId,
				defaultCategories,
			);

			// Then - 2개의 카테고리가 생성됨
			expect(result).toBe(2);
			expect(mockTodoCategoryDb.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining([
					expect.objectContaining({ userId: mockUserId, name: "중요한 일" }),
					expect.objectContaining({ userId: mockUserId, name: "할 일" }),
				]),
			});
		});
	});

	describe("findById 통합 테스트", () => {
		it("카테고리를 조회한다", async () => {
			// Given - 조회할 카테고리 준비
			const mockCategoryWithCount = createMockCategoryWithCount();
			mockTodoCategoryDb.findUnique.mockResolvedValue(mockCategoryWithCount);

			// When - 카테고리 조회
			const result = await service.findById(mockCategoryId, mockUserId);

			// Then - 카테고리 정보 반환
			expect(result.id).toBe(mockCategoryId);
			expect(result.name).toBe("중요한 일");
			expect(result._count).toBeDefined();
		});

		it("존재하지 않는 카테고리 조회 시 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 카테고리
			mockTodoCategoryDb.findUnique.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(service.findById(999, mockUserId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 카테고리 조회 시 BusinessException을 던진다", async () => {
			// Given - 다른 사용자의 카테고리
			const otherUserCategory = createMockCategoryWithCount({
				userId: "other-user",
			});
			mockTodoCategoryDb.findUnique.mockResolvedValue(otherUserCategory);

			// When & Then - 예외 발생 검증
			await expect(
				service.findById(mockCategoryId, mockUserId),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("findMany 통합 테스트", () => {
		it("카테고리 목록을 조회한다", async () => {
			// Given - 카테고리 목록 준비
			const mockCategories = [
				createMockCategoryWithCount({ id: 1, name: "중요한 일", sortOrder: 0 }),
				createMockCategoryWithCount({ id: 2, name: "할 일", sortOrder: 1 }),
			];
			mockTodoCategoryDb.findMany.mockResolvedValue(mockCategories);

			// When - 카테고리 목록 조회
			const result = await service.findMany(mockUserId);

			// Then - sortOrder 순으로 정렬된 목록 반환
			expect(result).toHaveLength(2);
			expect(mockTodoCategoryDb.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { userId: mockUserId },
					orderBy: { sortOrder: "asc" },
				}),
			);
		});
	});

	describe("update 통합 테스트", () => {
		it("카테고리를 수정한다", async () => {
			// Given - 수정할 카테고리 준비
			const mockCategory = createMockCategory();
			const updatedCategory = createMockCategory({
				name: "수정된 이름",
				color: "#FF0000",
			});
			mockTodoCategoryDb.findFirst
				.mockResolvedValueOnce(mockCategory)
				.mockResolvedValueOnce(null);
			mockTodoCategoryDb.update.mockResolvedValue(updatedCategory);

			// When - 카테고리 수정
			const result = await service.update(mockCategoryId, mockUserId, {
				name: "수정된 이름",
				color: "#FF0000",
			});

			// Then - 수정된 카테고리 반환
			expect(result.name).toBe("수정된 이름");
			expect(result.color).toBe("#FF0000");
		});

		it("중복된 이름으로 수정 시 BusinessException을 던진다", async () => {
			// Given - 이미 존재하는 이름으로 수정 시도
			const mockCategory = createMockCategory({ id: 1, name: "카테고리 1" });
			const existingCategory = createMockCategory({
				id: 2,
				name: "카테고리 2",
			});
			mockTodoCategoryDb.findFirst
				.mockResolvedValueOnce(mockCategory)
				.mockResolvedValueOnce(existingCategory);

			// When & Then - 예외 발생 검증
			await expect(
				service.update(1, mockUserId, { name: "카테고리 2" }),
			).rejects.toThrow(BusinessException);
		});

		it("존재하지 않는 카테고리 수정 시 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 카테고리
			mockTodoCategoryDb.findFirst.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(
				service.update(999, mockUserId, { name: "수정" }),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("delete 통합 테스트", () => {
		it("Todo가 없는 카테고리를 삭제한다", async () => {
			// Given - Todo가 없는 카테고리 준비
			const mockCategory = createMockCategory();
			mockTodoCategoryDb.findFirst.mockResolvedValue(mockCategory);
			mockTodoCategoryDb.count.mockResolvedValue(2);
			mockTodoDb.count.mockResolvedValue(0);
			mockTodoCategoryDb.delete.mockResolvedValue(mockCategory);

			// When - 카테고리 삭제
			await service.delete({
				userId: mockUserId,
				categoryId: mockCategoryId,
			});

			// Then - 카테고리가 삭제됨
			expect(mockTodoCategoryDb.delete).toHaveBeenCalledWith({
				where: { id: mockCategoryId },
			});
		});

		it("Todo가 있는 카테고리 삭제 시 이동 대상이 없으면 BusinessException을 던진다", async () => {
			// Given - Todo가 있지만 이동 대상이 없는 상태
			const mockCategory = createMockCategory();
			mockTodoCategoryDb.findFirst.mockResolvedValue(mockCategory);
			mockTodoCategoryDb.count.mockResolvedValue(2);
			mockTodoDb.count.mockResolvedValue(5);

			// When & Then - 예외 발생 검증
			await expect(
				service.delete({
					userId: mockUserId,
					categoryId: mockCategoryId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("Todo가 있는 카테고리를 삭제하고 Todo를 이동한다", async () => {
			// Given - Todo가 있고 이동 대상 카테고리가 있는 상태
			const mockCategory = createMockCategory({ id: 1 });
			const targetCategory = createMockCategory({ id: 2, name: "할 일" });
			mockTodoCategoryDb.findFirst
				.mockResolvedValueOnce(mockCategory)
				.mockResolvedValueOnce(targetCategory);
			mockTodoCategoryDb.count.mockResolvedValue(2);
			mockTodoDb.count.mockResolvedValue(5);
			mockTodoDb.updateMany.mockResolvedValue({ count: 5 });
			mockTodoCategoryDb.delete.mockResolvedValue(mockCategory);

			// When - 카테고리 삭제 (Todo 이동 지정)
			await service.delete({
				userId: mockUserId,
				categoryId: 1,
				moveToCategoryId: 2,
			});

			// Then - Todo가 이동되고 카테고리가 삭제됨
			expect(mockTodoDb.updateMany).toHaveBeenCalledWith({
				where: { categoryId: 1 },
				data: { categoryId: 2 },
			});
			expect(mockTodoCategoryDb.delete).toHaveBeenCalled();
		});

		it("마지막 카테고리 삭제 시 BusinessException을 던진다", async () => {
			// Given - 마지막 남은 카테고리
			const mockCategory = createMockCategory();
			mockTodoCategoryDb.findFirst.mockResolvedValue(mockCategory);
			mockTodoCategoryDb.count.mockResolvedValue(1);

			// When & Then - 예외 발생 검증
			await expect(
				service.delete({
					userId: mockUserId,
					categoryId: mockCategoryId,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("존재하지 않는 카테고리 삭제 시 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 카테고리
			mockTodoCategoryDb.findFirst.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(
				service.delete({
					userId: mockUserId,
					categoryId: 999,
				}),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("reorder 통합 테스트", () => {
		it("카테고리를 특정 카테고리 앞으로 이동한다", async () => {
			// Given - 카테고리 순서 변경 준비
			const category1 = createMockCategory({ id: 1, sortOrder: 0 });
			const _category2 = createMockCategory({ id: 2, sortOrder: 1 });
			const category3 = createMockCategory({ id: 3, sortOrder: 2 });

			mockTodoCategoryDb.findFirst
				.mockResolvedValueOnce(category3)
				.mockResolvedValueOnce(category1);
			mockTodoCategoryDb.updateMany.mockResolvedValue({ count: 2 });
			mockTodoCategoryDb.update.mockResolvedValue({
				...category3,
				sortOrder: 0,
			});

			// When - 카테고리 3을 카테고리 1 앞으로 이동
			const result = await service.reorder({
				userId: mockUserId,
				categoryId: 3,
				targetCategoryId: 1,
				position: "before",
			});

			// Then - sortOrder가 0으로 변경됨
			expect(result.sortOrder).toBe(0);
		});

		it("카테고리를 맨 뒤로 이동한다", async () => {
			// Given - 맨 뒤로 이동할 카테고리 준비
			const category1 = createMockCategory({ id: 1, sortOrder: 0 });
			mockTodoCategoryDb.findFirst.mockResolvedValue(category1);
			mockTodoCategoryDb.aggregate.mockResolvedValue({
				_max: { sortOrder: 2 },
			});
			mockTodoCategoryDb.updateMany.mockResolvedValue({ count: 2 });
			mockTodoCategoryDb.update.mockResolvedValue({
				...category1,
				sortOrder: 2,
			});

			// When - 카테고리 1을 맨 뒤로 이동
			const result = await service.reorder({
				userId: mockUserId,
				categoryId: 1,
				position: "after",
			});

			// Then - sortOrder가 2로 변경됨
			expect(result.sortOrder).toBe(2);
		});

		it("카테고리를 맨 앞으로 이동한다", async () => {
			// Given - 맨 앞으로 이동할 카테고리 준비
			const category3 = createMockCategory({ id: 3, sortOrder: 2 });
			mockTodoCategoryDb.findFirst.mockResolvedValue(category3);
			mockTodoCategoryDb.updateMany.mockResolvedValue({ count: 2 });
			mockTodoCategoryDb.update.mockResolvedValue({
				...category3,
				sortOrder: 0,
			});

			// When - 카테고리 3을 맨 앞으로 이동
			const result = await service.reorder({
				userId: mockUserId,
				categoryId: 3,
				position: "before",
			});

			// Then - sortOrder가 0으로 변경됨
			expect(result.sortOrder).toBe(0);
		});

		it("자기 자신을 타겟으로 지정하면 변경 없이 반환한다", async () => {
			// Given - 자기 자신을 타겟으로 지정
			const category = createMockCategory();
			mockTodoCategoryDb.findFirst
				.mockResolvedValueOnce(category)
				.mockResolvedValueOnce(category);

			// When - 자기 자신 앞으로 이동 시도
			const result = await service.reorder({
				userId: mockUserId,
				categoryId: mockCategoryId,
				targetCategoryId: mockCategoryId,
				position: "before",
			});

			// Then - 변경 없이 반환
			expect(result).toEqual(category);
			expect(mockTodoCategoryDb.update).not.toHaveBeenCalled();
		});

		it("존재하지 않는 카테고리 이동 시 BusinessException을 던진다", async () => {
			// Given - 존재하지 않는 카테고리
			mockTodoCategoryDb.findFirst.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(
				service.reorder({
					userId: mockUserId,
					categoryId: 999,
					position: "before",
				}),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("validateOwnership 통합 테스트", () => {
		it("소유권을 확인하고 카테고리를 반환한다", async () => {
			// Given - 소유권 확인할 카테고리 준비
			const mockCategory = createMockCategory();
			mockTodoCategoryDb.findFirst.mockResolvedValue(mockCategory);

			// When - 소유권 확인
			const result = await service.validateOwnership(
				mockCategoryId,
				mockUserId,
			);

			// Then - 카테고리 반환
			expect(result).toEqual(mockCategory);
		});

		it("소유하지 않은 카테고리 확인 시 BusinessException을 던진다", async () => {
			// Given - 다른 사용자의 카테고리
			mockTodoCategoryDb.findFirst.mockResolvedValue(null);

			// When & Then - 예외 발생 검증
			await expect(
				service.validateOwnership(mockCategoryId, "other-user"),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("에러 핸들링 통합 테스트", () => {
		it("Repository 에러가 적절하게 전파된다", async () => {
			// Given - DB 연결 실패 시뮬레이션
			mockTodoCategoryDb.findFirst.mockResolvedValue(null);
			mockTodoCategoryDb.aggregate.mockResolvedValue({
				_max: { sortOrder: 0 },
			});
			mockTodoCategoryDb.create.mockRejectedValue(
				new Error("Database connection failed"),
			);

			// When & Then - 에러 전파 검증
			await expect(
				service.create({
					userId: mockUserId,
					name: "테스트",
					color: "#FF0000",
				}),
			).rejects.toThrow("Database connection failed");
		});

		it("BusinessException이 적절하게 던져진다", async () => {
			// Given - 존재하지 않는 카테고리
			mockTodoCategoryDb.findUnique.mockResolvedValue(null);

			// When & Then - BusinessException 검증
			try {
				await service.findById(999, mockUserId);
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessException);
				expect((error as BusinessException).errorCode).toContain(
					"TODO_CATEGORY",
				);
			}
		});
	});

	describe("트랜잭션 통합 테스트", () => {
		it("delete에서 트랜잭션이 올바르게 사용된다", async () => {
			// Given - 삭제할 카테고리 준비
			const mockCategory = createMockCategory();
			mockTodoCategoryDb.findFirst.mockResolvedValue(mockCategory);
			mockTodoCategoryDb.count.mockResolvedValue(2);
			mockTodoDb.count.mockResolvedValue(0);
			mockTodoCategoryDb.delete.mockResolvedValue(mockCategory);

			// When - 카테고리 삭제
			await service.delete({
				userId: mockUserId,
				categoryId: mockCategoryId,
			});

			// Then - 트랜잭션이 사용됨
			expect(mockDatabaseService.$transaction).toHaveBeenCalled();
		});

		it("reorder에서 트랜잭션이 올바르게 사용된다", async () => {
			// Given - 재정렬할 카테고리 준비
			const mockCategory = createMockCategory();
			mockTodoCategoryDb.findFirst.mockResolvedValue(mockCategory);
			mockTodoCategoryDb.updateMany.mockResolvedValue({ count: 0 });
			mockTodoCategoryDb.update.mockResolvedValue(mockCategory);

			// When - 카테고리 재정렬
			await service.reorder({
				userId: mockUserId,
				categoryId: mockCategoryId,
				position: "before",
			});

			// Then - 트랜잭션이 사용됨
			expect(mockDatabaseService.$transaction).toHaveBeenCalled();
		});
	});
});
