import { ErrorCode } from "@aido/errors";
import type { PaginatedTodoComments, TodoCommentSort } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { ApplicationException } from "@/shared/domain";

import { assertTodoCommentAccess } from "../../assert-todo-comment-access";
import {
	TODO_COMMENT_REPOSITORY,
	type TodoCommentRepositoryPort,
} from "../../ports/todo-comment.repository.port";
import { decodeTodoCommentCursor } from "../../todo-comment-cursor";
import { collectCommentIds, toPaginatedTodoComments } from "../../types";

export interface ListTodoCommentRepliesInput {
	todoId: number;
	commentId: string;
	viewerId: string;
	sort: TodoCommentSort;
	size: number;
	cursor?: string;
}

/** 어떤 깊이의 댓글이든 그 댓글의 직계 답글 목록. 최상위 목록과 같은 모양·같은 커서를 쓴다. */
@Injectable()
export class ListTodoCommentRepliesUseCase {
	constructor(
		@Inject(TODO_COMMENT_REPOSITORY)
		private readonly repository: TodoCommentRepositoryPort,
	) {}

	async execute(input: ListTodoCommentRepliesInput): Promise<PaginatedTodoComments> {
		await assertTodoCommentAccess(this.repository, input.todoId, input.viewerId);
		const parent = await this.repository.findCommentRecord(input.todoId, input.commentId);

		if (parent === null) {
			throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
		}

		const page = await this.repository.listComments({
			todoId: input.todoId,
			parentId: input.commentId,
			sort: input.sort,
			size: input.size,
			cursor: decodeTodoCommentCursor(input.cursor, input.sort),
		});
		const likedCommentIds = await this.repository.findLikedCommentIds(
			collectCommentIds(page.items),
			input.viewerId,
		);

		return toPaginatedTodoComments(page, input.viewerId, likedCommentIds);
	}
}
