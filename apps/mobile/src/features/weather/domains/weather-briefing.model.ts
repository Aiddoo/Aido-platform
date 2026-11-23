import type { WeatherCondition, WeatherDayPart } from '@aido/api/vocabulary';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import { type Todo, TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { HOUR_MS } from '@src/shared/constants/time-units';
import type { DateKey } from '@src/shared/date/date-key';
import { type Instant, toEpochMs } from '@src/shared/date/instant';
import { toZonedInstant, hasSameWallClock } from '@src/shared/date/zoned';
import { keyBy } from 'es-toolkit';
import { match } from 'ts-pattern';

import type {
  HourlyForecastEntry,
  HourWindow,
  RescheduleOption,
  WeatherReport,
  WeatherReportBriefing,
} from './weather-report.model';
import { isNowcastExpired } from './weather-report.model';

const OVERCAST_CONDITIONS: ReadonlySet<WeatherCondition> = new Set([
  'CLOUDY',
  'MOSTLY_CLOUDY',
  'FOGGY',
  'HAZY',
]);

/** 하위 할 일 진행. 하위 할 일이 없으면 null이다. */
type BriefingSubTodoProgress = { completed: number; total: number } | null;

/** 할 일 피처의 모델에 기대지 않도록 브리핑에 필요한 값만 받는다. 시간이 없거나 종일이면 시각이 둘 다 null이다. */
export interface BriefingTodo {
  id: number;
  title: string;
  /** 보이는 시각(벽시계 HH:mm). 어디서든 그 시각이다 */
  localTime: string | null;
  /** 예보 칸을 찾는 순간. 서머타임으로 없는 시각이면 전환 뒤로 밀려 localTime과 다를 수 있다 */
  scheduledAt: Instant | null;
  completed: boolean;
  subTodoProgress: BriefingSubTodoProgress;
}

/** 여러 날 할 일은 시작일이 어제여도 오늘 목록에 있어 보고 있는 날짜 + 벽시계 + 기기 시간대로 시각을 만든다 */
function toBriefingTodo(
  todo: Todo,
  { date, timezone }: { date: DateKey; timezone: string },
): BriefingTodo {
  const localTime = TodoPolicy.findLocalTime(todo, timezone);
  return {
    id: todo.id,
    title: todo.title,
    localTime,
    scheduledAt: localTime == null ? null : toZonedInstant({ date, time: localTime, timezone }),
    completed: todo.completed,
    subTodoProgress: SubTodoPolicy.hasSubTodos(todo.subTodos)
      ? SubTodoPolicy.getSubTodoStats(todo.subTodos)
      : null,
  };
}

export interface ForecastTodo {
  todoId: number;
  title: string;
  localTime: string;
  scheduledAt: Instant;
  /** 브리핑에서 체크해도 줄이 사라지지 않도록 완료한 할 일도 남긴다. 옮기기 대상에서는 뺀다. */
  completed: boolean;
  subTodoProgress: BriefingSubTodoProgress;
  hour: HourlyForecastEntry;
}

/** 서버가 날씨와 겹친다고 본 할 일. 옮길 시각 후보도 서버가 고른 것이다. */
export interface AffectedTodo extends ForecastTodo {
  rescheduleOptions: RescheduleOption[];
}

/** 비·눈이 언제 시작하는지. 오늘은 시각, 내일은 하루 구분(일별 확률로만 알면 null)이다 */
type RainTiming =
  | { day: 'today'; startsAt: Instant }
  | { day: 'tomorrow'; dayPart: WeatherDayPart | null };

export type BriefingResult =
  | { kind: 'rainy'; todos: AffectedTodo[] }
  | { kind: 'stormy'; todos: AffectedTodo[]; range: HourWindow }
  | { kind: 'snowy'; todos: AffectedTodo[] }
  | { kind: 'hot'; todos: AffectedTodo[]; range: HourWindow; peakApparentTemperature: number }
  | {
      kind: 'rainLater';
      todos: ForecastTodo[];
      timing: RainTiming;
      isSnow: boolean;
      isOvercast: boolean;
    }
  | { kind: 'clear'; todos: ForecastTodo[]; range: HourWindow }
  | { kind: 'tomorrowMorning'; temperatureMin: number; temperatureMax: number; isChilly: boolean }
  | { kind: 'dry'; todos: ForecastTodo[] }
  | { kind: 'noScheduledTodos' };

type BriefingSource = Pick<WeatherReport, 'hourly' | 'briefing' | 'headline'>;

// findIndex처럼 그 시각을 담은 시간이 없으면 -1이다
function getHourIndexAt(hourly: readonly HourlyForecastEntry[], at: Instant): number {
  const time = toEpochMs(at);
  return hourly.findIndex((hour) => {
    const startsAt = toEpochMs(hour.startsAt);
    return startsAt <= time && time < startsAt + HOUR_MS;
  });
}

/** 지금 이후로 시각이 정해진 할 일을 그 시각의 예보와 묶는다. 완료 여부는 남기고, 예보 범위 밖이면 뺀다. */
function getForecastTodos(
  hourly: readonly HourlyForecastEntry[],
  todos: readonly BriefingTodo[],
  now: Instant,
): ForecastTodo[] {
  return todos.flatMap((todo) => {
    const { localTime, scheduledAt } = todo;
    if (localTime == null || scheduledAt == null || toEpochMs(scheduledAt) < toEpochMs(now)) {
      return [];
    }
    const hour = hourly[getHourIndexAt(hourly, scheduledAt)];
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
function getAffectedTodos(
  briefing: WeatherReportBriefing,
  forecastTodos: readonly ForecastTodo[],
): AffectedTodo[] {
  const forecastTodosById = keyBy(forecastTodos, (todo) => todo.todoId);
  const optionsByTodoId = keyBy(briefing.rescheduleOptions, (entry) => entry.todoId);
  return briefing.affectedTodoIds.flatMap((todoId) => {
    const todo = forecastTodosById[todoId];
    return todo == null
      ? []
      : [{ ...todo, rescheduleOptions: optionsByTodoId[todoId]?.options ?? [] }];
  });
}

function isOvercastNow(hourly: readonly HourlyForecastEntry[], now: Instant): boolean {
  const current = hourly[getHourIndexAt(hourly, now)];
  return current != null && OVERCAST_CONDITIONS.has(current.condition);
}

/** 서버 머리글이 할 일을 짚었는데 그 할 일이 오늘 목록에 없으면(지웠거나 지났으면) 알릴 날씨가 없는 카드다 */
function toCalmBriefing(todos: ForecastTodo[]): BriefingResult {
  return todos.length === 0 ? { kind: 'noScheduledTodos' } : { kind: 'dry', todos };
}

/**
 * 서버 머리글(날씨 알림과 같은 판단)을 오늘 목록의 할 일과 묶는다. 앱은 무엇을 알릴지 다시 판단하지 않고
 * 목록에 기대는 표시만 고른다. 브리핑에서 체크해 완료해도 카드가 바뀌지 않도록 완료한 할 일도 줄로 남긴다.
 * 서버가 판단하지 못한 리포트(오늘 할 일 읽기 실패)는 null이다.
 */
export function findWeatherBriefing(
  report: BriefingSource,
  todos: readonly BriefingTodo[],
  { now }: { now: Instant },
): BriefingResult | null {
  const { hourly, briefing, headline } = report;
  if (briefing == null || headline == null) {
    return null;
  }
  const forecastTodos = getForecastTodos(hourly, todos, now);
  const affectedTodos = getAffectedTodos(briefing, forecastTodos);
  const isOvercast = isOvercastNow(hourly, now);

  return match(headline)
    .returnType<BriefingResult>()
    .with({ kind: 'todoWet' }, ({ hazard, window }) => {
      if (affectedTodos.length === 0) {
        return toCalmBriefing(forecastTodos);
      }
      return match(hazard)
        .returnType<BriefingResult>()
        .with('storm', () => ({ kind: 'stormy', todos: affectedTodos, range: window }))
        .with('snow', () => ({ kind: 'snowy', todos: affectedTodos }))
        .with('rain', () => ({ kind: 'rainy', todos: affectedTodos }))
        .exhaustive();
    })
    .with({ kind: 'todoHot' }, ({ window, peakApparentTemperature }) =>
      affectedTodos.length === 0
        ? toCalmBriefing(forecastTodos)
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
    }))
    .with({ kind: 'tomorrow' }, ({ temperatureMin, temperatureMax, isChilly }) =>
      forecastTodos.length === 0
        ? { kind: 'tomorrowMorning', temperatureMin, temperatureMax, isChilly }
        : { kind: 'dry', todos: forecastTodos },
    )
    .with({ kind: 'calm' }, () => toCalmBriefing(forecastTodos))
    .exhaustive();
}

/** 추천 시간대 안에서 지금 이후 첫 시간별 예보의 시작 시각. 30분 단위 시간대도 예보 칸에 맞는다. 모두 지났으면 제안하지 않는다. */
function findSuggestedStartAt(
  range: HourWindow,
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

type BriefingState = 'loading' | 'hidden' | 'visible';

// 브리핑 카드는 예보의 브리핑 칸만 구독해 Policy 밖 함수로 두고 필요한 칸만 받는다
export function getBriefingState(
  report: Pick<WeatherReport, 'location' | 'fetchedAt'> | undefined,
  { now, deviceTimezone }: { now: Instant; deviceTimezone: string },
): BriefingState {
  if (report == null) {
    return 'loading';
  }
  if (
    isNowcastExpired(report, now) ||
    !hasSameWallClock(now, report.location.timezone, deviceTimezone)
  ) {
    return 'hidden';
  }
  return 'visible';
}

function isTodoWithinRange(todo: ForecastTodo, range: HourWindow): boolean {
  return (
    toEpochMs(range.startsAt) <= toEpochMs(todo.scheduledAt) &&
    toEpochMs(todo.scheduledAt) < toEpochMs(range.endsAt)
  );
}

function getUncompletedTodoIds(todos: readonly ForecastTodo[]) {
  return todos.filter((todo) => !todo.completed).map((todo) => todo.todoId);
}

export const WeatherBriefingPolicy = {
  isTodoWithinRange,
  getUncompletedTodoIds,
  toBriefingTodo,
  findSuggestedStartAt,
  getForecastTodos,
  getAffectedTodos,
} as const;
