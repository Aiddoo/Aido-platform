import { ErrorCode } from "@aido/errors";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { ApplicationException } from "@/common/domain";
import type { Todo } from "../../../domain/entities/todo.entity";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { GetTodoByIdQuery } from "../get-todo-by-id.query";

/**
 * 단일 Todo 조회 핸들러
 */
@QueryHandler(GetTodoByIdQuery)
export class GetTodoByIdHandler
	implements IQueryHandler<GetTodoByIdQuery, Todo>
{
	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
	) {}

	async execute(query: GetTodoByIdQuery): Promise<Todo> {
		const todo = await this.todoRepository.findByIdAndUserId(
			query.id,
			query.userId,
		);

		if (!todo) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: query.id });
		}

		return todo;
	}
}
