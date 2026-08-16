import { ErrorCode } from "@aido/errors";
import type { TodoCommentThreadResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { ApplicationException } from "@/shared/domain";

import { assertTodoCommentAccess } from "../../assert-todo-comment-access";
import {
	TODO_COMMENT_REPOSITORY,
	type TodoCommentRepositoryPort,
} from "../../ports/todo-comment.repository.port";
import {
	collectCommentIds,
	toTodoCommentPreviewResponse,
	toTodoCommentResponse,
} from "../../types";

export interface GetTodoCommentThreadInput {
	todoId: number;
	commentId: string;
	viewerId: string;
}

/**
 * 스레드 화면의 머리말 — 조상 사슬(뿌리 → 부모)과 지금 보는 댓글.
 * 정렬과 무관한 값만 담아 정렬을 바꿔도 다시 만들지 않는다.
 */
@Injectable()
export class GetTodoCommentThreadUseCase {
	constructor(
		@Inject(TODO_COMMENT_REPOSITORY)
		private readonly repository: TodoCommentRepositoryPort,
	) {}

	async execute(input: GetTodoCommentThreadInput): Promise<TodoCommentThreadResponse> {
		await assertTodoCommentAccess(this.repository, input.todoId, input.viewerId);
		const comment = await this.repository.findCommentRecord(input.todoId, input.commentId);

		if (comment === null) {
			throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
		}

		// 조상은 path 덕분에 깊이와 무관하게 한 번에 읽힌다.
		const ancestors = await this.repository.findAncestors(input.todoId, comment.path);
		const likedCommentIds = await this.repository.findLikedCommentIds(
			collectCommentIds([comment, ...ancestors]),
			input.viewerId,
		);

		return {
			ancestors: ancestors.map((ancestor) =>
				toTodoCommentPreviewResponse(ancestor, input.viewerId, likedCommentIds),
			),
			comment: toTodoCommentResponse(comment, input.viewerId, likedCommentIds),
		};
	}
}
