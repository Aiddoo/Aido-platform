import { Injectable } from "@nestjs/common";
import type { TransactionClient } from "@/common/database";
import type {
	NewTodoData,
	TodoRepositoryPort,
} from "../../application/ports/todo.repository.port";
import { Todo } from "../../domain/entities/todo.entity";
import { TodoId } from "../../domain/value-objects/todo-id.vo";
import { TodoRepository } from "../../todo.repository";
import type { TodoWithCategory } from "../../types/todo.types";

/**
 * Prisma Todo 쓰기 어댑터
 *
 * TodoRepositoryPort 구현체. 행 기반 TodoRepository의 쿼리를 재사용하되,
 * 행 ↔ 도메인 애그리게잇 매핑(toDomain/toPersistence)을 이 어댑터가 소유합니다.
 */
@Injectable()
export class PrismaTodoRepository implements TodoRepositoryPort {
	constructor(private readonly todoRepository: TodoRepository) {}

	/** DB 행 → 도메인 애그리게잇 (카테고리 read model은 버리고 순수 도메인 상태만 복원) */
	private static toDomain(row: TodoWithCategory): Todo {
		return Todo.reconstitute({
			id: TodoId.create(row.id),
			userId: row.userId,
			title: row.title,
			categoryId: row.categoryId,
			sortOrder: row.sortOrder,
			completed: row.completed,
			completedAt: row.completedAt,
			startDate: row.startDate,
			endDate: row.endDate,
			scheduledTime: row.scheduledTime,
			isAllDay: row.isAllDay,
			visibility: row.visibility,
			recurrenceGroupId: row.recurrenceGroupId,
			items: row.items.map((item) => ({
				id: item.id,
				title: item.title,
				completed: item.completed,
				sortOrder: item.sortOrder,
				createdAt: item.createdAt,
				updatedAt: item.updatedAt,
			})),
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}

	async findByIdAndUserId(
		id: number,
		userId: string,
		tx?: TransactionClient,
	): Promise<Todo | null> {
		const row = await this.todoRepository.findByIdAndUserId(id, userId, tx);
		return row ? PrismaTodoRepository.toDomain(row) : null;
	}

	async create(data: NewTodoData, tx?: TransactionClient): Promise<Todo> {
		const row = await this.todoRepository.create(
			{
				user: { connect: { id: data.userId } },
				category: { connect: { id: data.categoryId } },
				title: data.title,
				sortOrder: data.sortOrder,
				startDate: data.startDate,
				endDate: data.endDate,
				scheduledTime: data.scheduledTime,
				isAllDay: data.isAllDay,
				visibility: data.visibility,
			},
			tx,
		);
		return PrismaTodoRepository.toDomain(row);
	}

	async createInlineItems(
		todoId: number,
		items: { title: string }[],
		tx: TransactionClient,
	): Promise<void> {
		await this.todoRepository.createManyItems(todoId, items, tx);
	}

	async updateCompletion(
		id: number,
		completed: boolean,
		completedAt: Date | null,
		tx?: TransactionClient,
	): Promise<void> {
		await this.todoRepository.update(id, { completed, completedAt }, tx);
	}

	countActiveByCategory(
		userId: string,
		categoryId: number,
		tx?: TransactionClient,
	): Promise<number> {
		return this.todoRepository.countActiveByCategory(userId, categoryId, tx);
	}

	getMaxSortOrder(userId: string, tx?: TransactionClient): Promise<number> {
		return this.todoRepository.getMaxSortOrder(userId, tx);
	}
}
