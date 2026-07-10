import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { TransactionClient } from "@/common/database/prisma.types";
import type { DatabaseService } from "@/database/database.service";
import type { Prisma, TodoCategory } from "@/generated/prisma/client";

import type { TodoCategoryWithCount } from "./types/todo-category.types";

/**
 * 트랜잭션은 CLS로 전파됩니다 — TransactionHost.tx가 활성 트랜잭션 클라이언트를,
 * 활성 트랜잭션이 없으면 베이스 DatabaseService를 반환합니다(기존 `tx ?? this.database`와 등가).
 */
@Injectable()
export class TodoCategoryRepository {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	/**
	 * 카테고리 생성
	 */
	async create(data: Prisma.TodoCategoryCreateInput): Promise<TodoCategory> {
		return this.client.todoCategory.create({ data });
	}

	/**
	 * 여러 카테고리 생성 (회원가입 시 기본 카테고리용)
	 *
	 * @param tx 과도기 파라미터 — auth/oauth가 아직 `$transaction(tx)`를 스레딩하므로
	 *           해당 모듈이 CLS로 이관되기 전까지 유지합니다 (전달 시 tx 우선).
	 */
	async createMany(
		data: Prisma.TodoCategoryCreateManyInput[],
		tx?: TransactionClient,
	): Promise<number> {
		const client = tx ?? this.client;
		const result = await client.todoCategory.createMany({ data });
		return result.count;
	}

	/**
	 * ID로 카테고리 조회
	 */
	async findById(id: number): Promise<TodoCategory | null> {
		return this.client.todoCategory.findUnique({
			where: { id },
		});
	}

	/**
	 * 사용자의 카테고리 조회 (소유권 확인용)
	 */
	async findByIdAndUserId(
		id: number,
		userId: string,
	): Promise<TodoCategory | null> {
		return this.client.todoCategory.findFirst({
			where: { id, userId },
		});
	}

	/**
	 * 사용자의 카테고리 목록 조회 (Todo 개수 포함)
	 */
	async findManyByUserId(userId: string): Promise<TodoCategoryWithCount[]> {
		return this.client.todoCategory.findMany({
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
	async countByUserId(userId: string): Promise<number> {
		return this.client.todoCategory.count({
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
	): Promise<boolean> {
		const category = await this.client.todoCategory.findFirst({
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
	): Promise<TodoCategory> {
		return this.client.todoCategory.update({
			where: { id },
			data,
		});
	}

	/**
	 * 카테고리 삭제
	 */
	async delete(id: number): Promise<TodoCategory> {
		return this.client.todoCategory.delete({
			where: { id },
		});
	}

	/**
	 * 카테고리의 Todo 개수 조회
	 */
	async getTodoCount(id: number): Promise<number> {
		return this.client.todo.count({
			where: { categoryId: id },
		});
	}

	/**
	 * 카테고리의 모든 Todo를 다른 카테고리로 이동
	 */
	async moveTodosToCategory(
		fromCategoryId: number,
		toCategoryId: number,
	): Promise<number> {
		const result = await this.client.todo.updateMany({
			where: { categoryId: fromCategoryId },
			data: { categoryId: toCategoryId },
		});
		return result.count;
	}

	/**
	 * 사용자의 최대 sortOrder 조회
	 */
	async getMaxSortOrder(userId: string): Promise<number> {
		const result = await this.client.todoCategory.aggregate({
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
	): Promise<number> {
		const where: Prisma.TodoCategoryWhereInput = {
			userId,
			sortOrder: {
				gte: fromSortOrder,
				...(toSortOrder !== null && { lte: toSortOrder }),
			},
		};

		const result = await this.client.todoCategory.updateMany({
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
	async findByIdWithCount(id: number): Promise<TodoCategoryWithCount | null> {
		return this.client.todoCategory.findUnique({
			where: { id },
			include: {
				_count: {
					select: { todos: true },
				},
			},
		});
	}
}
