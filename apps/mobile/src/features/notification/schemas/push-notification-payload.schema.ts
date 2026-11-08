import {
  notificationActionSchema,
  type NotificationNavigation as NotificationNavigationContract,
  notificationTypeSchema,
  pushNotificationDataSchema,
} from '@aido/api';
import type { z } from 'zod';

export type NotificationNavigation = NotificationNavigationContract;

/**
 * 앱이 읽는 푸시 data. 새 서버의 모르는 타입이나 깨진 값은 그 필드만 버려 탭이 항상 동작하게 한다.
 * notificationId 0은 읽음 처리를 건너뛴다. navigation은 계약이 틀린 모양을 이미 버린다.
 */
export const pushNotificationPayloadSchema = pushNotificationDataSchema
  .omit({ dispatchId: true })
  .extend({
    notificationId: pushNotificationDataSchema.shape.notificationId.catch(0),
    type: notificationTypeSchema.nullable().catch(null),
    action: notificationActionSchema.catch({ type: 'DEEP_LINK' }),
  });
export type PushNotificationPayload = z.infer<typeof pushNotificationPayloadSchema>;
