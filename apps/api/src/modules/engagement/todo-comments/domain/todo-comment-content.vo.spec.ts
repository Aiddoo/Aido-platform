import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { TodoCommentContent } from "./todo-comment-content.vo.js";

describe("TodoCommentContent", () => {
  it("앞뒤 공백을 제거한 댓글 내용을 보관한다", () => {
    // When
    const content = TodoCommentContent.create("  같이 해요  ");

    // Then
    expect(content.value).toBe("같이 해요");
  });

  it.each(["", "   "])("빈 댓글을 거부한다: %p", (value) => {
    // When
    const create = () => TodoCommentContent.create(value);

    // Then
    expect(create).toThrow(DomainException);
  });

  it("500자를 초과한 댓글을 거부한다", () => {
    // When
    const create = () => TodoCommentContent.create("가".repeat(501));

    // Then
    expect(create).toThrow(DomainException);
  });
});
