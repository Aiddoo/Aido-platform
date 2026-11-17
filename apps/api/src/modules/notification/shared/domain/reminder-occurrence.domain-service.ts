import { toIsoString } from "#api/shared/domain/time/instant";
import type { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { toZonedInstant } from "#api/shared/domain/time/zoned-time";

import type { CreateNotificationData } from "./notification-draft.constants.js";
import { SNOOZED_TODO_REMINDER_STAGE } from "./todo-reminder-stage.constants.js";

// 배포로 worker가 멈춘 사이 놓친 리마인더는 이만큼 늦은 것까지만 보내고, 더 늦으면 사유를 남기고 버린다
export const REMINDER_LATE_LIMIT_MINUTES = 15;

/**
 * 같은 할 일의 같은 단계를 한 번만 보내는 회차 값. 날짜와 벽시계로 만든다.
 *
 * 시간대 재계산은 날짜와 벽시계를 바꾸지 않아 값이 그대로이고, 사용자가 날짜나 시간을 고치면 값이 달라진다.
 * 벽시계가 빈 행(롤백 중 옛 서버가 쓴 행)은 날짜만 쓴다.
 */
export function createReminderOccurrenceKey(
  startDate: string,
  scheduledLocalTime: string | null,
): string {
  return scheduledLocalTime == null ? startDate : `${startDate}T${scheduledLocalTime}`;
}

/** 다시 알림 행의 metadata. 울릴 시각을 남겨 푸시 보관 시간이 처리기와 같은 늦음 한도에서 끝나게 한다 */
export function createSnoozedReminderMetadata(
  remindAt: Temporal.Instant,
): Readonly<Record<string, string>> {
  return { stage: SNOOZED_TODO_REMINDER_STAGE, remindAt: toIsoString(remindAt) };
}

/**
 * 할 일 리마인더 푸시가 쓸모를 잃는 순간. 모르면 null이고 종류 기본 보관 시간을 쓴다.
 * 회차 알림(60·10분 전)은 할 일 시작이다. 다시 알림은 시작 뒤에 울리는 것이 정상이라 처리기가 보내 주는
 * 늦음 한도(울릴 시각 + REMINDER_LATE_LIMIT_MINUTES)까지다.
 */
export function todoReminderPushEndsAt(
  notification: Pick<CreateNotificationData, "metadata" | "reminderOccurrenceKey">,
  timeZone: TimeZone,
): Temporal.Instant | null {
  const { metadata, reminderOccurrenceKey } = notification;
  // 다시 알림의 회차 칸은 누른 알림 id라 날짜로 읽지 않는다
  if (metadata?.["stage"] === SNOOZED_TODO_REMINDER_STAGE) {
    const remindAt = parseInstant(metadata["remindAt"]);
    return remindAt == null ? null : remindAt.add({ minutes: REMINDER_LATE_LIMIT_MINUTES });
  }
  return reminderOccurrenceKey == null
    ? null
    : reminderOccurrenceStart(reminderOccurrenceKey, timeZone);
}

/** 회차가 시작하는 순간. 할 일 순간과 같이 날짜 + 벽시계 + 받는 사람 시간대로 만든다. 벽시계가 없으면 null이다 */
function reminderOccurrenceStart(
  occurrenceKey: string,
  timeZone: TimeZone,
): Temporal.Instant | null {
  const [date, time] = occurrenceKey.split("T");
  if (date == null || time == null) {
    return null;
  }
  // 형식이 다른 옛 값은 발송을 막지 않고 종류 기본 보관 시간으로 보낸다
  try {
    return toZonedInstant({
      date: Temporal.PlainDate.from(date),
      time: Temporal.PlainTime.from(time),
      timeZone,
    });
  } catch {
    return null;
  }
}

function parseInstant(value: unknown): Temporal.Instant | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    return Temporal.Instant.from(value);
  } catch {
    return null;
  }
}
