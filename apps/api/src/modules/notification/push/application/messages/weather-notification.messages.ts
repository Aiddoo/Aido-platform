import {
  buildWeatherRescheduleDeepLink,
  NOTIFICATION_ACTION_TYPE,
  type WeatherRescheduleReason,
} from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type {
  EveningWeatherBriefing,
  MorningWeatherBriefing,
} from "#api/modules/weather/forecasts/weather-forecasts.public";
import { DEFAULT_LOCALE, type SupportedLocale } from "#api/shared/domain/locale";

import type { NotificationAction } from "../../../inbox/application/ports/notification-draft.port.js";
import type {
  NotificationMessage,
  NotificationVariantContext,
} from "./notification-copy-catalog.messages.js";
import { WEATHER_COPY, WEATHER_FALLBACK_COPY } from "./notification-copy-templates.messages.js";
import { renderNotificationTemplate } from "./notification-copy.messages.js";

export { formatWeatherNotificationTime } from "./notification-copy-format.messages.js";

interface LocalizedWeatherInput {
  readonly locale?: SupportedLocale;
  readonly variantContext?: NotificationVariantContext;
}

interface WeatherBriefingMessageInput<TBriefing> extends LocalizedWeatherInput {
  readonly briefing: TBriefing;
  /** 알림 시간대로 시각을 표시한다. 카피 선택은 시간대를 모른다 */
  readonly formatTime: (instant: Date) => string;
  /** 알림함을 다른 언어로 다시 렌더링할 때 시각을 쓸 시간대. 없으면 저장 문구를 쓴다 */
  readonly timezone?: string;
}

/**
 * 날씨와 겹친 할 일을 옮기는 앱 경로. 1.13.x 이하 앱은 날씨 알림의 url을 무시하고 `/weather`를 연다.
 * 1.14.0 앱은 url을 읽어 옮기기 화면으로 바로 간다.
 */
export function createWeatherRescheduleAction(
  todoIds: readonly number[],
  reason: WeatherRescheduleReason,
): NotificationAction {
  return {
    type: NOTIFICATION_ACTION_TYPE.DEEP_LINK,
    url: buildWeatherRescheduleDeepLink(todoIds, reason),
  };
}

export function createWeatherMorningNotificationMessage({
  briefing,
  formatTime,
  timezone,
  locale = DEFAULT_LOCALE,
  variantContext,
}: WeatherBriefingMessageInput<MorningWeatherBriefing>): NotificationMessage {
  const options = { locale, variantContext, overrides: { formatTime } };
  const todoFacts = (todo: { readonly title: string; readonly scheduledAt: Date }) => ({
    scheduledAt: todo.scheduledAt.toISOString(),
    timezone: timezone ?? null,
    todoTitle: todo.title,
  });

  return match(briefing)
    .with({ kind: "todoWet", hazard: "rain" }, ({ todo, todoIds, precipitationChance }) =>
      renderNotificationTemplate(WEATHER_COPY.MORNING_TODO_RAIN, {
        ...options,
        facts: {
          ...todoFacts(todo),
          precipChance: precipitationChance,
          otherCount: todoIds.length - 1,
        },
        templateKey: "weather.morning.todo_rain",
      }),
    )
    .with({ kind: "todoWet", hazard: "storm" }, ({ todo }) =>
      renderNotificationTemplate(WEATHER_COPY.MORNING_TODO_STORM, {
        ...options,
        facts: todoFacts(todo),
        templateKey: "weather.morning.todo_storm",
      }),
    )
    .with({ kind: "todoWet", hazard: "snow" }, ({ todo }) =>
      renderNotificationTemplate(WEATHER_COPY.MORNING_TODO_SNOW, {
        ...options,
        facts: todoFacts(todo),
        templateKey: "weather.morning.todo_snow",
      }),
    )
    .with({ kind: "todoHot" }, ({ todo, peakApparentTemperature }) =>
      renderNotificationTemplate(WEATHER_COPY.MORNING_TODO_HEAT, {
        ...options,
        facts: { ...todoFacts(todo), apparentTemp: Math.round(peakApparentTemperature) },
        templateKey: "weather.morning.todo_heat",
      }),
    )
    .with({ kind: "wetLater" }, ({ startsAt, isSnow }) =>
      renderNotificationTemplate(
        isSnow ? WEATHER_COPY.MORNING_SNOW_LATER : WEATHER_COPY.MORNING_RAIN_LATER,
        {
          ...options,
          facts: { startsAt: startsAt.toISOString(), timezone: timezone ?? null },
          templateKey: isSnow ? "weather.morning.snow_later" : "weather.morning.rain_later",
        },
      ),
    )
    .with({ kind: "summary" }, ({ day }) =>
      renderNotificationTemplate(WEATHER_COPY.MORNING_SUMMARY, {
        ...options,
        facts: {
          condition: day.condition,
          tempMin: Math.round(day.temperatureMin),
          tempMax: Math.round(day.temperatureMax),
          precipChance: day.precipitationChance,
        },
        templateKey: "weather.morning.summary",
      }),
    )
    .exhaustive();
}

export function createWeatherEveningNotificationMessage({
  briefing,
  locale = DEFAULT_LOCALE,
  variantContext,
}: Omit<
  WeatherBriefingMessageInput<EveningWeatherBriefing>,
  "formatTime" | "timezone"
>): NotificationMessage {
  return match(briefing)
    .with({ kind: "wetTomorrow" }, ({ isSnow, dayPart, day, isChilly }) =>
      renderNotificationTemplate(isSnow ? WEATHER_COPY.EVENING_SNOW : WEATHER_COPY.EVENING_RAIN, {
        facts: { dayPart, chillyTemp: isChilly ? Math.round(day.temperatureMin) : null },
        locale,
        variantContext,
        templateKey: isSnow ? "weather.evening.snow" : "weather.evening.rain",
      }),
    )
    .with({ kind: "tomorrowSummary" }, ({ day, isChilly }) =>
      renderNotificationTemplate(WEATHER_COPY.EVENING_SUMMARY, {
        facts: {
          condition: day.condition,
          tempMin: Math.round(day.temperatureMin),
          tempMax: Math.round(day.temperatureMax),
          isChilly,
        },
        locale,
        variantContext,
        templateKey: "weather.evening.summary",
      }),
    )
    .exhaustive();
}

/** 날씨 위치가 없을 때 */
export function createWeatherMorningFallbackNotificationMessage({
  locale = DEFAULT_LOCALE,
  variantContext,
}: LocalizedWeatherInput = {}): NotificationMessage {
  return renderNotificationTemplate(WEATHER_FALLBACK_COPY.MORNING, {
    facts: {},
    locale,
    variantContext,
    templateKey: "weather.morning.fallback",
  });
}

export function createWeatherEveningFallbackNotificationMessage({
  locale = DEFAULT_LOCALE,
  variantContext,
}: LocalizedWeatherInput = {}): NotificationMessage {
  return renderNotificationTemplate(WEATHER_FALLBACK_COPY.EVENING, {
    facts: {},
    locale,
    variantContext,
    templateKey: "weather.evening.fallback",
  });
}

/** 위치는 있지만 캐시·마지막 스냅샷까지 예보가 없을 때. 틀린 날씨 대신 앱에서 확인하도록 안내한다 */
export function createWeatherMorningUnavailableNotificationMessage({
  locale = DEFAULT_LOCALE,
  variantContext,
}: LocalizedWeatherInput = {}): NotificationMessage {
  return renderNotificationTemplate(WEATHER_FALLBACK_COPY.MORNING_UNAVAILABLE, {
    facts: {},
    locale,
    variantContext,
    templateKey: "weather.morning.unavailable",
  });
}

export function createWeatherEveningUnavailableNotificationMessage({
  locale = DEFAULT_LOCALE,
  variantContext,
}: LocalizedWeatherInput = {}): NotificationMessage {
  return renderNotificationTemplate(WEATHER_FALLBACK_COPY.EVENING_UNAVAILABLE, {
    facts: {},
    locale,
    variantContext,
    templateKey: "weather.evening.unavailable",
  });
}
