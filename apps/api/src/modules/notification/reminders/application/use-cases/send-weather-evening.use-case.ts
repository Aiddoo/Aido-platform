import { decideEveningWeatherBriefing } from "#api/modules/weather/weather-reports/weather-weather-reports.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  NotificationHistoryReader,
  PublishNotificationBatchUseCase,
} from "../../../notifications/notification-notifications.public.js";
import {
  createWeatherEveningFallbackNotificationMessage,
  createWeatherEveningNotificationMessage,
  createWeatherEveningUnavailableNotificationMessage,
} from "../../../shared/application/messages/weather-notification.messages.js";
import type { TimezoneContext } from "../../domain/local-clock.domain-service.js";
import type { ReminderWeatherReportReaderPort } from "../ports/reminder-weather-report.reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import { type WeatherReminderReaderPort } from "../ports/weather-reminder-reader.port.js";
import { ReminderLogEvent } from "../reminders.log-events.js";
import {
  buildWeatherNotification,
  filterUnnotifiedWeatherUsers,
  sendWeatherFallbackNotifications,
  weatherRecipientLocale,
  weatherVariantContext,
  withWeatherLocation,
} from "../weather-reminder-delivery.mapper.js";

const NOTIFICATION_TYPE = "WEATHER_EVENING";

interface WeatherEveningStrategyDependencies {
  readonly reader: Pick<
    WeatherReminderReaderPort,
    "findWeatherEveningFallbackUsers" | "findWeatherEveningUsersWithLocation"
  >;
  readonly notificationPublisher: Pick<PublishNotificationBatchUseCase, "execute">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly weatherReportReader: Pick<ReminderWeatherReportReaderPort, "readReports">;
  readonly clock: Pick<ClockPort, "now">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 저녁 날씨 알림. 앱 화면과 같은 v2 리포트(칸 캐시 공유)로 내일 비·눈이 시작하는 때와 쌀쌀함을 알린다.
 * 리포트는 알림 대상(설정 시각·위치 있음·오늘 미발송)만 조회한다.
 */
export class SendWeatherEveningUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: WeatherEveningStrategyDependencies;

  constructor(dependencies: WeatherEveningStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(timezoneContext: TimezoneContext): Promise<{ sent: number }> {
    // 가을 DST로 두 번째 오는 시각처럼 울릴 시각이 없는 분은 조회하지 않는다
    if (timezoneContext.reminderTimes.length === 0) {
      return { sent: 0 };
    }
    const { timezones, localHour, localMinute, today } = timezoneContext;

    // 1단계: 위치 있는 유저 → 날씨 알림 (예보를 받지 못하면 안내 알림)
    const weather = await this.#sendWeatherNotifications(timezoneContext, today);

    // 2단계: 위치 없는 유저 → 폴백 알림
    const fallbackSent = await this.#sendFallbackNotifications(timezoneContext, today);

    const total = weather.sent + fallbackSent;
    if (total > 0) {
      this.#dependencies.logger.log({
        event: ReminderLogEvent.WEATHER_EVENING_SENT,
        timezones,
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
    timezoneContext: TimezoneContext,
    today: Temporal.PlainDate,
  ): Promise<{ sent: number; unavailable: number }> {
    const rows = await this.#dependencies.reader.findWeatherEveningUsersWithLocation({
      timezones: timezoneContext.timezones,
      times: timezoneContext.reminderTimes,
      userId:
        timezoneContext.userId == null ? undefined : UserId.reconstitute(timezoneContext.userId),
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

    const now = this.#dependencies.clock.now();
    const reports = await this.#dependencies.weatherReportReader.readReports(
      targets.map((user) => ({
        key: user.id,
        latitude: user.location.latitude,
        longitude: user.location.longitude,
        language: weatherRecipientLocale(user),
      })),
      now,
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
              now,
              timezone: user.timezone,
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

    await this.#dependencies.notificationPublisher.execute(notifications);
    return { sent: notifications.length, unavailable };
  }

  async #sendFallbackNotifications(
    timezoneContext: TimezoneContext,
    today: Temporal.PlainDate,
  ): Promise<number> {
    const users = await this.#dependencies.reader.findWeatherEveningFallbackUsers({
      timezones: timezoneContext.timezones,
      times: timezoneContext.reminderTimes,
      userId:
        timezoneContext.userId == null ? undefined : UserId.reconstitute(timezoneContext.userId),
    });
    return sendWeatherFallbackNotifications(this.#dependencies, {
      users,
      type: NOTIFICATION_TYPE,
      today,
      createMessage: createWeatherEveningFallbackNotificationMessage,
    });
  }
}
