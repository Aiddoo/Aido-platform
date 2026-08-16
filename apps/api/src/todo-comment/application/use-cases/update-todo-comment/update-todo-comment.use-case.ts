import { ErrorCode } from "@aido/errors";
import type { TodoCommentMutationResponse } from "@aido/validators";
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
import { toTodoCommentResponse } from "../../types";

export interface UpdateTodoCommentInput {
	todoId: number;
	commentId: string;
	userId: string;
	content: string;
}

@Injectable()
export class UpdateTodoCommentUseCase {
	constructor(
		@Inject(TODO_COMMENT_REPOSITORY)
		private readonly repository: TodoCommentRepositoryPort,
		@Inject(TODO_COMMENT_CACHE)
		private readonly cache: TodoCommentCachePort,
		@Inject(UNIT_OF_WORK)
		private readonly unitOfWork: UnitOfWorkPort,
	) {}

	async execute(input: UpdateTodoCommentInput): Promise<TodoCommentMutationResponse> {
		await assertTodoCommentAccess(this.repository, input.todoId, input.userId);
		await this.unitOfWork.run(async () => {
			const comment = await this.repository.findComment(input.todoId, input.commentId);

			if (comment === null) {
				throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
			}

			comment.edit(input.userId, input.content, now());
			await this.repository.updateComment(comment);
		});

		await this.cache.invalidateTopLevelFirstPages(input.todoId);
		const updatedComment = await this.repository.findCommentRecord(input.todoId, input.commentId);

		if (updatedComment === null) {
			throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
		}

		const likedIds = await this.repository.findLikedCommentIds([input.commentId], input.userId);

		// 최상위든 답글이든 같은 모양이라 분기가 없다.
		return { comment: toTodoCommentResponse(updatedComment, input.userId, likedIds) };
	}
}
