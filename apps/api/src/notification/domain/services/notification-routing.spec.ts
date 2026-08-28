import { toNotificationRouting } from "./notification-routing";

const COMMENT_ID = "cmt92zn3n000b7voxx9quc2th";

describe("toNotificationRouting", () => {
	it("알림 metadata에서 공유 계약이 허용한 routing 필드만 꺼낸다", () => {
		expect(
			toNotificationRouting({
				commentId: COMMENT_ID,
				activityKind: "COMMENT",
				senderId: "sender-1",
				type: "FOLLOW_ACCEPTED",
				todoId: 999,
			}),
		).toEqual({
			commentId: COMMENT_ID,
			activityKind: "COMMENT",
		});
	});

	it("댓글 식별자가 공유 계약과 다르면 routing을 보내지 않는다", () => {
		expect(
			toNotificationRouting({
				commentId: "invalid-comment-id",
				activityKind: "REPLY",
			}),
		).toBeUndefined();
	});
});
