/**
 * TodoCategory 모듈 통합 테스트 (Mock DB)
 *
 * 클린아키텍처(무버스 use-case) 구조로 재작성. TodoCategoryFacade·use-case·TodoCategoryReader가
 * PrismaTodoCategoryRepository(Mock DB)·캐시 어댑터·EntitlementService와 함께 DI로 조립되고
 * 동작하는지 검증한다. HTTP 계약은 e2e가 담당하며 여기서는 ApplicationException 발생만 확인한다.
 *
 * 실행: pnpm --filter @aido/api test:integration -- --testPathPattern=todo-category.integration
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { TransactionHost } from "@nestjs-cls/transactional";
import { TodoCategoryBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { createUnitOfWorkMock } from "@test/mocks/ports";
import { suppressLogger } from "@test/setup/suppress-logger";

import type { TodoCategory } from "@/generated/prisma/client";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { TodoCategoryFacade } from "@/todo-category";
import { TODO_CATEGORY_REPOSITORY } from "@/todo-category/application/ports/todo-category.repository.port";
import { TODO_CATEGORY_CACHE } from "@/todo-category/application/ports/todo-category-cache.port";
import { TodoCategoryReader } from "@/todo-category/application/services/todo-category.reader";
import { CreateTodoCategoryUseCase } from "@/todo-category/application/use-cases/create-todo-category/create-todo-category.use-case";
import { DeleteTodoCategoryUseCase } from "@/todo-category/application/use-cases/delete-todo-category/delete-todo-category.use-case";
import { ReorderTodoCategoryUseCase } from "@/todo-category/application/use-cases/reorder-todo-category/reorder-todo-category.use-case";
import { UpdateTodoCategoryUseCase } from "@/todo-category/application/use-cases/update-todo-category/update-todo-category.use-case";
import { TodoCategoryCacheAdapter } from "@/todo-category/infrastructure/adapters/todo-category-cache.adapter";
import { PrismaTodoCategoryRepository } from "@/todo-category/infrastructure/persistence/prisma-todo-category.repository";

describe("TodoCategory 모듈 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let facade: TodoCategoryFacade;

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
	const mockTodoDb = { updateMany: jest.fn(), count: jest.fn() };
	const mockDatabaseService = createMockDatabaseService({
		todoCategory: mockTodoCategoryDb,
		todo: mockTodoDb,
	});
	const mockUnitOfWork = createUnitOfWorkMock();

	const userId = "user-category-123";
	const categoryId = 1;

	const makeCategory = (
		overrides: Partial<TodoCategory> = {},
	): TodoCategory => {
		const builder = TodoCategoryBuilder.create(userId)
			.withId(overrides.id ?? categoryId)
			.withName(overrides.name ?? "중요한 일")
			.withColor(overrides.color ?? "#FFB3B3")
			.withSortOrder(overrides.sortOrder ?? 0);
		const built = builder.build();
		return overrides.userId ? { ...built, userId: overrides.userId } : built;
	};

	const makeWithCount = (
		overrides: Partial<TodoCategory> = {},
		todoCount = 0,
	) => ({ ...makeCategory(overrides), _count: { todos: todoCount } });

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				TodoCategoryFacade,
				TodoCategoryReader,
				CreateTodoCategoryUseCase,
				UpdateTodoCategoryUseCase,
				DeleteTodoCategoryUseCase,
				ReorderTodoCategoryUseCase,
				{
					provide: TODO_CATEGORY_REPOSITORY,
					useClass: PrismaTodoCategoryRepository,
				},
				{ provide: TODO_CATEGORY_CACHE, useClass: TodoCategoryCacheAdapter },
				{ provide: UNIT_OF_WORK, useValue: mockUnitOfWork },
				{ provide: TransactionHost, useValue: { tx: mockDatabaseService } },
				{
					provide: EntitlementService,
					useValue: {
						getResourceLimit: jest.fn().mockResolvedValue({
							maxCount: null,
							isAdmin: false,
							subscriptionStatus: "ACTIVE",
						}),
					},
				},
				{
					provide: CacheService,
					useValue: {
						invalidateTodoCategories: jest.fn().mockResolvedValue(undefined),
						wrapTodoCategories: jest
							.fn()
							.mockImplementation((_userId, factory) => factory()),
					},
				},
			],
		}).compile();

		facade = module.get(TodoCategoryFacade);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		for (const method of Object.values(mockTodoCategoryDb)) {
			(method as jest.Mock).mockReset();
		}
		for (const method of Object.values(mockTodoDb)) {
			(method as jest.Mock).mockReset();
		}
		TodoCategoryBuilder.resetIdCounter();
	});

	describe("DI 통합", () => {
		it("TodoCategoryFacade가 조립된다", () => {
			expect(facade).toBeInstanceOf(TodoCategoryFacade);
		});
		it("Repository 포트가 주입된다", () => {
			expect(module.get(TODO_CATEGORY_REPOSITORY)).toBeInstanceOf(
				PrismaTodoCategoryRepository,
			);
		});
	});

	describe("생성", () => {
		it("카테고리를 생성하고 맨 뒤 순번을 부여한다", async () => {
			mockTodoCategoryDb.count.mockResolvedValue(1);
			mockTodoCategoryDb.findFirst.mockResolvedValue(null);
			mockTodoCategoryDb.aggregate.mockResolvedValue({
				_max: { sortOrder: 0 },
			});
			mockTodoCategoryDb.create.mockResolvedValue(
				makeCategory({ name: "새 카테고리" }),
			);

			const result = await facade.create({
				userId,
				name: "새 카테고리",
				color: "#FFB3B3",
			});

			expect(result.name).toBe("새 카테고리");
			expect(mockTodoCategoryDb.create).toHaveBeenCalledWith({
				data: {
					user: { connect: { id: userId } },
					name: "새 카테고리",
					color: "#FFB3B3",
					sortOrder: 1,
				},
			});
		});

		it("중복 이름이면 ApplicationException", async () => {
			mockTodoCategoryDb.count.mockResolvedValue(1);
			mockTodoCategoryDb.findFirst.mockResolvedValue(makeCategory());

			await expect(
				facade.create({ userId, name: "중요한 일", color: "#FFB3B3" }),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("단건 조회", () => {
		it("카테고리를 todoCount와 함께 조회한다", async () => {
			mockTodoCategoryDb.findUnique.mockResolvedValue(makeWithCount({}, 3));

			const result = await facade.findById(categoryId, userId);

			expect(result.id).toBe(categoryId);
			expect(result.todoCount).toBe(3);
		});

		it("존재하지 않으면 ApplicationException", async () => {
			mockTodoCategoryDb.findUnique.mockResolvedValue(null);
			await expect(facade.findById(999, userId)).rejects.toThrow(
				ApplicationException,
			);
		});

		it("다른 사용자의 카테고리면 ApplicationException", async () => {
			mockTodoCategoryDb.findUnique.mockResolvedValue(
				makeWithCount({ userId: "other-user" }),
			);
			await expect(facade.findById(categoryId, userId)).rejects.toThrow(
				ApplicationException,
			);
		});
	});

	describe("목록 조회", () => {
		it("sortOrder 오름차순으로 조회한다", async () => {
			mockTodoCategoryDb.findMany.mockResolvedValue([
				makeWithCount({ id: 1, name: "중요한 일", sortOrder: 0 }),
				makeWithCount({ id: 2, name: "할 일", sortOrder: 1 }),
			]);

			const result = await facade.findMany(userId);

			expect(result).toHaveLength(2);
			expect(mockTodoCategoryDb.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { userId },
					orderBy: { sortOrder: "asc" },
				}),
			);
		});
	});

	describe("수정", () => {
		it("이름/색상을 수정한다", async () => {
			mockTodoCategoryDb.findFirst
				.mockResolvedValueOnce(makeCategory())
				.mockResolvedValueOnce(null);
			mockTodoCategoryDb.update.mockResolvedValue(
				makeCategory({ name: "수정된 이름", color: "#FF0000" }),
			);

			const result = await facade.update(categoryId, userId, {
				name: "수정된 이름",
				color: "#FF0000",
			});

			expect(result.name).toBe("수정된 이름");
			expect(result.color).toBe("#FF0000");
		});

		it("중복 이름이면 ApplicationException", async () => {
			mockTodoCategoryDb.findFirst
				.mockResolvedValueOnce(makeCategory({ id: 1, name: "카테고리 1" }))
				.mockResolvedValueOnce(makeCategory({ id: 2, name: "카테고리 2" }));

			await expect(
				facade.update(1, userId, { name: "카테고리 2" }),
			).rejects.toThrow(ApplicationException);
		});

		it("존재하지 않으면 ApplicationException", async () => {
			mockTodoCategoryDb.findFirst.mockResolvedValue(null);
			await expect(
				facade.update(999, userId, { name: "수정" }),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("삭제", () => {
		it("할 일이 없는 카테고리를 삭제한다", async () => {
			mockTodoCategoryDb.findFirst.mockResolvedValue(makeCategory());
			mockTodoCategoryDb.count.mockResolvedValue(2);
			mockTodoDb.count.mockResolvedValue(0);
			mockTodoCategoryDb.delete.mockResolvedValue(makeCategory());

			await facade.delete({ userId, categoryId });

			expect(mockTodoCategoryDb.delete).toHaveBeenCalledWith({
				where: { id: categoryId },
			});
			expect(mockUnitOfWork.run).toHaveBeenCalled();
		});

		it("할 일이 있는데 이동 대상이 없으면 ApplicationException", async () => {
			mockTodoCategoryDb.findFirst.mockResolvedValue(makeCategory());
			mockTodoCategoryDb.count.mockResolvedValue(2);
			mockTodoDb.count.mockResolvedValue(5);

			await expect(facade.delete({ userId, categoryId })).rejects.toThrow(
				ApplicationException,
			);
		});

		it("할 일을 이동 후 삭제한다", async () => {
			mockTodoCategoryDb.findFirst
				.mockResolvedValueOnce(makeCategory({ id: 1 }))
				.mockResolvedValueOnce(makeCategory({ id: 2, name: "할 일" }));
			mockTodoCategoryDb.count.mockResolvedValue(2);
			mockTodoDb.count.mockResolvedValue(5);
			mockTodoDb.updateMany.mockResolvedValue({ count: 5 });
			mockTodoCategoryDb.delete.mockResolvedValue(makeCategory({ id: 1 }));

			await facade.delete({ userId, categoryId: 1, moveToCategoryId: 2 });

			expect(mockTodoDb.updateMany).toHaveBeenCalledWith({
				where: { categoryId: 1 },
				data: { categoryId: 2 },
			});
			expect(mockTodoCategoryDb.delete).toHaveBeenCalled();
		});

		it("마지막 카테고리면 ApplicationException", async () => {
			mockTodoCategoryDb.findFirst.mockResolvedValue(makeCategory());
			mockTodoCategoryDb.count.mockResolvedValue(1);
			await expect(facade.delete({ userId, categoryId })).rejects.toThrow(
				ApplicationException,
			);
		});

		it("존재하지 않으면 ApplicationException", async () => {
			mockTodoCategoryDb.findFirst.mockResolvedValue(null);
			await expect(facade.delete({ userId, categoryId: 999 })).rejects.toThrow(
				ApplicationException,
			);
		});
	});

	describe("재배치", () => {
		it("특정 카테고리 앞으로 이동한다", async () => {
			mockTodoCategoryDb.findFirst
				.mockResolvedValueOnce(makeCategory({ id: 3, sortOrder: 2 }))
				.mockResolvedValueOnce(makeCategory({ id: 1, sortOrder: 0 }));
			mockTodoCategoryDb.updateMany.mockResolvedValue({ count: 2 });
			mockTodoCategoryDb.update.mockResolvedValue(
				makeCategory({ id: 3, sortOrder: 0 }),
			);

			const result = await facade.reorder({
				userId,
				categoryId: 3,
				targetCategoryId: 1,
				position: "before",
			});

			expect(result.sortOrder).toBe(0);
			expect(mockUnitOfWork.run).toHaveBeenCalled();
		});

		it("맨 뒤로 이동한다", async () => {
			mockTodoCategoryDb.findFirst.mockResolvedValue(
				makeCategory({ id: 1, sortOrder: 0 }),
			);
			mockTodoCategoryDb.aggregate.mockResolvedValue({
				_max: { sortOrder: 2 },
			});
			mockTodoCategoryDb.updateMany.mockResolvedValue({ count: 2 });
			mockTodoCategoryDb.update.mockResolvedValue(
				makeCategory({ id: 1, sortOrder: 2 }),
			);

			const result = await facade.reorder({
				userId,
				categoryId: 1,
				position: "after",
			});

			expect(result.sortOrder).toBe(2);
		});

		it("자기 자신 대상이면 변경 없이 반환한다", async () => {
			mockTodoCategoryDb.findFirst.mockResolvedValue(makeCategory());

			const result = await facade.reorder({
				userId,
				categoryId,
				targetCategoryId: categoryId,
				position: "before",
			});

			expect(result.id).toBe(categoryId);
			expect(mockTodoCategoryDb.update).not.toHaveBeenCalled();
		});

		it("존재하지 않으면 ApplicationException", async () => {
			mockTodoCategoryDb.findFirst.mockResolvedValue(null);
			await expect(
				facade.reorder({ userId, categoryId: 999, position: "before" }),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("소유권 검증 (크로스모듈)", () => {
		it("소유하면 통과한다", async () => {
			mockTodoCategoryDb.findFirst.mockResolvedValue(makeCategory());
			await expect(
				facade.validateOwnership(categoryId, userId),
			).resolves.toBeUndefined();
		});

		it("미소유면 ApplicationException", async () => {
			mockTodoCategoryDb.findFirst.mockResolvedValue(null);
			await expect(
				facade.validateOwnership(categoryId, "other-user"),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("에러 전파", () => {
		it("Repository 비-P2002 에러는 그대로 전파된다", async () => {
			mockTodoCategoryDb.count.mockResolvedValue(1);
			mockTodoCategoryDb.findFirst.mockResolvedValue(null);
			mockTodoCategoryDb.aggregate.mockResolvedValue({
				_max: { sortOrder: 0 },
			});
			mockTodoCategoryDb.create.mockRejectedValue(
				new Error("Database connection failed"),
			);

			await expect(
				facade.create({ userId, name: "테스트", color: "#FF0000" }),
			).rejects.toThrow("Database connection failed");
		});

		it("findById ApplicationException의 errorCode는 TODO_CATEGORY 계열이다", async () => {
			mockTodoCategoryDb.findUnique.mockResolvedValue(null);
			try {
				await facade.findById(999, userId);
				throw new Error("should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(ApplicationException);
				expect((error as ApplicationException).errorCode).toContain(
					"TODO_CATEGORY",
				);
			}
		});
	});
});
