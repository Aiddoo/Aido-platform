import { TODO_LIMITS } from "@aido/validators";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import {
	GetTodoResourceLimitQuery,
	type TodoResourceLimitResult,
} from "./get-todo-resource-limit.query";

/**
 * 카테고리당 활성 Todo 리소스 제한 정보 조회 핸들러
 */
@QueryHandler(GetTodoResourceLimitQuery)
export class GetTodoResourceLimitHandler
	implements IQueryHandler<GetTodoResourceLimitQuery>
{
	constructor(
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
	) {}

	async execute(
		query: GetTodoResourceLimitQuery,
	): Promise<TodoResourceLimitResult> {
		if (query.categoryId) {
			const activeCount = await this.todoReadRepository.countActiveByCategory(
				query.userId,
				query.categoryId,
			);
			return { activeCount, maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
		}
		return { maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
	}
}
