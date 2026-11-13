import { z } from "zod";

import {
  NOTIFICATION_ACTION_TYPE,
  NOTIFICATION_TYPE,
} from "../vocabulary/notification.constants.js";

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPE);

export const notificationActionTypeSchema = z.enum(NOTIFICATION_ACTION_TYPE);

/**
 * 배포된 알림 목록 DTO에 그대로 박혀 있는 모양이라 필드를 늘리지 않는다.
 * 새 이동 재료는 푸시 navigation에 싣는다.
 */
export const notificationContextSchema = z.object({
  todoId: z.number().optional(),
  friendId: z.string().optional(),
  nudgeId: z.number().optional(),
  cheerId: z.number().optional(),
});

export const notificationActionSchema = z.object({
  type: notificationActionTypeSchema,
  url: z
    .string()
    .optional()
    .describe(
      "BROWSER·WEBVIEW는 열 http(s) 주소. DEEP_LINK는 선택이며, 공지(SYSTEM_NOTICE·ADMIN_*)는 앱 경로(/feed, /achievements, /weather, /friends, /friends/invite, /settings/subscription, /settings/notifications) 중 하나를 싣는다. 그 밖의 타입은 type·context로 이동한다.",
    ),
});
