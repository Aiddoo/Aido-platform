import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@/database/database.service";
import type { Prisma, TodoCategory } from "@/generated/prisma/client";

import type {
	TodoCategoryWithCount,
	TransactionClient,
} from "./types/todo-category.types";

@Injectable()
export class TodoCategoryRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * 카테고리 생성
	 */
	async create(
		data: Prisma.TodoCategoryCreateInput,
		tx?: TransactionClient,
	): Promise<TodoCategory> {
		const client = tx ?? this.database;
		return client.todoCategory.create({ data });
	}

	/**
	 * 여러 카테고리 생성 (회원가입 시 기본 카테고리용)
	 */
	async createMany(
		data: Prisma.TodoCategoryCreateManyInput[],
		tx?: TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		const result = await client.todoCategory.createMany({ data });
		return result.count;
	}

	/**
	 * ID로 카테고리 조회
	 */
	async findById(
		id: number,
		tx?: TransactionClient,
	): Promise<TodoCategory | null> {
		const client = tx ?? this.database;
		return client.todoCategory.findUnique({
			where: { id },
		});
	}

	/**
	 * 사용자의 카테고리 조회 (소유권 확인용)
	 */
	async findByIdAndUserId(
		id: number,
		userId: string,
		tx?: TransactionClient,
	): Promise<TodoCategory | null> {
		const client = tx ?? this.database;
		return client.todoCategory.findFirst({
			where: { id, userId },
		});
	}

	/**
	 * 사용자의 카테고리 목록 조회 (Todo 개수 포함)
	 */
	async findManyByUserId(
		userId: string,
		tx?: TransactionClient,
	): Promise<TodoCategoryWithCount[]> {
		const client = tx ?? this.database;
		return client.todoCategory.findMany({
			where: { userId },
			include: {
				_count: {
					select: { todos: true },
				},
			},
			orderBy: { sortOrder: "asc" },
		});
	}

	/**
	 * 사용자의 카테고리 개수 조회
	 */
	async countByUserId(userId: string, tx?: TransactionClient): Promise<number> {
		const client = tx ?? this.database;
		return client.todoCategory.count({
			where: { userId },
		});
	}

	/**
	 * 사용자의 동일 이름 카테고리 존재 여부 확인
	 */
	async existsByUserIdAndName(
		userId: string,
		name: string,
		excludeId?: number,
		tx?: TransactionClient,
	): Promise<boolean> {
		const client = tx ?? this.database;
		const category = await client.todoCategory.findFirst({
			where: {
				userId,
				name,
				...(excludeId && { id: { not: excludeId } }),
			},
		});
		return category !== null;
	}

	/**
	 * 카테고리 수정
	 */
	async update(
		id: number,
		data: Prisma.TodoCategoryUpdateInput,
		tx?: TransactionClient,
	): Promise<TodoCategory> {
		const client = tx ?? this.database;
		return client.todoCategory.update({
			where: { id },
			data,
		});
	}

	/**
	 * 카테고리 삭제
	 */
	async delete(id: number, tx?: TransactionClient): Promise<TodoCategory> {
		const client = tx ?? this.database;
		return client.todoCategory.delete({
			where: { id },
		});
	}

	/**
	 * 카테고리의 Todo 개수 조회
	 */
	async getTodoCount(id: number, tx?: TransactionClient): Promise<number> {
		const client = tx ?? this.database;
		return client.todo.count({
			where: { categoryId: id },
		});
	}

	/**
	 * 카테고리의 모든 Todo를 다른 카테고리로 이동
	 */
	async moveTodosToCategory(
		fromCategoryId: number,
		toCategoryId: number,
		tx?: TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		const result = await client.todo.updateMany({
			where: { categoryId: fromCategoryId },
			data: { categoryId: toCategoryId },
		});
		return result.count;
	}

	/**
	 * 사용자의 최대 sortOrder 조회
	 */
	async getMaxSortOrder(
		userId: string,
		tx?: TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		const result = await client.todoCategory.aggregate({
			where: { userId },
			_max: { sortOrder: true },
		});
		return result._max.sortOrder ?? -1;
	}

	/**
	 * 특정 sortOrder 범위의 카테고리들의 sortOrder를 일괄 조정
	 */
	async shiftSortOrders(
		userId: string,
		fromSortOrder: number,
		toSortOrder: number | null,
		delta: number,
		tx?: TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;

		const where: Prisma.TodoCategoryWhereInput = {
			userId,
			sortOrder: {
				gte: fromSortOrder,
				...(toSortOrder !== null && { lte: toSortOrder }),
			},
		};

		const result = await client.todoCategory.updateMany({
			where,
			data: {
				sortOrder: { increment: delta },
			},
		});

		return result.count;
	}

	/**
	 * ID로 카테고리 조회 (Todo 개수 포함)
	 */
	async findByIdWithCount(
		id: number,
		tx?: TransactionClient,
	): Promise<TodoCategoryWithCount | null> {
		const client = tx ?? this.database;
		return client.todoCategory.findUnique({
			where: { id },
			include: {
				_count: {
					select: { todos: true },
				},
			},
		});
	}
}
