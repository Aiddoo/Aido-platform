import { groupBy } from "es-toolkit";

import {
  decideMorningWeatherBriefing,
  type MorningWeatherBriefing,
} from "#api/modules/weather/weather-reports/weather-weather-reports.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { resolveTimezone } from "#api/shared/domain/time/time-zone-name";

import type {
  NotificationHistoryReader,
  PublishNotificationBatchUseCase,
} from "../../../notifications/notification-notifications.public.js";
import { formatWeatherNotificationTime } from "../../../shared/application/messages/notification-copy-format.messages.js";
import {
  createWeatherMorningFallbackNotificationMessage,
  createWeatherMorningNotificationMessage,
  createWeatherMorningUnavailableNotificationMessage,
  createWeatherRescheduleAction,
} from "../../../shared/application/messages/weather-notification.messages.js";
import type { NotificationAction } from "../../../shared/domain/notification-draft.constants.js";
import type { TimezoneContext } from "../../domain/local-clock.domain-service.js";
import type { ReminderWeatherReportReaderPort } from "../ports/reminder-weather-report.reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import type { WeatherBriefingTodoReaderPort } from "../ports/weather-briefing-todo.reader.port.js";
import { type WeatherReminderReaderPort } from "../ports/weather-reminder-reader.port.js";
import type {
  WeatherReminderTodoReadModel,
  WeatherReminderUserReadModel,
} from "../read-models/scheduler.read-model.js";
import { ReminderLogEvent } from "../reminders.log-events.js";
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
  readonly notificationPublisher: Pick<PublishNotificationBatchUseCase, "execute">;
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
        event: ReminderLogEvent.WEATHER_MORNING_SENT,
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
    const targets = await this.#findTargets(timezoneContext, today);
    if (targets.length === 0) {
      return { sent: 0, unavailable: 0 };
    }

    const now = this.#dependencies.clock.now();
    const [todos, reports] = await Promise.all([
      this.#listTodayTodos(targets, now),
      this.#dependencies.weatherReportReader.readReports(
        targets.map((user) => ({
          key: user.id,
          latitude: user.location.latitude,
          longitude: user.location.longitude,
          language: weatherRecipientLocale(user),
        })),
        now,
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
                scheduledAt: instantFromDate(todo.scheduledTime),
              })),
              { now, timezone: user.timezone, locationTimezone: located.timezone },
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
          timezone: user.timezone,
          formatTime: (instant) =>
            formatWeatherNotificationTime(instant, { locale, timezone: user.timezone }),
        }),
        action: rescheduleActionOf(briefing),
        today,
      });
    });

    await this.#dependencies.notificationPublisher.execute(notifications);
    return { sent: notifications.length, unavailable };
  }

  async #findTargets(timezoneContext: TimezoneContext, today: Temporal.PlainDate) {
    const rows = await this.#dependencies.reader.findWeatherMorningUsersWithLocation({
      timezones: timezoneContext.timezones,
      times: timezoneContext.reminderTimes,
      userId:
        timezoneContext.userId == null ? undefined : UserId.reconstitute(timezoneContext.userId),
    });
    return filterUnnotifiedWeatherUsers(this.#dependencies.notificationHistoryReader, {
      users: withWeatherLocation(rows),
      type: NOTIFICATION_TYPE,
      today,
    });
  }

  // 오늘·다음 자정은 시간대마다 정한다. 지금 현지 시각이 같아도 자정 전 서머타임 전환은 다를 수 있다
  async #listTodayTodos(
    targets: readonly WeatherReminderUserReadModel[],
    now: Temporal.Instant,
  ): Promise<WeatherReminderTodoReadModel[]> {
    const targetsByTimezone = groupBy(targets, (user) => user.timezone);
    const todosByTimezone = await Promise.all(
      Object.entries(targetsByTimezone).map(([timezone, users]) => {
        const timeZone = resolveTimezone(timezone);
        const date = now.toZonedDateTimeISO(timeZone).toPlainDate();
        return this.#dependencies.todoReader.listTodayTodos({
          userIds: users.map((user) => UserId.reconstitute(user.id)),
          date,
          timezone,
          from: now,
          until: date.add({ days: 1 }).toZonedDateTime(timeZone).toInstant(),
        });
      }),
    );
    return todosByTimezone.flat();
  }

  async #sendFallbackNotifications(
    timezoneContext: TimezoneContext,
    today: Temporal.PlainDate,
  ): Promise<number> {
    const users = await this.#dependencies.reader.findWeatherMorningFallbackUsers({
      timezones: timezoneContext.timezones,
      times: timezoneContext.reminderTimes,
      userId:
        timezoneContext.userId == null ? undefined : UserId.reconstitute(timezoneContext.userId),
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
