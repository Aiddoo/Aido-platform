import { NotificationBuilder } from "#test/builders/index";

import {
  toNotificationInboxResponse,
  toNotificationResponse,
} from "./notification-response.mapper.js";

describe("notification-response.mapper — 알림 응답", () => {
  describe("toNotificationResponse", () => {
    it("기본 알림을 응답으로 바꾼다", () => {
      // Given
      const notification = NotificationBuilder.create("user-1").build();

      // When
      const result = toNotificationResponse(notification, "ko");

      // Then
      expect(result).toMatchObject({
        id: notification.id,
        userId: "user-1",
        type: notification.type,
        title: notification.title,
        body: notification.body,
        isRead: false,
        createdAt: notification.createdAt.toISOString(),
        readAt: null,
      });
    });

    it.each([
      ["todoId", NotificationBuilder.create("user-1").withTodoId(42), { todoId: 42 }],
      [
        "nudgeId",
        NotificationBuilder.create("user-1").asNudgeReceived("friend-1", 7),
        { friendId: "friend-1", nudgeId: 7 },
      ],
      [
        "cheerId",
        NotificationBuilder.create("user-1").asCheerReceived("friend-1", 3),
        { friendId: "friend-1", cheerId: 3 },
      ],
    ])("%s가 있으면 context에 싣는다", (_field, builder, context) => {
      // Given
      const notification = builder.build();

      // When
      const result = toNotificationResponse(notification, "ko");

      // Then
      expect(result.context).toEqual(context);
    });

    it("context 재료가 모두 null이면 context를 싣지 않는다", () => {
      // Given
      const notification = NotificationBuilder.create("user-1").build();

      // When
      const result = toNotificationResponse(notification, "ko");

      // Then
      expect(result).not.toHaveProperty("context");
    });

    it("객체가 아닌 legacy metadata는 null로 바꾼다", () => {
      // Given
      const notification = { ...NotificationBuilder.create("user-1").build(), metadata: "legacy" };

      // When
      const result = toNotificationResponse(notification, "ko");

      // Then
      expect(result.metadata).toBeNull();
    });

    it("action URL이 있으면 action에 싣는다", () => {
      // Given
      const notification = {
        ...NotificationBuilder.create("user-1").asSystemNotice().build(),
        actionType: "BROWSER" as const,
        actionUrl: "https://aido.app/notice",
      };

      // When
      const result = toNotificationResponse(notification, "ko");

      // Then
      expect(result.action).toEqual({ type: "BROWSER", url: "https://aido.app/notice" });
    });

    it("푸시 data와 같은 navigation을 싣는다", () => {
      // Given
      const nudge = NotificationBuilder.create("user-1")
        .asNudgeReceived("friend-1", 7)
        .withTodoId(42)
        .build();
      const browserNotice = {
        ...NotificationBuilder.create("user-1").asSystemNotice().build(),
        actionType: "BROWSER" as const,
        actionUrl: "https://aido.app/notice",
      };

      // When
      const nudgeResult = toNotificationResponse(nudge, "ko");
      const noticeResult = toNotificationResponse(browserNotice, "ko");

      // Then
      expect(nudgeResult.navigation).toEqual({ kind: "NUDGE", nudgeId: 7 });
      expect(noticeResult.navigation).toEqual({
        kind: "EXTERNAL_URL",
        url: "https://aido.app/notice",
        presentation: "BROWSER",
      });
    });

    it("계약을 통과하지 못하는 navigation은 싣지 않는다", () => {
      // Given
      const notification = {
        ...NotificationBuilder.create("user-1").withType("FOLLOW_ACCEPTED").build(),
        friendId: "x".repeat(65),
      };

      // When
      const result = toNotificationResponse(notification, "ko");

      // Then
      expect(result).not.toHaveProperty("navigation");
    });
  });

  describe("toNotificationInboxResponse", () => {
    it("페이지 항목과 미읽음 수·다음 커서를 함께 싣는다", () => {
      // Given
      const items = [1, 2, 3].map((id) => NotificationBuilder.create("user-1").withId(id).build());

      // When
      const result = toNotificationInboxResponse(
        { items, pagination: { hasNext: true, nextCursor: 3, size: 3 } },
        5,
        "ko",
      );

      // Then
      expect(result.notifications).toHaveLength(3);
      expect(result).toMatchObject({ unreadCount: 5, hasMore: true, nextCursor: 3 });
    });
  });
});
