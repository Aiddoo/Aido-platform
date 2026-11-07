import { WEATHER_BRIEFING_RULES, type WeatherCondition } from '@aido/api/vocabulary';
import { HOUR_MS } from '@src/shared/constants/time-units';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import {
  type Instant,
  fromEpochMs,
  fromWallClock,
  getZonedHour,
  toDateKey,
  toEpochMs,
} from '@src/shared/date/instant';
import { maxBy, range, takeWhile } from 'es-toolkit';
import { match } from 'ts-pattern';

import type { DailyForecastEntry, HourlyForecastEntry } from '../schemas/weather-report.schema';
import { isFrozenPrecipitation, isWetHour } from './weather-report.model';

/** 체감 온도가 이 값(°C) 이상인 낮 시간은 야외 할 일을 피하라고 안내한다. 서버 날씨 알림과 같은 기준이다. */
const HEAT_APPARENT_TEMPERATURE = WEATHER_BRIEFING_RULES.HOT_APPARENT_TEMPERATURE;
/** 내일 아침 최저 기온이 이 값(°C) 이하면 쌀쌀하다고 알린다. 서버 날씨 알림과 같은 기준이다. */
const CHILLY_TEMPERATURE = WEATHER_BRIEFING_RULES.CHILLY_TEMPERATURE;
/** 맑은 날 추천 시간은 가장 따뜻한 시각과 체감 온도 차이가 이 값(°C) 안인 시간까지 묶는다. */
const BEST_TIME_TOLERANCE = 1;
/** 이 시각(위치 시간대) 이후 남은 할 일이 없으면 내일 아침 날씨를 알려 준다. */
const EVENING_HOUR = WEATHER_BRIEFING_RULES.EVENING_HOUR;
/** 새벽, 오전, 오후가 시작하는 시각(위치 시간대). 저녁은 EVENING_HOUR부터다. */
const MORNING_START_HOUR = 6;
const AFTERNOON_START_HOUR = 12;
const CLEAR_CONDITIONS: readonly WeatherCondition[] = ['CLEAR', 'MOSTLY_CLEAR', 'PARTLY_CLOUDY'];
const OVERCAST_CONDITIONS: readonly WeatherCondition[] = [
  'CLOUDY',
  'MOSTLY_CLOUDY',
  'FOGGY',
  'HAZY',
];

/** 하위 할 일 진행. 하위 할 일이 없으면 null이다. */
type BriefingSubTodoProgress = { completed: number; total: number } | null;

/** 할 일 피처의 모델에 기대지 않도록 브리핑에 필요한 값만 받는다. 시간이 없거나 종일이면 scheduledAt이 null이다. */
export interface BriefingTodo {
  id: number;
  title: string;
  scheduledAt: Instant | null;
  completed: boolean;
  subTodoProgress: BriefingSubTodoProgress;
}

/**
 * 할 일 목록의 값을 브리핑 입력으로 바꾼다. 종일 할 일은 시각이 있어도 시간대를 정하지 않은 것으로 본다.
 * 할 일 시각은 어디서든 그 벽시계라 예보와 맞출 순간은 보고 있는 날짜 + 벽시계 + 기기 시간대로 만든다.
 * 여러 날 할 일은 시작일이 어제여도 오늘 목록에 있으므로 시작일이 아니라 보고 있는 날짜에 둔다.
 */
function toBriefingTodo(
  todo: {
    id: number;
    title: string;
    localTime: string | null;
    isAllDay: boolean;
    completed: boolean;
    subTodoStats: { completed: number; total: number };
  },
  { date, timeZone }: { date: string; timeZone: string },
): BriefingTodo {
  return {
    id: todo.id,
    title: todo.title,
    scheduledAt:
      todo.isAllDay || todo.localTime == null
        ? null
        : fromWallClock(date, todo.localTime, timeZone),
    completed: todo.completed,
    subTodoProgress: todo.subTodoStats.total > 0 ? todo.subTodoStats : null,
  };
}

/** 시각이 정해진 할 일과 그 시각의 시간별 예보 */
export interface ForecastTodo {
  todoId: number;
  title: string;
  scheduledAt: Instant;
  /** 브리핑에서 체크해도 줄이 사라지지 않도록 완료한 할 일도 남긴다. 옮기기 대상에서는 뺀다. */
  completed: boolean;
  subTodoProgress: BriefingSubTodoProgress;
  hour: HourlyForecastEntry;
}

export interface HourRange {
  startsAt: Instant;
  endsAt: Instant;
}

type BriefingDay = 'today' | 'tomorrow';
type DayPart = 'dawn' | 'morning' | 'afternoon' | 'evening';

export type BriefingResult =
  | { kind: 'rainy'; todos: ForecastTodo[] }
  | { kind: 'stormy'; todos: ForecastTodo[]; range: HourRange }
  | { kind: 'snowy'; todos: ForecastTodo[] }
  | { kind: 'hot'; todos: ForecastTodo[]; range: HourRange; peakApparentTemperature: number }
  | {
      kind: 'rainLater';
      todos: ForecastTodo[];
      startsAt: Instant;
      day: BriefingDay;
      dayPart: DayPart;
      isSnow: boolean;
      isOvercast: boolean;
    }
  | { kind: 'clear'; todos: ForecastTodo[]; range: HourRange }
  | { kind: 'tomorrowMorning'; temperatureMin: number; temperatureMax: number; isChilly: boolean }
  | { kind: 'dry'; todos: ForecastTodo[] }
  | { kind: 'noScheduledTodos' };

type BriefingSource = {
  location: { timezone: string };
  hourly: HourlyForecastEntry[];
  daily: DailyForecastEntry[];
};

/** 할 일 날짜는 기기 시간대로 저장되므로 오늘·내일도 기기 시간대로 가른다. */
interface BriefingClock {
  now: Instant;
  timeZone: string;
}

function findHourIndexAt(hourly: readonly HourlyForecastEntry[], at: Instant): number {
  const time = toEpochMs(at);
  return hourly.findIndex((hour) => {
    const startsAt = toEpochMs(hour.startsAt);
    return startsAt <= time && time < startsAt + HOUR_MS;
  });
}

export function isHot(hour: HourlyForecastEntry): boolean {
  return hour.isDaylight && hour.apparentTemperature >= HEAT_APPARENT_TEMPERATURE;
}

function isThunderHour(hour: HourlyForecastEntry): boolean {
  return hour.condition === 'THUNDERSTORMS';
}

function isFrozenHour(hour: HourlyForecastEntry): boolean {
  return isFrozenPrecipitation(hour.precipitationType);
}

/** 기준 시간에서 앞뒤로 조건이 이어지는 시간을 묶는다. */
function toHourRange(
  hourly: readonly HourlyForecastEntry[],
  anchor: number,
  isIncluded: (hour: HourlyForecastEntry) => boolean,
): HourRange | null {
  const anchorHour = hourly[anchor];
  if (anchorHour == null || !isIncluded(anchorHour)) {
    return null;
  }
  const isRunAt = (index: number) => {
    const hour = hourly[index];
    return hour != null && isIncluded(hour);
  };
  const hoursBefore = takeWhile(range(1, anchor + 1), (offset) => isRunAt(anchor - offset)).length;
  const hoursAfter = takeWhile(range(1, hourly.length - anchor), (offset) =>
    isRunAt(anchor + offset),
  ).length;
  const startHour = hourly[anchor - hoursBefore] ?? anchorHour;
  const endHour = hourly[anchor + hoursAfter] ?? anchorHour;
  return {
    startsAt: startHour.startsAt,
    endsAt: fromEpochMs(toEpochMs(endHour.startsAt) + HOUR_MS),
  };
}

/** 지금 이후로 시각이 정해진 할 일을 그 시각의 예보와 묶는다. 완료 여부는 남기고, 예보 범위 밖이면 뺀다. */
export function getForecastTodos(
  hourly: readonly HourlyForecastEntry[],
  todos: readonly BriefingTodo[],
  now: Instant,
): ForecastTodo[] {
  return todos.flatMap((todo) => {
    if (todo.scheduledAt == null || toEpochMs(todo.scheduledAt) < toEpochMs(now)) {
      return [];
    }
    const hour = hourly[findHourIndexAt(hourly, todo.scheduledAt)];
    if (hour == null) {
      return [];
    }
    return [
      {
        todoId: todo.id,
        title: todo.title,
        scheduledAt: todo.scheduledAt,
        completed: todo.completed,
        subTodoProgress: todo.subTodoProgress,
        hour,
      },
    ];
  });
}

function toDayPart(hour: number): DayPart {
  if (hour < MORNING_START_HOUR) {
    return 'dawn';
  }
  if (hour < AFTERNOON_START_HOUR) {
    return 'morning';
  }
  return hour < EVENING_HOUR ? 'afternoon' : 'evening';
}

function toWetBriefing(
  hourly: readonly HourlyForecastEntry[],
  todos: ForecastTodo[],
): BriefingResult {
  const stormyTodo = todos.find((todo) => isThunderHour(todo.hour));
  if (stormyTodo != null) {
    const range = toHourRange(
      hourly,
      findHourIndexAt(hourly, stormyTodo.hour.startsAt),
      isThunderHour,
    );
    if (range != null) {
      return { kind: 'stormy', todos, range };
    }
  }
  if (todos.every((todo) => isFrozenHour(todo.hour))) {
    return { kind: 'snowy', todos };
  }
  return { kind: 'rainy', todos };
}

function toHotBriefing(
  hourly: readonly HourlyForecastEntry[],
  todos: ForecastTodo[],
): BriefingResult | null {
  const [first] = todos;
  const range =
    first == null ? null : toHourRange(hourly, findHourIndexAt(hourly, first.hour.startsAt), isHot);
  if (range == null) {
    return null;
  }
  const hotHours = hourly.filter(
    (hour) =>
      toEpochMs(range.startsAt) <= toEpochMs(hour.startsAt) &&
      toEpochMs(hour.startsAt) < toEpochMs(range.endsAt),
  );
  const peak = maxBy(hotHours, (hour) => hour.apparentTemperature);
  return {
    kind: 'hot',
    todos,
    range,
    peakApparentTemperature: peak?.apparentTemperature ?? HEAT_APPARENT_TEMPERATURE,
  };
}

/** 지금은 비가 안 오고, 오늘 남은 시간이나 내일 비가 시작되면 그 시각을 알려 준다. */
function toRainLaterBriefing(
  hourly: readonly HourlyForecastEntry[],
  todos: ForecastTodo[],
  { now, timeZone }: BriefingClock,
): BriefingResult | null {
  const nowIndex = findHourIndexAt(hourly, now);
  const current = hourly[nowIndex];
  if (current == null || isWetHour(current)) {
    return null;
  }
  const wetHour = hourly.slice(nowIndex + 1).find(isWetHour);
  if (wetHour == null) {
    return null;
  }
  const todayKey = toDateKey(now, timeZone);
  const wetDateKey = toDateKey(wetHour.startsAt, timeZone);
  const day = match(wetDateKey)
    .with(todayKey, () => 'today' as const)
    .with(addDaysToDateKey(todayKey, 1), () => 'tomorrow' as const)
    .otherwise(() => null);
  if (day == null) {
    return null;
  }
  return {
    kind: 'rainLater',
    todos,
    startsAt: wetHour.startsAt,
    day,
    dayPart: toDayPart(getZonedHour(wetHour.startsAt, timeZone)),
    isSnow: isFrozenHour(wetHour),
    isOvercast: OVERCAST_CONDITIONS.includes(current.condition),
  };
}

/** 오늘 남은 낮 시간이 모두 맑고 덥지 않으면 가장 따뜻한 시간을 야외 할 일 하기 좋은 때로 알려 준다. */
function toClearBriefing(
  hourly: readonly HourlyForecastEntry[],
  todos: ForecastTodo[],
  { now, timeZone }: BriefingClock,
): BriefingResult | null {
  const todayKey = toDateKey(now, timeZone);
  const daylightHours = hourly.filter(
    (hour) =>
      toEpochMs(hour.startsAt) + HOUR_MS > toEpochMs(now) &&
      hour.isDaylight &&
      toDateKey(hour.startsAt, timeZone) === todayKey,
  );
  if (daylightHours.length === 0 || daylightHours.some(isWetHour)) {
    return null;
  }
  const best = maxBy(daylightHours, (hour) => hour.apparentTemperature);
  if (
    best == null ||
    !CLEAR_CONDITIONS.includes(best.condition) ||
    best.apparentTemperature >= HEAT_APPARENT_TEMPERATURE
  ) {
    return null;
  }
  const range = toHourRange(
    hourly,
    findHourIndexAt(hourly, best.startsAt),
    (hour) =>
      daylightHours.includes(hour) &&
      best.apparentTemperature - hour.apparentTemperature <= BEST_TIME_TOLERANCE,
  );
  return range == null ? null : { kind: 'clear', todos, range };
}

/** 저녁에 오늘 남은 할 일이 없으면 내일 아침 기온을 미리 알려 준다. 날짜는 위치 시간대의 일별 예보를 따른다. */
function toTomorrowMorningBriefing(
  report: BriefingSource,
  { now }: BriefingClock,
): BriefingResult | null {
  const { timezone } = report.location;
  if (getZonedHour(now, timezone) < EVENING_HOUR) {
    return null;
  }
  const tomorrowKey = addDaysToDateKey(toDateKey(now, timezone), 1);
  const tomorrow = report.daily.find((day) => day.date === tomorrowKey);
  if (tomorrow == null) {
    return null;
  }
  return {
    kind: 'tomorrowMorning',
    temperatureMin: tomorrow.temperatureMin,
    temperatureMax: tomorrow.temperatureMax,
    isChilly: tomorrow.temperatureMin <= CHILLY_TEMPERATURE,
  };
}

/**
 * 판단은 완료한 할 일까지 포함해 체크해도 카드가 그대로 남는다. 옮기기 대상은 화면이 미완료만 고른다.
 * 할 일에 닿는 위험(뇌우·눈·비 → 더위)을 먼저 알리고, 없으면 곧 올 비, 맑은 날, 내일 아침 순으로 알려 준다.
 * 위 어디에도 해당하지 않으면 남은 할 일이 비를 피했는지만 알린다.
 */
function getWeatherBriefing(
  report: BriefingSource,
  todos: readonly BriefingTodo[],
  clock: BriefingClock,
): BriefingResult {
  const { hourly } = report;
  const forecastTodos = getForecastTodos(hourly, todos, clock.now);
  const wetTodos = forecastTodos.filter((todo) => isWetHour(todo.hour));
  if (wetTodos.length > 0) {
    return toWetBriefing(hourly, wetTodos);
  }
  const hotTodos = forecastTodos.filter((todo) => isHot(todo.hour));
  // 브리핑에서 체크해 완료해도 카드가 바뀌지 않도록 판단에는 완료한 할 일도 센다.
  const scheduledCount = forecastTodos.length;

  return (
    toHotBriefing(hourly, hotTodos) ??
    toRainLaterBriefing(hourly, forecastTodos, clock) ??
    toClearBriefing(hourly, forecastTodos, clock) ??
    (scheduledCount === 0 ? toTomorrowMorningBriefing(report, clock) : null) ??
    (scheduledCount === 0 ? { kind: 'noScheduledTodos' } : { kind: 'dry', todos: forecastTodos })
  );
}

/** 추천 시간대 안에서 아직 시작하지 않은 첫 정시. 이미 모두 지났으면 제안하지 않는다. */
function getSuggestedStartAt(range: HourRange, now: Instant): Instant | null {
  const nextHour = Math.ceil(toEpochMs(now) / HOUR_MS) * HOUR_MS;
  const startsAt = Math.max(toEpochMs(range.startsAt), nextHour);
  return startsAt < toEpochMs(range.endsAt) ? fromEpochMs(startsAt) : null;
}

export const WeatherBriefingPolicy = {
  toBriefingTodo,
  getWeatherBriefing,
  getSuggestedStartAt,
} as const;
