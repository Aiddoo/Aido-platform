import type { WeatherHourlyForecast } from '@aido/api';
import { fromEpochMs, toInstant } from '@src/shared/date/instant';

import {
  createHourlyForecastDto,
  createHourlySeries,
  createWeatherReport,
} from '../__tests__/weather-report.fixtures';
import type { BriefingTodo } from './weather-briefing.model';
import { WeatherReschedulePolicy } from './weather-reschedule.model';

/** 서울 15:26. 16~18시(07:00Z~09:00Z) 비, 나머지는 맑다. */
const NOW = toInstant('2026-11-02T06:26:00.000Z');
const { hourly } = createWeatherReport({
  hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]),
});

/** 15시(06:00Z)부터 1시간 간격 예보. 각 항목이 그 시간의 값을 덮어쓴다. */
function createReport(hours: readonly Partial<WeatherHourlyForecast>[]) {
  const start = Date.parse('2026-11-02T06:00:00.000Z');
  return createWeatherReport({
    hourly: hours.map((hour, index) =>
      createHourlyForecastDto({
        startsAt: fromEpochMs(start + index * 60 * 60_000),
        ...hour,
      }),
    ),
  });
}

function createTodo(overrides: Partial<BriefingTodo> = {}): BriefingTodo {
  return {
    id: 1,
    title: '산책',
    scheduledAt: toInstant('2026-11-02T07:30:00.000Z'),
    completed: false,
    subTodoProgress: null,
    ...overrides,
  };
}

describe('getAffectedTodos', () => {
  it('비를 피할 때는 비 오는 시간에 걸린 미완료 할 일만 고른다', () => {
    // Given
    const todos = [
      createTodo({ id: 1, scheduledAt: toInstant('2026-11-02T07:30:00.000Z') }),
      createTodo({ id: 2, scheduledAt: toInstant('2026-11-02T10:30:00.000Z') }),
    ];

    // When
    const affected = WeatherReschedulePolicy.getAffectedTodos(hourly, todos, {
      now: NOW,
      reason: 'rain',
    });

    // Then
    expect(affected.map((todo) => todo.todoId)).toEqual([1]);
  });

  it('비와 겹친 할 일을 끝냈으면 옮길 할 일에서 뺀다', () => {
    // Given
    const todos = [
      createTodo({
        id: 1,
        scheduledAt: toInstant('2026-11-02T07:30:00.000Z'),
        completed: true,
      }),
    ];

    // When
    const affected = WeatherReschedulePolicy.getAffectedTodos(hourly, todos, {
      now: NOW,
      reason: 'rain',
    });

    // Then
    expect(affected).toEqual([]);
  });

  it('더위를 피할 때는 체감 온도가 높은 낮 시간에 걸린 미완료 할 일만 고른다', () => {
    // Given
    const hotHours = createReport([
      { apparentTemperature: 28 },
      { apparentTemperature: 36 },
      { apparentTemperature: 28 },
    ]).hourly;
    const todos = [
      createTodo({ id: 1, scheduledAt: toInstant('2026-11-02T07:30:00.000Z') }),
      createTodo({ id: 2, scheduledAt: toInstant('2026-11-02T08:30:00.000Z') }),
    ];

    // When
    const affected = WeatherReschedulePolicy.getAffectedTodos(hotHours, todos, {
      now: NOW,
      reason: 'heat',
    });

    // Then
    expect(affected.map((todo) => todo.todoId)).toEqual([1]);
  });
});

describe('getRescheduleOptions', () => {
  it('같은 날 지금 이후의 맑은 정시를 강수 확률이 낮고 원래 시각에 가까운 순으로 고르고 첫 번째를 추천한다', () => {
    // When
    const options = WeatherReschedulePolicy.getRescheduleOptions(
      hourly,
      { scheduledAt: toInstant('2026-11-02T07:30:00.000Z') },
      { now: NOW, timeZone: 'Asia/Seoul' },
    );

    // Then
    expect(options.map((option) => option.startsAt)).toEqual([
      '2026-11-02T10:00:00.000Z',
      '2026-11-02T12:00:00.000Z',
      '2026-11-02T13:00:00.000Z',
      '2026-11-02T09:00:00.000Z',
    ]);
    expect(options.map((option) => option.isRecommended)).toEqual([true, false, false, false]);
  });

  it('남은 시간이 모두 비면 옮길 시간이 없다', () => {
    // Given
    const { hourly: rainyHours } = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 80, 80]),
    });

    // When
    const options = WeatherReschedulePolicy.getRescheduleOptions(
      rainyHours,
      { scheduledAt: toInstant('2026-11-02T07:30:00.000Z') },
      { now: NOW, timeZone: 'Asia/Seoul' },
    );

    // Then
    expect(options).toEqual([]);
  });

  it('기기 시간대의 자정을 넘는 시간은 다른 날이라 후보에서 뺀다', () => {
    // Given
    const { hourly: lateHours } = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T13:00:00.000Z', [80, 10, 10]),
    });

    // When
    const options = WeatherReschedulePolicy.getRescheduleOptions(
      lateHours,
      { scheduledAt: toInstant('2026-11-02T13:30:00.000Z') },
      { now: toInstant('2026-11-02T13:10:00.000Z'), timeZone: 'Asia/Seoul' },
    );

    // Then
    expect(options.map((option) => option.startsAt)).toEqual(['2026-11-02T14:00:00.000Z']);
  });

  it('더위를 피할 때는 덥지 않은 같은 날 시간을 원래 시각과 가까운 순으로 고른다', () => {
    // Given
    const hotHours = createReport([
      { apparentTemperature: 34 },
      { apparentTemperature: 36 },
      { apparentTemperature: 36 },
      { apparentTemperature: 28 },
      { apparentTemperature: 28 },
      { apparentTemperature: 28, isDaylight: false },
    ]).hourly;

    // When
    const options = WeatherReschedulePolicy.getRescheduleOptions(
      hotHours,
      { scheduledAt: toInstant('2026-11-02T07:30:00.000Z') },
      { now: NOW, timeZone: 'Asia/Seoul', reason: 'heat' },
    );

    // Then
    // 16~17시 체감 36°가 빠지고 원래 시각(16:30)에 가까운 18시·19시·20시 순이다
    expect(options.map((option) => option.startsAt)).toEqual([
      '2026-11-02T09:00:00.000Z',
      '2026-11-02T10:00:00.000Z',
      '2026-11-02T11:00:00.000Z',
    ]);
  });
});

describe('getMovedScheduleInput', () => {
  it('옮길 때는 날짜를 그대로 두고 기기 시간대의 시각만 바꾼다', () => {
    // Given
    const startsAt = toInstant(new Date(2026, 10, 2, 19, 0).toISOString());

    // When
    const input = WeatherReschedulePolicy.getMovedScheduleInput(
      { startDate: '2026-11-02', endDate: null },
      startsAt,
      'Asia/Seoul',
    );

    // Then
    expect(input).toEqual({
      startDate: '2026-11-02',
      endDate: null,
      scheduledTime: '19:00',
      isAllDay: false,
    });
  });
});

describe('getOriginalScheduleInput', () => {
  it('되돌릴 때는 원래 날짜와 시각을 그대로 되돌린다', () => {
    // Given
    const todo = {
      startDate: '2026-11-02',
      endDate: '2026-11-03',
      localTime: '16:30',
      isAllDay: false,
    };

    // When
    const input = WeatherReschedulePolicy.getOriginalScheduleInput(todo);

    // Then
    expect(input).toEqual({
      startDate: '2026-11-02',
      endDate: '2026-11-03',
      scheduledTime: '16:30',
      isAllDay: false,
    });
  });

  it('종일이었다면 시각 없이 종일로 되돌린다', () => {
    // Given
    const todo = { startDate: '2026-11-02', endDate: null, localTime: '16:30', isAllDay: true };

    // When
    const input = WeatherReschedulePolicy.getOriginalScheduleInput(todo);

    // Then
    expect(input).toMatchObject({ scheduledTime: null, isAllDay: true });
  });
});

describe('getRescheduleTargets', () => {
  const changes = [
    { todoId: 12, startsAt: toInstant('2026-11-02T10:00:00.000Z') },
    { todoId: 15, startsAt: toInstant('2026-11-02T12:00:00.000Z') },
  ];

  it('시트를 연 사이 지워진 할 일은 옮기지 않는다', () => {
    // Given: 15번은 목록에서 사라졌다
    const todos = [{ id: 12, completed: false }];

    // When
    const targets = WeatherReschedulePolicy.getRescheduleTargets(changes, todos);

    // Then
    expect(targets).toEqual([{ todo: todos[0], startsAt: toInstant('2026-11-02T10:00:00.000Z') }]);
  });

  it('시트를 연 사이 완료한 할 일은 옮기지 않는다', () => {
    // Given
    const todos = [
      { id: 12, completed: true },
      { id: 15, completed: false },
    ];

    // When
    const targets = WeatherReschedulePolicy.getRescheduleTargets(changes, todos);

    // Then
    expect(targets.map(({ todo }) => todo.id)).toEqual([15]);
  });

  it('자정이 지나 오늘 목록에 없는 할 일만 남았으면 옮길 것이 없다', () => {
    // When
    const targets = WeatherReschedulePolicy.getRescheduleTargets(changes, [
      { id: 99, completed: false },
    ]);

    // Then
    expect(targets).toEqual([]);
  });
});
