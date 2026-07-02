import { Injectable } from "@nestjs/common";
import type { TransactionClient } from "@/common/database";
import type { Prisma } from "@/generated/prisma/client";
import type { TodoRepositoryPort } from "../../application/ports/todo.repository.port";
import { Todo } from "../../domain/entities/todo.entity";
import { TodoRepository } from "../../todo.repository";
import type {
	FindFriendTodosParams,
	FindTodosParams,
} from "../../types/todo.types";

/**
 * Prisma Todo 리포지토리 어댑터
 *
 * TodoRepositoryPort 구현체. 기존 행 기반 TodoRepository의 쿼리를 재사용하고
 * 결과를 도메인 애그리게잇(Todo)으로 복원(reconstitute)해 반환합니다.
 */
@Injectable()
export class PrismaTodoRepository implements TodoRepositoryPort {
	constructor(private readonly todoRepository: TodoRepository) {}

	async findByIdAndUserId(
		id: number,
		userId: string,
		tx?: TransactionClient,
	): Promise<Todo | null> {
		const row = await this.todoRepository.findByIdAndUserId(id, userId, tx);
		return row ? Todo.reconstitute(row) : null;
	}

	async findManyByUserId(
		params: FindTodosParams,
		tx?: TransactionClient,
	): Promise<Todo[]> {
		const rows = await this.todoRepository.findManyByUserId(params, tx);
		return rows.map((row) => Todo.reconstitute(row));
	}

	async findPublicTodosByUserId(
		params: FindFriendTodosParams,
		tx?: TransactionClient,
	): Promise<Todo[]> {
		const rows = await this.todoRepository.findPublicTodosByUserId(params, tx);
		return rows.map((row) => Todo.reconstitute(row));
	}

	async create(
		data: Prisma.TodoCreateInput,
		tx?: TransactionClient,
	): Promise<Todo> {
		const row = await this.todoRepository.create(data, tx);
		return Todo.reconstitute(row);
	}

	async createInlineItems(
		todoId: number,
		items: { title: string }[],
		tx: TransactionClient,
	): Promise<void> {
		await this.todoRepository.createManyItems(todoId, items, tx);
	}

	async update(
		id: number,
		data: Prisma.TodoUpdateInput,
		tx?: TransactionClient,
	): Promise<Todo> {
		const row = await this.todoRepository.update(id, data, tx);
		return Todo.reconstitute(row);
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

	countCompletedByUser(
		userId: string,
		tx?: TransactionClient,
	): Promise<number> {
		return this.todoRepository.countCompletedByUser(userId, tx);
	}

	getTodayTodoStats(
		userId: string,
		today: Date,
		tx?: TransactionClient,
	): Promise<{ total: number; completed: number }> {
		return this.todoRepository.getTodayTodoStats(userId, today, tx);
	}
}
