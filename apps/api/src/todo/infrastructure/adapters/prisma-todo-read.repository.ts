import type { Todo as TodoResponse } from "@aido/validators";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and, or } from "@prisma/orm-postgres/orm-client";
import { OrderByItem } from "@prisma/orm-postgres/relational-core/ast";
import { sumBy } from "es-toolkit";

import { decodeRecord } from "#api/shared/infrastructure/database/database-records";
import { varchar } from "#api/shared/infrastructure/database/database-values";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import type { TodoReadRepositoryPort } from "../../application/ports/todo-read.repository.port.js";
import type { FindFriendTodosParams, FindTodosParams } from "../../application/types.js";
import { todoDatePredicate } from "../persistence/todo-date.filter.js";
import { TodoMapper } from "../persistence/todo-response.mapper.js";

/** 조회 projection과 집계만 소유하며 활성 CLS transaction에 참여한다. */
@Injectable()
export class PrismaTodoReadRepository implements TodoReadRepositoryPort {
	constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}
	private get client() {
		return this.txHost.tx;
	}

	private get todos() {
		return this.client.orm.public.Todo.include("category", (category) =>
			category.select("id", "name", "color", "sortOrder"),
		).include("items", (items) =>
			items
				.select("id", "title", "completed", "sortOrder", "createdAt", "updatedAt")
				.orderBy((item) => item.sortOrder.asc()),
		);
	}

	async findOwnerId(id: number): Promise<string | null> {
		const row = await this.client.orm.public.Todo.where({ id }).select("userId").first();
		return row?.userId ?? null;
	}

	async findManyByUserId(params: FindTodosParams): Promise<TodoResponse[]> {
		return this.findPage(params);
	}

	async findPublicTodosByUserId(params: FindFriendTodosParams): Promise<TodoResponse[]> {
		return this.findPage({ ...params, userId: params.friendUserId }, true);
	}

	private async findPage(params: FindTodosParams, publicOnly = false): Promise<TodoResponse[]> {
		const { userId, cursor, size, completed, categoryId, startDate, endDate } = params;
		let query = this.todos.where((todo) =>
			and(
				todo.userId.eq(userId),
				completed === undefined ? all() : todo.completed.eq(completed),
				categoryId === undefined ? all() : todo.categoryId.eq(categoryId),
				publicOnly ? todo.visibility.eq("PUBLIC") : all(),
				todoDatePredicate(todo, startDate, endDate),
			),
		);
		if (cursor !== null && cursor !== undefined) {
			// Prisma 8 cursors require every ordering key and do not support relation ordering.
			// Resolve the existing ID cursor, then apply the same exclusive composite keyset.
			const anchor = await this.client.orm.public.Todo.where({ id: cursor })
				.select("id", "sortOrder")
				.include("category", (category) => category.select("sortOrder"))
				.first();
			if (anchor === null) return [];
			const categoryOrder = requireRecord(anchor.category).sortOrder;
			query = query.where((todo) =>
				or(
					todo.category.some((category) => category.sortOrder.gt(categoryOrder)),
					and(
						todo.category.some((category) => category.sortOrder.eq(categoryOrder)),
						or(
							todo.sortOrder.gt(anchor.sortOrder),
							and(todo.sortOrder.eq(anchor.sortOrder), todo.id.gt(anchor.id)),
						),
					),
				),
			);
		}
		const rows = decodeRecord(
			"Todo",
			await query
				.orderBy((todo) => todo.category.sortOrder.asc())
				.orderBy((todo) => todo.sortOrder.asc())
				.orderBy((todo) => todo.id.asc())
				.limit(size + 1)
				.all(),
		);
		return TodoMapper.toManyResponse(rows);
	}

	async countCompletedByUser(userId: string): Promise<number> {
		const { count } = await this.client.orm.public.Todo.where({
			userId,
			completed: true,
		}).aggregate((aggregate) => ({ count: aggregate.count() }));
		return count;
	}

	async getTodayTodoStats(
		userId: string,
		today: Date,
	): Promise<{ total: number; completed: number }> {
		const groups = await this.client.orm.public.Todo.where((todo) =>
			and(todo.userId.eq(userId), todoDatePredicate(todo, today, today)),
		)
			.groupBy("completed")
			.aggregate((aggregate) => ({ count: aggregate.count() }));
		return {
			total: sumBy(groups, (group) => group.count),
			completed: groups.find((group) => group.completed)?.count ?? 0,
		};
	}

	async findTodayTopTodos(userId: string, today: Date, limit: number) {
		const rows = await this.client.orm.public.Todo.where((todo) =>
			and(todo.userId.eq(userId), todoDatePredicate(todo, today, today)),
		)
			.select("id", "title", "completed")
			.include("category", (category) => category.select("color"))
			.orderBy((todo) => OrderByItem.asc(todo.completed.buildAst()))
			.orderBy((todo) => todo.category.sortOrder.asc())
			.orderBy((todo) => todo.sortOrder.asc())
			.orderBy((todo) => todo.id.asc())
			.limit(limit)
			.all();
		return rows.map((row) => ({
			id: row.id,
			title: row.title,
			completed: row.completed,
			categoryColor: requireRecord(row.category).color,
		}));
	}

	async findManyByRecurrenceGroupId(
		userId: string,
		recurrenceGroupId: string,
	): Promise<TodoResponse[]> {
		const rows = decodeRecord(
			"Todo",
			await this.todos
				.where({ userId, recurrenceGroupId: varchar(recurrenceGroupId, 36) })
				.orderBy((todo) => todo.sortOrder.asc())
				.all(),
		);
		return TodoMapper.toManyResponse(rows);
	}

	async findByIdAndUserId(id: number, userId: string): Promise<TodoResponse | null> {
		const row = decodeRecord("Todo", await this.todos.where({ id, userId }).first());
		return row === null ? null : TodoMapper.toResponse(row);
	}

	async countActiveByCategory(userId: string, categoryId: number): Promise<number> {
		const { count } = await this.client.orm.public.Todo.where({
			userId,
			categoryId,
			completed: false,
		}).aggregate((aggregate) => ({ count: aggregate.count() }));
		return count;
	}
}
