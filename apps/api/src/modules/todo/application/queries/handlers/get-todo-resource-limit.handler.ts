import { TODO_LIMITS } from "@aido/validators";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { GetTodoResourceLimitQuery } from "../get-todo-resource-limit.query";

export interface TodoResourceLimitResult {
	activeCount?: number;
	maxPerCategory: number;
}

/**
 * 카테고리당 활성 Todo 리소스 제한 정보 조회 핸들러
 */
@QueryHandler(GetTodoResourceLimitQuery)
export class GetTodoResourceLimitHandler
	implements IQueryHandler<GetTodoResourceLimitQuery, TodoResourceLimitResult>
{
	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
	) {}

	async execute(
		query: GetTodoResourceLimitQuery,
	): Promise<TodoResourceLimitResult> {
		if (query.categoryId) {
			const activeCount = await this.todoRepository.countActiveByCategory(
				query.userId,
				query.categoryId,
			);
			return { activeCount, maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
		}
		return { maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
	}
}
