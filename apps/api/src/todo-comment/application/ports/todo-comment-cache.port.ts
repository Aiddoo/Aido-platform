import type { TodoCommentSort } from "@aido/validators";

import type { PaginatedTodoCommentRecords } from "../types";

export const TODO_COMMENT_CACHE = Symbol("TODO_COMMENT_CACHE");

export interface TodoCommentFirstPageCacheRead {
	/** 조회와 저장 사이의 무효화를 판별하는 불투명 토큰. */
	readonly generation: string;
	readonly page: PaginatedTodoCommentRecords | undefined;
}

export interface TodoCommentCachePort {
	readTopLevelFirstPage(
		todoId: number,
		sort: TodoCommentSort,
	): Promise<TodoCommentFirstPageCacheRead>;
	storeTopLevelFirstPageIfCurrent(
		todoId: number,
		sort: TodoCommentSort,
		generation: string,
		page: PaginatedTodoCommentRecords,
	): Promise<void>;
	invalidateTopLevelFirstPages(todoId: number): Promise<void>;
}
