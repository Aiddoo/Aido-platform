import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildWeatherRescheduleDeepLink,
  NOTICE_DEEP_LINK_PATH,
  NOTIFICATION_NAVIGATION_KIND,
  NOTIFICATION_TYPE,
  type NotificationNavigation,
} from "@aido/api";

import type { NotificationType } from "../../../inbox/domain/notification-type.constants.js";
import { toNotificationNavigation } from "./notification-navigation.mapper.js";

const COMMENT_ID = "cmt92zn3n000b7voxx9quc2th";
const THREAD_COMMENT_ID = "cmt92zn3n000a7voxx9quc2th";
const FRIEND_ID = "cmfriend00000000000000001";

function source(
  type: NotificationType,
  overrides: Omit<Partial<Parameters<typeof toNotificationNavigation>[0]>, "type"> = {},
): Parameters<typeof toNotificationNavigation>[0] {
  return { type, ...overrides };
}

describe("toNotificationNavigation — 푸시 이동 문맥", () => {
  it("댓글 알림은 할 일·댓글·대화 머리 댓글·활동 종류를 TODO_COMMENT로 싣는다", () => {
    // Given
    const input = source("TODO_SHARED", {
      todoId: 42,
      routing: {
        commentId: COMMENT_ID,
        threadRootId: THREAD_COMMENT_ID,
        activityKind: "REPLY",
        todoOwnerId: FRIEND_ID,
        todoDate: "2026-11-03",
      },
    });

    // When
    const navigation = toNotificationNavigation(input);

    // Then
    expect(navigation).toEqual({
      kind: "TODO_COMMENT",
      todoId: 42,
      commentId: COMMENT_ID,
      threadCommentId: THREAD_COMMENT_ID,
      activityKind: "REPLY",
      todoOwnerId: FRIEND_ID,
      todoDate: "2026-11-03",
    });
  });

  it("댓글 재료가 빠진 TODO_SHARED는 할 일 상세로, 할 일도 없으면 이동하지 않는다", () => {
    // Given / When / Then
    expect(toNotificationNavigation(source("TODO_SHARED", { todoId: 42 }))).toEqual({
      kind: "TODO",
      todoId: 42,
    });
    expect(toNotificationNavigation(source("TODO_SHARED"))).toEqual({ kind: "NONE" });
  });

  it("할 일이 걸린 콕은 콕 상세로, 할 일 없는 콕은 보낸 친구 피드로, 아무 재료도 없으면 내 피드로 연다", () => {
    // Given / When / Then
    expect(
      toNotificationNavigation(
        source("NUDGE_RECEIVED", { nudgeId: 7, todoId: 42, friendId: FRIEND_ID }),
      ),
    ).toEqual({ kind: "NUDGE", nudgeId: 7 });
    expect(
      toNotificationNavigation(source("NUDGE_RECEIVED", { nudgeId: 7, friendId: FRIEND_ID })),
    ).toEqual({ kind: "FRIEND_FEED", friendId: FRIEND_ID });
    expect(toNotificationNavigation(source("NUDGE_RECEIVED"))).toEqual({ kind: "FEED" });
  });

  it("콕 답장은 콕 상세로, 콕 ID가 없으면 알림 목록으로 연다", () => {
    // Given / When / Then
    expect(toNotificationNavigation(source("NUDGE_REPLIED", { nudgeId: 7 }))).toEqual({
      kind: "NUDGE",
      nudgeId: 7,
    });
    expect(toNotificationNavigation(source("NUDGE_THANKED"))).toEqual({ kind: "NOTIFICATIONS" });
  });

  it("응원은 응원 ID와 보낸 친구를 CHEER로 싣는다", () => {
    // Given
    const input = source("CHEER_RECEIVED", { cheerId: 3, friendId: FRIEND_ID });

    // When / Then
    expect(toNotificationNavigation(input)).toEqual({
      kind: "CHEER",
      cheerId: 3,
      friendId: FRIEND_ID,
    });
  });

  it.each(["FOLLOW_ACCEPTED", "FRIEND_COMPLETED", "NUDGE_SUGGEST"] as const)(
    "%s는 친구 피드로 연다",
    (type) => {
      // Given / When / Then
      expect(toNotificationNavigation(source(type, { friendId: FRIEND_ID }))).toEqual({
        kind: "FRIEND_FEED",
        friendId: FRIEND_ID,
      });
    },
  );

  it("할 일 리마인더는 할 일 상세로, 할 일이 없으면 내 피드로 연다", () => {
    // Given / When / Then
    expect(toNotificationNavigation(source("TODO_REMINDER", { todoId: 42 }))).toEqual({
      kind: "TODO",
      todoId: 42,
    });
    expect(toNotificationNavigation(source("TODO_REMINDER"))).toEqual({ kind: "FEED" });
  });

  it("아침 날씨의 옮기기 링크는 할 일 목록과 이유를 싣고, 다른 링크는 날씨 화면으로 연다", () => {
    // Given
    const rescheduleUrl = buildWeatherRescheduleDeepLink([12, 15], "heat");

    // When / Then
    expect(
      toNotificationNavigation(
        source("WEATHER_MORNING", { action: { type: "DEEP_LINK", url: rescheduleUrl } }),
      ),
    ).toEqual({ kind: "WEATHER_RESCHEDULE", todoIds: [12, 15], reason: "heat" });
    expect(
      toNotificationNavigation(
        source("WEATHER_MORNING", {
          action: { type: "DEEP_LINK", url: "/weather/reschedule?todoIds=a,0" },
        }),
      ),
    ).toEqual({ kind: "WEATHER" });
  });

  it.each([
    [NOTICE_DEEP_LINK_PATH.FEED, "FEED"],
    [NOTICE_DEEP_LINK_PATH.ACHIEVEMENTS, "ACHIEVEMENTS"],
    [NOTICE_DEEP_LINK_PATH.WEATHER, "WEATHER"],
    [NOTICE_DEEP_LINK_PATH.FRIENDS, "FRIENDS"],
    [NOTICE_DEEP_LINK_PATH.FRIEND_INVITE, "INVITE"],
    [NOTICE_DEEP_LINK_PATH.SUBSCRIPTION, "SUBSCRIPTION"],
    [NOTICE_DEEP_LINK_PATH.NOTIFICATION_SETTINGS, "NOTIFICATION_SETTINGS"],
    ["/todos/1", "NONE"],
  ] as const)("공지의 앱 경로 %s는 %s로 연다", (url, kind) => {
    // Given / When / Then
    expect(
      toNotificationNavigation(source("ADMIN_BROADCAST", { action: { type: "DEEP_LINK", url } })),
    ).toEqual({ kind });
  });

  it("외부 링크는 http(s)만 EXTERNAL_URL로 싣고, NONE 액션은 이동하지 않는다", () => {
    // Given / When / Then
    expect(
      toNotificationNavigation(
        source("SYSTEM_NOTICE", { action: { type: "WEBVIEW", url: "https://aido.kr/notice" } }),
      ),
    ).toEqual({ kind: "EXTERNAL_URL", url: "https://aido.kr/notice", presentation: "WEBVIEW" });
    expect(
      toNotificationNavigation(
        source("SYSTEM_NOTICE", { action: { type: "BROWSER", url: "javascript:alert(1)" } }),
      ),
    ).toEqual({ kind: "NONE" });
    expect(
      toNotificationNavigation(source("TODO_REMINDER", { todoId: 42, action: { type: "NONE" } })),
    ).toEqual({ kind: "NONE" });
  });

  it.each([
    ["FOLLOW_NEW", "FRIEND_REQUESTS"],
    ["WEATHER_EVENING", "WEATHER"],
    ["WEEKLY_ACHIEVEMENT", "ACHIEVEMENTS"],
    ["WEEKLY_REPORT", "REPORTS"],
    ["MONTHLY_REPORT", "REPORTS"],
    ["AI_SUGGESTION", "SUGGESTIONS"],
    ["INVITE_JOINED", "INVITE"],
    ["INVITE_REWARDED", "INVITE"],
    ["INVITE_PROGRESS", "INVITE"],
    ["PREMIUM_GRANT_ENDING", "SUBSCRIPTION"],
    ["DAILY_COMPLETE", "FEED"],
    ["MORNING_REMINDER", "FEED"],
    ["EVENING_REMINDER", "FEED"],
    ["WINBACK", "FEED"],
    ["SOCIAL_DIGEST", "FEED"],
    ["LUNCH_NUDGE", "FEED"],
    ["STREAK_AT_RISK", "FEED"],
    ["INVITE_QUALIFY_REMINDER", "FEED"],
  ] as const)("%s는 고정 화면 %s로 연다", (type, kind) => {
    // Given / When / Then
    expect(toNotificationNavigation(source(type))).toEqual({ kind });
  });

  it("계약을 통과하지 못하는 값이면 navigation을 싣지 않아 기존 필드로 이동하게 한다", () => {
    // Given
    const input = source("TODO_REMINDER", { todoId: -1 });

    // When / Then
    expect(toNotificationNavigation(input)).toBeUndefined();
  });
});

interface NavigationCase {
  readonly name: string;
  readonly source: Parameters<typeof toNotificationNavigation>[0];
  readonly navigation: NotificationNavigation | null;
  readonly knownDifference?: string;
}

/** 앱 test와 함께 읽는 대조표. 앱이 구 필드로 고르는 곳과 서버 navigation을 한 표로 묶는다. */
const NAVIGATION_CASES: readonly NavigationCase[] = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../../../../../../../packages/api/test-fixtures/notification-navigation.cases.json",
    ),
    "utf8",
  ),
);

describe("서버·앱 대조표", () => {
  it("31개 알림 타입이 모두 대조표에 있다", () => {
    // Given
    const types = new Set(NAVIGATION_CASES.map(({ source }) => source.type));

    // When / Then
    expect(Object.values(NOTIFICATION_TYPE).filter((type) => !types.has(type))).toEqual([]);
  });

  it("19개 navigation kind가 모두 대조표에 있다", () => {
    // Given
    const kinds = new Set(NAVIGATION_CASES.map(({ navigation }) => navigation?.kind));

    // When / Then
    expect(Object.values(NOTIFICATION_NAVIGATION_KIND).filter((kind) => !kinds.has(kind))).toEqual(
      [],
    );
  });

  it.each(NAVIGATION_CASES)("$name", ({ source, navigation }) => {
    // Given / When / Then
    expect(toNotificationNavigation(source) ?? null).toEqual(navigation);
  });
});
