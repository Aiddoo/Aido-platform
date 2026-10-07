import { and, or } from "@prisma/orm-postgres/orm-client";

import { databaseDate } from "#api/shared/infrastructure/database/database-values";
import { TodoBuilder } from "#test/builders/index";
import {
	assertNativeOrder,
	assertNativeWhere,
	createMockDatabaseContext,
	createMockTransactionHost,
	databaseFixture,
	nativeRows,
	type MockDatabaseContext,
} from "#test/mocks/database.mock";

import type { FindTodosParams } from "../../application/types.js";
import { TodoMapper } from "../persistence/todo-response.mapper.js";
import { PrismaTodoReadRepository } from "./prisma-todo-read.repository.js";

for (const publicOnly of [false, true]) {
	describe(publicOnly ? "findPublicTodosByUserId" : "findManyByUserId", () => {
		let repository: PrismaTodoReadRepository;
		let db: MockDatabaseContext;
		const userId = publicOnly ? "friend-1" : "user-1";
		beforeEach(() => {
			TodoBuilder.resetIdCounter();
			db = createMockDatabaseContext();
			db.orm.public.Todo.all.mockReturnValue(nativeRows([]));
			repository = new PrismaTodoReadRepository(createMockTransactionHost(db));
		});
		function find(params: Omit<FindTodosParams, "userId"> = { size: 10 }) {
			return publicOnly
				? repository.findPublicTodosByUserId({ ...params, friendUserId: userId })
				: repository.findManyByUserId({ ...params, userId });
		}
		function expectBaseFilter() {
			assertNativeWhere("Todo", db.orm.public.Todo.where.mock.calls[0]?.[0], (todo) =>
				publicOnly
					? and(todo.userId.eq(userId), todo.visibility.eq("PUBLIC"))
					: todo.userId.eq(userId),
			);
		}

		it("사용자와 공개 범위를 유지하며 Todo 응답을 매핑한다", async () => {
			const todos = [
				TodoBuilder.create(userId).withId(1).build(),
				TodoBuilder.create(userId).withId(2).build(),
			];
			db.orm.public.Todo.all.mockReturnValue(nativeRows(databaseFixture("Todo", todos)));
			await expect(find()).resolves.toEqual(TodoMapper.toManyResponse(todos));
			expectBaseFilter();
		});

		it.each([5, 0])("cursor %i도 복합 정렬 키의 다음 행부터 조회한다", async (cursor) => {
			const anchor = databaseFixture("Todo", TodoBuilder.create(userId).withId(cursor).build());
			db.orm.public.Todo.first.mockResolvedValue(anchor);
			const todos = [
				TodoBuilder.create(userId)
					.withId(cursor + 1)
					.build(),
			];
			db.orm.public.Todo.all.mockReturnValue(nativeRows(databaseFixture("Todo", todos)));
			await expect(find({ cursor, size: 10 })).resolves.toEqual(TodoMapper.toManyResponse(todos));
			expectBaseFilter();
			assertNativeWhere("Todo", db.orm.public.Todo.where.mock.calls[1]?.[0], (todo) =>
				todo.id.eq(cursor),
			);
			if (anchor.category === null) throw new TypeError("Missing cursor category");
			const categoryOrder = anchor.category.sortOrder;
			assertNativeWhere("Todo", db.orm.public.Todo.where.mock.calls[2]?.[0], (todo) =>
				or(
					todo.category.some((category) => category.sortOrder.gt(categoryOrder)),
					and(
						todo.category.some((category) => category.sortOrder.eq(categoryOrder)),
						or(
							todo.sortOrder.gt(anchor.sortOrder),
							and(todo.sortOrder.eq(anchor.sortOrder), todo.id.gt(cursor)),
						),
					),
				),
			);
			expect(db.orm.public.Todo.limit).toHaveBeenCalledWith(11);
		});

		it("삭제된 cursor는 빈 페이지를 반환하고 목록을 다시 읽지 않는다", async () => {
			db.orm.public.Todo.first.mockResolvedValue(null);
			await expect(find({ cursor: 999, size: 10 })).resolves.toEqual([]);
			expect(db.orm.public.Todo.all).not.toHaveBeenCalled();
		});

		if (!publicOnly) {
			it("완료 상태로 필터링한다", async () => {
				await find({ size: 10, completed: true });
				assertNativeWhere("Todo", db.orm.public.Todo.where.mock.calls[0]?.[0], (todo) =>
					and(todo.userId.eq(userId), todo.completed.eq(true)),
				);
			});
			it("카테고리로 필터링한다", async () => {
				await find({ size: 10, categoryId: 3 });
				assertNativeWhere("Todo", db.orm.public.Todo.where.mock.calls[0]?.[0], (todo) =>
					and(todo.userId.eq(userId), todo.categoryId.eq(3)),
				);
			});
		}

		it("날짜 범위와 겹치는 기간 Todo와 단일 날짜 Todo를 함께 조회한다", async () => {
			const startDate = new Date("2024-01-01");
			const endDate = new Date("2024-01-31");
			await find({ size: 10, startDate, endDate });
			assertNativeWhere("Todo", db.orm.public.Todo.where.mock.calls[0]?.[0], (todo) =>
				and(
					todo.userId.eq(userId),
					...(publicOnly ? [todo.visibility.eq("PUBLIC")] : []),
					or(
						and(
							todo.endDate.isNotNull(),
							todo.startDate.lte(databaseDate(endDate)),
							todo.endDate.gte(databaseDate(startDate)),
						),
						and(
							todo.endDate.isNull(),
							todo.startDate.gte(databaseDate(startDate)),
							todo.startDate.lte(databaseDate(endDate)),
						),
					),
				),
			);
		});

		it("category.sortOrder, sortOrder, id 기준으로 안정 정렬한다", async () => {
			await find();
			assertNativeOrder("Todo", db.orm.public.Todo.orderBy.mock.calls[0]?.[0], (todo) =>
				todo.category.sortOrder.asc(),
			);
			assertNativeOrder("Todo", db.orm.public.Todo.orderBy.mock.calls[1]?.[0], (todo) =>
				todo.sortOrder.asc(),
			);
			assertNativeOrder("Todo", db.orm.public.Todo.orderBy.mock.calls[2]?.[0], (todo) =>
				todo.id.asc(),
			);
			expect(db.orm.public.Todo.limit).toHaveBeenCalledWith(11);
		});
	});
}
