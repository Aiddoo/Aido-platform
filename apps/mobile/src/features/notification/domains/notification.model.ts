import { NOTIFICATION_TYPE } from '@aido/api/vocabulary';
import type { AuthStatus } from '@src/bootstrap/providers/auth-provider';
import { match } from 'ts-pattern';

import type {
  Notification,
  NotificationCategoryKey,
  NotificationType,
} from '../schemas/notification.schema';

const AI_FEATURE_TYPES: ReadonlySet<NotificationType> = new Set([
  'WEEKLY_REPORT',
  'MONTHLY_REPORT',
  'AI_SUGGESTION',
]);

function isAiFeature(notification: Pick<Notification, 'type'>) {
  return AI_FEATURE_TYPES.has(notification.type);
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

/** 알림함 항목이 어느 분류의 라벨로 보이는지 */
function getCategoryKey({ type }: Pick<Notification, 'type'>): NotificationCategoryKey {
  return match<NotificationType, NotificationCategoryKey>(type)
    .with(
      'FOLLOW_NEW',
      'FOLLOW_ACCEPTED',
      'INVITE_JOINED',
      'INVITE_REWARDED',
      'INVITE_PROGRESS',
      'INVITE_QUALIFY_REMINDER',
      () => 'friend',
    )
    .with('NUDGE_RECEIVED', 'NUDGE_REPLIED', 'NUDGE_THANKED', () => 'nudge')
    .with('CHEER_RECEIVED', () => 'cheer')
    .with('DAILY_COMPLETE', 'FRIEND_COMPLETED', 'WEEKLY_ACHIEVEMENT', () => 'achievement')
    .with(
      'TODO_REMINDER',
      'TODO_SHARED',
      'WINBACK',
      'WEATHER_MORNING',
      'WEATHER_EVENING',
      () => 'todo',
    )
    .with('MORNING_REMINDER', 'EVENING_REMINDER', 'LUNCH_NUDGE', 'STREAK_AT_RISK', () => 'reminder')
    .with('WEEKLY_REPORT', 'MONTHLY_REPORT', 'AI_SUGGESTION', () => 'ai')
    .with(
      'SYSTEM_NOTICE',
      'ADMIN_BROADCAST',
      'ADMIN_TARGETED',
      'PREMIUM_GRANT_ENDING',
      () => 'notice',
    )
    .with('SOCIAL_DIGEST', 'NUDGE_SUGGEST', () => 'social')
    .exhaustive();
}

type NotificationResponseAction =
  | { status: 'process' }
  | {
      status: 'defer';
      reason: 'auth-resolving' | 'authentication-required' | 'navigation-not-ready';
    };

/** 푸시를 눌렀을 때 지금 처리할지 기다릴지. 공개 수신 거부 액션은 인증과 무관하게 처리한다. */
function getResponseAction({
  authStatus,
  actionIdentifier,
  isNavigationReady = true,
}: {
  authStatus: AuthStatus;
  actionIdentifier: string;
  isNavigationReady?: boolean;
}): NotificationResponseAction {
  if (actionIdentifier === 'MARKETING_OPT_OUT') {
    return { status: 'process' };
  }
  if (authStatus === 'loading' || authStatus === 'locked') {
    return { status: 'defer', reason: 'auth-resolving' };
  }
  if (authStatus === 'unauthenticated') {
    return { status: 'defer', reason: 'authentication-required' };
  }
  if (!isNavigationReady) {
    return { status: 'defer', reason: 'navigation-not-ready' };
  }
  return { status: 'process' };
}

export const NotificationPolicy = {
  isAiFeature,
  findReceivedCheer,
  getCategoryKey,
  getResponseAction,
} as const;
