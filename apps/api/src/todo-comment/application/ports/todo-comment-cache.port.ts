import type { TodoCommentSort } from "@aido/validators";

import type { PaginatedTodoCommentRecords } from "../types";

export const TODO_COMMENT_CACHE = Symbol("TODO_COMMENT_CACHE");

export interface TodoCommentCachePort {
	getTopLevelFirstPage(
		todoId: number,
		sort: TodoCommentSort,
	): Promise<PaginatedTodoCommentRecords | undefined>;
	setTopLevelFirstPage(
		todoId: number,
		sort: TodoCommentSort,
		page: PaginatedTodoCommentRecords,
	): Promise<void>;
	invalidateTopLevelFirstPages(todoId: number): Promise<void>;
}
