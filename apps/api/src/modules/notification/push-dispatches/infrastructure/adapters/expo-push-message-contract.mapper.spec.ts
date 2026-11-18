import {
  notificationBodySchema,
  notificationContentSchema,
  notificationRoutingSchema,
  notificationTitleSchema,
  pushNotificationDataSchema,
  todoCommentNotificationRoutingSchema,
} from "@aido/api/contracts/notification/v1";
import { NOTIFICATION_LIMITS } from "@aido/api/vocabulary";

const COMMENT_ID = "cmt92zn3n000b7voxx9quc2th";
const THREAD_ROOT_ID = "cmt92zn3n000a7voxx9quc2tg";

describe("공유 알림 계약", () => {
  it("제목과 본문 스키마가 공유 최대 길이를 단일 원본으로 사용한다", () => {
    // When
    const maxTitle = notificationTitleSchema.safeParse(
      "t".repeat(NOTIFICATION_LIMITS.MAX_TITLE_LENGTH),
    );
    const tooLongTitle = notificationTitleSchema.safeParse(
      "t".repeat(NOTIFICATION_LIMITS.MAX_TITLE_LENGTH + 1),
    );
    const maxBody = notificationBodySchema.safeParse(
      "한".repeat(NOTIFICATION_LIMITS.MAX_BODY_LENGTH),
    );
    const tooLongContent = notificationContentSchema.safeParse({
      title: "title",
      body: "한".repeat(NOTIFICATION_LIMITS.MAX_BODY_LENGTH + 1),
    });

    // Then
    expect(maxTitle.success).toBe(true);
    expect(tooLongTitle.success).toBe(false);
    expect(maxBody.success).toBe(true);
    expect(tooLongContent.success).toBe(false);
  });

  it("기존 optional routing 계약은 일부 필드 payload를 계속 허용한다", () => {
    // Given
    const legacyRouting = { commentId: COMMENT_ID };

    // When
    const parsedRouting = notificationRoutingSchema.parse(legacyRouting);
    const pushData = pushNotificationDataSchema.safeParse({
      notificationId: 1,
      type: "TODO_SHARED",
      action: { type: "DEEP_LINK" },
      routing: legacyRouting,
    });

    // Then
    expect(parsedRouting).toEqual(legacyRouting);
    expect(pushData.success).toBe(true);
  });

  it("신규 댓글 알림 routing 계약은 세 필드를 모두 요구한다", () => {
    // Given
    const completeRouting = {
      commentId: COMMENT_ID,
      threadRootId: THREAD_ROOT_ID,
      activityKind: "REPLY",
    };

    // When
    const parsedRouting = todoCommentNotificationRoutingSchema.parse(completeRouting);
    const partialRouting = todoCommentNotificationRoutingSchema.safeParse({
      commentId: COMMENT_ID,
      activityKind: "REPLY",
    });

    // Then
    expect(parsedRouting).toEqual(completeRouting);
    expect(partialRouting.success).toBe(false);
  });
});
