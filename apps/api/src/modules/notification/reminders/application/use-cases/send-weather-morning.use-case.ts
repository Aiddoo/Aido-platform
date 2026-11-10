import { groupBy } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";
import { instantToDate } from "#api/shared/domain/time/instant";

import type { NotificationHistoryReader } from "../../../inbox/application/notification-history.reader.js";
import type { NotificationAction } from "../../../inbox/application/ports/notification-draft.port.js";
import {
  createWeatherMorningFallbackNotificationMessage,
  createWeatherMorningNotificationMessage,
  createWeatherMorningUnavailableNotificationMessage,
  createWeatherRescheduleAction,
  formatWeatherNotificationTime,
} from "../../../push/application/messages/notification.messages.js";
import type { PublishNotificationUseCase } from "../../../push/application/use-cases/publish-notification.use-case.js";
import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import {
  decideMorningWeatherBriefing,
  type MorningWeatherBriefing,
} from "../../domain/weather-briefing.domain-service.js";
import type { ReminderWeatherReportReaderPort } from "../ports/reminder-weather-report.reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import type { WeatherBriefingTodoReaderPort } from "../ports/weather-briefing-todo.reader.port.js";
import { type WeatherReminderReaderPort } from "../ports/weather-reminder-reader.port.js";
import { NotificationRemindersLogEvent } from "../reminders.log-events.js";
import {
  buildWeatherNotification,
  filterUnnotifiedWeatherUsers,
  sendWeatherFallbackNotifications,
  weatherRecipientLocale,
  weatherVariantContext,
  withWeatherLocation,
} from "../weather-reminder-delivery.mapper.js";

const NOTIFICATION_TYPE = "WEATHER_MORNING";

interface WeatherMorningStrategyDependencies {
  readonly reader: Pick<
    WeatherReminderReaderPort,
    "findWeatherMorningFallbackUsers" | "findWeatherMorningUsersWithLocation"
  >;
  readonly todoReader: Pick<WeatherBriefingTodoReaderPort, "listTodayTodos">;
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly weatherReportReader: Pick<ReminderWeatherReportReaderPort, "readReports">;
  readonly clock: Pick<ClockPort, "now">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 아침 날씨 알림. 앱 화면과 같은 v2 리포트(칸 캐시 공유)와 오늘 할 일로 아이두 브리핑과 같은 내용을 보낸다.
 * 리포트는 알림 대상(설정 시각·위치 있음·오늘 미발송)만 조회하므로 대상이 아닌 사용자로 공급자를 부르지 않는다.
 */
export class SendWeatherMorningUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: WeatherMorningStrategyDependencies;

  constructor(dependencies: WeatherMorningStrategyDependencies) {
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
        event: NotificationRemindersLogEvent.WEATHER_MORNING_SENT,
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
    const rows = await this.#dependencies.reader.findWeatherMorningUsersWithLocation({
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

    const at = instantToDate(this.#dependencies.clock.now());
    const day = dayWindowInTimezone(at, ctx.tz);
    const [todos, reports] = await Promise.all([
      this.#dependencies.todoReader.listTodayTodos({
        userIds: targets.map((u) => u.id),
        date: Temporal.PlainDate.from(day.localDate),
        timezone: ctx.tz,
        from: at,
        until: day.endsAt,
      }),
      this.#dependencies.weatherReportReader.readReports(
        targets.map((user) => ({
          key: user.id,
          latitude: user.location.latitude,
          longitude: user.location.longitude,
          language: weatherRecipientLocale(user),
        })),
        at,
      ),
    ]);
    const todosByUser = groupBy(todos, (todo) => todo.userId);

    let unavailable = 0;
    const notifications = targets.map((user) => {
      const locale = weatherRecipientLocale(user);
      const variantContext = weatherVariantContext(NOTIFICATION_TYPE, user.id, today);
      const located = reports.get(user.id);
      const briefing =
        located == null
          ? null
          : decideMorningWeatherBriefing(
              located.report,
              (todosByUser[user.id] ?? []).map((todo) => ({
                id: todo.id,
                title: todo.title,
                scheduledAt: todo.scheduledTime,
              })),
              { now: at, timezone: ctx.tz, locationTimezone: located.timezone },
            );
      if (briefing == null) {
        unavailable += 1;
        return buildWeatherNotification({
          userId: user.id,
          type: NOTIFICATION_TYPE,
          message: createWeatherMorningUnavailableNotificationMessage({ locale, variantContext }),
          action: null,
          today,
        });
      }
      return buildWeatherNotification({
        userId: user.id,
        type: NOTIFICATION_TYPE,
        message: createWeatherMorningNotificationMessage({
          briefing,
          locale,
          variantContext,
          timezone: ctx.tz,
          formatTime: (instant) =>
            formatWeatherNotificationTime(instant, { locale, timezone: ctx.tz }),
        }),
        action: rescheduleActionOf(briefing),
        today,
      });
    });

    await this.#dependencies.notificationPublisher.publishBatch(notifications);
    return { sent: notifications.length, unavailable };
  }

  async #sendFallbackNotifications(ctx: TimezoneContext, today: Date): Promise<number> {
    const users = await this.#dependencies.reader.findWeatherMorningFallbackUsers({
      tz: ctx.tz,
      hour: ctx.localHour,
      minute: ctx.localMinute,
      userId: ctx.userId,
    });
    return sendWeatherFallbackNotifications(this.#dependencies, {
      users,
      type: NOTIFICATION_TYPE,
      today,
      createMessage: createWeatherMorningFallbackNotificationMessage,
    });
  }
}

/** 비·뇌우·더위와 겹친 할 일은 앱의 옮기기 화면으로 보낸다. 눈은 앱처럼 옮기기 대신 일찍 나가기를 권한다 */
function rescheduleActionOf(briefing: MorningWeatherBriefing): NotificationAction | null {
  if (briefing.kind === "todoHot") {
    return createWeatherRescheduleAction(briefing.todoIds, "heat");
  }
  if (briefing.kind === "todoWet" && briefing.hazard !== "snow") {
    return createWeatherRescheduleAction(briefing.todoIds, "rain");
  }
  return null;
}
