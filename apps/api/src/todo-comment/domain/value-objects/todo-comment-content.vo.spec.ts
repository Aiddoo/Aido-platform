import { DomainException } from "@/shared/domain";

import { TodoCommentContent } from "./todo-comment-content.vo";

describe("TodoCommentContent", () => {
	it("앞뒤 공백을 제거한 댓글 내용을 보관한다", () => {
		const content = TodoCommentContent.create("  같이 해요  ");

		expect(content.getValue()).toBe("같이 해요");
	});

	it.each(["", "   "])("빈 댓글을 거부한다: %p", (value) => {
		expect(() => TodoCommentContent.create(value)).toThrow(DomainException);
	});

	it("500자를 초과한 댓글을 거부한다", () => {
		expect(() => TodoCommentContent.create("가".repeat(501))).toThrow(DomainException);
	});
});
