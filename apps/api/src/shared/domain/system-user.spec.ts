import { emailSchema, userTagParamSchema } from "@aido/validators";

import { DELETED_COMMENT_AUTHOR } from "./system-user";

describe("플랫폼 시스템 사용자", () => {
	it("삭제된 댓글 작성자 식별자는 공개 가입·친구 요청으로 만들 수 없다", () => {
		expect(emailSchema.safeParse(DELETED_COMMENT_AUTHOR.email).success).toBe(false);
		expect(userTagParamSchema.safeParse({ userTag: DELETED_COMMENT_AUTHOR.userTag }).success).toBe(
			false,
		);
	});
});
