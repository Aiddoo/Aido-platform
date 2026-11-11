import type { NotificationType } from '../domains/notification.model';

/** 앱이 켜진 동안 받으면 다시 받을 다른 기능의 화면. 없으면 null. 서버가 종류를 더하면 여기서 정해야 빌드가 된다 */
export const RECEIVED_REFRESH_BY_TYPE = {
  FOLLOW_NEW: 'friends',
  FOLLOW_ACCEPTED: 'friends',
  INVITE_JOINED: 'invite',
  INVITE_REWARDED: 'invite',
  INVITE_PROGRESS: 'invite',
  INVITE_QUALIFY_REMINDER: null,
  NUDGE_RECEIVED: 'nudge-interactions',
  NUDGE_REPLIED: 'nudge-interactions',
  NUDGE_THANKED: 'nudge-interactions',
  CHEER_RECEIVED: null,
  DAILY_COMPLETE: null,
  FRIEND_COMPLETED: null,
  WEEKLY_ACHIEVEMENT: null,
  TODO_REMINDER: null,
  TODO_SHARED: null,
  WINBACK: null,
  WEATHER_MORNING: null,
  WEATHER_EVENING: null,
  MORNING_REMINDER: null,
  EVENING_REMINDER: null,
  LUNCH_NUDGE: null,
  STREAK_AT_RISK: null,
  WEEKLY_REPORT: null,
  MONTHLY_REPORT: null,
  AI_SUGGESTION: null,
  SYSTEM_NOTICE: null,
  ADMIN_BROADCAST: null,
  ADMIN_TARGETED: null,
  // 보상 기간이 곧 끝난다는 알림이면 구독 화면의 남은 기간을 서버 값으로 맞춘다
  PREMIUM_GRANT_ENDING: 'me',
  SOCIAL_DIGEST: null,
  NUDGE_SUGGEST: null,
} as const satisfies Record<
  NotificationType,
  'nudge-interactions' | 'friends' | 'invite' | 'me' | null
>;

/** 받을 때 그 종류의 화면을 다시 받는지. 다시 받으면 보고 있는 화면에 새 내용이 바로 보인다 */
export function isRefreshedOnReceipt(type: NotificationType) {
  return RECEIVED_REFRESH_BY_TYPE[type] != null;
}
