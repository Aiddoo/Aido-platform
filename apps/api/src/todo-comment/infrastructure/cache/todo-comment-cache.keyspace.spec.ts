import { TODO_COMMENT_SORT } from "@aido/validators";

import { TodoCommentCacheKey } from "./todo-comment-cache.keyspace";

describe("TodoCommentCacheKey", () => {
	it("버전과 정렬을 포함한 최상위 첫 페이지 키를 만든다", () => {
		expect(TodoCommentCacheKey.topLevelFirstPage(42, TODO_COMMENT_SORT.POPULAR)).toBe(
			"aido:v1:todo-comments:top-level-first-page-v2:42:popular:20",
		);
	});
});
