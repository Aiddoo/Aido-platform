import { NOTIFICATION_ACTION_TYPE } from "@aido/api";
import { buildWeatherRescheduleDeepLink, type WeatherRescheduleReason } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { resolveTimezone } from "#api/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE, type SupportedLocale } from "#api/shared/domain/locale";

import type {
  EveningWeatherBriefing,
  MorningWeatherBriefing,
} from "../../../domain/services/reminders/weather-briefing.policy.js";
import type { NotificationAction } from "../../ports/delivery/notification-data.js";
import * as en from "./locales/en.js";
import * as ko from "./locales/ko.js";
import {
  createNotificationLabelPreview,
  renderLocalizedNotification,
} from "./notification-copy.renderer.js";
import type { NotificationMessage, NotificationVariantContext } from "./notification-copy.types.js";

const LOCALE_TEMPLATES = { ko, en } satisfies Record<
  SupportedLocale,
  Pick<
    typeof ko,
    "WEATHER_TEMPLATES" | "WEATHER_FALLBACK" | "WEATHER_CONDITION_LABEL" | "WEATHER_DAY_PART_LABEL"
  >
>;

interface LocalizedWeatherInput {
  readonly locale?: SupportedLocale;
  readonly variantContext?: NotificationVariantContext;
}

interface WeatherBriefingMessageInput<TBriefing> extends LocalizedWeatherInput {
  readonly briefing: TBriefing;
  /** 알림 시간대로 시각을 표시한다. 카피 선택은 시간대를 모른다 */
  readonly formatTime: (instant: Date) => string;
}

/**
 * 알림 시간대·언어의 짧은 시각 표시. 정시가 아니면 분까지 쓴다(ko "오후 3시"·"오후 3시 30분", en "3 PM"·"3:30 PM").
 * 할 일 시각과 시간별 예보는 절대 시각이므로 기기 시간대로 보여 줘야 앱 화면과 같다.
 */
export function formatWeatherNotificationTime(
  instant: Date,
  { locale, timezone }: { readonly locale: SupportedLocale; readonly timezone: string },
): string {
  const timeZone = resolveTimezone(timezone);
  const parts = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "numeric",
    timeZone,
  }).formatToParts(instant);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  if (locale === "ko") {
    // Intl ko는 분이 있으면 "오후 3:30"이라 정시 표기("오후 3시")와 섞이므로 시·분을 직접 붙인다
    const dayPeriod = parts.find((part) => part.type === "dayPeriod")?.value;
    const hour = parts.find((part) => part.type === "hour")?.value;
    const time = minute === 0 ? `${hour}시` : `${hour}시 ${minute}분`;
    return dayPeriod == null ? time : `${dayPeriod} ${time}`;
  }
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    ...(minute !== 0 && { minute: "2-digit" }),
    timeZone,
  }).format(instant);
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
  locale = DEFAULT_LOCALE,
  variantContext,
}: WeatherBriefingMessageInput<MorningWeatherBriefing>): NotificationMessage {
  const templates = LOCALE_TEMPLATES[locale];
  const todoTitle = (title: string) => createNotificationLabelPreview({ label: title, locale });

  return match(briefing)
    .with({ kind: "todoWet", hazard: "rain" }, ({ todo, todoIds, precipitationChance }) =>
      renderLocalizedNotification({
        template: templates.WEATHER_TEMPLATES.MORNING_TODO_RAIN,
        variables: {
          time: formatTime(todo.scheduledAt),
          todoTitle: todoTitle(todo.title),
          precipChance: precipitationChance,
          otherCount: todoIds.length - 1,
        },
        variantContext,
        templateKey: "weather.morning.todo_rain",
      }),
    )
    .with({ kind: "todoWet", hazard: "storm" }, ({ todo }) =>
      renderLocalizedNotification({
        template: templates.WEATHER_TEMPLATES.MORNING_TODO_STORM,
        variables: { time: formatTime(todo.scheduledAt), todoTitle: todoTitle(todo.title) },
        variantContext,
        templateKey: "weather.morning.todo_storm",
      }),
    )
    .with({ kind: "todoWet", hazard: "snow" }, ({ todo }) =>
      renderLocalizedNotification({
        template: templates.WEATHER_TEMPLATES.MORNING_TODO_SNOW,
        variables: { time: formatTime(todo.scheduledAt), todoTitle: todoTitle(todo.title) },
        variantContext,
        templateKey: "weather.morning.todo_snow",
      }),
    )
    .with({ kind: "todoHot" }, ({ todo, peakApparentTemperature }) =>
      renderLocalizedNotification({
        template: templates.WEATHER_TEMPLATES.MORNING_TODO_HEAT,
        variables: {
          time: formatTime(todo.scheduledAt),
          todoTitle: todoTitle(todo.title),
          apparentTemp: Math.round(peakApparentTemperature),
        },
        variantContext,
        templateKey: "weather.morning.todo_heat",
      }),
    )
    .with({ kind: "wetLater" }, ({ startsAt, isSnow }) =>
      renderLocalizedNotification({
        template: isSnow
          ? templates.WEATHER_TEMPLATES.MORNING_SNOW_LATER
          : templates.WEATHER_TEMPLATES.MORNING_RAIN_LATER,
        variables: { time: formatTime(startsAt) },
        variantContext,
        templateKey: isSnow ? "weather.morning.snow_later" : "weather.morning.rain_later",
      }),
    )
    .with({ kind: "summary" }, ({ day }) =>
      renderLocalizedNotification({
        template: templates.WEATHER_TEMPLATES.MORNING_SUMMARY,
        variables: {
          conditionLabel: templates.WEATHER_CONDITION_LABEL[day.condition],
          tempMin: Math.round(day.temperatureMin),
          tempMax: Math.round(day.temperatureMax),
          precipChance: day.precipitationChance,
        },
        variantContext,
        templateKey: "weather.morning.summary",
      }),
    )
    .exhaustive();
}

export function createWeatherEveningNotificationMessage({
  briefing,
  locale = DEFAULT_LOCALE,
  variantContext,
}: Omit<WeatherBriefingMessageInput<EveningWeatherBriefing>, "formatTime">): NotificationMessage {
  const templates = LOCALE_TEMPLATES[locale];

  return match(briefing)
    .with({ kind: "wetTomorrow" }, ({ isSnow, dayPart, day, isChilly }) =>
      renderLocalizedNotification({
        template: isSnow
          ? templates.WEATHER_TEMPLATES.EVENING_SNOW
          : templates.WEATHER_TEMPLATES.EVENING_RAIN,
        variables: {
          dayPartLabel: dayPart == null ? null : templates.WEATHER_DAY_PART_LABEL[dayPart],
          chillyTemp: isChilly ? Math.round(day.temperatureMin) : null,
        },
        variantContext,
        templateKey: isSnow ? "weather.evening.snow" : "weather.evening.rain",
      }),
    )
    .with({ kind: "tomorrowSummary" }, ({ day, isChilly }) =>
      renderLocalizedNotification({
        template: templates.WEATHER_TEMPLATES.EVENING_SUMMARY,
        variables: {
          conditionLabel: templates.WEATHER_CONDITION_LABEL[day.condition],
          tempMin: Math.round(day.temperatureMin),
          tempMax: Math.round(day.temperatureMax),
          isChilly,
        },
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
  return renderLocalizedNotification({
    template: LOCALE_TEMPLATES[locale].WEATHER_FALLBACK.MORNING,
    variables: undefined,
    variantContext,
    templateKey: "weather.morning.fallback",
  });
}

export function createWeatherEveningFallbackNotificationMessage({
  locale = DEFAULT_LOCALE,
  variantContext,
}: LocalizedWeatherInput = {}): NotificationMessage {
  return renderLocalizedNotification({
    template: LOCALE_TEMPLATES[locale].WEATHER_FALLBACK.EVENING,
    variables: undefined,
    variantContext,
    templateKey: "weather.evening.fallback",
  });
}

/** 위치는 있지만 캐시·마지막 스냅샷까지 예보가 없을 때. 틀린 날씨 대신 앱에서 확인하도록 안내한다 */
export function createWeatherMorningUnavailableNotificationMessage({
  locale = DEFAULT_LOCALE,
  variantContext,
}: LocalizedWeatherInput = {}): NotificationMessage {
  return renderLocalizedNotification({
    template: LOCALE_TEMPLATES[locale].WEATHER_FALLBACK.MORNING_UNAVAILABLE,
    variables: undefined,
    variantContext,
    templateKey: "weather.morning.unavailable",
  });
}

export function createWeatherEveningUnavailableNotificationMessage({
  locale = DEFAULT_LOCALE,
  variantContext,
}: LocalizedWeatherInput = {}): NotificationMessage {
  return renderLocalizedNotification({
    template: LOCALE_TEMPLATES[locale].WEATHER_FALLBACK.EVENING_UNAVAILABLE,
    variables: undefined,
    variantContext,
    templateKey: "weather.evening.unavailable",
  });
}
