import {
  notificationActionSchema,
  type NotificationNavigation as NotificationNavigationContract,
  notificationTypeSchema,
  pushNotificationDataSchema,
} from '@aido/api';
import type { z } from 'zod';

export type NotificationNavigation = NotificationNavigationContract;

/** 앱이 읽는 푸시 data */
export const pushNotificationPayloadSchema = pushNotificationDataSchema
  .omit({ dispatchId: true })
  .extend({
    notificationId: pushNotificationDataSchema.shape.notificationId.catch(0),
    type: notificationTypeSchema.nullable().catch(null),
    action: notificationActionSchema.catch({ type: 'DEEP_LINK' }),
  });
export type PushNotificationPayload = z.infer<typeof pushNotificationPayloadSchema>;
