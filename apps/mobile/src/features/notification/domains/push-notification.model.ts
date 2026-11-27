import { notificationTypeSchema } from '@aido/api/common';
import { NOTIFICATION_ACTION_TYPE, NOTIFICATION_PURPOSES } from '@aido/api/vocabulary';
import { z } from 'zod';

import { notificationTargetSchema } from './notification.model';

/** 기기가 받은 푸시. 모르는 종류·틀린 목적지는 그 칸만 버려 탭이 항상 어딘가로 연다 */
export const pushNotificationSchema = z.object({
  /** 0이면 서버에 알림 기록이 없는 푸시다 */
  notificationId: z.int().nonnegative(),
  /** 이 앱이 모르는 새 종류면 null이다 */
  type: notificationTypeSchema.nullable(),
  target: notificationTargetSchema,
  /** 마케팅 푸시의 수신 거부 버튼이 보낼 토큰 */
  marketingOptOutToken: z.string().nullable(),
  // 아래는 열림 분석에만 쓴다
  actionType: z.enum(NOTIFICATION_ACTION_TYPE),
  campaignKey: z.string().nullable(),
  variantId: z.string().nullable(),
  purpose: z.enum(NOTIFICATION_PURPOSES).nullable(),
});
export type PushNotification = z.infer<typeof pushNotificationSchema>;

/** 알림 ID가 0이면 서버에 알림 기록이 없는 푸시라 읽음·열림을 서버에 묻지 않는다. 서비스는 ID만 받아 값으로 묻는다 */
export function isServerNotificationId(notificationId: number) {
  return notificationId > 0;
}

export const PushNotificationPolicy = {
  hasServerRecord(pushNotification: PushNotification): boolean {
    return isServerNotificationId(pushNotification.notificationId);
  },
};
