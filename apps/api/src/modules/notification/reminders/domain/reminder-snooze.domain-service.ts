import { TODO_REMINDER_SNOOZE_MINUTES } from "@aido/api/vocabulary";

import type { NotificationId } from "../../shared/domain/notification-id.vo.js";
import { REMINDER_LATE_SKIP_REASON } from "./notification-schedule.domain-service.js";

/** 다시 알림의 단계 값. 회차 단계(60min·10min)와 달라 중복 방지 유니크 인덱스에서 따로 센다 */
export const SNOOZED_REMINDER_STAGE = "snooze";

export function snoozedReminderFireAt(pressedAt: Temporal.Instant): Temporal.Instant {
  return pressedAt.add({ minutes: TODO_REMINDER_SNOOZE_MINUTES });
}

/**
 * 늦게 꺼낸 다시 알림의 사유. null이면 보낸다.
 * 할 일 시각이 지났어도 보낸다. 10분 전 알림에서 누르면 다시 울릴 때는 늘 할 일 시각 뒤다
 */
export function snoozedReminderLateSkipReason(params: {
  readonly remindAt: Temporal.Instant;
  readonly now: Temporal.Instant;
  readonly limitMinutes: number;
}): typeof REMINDER_LATE_SKIP_REASON | null {
  const lateLimit = params.remindAt.add({ minutes: params.limitMinutes });
  return Temporal.Instant.compare(params.now, lateLimit) > 0 ? REMINDER_LATE_SKIP_REASON : null;
}

/**
 * 다시 알림 한 번의 회차 값. 누른 알림마다 하나라 같은 알림을 두 번 눌러도 한 번 울리고,
 * 다시 온 알림에서 또 누르면 새 회차다. 회차 칸(16자)에 들도록 알림 id(int4)만 쓴다
 */
export function createSnoozeOccurrenceKey(notificationId: NotificationId): string {
  return String(notificationId.value);
}
