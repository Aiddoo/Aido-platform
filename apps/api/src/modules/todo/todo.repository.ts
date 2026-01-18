import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@/database/database.service";
import type { Prisma, Todo } from "@/generated/prisma/client";

import type {
	FindFriendTodosParams,
	FindTodosParams,
	TransactionClient,
} from "./types/todo.types.ts";

@Injectable()
export class TodoRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * Todo 생성
	 */
	async create(
		data: Prisma.TodoCreateInput,
		tx?: TransactionClient,
	): Promise<Todo> {
		const client = tx ?? this.database;
		return client.todo.create({ data });
	}

	/**
	 * ID로 Todo 조회
	 */
	async findById(id: number, tx?: TransactionClient): Promise<Todo | null> {
		const client = tx ?? this.database;
		return client.todo.findUnique({
			where: { id },
		});
	}

	/**
	 * 사용자의 Todo 조회 (소유권 확인용)
	 */
	async findByIdAndUserId(
		id: number,
		userId: string,
		tx?: TransactionClient,
	): Promise<Todo | null> {
		const client = tx ?? this.database;
		return client.todo.findFirst({
			where: { id, userId },
		});
	}

	/**
	 * 사용자의 Todo 목록 조회 (커서 기반 페이지네이션)
	 */
	async findManyByUserId(
		params: FindTodosParams,
		tx?: TransactionClient,
	): Promise<Todo[]> {
		const client = tx ?? this.database;
		const { userId, cursor, size, completed, startDate, endDate } = params;

		const where: Prisma.TodoWhereInput = {
			userId,
		};

		// 완료 상태 필터
		if (completed !== undefined) {
			where.completed = completed;
		}

		// 날짜 범위 필터
		if (startDate || endDate) {
			where.startDate = {};
			if (startDate) {
				where.startDate.gte = startDate;
			}
			if (endDate) {
				where.startDate.lte = endDate;
			}
		}

		return client.todo.findMany({
			where,
			take: size + 1, // hasNext 확인을 위해 +1
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
		});
	}

	/**
	 * Todo 수정
	 */
	async update(
		id: number,
		data: Prisma.TodoUpdateInput,
		tx?: TransactionClient,
	): Promise<Todo> {
		const client = tx ?? this.database;
		return client.todo.update({
			where: { id },
			data,
		});
	}

	/**
	 * Todo 삭제
	 */
	async delete(id: number, tx?: TransactionClient): Promise<Todo> {
		const client = tx ?? this.database;
		return client.todo.delete({
			where: { id },
		});
	}

	/**
	 * 친구의 PUBLIC Todo 목록 조회 (커서 기반 페이지네이션)
	 */
	async findPublicTodosByUserId(
		params: FindFriendTodosParams,
		tx?: TransactionClient,
	): Promise<Todo[]> {
		const client = tx ?? this.database;
		const { friendUserId, cursor, size, startDate, endDate } = params;

		const where: Prisma.TodoWhereInput = {
			userId: friendUserId,
			visibility: "PUBLIC",
		};

		// 날짜 범위 필터
		if (startDate || endDate) {
			where.startDate = {};
			if (startDate) {
				where.startDate.gte = startDate;
			}
			if (endDate) {
				where.startDate.lte = endDate;
			}
		}

		return client.todo.findMany({
			where,
			take: size + 1, // hasNext 확인을 위해 +1
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
		});
	}
}
