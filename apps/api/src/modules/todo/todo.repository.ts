import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@/database/database.service";
import type { Prisma, Todo } from "@/generated/prisma/client";

export interface FindTodosParams {
	userId: string;
	cursor?: number;
	size: number;
	completed?: boolean;
	startDate?: Date;
	endDate?: Date;
}

export interface FindFriendTodosParams {
	friendUserId: string;
	cursor?: number;
	size: number;
	startDate?: Date;
	endDate?: Date;
}

@Injectable()
export class TodoRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * Todo 생성
	 */
	async create(data: Prisma.TodoCreateInput): Promise<Todo> {
		return this.database.todo.create({ data });
	}

	/**
	 * ID로 Todo 조회
	 */
	async findById(id: number): Promise<Todo | null> {
		return this.database.todo.findUnique({
			where: { id },
		});
	}

	/**
	 * 사용자의 Todo 조회 (소유권 확인용)
	 */
	async findByIdAndUserId(id: number, userId: string): Promise<Todo | null> {
		return this.database.todo.findFirst({
			where: { id, userId },
		});
	}

	/**
	 * 사용자의 Todo 목록 조회 (커서 기반 페이지네이션)
	 */
	async findManyByUserId(params: FindTodosParams): Promise<Todo[]> {
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

		return this.database.todo.findMany({
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
	async update(id: number, data: Prisma.TodoUpdateInput): Promise<Todo> {
		return this.database.todo.update({
			where: { id },
			data,
		});
	}

	/**
	 * Todo 삭제
	 */
	async delete(id: number): Promise<Todo> {
		return this.database.todo.delete({
			where: { id },
		});
	}

	/**
	 * 친구의 PUBLIC Todo 목록 조회 (커서 기반 페이지네이션)
	 */
	async findPublicTodosByUserId(
		params: FindFriendTodosParams,
	): Promise<Todo[]> {
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

		return this.database.todo.findMany({
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
