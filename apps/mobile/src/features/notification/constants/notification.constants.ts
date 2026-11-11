import {
  EVENING_REMINDER_HOUR_RANGE,
  MORNING_REMINDER_HOUR_RANGE,
  WEATHER_HOUR_RANGE,
} from '@aido/api/vocabulary';

/** 진입 대기로 스플래시를 잡아 두는 상한. 판정이 어떻게 끝나든 스플래시에 갇히지 않게 한다 */
export const NOTIFICATION_ENTRY_HOLD_MAX_MS = 3000;

/** 페이로드에 수신자 ID가 없어 읽음의 403·404가 다른 계정 알림을 막는 유일한 방어다(Release 측정 전 초깃값) */
export const NOTIFICATION_READ_BUDGET_MS = 800;

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
