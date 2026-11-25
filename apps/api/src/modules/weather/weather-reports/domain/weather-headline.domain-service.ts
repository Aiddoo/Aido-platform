import {
  WEATHER_BRIEFING_RULES,
  type WeatherCondition,
  type WeatherDayPart,
  type WeatherWetHazard,
} from "@aido/api/vocabulary";
import { maxBy } from "es-toolkit";
import { match } from "ts-pattern";

import { localDateIn, resolveDateBoundaryTimezone } from "#api/shared/domain/time/timezone-name";

import {
  findContiguousHours,
  findHourIndexAt,
  isHotHour,
  isWetHour,
  toHourWindow,
  type WeatherBriefingTodo,
  type WeatherHourWindow,
} from "./weather-briefing.domain-service.js";
import {
  decideEveningWeatherBriefing,
  decideTodayWeather,
  findLocationDay,
  isThunderHour,
  type TodayWeatherBriefing,
  type WeatherBriefingClock,
  type WeatherBriefingForecast,
  type WeatherBriefingReportHour,
} from "./weather-notification-briefing.domain-service.js";

/** 맑은 날 추천 시간은 가장 따뜻한 시간과 체감 온도 차이가 이 값 안인 시간까지 묶는다 */
const BEST_OUTDOOR_TOLERANCE_CELSIUS = 1;
const CLEAR_CONDITIONS: ReadonlySet<WeatherCondition> = new Set([
  "CLEAR",
  "MOSTLY_CLEAR",
  "PARTLY_CLOUDY",
]);

/** 날씨 화면 브리핑 카드가 무엇을 알릴지. 문구는 앱이 만들고 서버는 종류와 사실만 정한다 */
export type WeatherHeadline =
  | {
      readonly kind: "todoWet";
      readonly hazard: WeatherWetHazard;
      readonly precipitationChance: number;
      readonly window: WeatherHourWindow;
    }
  | {
      readonly kind: "todoHot";
      readonly peakApparentTemperature: number;
      readonly window: WeatherHourWindow;
    }
  | { readonly kind: "wetLater"; readonly startsAt: Temporal.Instant; readonly isSnow: boolean }
  | {
      readonly kind: "wetTomorrow";
      /** 시간별 예보에서 시작 시각을 찾지 못하고 일별 확률로만 알면 null */
      readonly dayPart: WeatherDayPart | null;
      readonly isSnow: boolean;
    }
  | { readonly kind: "clear"; readonly window: WeatherHourWindow }
  | {
      readonly kind: "tomorrow";
      readonly temperatureMin: number;
      readonly temperatureMax: number;
      readonly isChilly: boolean;
    }
  | { readonly kind: "calm" };

/** 할 일 시각의 시간에서 앞뒤로 조건이 이어지는 시간. 그 시간이 조건에 맞지 않으면 그 한 시간이다 */
function toTodoWindow(
  hourly: readonly WeatherBriefingReportHour[],
  scheduledAt: Temporal.Instant,
  isIncluded: (hour: WeatherBriefingReportHour) => boolean,
): WeatherHourWindow {
  const hours = findContiguousHours(hourly, findHourIndexAt(hourly, scheduledAt), isIncluded);
  return toHourWindow(hours) ?? { startsAt: scheduledAt, endsAt: scheduledAt.add({ hours: 1 }) };
}

function toTodayHeadline(
  hourly: readonly WeatherBriefingReportHour[],
  today: TodayWeatherBriefing<WeatherBriefingTodo>,
): WeatherHeadline {
  return match(today)
    .returnType<WeatherHeadline>()
    .with({ kind: "todoWet" }, ({ hazard, precipitationChance, todo }) => ({
      kind: "todoWet",
      hazard,
      precipitationChance,
      window: toTodoWindow(
        hourly,
        todo.scheduledAt,
        hazard === "storm" ? isThunderHour : isWetHour,
      ),
    }))
    .with({ kind: "todoHot" }, ({ peakApparentTemperature, todo }) => ({
      kind: "todoHot",
      peakApparentTemperature,
      window: toTodoWindow(hourly, todo.scheduledAt, isHotHour),
    }))
    .with({ kind: "wetLater" }, ({ startsAt, isSnow }) => ({ kind: "wetLater", startsAt, isSnow }))
    .exhaustive();
}

/** 오늘 남은 낮 시간이 모두 맑고 덥지 않으면 가장 따뜻한 시간을 야외 할 일 하기 좋은 때로 고른다 */
function findBestOutdoorWindow(
  hourly: readonly WeatherBriefingReportHour[],
  { now, timezone }: WeatherBriefingClock,
): WeatherHourWindow | null {
  const today = localDateIn(now, timezone);
  const daylightHours = hourly.filter(
    (hour) =>
      Temporal.Instant.compare(hour.startsAt.add({ hours: 1 }), now) > 0 &&
      hour.isDaylight &&
      localDateIn(hour.startsAt, timezone).equals(today),
  );
  if (daylightHours.length === 0 || daylightHours.some(isWetHour)) {
    return null;
  }
  if (!daylightHours.every((hour) => CLEAR_CONDITIONS.has(hour.condition))) {
    return null;
  }
  const best = maxBy(daylightHours, (hour) => hour.apparentTemperature);
  if (best == null || isHotHour(best)) {
    return null;
  }
  const isBestHour = (hour: WeatherBriefingReportHour) =>
    daylightHours.includes(hour) &&
    best.apparentTemperature - hour.apparentTemperature <= BEST_OUTDOOR_TOLERANCE_CELSIUS;
  return toHourWindow(
    findContiguousHours(hourly, findHourIndexAt(hourly, best.startsAt), isBestHour),
  );
}

function isEveningAt({ now, locationTimezone }: WeatherBriefingClock): boolean {
  const { hour } = now.toZonedDateTimeISO(resolveDateBoundaryTimezone(locationTimezone));
  return hour >= WEATHER_BRIEFING_RULES.EVENING_HOUR;
}

/**
 * 날씨 화면 브리핑 카드의 머리글. 오늘 알릴 날씨는 아침 알림(decideTodayWeather), 내일 비·눈과 내일 요약은
 * 저녁 알림(decideEveningWeatherBriefing)과 같은 판단이라 알림과 화면이 엇갈리지 않는다. 맑은 날 추천 시간은
 * 화면에만 있다. 내일 요약은 저녁에 오늘 남은 할 일이 없을 때만 고른다.
 * 위치 시간대의 오늘 일별 예보가 없으면 판단하지 않는다(null).
 */
export function decideWeatherHeadline(
  forecast: WeatherBriefingForecast,
  todos: readonly WeatherBriefingTodo[],
  clock: WeatherBriefingClock,
): WeatherHeadline | null {
  if (findLocationDay(forecast, clock, 0) == null) {
    return null;
  }
  const today = decideTodayWeather(forecast, todos, clock);
  if (today != null) {
    return toTodayHeadline(forecast.hourly, today);
  }
  const evening = decideEveningWeatherBriefing(forecast, clock);
  if (evening?.kind === "wetTomorrow") {
    return { kind: "wetTomorrow", dayPart: evening.dayPart, isSnow: evening.isSnow };
  }
  const bestOutdoorWindow = findBestOutdoorWindow(forecast.hourly, clock);
  if (bestOutdoorWindow != null) {
    return { kind: "clear", window: bestOutdoorWindow };
  }
  if (evening != null && todos.length === 0 && isEveningAt(clock)) {
    return {
      kind: "tomorrow",
      temperatureMin: evening.day.temperatureMin,
      temperatureMax: evening.day.temperatureMax,
      isChilly: evening.isChilly,
    };
  }
  return { kind: "calm" };
}
