import { ErrorCode } from "@aido/errors";
import type { TodoCommentChainResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";

import { ThreadPlacement } from "../../../domain/value-objects/thread-placement.vo";
import { TodoCommentContent } from "../../../domain/value-objects/todo-comment-content.vo";
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
import { toTodoCommentResponse } from "../../types";

export interface WriteTodoCommentChainInput {
	todoId: number;
	authorId: string;
	/** 사슬이 매달릴 댓글. 없으면 할 일에 바로 달린다. */
	parentId: string | null;
	items: { clientRequestId: string; content: string }[];
}

/**
 * 한 번에 이어 쓴 글 묶음을 사슬로 심는다.
 *
 * 첫 글만 대상의 직계 자식이고 나머지는 바로 앞 글의 답글이 된다 —
 * 그래서 부모의 답글 수는 사슬 길이와 무관하게 하나만 오른다.
 * 최상위 댓글이든 답글이든 부모 유무만 다르고 흐름이 같아 한 use-case가 맡는다.
 */
@Injectable()
export class WriteTodoCommentChainUseCase {
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

	async execute(input: WriteTodoCommentChainInput): Promise<TodoCommentChainResponse> {
		await assertTodoCommentAccess(this.repository, input.todoId, input.authorId);
		const contents = input.items.map((item) => TodoCommentContent.create(item.content).getValue());

		const outcome = await this.unitOfWork.run(async () => {
			const parent =
				input.parentId === null
					? null
					: await this.repository.findComment(input.todoId, input.parentId);

			if (input.parentId !== null && parent === null) {
				throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.parentId });
			}

			const chain = await this.repository.createCommentChain({
				todoId: input.todoId,
				authorId: input.authorId,
				placement: parent === null ? ThreadPlacement.topLevel() : parent.placeReply(),
				items: input.items.map((item, index) => ({
					clientRequestId: item.clientRequestId,
					content: contents[index] ?? "",
				})),
			});

			if (chain.createdCount > 0) {
				await this.repository.increaseTodoCommentCount(input.todoId, chain.createdCount);

				// 직계 자식은 사슬의 첫 글 하나뿐이라, 부모의 답글 수는 길이와 무관하게 하나만 오른다.
				if (parent !== null) {
					await this.repository.incrementReplyCount(parent.id.getValue());
				}
			}

			return {
				written: chain.comments,
				addedCount: chain.createdCount,
				recipientId: parent === null ? chain.comments[0]?.todoOwnerId : parent.authorId,
				threadRootId: parent === null ? chain.comments[0]?.id : parent.threadRootId.getValue(),
			};
		});

		if (outcome.addedCount > 0 && outcome.recipientId !== undefined) {
			await Promise.all([
				this.cache.invalidateTopLevelFirstPages(input.todoId),
				this.notification.notifyCommentsWritten({
					recipientId: outcome.recipientId,
					senderId: input.authorId,
					senderName: outcome.written[0]?.authorName ?? null,
					todoId: input.todoId,
					commentId: outcome.written[0]?.id ?? "",
					threadRootId: outcome.threadRootId ?? "",
					isReply: input.parentId !== null,
					count: outcome.addedCount,
				}),
			]);
		}

		return {
			comments: outcome.written.map((record) =>
				toTodoCommentResponse(record, input.authorId, new Set()),
			),
		};
	}
}
