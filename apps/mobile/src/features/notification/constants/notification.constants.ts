import type { NotificationType } from '../domains/notification.model';

/** 진입 대기로 스플래시를 잡아 두는 상한. 판정이 어떻게 끝나든 스플래시에 갇히지 않게 한다 */
export const NOTIFICATION_ENTRY_HOLD_MAX_MS = 3000;

/** 눌린 푸시를 열기 전에 읽음 응답을 기다리는 상한 */
export const NOTIFICATION_READ_BUDGET_MS = 800;

/** 서버가 마케팅 푸시에 싣는 categoryId. 앱의 푸시 카테고리 등록이 같은 값을 쓴다 */
export const MARKETING_CATEGORY_ID = 'MARKETING';

/** 마케팅 푸시의 수신 거부 버튼. 서버 categoryId MARKETING과 앱 카테고리 등록이 함께 쓴다 */
export const MARKETING_OPT_OUT_ACTION = 'MARKETING_OPT_OUT';

export const SETTINGS_TIME_RANGE = {
  morning: { minimumTime: { hour: 0, minute: 0 }, maximumTime: { hour: 11, minute: 59 } },
  evening: { minimumTime: { hour: 12, minute: 0 }, maximumTime: { hour: 23, minute: 59 } },
} as const;

export const PUSH_PERMISSION_STEP = {
  ASK: 'ASK',
  REQUEST_SYSTEM: 'REQUEST_SYSTEM',
  OPEN_SETTINGS: 'OPEN_SETTINGS',
  ENABLE_IN_APP: 'ENABLE_IN_APP',
  NONE: 'NONE',
} as const;

/** 홈 알림 안내를 닫으면 이 날수 동안 다시 보이지 않는다 */
export const PUSH_PROMPT_SNOOZE_DAYS = 14;

interface NotificationTypeTraits {
  labelKey:
    | 'friend'
    | 'nudge'
    | 'cheer'
    | 'achievement'
    | 'todo'
    | 'reminder'
    | 'ai'
    | 'notice'
    | 'social';
  /** 프리미엄 AI 기능이 만든 알림. 열기 전에 기능 한도를 묻는다 */
  isAiFeature: boolean;
  /** 서버 목적지(`navigation`)가 없는 알림을 구 필드로 열 길 */
  legacyDestination: 'feed' | 'notice' | 'routing';
  invalidation: 'nudge-interactions' | 'friends' | 'invite' | 'me' | null;
}

/** 알림 종류마다 앱이 정하는 성질. 서버가 종류를 더하면 여기서 빠짐없이 정해야 빌드가 된다 */
export const NOTIFICATION_TYPE_TRAITS = {
  FOLLOW_NEW: {
    labelKey: 'friend',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: 'friends',
  },
  FOLLOW_ACCEPTED: {
    labelKey: 'friend',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: 'friends',
  },
  INVITE_JOINED: {
    labelKey: 'friend',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: 'invite',
  },
  INVITE_REWARDED: {
    labelKey: 'friend',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: 'invite',
  },
  INVITE_PROGRESS: {
    labelKey: 'friend',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: 'invite',
  },
  INVITE_QUALIFY_REMINDER: {
    labelKey: 'friend',
    isAiFeature: false,
    legacyDestination: 'feed',
    invalidation: null,
  },
  NUDGE_RECEIVED: {
    labelKey: 'nudge',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: 'nudge-interactions',
  },
  NUDGE_REPLIED: {
    labelKey: 'nudge',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: 'nudge-interactions',
  },
  NUDGE_THANKED: {
    labelKey: 'nudge',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: 'nudge-interactions',
  },
  CHEER_RECEIVED: {
    labelKey: 'cheer',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: null,
  },
  DAILY_COMPLETE: {
    labelKey: 'achievement',
    isAiFeature: false,
    legacyDestination: 'feed',
    invalidation: null,
  },
  FRIEND_COMPLETED: {
    labelKey: 'achievement',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: null,
  },
  WEEKLY_ACHIEVEMENT: {
    labelKey: 'achievement',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: null,
  },
  TODO_REMINDER: {
    labelKey: 'todo',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: null,
  },
  TODO_SHARED: {
    labelKey: 'todo',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: null,
  },
  WINBACK: { labelKey: 'todo', isAiFeature: false, legacyDestination: 'feed', invalidation: null },
  WEATHER_MORNING: {
    labelKey: 'todo',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: null,
  },
  WEATHER_EVENING: {
    labelKey: 'todo',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: null,
  },
  MORNING_REMINDER: {
    labelKey: 'reminder',
    isAiFeature: false,
    legacyDestination: 'feed',
    invalidation: null,
  },
  EVENING_REMINDER: {
    labelKey: 'reminder',
    isAiFeature: false,
    legacyDestination: 'feed',
    invalidation: null,
  },
  LUNCH_NUDGE: {
    labelKey: 'reminder',
    isAiFeature: false,
    legacyDestination: 'feed',
    invalidation: null,
  },
  STREAK_AT_RISK: {
    labelKey: 'reminder',
    isAiFeature: false,
    legacyDestination: 'feed',
    invalidation: null,
  },
  WEEKLY_REPORT: {
    labelKey: 'ai',
    isAiFeature: true,
    legacyDestination: 'routing',
    invalidation: null,
  },
  MONTHLY_REPORT: {
    labelKey: 'ai',
    isAiFeature: true,
    legacyDestination: 'routing',
    invalidation: null,
  },
  AI_SUGGESTION: {
    labelKey: 'ai',
    isAiFeature: true,
    legacyDestination: 'routing',
    invalidation: null,
  },
  SYSTEM_NOTICE: {
    labelKey: 'notice',
    isAiFeature: false,
    legacyDestination: 'notice',
    invalidation: null,
  },
  ADMIN_BROADCAST: {
    labelKey: 'notice',
    isAiFeature: false,
    legacyDestination: 'notice',
    invalidation: null,
  },
  ADMIN_TARGETED: {
    labelKey: 'notice',
    isAiFeature: false,
    legacyDestination: 'notice',
    invalidation: null,
  },
  // 보상 기간이 곧 끝난다는 알림이면 구독 화면의 남은 기간을 서버 값으로 맞춘다
  PREMIUM_GRANT_ENDING: {
    labelKey: 'notice',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: 'me',
  },
  SOCIAL_DIGEST: {
    labelKey: 'social',
    isAiFeature: false,
    legacyDestination: 'feed',
    invalidation: null,
  },
  NUDGE_SUGGEST: {
    labelKey: 'social',
    isAiFeature: false,
    legacyDestination: 'routing',
    invalidation: null,
  },
} as const satisfies Record<NotificationType, NotificationTypeTraits>;
