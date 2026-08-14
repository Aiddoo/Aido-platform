import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { ApplicationException } from "@/shared/domain";

import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";

/** 단일 Todo 조회 입력. */
export interface GetTodoByIdInput {
	id: number;
	userId: string;
}

/**
 * 단일 Todo 조회 use-case (read model 직접 반환)
 */
@Injectable()
export class GetTodoByIdUseCase {
	constructor(
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
	) {}

	async execute(input: GetTodoByIdInput): Promise<TodoResponse> {
		const todo = await this.todoReadRepository.findByIdAndUserId(input.id, input.userId);

		if (!todo) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: input.id });
		}

		return todo;
	}
}
