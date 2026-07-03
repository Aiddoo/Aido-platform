import { Injectable } from "@nestjs/common";
import type { TransactionClient } from "@/common/database";
import type {
	NewTodoData,
	TodoRepositoryPort,
	TodoUpdatePatch,
} from "../../application/ports/todo.repository.port";
import { Todo, type TodoVisibility } from "../../domain/entities/todo.entity";
import { TodoId } from "../../domain/value-objects/todo-id.vo";
import type { TodoScheduleProps } from "../../domain/value-objects/todo-schedule.vo";
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

	async updateDetails(
		id: number,
		patch: TodoUpdatePatch,
		tx?: TransactionClient,
	): Promise<void> {
		// 스칼라 categoryId 포함 패치 — Prisma 런타임은 unchecked 스칼라 update를 허용하며
		// 레거시 서비스도 동일 방식으로 전달했습니다(동작 보존).
		await this.todoRepository.update(id, patch, tx);
	}

	async updateTitle(
		id: number,
		title: string,
		tx?: TransactionClient,
	): Promise<void> {
		await this.todoRepository.update(id, { title }, tx);
	}

	async updateVisibility(
		id: number,
		visibility: TodoVisibility,
		tx?: TransactionClient,
	): Promise<void> {
		await this.todoRepository.update(id, { visibility }, tx);
	}

	async updateSchedule(
		id: number,
		schedule: TodoScheduleProps,
		tx?: TransactionClient,
	): Promise<void> {
		await this.todoRepository.update(
			id,
			{
				startDate: schedule.startDate,
				endDate: schedule.endDate,
				scheduledTime: schedule.scheduledTime,
				isAllDay: schedule.isAllDay,
			},
			tx,
		);
	}

	async updateCategory(
		id: number,
		categoryId: number,
		tx?: TransactionClient,
	): Promise<void> {
		await this.todoRepository.update(
			id,
			{ category: { connect: { id: categoryId } } },
			tx,
		);
	}

	async delete(id: number, tx?: TransactionClient): Promise<void> {
		await this.todoRepository.delete(id, tx);
	}

	async updateSortOrder(
		id: number,
		sortOrder: number,
		tx?: TransactionClient,
	): Promise<void> {
		await this.todoRepository.updateSortOrder(id, sortOrder, tx);
	}

	async shiftSortOrders(
		userId: string,
		from: number,
		to: number | null,
		delta: number,
		tx?: TransactionClient,
	): Promise<void> {
		await this.todoRepository.shiftSortOrders(userId, from, to, delta, tx);
	}

	async createMany(
		items: NewTodoData[],
		recurrenceGroupId: string,
		tx: TransactionClient,
	): Promise<Todo[]> {
		const rows = await this.todoRepository.createManyBatch(
			items.map((item) => ({
				userId: item.userId,
				categoryId: item.categoryId,
				title: item.title,
				sortOrder: item.sortOrder,
				startDate: item.startDate,
				endDate: item.endDate,
				scheduledTime: item.scheduledTime,
				isAllDay: item.isAllDay,
				visibility: item.visibility,
				recurrenceGroupId,
			})),
			recurrenceGroupId,
			tx,
		);
		return rows.map((row) => PrismaTodoRepository.toDomain(row));
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

	// ===== 하위 항목 (체크리스트) =====

	countItemsByTodoId(todoId: number, tx?: TransactionClient): Promise<number> {
		return this.todoRepository.countItemsByTodoId(todoId, tx);
	}

	getMaxItemSortOrder(todoId: number, tx?: TransactionClient): Promise<number> {
		return this.todoRepository.getMaxItemSortOrder(todoId, tx);
	}

	async createItem(
		todoId: number,
		data: { title: string; sortOrder: number },
		tx?: TransactionClient,
	): Promise<void> {
		await this.todoRepository.createItem(todoId, data, tx);
	}

	async updateItem(
		itemId: number,
		data: { title?: string; completed?: boolean },
		tx?: TransactionClient,
	): Promise<void> {
		await this.todoRepository.updateItem(itemId, data, tx);
	}

	async deleteItem(itemId: number, tx?: TransactionClient): Promise<void> {
		await this.todoRepository.deleteItem(itemId, tx);
	}

	async reorderItems(itemIds: number[], tx?: TransactionClient): Promise<void> {
		await this.todoRepository.reorderItems(itemIds, tx);
	}
}
