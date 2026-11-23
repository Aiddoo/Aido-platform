import type { SupportedLocale } from "@aido/api/vocabulary";

import { NotificationId } from "../../notifications/domain/notification-id.vo.js";
import {
  createTodoReminderNotificationMessage,
  createTodoReminderSnoozedNotificationMessage,
  createTodoSeriesPausedNotificationMessage,
} from "../../shared/application/messages/scheduler-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../shared/domain/notification-campaign.constants.js";
import type { CreateNotificationData } from "../../shared/domain/notification-draft.constants.js";
import {
  createReminderOccurrenceKey,
  createSnoozedReminderMetadata,
  createTodoReminderMetadata,
} from "../../shared/domain/reminder-occurrence.domain-service.js";
import {
  SNOOZED_TODO_REMINDER_STAGE,
  TODO_SERIES_PAUSED_STAGE,
} from "../../shared/domain/todo-reminder-stage.constants.js";
import {
  createSnoozeOccurrenceKey,
  snoozedReminderTiming,
} from "../domain/reminder-snooze.domain-service.js";
import type { ActiveTodoReadModel } from "./read-models/scheduler.read-model.js";

interface TodoReminderRecipient {
  readonly todoId: number;
  readonly userId: string;
  readonly locale: SupportedLocale;
}

/** 알 수 없는 단계 문자열은 가장 이른 단계 문구로 보낸다. */
export function resolveReminderStage(stage: string): "60min" | "10min" {
  return stage === "10min" ? stage : "60min";
}

export function toTodoReminderNotification(
  input: TodoReminderRecipient & {
    readonly todo: ActiveTodoReadModel;
    readonly stageLabel: string;
  },
): CreateNotificationData {
  const { todo, todoId, userId, stageLabel } = input;
  const message = createTodoReminderNotificationMessage({
    todoTitle: todo.title,
    stage: resolveReminderStage(stageLabel),
    locale: input.locale,
    variantContext: {
      campaignKey: `${SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER}.${stageLabel}`,
      recipientId: userId,
      occurrenceKey: `${todoId}:${stageLabel}`,
    },
  });
  return {
    userId,
    type: "TODO_REMINDER",
    purpose: "SCHEDULED_SERVICE",
    campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER,
    variantId: message.variantId,
    title: message.title,
    body: message.body,
    copyKey: message.copyKey,
    copyFacts: message.copyFacts,
    todoId,
    metadata: createTodoReminderMetadata(stageLabel, todo.scheduledAt),
    reminderOccurrenceKey: createReminderOccurrenceKey(todo.startDate, todo.scheduledLocalTime),
  };
}

export function toSnoozedTodoReminderNotification(
  input: TodoReminderRecipient & {
    readonly todo: ActiveTodoReadModel;
    readonly notificationId: number;
    readonly fireAt: Temporal.Instant;
    readonly now: Temporal.Instant;
  },
): CreateNotificationData {
  const { todo, todoId, userId, notificationId } = input;
  const message = createTodoReminderSnoozedNotificationMessage({
    todoTitle: todo.title,
    timing: snoozedReminderTiming({ sentAt: input.now, scheduledAt: todo.scheduledAt }),
    locale: input.locale,
    variantContext: {
      campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER_SNOOZED,
      recipientId: userId,
      occurrenceKey: `${todoId}:${SNOOZED_TODO_REMINDER_STAGE}:${notificationId}`,
    },
  });
  return {
    userId,
    type: "TODO_REMINDER",
    purpose: "SCHEDULED_SERVICE",
    campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER_SNOOZED,
    variantId: message.variantId,
    title: message.title,
    body: message.body,
    copyKey: message.copyKey,
    copyFacts: message.copyFacts,
    todoId,
    metadata: createSnoozedReminderMetadata(input.fireAt),
    reminderOccurrenceKey: createSnoozeOccurrenceKey(NotificationId.reconstitute(notificationId)),
  };
}

// 리마인더와 같은 종류·목적으로 보내 기존 알림 동의를 그대로 따른다. 탭하면 그 할 일로 간다.
export function toTodoSeriesPausedNotification({
  todoId,
  userId,
  locale,
}: TodoReminderRecipient): CreateNotificationData {
  const message = createTodoSeriesPausedNotificationMessage({
    locale,
    variantContext: {
      campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_SERIES_PAUSED,
      recipientId: userId,
      occurrenceKey: `${todoId}:${TODO_SERIES_PAUSED_STAGE}`,
    },
  });
  return {
    userId,
    type: "TODO_REMINDER",
    purpose: "SCHEDULED_SERVICE",
    campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_SERIES_PAUSED,
    variantId: message.variantId,
    title: message.title,
    body: message.body,
    copyKey: message.copyKey,
    copyFacts: message.copyFacts,
    todoId,
    metadata: { stage: TODO_SERIES_PAUSED_STAGE },
  };
}
