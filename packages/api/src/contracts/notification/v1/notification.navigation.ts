import { z } from "zod";

import { dateSchema } from "../../../common/datetime.js";
import {
  NOTIFICATION_ACTION_TYPE,
  NOTIFICATION_ACTIVITY_KIND,
  NOTIFICATION_NAVIGATION_KIND,
} from "../../../vocabulary/notification.constants.js";
import {
  WEATHER_RESCHEDULE_MAX_TODO_IDS,
  WEATHER_RESCHEDULE_REASONS,
} from "../../../vocabulary/weather.constants.js";
import { todoCommentIdSchema } from "../../todo-comment/v1/todo-comment.request.js";

export const notificationActivityKindSchema = z.enum(NOTIFICATION_ACTIVITY_KIND);

export type NotificationActivityKind = z.infer<typeof notificationActivityKindSchema>;

const positiveIdSchema = z.number().int().positive();
const userIdSchema = z.string().min(1).max(64);

/** 할 일이 대상인 목적지. 주인·날짜가 있으면 펼친 화면이 목록 pane을 그 사람의 그 날짜 피드로 연다. */
const todoTargetShape = {
  todoId: positiveIdSchema,
  todoOwnerId: userIdSchema.optional(),
  todoDate: dateSchema.optional(),
};

function screen<const Kind extends string>(kind: Kind) {
  return z.strictObject({ kind: z.literal(kind) });
}

export const notificationNavigationSchema = z
  .discriminatedUnion("kind", [
    screen(NOTIFICATION_NAVIGATION_KIND.NONE),
    z.strictObject({
      kind: z.literal(NOTIFICATION_NAVIGATION_KIND.EXTERNAL_URL),
      url: z.url({ protocol: /^https?$/ }),
      presentation: z.enum([NOTIFICATION_ACTION_TYPE.BROWSER, NOTIFICATION_ACTION_TYPE.WEBVIEW]),
    }),
    screen(NOTIFICATION_NAVIGATION_KIND.FEED),
    z.strictObject({
      kind: z.literal(NOTIFICATION_NAVIGATION_KIND.FRIEND_FEED),
      friendId: userIdSchema,
    }),
    screen(NOTIFICATION_NAVIGATION_KIND.FRIENDS),
    screen(NOTIFICATION_NAVIGATION_KIND.FRIEND_REQUESTS),
    z.strictObject({
      kind: z.literal(NOTIFICATION_NAVIGATION_KIND.TODO),
      ...todoTargetShape,
    }),
    z.strictObject({
      kind: z.literal(NOTIFICATION_NAVIGATION_KIND.TODO_COMMENT),
      ...todoTargetShape,
      commentId: todoCommentIdSchema,
      threadCommentId: todoCommentIdSchema.describe("대화의 머리 댓글 ID (댓글은 두 단계)"),
      activityKind: notificationActivityKindSchema,
    }),
    z.strictObject({
      kind: z.literal(NOTIFICATION_NAVIGATION_KIND.NUDGE),
      nudgeId: positiveIdSchema,
    }),
    z.strictObject({
      kind: z.literal(NOTIFICATION_NAVIGATION_KIND.CHEER),
      cheerId: positiveIdSchema,
      friendId: userIdSchema,
    }),
    screen(NOTIFICATION_NAVIGATION_KIND.WEATHER),
    z.strictObject({
      kind: z.literal(NOTIFICATION_NAVIGATION_KIND.WEATHER_RESCHEDULE),
      todoIds: z.array(positiveIdSchema).min(1).max(WEATHER_RESCHEDULE_MAX_TODO_IDS),
      reason: z.enum(WEATHER_RESCHEDULE_REASONS),
    }),
    screen(NOTIFICATION_NAVIGATION_KIND.ACHIEVEMENTS),
    screen(NOTIFICATION_NAVIGATION_KIND.REPORTS),
    screen(NOTIFICATION_NAVIGATION_KIND.SUGGESTIONS),
    screen(NOTIFICATION_NAVIGATION_KIND.INVITE),
    screen(NOTIFICATION_NAVIGATION_KIND.SUBSCRIPTION),
    screen(NOTIFICATION_NAVIGATION_KIND.NOTIFICATIONS),
    screen(NOTIFICATION_NAVIGATION_KIND.NOTIFICATION_SETTINGS),
  ])
  .describe("알림을 눌렀을 때 열 화면 (1.14.1+ 푸시). kind로 판별한다");

export type NotificationNavigation = z.infer<typeof notificationNavigationSchema>;

export type NotificationNavigationKind = NotificationNavigation["kind"];

export type NotificationNavigationOf<Kind extends NotificationNavigationKind> = Extract<
  NotificationNavigation,
  { kind: Kind }
>;
