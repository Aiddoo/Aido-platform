import { toNotificationRouting } from "./notification-routing.mapper.js";

const COMMENT_ID = "cmt92zn3n000b7voxx9quc2th";

describe("toNotificationRouting", () => {
  it("알림 metadata에서 공유 계약이 허용한 routing 필드만 꺼낸다", () => {
    // When
    const routing = toNotificationRouting({
      commentId: COMMENT_ID,
      activityKind: "COMMENT",
      senderId: "sender-1",
      type: "FOLLOW_ACCEPTED",
      todoId: 999,
    });

    // Then
    expect(routing).toEqual({
      commentId: COMMENT_ID,
      activityKind: "COMMENT",
      senderId: "sender-1",
    });
  });

  it("응원 알림은 보낸 사람을 routing에 싣고, 모양이 다른 보낸 사람 값은 버린다", () => {
    // When
    const cheer = toNotificationRouting({
      senderId: "cmsender0000000000000001",
      senderName: "지윤",
      message: "힘내",
    });
    const invalidSender = toNotificationRouting({ commentId: COMMENT_ID, senderName: 42 });

    // Then
    expect(cheer).toEqual({ senderId: "cmsender0000000000000001", senderName: "지윤" });
    expect(invalidSender).toEqual({ commentId: COMMENT_ID });
  });

  it("댓글 식별자가 공유 계약과 다르면 routing을 보내지 않는다", () => {
    // When
    const routing = toNotificationRouting({
      commentId: "invalid-comment-id",
      activityKind: "REPLY",
    });

    // Then
    expect(routing).toBeUndefined();
  });

  it("할 일 주인과 날짜를 싣고, 형식이 틀린 날짜는 그 필드만 버린다", () => {
    // When
    const validDate = toNotificationRouting({
      commentId: COMMENT_ID,
      todoOwnerId: "owner-1",
      todoDate: "2026-10-27",
    });
    const invalidDate = toNotificationRouting({
      commentId: COMMENT_ID,
      todoOwnerId: "owner-1",
      todoDate: "10/27",
    });

    // Then
    expect(validDate).toEqual({
      commentId: COMMENT_ID,
      todoOwnerId: "owner-1",
      todoDate: "2026-10-27",
    });
    expect(invalidDate).toEqual({ commentId: COMMENT_ID, todoOwnerId: "owner-1" });
  });
});
