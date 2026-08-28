import {
	NOTIFICATION_LIMITS,
	notificationBodySchema,
	notificationContentSchema,
	notificationRoutingSchema,
	notificationTitleSchema,
	pushNotificationDataSchema,
	todoCommentNotificationRoutingSchema,
} from "@aido/validators";

const COMMENT_ID = "cmt92zn3n000b7voxx9quc2th";
const THREAD_ROOT_ID = "cmt92zn3n000a7voxx9quc2tg";

describe("공유 알림 계약", () => {
	it("제목과 본문 스키마가 공유 최대 길이를 단일 원본으로 사용한다", () => {
		expect(
			notificationTitleSchema.safeParse("t".repeat(NOTIFICATION_LIMITS.MAX_TITLE_LENGTH)).success,
		).toBe(true);
		expect(
			notificationTitleSchema.safeParse("t".repeat(NOTIFICATION_LIMITS.MAX_TITLE_LENGTH + 1))
				.success,
		).toBe(false);
		expect(
			notificationBodySchema.safeParse("한".repeat(NOTIFICATION_LIMITS.MAX_BODY_LENGTH)).success,
		).toBe(true);
		expect(
			notificationContentSchema.safeParse({
				title: "title",
				body: "한".repeat(NOTIFICATION_LIMITS.MAX_BODY_LENGTH + 1),
			}).success,
		).toBe(false);
	});

	it("기존 optional routing 계약은 일부 필드 payload를 계속 허용한다", () => {
		const legacyRouting = { commentId: COMMENT_ID };

		expect(notificationRoutingSchema.parse(legacyRouting)).toEqual(legacyRouting);
		expect(
			pushNotificationDataSchema.safeParse({
				notificationId: 1,
				type: "TODO_SHARED",
				action: { type: "DEEP_LINK" },
				routing: legacyRouting,
			}).success,
		).toBe(true);
	});

	it("신규 댓글 알림 routing 계약은 세 필드를 모두 요구한다", () => {
		const completeRouting = {
			commentId: COMMENT_ID,
			threadRootId: THREAD_ROOT_ID,
			activityKind: "REPLY",
		};

		expect(todoCommentNotificationRoutingSchema.parse(completeRouting)).toEqual(completeRouting);
		expect(
			todoCommentNotificationRoutingSchema.safeParse({
				commentId: COMMENT_ID,
				activityKind: "REPLY",
			}).success,
		).toBe(false);
	});
});
