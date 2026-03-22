/**
 * TodoRepository 단위 테스트
 *
 * Suites + Builder + GWT 패턴 적용
 * - Suites: 자동 Mock 생성
 * - Builder: TodoBuilder로 테스트 데이터 생성
 * - GWT: Given/When/Then 주석
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";
import { DatabaseService } from "@/database/database.service";

import { TodoRepository } from "./todo.repository";
import type {
	FindFriendTodosParams,
	FindTodosParams,
} from "./types/todo.types";

// =============================================================================
// Test Suite
// =============================================================================

describe("TodoRepository", () => {
	let repository: TodoRepository;
	let db: Mocked<DatabaseService>;

	beforeEach(async () => {
		// ID 카운터 리셋
		TodoBuilder.resetIdCounter();

		const { unit, unitRef } = await TestBed.solitary(TodoRepository).compile();

		repository = unit;
		db = unitRef.get(DatabaseService);
	});

	// ==========================================================================
	// findManyByUserId
	// ==========================================================================

	describe("findManyByUserId", () => {
		it("사용자의 Todo 목록을 조회해야 한다", async () => {
			// Given
			const params: FindTodosParams = {
				userId: "user-1",
				size: 10,
			};
			const todos = [
				TodoBuilder.create("user-1").withId(1).build(),
				TodoBuilder.create("user-1").withId(2).build(),
			];
			(db.todo.findMany as jest.Mock).mockResolvedValue(todos);

			// When
			const result = await repository.findManyByUserId(params);

			// Then
			expect(db.todo.findMany).toHaveBeenCalledWith({
				where: { userId: "user-1" },
				take: 11, // size + 1 for pagination check
				orderBy: [
					{ category: { sortOrder: "asc" } },
					{ sortOrder: "asc" },
					{ id: "asc" },
				],
				include: {
					category: {
						select: { id: true, name: true, color: true, sortOrder: true },
					},
					items: {
						select: {
							id: true,
							title: true,
							completed: true,
							sortOrder: true,
							createdAt: true,
							updatedAt: true,
						},
						orderBy: { sortOrder: "asc" },
					},
				},
			});
			expect(result).toEqual(todos);
		});

		it("커서 기반 페이지네이션을 적용해야 한다", async () => {
			// Given
			const params: FindTodosParams = {
				userId: "user-1",
				cursor: 5,
				size: 10,
			};
			const todos = [TodoBuilder.create("user-1").withId(4).build()];
			(db.todo.findMany as jest.Mock).mockResolvedValue(todos);

			// When
			const result = await repository.findManyByUserId(params);

			// Then
			expect(db.todo.findMany).toHaveBeenCalledWith({
				where: { userId: "user-1" },
				take: 11,
				skip: 1,
				cursor: { id: 5 },
				orderBy: [
					{ category: { sortOrder: "asc" } },
					{ sortOrder: "asc" },
					{ id: "asc" },
				],
				include: {
					category: {
						select: { id: true, name: true, color: true, sortOrder: true },
					},
					items: {
						select: {
							id: true,
							title: true,
							completed: true,
							sortOrder: true,
							createdAt: true,
							updatedAt: true,
						},
						orderBy: { sortOrder: "asc" },
					},
				},
			});
			expect(result).toEqual(todos);
		});

		it("cursor가 0이면 skip과 cursor가 적용된다", async () => {
			// Given - cursor가 0 (falsy이지만 유효한 값, Int autoincrement ID)
			const params: FindTodosParams = {
				userId: "user-1",
				cursor: 0,
				size: 10,
			};
			(db.todo.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findManyByUserId(params);

			// Then - cursor가 0이어도 skip: 1, cursor: { id: 0 }이 적용되어야 함
			expect(db.todo.findMany).toHaveBeenCalledWith({
				where: { userId: "user-1" },
				take: 11,
				skip: 1,
				cursor: { id: 0 },
				orderBy: [
					{ category: { sortOrder: "asc" } },
					{ sortOrder: "asc" },
					{ id: "asc" },
				],
				include: {
					category: {
						select: { id: true, name: true, color: true, sortOrder: true },
					},
					items: {
						select: {
							id: true,
							title: true,
							completed: true,
							sortOrder: true,
							createdAt: true,
							updatedAt: true,
						},
						orderBy: { sortOrder: "asc" },
					},
				},
			});
		});

		it("완료 상태로 필터링해야 한다", async () => {
			// Given
			const params: FindTodosParams = {
				userId: "user-1",
				size: 10,
				completed: true,
			};
			(db.todo.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findManyByUserId(params);

			// Then
			expect(db.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						userId: "user-1",
						completed: true,
					}),
				}),
			);
		});

		it("카테고리로 필터링해야 한다", async () => {
			// Given
			const params: FindTodosParams = {
				userId: "user-1",
				size: 10,
				categoryId: 3,
			};
			(db.todo.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findManyByUserId(params);

			// Then
			expect(db.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						userId: "user-1",
						categoryId: 3,
					}),
				}),
			);
		});

		it("날짜 범위로 필터링해야 한다", async () => {
			// Given
			const startDate = new Date("2024-01-01");
			const endDate = new Date("2024-01-31");
			const params: FindTodosParams = {
				userId: "user-1",
				size: 10,
				startDate,
				endDate,
			};
			(db.todo.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findManyByUserId(params);

			// Then
			expect(db.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						userId: "user-1",
						AND: expect.any(Array),
					}),
				}),
			);
		});

		it("category.sortOrder, sortOrder, id 기준으로 정렬된다", async () => {
			// Given - orderBy가 복합키로 설정되어야 함
			const params: FindTodosParams = {
				userId: "user-1",
				size: 10,
			};
			(db.todo.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findManyByUserId(params);

			// Then - orderBy가 복합키 배열인지 검증
			const callArgs = (db.todo.findMany as jest.Mock).mock.calls[0]?.[0];
			expect(callArgs?.orderBy).toEqual([
				{ category: { sortOrder: "asc" } },
				{ sortOrder: "asc" },
				{ id: "asc" },
			]);
		});
	});

	// ==========================================================================
	// findPublicTodosByUserId
	// ==========================================================================

	describe("findPublicTodosByUserId", () => {
		it("친구의 PUBLIC Todo 목록을 조회해야 한다", async () => {
			// Given
			const params: FindFriendTodosParams = {
				friendUserId: "friend-1",
				size: 10,
			};
			const todos = [
				TodoBuilder.create("friend-1").withId(1).asPublic().build(),
				TodoBuilder.create("friend-1").withId(2).asPublic().build(),
			];
			(db.todo.findMany as jest.Mock).mockResolvedValue(todos);

			// When
			const result = await repository.findPublicTodosByUserId(params);

			// Then
			expect(db.todo.findMany).toHaveBeenCalledWith({
				where: {
					userId: "friend-1",
					visibility: "PUBLIC",
				},
				take: 11,
				orderBy: [
					{ category: { sortOrder: "asc" } },
					{ sortOrder: "asc" },
					{ id: "asc" },
				],
				include: {
					category: {
						select: { id: true, name: true, color: true, sortOrder: true },
					},
					items: {
						select: {
							id: true,
							title: true,
							completed: true,
							sortOrder: true,
							createdAt: true,
							updatedAt: true,
						},
						orderBy: { sortOrder: "asc" },
					},
				},
			});
			expect(result).toEqual(todos);
		});

		it("커서 기반 페이지네이션을 적용해야 한다", async () => {
			// Given
			const params: FindFriendTodosParams = {
				friendUserId: "friend-1",
				cursor: 5,
				size: 10,
			};
			(db.todo.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findPublicTodosByUserId(params);

			// Then
			expect(db.todo.findMany).toHaveBeenCalledWith({
				where: {
					userId: "friend-1",
					visibility: "PUBLIC",
				},
				take: 11,
				skip: 1,
				cursor: { id: 5 },
				orderBy: [
					{ category: { sortOrder: "asc" } },
					{ sortOrder: "asc" },
					{ id: "asc" },
				],
				include: {
					category: {
						select: { id: true, name: true, color: true, sortOrder: true },
					},
					items: {
						select: {
							id: true,
							title: true,
							completed: true,
							sortOrder: true,
							createdAt: true,
							updatedAt: true,
						},
						orderBy: { sortOrder: "asc" },
					},
				},
			});
		});

		it("cursor가 0이면 skip과 cursor가 적용된다", async () => {
			// Given - cursor가 0 (falsy이지만 유효한 값, Int autoincrement ID)
			const params: FindFriendTodosParams = {
				friendUserId: "friend-1",
				cursor: 0,
				size: 10,
			};
			(db.todo.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findPublicTodosByUserId(params);

			// Then - cursor가 0이어도 skip: 1, cursor: { id: 0 }이 적용되어야 함
			expect(db.todo.findMany).toHaveBeenCalledWith({
				where: {
					userId: "friend-1",
					visibility: "PUBLIC",
				},
				take: 11,
				skip: 1,
				cursor: { id: 0 },
				orderBy: [
					{ category: { sortOrder: "asc" } },
					{ sortOrder: "asc" },
					{ id: "asc" },
				],
				include: {
					category: {
						select: { id: true, name: true, color: true, sortOrder: true },
					},
					items: {
						select: {
							id: true,
							title: true,
							completed: true,
							sortOrder: true,
							createdAt: true,
							updatedAt: true,
						},
						orderBy: { sortOrder: "asc" },
					},
				},
			});
		});

		it("날짜 범위로 필터링해야 한다", async () => {
			// Given
			const startDate = new Date("2024-01-01");
			const endDate = new Date("2024-01-31");
			const params: FindFriendTodosParams = {
				friendUserId: "friend-1",
				size: 10,
				startDate,
				endDate,
			};
			(db.todo.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findPublicTodosByUserId(params);

			// Then
			expect(db.todo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						userId: "friend-1",
						visibility: "PUBLIC",
						AND: expect.any(Array),
					}),
				}),
			);
		});

		it("category.sortOrder, sortOrder, id 기준으로 정렬된다", async () => {
			// Given - orderBy가 복합키로 설정되어야 함
			const params: FindFriendTodosParams = {
				friendUserId: "friend-1",
				size: 10,
			};
			(db.todo.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findPublicTodosByUserId(params);

			// Then - orderBy가 복합키 배열인지 검증
			const callArgs = (db.todo.findMany as jest.Mock).mock.calls[0]?.[0];
			expect(callArgs?.orderBy).toEqual([
				{ category: { sortOrder: "asc" } },
				{ sortOrder: "asc" },
				{ id: "asc" },
			]);
		});
	});

	// ==========================================================================
	// createManyBatch
	// ==========================================================================

	describe("createManyBatch", () => {
		const recurrenceGroupId = "test-group-id";
		const mockTx = {
			todo: {
				createMany: jest.fn().mockResolvedValue({ count: 2 }),
				findMany: jest
					.fn()
					.mockResolvedValue([
						TodoBuilder.create("user-1").withId(1).build(),
						TodoBuilder.create("user-1").withId(2).build(),
					]),
			},
		};

		it("createMany로 일괄 INSERT 후 findMany로 조회한다", async () => {
			// Given
			const dataArray = [
				{
					userId: "user-1",
					categoryId: 1,
					title: "할 일 1",
					sortOrder: 0,
					startDate: new Date("2024-01-15"),
					recurrenceGroupId,
				},
				{
					userId: "user-1",
					categoryId: 1,
					title: "할 일 2",
					sortOrder: 1,
					startDate: new Date("2024-01-16"),
					recurrenceGroupId,
				},
			];

			// When
			const result = await repository.createManyBatch(
				dataArray,
				recurrenceGroupId,
				mockTx as never,
			);

			// Then - createMany가 전체 데이터로 호출됨
			expect(mockTx.todo.createMany).toHaveBeenCalledWith({
				data: dataArray,
			});

			// Then - findMany가 recurrenceGroupId로 조회됨
			expect(mockTx.todo.findMany).toHaveBeenCalledWith({
				where: { recurrenceGroupId },
				include: {
					category: {
						select: { id: true, name: true, color: true, sortOrder: true },
					},
					items: {
						select: {
							id: true,
							title: true,
							completed: true,
							sortOrder: true,
							createdAt: true,
							updatedAt: true,
						},
						orderBy: { sortOrder: "asc" },
					},
				},
				orderBy: { sortOrder: "asc" },
			});

			expect(result).toHaveLength(2);
		});
	});
});
