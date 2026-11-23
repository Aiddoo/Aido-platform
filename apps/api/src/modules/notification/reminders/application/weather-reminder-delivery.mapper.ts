import type { SupportedLocale } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  NotificationHistoryReaderPort,
  PublishNotificationBatchUseCase,
} from "../../notifications/notification-notifications.public.js";
import type {
  NotificationMessage,
  NotificationVariantContext,
} from "../../shared/application/messages/notification-copy-catalog.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../shared/domain/notification-campaign.constants.js";
import type {
  CreateNotificationData,
  NotificationAction,
} from "../../shared/domain/notification-draft.constants.js";
import { resolveRecipientLocale } from "../../shared/domain/recipient-locale.domain-service.js";
import type {
  WeatherFallbackUserReadModel,
  WeatherReminderUserReadModel,
} from "./read-models/scheduler.read-model.js";

/** 아침·저녁 날씨 알림이 함께 쓰는 수신자 필터·기록 조립·위치 없음 안내 발송. */

export type WeatherNotificationType = "WEATHER_MORNING" | "WEATHER_EVENING";

export interface WeatherReminderDeliveryDependencies {
  readonly notificationPublisher: Pick<PublishNotificationBatchUseCase, "execute">;
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReaderPort,
    "listAlreadyNotifiedUserIds"
  >;
}

interface WeatherReminderRecipient {
  readonly id: string;
  readonly preference: { readonly locale: string } | null;
}

export function weatherRecipientLocale(user: WeatherReminderRecipient): SupportedLocale {
  return resolveRecipientLocale({
    storedLocale: user.preference?.locale ?? null,
    lastRequestLocale: null,
  });
}

export function weatherVariantContext(
  type: WeatherNotificationType,
  userId: string,
  today: Temporal.PlainDate,
): NotificationVariantContext {
  return {
    campaignKey: SCHEDULER_CAMPAIGN_KEY[type],
    recipientId: userId,
    occurrenceKey: today.toString(),
  };
}

type LocatedWeatherReminderUser = WeatherReminderUserReadModel & {
  readonly location: NonNullable<WeatherReminderUserReadModel["location"]>;
};

/** 1.14.0부터 해외 위치도 저장되며 v2 리포트는 격자 없이 좌표로 읽으므로 위치만 있으면 대상이다. */
export function withWeatherLocation(
  rows: readonly WeatherReminderUserReadModel[],
): LocatedWeatherReminderUser[] {
  return rows.flatMap(({ location, ...user }) => (location == null ? [] : [{ ...user, location }]));
}

/** 오늘 같은 종류의 날씨 알림을 이미 받은 사용자를 뺀다. */
export async function filterUnnotifiedWeatherUsers<TUser extends { readonly id: string }>(
  historyReader: WeatherReminderDeliveryDependencies["notificationHistoryReader"],
  {
    users,
    type,
    today,
  }: {
    readonly users: readonly TUser[];
    readonly type: WeatherNotificationType;
    readonly today: Temporal.PlainDate;
  },
): Promise<TUser[]> {
  if (users.length === 0) {
    return [];
  }
  const alreadyNotified = await historyReader.listAlreadyNotifiedUserIds({
    userIds: users.map((user) => UserId.reconstitute(user.id)),
    type,
    notificationDate: today,
  });
  return users.filter((user) => !alreadyNotified.has(user.id));
}

export function buildWeatherNotification(input: {
  readonly userId: string;
  readonly type: WeatherNotificationType;
  readonly message: NotificationMessage;
  readonly action: NotificationAction | null;
  readonly today: Temporal.PlainDate;
}): CreateNotificationData {
  const { userId, type, message, action, today } = input;
  return {
    userId,
    type,
    purpose: "SCHEDULED_SERVICE",
    campaignKey: SCHEDULER_CAMPAIGN_KEY[type],
    variantId: message.variantId,
    title: message.title,
    body: message.body,
    copyKey: message.copyKey,
    copyFacts: message.copyFacts,
    ...(action != null && { action }),
    notificationDate: today,
  };
}

/** 위치가 없는 사용자에게 위치 설정 안내를 보낸다. 보낸 수를 돌려준다. */
export async function sendWeatherFallbackNotifications(
  dependencies: WeatherReminderDeliveryDependencies,
  input: {
    readonly users: readonly WeatherFallbackUserReadModel[];
    readonly type: WeatherNotificationType;
    readonly today: Temporal.PlainDate;
    readonly createMessage: (input: {
      readonly locale: SupportedLocale;
      readonly variantContext: NotificationVariantContext;
    }) => NotificationMessage;
  },
): Promise<number> {
  const { users, type, today, createMessage } = input;
  const targets = await filterUnnotifiedWeatherUsers(dependencies.notificationHistoryReader, {
    users,
    type,
    today,
  });
  if (targets.length === 0) {
    return 0;
  }

  const notifications = targets.map((user) =>
    buildWeatherNotification({
      userId: user.id,
      type,
      message: createMessage({
        locale: weatherRecipientLocale(user),
        variantContext: weatherVariantContext(type, user.id, today),
      }),
      action: null,
      today,
    }),
  );
  await dependencies.notificationPublisher.execute(notifications);
  return notifications.length;
}
