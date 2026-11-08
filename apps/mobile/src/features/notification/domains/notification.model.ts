import { NOTIFICATION_TYPE } from '@aido/api/vocabulary';
import type { AuthStatus } from '@src/core/session/auth-status';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { match } from 'ts-pattern';

import {
  MARKETING_OPT_OUT_ACTION,
  NOTIFICATION_TYPE_TRAITS,
} from '../constants/notification.constants';
import type { Notification, PendingNotificationResponse } from '../schemas/notification.schema';

/** 인증을 기다리는 응답을 보관하는 수명 */
const PENDING_RESPONSE_LIFETIME_MS = 10 * MINUTE_MS;

function isAiFeature(notification: Pick<Notification, 'type'>) {
  return NOTIFICATION_TYPE_TRAITS[notification.type].isAiFeature;
}

/**
 * 받은 응원 알림이면 신고할 응원과 보낸 친구. 응원 ID가 없는 이전 알림은 신고할 대상을 알 수 없어 null.
 * 보낸 사람 이름은 1.13.0 서버부터 실리므로 이전 알림에는 없을 수 있다.
 */
function findReceivedCheer(
  notification: Pick<Notification, 'type' | 'context' | 'routing'>,
): { cheerId: number; senderId: string; senderName: string | null } | null {
  const cheerId = notification.context?.cheerId;
  const senderId = notification.context?.friendId;
  if (
    notification.type !== NOTIFICATION_TYPE.CHEER_RECEIVED ||
    cheerId == null ||
    senderId == null
  ) {
    return null;
  }
  return { cheerId, senderId, senderName: notification.routing?.senderName ?? null };
}

type NotificationResponseAction =
  | { type: 'optOut' }
  | { type: 'open' }
  | { type: 'defer'; reason: 'auth-resolving' | 'authentication-required' }
  | { type: 'drop'; reason: 'expired' };

/** 눌린 응답을 지금 어떻게 할지. 공개 수신 거부 액션은 인증과 무관하게 처리한다. */
function getResponseAction(
  response: Pick<PendingNotificationResponse, 'actionIdentifier' | 'receivedAt'>,
  { authStatus, now }: { authStatus: AuthStatus; now: number },
): NotificationResponseAction {
  if (now - response.receivedAt > PENDING_RESPONSE_LIFETIME_MS) {
    return { type: 'drop', reason: 'expired' };
  }
  if (response.actionIdentifier === MARKETING_OPT_OUT_ACTION) {
    return { type: 'optOut' };
  }
  return match(authStatus)
    .returnType<NotificationResponseAction>()
    .with('loading', 'locked', () => ({ type: 'defer', reason: 'auth-resolving' }))
    .with('unauthenticated', () => ({ type: 'defer', reason: 'authentication-required' }))
    .with('authenticated', () => ({ type: 'open' }))
    .exhaustive();
}

/** 알림 ID가 0이면 서버에 알림 기록이 없는 푸시라 읽음·열림을 서버에 묻지 않는다 */
function hasServerRecord(notificationId: number) {
  return notificationId > 0;
}

export const NotificationPolicy = {
  hasServerRecord,
  isAiFeature,
  findReceivedCheer,
  getResponseAction,
} as const;
