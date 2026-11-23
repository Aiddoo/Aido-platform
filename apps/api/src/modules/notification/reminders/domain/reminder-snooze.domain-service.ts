import { TODO_REMINDER_SNOOZE_MINUTES } from "@aido/api/vocabulary";

import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationId } from "../../notifications/domain/notification-id.vo.js";
import type { NotificationType } from "../../shared/domain/notification-type.constants.js";
import { isActionableTodoReminderStage } from "../../shared/domain/todo-reminder-stage.constants.js";
import { REMINDER_LATE_SKIP_REASON } from "./notification-schedule.domain-service.js";

// 알림 센터에 남은 오래된 알림 id로 자기 푸시를 쌓지 못하게 받은 지 하루 안의 알림만 받는다
const SNOOZE_SOURCE_MAX_AGE_HOURS = 24;

interface SnoozeSourceNotification {
  readonly recipientId: UserId;
  readonly type: NotificationType;
  readonly todoId: number | null;
  readonly stage: string | null;
  readonly createdAt: Temporal.Instant;
}

/** 다시 알림 문구. 할 일 시각 전에 울리면 곧 시작, 시각이 지났거나 없으면 이제 시작을 권한다 */
export type SnoozedReminderTiming = "before-start" | "started";

export function snoozedReminderFireAt(pressedAt: Temporal.Instant): Temporal.Instant {
  return pressedAt.add({ minutes: TODO_REMINDER_SNOOZE_MINUTES });
}

/** 다시 알림을 걸 수 있는 알림인가. 누른 사람이 받은, 그 할 일을 알린 리마인드 알림만 받는다 */
export function canSnoozeFromNotification(params: {
  readonly notification: SnoozeSourceNotification;
  readonly userId: UserId;
  readonly todoId: TodoId;
  readonly now: Temporal.Instant;
}): boolean {
  const { notification, userId, todoId, now } = params;
  const expiresAt = notification.createdAt.add({ hours: SNOOZE_SOURCE_MAX_AGE_HOURS });
  return (
    notification.recipientId.equals(userId) &&
    notification.type === "TODO_REMINDER" &&
    notification.todoId === todoId.value &&
    isActionableTodoReminderStage(notification.stage) &&
    Temporal.Instant.compare(now, expiresAt) <= 0
  );
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

// 늦게 꺼내면 예약 시각과 보내는 시각이 달라 받는 사람이 읽을 때에 맞춰 보내는 시각으로 고른다
export function snoozedReminderTiming(params: {
  readonly sentAt: Temporal.Instant;
  readonly scheduledAt: Temporal.Instant | null;
}): SnoozedReminderTiming {
  const { sentAt, scheduledAt } = params;
  if (scheduledAt != null && Temporal.Instant.compare(sentAt, scheduledAt) < 0) {
    return "before-start";
  }
  return "started";
}

/**
 * 다시 알림 한 번의 회차 값. 누른 알림마다 하나라 같은 알림을 두 번 눌러도 한 번 울리고,
 * 다시 온 알림에서 또 누르면 새 회차다. 회차 칸(16자)에 들도록 알림 id(int4)만 쓴다
 */
export function createSnoozeOccurrenceKey(notificationId: NotificationId): string {
  return String(notificationId.value);
}
