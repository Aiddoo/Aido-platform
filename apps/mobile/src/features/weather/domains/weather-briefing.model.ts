import {
  WEATHER_DAY_PARTS,
  WEATHER_WET_HAZARDS,
  type WeatherRescheduleReason,
} from '@aido/api/vocabulary';
import { type Instant, instantSchema, toEpochMs } from '@src/shared/date/instant';
import { keyBy } from 'es-toolkit';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { type ForecastHour, ForecastHourPolicy, forecastHourSchema } from './forecast-hour.model';
import {
  filterByUpcomingOption,
  type WeatherReportBriefing,
  WeatherReportBriefingPolicy,
  weatherRescheduleOptionSchema,
} from './weather-report-briefing.model';

/** 하위 할 일 진행. 하위 할 일이 없으면 null이다. */
const subTodoProgressSchema = z
  .object({ completed: z.int().nonnegative(), total: z.int().nonnegative() })
  .nullable();

/** 오늘 목록의 할 일에서 브리핑에 필요한 값. 시간이 없거나 종일이면 시각이 둘 다 null이다 */
const weatherBriefingTodoSchema = z.object({
  id: z.int(),
  title: z.string(),
  // 보이는 시각(벽시계 HH:mm). 어디서든 그 시각이다
  localTime: z.string().nullable(),
  // 예보 칸을 찾는 순간. 서머타임으로 없는 시각이면 전환 뒤로 밀려 localTime과 다를 수 있다
  scheduledAt: instantSchema.nullable(),
  completed: z.boolean(),
  subTodoProgress: subTodoProgressSchema,
});
export type WeatherBriefingTodo = z.infer<typeof weatherBriefingTodoSchema>;

/** 지금 이후로 시각이 정해진 할 일과 그 시각의 예보 */
const weatherForecastTodoSchema = z.object({
  todoId: z.int(),
  title: z.string(),
  localTime: z.string(),
  scheduledAt: instantSchema,
  // 브리핑에서 체크해도 줄이 사라지지 않도록 완료한 할 일도 남긴다. 옮기기 대상에서는 뺀다
  completed: z.boolean(),
  subTodoProgress: subTodoProgressSchema,
  hour: forecastHourSchema,
});
export type WeatherForecastTodo = z.infer<typeof weatherForecastTodoSchema>;

/** 서버가 날씨와 겹친다고 본 할 일. 옮길 시각 후보도 서버가 고른 것이다. */
export const weatherAffectedTodoSchema = weatherForecastTodoSchema.extend({
  rescheduleOptions: z.array(weatherRescheduleOptionSchema),
});
export type WeatherAffectedTodo = z.infer<typeof weatherAffectedTodoSchema>;

const hourWindowSchema = z.object({ startsAt: instantSchema, endsAt: instantSchema });
export type HourWindow = z.infer<typeof hourWindowSchema>;

/** 브리핑 카드가 알릴 것. 날씨 알림과 같은 서버 판단이고 앱은 그대로 그린다 */
export const weatherHeadlineSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('todoWet'),
    hazard: z.enum(WEATHER_WET_HAZARDS),
    window: hourWindowSchema,
  }),
  z.object({
    kind: z.literal('todoHot'),
    peakApparentTemperature: z.number(),
    window: hourWindowSchema,
  }),
  z.object({ kind: z.literal('wetLater'), startsAt: instantSchema, isSnow: z.boolean() }),
  z.object({
    kind: z.literal('wetTomorrow'),
    dayPart: z.enum(WEATHER_DAY_PARTS).nullable(),
    isSnow: z.boolean(),
  }),
  z.object({ kind: z.literal('clear'), window: hourWindowSchema }),
  z.object({
    kind: z.literal('tomorrow'),
    temperatureMin: z.number(),
    temperatureMax: z.number(),
    isChilly: z.boolean(),
  }),
  z.object({ kind: z.literal('calm') }),
]);
export type WeatherHeadline = z.infer<typeof weatherHeadlineSchema>;

/** 비·눈이 언제 시작하는지. 오늘은 시각, 내일은 하루 구분(일별 확률로만 알면 null)이다 */
const wetTimingSchema = z.discriminatedUnion('day', [
  z.object({ day: z.literal('today'), startsAt: instantSchema }),
  z.object({ day: z.literal('tomorrow'), dayPart: z.enum(WEATHER_DAY_PARTS).nullable() }),
]);

/**
 * 브리핑 카드 한 장: 서버 머리글을 오늘 목록의 할 일과 묶은 것. 앱은 무엇을 알릴지 다시 판단하지 않고
 * 목록에 기대는 표시만 고른다
 */
const weatherBriefingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rainy'), todos: z.array(weatherAffectedTodoSchema) }),
  z.object({
    kind: z.literal('stormy'),
    todos: z.array(weatherAffectedTodoSchema),
    range: hourWindowSchema,
  }),
  z.object({ kind: z.literal('snowy'), todos: z.array(weatherAffectedTodoSchema) }),
  z.object({
    kind: z.literal('hot'),
    todos: z.array(weatherAffectedTodoSchema),
    range: hourWindowSchema,
    peakApparentTemperature: z.number(),
  }),
  z.object({
    kind: z.literal('rainLater'),
    todos: z.array(weatherForecastTodoSchema),
    timing: wetTimingSchema,
    isSnow: z.boolean(),
    isOvercast: z.boolean(),
  }),
  z.object({
    kind: z.literal('clear'),
    todos: z.array(weatherForecastTodoSchema),
    range: hourWindowSchema,
    // 맑은 시간대 안에서 지금 이후 첫 예보 칸의 시작. 모두 지났으면 제안하지 않아 null이다
    suggestedStartAt: instantSchema.nullable(),
  }),
  z.object({
    kind: z.literal('tomorrowMorning'),
    temperatureMin: z.number(),
    temperatureMax: z.number(),
    isChilly: z.boolean(),
  }),
  z.object({ kind: z.literal('dry'), todos: z.array(weatherForecastTodoSchema) }),
  z.object({ kind: z.literal('noScheduledTodos') }),
]);
export type WeatherBriefing = z.infer<typeof weatherBriefingSchema>;

interface RescheduleSuggestion {
  reason: WeatherRescheduleReason;
  todoIds: number[];
}

interface WeatherBriefingSource {
  headline: WeatherHeadline;
  reportBriefing: WeatherReportBriefing;
  hourly: readonly ForecastHour[];
  todos: readonly WeatherBriefingTodo[];
  now: Instant;
}

/** 지금 이후로 시각이 정해진 할 일을 그 시각의 예보와 묶는다. 완료 여부는 남기고, 예보 범위 밖이면 뺀다. */
export function createWeatherForecastTodos(
  todos: readonly WeatherBriefingTodo[],
  hourly: readonly ForecastHour[],
  now: Instant,
): WeatherForecastTodo[] {
  return todos.flatMap((todo) => {
    const { localTime, scheduledAt } = todo;
    if (localTime == null || scheduledAt == null || toEpochMs(scheduledAt) < toEpochMs(now)) {
      return [];
    }
    const hour = ForecastHourPolicy.findAt(hourly, scheduledAt);
    if (hour == null) {
      return [];
    }
    return [
      {
        todoId: todo.id,
        title: todo.title,
        localTime,
        scheduledAt,
        completed: todo.completed,
        subTodoProgress: todo.subTodoProgress,
        hour,
      },
    ];
  });
}

/** 서버가 고른 순서(시각 순)대로 오늘 목록의 할 일과 묶는다. 목록에서 사라졌거나 이미 지난 할 일은 뺀다. */
export function createWeatherAffectedTodos(
  reportBriefing: WeatherReportBriefing,
  forecastTodos: readonly WeatherForecastTodo[],
): WeatherAffectedTodo[] {
  const forecastTodosById = keyBy(forecastTodos, (todo) => todo.todoId);
  return reportBriefing.affectedTodoIds.flatMap((todoId) => {
    const todo = forecastTodosById[todoId];
    return todo == null
      ? []
      : [
          {
            ...todo,
            rescheduleOptions: WeatherReportBriefingPolicy.getOptions(reportBriefing, todoId),
          },
        ];
  });
}

/** 서버 머리글이 할 일을 짚었는데 그 할 일이 오늘 목록에 없으면(지웠거나 지났으면) 알릴 날씨가 없는 카드다 */
function createCalmBriefing(todos: WeatherForecastTodo[]): WeatherBriefing {
  return todos.length === 0 ? { kind: 'noScheduledTodos' } : { kind: 'dry', todos };
}

/** 브리핑에서 체크해 완료해도 카드가 바뀌지 않도록 완료한 할 일도 줄로 남긴다 */
export function createWeatherBriefing({
  headline,
  reportBriefing,
  hourly,
  todos,
  now,
}: WeatherBriefingSource): WeatherBriefing {
  const forecastTodos = createWeatherForecastTodos(todos, hourly, now);
  const affectedTodos = createWeatherAffectedTodos(reportBriefing, forecastTodos);
  const hourNow = ForecastHourPolicy.findAt(hourly, now);
  const isOvercast = hourNow != null && ForecastHourPolicy.isOvercast(hourNow);

  return match(headline)
    .returnType<WeatherBriefing>()
    .with({ kind: 'todoWet' }, ({ hazard, window }) => {
      if (affectedTodos.length === 0) {
        return createCalmBriefing(forecastTodos);
      }
      return match(hazard)
        .returnType<WeatherBriefing>()
        .with('storm', () => ({ kind: 'stormy', todos: affectedTodos, range: window }))
        .with('snow', () => ({ kind: 'snowy', todos: affectedTodos }))
        .with('rain', () => ({ kind: 'rainy', todos: affectedTodos }))
        .exhaustive();
    })
    .with({ kind: 'todoHot' }, ({ window, peakApparentTemperature }) =>
      affectedTodos.length === 0
        ? createCalmBriefing(forecastTodos)
        : { kind: 'hot', todos: affectedTodos, range: window, peakApparentTemperature },
    )
    .with({ kind: 'wetLater' }, ({ startsAt, isSnow }) => ({
      kind: 'rainLater',
      todos: forecastTodos,
      timing: { day: 'today', startsAt },
      isSnow,
      isOvercast,
    }))
    .with({ kind: 'wetTomorrow' }, ({ dayPart, isSnow }) => ({
      kind: 'rainLater',
      todos: forecastTodos,
      timing: { day: 'tomorrow', dayPart },
      isSnow,
      isOvercast,
    }))
    .with({ kind: 'clear' }, ({ window }) => ({
      kind: 'clear',
      todos: forecastTodos,
      range: window,
      suggestedStartAt: ForecastHourPolicy.findFirstStartWithin(hourly, window, now),
    }))
    .with({ kind: 'tomorrow' }, ({ temperatureMin, temperatureMax, isChilly }) =>
      forecastTodos.length === 0
        ? { kind: 'tomorrowMorning', temperatureMin, temperatureMax, isChilly }
        : { kind: 'dry', todos: forecastTodos },
    )
    .with({ kind: 'calm' }, () => createCalmBriefing(forecastTodos))
    .exhaustive();
}

function getAffectedTodos(briefing: WeatherBriefing): readonly WeatherAffectedTodo[] {
  return match(briefing)
    .with(
      { kind: 'rainy' },
      { kind: 'stormy' },
      { kind: 'snowy' },
      { kind: 'hot' },
      ({ todos }) => todos,
    )
    .otherwise(() => []);
}

export const WeatherBriefingPolicy = {
  /**
   * 옮기기를 권할 할 일과 이유. 비·뇌우는 비를, 더위는 더위를 피해 옮긴다. 눈은 옮길 시각을 권하지 않고,
   * 완료한 할 일은 옮기지 않아 모두 끝냈으면 권하지 않는다
   */
  findRescheduleSuggestion(briefing: WeatherBriefing): RescheduleSuggestion | null {
    const suggestion = match(briefing)
      .returnType<RescheduleSuggestion | null>()
      .with({ kind: 'rainy' }, { kind: 'stormy' }, ({ todos }) => ({
        reason: 'rain',
        todoIds: todos.filter((todo) => !todo.completed).map((todo) => todo.todoId),
      }))
      .with({ kind: 'hot' }, ({ todos }) => ({
        reason: 'heat',
        todoIds: todos.filter((todo) => !todo.completed).map((todo) => todo.todoId),
      }))
      .otherwise(() => null);
    return suggestion == null || suggestion.todoIds.length === 0 ? null : suggestion;
  },

  /** 그 할 일을 옮길 첫 후보 시각. 서버 후보가 없거나 모두 지났으면 null이다 */
  findNextOptionStart(briefing: WeatherBriefing, todoId: number, now: Instant) {
    const todo = getAffectedTodos(briefing).find((candidate) => candidate.todoId === todoId);
    return (
      todo?.rescheduleOptions.find((option) => filterByUpcomingOption(option, now))?.startsAt ??
      null
    );
  },

  /** 오늘 온다던 비·눈이 이미 내리는가. 서버가 '지금부터'로 알린 시각은 응답 시각이라 지금보다 앞선다 */
  hasWetStarted(briefing: WeatherBriefing, now: Instant) {
    return (
      briefing.kind === 'rainLater' &&
      briefing.timing.day === 'today' &&
      toEpochMs(briefing.timing.startsAt) <= toEpochMs(now)
    );
  },

  /** 맑은 날 가장 좋은 시간대 안에 있는 할 일인가 */
  isTodoInClearWindow(briefing: WeatherBriefing, todo: WeatherForecastTodo) {
    return (
      briefing.kind === 'clear' &&
      toEpochMs(briefing.range.startsAt) <= toEpochMs(todo.scheduledAt) &&
      toEpochMs(todo.scheduledAt) < toEpochMs(briefing.range.endsAt)
    );
  },
};
