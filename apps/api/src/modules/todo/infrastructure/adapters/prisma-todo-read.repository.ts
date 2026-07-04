import type { Todo as TodoResponse } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import type { TodoReadRepositoryPort } from "../../application/ports/todo-read.repository.port";
import type {
	FindFriendTodosParams,
	FindTodosParams,
} from "../../application/types";
import { TodoMapper } from "../persistence/todo-response.mapper";
import { TodoRowRepository } from "../persistence/todo-row.repository";

/**
 * Prisma Todo 읽기 어댑터
 *
 * TodoReadRepositoryPort 구현체. 행 기반 TodoRowRepository 조회를 재사용하고
 * 행 → 응답 read model 매핑(TodoMapper, 순수 함수)을 수행합니다.
 */
@Injectable()
export class PrismaTodoReadRepository implements TodoReadRepositoryPort {
	constructor(private readonly todoRepository: TodoRowRepository) {}

	async findByIdAndUserId(
		id: number,
		userId: string,
	): Promise<TodoResponse | null> {
		const row = await this.todoRepository.findByIdAndUserId(id, userId);
		return row ? TodoMapper.toResponse(row) : null;
	}

	async findManyByRecurrenceGroupId(
		userId: string,
		recurrenceGroupId: string,
	): Promise<TodoResponse[]> {
		const rows = await this.todoRepository.findManyByRecurrenceGroupId(
			userId,
			recurrenceGroupId,
		);
		return TodoMapper.toManyResponse(rows);
	}

	async findManyByUserId(params: FindTodosParams): Promise<TodoResponse[]> {
		const rows = await this.todoRepository.findManyByUserId(params);
		return TodoMapper.toManyResponse(rows);
	}

	async findPublicTodosByUserId(
		params: FindFriendTodosParams,
	): Promise<TodoResponse[]> {
		const rows = await this.todoRepository.findPublicTodosByUserId(params);
		return TodoMapper.toManyResponse(rows);
	}

	countActiveByCategory(userId: string, categoryId: number): Promise<number> {
		return this.todoRepository.countActiveByCategory(userId, categoryId);
	}

	countCompletedByUser(userId: string): Promise<number> {
		return this.todoRepository.countCompletedByUser(userId);
	}

	getTodayTodoStats(
		userId: string,
		today: Date,
	): Promise<{ total: number; completed: number }> {
		return this.todoRepository.getTodayTodoStats(userId, today);
	}
}
