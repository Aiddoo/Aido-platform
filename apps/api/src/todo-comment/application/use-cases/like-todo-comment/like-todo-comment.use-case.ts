import { ErrorCode } from "@aido/errors";
import type { TodoCommentLikeResponse } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	MUTATION_LOCK,
	MutationLockKeys,
	type MutationLockPort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";

import { assertTodoCommentAccess } from "../../assert-todo-comment-access";
import {
	TODO_COMMENT_NOTIFICATION,
	type TodoCommentNotificationPort,
} from "../../ports/todo-comment-notification.port";
import {
	TODO_COMMENT_READER,
	type TodoCommentReaderPort,
} from "../../ports/todo-comment.reader.port";
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
		@Inject(TODO_COMMENT_READER)
		private readonly reader: TodoCommentReaderPort,
		@Inject(TODO_COMMENT_REPOSITORY)
		private readonly repository: TodoCommentRepositoryPort,
		@Inject(TODO_COMMENT_NOTIFICATION)
		private readonly notification: TodoCommentNotificationPort,
		@Inject(MUTATION_LOCK)
		private readonly mutationLock: MutationLockPort,
		@Inject(UNIT_OF_WORK)
		private readonly unitOfWork: UnitOfWorkPort,
	) {}

	async execute(input: LikeTodoCommentInput): Promise<TodoCommentLikeResponse> {
		const likeOutcome = await this.unitOfWork.run(async () => {
			await this.mutationLock.acquire([MutationLockKeys.todoComment(input.commentId)]);
			await assertTodoCommentAccess(this.reader, input.todoId, input.userId);
			const comment = await this.repository.findComment(input.todoId, input.commentId);

			if (comment === null) {
				throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
			}

			comment.assertCanReceiveInteraction();
			const senderName = await this.reader.findUserDisplayName(input.userId);
			const transition = await this.repository.setLike(input.todoId, input.commentId, input.userId);
			return { transition, senderName, threadRootId: comment.threadRootId.getValue() };
		});

		const recipientId = likeOutcome.transition.commentAuthorId;
		if (
			likeOutcome.transition.changed &&
			!likeOutcome.transition.wasEverNotified &&
			recipientId !== null
		) {
			await settleAfterCommit(this.#logger, [
				{
					label: "댓글 좋아요 알림",
					run: () =>
						this.#notifyLiked(input, recipientId, {
							senderName: likeOutcome.senderName,
							threadRootId: likeOutcome.threadRootId,
						}),
				},
			]);
		}

		return {
			commentId: input.commentId,
			isLiked: true,
			likeCount: likeOutcome.transition.likeCount,
		};
	}

	/** 알림 성공 뒤에만 표시해 일시 실패를 영구 유실로 만들지 않는다. */
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
