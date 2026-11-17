import { HOUR_MS, MINUTE_MS, SECOND_MS } from "#api/shared/domain/time/time-units";
import type { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import type { NotificationType } from "../../shared/domain/notification-type.constants.js";
import {
  isWithinQuietHours,
  nextQuietHoursStart,
  PUSH_QUIET_HOURS_WINDOW,
} from "./quiet-hours.domain-service.js";

const PUSH_DELIVERY_PRIORITIES = ["normal", "high"] as const;

export type PushDeliveryPriority = (typeof PUSH_DELIVERY_PRIORITIES)[number];

// 광고성도 high다. normal은 Android Doze에서 몇 시간 늦어져 야간에 닿을 수 있다
export const PUSH_DELIVERY_PRIORITY: PushDeliveryPriority = "high";

const PUSH_EXPIRY_CLASSES = [
  "REMINDER",
  "BRIEFING",
  "TODAY_ONLY",
  "SOCIAL",
  "INFORMATIONAL",
] as const;

type PushExpiryClass = (typeof PUSH_EXPIRY_CLASSES)[number];

// 기기가 꺼져 있으면 공급자(FCM·APNs)가 이 시간까지만 보관했다가 버린다. 아래 받는 사람 기준이 더 짧게 줄인다
const TTL_MS_BY_EXPIRY_CLASS = {
  // 할 일 60·10분 전 알림이다. 할 일 시작 시각까지로 줄인다
  REMINDER: HOUR_MS,
  // 아침·저녁 요약과 날씨는 몇 시간 지나면 그날 계획에 쓸모가 없다
  BRIEFING: 2 * HOUR_MS,
  // 그날 안에만 뜻이 있는 알림(점심 독려·스트릭 위기·하루 완료)이다. 받는 사람 자정까지로 줄인다
  TODAY_ONLY: 3 * HOUR_MS,
  // 친구 반응은 반나절 늦어도 읽을 만하고 그 뒤는 알림함으로 충분하다
  SOCIAL: 12 * HOUR_MS,
  // 공지·리포트·결제·초대·재방문 안내는 하루 안에 닿으면 되고 그 뒤는 알림함에 남는다
  INFORMATIONAL: 24 * HOUR_MS,
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

// 시작이 코앞인 할 일 알림도 지금 켜져 있는 기기에는 닿도록 남기는 최소 보관 시간이다
const TODO_REMINDER_MIN_TTL_MS = MINUTE_MS;
// 야간까지 이보다 덜 남았으면 보내지 않는다. 대기열·공급자 지연으로 21시를 넘겨 뜰 수 있어서다
const QUIET_HOURS_SEND_MARGIN_MS = 5 * MINUTE_MS;

export interface PushExpiryInput {
  readonly type: NotificationType;
  readonly now: Temporal.Instant;
  // 받는 사람 시간대. 자정과 야간 시작을 이 시간대로 잰다
  readonly timeZone: TimeZone;
  // 광고성이거나, 야간 수신을 끈 사람에게 가는 야간 예외 아닌 알림이면 야간 전에 사라져야 한다
  readonly expiresBeforeQuietHours: boolean;
  // TODO_REMINDER의 할 일 시작 순간. 모르면(반복 멈춤 안내·벽시계 없는 옛 행) 종류 기본값을 쓴다
  readonly todoStartsAt: Temporal.Instant | null;
}

export type PushExpiry =
  | { readonly status: "deliverable"; readonly ttlSeconds: number }
  | { readonly status: "quiet-hours" };

/**
 * 공급자 보관 시간(Expo ttl → FCM android.ttl·APNs apns-expiration)을 받는 사람 기준으로 정한다.
 * 종류 기본값에서 할 일 시작·받는 사람 자정·받는 사람 야간 시작 중 이른 것으로 줄인다.
 */
export function resolvePushExpiry(input: PushExpiryInput): PushExpiry {
  const { now, timeZone } = input;
  const expiryClass = EXPIRY_CLASS_BY_TYPE[input.type];
  const candidates = [now.add({ milliseconds: TTL_MS_BY_EXPIRY_CLASS[expiryClass] })];

  if (expiryClass === "REMINDER" && input.todoStartsAt != null) {
    candidates.push(
      latest(input.todoStartsAt, now.add({ milliseconds: TODO_REMINDER_MIN_TTL_MS })),
    );
  }
  if (expiryClass === "TODAY_ONLY") {
    candidates.push(nextLocalMidnight(now, timeZone));
  }
  if (input.expiresBeforeQuietHours) {
    if (isWithinQuietHours({ instant: now, timeZone, window: PUSH_QUIET_HOURS_WINDOW })) {
      return { status: "quiet-hours" };
    }
    const quietHoursStart = nextQuietHoursStart({
      instant: now,
      timeZone,
      window: PUSH_QUIET_HOURS_WINDOW,
    });
    if (now.until(quietHoursStart).total("milliseconds") < QUIET_HOURS_SEND_MARGIN_MS) {
      return { status: "quiet-hours" };
    }
    candidates.push(quietHoursStart);
  }

  const expiresAt = candidates.toSorted(Temporal.Instant.compare)[0] ?? now;
  return {
    status: "deliverable",
    ttlSeconds: Math.max(0, Math.floor(now.until(expiresAt).total("milliseconds") / SECOND_MS)),
  };
}

function latest(left: Temporal.Instant, right: Temporal.Instant): Temporal.Instant {
  return Temporal.Instant.compare(left, right) >= 0 ? left : right;
}

// 자정이 없는 날(자정 DST 전환)은 그날의 첫 순간이다
function nextLocalMidnight(now: Temporal.Instant, timeZone: TimeZone): Temporal.Instant {
  return now
    .toZonedDateTimeISO(timeZone.value)
    .toPlainDate()
    .add({ days: 1 })
    .toZonedDateTime(timeZone.value)
    .toInstant();
}
