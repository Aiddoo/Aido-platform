import { ErrorCode } from "@aido/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import type * as PrismaModels from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	CreateCategoryInput,
	TodoCategoryRepositoryPort,
	TodoCategoryWithCountView,
	UpdateCategoryInput,
} from "../../application/ports/todo-category.repository.port";
import { TodoCategory } from "../../domain/entities/todo-category.aggregate";

type TodoCategoryRowWithCount = PrismaModels.TodoCategory & {
	_count: { todos: number };
};

const WITH_COUNT_INCLUDE = {
	_count: { select: { todos: true } },
} as const;

/**
 * TodoCategoryRepositoryPort의 Prisma 어댑터.
 * 쓰기·단건은 TodoCategory 애그리게잇을, 개수 포함 읽기는 프로젝션을 반환한다.
 * 트랜잭션은 CLS(TransactionHost.tx)로 전파되며, 이름 유니크 위반(P2002)은 TODO_CATEGORY_0853으로 번역한다.
 */
@Injectable()
export class PrismaTodoCategoryRepository implements TodoCategoryRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	private static toEntity(row: PrismaModels.TodoCategory): TodoCategory {
		return TodoCategory.reconstitute({
			id: row.id,
			userId: row.userId,
			name: row.name,
			color: row.color,
			sortOrder: row.sortOrder,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}

	private static toView(row: TodoCategoryRowWithCount): TodoCategoryWithCountView {
		return {
			id: row.id,
			userId: row.userId,
			name: row.name,
			color: row.color,
			sortOrder: row.sortOrder,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			todoCount: row._count.todos,
		};
	}

	private static isUniqueViolation(error: unknown): boolean {
		return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
	}

	async create(input: CreateCategoryInput): Promise<TodoCategory> {
		try {
			const row = await this.client.todoCategory.create({
				data: {
					user: { connect: { id: input.userId } },
					name: input.name,
					color: input.color,
					sortOrder: input.sortOrder,
				},
			});
			return PrismaTodoCategoryRepository.toEntity(row);
		} catch (error) {
			if (PrismaTodoCategoryRepository.isUniqueViolation(error)) {
				throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, {
					name: input.name,
				});
			}
			throw error;
		}
	}

	async update(id: number, input: UpdateCategoryInput): Promise<TodoCategory> {
		try {
			const row = await this.client.todoCategory.update({
				where: { id },
				data: {
					name: input.name,
					color: input.color,
					sortOrder: input.sortOrder,
				},
			});
			return PrismaTodoCategoryRepository.toEntity(row);
		} catch (error) {
			if (PrismaTodoCategoryRepository.isUniqueViolation(error)) {
				throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, {
					name: input.name ?? "",
				});
			}
			throw error;
		}
	}

	async delete(id: number): Promise<void> {
		await this.client.todoCategory.delete({ where: { id } });
	}

	async findByIdAndUserId(id: number, userId: string): Promise<TodoCategory | null> {
		const row = await this.client.todoCategory.findFirst({
			where: { id, userId },
		});
		return row ? PrismaTodoCategoryRepository.toEntity(row) : null;
	}

	async findByIdWithCount(id: number): Promise<TodoCategoryWithCountView | null> {
		const row = await this.client.todoCategory.findUnique({
			where: { id },
			include: WITH_COUNT_INCLUDE,
		});
		return row ? PrismaTodoCategoryRepository.toView(row) : null;
	}

	async findManyByUserId(userId: string): Promise<TodoCategoryWithCountView[]> {
		const rows = await this.client.todoCategory.findMany({
			where: { userId },
			include: WITH_COUNT_INCLUDE,
			orderBy: { sortOrder: "asc" },
		});
		return rows.map((row) => PrismaTodoCategoryRepository.toView(row));
	}

	async countByUserId(userId: string): Promise<number> {
		return this.client.todoCategory.count({ where: { userId } });
	}

	async existsByUserIdAndName(userId: string, name: string, excludeId?: number): Promise<boolean> {
		const row = await this.client.todoCategory.findFirst({
			where: {
				userId,
				name,
				...(excludeId != null && { id: { not: excludeId } }),
			},
		});
		return row !== null;
	}

	async getMaxSortOrder(userId: string): Promise<number> {
		const result = await this.client.todoCategory.aggregate({
			where: { userId },
			_max: { sortOrder: true },
		});
		return result._max.sortOrder ?? -1;
	}

	async shiftSortOrders(
		userId: string,
		fromSortOrder: number,
		toSortOrder: number | null,
		delta: number,
	): Promise<number> {
		const result = await this.client.todoCategory.updateMany({
			where: {
				userId,
				sortOrder: {
					gte: fromSortOrder,
					...(toSortOrder !== null && { lte: toSortOrder }),
				},
			},
			data: { sortOrder: { increment: delta } },
		});
		return result.count;
	}

	async getTodoCount(categoryId: number): Promise<number> {
		return this.client.todo.count({ where: { categoryId } });
	}

	async moveTodosToCategory(fromCategoryId: number, toCategoryId: number): Promise<number> {
		const result = await this.client.todo.updateMany({
			where: { categoryId: fromCategoryId },
			data: { categoryId: toCategoryId },
		});
		return result.count;
	}
}
