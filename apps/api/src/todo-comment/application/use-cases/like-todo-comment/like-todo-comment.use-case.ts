import { ErrorCode } from "@aido/errors";
import type { TodoCommentLikeResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";

import { assertTodoCommentAccess } from "../../assert-todo-comment-access";
import { TODO_COMMENT_CACHE, type TodoCommentCachePort } from "../../ports/todo-comment-cache.port";
import {
	TODO_COMMENT_NOTIFICATION,
	type TodoCommentNotificationPort,
} from "../../ports/todo-comment-notification.port";
import {
	TODO_COMMENT_REPOSITORY,
	type TodoCommentRepositoryPort,
} from "../../ports/todo-comment.repository.port";

export interface LikeTodoCommentInput {
	todoId: number;
	commentId: string;
	userId: string;
}

@Injectable()
export class LikeTodoCommentUseCase {
	constructor(
		@Inject(TODO_COMMENT_REPOSITORY)
		private readonly repository: TodoCommentRepositoryPort,
		@Inject(TODO_COMMENT_CACHE)
		private readonly cache: TodoCommentCachePort,
		@Inject(TODO_COMMENT_NOTIFICATION)
		private readonly notification: TodoCommentNotificationPort,
		@Inject(UNIT_OF_WORK)
		private readonly unitOfWork: UnitOfWorkPort,
	) {}

	async execute(input: LikeTodoCommentInput): Promise<TodoCommentLikeResponse> {
		await assertTodoCommentAccess(this.repository, input.todoId, input.userId);
		const likeOutcome = await this.unitOfWork.run(async () => {
			const [comment, senderName] = await Promise.all([
				this.repository.findComment(input.todoId, input.commentId),
				this.repository.findUserDisplayName(input.userId),
			]);

			if (comment === null) {
				throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
			}

			comment.assertCanReceiveInteraction();
			const transition = await this.repository.setLike(input.todoId, input.commentId, input.userId);
			return { transition, senderName, threadRootId: comment.threadRootId.getValue() };
		});

		// 이미 한 번 알린 좋아요는 껐다 켜도 다시 알리지 않는다.
		if (likeOutcome.transition.changed && !likeOutcome.transition.wasEverNotified) {
			await this.repository.markLikeNotified(input.commentId, input.userId);
			await Promise.all([
				this.cache.invalidateTopLevelFirstPages(input.todoId),
				this.notification.notifyCommentLiked({
					recipientId: likeOutcome.transition.commentAuthorId,
					senderId: input.userId,
					senderName: likeOutcome.senderName,
					todoId: input.todoId,
					commentId: input.commentId,
					threadRootId: likeOutcome.threadRootId,
				}),
			]);
		} else if (likeOutcome.transition.changed) {
			await this.cache.invalidateTopLevelFirstPages(input.todoId);
		}

		return {
			commentId: input.commentId,
			isLiked: true,
			likeCount: likeOutcome.transition.likeCount,
		};
	}
}
