import {
	TODO_COMMENT_LIMITS,
	type PaginatedTodoComments,
	type TodoCommentSort,
} from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { assertTodoCommentAccess } from "../../assert-todo-comment-access";
import { TODO_COMMENT_CACHE, type TodoCommentCachePort } from "../../ports/todo-comment-cache.port";
import {
	TODO_COMMENT_REPOSITORY,
	type TodoCommentRepositoryPort,
} from "../../ports/todo-comment.repository.port";
import { decodeTodoCommentCursor } from "../../todo-comment-cursor";
import { collectCommentIds, toPaginatedTodoComments } from "../../types";

export interface ListTodoCommentsInput {
	todoId: number;
	viewerId: string;
	sort: TodoCommentSort;
	size: number;
	cursor?: string;
}

/** 할 일에 바로 달린 최상위 댓글 목록. 각 댓글은 답글 미리보기를 한 겹 함께 싣는다. */
@Injectable()
export class ListTodoCommentsUseCase {
	constructor(
		@Inject(TODO_COMMENT_REPOSITORY)
		private readonly repository: TodoCommentRepositoryPort,
		@Inject(TODO_COMMENT_CACHE)
		private readonly cache: TodoCommentCachePort,
	) {}

	async execute(input: ListTodoCommentsInput): Promise<PaginatedTodoComments> {
		await assertTodoCommentAccess(this.repository, input.todoId, input.viewerId);

		const isCacheable =
			input.cursor === undefined && input.size === TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE;
		const cacheRead = isCacheable
			? await this.cache.readTopLevelFirstPage(input.todoId, input.sort)
			: undefined;
		const page =
			cacheRead?.page ??
			(await this.repository.listComments({
				todoId: input.todoId,
				parentId: null,
				sort: input.sort,
				size: input.size,
				cursor: decodeTodoCommentCursor(input.cursor, input.sort),
			}));

		if (cacheRead !== undefined && cacheRead.page === undefined) {
			await this.cache.storeTopLevelFirstPageIfCurrent(
				input.todoId,
				input.sort,
				cacheRead.generation,
				page,
			);
		}

		// 좋아요 여부는 캐시에 담지 않고 미리보기까지 한 번의 조회로 붙인다.
		const likedCommentIds = await this.repository.findLikedCommentIds(
			collectCommentIds(page.items),
			input.viewerId,
		);

		return toPaginatedTodoComments(page, input.viewerId, likedCommentIds);
	}
}
