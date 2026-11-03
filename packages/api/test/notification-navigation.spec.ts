import { describe, expect, it } from "vitest";

import {
  type NotificationNavigationKind,
  type NotificationNavigationOf,
  notificationNavigationSchema,
  pushNotificationDataSchema,
} from "../src/index.js";

const COMMENT_ID = "cmt92zn3n000b7voxx9quc2th";
const FRIEND_ID = "cmfriend00000000000000001";

const SAMPLES: { readonly [Kind in NotificationNavigationKind]: NotificationNavigationOf<Kind> } = {
  NONE: { kind: "NONE" },
  EXTERNAL_URL: { kind: "EXTERNAL_URL", url: "https://aido.kr/notice", presentation: "BROWSER" },
  FEED: { kind: "FEED" },
  FRIEND_FEED: { kind: "FRIEND_FEED", friendId: FRIEND_ID },
  FRIENDS: { kind: "FRIENDS" },
  FRIEND_REQUESTS: { kind: "FRIEND_REQUESTS" },
  TODO: { kind: "TODO", todoId: 42, todoOwnerId: FRIEND_ID, todoDate: "2026-11-03" },
  TODO_COMMENT: {
    kind: "TODO_COMMENT",
    todoId: 42,
    commentId: COMMENT_ID,
    threadCommentId: COMMENT_ID,
    activityKind: "LIKE",
  },
  NUDGE: { kind: "NUDGE", nudgeId: 7 },
  CHEER: { kind: "CHEER", cheerId: 3, friendId: FRIEND_ID },
  WEATHER: { kind: "WEATHER" },
  WEATHER_RESCHEDULE: { kind: "WEATHER_RESCHEDULE", todoIds: [12, 15], reason: "rain" },
  ACHIEVEMENTS: { kind: "ACHIEVEMENTS" },
  REPORTS: { kind: "REPORTS" },
  SUGGESTIONS: { kind: "SUGGESTIONS" },
  INVITE: { kind: "INVITE" },
  SUBSCRIPTION: { kind: "SUBSCRIPTION" },
  NOTIFICATIONS: { kind: "NOTIFICATIONS" },
  NOTIFICATION_SETTINGS: { kind: "NOTIFICATION_SETTINGS" },
};

describe("notificationNavigationSchema", () => {
  it.each(Object.values(SAMPLES))("$kind는 JSON 왕복 뒤에도 같은 값으로 파싱된다", (sample) => {
    // Given
    const wire = JSON.parse(JSON.stringify(sample));

    // When
    const parsed = notificationNavigationSchema.parse(wire);

    // Then
    expect(parsed).toEqual(sample);
  });

  it("모르는 kind와 kind에 없는 필드는 거부한다", () => {
    // Given / When / Then
    expect(notificationNavigationSchema.safeParse({ kind: "UNKNOWN" }).success).toBe(false);
    expect(notificationNavigationSchema.safeParse({ kind: "FEED", todoId: 1 }).success).toBe(false);
  });

  it("http(s)가 아닌 외부 주소는 거부한다", () => {
    // Given
    const navigation = {
      kind: "EXTERNAL_URL",
      url: "javascript:alert(1)",
      presentation: "WEBVIEW",
    };

    // When / Then
    expect(notificationNavigationSchema.safeParse(navigation).success).toBe(false);
  });
});

describe("pushNotificationDataSchema.navigation", () => {
  const legacyData = {
    notificationId: 1,
    type: "TODO_SHARED",
    action: { type: "DEEP_LINK" },
    context: { todoId: 42 },
    routing: { commentId: COMMENT_ID, threadRootId: COMMENT_ID, activityKind: "COMMENT" },
  };

  it("navigation이 없는 기존 payload를 그대로 읽는다", () => {
    // Given / When
    const parsed = pushNotificationDataSchema.parse(legacyData);

    // Then
    expect(parsed.navigation).toBeUndefined();
    expect(parsed.routing?.threadRootId).toBe(COMMENT_ID);
  });

  it("모양이 틀린 navigation만 버리고 나머지 기존 필드는 유지한다", () => {
    // Given
    const data = { ...legacyData, navigation: { kind: "TODO", todoId: "42" } };

    // When
    const parsed = pushNotificationDataSchema.parse(data);

    // Then
    expect(parsed.navigation).toBeUndefined();
    expect(parsed.context).toEqual({ todoId: 42 });
  });
});
