import {
  EVENING_REMINDER_HOUR_RANGE,
  MORNING_REMINDER_HOUR_RANGE,
  WEATHER_HOUR_RANGE,
} from '@aido/api/vocabulary';

import type { NotificationType } from '../domains/notification.model';
import type { PushRegistration } from '../domains/push-registration.model';

/** 보고한 적도, 풀 해제도 없는 기기 */
export const EMPTY_PUSH_REGISTRATION: PushRegistration = {
  reportedToken: null,
  releaseRequestedAt: null,
};

/** 진입 대기로 스플래시를 잡아 두는 상한. 판정이 어떻게 끝나든 스플래시에 갇히지 않게 한다 */
export const NOTIFICATION_ENTRY_HOLD_MAX_MS = 3000;

/** 페이로드에 수신자 ID가 없어 읽음의 403·404가 다른 계정 알림을 막는 유일한 방어다(Release 측정 전 초깃값) */
export const NOTIFICATION_READ_BUDGET_MS = 800;

/** 마케팅 푸시의 수신 거부 버튼. 서버 categoryId MARKETING과 앱 카테고리 등록이 함께 쓴다 */
export const MARKETING_OPT_OUT_ACTION = 'MARKETING_OPT_OUT';

export const SETTINGS_TIME_RANGE = {
  morning: {
    minimumTime: { hour: MORNING_REMINDER_HOUR_RANGE.MIN, minute: 0 },
    maximumTime: { hour: MORNING_REMINDER_HOUR_RANGE.MAX, minute: 59 },
  },
  evening: {
    minimumTime: { hour: EVENING_REMINDER_HOUR_RANGE.MIN, minute: 0 },
    maximumTime: { hour: EVENING_REMINDER_HOUR_RANGE.MAX, minute: 59 },
  },
  weather: {
    minimumTime: { hour: WEATHER_HOUR_RANGE.MIN, minute: 0 },
    maximumTime: { hour: WEATHER_HOUR_RANGE.MAX, minute: 59 },
  },
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

/** 알림을 어떻게 물을지. 화면은 이 값으로 알림 화면·시스템 창·꺼짐 안내 중 하나를 고른다 */
export const PUSH_ASK_MOMENT = {
  ONBOARDING_SCREEN: 'ONBOARDING_SCREEN',
  SYSTEM_DIALOG: 'SYSTEM_DIALOG',
  DENIED_NOTICE: 'DENIED_NOTICE',
} as const;

/** 가입 뒤 이 날수 안에만 알림 화면을 보여 준다. 그 뒤에는 할 일 시간을 정할 때 묻는다 */
export const PUSH_ONBOARDING_WINDOW_DAYS = 1;

interface NotificationTypeTraits {
  /** 알림함 항목이 어느 분류의 라벨(`categories.*`)로 보이는지 */
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
  /** 서버 목적지(`navigation`)가 없을 때의 구 필드 경로. `notice`는 서버가 DEEP_LINK url에 고른 앱 경로다 */
  legacyDestination: 'feed' | 'notice' | 'routing';
  /** 앱이 켜진 동안 받으면 다시 받을 다른 기능의 화면. 없으면 null */
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
  // 초대받은 사람이 오늘 할 일을 끝내 사용 시작하도록 오늘 피드로 연다
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
