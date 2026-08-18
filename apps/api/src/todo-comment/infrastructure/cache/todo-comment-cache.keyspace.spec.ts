import { TODO_COMMENT_SORT } from "@aido/validators";

import { TodoCommentCacheKey } from "./todo-comment-cache.keyspace";

describe("TodoCommentCacheKey", () => {
	it("generation과 정렬을 포함한 최상위 첫 페이지 키를 만든다", () => {
		expect(TodoCommentCacheKey.topLevelFirstPage(42, TODO_COMMENT_SORT.POPULAR, "gen-7")).toBe(
			"aido:v1:todo-comments:top-level-first-page-v4:42:gen-7:popular:20",
		);
	});

	it("특정 generation의 첫 페이지 전체를 지우는 패턴을 만든다", () => {
		expect(TodoCommentCacheKey.firstPageGenerationPattern(42, "gen-7")).toBe(
			"aido:v1:todo-comments:top-level-first-page-v4:42:gen-7:*",
		);
	});
});
