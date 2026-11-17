import { emailSchema, userTagParamSchema } from "@aido/api";

import { DELETED_COMMENT_AUTHOR } from "./todo-comments.constants.js";

describe("지운 댓글 작성자", () => {
  it("삭제된 댓글 작성자 식별자는 공개 가입·친구 요청으로 만들 수 없다", () => {
    // When
    const email = emailSchema.safeParse(DELETED_COMMENT_AUTHOR.email);
    const userTag = userTagParamSchema.safeParse({ userTag: DELETED_COMMENT_AUTHOR.userTag });

    // Then
    expect(email.success).toBe(false);
    expect(userTag.success).toBe(false);
  });
});
