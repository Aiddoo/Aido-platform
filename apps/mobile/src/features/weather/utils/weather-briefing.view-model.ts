import type {
  WeatherCondition,
  WeatherPrecipitationType,
  WeatherRescheduleReason,
} from '@aido/api/vocabulary';
import { type Instant } from '@src/shared/date/instant';
import type { ParseKeys } from 'i18next';
import { match } from 'ts-pattern';

import type { BriefingRowTone } from '../constants/weather-colors.constants';
import { WEATHER_CONDITION_LABEL_KEYS } from '../constants/weather-labels';
import {
  type AffectedTodo,
  type BriefingResult,
  type ForecastTodo,
  type HourRange,
  WeatherBriefingPolicy,
} from '../domains/weather-briefing.model';
import type { HourlyForecastEntry } from '../domains/weather-report.model';
import { WeatherReschedulePolicy } from '../domains/weather-reschedule.model';

/** 강수 형태를 아이콘이 그릴 상태로 바꾼다. 얼어 내리면 눈, 그 밖에는 비로 그린다. */
function toPrecipitationCondition(type: WeatherPrecipitationType): WeatherCondition {
  return match(type)
    .with('SNOW', 'SLEET', 'HAIL', () => 'SNOW' as const)
    .with('RAIN', 'MIXED', 'NONE', () => 'RAIN' as const)
    .exhaustive();
}

/** 화면 문구 한 줄. 컴포넌트가 번역하며, 값에 다른 문구를 넣으면 그 문구도 번역해 넣는다. */
export interface BriefingCopy {
  key: ParseKeys<'weather'>;
  values?: Record<string, string | number | BriefingCopy>;
}

export interface BriefingRow {
  todo: ForecastTodo;
  advice: BriefingCopy;
  tone: BriefingRowTone;
  chipCondition: WeatherCondition;
  chipLabel: string;
}

/** 날씨에 맞춰 제안하는 할 일의 계기. Analytics 값으로도 쓴다. */
export type TodoSuggestionReason = 'rain_later' | 'clear';

export type BriefingAction =
  | { kind: 'reschedule'; reason: WeatherRescheduleReason; label: BriefingCopy; todoIds: number[] }
  | {
      kind: 'suggestTodo';
      reason: TodoSuggestionReason;
      label: BriefingCopy;
      title: BriefingCopy;
      scheduledAt: Instant | null;
    };

export interface BriefingView {
  headline: BriefingCopy;
  body: BriefingCopy;
  rows: BriefingRow[];
  action: BriefingAction | null;
  mascotCondition: WeatherCondition;
}

/** 시각·기온 글자는 화면의 시간 형식·온도 단위를 따르므로 바깥에서 받는다. 시각은 할 일과 같은 기기 시간대다. */
export interface BriefingViewDeps {
  hourly: readonly HourlyForecastEntry[];
  now: Instant;
  formatClock: (date: Instant) => string;
  formatHour: (date: Instant) => string;
  formatTemperature: (celsius: number) => string;
  formatChance: (percent: number) => string;
}

export function toBriefingView(briefing: BriefingResult, deps: BriefingViewDeps): BriefingView {
  const { hourly, now, formatClock, formatHour, formatTemperature, formatChance } = deps;
  const range = (hours: HourRange): BriefingCopy => ({
    key: 'briefing.range',
    values: { start: formatHour(hours.startsAt), end: formatHour(hours.endsAt) },
  });
  const chance = (todo: ForecastTodo) => formatChance(todo.hour.precipitationChance);
  const firstOption = (todo: AffectedTodo) =>
    WeatherReschedulePolicy.getUpcomingOptions(todo.rescheduleOptions, now)[0]?.startsAt ?? null;
  /** 완료한 할 일은 옮기지 않는다. 모두 완료했으면 옮길 버튼을 감춘다. */
  const reschedule = (
    todos: ForecastTodo[],
    reason: WeatherRescheduleReason,
    label: BriefingCopy,
  ): BriefingAction | null => {
    const todoIds = WeatherBriefingPolicy.getUncompletedTodoIds(todos);
    return todoIds.length === 0 ? null : { kind: 'reschedule', reason, label, todoIds };
  };

  return match(briefing)
    .returnType<BriefingView>()
    .with({ kind: 'rainy' }, ({ todos }): BriefingView => {
      const [first, ...rest] = todos;
      return {
        headline:
          rest.length === 0 && first != null
            ? { key: 'briefing.rainyOne', values: { title: first.title } }
            : { key: 'briefing.rainyMany', values: { count: todos.length } },
        body: { key: 'briefing.rainyBody' },
        rows: todos.map((todo): BriefingRow => {
          const dryHour = firstOption(todo);
          return {
            todo,
            advice:
              dryHour == null
                ? { key: 'briefing.noDryTime' }
                : { key: 'briefing.dryAt', values: { time: formatClock(dryHour) } },
            tone: 'warning',
            chipCondition: toPrecipitationCondition(todo.hour.precipitationType),
            chipLabel: chance(todo),
          };
        }),
        action: reschedule(todos, 'rain', { key: 'briefing.reschedule' }),
        mascotCondition: 'RAIN',
      };
    })
    .with({ kind: 'stormy' }, ({ todos, range: hours }): BriefingView => ({
      headline: { key: 'briefing.stormy.title' },
      body: { key: 'briefing.stormy.body', values: { range: range(hours) } },
      rows: todos.map((todo): BriefingRow => ({
        todo,
        advice: { key: 'briefing.stormy.advice' },
        tone: 'warning',
        chipCondition: 'THUNDERSTORMS',
        chipLabel: chance(todo),
      })),
      action: reschedule(todos, 'rain', { key: 'briefing.stormy.action' }),
      mascotCondition: 'THUNDERSTORMS',
    }))
    .with({ kind: 'snowy' }, ({ todos }): BriefingView => {
      const [first] = todos;
      return {
        headline: { key: 'briefing.snowy.title' },
        body: {
          key: 'briefing.snowy.body',
          values: { time: first == null ? '' : formatClock(first.scheduledAt) },
        },
        rows: todos.map((todo): BriefingRow => ({
          todo,
          advice: { key: 'briefing.snowy.advice' },
          tone: 'warning',
          chipCondition: 'SNOW',
          chipLabel: formatTemperature(todo.hour.temperature),
        })),
        action: null,
        mascotCondition: 'SNOW',
      };
    })
    .with({ kind: 'hot' }, ({ todos, range: hours, peakApparentTemperature }): BriefingView => {
      const [first] = todos;
      const coolHour = first == null ? null : firstOption(first);
      const peak = formatTemperature(peakApparentTemperature);
      return {
        headline: { key: 'briefing.hot.title' },
        body:
          coolHour == null
            ? {
                key: 'briefing.hot.bodyNoCoolTime',
                values: { range: range(hours), temperature: peak },
              }
            : {
                key: 'briefing.hot.body',
                values: { range: range(hours), temperature: peak, time: formatHour(coolHour) },
              },
        rows: todos.map((todo): BriefingRow => {
          const cool = firstOption(todo);
          return {
            todo,
            advice:
              cool == null
                ? { key: 'briefing.hot.noCoolTime' }
                : { key: 'briefing.hot.coolAt', values: { time: formatHour(cool) } },
            tone: 'heat',
            chipCondition: 'CLEAR',
            chipLabel: formatTemperature(todo.hour.apparentTemperature),
          };
        }),
        action: reschedule(todos, 'heat', { key: 'briefing.hot.action' }),
        mascotCondition: 'HOT',
      };
    })
    .with(
      { kind: 'rainLater' },
      ({ todos, startsAt, day, dayPart, isSnow, isOvercast }): BriefingView => {
        const dayPartLabel: BriefingCopy = { key: `briefing.dayPart.${dayPart}` };
        return {
          headline: {
            key: isOvercast ? 'briefing.rainLater.titleGray' : 'briefing.rainLater.title',
          },
          body: match({ day, isSnow })
            .returnType<BriefingCopy>()
            .with({ day: 'today' }, () => ({
              key: 'briefing.rainLater.todayBody',
              values: { time: formatHour(startsAt) },
            }))
            .with({ day: 'tomorrow', isSnow: true }, () => ({
              key: 'briefing.rainLater.tomorrowSnowBody',
              values: { dayPart: dayPartLabel },
            }))
            .with({ day: 'tomorrow', isSnow: false }, () => ({
              key: 'briefing.rainLater.tomorrowRainBody',
              values: { dayPart: dayPartLabel },
            }))
            .exhaustive(),
          rows: todos.map((todo): BriefingRow => ({
            todo,
            advice: {
              key:
                day === 'today'
                  ? 'briefing.rainLater.beforeRain'
                  : 'briefing.rainLater.beforeTomorrowRain',
            },
            tone: 'calm',
            chipCondition: todo.hour.condition,
            chipLabel: formatTemperature(todo.hour.temperature),
          })),
          action:
            day === 'tomorrow'
              ? {
                  kind: 'suggestTodo',
                  reason: 'rain_later',
                  label: { key: 'briefing.rainLater.action' },
                  title: { key: 'briefing.rainLater.suggestion' },
                  scheduledAt: null,
                }
              : null,
          mascotCondition: 'CLOUDY',
        };
      },
    )
    .with({ kind: 'clear' }, ({ todos, range: hours }): BriefingView => {
      const suggestedAt = WeatherBriefingPolicy.getSuggestedStartAt(hours, hourly, now);
      const isInRange = (todo: ForecastTodo) =>
        WeatherBriefingPolicy.isTodoWithinRange(todo, hours);
      const isEmpty = todos.length === 0;
      return {
        headline: { key: isEmpty ? 'briefing.clear.emptyTitle' : 'briefing.clear.title' },
        body: {
          key: isEmpty ? 'briefing.clear.emptyBody' : 'briefing.clear.body',
          values: { range: range(hours) },
        },
        rows: todos.map((todo): BriefingRow => ({
          todo,
          advice: { key: isInRange(todo) ? 'briefing.clear.bestTime' : 'briefing.clear.noRain' },
          tone: isInRange(todo) ? 'good' : 'neutral',
          chipCondition: todo.hour.condition,
          chipLabel: formatTemperature(todo.hour.temperature),
        })),
        action:
          suggestedAt == null
            ? null
            : {
                kind: 'suggestTodo',
                reason: 'clear',
                label: { key: 'briefing.clear.action', values: { time: formatHour(suggestedAt) } },
                title: { key: 'briefing.clear.suggestion' },
                scheduledAt: suggestedAt,
              },
        mascotCondition: 'CLEAR',
      };
    })
    .with(
      { kind: 'tomorrowMorning' },
      ({ temperatureMin, temperatureMax, isChilly }): BriefingView => ({
        headline: {
          key: isChilly ? 'briefing.tomorrowMorning.chillyTitle' : 'briefing.tomorrowMorning.title',
          values: { temperature: formatTemperature(temperatureMin) },
        },
        body: {
          key: isChilly ? 'briefing.tomorrowMorning.chillyBody' : 'briefing.tomorrowMorning.body',
          values: { temperature: formatTemperature(temperatureMax) },
        },
        rows: [],
        action: null,
        mascotCondition: 'CLEAR',
      }),
    )
    .with({ kind: 'dry' }, ({ todos }): BriefingView => ({
      headline: { key: 'briefing.dry' },
      body: { key: 'briefing.dryBody' },
      rows: todos.map((todo): BriefingRow => ({
        todo,
        advice: { key: WEATHER_CONDITION_LABEL_KEYS[todo.hour.condition] },
        tone: 'neutral',
        chipCondition: todo.hour.condition,
        chipLabel: formatTemperature(todo.hour.temperature),
      })),
      action: null,
      mascotCondition: 'CLOUDY',
    }))
    .with({ kind: 'noScheduledTodos' }, (): BriefingView => ({
      headline: { key: 'briefing.noScheduledTodos' },
      body: { key: 'briefing.noScheduledTodosBody' },
      rows: [],
      action: null,
      mascotCondition: 'CLOUDY',
    }))
    .exhaustive();
}
