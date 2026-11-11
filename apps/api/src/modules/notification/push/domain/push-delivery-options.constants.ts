import type { NotificationType } from "../../inbox/domain/notification-type.constants.js";

const HOUR_SECONDS = 60 * 60;

const PUSH_DELIVERY_PRIORITIES = ["normal", "high"] as const;

export type PushDeliveryPriority = (typeof PUSH_DELIVERY_PRIORITIES)[number];

const PUSH_EXPIRY_CLASSES = [
  "REMINDER",
  "BRIEFING",
  "TODAY_ONLY",
  "SOCIAL",
  "INFORMATIONAL",
] as const;

type PushExpiryClass = (typeof PUSH_EXPIRY_CLASSES)[number];

// 기기가 꺼져 있으면 공급자(FCM·APNs)가 이 시간까지만 보관했다가 버린다
const TTL_SECONDS_BY_EXPIRY_CLASS = {
  // 할 일 60·10분 전 알림이라 한 시간 넘게 늦으면 이미 지난 일정의 잡음이다
  REMINDER: HOUR_SECONDS,
  // 아침·저녁 요약과 날씨는 몇 시간 지나면 그날 계획에 쓸모가 없다
  BRIEFING: 2 * HOUR_SECONDS,
  // 그날 안에만 뜻이 있는 알림(점심 독려·스트릭 위기·하루 완료)이 다음 날 닿지 않게 한다
  TODAY_ONLY: 3 * HOUR_SECONDS,
  // 친구 반응은 반나절 늦어도 읽을 만하고 그 뒤는 알림함으로 충분하다
  SOCIAL: 12 * HOUR_SECONDS,
  // 공지·리포트·결제·초대·재방문 안내는 하루 안에 닿으면 되고 그 뒤는 알림함에 남는다
  INFORMATIONAL: 24 * HOUR_SECONDS,
} as const satisfies Record<PushExpiryClass, number>;

const EXPIRY_CLASS_BY_TYPE = {
  FOLLOW_NEW: "SOCIAL",
  FOLLOW_ACCEPTED: "SOCIAL",
  NUDGE_RECEIVED: "SOCIAL",
  NUDGE_REPLIED: "SOCIAL",
  NUDGE_THANKED: "SOCIAL",
  CHEER_RECEIVED: "SOCIAL",
  DAILY_COMPLETE: "TODAY_ONLY",
  FRIEND_COMPLETED: "TODAY_ONLY",
  TODO_REMINDER: "REMINDER",
  TODO_SHARED: "SOCIAL",
  MORNING_REMINDER: "BRIEFING",
  EVENING_REMINDER: "BRIEFING",
  WEEKLY_ACHIEVEMENT: "INFORMATIONAL",
  WEEKLY_REPORT: "INFORMATIONAL",
  MONTHLY_REPORT: "INFORMATIONAL",
  AI_SUGGESTION: "INFORMATIONAL",
  SYSTEM_NOTICE: "INFORMATIONAL",
  ADMIN_BROADCAST: "INFORMATIONAL",
  ADMIN_TARGETED: "INFORMATIONAL",
  WINBACK: "INFORMATIONAL",
  SOCIAL_DIGEST: "TODAY_ONLY",
  NUDGE_SUGGEST: "INFORMATIONAL",
  LUNCH_NUDGE: "TODAY_ONLY",
  STREAK_AT_RISK: "TODAY_ONLY",
  WEATHER_MORNING: "BRIEFING",
  WEATHER_EVENING: "BRIEFING",
  INVITE_JOINED: "SOCIAL",
  INVITE_REWARDED: "INFORMATIONAL",
  INVITE_PROGRESS: "INFORMATIONAL",
  INVITE_QUALIFY_REMINDER: "INFORMATIONAL",
  PREMIUM_GRANT_ENDING: "INFORMATIONAL",
  PREMIUM_TRIAL_ENDING: "INFORMATIONAL",
  PREMIUM_RENEWAL_UPCOMING: "INFORMATIONAL",
} as const satisfies Record<NotificationType, PushExpiryClass>;

export interface PushDeliveryOptions {
  readonly ttlSeconds: number;
  readonly priority: PushDeliveryPriority;
}

export function pushDeliveryOptions(type: NotificationType): PushDeliveryOptions {
  return {
    ttlSeconds: TTL_SECONDS_BY_EXPIRY_CLASS[EXPIRY_CLASS_BY_TYPE[type]],
    // 광고성도 high다. normal은 Android Doze에서 몇 시간 늦어져 야간에 닿을 수 있다
    priority: "high",
  };
}
