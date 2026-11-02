import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";

import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import { decideEveningWeatherBriefing } from "../../../domain/services/reminders/weather-briefing.policy.js";
import {
  createWeatherEveningFallbackNotificationMessage,
  createWeatherEveningNotificationMessage,
  createWeatherEveningUnavailableNotificationMessage,
} from "../../messages/delivery/notification-messages.js";
import { NotificationRemindersLogEvent } from "../../observability/reminders/notification-reminders-log.events.js";
import type { ReminderWeatherReportReaderPort } from "../../ports/reminders/reminder-weather-report.reader.port.js";
import { type WeatherReminderReaderPort } from "../../ports/reminders/weather-reminder-reader.port.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import type { NotificationHistoryReader } from "../../readers/delivery/notification-history.reader.js";
import type { TimezoneReminderStrategy } from "./timezone-reminder.strategy.js";
import {
  buildWeatherNotification,
  filterUnnotifiedWeatherUsers,
  sendWeatherFallbackNotifications,
  weatherRecipientLocale,
  weatherVariantContext,
  withWeatherLocation,
} from "./weather-reminder-delivery.js";

const NOTIFICATION_TYPE = "WEATHER_EVENING";

interface WeatherEveningStrategyDependencies {
  readonly reader: Pick<
    WeatherReminderReaderPort,
    "findWeatherEveningFallbackUsers" | "findWeatherEveningUsersWithLocation"
  >;
  readonly notificationPublisher: Pick<NotificationPublisher, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly weatherReportReader: Pick<ReminderWeatherReportReaderPort, "readReports">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

/**
 * 저녁 날씨 알림. 앱 화면과 같은 v2 리포트(칸 캐시 공유)로 내일 비·눈이 시작하는 때와 쌀쌀함을 알린다.
 * 리포트는 알림 대상(설정 시각·위치 있음·오늘 미발송)만 조회한다.
 */
export class WeatherEveningStrategy implements TimezoneReminderStrategy {
  readonly #dependencies: WeatherEveningStrategyDependencies;

  constructor(dependencies: WeatherEveningStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { tz, localHour, localMinute, today } = ctx;

    // 1단계: 위치 있는 유저 → 날씨 알림 (예보를 받지 못하면 안내 알림)
    const weather = await this.#sendWeatherNotifications(ctx, today);

    // 2단계: 위치 없는 유저 → 폴백 알림
    const fallbackSent = await this.#sendFallbackNotifications(ctx, today);

    const total = weather.sent + fallbackSent;
    if (total > 0) {
      this.#dependencies.logger.log({
        event: NotificationRemindersLogEvent.WEATHER_EVENING_SENT,
        timezone: tz,
        localHour,
        localMinute,
        weatherCount: weather.sent - weather.unavailable,
        unavailableCount: weather.unavailable,
        fallbackCount: fallbackSent,
      });
    }
    return { sent: total };
  }

  async #sendWeatherNotifications(
    ctx: TimezoneContext,
    today: Date,
  ): Promise<{ sent: number; unavailable: number }> {
    const rows = await this.#dependencies.reader.findWeatherEveningUsersWithLocation({
      tz: ctx.tz,
      hour: ctx.localHour,
      minute: ctx.localMinute,
      userId: ctx.userId,
    });
    const targets = await filterUnnotifiedWeatherUsers(
      this.#dependencies.notificationHistoryReader,
      withWeatherLocation(rows),
      NOTIFICATION_TYPE,
      today,
    );
    if (targets.length === 0) {
      return { sent: 0, unavailable: 0 };
    }

    const at = now();
    const reports = await this.#dependencies.weatherReportReader.readReports(
      targets.map((user) => ({
        key: user.id,
        latitude: user.location.latitude,
        longitude: user.location.longitude,
        language: weatherRecipientLocale(user),
      })),
      at,
    );

    let unavailable = 0;
    const notifications = targets.map((user) => {
      const locale = weatherRecipientLocale(user);
      const variantContext = weatherVariantContext(NOTIFICATION_TYPE, user.id, today);
      const located = reports.get(user.id);
      const briefing =
        located == null
          ? null
          : decideEveningWeatherBriefing(located.report, {
              now: at,
              timezone: ctx.tz,
              locationTimezone: located.timezone,
            });
      if (briefing == null) {
        unavailable += 1;
      }
      return buildWeatherNotification({
        userId: user.id,
        type: NOTIFICATION_TYPE,
        message:
          briefing == null
            ? createWeatherEveningUnavailableNotificationMessage({ locale, variantContext })
            : createWeatherEveningNotificationMessage({ briefing, locale, variantContext }),
        action: null,
        today,
      });
    });

    await this.#dependencies.notificationPublisher.publishBatch(notifications);
    return { sent: notifications.length, unavailable };
  }

  async #sendFallbackNotifications(ctx: TimezoneContext, today: Date): Promise<number> {
    const users = await this.#dependencies.reader.findWeatherEveningFallbackUsers({
      tz: ctx.tz,
      hour: ctx.localHour,
      minute: ctx.localMinute,
      userId: ctx.userId,
    });
    return sendWeatherFallbackNotifications(this.#dependencies, {
      users,
      type: NOTIFICATION_TYPE,
      today,
      createMessage: createWeatherEveningFallbackNotificationMessage,
    });
  }
}
