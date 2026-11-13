import type { PushNotification } from '../domains/push-notification.model';
import {
  lenientPushNotificationPayloadSchema,
  type PushNotificationPayload,
  pushNotificationPayloadSchema,
} from '../schemas/push-notification-payload.schema';
import { toNotificationTarget } from './notification.mapper';

/** 읽은 푸시와 버린 칸. mapper는 로그를 쓰지 않아 부르는 쪽이 droppedPaths를 남긴다 */
interface ParsedPushNotification {
  /** data가 객체가 아니어서 읽지 못하면 null이다. 부르는 쪽이 안전한 기본(알림함·배너)을 고른다 */
  notification: PushNotification | null;
  /** 계약에 맞지 않아 버린 칸의 경로(`navigation.kind`). 값은 싣지 않는다 */
  droppedPaths: readonly string[];
}

/** 푸시 data를 읽는 곳은 여기 하나다. 칸 하나가 틀리면 그 칸만 버린다 */
export function parsePushNotification(data: unknown): ParsedPushNotification {
  const exact = pushNotificationPayloadSchema.safeParse(data);
  if (exact.success) {
    return { notification: toPushNotification(exact.data), droppedPaths: [] };
  }
  const lenient = lenientPushNotificationPayloadSchema.safeParse(data);
  return {
    notification: lenient.success ? toPushNotification(lenient.data) : null,
    droppedPaths: exact.error.issues.map(({ path }) => path.map(String).join('.')),
  };
}

function toPushNotification({
  notificationId,
  type,
  navigation,
  action,
  marketingOptOutToken,
  campaignKey,
  variantId,
  purpose,
}: PushNotificationPayload): PushNotification {
  return {
    notificationId,
    type,
    target: toNotificationTarget(navigation),
    marketingOptOutToken: marketingOptOutToken ?? null,
    actionType: action.type,
    campaignKey: campaignKey ?? null,
    variantId: variantId ?? null,
    purpose: purpose ?? null,
  };
}
