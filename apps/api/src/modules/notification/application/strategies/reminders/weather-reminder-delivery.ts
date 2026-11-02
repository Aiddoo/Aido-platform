import { toDateString } from "#api/shared/domain/date/utils/format";
import { type SupportedLocale, toSupportedLocale } from "#api/shared/domain/locale";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import type {
  NotificationMessage,
  NotificationVariantContext,
} from "../../messages/delivery/notification-copy.types.js";
import type {
  CreateNotificationData,
  NotificationAction,
} from "../../ports/delivery/notification-data.js";
import type {
  WeatherFallbackUser,
  WeatherReminderUser,
} from "../../ports/reminders/scheduler-read-models.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import type { NotificationHistoryReader } from "../../readers/delivery/notification-history.reader.js";

/** 아침·저녁 날씨 알림이 함께 쓰는 수신자 필터·기록 조립·위치 없음 안내 발송. */

export type WeatherNotificationType = "WEATHER_MORNING" | "WEATHER_EVENING";

export interface WeatherReminderDeliveryDependencies {
  readonly notificationPublisher: Pick<NotificationPublisher, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
}

interface WeatherReminderRecipient {
  readonly id: string;
  readonly preference: { readonly locale: string } | null;
}

export function weatherRecipientLocale(user: WeatherReminderRecipient): SupportedLocale {
  return toSupportedLocale(user.preference?.locale);
}

export function weatherVariantContext(
  type: WeatherNotificationType,
  userId: string,
  today: Date,
): NotificationVariantContext {
  return {
    campaignKey: SCHEDULER_CAMPAIGN_KEY[type],
    recipientId: userId,
    occurrenceKey: toDateString(today),
  };
}

type LocatedWeatherReminderUser = WeatherReminderUser & {
  readonly location: NonNullable<WeatherReminderUser["location"]>;
};

/** 1.14.0부터 해외 위치도 저장되며 v2 리포트는 격자 없이 좌표로 읽으므로 위치만 있으면 대상이다. */
export function withWeatherLocation(
  rows: readonly WeatherReminderUser[],
): LocatedWeatherReminderUser[] {
  return rows.flatMap(({ location, ...user }) => (location == null ? [] : [{ ...user, location }]));
}

/** 오늘 같은 종류의 날씨 알림을 이미 받은 사용자를 뺀다. */
export async function filterUnnotifiedWeatherUsers<TUser extends { readonly id: string }>(
  historyReader: WeatherReminderDeliveryDependencies["notificationHistoryReader"],
  users: readonly TUser[],
  type: WeatherNotificationType,
  today: Date,
): Promise<TUser[]> {
  if (users.length === 0) {
    return [];
  }
  const alreadyNotified = await historyReader.findAlreadyNotifiedUserIds({
    userIds: users.map((user) => user.id),
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
  readonly today: Date;
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
    ...(action != null && { action }),
    notificationDate: today,
  };
}

/** 위치가 없는 사용자에게 위치 설정 안내를 보낸다. 보낸 수를 돌려준다. */
export async function sendWeatherFallbackNotifications(
  dependencies: WeatherReminderDeliveryDependencies,
  input: {
    readonly users: readonly WeatherFallbackUser[];
    readonly type: WeatherNotificationType;
    readonly today: Date;
    readonly createMessage: (input: {
      readonly locale: SupportedLocale;
      readonly variantContext: NotificationVariantContext;
    }) => NotificationMessage;
  },
): Promise<number> {
  const { users, type, today, createMessage } = input;
  const targets = await filterUnnotifiedWeatherUsers(
    dependencies.notificationHistoryReader,
    users,
    type,
    today,
  );
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
  await dependencies.notificationPublisher.publishBatch(notifications);
  return notifications.length;
}
