import {
  notificationActionSchema,
  notificationNavigationSchema,
  notificationTypeSchema,
  pushNotificationDataSchema,
} from '@aido/api';
import type { z } from 'zod';

/**
 * 앱이 읽는 푸시 data 칸을 계약 그대로 검사한다. 틀린 칸의 경로를 로그로 남기는 데 쓴다.
 * 서버가 옛 앱을 위해 함께 싣는 이동 재료(context·routing)는 읽지 않는다
 */
export const pushNotificationPayloadSchema = pushNotificationDataSchema
  .pick({
    notificationId: true,
    type: true,
    action: true,
    navigation: true,
    marketingOptOutToken: true,
    campaignKey: true,
    variantId: true,
    purpose: true,
  })
  // 계약은 틀린 navigation을 조용히 버려, 버린 까닭을 알려면 여기서는 그대로 검사한다
  .extend({ navigation: notificationNavigationSchema.optional() });

const { shape } = pushNotificationPayloadSchema;

/** 새 서버의 모르는 종류·kind·값이나 깨진 값은 그 칸만 버려 탭이 항상 어딘가로 연다 */
export const lenientPushNotificationPayloadSchema = pushNotificationPayloadSchema.extend({
  // 0이면 읽음 처리를 건너뛴다
  notificationId: shape.notificationId.catch(0),
  type: notificationTypeSchema.nullable().catch(null),
  action: notificationActionSchema.catch({ type: 'DEEP_LINK' }),
  navigation: shape.navigation.catch(undefined),
  marketingOptOutToken: shape.marketingOptOutToken.catch(undefined),
  campaignKey: shape.campaignKey.catch(undefined),
  variantId: shape.variantId.catch(undefined),
  purpose: shape.purpose.catch(undefined),
});
export type PushNotificationPayload = z.infer<typeof lenientPushNotificationPayloadSchema>;
