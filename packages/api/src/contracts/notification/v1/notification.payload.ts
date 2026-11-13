import { z } from "zod";

import { dateSchema } from "../../../common/datetime.js";
import {
  notificationActionSchema,
  notificationContextSchema,
  notificationTypeSchema,
} from "../../../common/notification-value.js";
import { NOTIFICATION_PURPOSES } from "../../../vocabulary/notification.constants.js";
import { todoCommentIdSchema } from "../../todo-comment/v1/todo-comment.request.js";
import {
  notificationActivityKindSchema,
  notificationNavigationSchema,
} from "./notification.navigation.js";

export type NotificationContext = z.infer<typeof notificationContextSchema>;

/**
 * 신규 댓글 알림이 생성할 때 보장해야 하는 라우팅 계약. 전용 컬럼이 없어 REST metadata와 푸시 routing에 실린다.
 * 댓글은 두 단계라 threadRootId는 대화의 머리 댓글이며 navigation의 threadCommentId와 같은 값이다.
 */
export const todoCommentNotificationRoutingSchema = z
  .object({
    commentId: todoCommentIdSchema,
    threadRootId: todoCommentIdSchema,
    activityKind: notificationActivityKindSchema,
  })
  .describe("댓글 알림 라우팅");

export type TodoCommentNotificationRouting = z.infer<typeof todoCommentNotificationRoutingSchema>;

/**
 * 기존 알림과 구버전 클라이언트를 위한 읽기 계약.
 * 예전 payload는 필드 일부만 가질 수 있으므로 optional shape을 유지한다.
 * 보낸 사람은 응원처럼 친구가 보낸 알림에서 신고·차단 확인 문구에 이름을 보여 주는 데 쓴다(1.13.0+).
 *
 * 할 일이 대상인 알림(todoId가 있는 댓글·답글·좋아요·리마인더·콕)은 서버가 1.13.0부터 그 할 일의
 * 주인과 날짜를 함께 싣는다. 펼친 화면이 목록 pane을 그 사람의 그 날짜 피드로 연다.
 * 잘못된 값은 그 필드만 버려 댓글 이동 재료를 잃지 않는다. 구버전 앱은 모르는 키를 버린다.
 */
export const notificationRoutingSchema = todoCommentNotificationRoutingSchema.partial().extend({
  // 다른 알림의 metadata에도 같은 이름의 값이 있을 수 있어, 모양이 달라도 댓글 routing을 깨지 않고 버린다
  senderId: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .catch(undefined)
    .describe("알림을 보낸 사용자 ID (응원 알림)"),
  senderName: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .catch(undefined)
    .describe("알림을 보낸 사용자 표시 이름 (응원 알림)"),
  todoOwnerId: z.string().min(1).optional().catch(undefined).describe("할 일 주인 사용자 ID"),
  todoDate: dateSchema.optional().catch(undefined).describe("할 일 날짜 (YYYY-MM-DD, 시작일)"),
});

export type NotificationRouting = z.infer<typeof notificationRoutingSchema>;

export type NotificationAction = z.infer<typeof notificationActionSchema>;

/** 푸시 알림 data. 구버전 앱은 모르는 키를 버리므로 필드는 추가만 한다. */
export const pushNotificationDataSchema = z.object({
  notificationId: z.number().int().nonnegative(),
  type: notificationTypeSchema.describe(
    "알림 타입. 1.14.0 이하 앱은 type·action·context·routing으로 목적지를 정하므로 navigation과 함께 계속 싣는다",
  ),
  action: notificationActionSchema,
  context: notificationContextSchema
    .optional()
    .describe("1.14.0 이하 앱 호환용 이동 재료. 새 앱은 navigation을 읽는다"),
  routing: notificationRoutingSchema
    .optional()
    .describe(
      "1.14.0 이하 앱 호환용 이동 재료(댓글·할 일 주인·보낸 사람). 새 앱은 navigation을 읽는다",
    ),
  // 모양이 맞지 않으면 navigation만 버려 type·action으로 이동하던 기존 경로를 잃지 않는다
  navigation: notificationNavigationSchema.optional().catch(undefined),
  dispatchId: z.number().int().positive().optional(),
  campaignKey: z.string().max(100).optional(),
  variantId: z.string().max(100).optional(),
  purpose: z.enum(NOTIFICATION_PURPOSES).optional(),
  marketingOptOutToken: z.string().max(2048).optional(),
});

export type PushNotificationData = z.infer<typeof pushNotificationDataSchema>;
