import type {
  NotificationHistoryReader,
  NotificationPublisher,
} from "#api/modules/notification/notification-delivery.public";
import {
  createWeatherEveningFallbackNotificationMessage,
  createWeatherEveningNotificationMessage,
} from "#api/modules/notification/notification-delivery.public";
import type { WeatherForecastReaderPort } from "#api/modules/weather/weather-forecast.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { toSupportedLocale } from "#api/shared/domain/locale";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import type {
  ITimezoneStrategy,
  TimezoneContext,
} from "../../../domain/services/reminders/timezone-context.js";
import { type WeatherReminderReaderPort } from "../../ports/reminders/weather-reminder-reader.port.js";

interface VerifiedUserWithLocation {
  readonly id: string;
  readonly preference: { readonly locale: string } | null;
  readonly location: {
    readonly latitude: number;
    readonly longitude: number;
    readonly gridX: number;
    readonly gridY: number;
  };
}

interface WeatherEveningStrategyDependencies {
  readonly reader: WeatherReminderReaderPort;
  readonly notificationPublisher: NotificationPublisher;
  readonly notificationHistoryReader: NotificationHistoryReader;
  readonly weatherForecastReader: WeatherForecastReaderPort;
  readonly logger: ApplicationLogger;
}

export class WeatherEveningStrategy implements ITimezoneStrategy {
  readonly #dependencies: WeatherEveningStrategyDependencies;

  constructor(dependencies: WeatherEveningStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { tz, localHour, localMinute, today } = ctx;

    // 1단계: 위치 있는 유저 → 날씨 알림
    const weatherSent = await this.#sendWeatherNotifications(ctx, today);

    // 2단계: 위치 없는 유저 → 폴백 알림
    const fallbackSent = await this.#sendFallbackNotifications(ctx, today);

    const total = weatherSent + fallbackSent;
    if (total > 0) {
      this.#dependencies.logger.log(
        `Weather evening: tz=${tz}, time=${localHour}:${String(localMinute).padStart(2, "0")}, weather=${weatherSent}, fallback=${fallbackSent}`,
      );
    }
    return { sent: total };
  }

  async #sendWeatherNotifications(ctx: TimezoneContext, today: Date): Promise<number> {
    const users = await this.#dependencies.reader.findWeatherEveningUsersWithLocation({
      tz: ctx.tz,
      hour: ctx.localHour,
      minute: ctx.localMinute,
      userId: ctx.userId,
    });

    const usersWithLocation = users.filter(
      (u): u is VerifiedUserWithLocation => u.location !== null,
    );
    if (usersWithLocation.length === 0) {
      return 0;
    }

    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: usersWithLocation.map((u) => u.id),
        type: "WEATHER_EVENING",
        notificationDate: today,
      });
    const filtered = usersWithLocation.filter((u) => !alreadyNotified.has(u.id));
    if (filtered.length === 0) {
      return 0;
    }

    const gridGroups = this.#groupByGrid(filtered);
    const gridInputs = [...gridGroups.values()].flatMap((group) => {
      const first = group[0];
      if (!first) {
        return [];
      }
      return [
        {
          gridX: first.location.gridX,
          gridY: first.location.gridY,
          lat: first.location.latitude,
          lon: first.location.longitude,
        },
      ];
    });
    const forecasts = await this.#dependencies.weatherForecastReader.getForecastsByGridBatch(
      gridInputs,
      ctx.tomorrow,
    );

    const notifications = filtered
      .map((user) => {
        const loc = user.location;
        const key = `${loc.gridX}:${loc.gridY}`;
        const forecast = forecasts.get(key);
        if (!forecast) {
          return null;
        }

        const message = createWeatherEveningNotificationMessage({
          tomorrowForecast: forecast,
          locale: toSupportedLocale(user.preference?.locale),
          variantContext: {
            campaignKey: SCHEDULER_CAMPAIGN_KEY.WEATHER_EVENING,
            recipientId: user.id,
            occurrenceKey: toDateString(today),
          },
        });
        return {
          userId: user.id,
          type: "WEATHER_EVENING" as const,
          purpose: "SCHEDULED_SERVICE" as const,
          campaignKey: SCHEDULER_CAMPAIGN_KEY.WEATHER_EVENING,
          variantId: message.variantId,
          title: message.title,
          body: message.body,
          notificationDate: today,
        };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null);

    if (notifications.length === 0) {
      return 0;
    }

    await this.#dependencies.notificationPublisher.publishBatch(notifications);
    return notifications.length;
  }

  async #sendFallbackNotifications(ctx: TimezoneContext, today: Date): Promise<number> {
    const users = await this.#dependencies.reader.findWeatherEveningFallbackUsers({
      tz: ctx.tz,
      hour: ctx.localHour,
      minute: ctx.localMinute,
      userId: ctx.userId,
    });

    if (users.length === 0) {
      return 0;
    }

    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: users.map((u) => u.id),
        type: "WEATHER_EVENING",
        notificationDate: today,
      });
    const filtered = users.filter((u) => !alreadyNotified.has(u.id));
    if (filtered.length === 0) {
      return 0;
    }

    const notifications = filtered.map((user) => {
      const message = createWeatherEveningFallbackNotificationMessage({
        locale: toSupportedLocale(user.preference?.locale),
        variantContext: {
          campaignKey: SCHEDULER_CAMPAIGN_KEY.WEATHER_EVENING,
          recipientId: user.id,
          occurrenceKey: toDateString(today),
        },
      });
      return {
        userId: user.id,
        type: "WEATHER_EVENING" as const,
        purpose: "SCHEDULED_SERVICE" as const,
        campaignKey: SCHEDULER_CAMPAIGN_KEY.WEATHER_EVENING,
        variantId: message.variantId,
        title: message.title,
        body: message.body,
        notificationDate: today,
      };
    });

    await this.#dependencies.notificationPublisher.publishBatch(notifications);
    return notifications.length;
  }

  #groupByGrid(users: VerifiedUserWithLocation[]): Map<string, VerifiedUserWithLocation[]> {
    const groups = new Map<string, VerifiedUserWithLocation[]>();
    for (const user of users) {
      const loc = user.location;
      const key = `${loc.gridX}:${loc.gridY}`;
      const arr = groups.get(key) ?? [];
      arr.push(user);
      groups.set(key, arr);
    }
    return groups;
  }
}
