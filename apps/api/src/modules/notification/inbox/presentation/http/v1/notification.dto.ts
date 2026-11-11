import {
  getNotificationsQuerySchema,
  markReadResponseSchema,
  notificationIdParamSchema,
  notificationInboxResponseSchema,
  notificationListResponseSchema,
  notificationOpenedResponseSchema,
  unreadCountResponseSchema,
} from "@aido/api/contracts/notification";
import type { z } from "zod";

export const GetNotificationsQueryDto = getNotificationsQuerySchema.meta({
  id: "GetNotificationsQueryDto",
  apiParameter: true,
});
export type GetNotificationsQueryDto = z.infer<typeof GetNotificationsQueryDto>;
export const NotificationIdParamDto = notificationIdParamSchema.meta({
  id: "NotificationIdParamDto",
  apiParameter: true,
});
export type NotificationIdParamDto = z.infer<typeof NotificationIdParamDto>;

export const NotificationListResponseDto = notificationListResponseSchema.meta({
  id: "NotificationListResponseDto",
});
export type NotificationListResponseDto = z.infer<typeof NotificationListResponseDto>;
export const NotificationInboxResponseDto = notificationInboxResponseSchema.meta({
  id: "NotificationInboxResponseDto",
});
export type NotificationInboxResponseDto = z.infer<typeof NotificationInboxResponseDto>;
export const UnreadCountResponseDto = unreadCountResponseSchema.meta({
  id: "UnreadCountResponseDto",
});
export type UnreadCountResponseDto = z.infer<typeof UnreadCountResponseDto>;
export const MarkReadResponseDto = markReadResponseSchema.meta({ id: "MarkReadResponseDto" });
export type MarkReadResponseDto = z.infer<typeof MarkReadResponseDto>;
export const NotificationOpenedResponseDto = notificationOpenedResponseSchema.meta({
  id: "NotificationOpenedResponseDto",
});
export type NotificationOpenedResponseDto = z.infer<typeof NotificationOpenedResponseDto>;
