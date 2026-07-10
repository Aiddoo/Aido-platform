import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { ApplicationException } from "@/shared/domain";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { GetTodoByIdQuery } from "../get-todo-by-id.query";

/**
 * 단일 Todo 조회 핸들러 (read model 직접 반환)
 */
@QueryHandler(GetTodoByIdQuery)
export class GetTodoByIdHandler implements IQueryHandler<GetTodoByIdQuery> {
	constructor(
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
	) {}

	async execute(query: GetTodoByIdQuery): Promise<TodoResponse> {
		const todo = await this.todoReadRepository.findByIdAndUserId(
			query.id,
			query.userId,
		);

		if (!todo) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: query.id });
		}

		return todo;
	}
}
