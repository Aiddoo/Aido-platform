import { TransactionHost } from "@nestjs-cls/transactional";
/**
 * TodoCategory 모듈 통합 테스트 (Mock DB)
 *
 * endpoint use-case·TodoCategoryReader가
 * PrismaTodoCategoryRepository(Mock DB)·캐시 어댑터·EntitlementService와 함께 DI로 조립되고
 * 동작하는지 검증한다. HTTP 계약은 e2e가 담당하며 여기서는 ApplicationException 발생만 확인한다.
 *
 * 실행: pnpm --filter @aido/api test:integration -- --testPathPattern=todo-category.integration
 */
import { Test, type TestingModule } from "@nestjs/testing";
import { vi } from "vitest";

import { EntitlementService } from "#api/shared/application/entitlement/entitlement.service";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { CacheService } from "#api/shared/infrastructure/cache/cache.service";
import type { TodoCategory } from "#api/shared/infrastructure/database/database.types";
import { TODO_CATEGORY_CACHE } from "#api/todo-category/application/ports/todo-category-cache.port";
import { TODO_CATEGORY_LIMIT_READER } from "#api/todo-category/application/ports/todo-category-limit-reader.port";
import { TODO_CATEGORY_REPOSITORY } from "#api/todo-category/application/ports/todo-category.repository.port";
import { TodoCategoryReader } from "#api/todo-category/application/services/todo-category.reader";
import { CreateTodoCategoryUseCase } from "#api/todo-category/application/use-cases/create-todo-category/create-todo-category.use-case";
import { DeleteTodoCategoryUseCase } from "#api/todo-category/application/use-cases/delete-todo-category/delete-todo-category.use-case";
import { ReorderTodoCategoryUseCase } from "#api/todo-category/application/use-cases/reorder-todo-category/reorder-todo-category.use-case";
import { UpdateTodoCategoryUseCase } from "#api/todo-category/application/use-cases/update-todo-category/update-todo-category.use-case";
import { TodoCategoryCacheAdapter } from "#api/todo-category/infrastructure/adapters/todo-category-cache.adapter";
import { PrismaTodoCategoryRepository } from "#api/todo-category/infrastructure/persistence/prisma-todo-category.repository";
import { DefaultTodoCategorySeeder } from "#api/todo-category/infrastructure/seeders/default-todo-category.seeder";
import { TodoCategoryBuilder } from "#test/builders/index";
import { asMock } from "#test/mocks/bull-job.mock";
import {
	assertNativeOrder,
	assertNativeWhere,
	createMockDatabaseContext,
	databaseFixture,
	databaseWriteExpectation,
	nativeRows,
} from "#test/mocks/database.mock";
import { createUnitOfWorkMock } from "#test/mocks/ports/index";
import { suppressLogger } from "#test/setup/suppress-logger";

describe("TodoCategory 모듈 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let reader: TodoCategoryReader;
	let createUseCase: CreateTodoCategoryUseCase;
	let updateUseCase: UpdateTodoCategoryUseCase;
	let deleteUseCase: DeleteTodoCategoryUseCase;
	let reorderUseCase: ReorderTodoCategoryUseCase;

	const nativeContext = createMockDatabaseContext();
	const mockTodoCategoryDb = nativeContext.orm.public.TodoCategory;
	const mockTodoDb = nativeContext.orm.public.Todo;
	const mockUnitOfWork = createUnitOfWorkMock();

	const userId = "user-category-123";
	const categoryId = 1;

	const makeCategory = (overrides: Partial<TodoCategory> = {}): TodoCategory => {
		const builder = TodoCategoryBuilder.create(userId)
			.withId(overrides.id ?? categoryId)
			.withName(overrides.name ?? "중요한 일")
			.withColor(overrides.color ?? "#FFB3B3")
			.withSortOrder(overrides.sortOrder ?? 0);
		const built = builder.build();
		return overrides.userId ? { ...built, userId: overrides.userId } : built;
	};

	const makeWithCount = (overrides: Partial<TodoCategory> = {}, todoCount = 0) => ({
		...makeCategory(overrides),
		todos: todoCount,
	});

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				TodoCategoryReader,
				CreateTodoCategoryUseCase,
				UpdateTodoCategoryUseCase,
				DeleteTodoCategoryUseCase,
				ReorderTodoCategoryUseCase,
				DefaultTodoCategorySeeder,
				{
					provide: TODO_CATEGORY_REPOSITORY,
					useClass: PrismaTodoCategoryRepository,
				},
				{ provide: TODO_CATEGORY_CACHE, useClass: TodoCategoryCacheAdapter },
				{
					provide: TODO_CATEGORY_LIMIT_READER,
					useValue: { getMaxCountInTx: async () => null },
				},
				{
					provide: MUTATION_LOCK,
					useValue: { acquire: async () => undefined },
				},
				{ provide: UNIT_OF_WORK, useValue: mockUnitOfWork },
				{ provide: TransactionHost, useValue: { tx: nativeContext } },
				{
					provide: EntitlementService,
					useValue: {
						getResourceLimit: vi.fn().mockResolvedValue({
							maxCount: null,
							isAdmin: false,
							subscriptionStatus: "ACTIVE",
						}),
					},
				},
				{
					provide: CacheService,
					useValue: {
						invalidateTodoCategories: vi.fn().mockResolvedValue(undefined),
						wrapTodoCategories: vi.fn().mockImplementation((_userId, factory) => factory()),
					},
				},
			],
		}).compile();

		reader = module.get(TodoCategoryReader);
		createUseCase = module.get(CreateTodoCategoryUseCase);
		updateUseCase = module.get(UpdateTodoCategoryUseCase);
		deleteUseCase = module.get(DeleteTodoCategoryUseCase);
		reorderUseCase = module.get(ReorderTodoCategoryUseCase);
	});

	afterAll(async () => {
		await module.close();
		vi.restoreAllMocks();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		TodoCategoryBuilder.resetIdCounter();
		nativeContext.execute.mockResolvedValue({ affectedRows: 1 });
	});

	describe("DI 통합", () => {
		it("endpoint use-case와 reader가 조립된다", () => {
			expect(reader).toBeInstanceOf(TodoCategoryReader);
			expect(createUseCase).toBeInstanceOf(CreateTodoCategoryUseCase);
		});
		it("Repository 포트가 주입된다", () => {
			expect(module.get(TODO_CATEGORY_REPOSITORY)).toBeInstanceOf(PrismaTodoCategoryRepository);
		});
	});

	describe("생성", () => {
		it("카테고리를 생성하고 맨 뒤 순번을 부여한다", async () => {
			asMock(mockTodoCategoryDb.aggregate).mockResolvedValue({ count: 1 });
			asMock(mockTodoCategoryDb.first).mockResolvedValue(databaseFixture("TodoCategory", null));
			asMock(mockTodoCategoryDb.aggregate).mockResolvedValue(
				databaseFixture("TodoCategory", {
					maximum: 0,
				}),
			);
			asMock(mockTodoCategoryDb.create).mockResolvedValue(
				databaseFixture("TodoCategory", makeCategory({ name: "새 카테고리" })),
			);

			const result = await createUseCase.execute({
				userId,
				name: "새 카테고리",
				color: "#FFB3B3",
			});

			expect(result.name).toBe("새 카테고리");
			expect(mockTodoCategoryDb.create).toHaveBeenCalledWith(
				expect.objectContaining(
					databaseWriteExpectation("TodoCategory", {
						userId,
						name: "새 카테고리",
						color: "#FFB3B3",
						sortOrder: 1,
					}),
				),
			);
		});

		it("중복 이름이면 ApplicationException", async () => {
			asMock(mockTodoCategoryDb.aggregate).mockResolvedValue({ count: 1 });
			asMock(mockTodoCategoryDb.first).mockResolvedValue(
				databaseFixture("TodoCategory", makeCategory()),
			);

			await expect(
				createUseCase.execute({ userId, name: "중요한 일", color: "#FFB3B3" }),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("단건 조회", () => {
		it("카테고리를 todoCount와 함께 조회한다", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(
				databaseFixture("TodoCategory", makeWithCount({}, 3)),
			);

			const result = await reader.findById(categoryId, userId);

			expect(result.id).toBe(categoryId);
			expect(result.todoCount).toBe(3);
		});

		it("존재하지 않으면 ApplicationException", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(databaseFixture("TodoCategory", null));
			await expect(reader.findById(999, userId)).rejects.toThrow(ApplicationException);
		});

		it("다른 사용자의 카테고리면 ApplicationException", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(
				databaseFixture("TodoCategory", makeWithCount({ userId: "other-user" })),
			);
			await expect(reader.findById(categoryId, userId)).rejects.toThrow(ApplicationException);
		});
	});

	describe("목록 조회", () => {
		it("sortOrder 오름차순으로 조회한다", async () => {
			mockTodoCategoryDb.all.mockReturnValue(
				nativeRows(
					databaseFixture("TodoCategory", [
						makeWithCount({ id: 1, name: "중요한 일", sortOrder: 0 }),
						makeWithCount({ id: 2, name: "할 일", sortOrder: 1 }),
					]),
				),
			);

			const result = await reader.findMany(userId);

			expect(result).toHaveLength(2);
			assertNativeWhere("TodoCategory", mockTodoCategoryDb.where.mock.calls.at(-1)?.[0], (row) =>
				row.userId.eq(userId),
			);
			assertNativeOrder("TodoCategory", mockTodoCategoryDb.orderBy.mock.calls[0]?.[0], (row) =>
				row.sortOrder.asc(),
			);
		});
	});

	describe("수정", () => {
		it("이름/색상을 수정한다", async () => {
			asMock(mockTodoCategoryDb.first)
				.mockResolvedValueOnce(databaseFixture("TodoCategory", makeCategory()))
				.mockResolvedValueOnce(null);
			asMock(mockTodoCategoryDb.update).mockResolvedValue(
				databaseFixture("TodoCategory", makeCategory({ name: "수정된 이름", color: "#FF0000" })),
			);

			const result = await updateUseCase.execute(categoryId, userId, {
				name: "수정된 이름",
				color: "#FF0000",
			});

			expect(result.name).toBe("수정된 이름");
			expect(result.color).toBe("#FF0000");
		});

		it("중복 이름이면 ApplicationException", async () => {
			asMock(mockTodoCategoryDb.first)
				.mockResolvedValueOnce(
					databaseFixture("TodoCategory", makeCategory({ id: 1, name: "카테고리 1" })),
				)
				.mockResolvedValueOnce(
					databaseFixture("TodoCategory", makeCategory({ id: 2, name: "카테고리 2" })),
				);

			await expect(updateUseCase.execute(1, userId, { name: "카테고리 2" })).rejects.toThrow(
				ApplicationException,
			);
		});

		it("존재하지 않으면 ApplicationException", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(databaseFixture("TodoCategory", null));
			await expect(updateUseCase.execute(999, userId, { name: "수정" })).rejects.toThrow(
				ApplicationException,
			);
		});
	});

	describe("삭제", () => {
		it("할 일이 없는 카테고리를 삭제한다", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(
				databaseFixture("TodoCategory", makeCategory()),
			);
			asMock(mockTodoCategoryDb.aggregate).mockResolvedValue({ count: 2 });
			asMock(mockTodoDb.aggregate).mockResolvedValue({ count: 0 });
			asMock(mockTodoCategoryDb.delete).mockResolvedValue(
				databaseFixture("TodoCategory", makeCategory()),
			);

			await deleteUseCase.execute({ userId, categoryId });

			assertNativeWhere("TodoCategory", mockTodoCategoryDb.where.mock.calls.at(-1)?.[0], (row) =>
				row.id.eq(categoryId),
			);
			expect(mockUnitOfWork.run).toHaveBeenCalled();
		});

		it("할 일이 있는데 이동 대상이 없으면 ApplicationException", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(
				databaseFixture("TodoCategory", makeCategory()),
			);
			asMock(mockTodoCategoryDb.aggregate).mockResolvedValue({ count: 2 });
			asMock(mockTodoDb.aggregate).mockResolvedValue({ count: 5 });

			await expect(deleteUseCase.execute({ userId, categoryId })).rejects.toThrow(
				ApplicationException,
			);
		});

		it("할 일을 이동 후 삭제한다", async () => {
			asMock(mockTodoCategoryDb.first)
				.mockResolvedValueOnce(databaseFixture("TodoCategory", makeCategory({ id: 1 })))
				.mockResolvedValueOnce(
					databaseFixture("TodoCategory", makeCategory({ id: 2, name: "할 일" })),
				);
			asMock(mockTodoCategoryDb.aggregate).mockResolvedValue({ count: 2 });
			asMock(mockTodoDb.aggregate).mockResolvedValue({ count: 5 });
			asMock(mockTodoDb.updateAndCount).mockResolvedValue(5);
			asMock(mockTodoCategoryDb.delete).mockResolvedValue(
				databaseFixture("TodoCategory", makeCategory({ id: 1 })),
			);

			await deleteUseCase.execute({
				userId,
				categoryId: 1,
				moveToCategoryId: 2,
			});

			assertNativeWhere("Todo", mockTodoDb.where.mock.calls.at(-1)?.[0], (row) =>
				row.categoryId.eq(1),
			);
			expect(mockTodoDb.updateAndCount).toHaveBeenCalledWith(
				expect.objectContaining(databaseWriteExpectation("Todo", { categoryId: 2 })),
			);
			expect(mockTodoCategoryDb.delete).toHaveBeenCalled();
		});

		it("마지막 카테고리면 ApplicationException", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(
				databaseFixture("TodoCategory", makeCategory()),
			);
			asMock(mockTodoCategoryDb.aggregate).mockResolvedValue({ count: 1 });
			await expect(deleteUseCase.execute({ userId, categoryId })).rejects.toThrow(
				ApplicationException,
			);
		});

		it("존재하지 않으면 ApplicationException", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(databaseFixture("TodoCategory", null));
			await expect(deleteUseCase.execute({ userId, categoryId: 999 })).rejects.toThrow(
				ApplicationException,
			);
		});
	});

	describe("재배치", () => {
		it("특정 카테고리 앞으로 이동한다", async () => {
			asMock(mockTodoCategoryDb.first)
				.mockResolvedValueOnce(
					databaseFixture("TodoCategory", makeCategory({ id: 3, sortOrder: 2 })),
				)
				.mockResolvedValueOnce(
					databaseFixture("TodoCategory", makeCategory({ id: 1, sortOrder: 0 })),
				);
			asMock(mockTodoCategoryDb.updateAndCount).mockResolvedValue(2);
			asMock(mockTodoCategoryDb.update).mockResolvedValue(
				databaseFixture("TodoCategory", makeCategory({ id: 3, sortOrder: 0 })),
			);

			const result = await reorderUseCase.execute({
				userId,
				categoryId: 3,
				targetCategoryId: 1,
				position: "before",
			});

			expect(result.sortOrder).toBe(0);
			expect(mockUnitOfWork.run).toHaveBeenCalled();
		});

		it("맨 뒤로 이동한다", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(
				databaseFixture("TodoCategory", makeCategory({ id: 1, sortOrder: 0 })),
			);
			asMock(mockTodoCategoryDb.aggregate).mockResolvedValue(
				databaseFixture("TodoCategory", {
					maximum: 2,
				}),
			);
			asMock(mockTodoCategoryDb.updateAndCount).mockResolvedValue(2);
			asMock(mockTodoCategoryDb.update).mockResolvedValue(
				databaseFixture("TodoCategory", makeCategory({ id: 1, sortOrder: 2 })),
			);

			const result = await reorderUseCase.execute({
				userId,
				categoryId: 1,
				position: "after",
			});

			expect(result.sortOrder).toBe(2);
		});

		it("자기 자신 대상이면 변경 없이 반환한다", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(
				databaseFixture("TodoCategory", makeCategory()),
			);

			const result = await reorderUseCase.execute({
				userId,
				categoryId,
				targetCategoryId: categoryId,
				position: "before",
			});

			expect(result.id).toBe(categoryId);
			expect(mockTodoCategoryDb.update).not.toHaveBeenCalled();
		});

		it("존재하지 않으면 ApplicationException", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(databaseFixture("TodoCategory", null));
			await expect(
				reorderUseCase.execute({ userId, categoryId: 999, position: "before" }),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("소유권 검증 (크로스모듈)", () => {
		it("소유하면 통과한다", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(
				databaseFixture("TodoCategory", makeCategory()),
			);
			await expect(reader.validateOwnership(categoryId, userId)).resolves.toBeUndefined();
		});

		it("미소유면 ApplicationException", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(databaseFixture("TodoCategory", null));
			await expect(reader.validateOwnership(categoryId, "other-user")).rejects.toThrow(
				ApplicationException,
			);
		});
	});

	describe("에러 전파", () => {
		it("Repository 비-SQLSTATE 23505 에러는 그대로 전파된다", async () => {
			asMock(mockTodoCategoryDb.aggregate).mockResolvedValue({ count: 1 });
			asMock(mockTodoCategoryDb.first).mockResolvedValue(databaseFixture("TodoCategory", null));
			asMock(mockTodoCategoryDb.aggregate).mockResolvedValue(
				databaseFixture("TodoCategory", {
					maximum: 0,
				}),
			);
			mockTodoCategoryDb.create.mockRejectedValue(new Error("Database connection failed"));

			await expect(
				createUseCase.execute({ userId, name: "테스트", color: "#FF0000" }),
			).rejects.toThrow("Database connection failed");
		});

		it("findById ApplicationException의 errorCode는 TODO_CATEGORY 계열이다", async () => {
			asMock(mockTodoCategoryDb.first).mockResolvedValue(databaseFixture("TodoCategory", null));
			try {
				await reader.findById(999, userId);
				throw new Error("should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(ApplicationException);
				expect((error as ApplicationException).errorCode).toContain("TODO_CATEGORY");
			}
		});
	});
});
