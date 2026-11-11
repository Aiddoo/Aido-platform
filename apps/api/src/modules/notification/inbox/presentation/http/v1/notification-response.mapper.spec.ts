import { toIsoString } from "#api/shared/domain/time/instant";
import { createInboxNotificationFixture } from "#test/fixtures/notification/notification.fixture";

import { createFollowAcceptedNotificationMessage } from "../../../../push/application/messages/social-notification.messages.js";
import {
  renderInboxCopy,
  toNotificationInboxResponse,
  toNotificationResponse,
} from "./notification-response.mapper.js";

const FOLLOW_ACCEPTED_VARIANT_CONTEXT = {
  campaignKey: "FOLLOW_ACCEPTED",
  recipientId: "user-1",
  occurrenceKey: "friend-1:user-1",
};

describe("notification-response.mapper — 알림 응답", () => {
  describe("toNotificationResponse", () => {
    it("기본 알림을 응답으로 바꾼다", () => {
      // Given
      const notification = createInboxNotificationFixture({ userId: "user-1" });

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
        createdAt: toIsoString(notification.createdAt),
        readAt: null,
      });
    });

    it.each([
      ["todoId", createInboxNotificationFixture({ userId: "user-1", todoId: 42 }), { todoId: 42 }],
      [
        "nudgeId",
        createInboxNotificationFixture({
          userId: "user-1",
          type: "NUDGE_RECEIVED",
          friendId: "friend-1",
          nudgeId: 7,
          title: "콕 찌르기!",
          body: "친구가 당신을 찔렀어요",
        }),
        { friendId: "friend-1", nudgeId: 7 },
      ],
      [
        "cheerId",
        createInboxNotificationFixture({
          userId: "user-1",
          type: "CHEER_RECEIVED",
          friendId: "friend-1",
          cheerId: 3,
          title: "응원 메시지!",
          body: "친구가 응원을 보냈어요",
        }),
        { friendId: "friend-1", cheerId: 3 },
      ],
    ])("%s가 있으면 context에 싣는다", (_field, notification, context) => {
      // Given

      // When
      const result = toNotificationResponse(notification, "ko");

      // Then
      expect(result.context).toEqual(context);
    });

    it("context 재료가 모두 null이면 context를 싣지 않는다", () => {
      // Given
      const notification = createInboxNotificationFixture({ userId: "user-1" });

      // When
      const result = toNotificationResponse(notification, "ko");

      // Then
      expect(result).not.toHaveProperty("context");
    });

    it("객체가 아닌 legacy metadata는 null로 바꾼다", () => {
      // Given
      const notification = {
        ...createInboxNotificationFixture({ userId: "user-1" }),
        metadata: "legacy",
      };

      // When
      const result = toNotificationResponse(notification, "ko");

      // Then
      expect(result.metadata).toBeNull();
    });

    it("action URL이 있으면 action에 싣는다", () => {
      // Given
      const notification = {
        ...createInboxNotificationFixture({
          userId: "user-1",
          type: "SYSTEM_NOTICE",
          title: "시스템 공지",
          body: "서비스 점검 예정",
        }),
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
      const nudge = createInboxNotificationFixture({
        userId: "user-1",
        type: "NUDGE_RECEIVED",
        friendId: "friend-1",
        nudgeId: 7,
        title: "콕 찌르기!",
        body: "친구가 당신을 찔렀어요",
        todoId: 42,
      });
      const browserNotice = {
        ...createInboxNotificationFixture({
          userId: "user-1",
          type: "SYSTEM_NOTICE",
          title: "시스템 공지",
          body: "서비스 점검 예정",
        }),
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
        ...createInboxNotificationFixture({ userId: "user-1", type: "FOLLOW_ACCEPTED" }),
        friendId: "x".repeat(65),
      };

      // When
      const result = toNotificationResponse(notification, "ko");

      // Then
      expect(result).not.toHaveProperty("navigation");
    });
  });

  describe("renderInboxCopy", () => {
    it("copyKey가 없는 옛 알림은 저장한 문구를 그대로 준다", () => {
      // Given
      const source = { title: "저장 제목", body: "저장 본문", copyKey: null, copyFacts: null };

      // When
      const result = renderInboxCopy(source, "en");

      // Then
      expect(result).toEqual({ title: "저장 제목", body: "저장 본문" });
    });

    it("한국어로 저장한 알림을 요청 언어(en)로 다시 그린다", () => {
      // Given
      const stored = createFollowAcceptedNotificationMessage({
        senderName: "민재",
        locale: "ko",
        variantContext: FOLLOW_ACCEPTED_VARIANT_CONTEXT,
      });
      const english = createFollowAcceptedNotificationMessage({
        senderName: "민재",
        locale: "en",
        variantContext: FOLLOW_ACCEPTED_VARIANT_CONTEXT,
      });

      // When
      const result = renderInboxCopy(stored, "en");

      // Then
      expect(english.copyKey).toBe(stored.copyKey);
      expect(result).toEqual({ title: english.title, body: english.body });
      expect(result.title).not.toBe(stored.title);
    });

    it("모르는 copyKey면 저장한 문구를 준다", () => {
      // Given
      const source = {
        title: "저장 제목",
        body: "저장 본문",
        copyKey: "social.REMOVED_TEMPLATE.v1",
        copyFacts: { sender: "민재" },
      };

      // When
      const result = renderInboxCopy(source, "en");

      // Then
      expect(result).toEqual({ title: "저장 제목", body: "저장 본문" });
    });

    it("Accept-Language가 없는 요청은 저장한 문구를 준다", () => {
      // Given
      const stored = createFollowAcceptedNotificationMessage({
        senderName: "민재",
        locale: "en",
        variantContext: FOLLOW_ACCEPTED_VARIANT_CONTEXT,
      });

      // When
      const result = renderInboxCopy(stored, null);

      // Then
      expect(result).toEqual({ title: stored.title, body: stored.body });
    });
  });

  describe("toNotificationInboxResponse", () => {
    it("페이지 항목과 미읽음 수·다음 커서를 함께 싣는다", () => {
      // Given
      const items = [1, 2, 3].map((id) => createInboxNotificationFixture({ userId: "user-1", id }));

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
