import { ErrorCode } from "@aido/errors";
import type { DeleteTodoCommentResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";
import { now } from "@/shared/domain/date/utils/core";

import { assertTodoCommentAccess } from "../../assert-todo-comment-access";
import { TODO_COMMENT_CACHE, type TodoCommentCachePort } from "../../ports/todo-comment-cache.port";
import {
	TODO_COMMENT_REPOSITORY,
	type TodoCommentRepositoryPort,
} from "../../ports/todo-comment.repository.port";

export interface DeleteTodoCommentInput {
	todoId: number;
	commentId: string;
	userId: string;
}

@Injectable()
export class DeleteTodoCommentUseCase {
	constructor(
		@Inject(TODO_COMMENT_REPOSITORY)
		private readonly repository: TodoCommentRepositoryPort,
		@Inject(TODO_COMMENT_CACHE)
		private readonly cache: TodoCommentCachePort,
		@Inject(UNIT_OF_WORK)
		private readonly unitOfWork: UnitOfWorkPort,
	) {}

	async execute(input: DeleteTodoCommentInput): Promise<DeleteTodoCommentResponse> {
		await assertTodoCommentAccess(this.repository, input.todoId, input.userId);
		const wasDeleted = await this.unitOfWork.run(async () => {
			const comment = await this.repository.findComment(input.todoId, input.commentId);

			if (comment === null) {
				throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
			}

			if (comment.isDeleted) {
				comment.delete(input.userId, now());
				return false;
			}

			comment.delete(input.userId, now());
			await this.repository.deleteComment(comment);
			await this.repository.decrementTodoCommentCount(input.todoId);
			await this.repository.dropDeletedFromAncestors(input.commentId, comment.placement.path);

			return true;
		});

		if (wasDeleted) {
			await this.cache.invalidateTopLevelFirstPages(input.todoId);
		}

		return { commentId: input.commentId, isDeleted: true };
	}
}
