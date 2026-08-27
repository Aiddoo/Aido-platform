import {
	TODO_COMMENT_LIMITS,
	TODO_COMMENT_SORT,
	getTodoCommentOverviewQuerySchema,
} from "@aido/validators";

describe("getTodoCommentOverviewQuerySchema", () => {
	it("정렬과 페이지 크기의 기본값을 채운다", () => {
		const result = getTodoCommentOverviewQuerySchema.parse({});

		expect(result).toEqual({
			sort: TODO_COMMENT_SORT.LATEST,
			size: TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE,
		});
	});

	it("before와 after 중 하나만 받는다", () => {
		expect(getTodoCommentOverviewQuerySchema.safeParse({ before: "before-cursor" }).success).toBe(
			true,
		);
		expect(getTodoCommentOverviewQuerySchema.safeParse({ after: "after-cursor" }).success).toBe(
			true,
		);
		expect(
			getTodoCommentOverviewQuerySchema.safeParse({
				before: "before-cursor",
				after: "after-cursor",
			}).success,
		).toBe(false);
	});

	it("페이지 크기를 정수로 변환하고 허용 범위로 제한한다", () => {
		expect(getTodoCommentOverviewQuerySchema.parse({ size: "1" }).size).toBe(1);
		expect(
			getTodoCommentOverviewQuerySchema.safeParse({
				size: TODO_COMMENT_LIMITS.MAX_PAGE_SIZE + 1,
			}).success,
		).toBe(false);
	});
});
