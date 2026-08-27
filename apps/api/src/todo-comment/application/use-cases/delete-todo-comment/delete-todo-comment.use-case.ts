import { ErrorCode } from "@aido/errors";
import type { DeleteTodoCommentResponse } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	MUTATION_LOCK,
	MutationLockKeys,
	type MutationLockPort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";
import { now } from "@/shared/domain/date/utils/core";

import { assertTodoCommentAccess } from "../../assert-todo-comment-access";
import {
	TODO_COMMENT_READER,
	type TodoCommentReaderPort,
} from "../../ports/todo-comment.reader.port";
import {
	TODO_COMMENT_REPOSITORY,
	type TodoCommentRepositoryPort,
} from "../../ports/todo-comment.repository.port";
import { TODO_VIEW_CACHE, type TodoViewCachePort } from "../../ports/todo-view-cache.port";
import { settleAfterCommit } from "../../settle-after-commit";

export interface DeleteTodoCommentInput {
	todoId: number;
	commentId: string;
	userId: string;
}

@Injectable()
export class DeleteTodoCommentUseCase {
	readonly #logger = new Logger(DeleteTodoCommentUseCase.name);

	constructor(
		@Inject(TODO_COMMENT_READER)
		private readonly reader: TodoCommentReaderPort,
		@Inject(TODO_COMMENT_REPOSITORY)
		private readonly repository: TodoCommentRepositoryPort,
		@Inject(TODO_VIEW_CACHE)
		private readonly todoViewCache: TodoViewCachePort,
		@Inject(MUTATION_LOCK)
		private readonly mutationLock: MutationLockPort,
		@Inject(UNIT_OF_WORK)
		private readonly unitOfWork: UnitOfWorkPort,
	) {}

	async execute(input: DeleteTodoCommentInput): Promise<DeleteTodoCommentResponse> {
		const outcome = await this.unitOfWork.run(async () => {
			await assertTodoCommentAccess(this.reader, input.todoId, input.userId);
			const snapshot = await this.repository.findComment(input.todoId, input.commentId);

			if (snapshot === null) {
				throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
			}

			// 삭제 정산이 replyCount를 건드리는 모든 조상까지 한 번에 잠근다.
			await this.mutationLock.acquire(
				[input.commentId, ...snapshot.placement.path].map(MutationLockKeys.todoComment),
			);
			const comment = await this.repository.findComment(input.todoId, input.commentId);

			if (comment === null) {
				throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
			}

			if (comment.isDeleted) {
				comment.delete(input.userId, now());
				return false;
			}

			comment.delete(input.userId, now());
			const countDecremented = await this.repository.decrementTodoCommentCount(input.todoId);

			if (!countDecremented || !(await this.repository.deleteComment(comment))) {
				throw new ApplicationException(ErrorCode.SYS_0003, { commentId: input.commentId });
			}

			await this.repository.dropDeletedFromAncestors(input.commentId, comment.placement.path);

			return true;
		});

		if (outcome) {
			await settleAfterCommit(this.#logger, [
				{
					label: "할 일 화면 캐시 무효화",
					run: () => this.todoViewCache.invalidateForTodo(input.todoId),
				},
			]);
		}

		return { commentId: input.commentId, isDeleted: true };
	}
}
