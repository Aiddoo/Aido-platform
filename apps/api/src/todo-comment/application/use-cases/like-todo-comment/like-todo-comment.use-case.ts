import { ErrorCode } from "@aido/errors";
import type { TodoCommentLikeResponse } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";

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
import { settleAfterCommit } from "../../settle-after-commit";

export interface LikeTodoCommentInput {
	todoId: number;
	commentId: string;
	userId: string;
}

@Injectable()
export class LikeTodoCommentUseCase {
	readonly #logger = new Logger(LikeTodoCommentUseCase.name);

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

		if (likeOutcome.transition.changed) {
			const tasks = [
				{
					label: "comment first pages cache",
					run: () => this.cache.invalidateTopLevelFirstPages(input.todoId),
				},
			];

			// 이미 한 번 알린 좋아요는 껐다 켜도 다시 알리지 않는다.
			if (!likeOutcome.transition.wasEverNotified) {
				tasks.push({
					label: "comment like notification",
					run: () =>
						this.#notifyLiked(input, likeOutcome.transition.commentAuthorId, {
							senderName: likeOutcome.senderName,
							threadRootId: likeOutcome.threadRootId,
						}),
				});
			}

			await settleAfterCommit(this.#logger, tasks);
		}

		return {
			commentId: input.commentId,
			isLiked: true,
			likeCount: likeOutcome.transition.likeCount,
		};
	}

	/**
	 * 보내고 나서 표시한다 — 순서를 뒤집으면 발송이 한 번 실패했을 때 notifiedAt이 남아
	 * 껐다 켜도 다시 시도되지 않는다. 중복 알림 한 번이 영구 유실보다 낫다.
	 */
	async #notifyLiked(
		input: LikeTodoCommentInput,
		recipientId: string,
		context: { senderName: string | null; threadRootId: string },
	): Promise<void> {
		await this.notification.notifyCommentLiked({
			recipientId,
			senderId: input.userId,
			senderName: context.senderName,
			todoId: input.todoId,
			commentId: input.commentId,
			threadRootId: context.threadRootId,
		});
		await this.repository.markLikeNotified(input.commentId, input.userId);
	}
}
