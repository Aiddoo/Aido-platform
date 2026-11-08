import { WEATHER_BRIEFING_RULES, type WeatherCondition } from '@aido/api/vocabulary';
import type { Todo } from '@src/features/planning/todo/schemas/todo.schema';
import { HOUR_MS } from '@src/shared/constants/time-units';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import {
  type Instant,
  fromEpochMs,
  fromWallClock,
  getZonedHour,
  hasSameWallClock,
  toDateKey,
  toEpochMs,
} from '@src/shared/date/instant';
import { maxBy, range, takeWhile } from 'es-toolkit';
import { match } from 'ts-pattern';

import type { DailyForecastEntry, HourlyForecastEntry } from './weather-report.model';
import { WeatherReportPolicy } from './weather-report.model';

/** 체감 온도가 이 값(°C) 이상인 낮 시간은 야외 할 일을 피하라고 안내한다. 서버 날씨 알림과 같은 기준이다. */
const HEAT_APPARENT_TEMPERATURE = WEATHER_BRIEFING_RULES.HOT_APPARENT_TEMPERATURE;
/** 내일 아침 최저 기온이 이 값(°C) 이하면 쌀쌀하다고 알린다. 서버 날씨 알림과 같은 기준이다. */
const CHILLY_TEMPERATURE = WEATHER_BRIEFING_RULES.CHILLY_TEMPERATURE;
const BEST_TIME_TOLERANCE = 1;
const EVENING_HOUR = WEATHER_BRIEFING_RULES.EVENING_HOUR;
const MORNING_START_HOUR = 6;
const AFTERNOON_START_HOUR = 12;
const CLEAR_CONDITIONS: readonly WeatherCondition[] = ['CLEAR', 'MOSTLY_CLEAR', 'PARTLY_CLOUDY'];
const OVERCAST_CONDITIONS: readonly WeatherCondition[] = [
  'CLOUDY',
  'MOSTLY_CLOUDY',
  'FOGGY',
  'HAZY',
];

type BriefingSubTodoProgress = { completed: number; total: number } | null;

/** 할 일 피처의 모델에 기대지 않도록 브리핑에 필요한 값만 받는다. 시간이 없거나 종일이면 scheduledAt이 null이다. */
export interface BriefingTodo {
  id: number;
  title: string;
  scheduledAt: Instant | null;
  completed: boolean;
  subTodoProgress: BriefingSubTodoProgress;
}

function toBriefingTodo(
  todo: Pick<Todo, 'id' | 'title' | 'localTime' | 'isAllDay' | 'completed' | 'subTodoStats'>,
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

function isHot(hour: HourlyForecastEntry): boolean {
  return hour.isDaylight && hour.apparentTemperature >= HEAT_APPARENT_TEMPERATURE;
}

function isThunderHour(hour: HourlyForecastEntry): boolean {
  return hour.condition === 'THUNDERSTORMS';
}

function isFrozenHour(hour: HourlyForecastEntry): boolean {
  return WeatherReportPolicy.isFrozenPrecipitation(hour.precipitationType);
}

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

function getForecastTodos(
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

function toRainLaterBriefing(
  hourly: readonly HourlyForecastEntry[],
  todos: ForecastTodo[],
  { now, timeZone }: BriefingClock,
): BriefingResult | null {
  const nowIndex = findHourIndexAt(hourly, now);
  const current = hourly[nowIndex];
  if (current == null || WeatherReportPolicy.isWetHour(current)) {
    return null;
  }
  const wetHour = hourly.slice(nowIndex + 1).find(WeatherReportPolicy.isWetHour);
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

function toClearBriefing(
  hourly: readonly HourlyForecastEntry[],
  todos: ForecastTodo[],
  { now, timeZone }: BriefingClock,
): BriefingResult | null {
  const todayKey = toDateKey(now, timeZone);
  const daylightHours = WeatherReportPolicy.getUpcomingHours(hourly, now).filter(
    (hour) => hour.isDaylight && toDateKey(hour.startsAt, timeZone) === todayKey,
  );
  if (daylightHours.length === 0 || daylightHours.some(WeatherReportPolicy.isWetHour)) {
    return null;
  }
  if (!daylightHours.every((hour) => CLEAR_CONDITIONS.includes(hour.condition))) {
    return null;
  }
  const best = maxBy(daylightHours, (hour) => hour.apparentTemperature);
  if (best == null || best.apparentTemperature >= HEAT_APPARENT_TEMPERATURE) {
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

function getWeatherBriefing(
  report: BriefingSource,
  todos: readonly BriefingTodo[],
  clock: BriefingClock,
): BriefingResult {
  const { hourly } = report;
  const forecastTodos = getForecastTodos(hourly, todos, clock.now);
  const wetTodos = forecastTodos.filter((todo) => WeatherReportPolicy.isWetHour(todo.hour));
  if (wetTodos.length > 0) {
    return toWetBriefing(hourly, wetTodos);
  }
  const hotTodos = forecastTodos.filter((todo) => isHot(todo.hour));
  // 브리핑에서 체크해 완료해도 카드가 바뀌지 않도록 판단에는 완료한 할 일도 센다.
  const scheduledCount = forecastTodos.length;

  const todayBriefing =
    toHotBriefing(hourly, hotTodos) ??
    toRainLaterBriefing(hourly, forecastTodos, clock) ??
    toClearBriefing(hourly, forecastTodos, clock);
  if (todayBriefing != null) {
    return todayBriefing;
  }
  if (scheduledCount === 0) {
    return toTomorrowMorningBriefing(report, clock) ?? { kind: 'noScheduledTodos' };
  }
  return { kind: 'dry', todos: forecastTodos };
}

/** 추천 시간대 안에서 지금 이후 첫 시간별 예보의 시작 시각. 30분 단위 시간대도 예보 칸에 맞는다. 모두 지났으면 제안하지 않는다. */
function getSuggestedStartAt(
  range: HourRange,
  hourly: readonly HourlyForecastEntry[],
  now: Instant,
): Instant | null {
  const next = hourly.find(
    (hour) =>
      toEpochMs(now) <= toEpochMs(hour.startsAt) &&
      toEpochMs(range.startsAt) <= toEpochMs(hour.startsAt) &&
      toEpochMs(hour.startsAt) < toEpochMs(range.endsAt),
  );
  return next?.startsAt ?? null;
}

export type BriefingState = 'loading' | 'hidden' | 'visible';

function getBriefingState(
  report: { location: { timezone: string }; fetchedAt: Instant } | undefined,
  { now, deviceTimeZone }: { now: Instant; deviceTimeZone: string },
): BriefingState {
  if (report == null) {
    return 'loading';
  }
  if (
    WeatherReportPolicy.isNowcastExpired(report, now) ||
    !hasSameWallClock(now, report.location.timezone, deviceTimeZone)
  ) {
    return 'hidden';
  }
  return 'visible';
}

function isTodoWithinRange(todo: Pick<ForecastTodo, 'scheduledAt'>, range: HourRange): boolean {
  return (
    toEpochMs(range.startsAt) <= toEpochMs(todo.scheduledAt) &&
    toEpochMs(todo.scheduledAt) < toEpochMs(range.endsAt)
  );
}

function getUncompletedTodoIds(todos: readonly Pick<ForecastTodo, 'todoId' | 'completed'>[]) {
  return todos.filter((todo) => !todo.completed).map((todo) => todo.todoId);
}

export const WeatherBriefingPolicy = {
  getBriefingState,
  isTodoWithinRange,
  getUncompletedTodoIds,
  toBriefingTodo,
  getWeatherBriefing,
  getSuggestedStartAt,
  isHot,
  getForecastTodos,
} as const;
