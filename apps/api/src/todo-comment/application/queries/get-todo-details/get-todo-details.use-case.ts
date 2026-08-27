import { ErrorCode } from "@aido/errors";
import type { TodoDetailsResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";

import { getTodoDetailsPermissions } from "../../../domain/services/todo-comment-permission";
import {
	TODO_COMMENT_READER,
	type TodoCommentReaderPort,
} from "../../ports/todo-comment.reader.port";
import {
	TODO_COMMENT_REPOSITORY,
	type TodoCommentRepositoryPort,
} from "../../ports/todo-comment.repository.port";

export interface GetTodoDetailsInput {
	todoId: number;
	viewerId: string;
}

@Injectable()
export class GetTodoDetailsUseCase {
	constructor(
		@Inject(TODO_COMMENT_READER)
		private readonly todoCommentReader: TodoCommentReaderPort,
		@Inject(TODO_COMMENT_REPOSITORY)
		private readonly todoCommentRepository: TodoCommentRepositoryPort,
		@Inject(UNIT_OF_WORK)
		private readonly unitOfWork: UnitOfWorkPort,
	) {}

	async execute(input: GetTodoDetailsInput): Promise<TodoDetailsResponse> {
		return this.unitOfWork.run(async () => {
			const todoDetails = await this.todoCommentReader.findAccessibleTodoDetails(
				input.todoId,
				input.viewerId,
			);

			if (todoDetails === null) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId: input.todoId });
			}

			const viewCount = todoDetails.isOwner
				? todoDetails.viewCount
				: (await this.todoCommentRepository.recordView(input.todoId, input.viewerId)).viewCount;

			return {
				todo: todoDetails.todo,
				owner: todoDetails.owner,
				permissions: getTodoDetailsPermissions(todoDetails.isOwner),
				metrics: {
					viewCount,
					commentCount: todoDetails.commentCount,
				},
			};
		});
	}
}
