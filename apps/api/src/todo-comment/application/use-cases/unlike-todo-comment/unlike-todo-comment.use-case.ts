import { ErrorCode } from "@aido/errors";
import type { TodoCommentLikeResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

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
	TODO_COMMENT_READER,
	type TodoCommentReaderPort,
} from "../../ports/todo-comment.reader.port";
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
		@Inject(TODO_COMMENT_READER)
		private readonly reader: TodoCommentReaderPort,
		@Inject(TODO_COMMENT_REPOSITORY)
		private readonly repository: TodoCommentRepositoryPort,
		@Inject(MUTATION_LOCK)
		private readonly mutationLock: MutationLockPort,
		@Inject(UNIT_OF_WORK)
		private readonly unitOfWork: UnitOfWorkPort,
	) {}

	async execute(input: UnlikeTodoCommentInput): Promise<TodoCommentLikeResponse> {
		const transition = await this.unitOfWork.run(async () => {
			await this.mutationLock.acquire([MutationLockKeys.todoComment(input.commentId)]);
			await assertTodoCommentAccess(this.reader, input.todoId, input.userId);
			const comment = await this.repository.findComment(input.todoId, input.commentId);

			if (comment === null) {
				throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
			}

			comment.assertCanReceiveInteraction();
			return this.repository.removeLike(input.todoId, input.commentId, input.userId);
		});

		return {
			commentId: input.commentId,
			isLiked: false,
			likeCount: transition.likeCount,
		};
	}
}
