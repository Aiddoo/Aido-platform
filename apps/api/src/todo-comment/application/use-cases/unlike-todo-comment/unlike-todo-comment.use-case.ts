import { ErrorCode } from "@aido/errors";
import type { TodoCommentLikeResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";

import { assertTodoCommentAccess } from "../../assert-todo-comment-access";
import { TODO_COMMENT_CACHE, type TodoCommentCachePort } from "../../ports/todo-comment-cache.port";
import {
	TODO_COMMENT_REPOSITORY,
	type TodoCommentRepositoryPort,
} from "../../ports/todo-comment.repository.port";

export interface UnlikeTodoCommentInput {
	todoId: number;
	commentId: string;
	userId: string;
}

@Injectable()
export class UnlikeTodoCommentUseCase {
	constructor(
		@Inject(TODO_COMMENT_REPOSITORY)
		private readonly repository: TodoCommentRepositoryPort,
		@Inject(TODO_COMMENT_CACHE)
		private readonly cache: TodoCommentCachePort,
		@Inject(UNIT_OF_WORK)
		private readonly unitOfWork: UnitOfWorkPort,
	) {}

	async execute(input: UnlikeTodoCommentInput): Promise<TodoCommentLikeResponse> {
		await assertTodoCommentAccess(this.repository, input.todoId, input.userId);
		const transition = await this.unitOfWork.run(async () => {
			const comment = await this.repository.findComment(input.todoId, input.commentId);

			if (comment === null) {
				throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
			}

			comment.assertCanReceiveInteraction();
			return this.repository.removeLike(input.todoId, input.commentId, input.userId);
		});

		if (transition.changed) {
			await this.cache.invalidateTopLevelFirstPages(input.todoId);
		}

		return {
			commentId: input.commentId,
			isLiked: false,
			likeCount: transition.likeCount,
		};
	}
}
