import { fromEpochMs, toInstant } from '@src/shared/date/instant';
import { range } from 'es-toolkit';

import {
  createBriefingTodo,
  createHourlySeries,
  createWeatherReport,
  createWeatherReportDto,
  createWeatherReportWithHours,
} from '../__tests__/weather-report.fixtures';
import { WeatherBriefingPolicy } from './weather-briefing.model';

/** 서울 15:26. 16~18시(07:00Z~09:00Z) 비, 나머지는 맑다. */
const NOW = toInstant('2026-11-02T06:26:00.000Z');
const CLOCK = { now: NOW, timeZone: 'Asia/Seoul' };
const report = createWeatherReport({
  hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]),
});

const DRY_HOURS = range(9).map(() => ({ precipitationChance: 10 }));

describe('getWeatherBriefing', () => {
  it('비 소식도 할 일도 없으면 브리핑할 할 일이 없다고 알린다', () => {
    // Given
    const dryReport = createWeatherReportWithHours(DRY_HOURS);

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(dryReport, [], CLOCK);

    // Then
    expect(briefing).toEqual({ kind: 'noScheduledTodos' });
  });

  it('종일·시간 없는 할 일만 있으면 비와 겹치는지 판단하지 않는다', () => {
    // Given
    const dryReport = createWeatherReportWithHours(DRY_HOURS);
    const unscheduledTodo = createBriefingTodo({ scheduledAt: null });

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(dryReport, [unscheduledTodo], CLOCK);

    // Then
    expect(briefing).toEqual({ kind: 'noScheduledTodos' });
  });

  it('할 일 하나가 비 오는 시간에 걸리면 그 할 일과 그 시간의 예보를 돌려준다', () => {
    // Given
    const walkTodo = createBriefingTodo();

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(report, [walkTodo], CLOCK);

    // Then
    expect(briefing.kind).toBe('rainy');
    expect(briefing.kind === 'rainy' && briefing.todos).toEqual([
      expect.objectContaining({
        todoId: 1,
        title: '산책',
        scheduledAt: toInstant('2026-11-02T07:30:00.000Z'),
        hour: expect.objectContaining({ precipitationChance: 70, precipitationType: 'RAIN' }),
      }),
    ]);
  });

  it('할 일 7개 중 비 오는 시간에 걸린 것만 고르고, 지난 할 일은 빼며 끝낸 할 일은 완료 표시로 남긴다', () => {
    // Given
    // 14:30부터 1시간 간격 할 일 7개, 세 번째는 끝냈다
    const todos = range(7).map((index) =>
      createBriefingTodo({
        id: index + 1,
        scheduledAt: fromEpochMs(Date.parse('2026-11-02T05:30:00.000Z') + index * 60 * 60_000),
        completed: index === 2,
      }),
    );

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(report, todos, CLOCK);

    // Then
    expect(
      briefing.kind === 'rainy' &&
        briefing.todos.map(({ todoId, completed }) => ({ todoId, completed })),
    ).toEqual([
      { todoId: 3, completed: true },
      { todoId: 4, completed: false },
    ]);
  });

  it('비와 겹친 할 일을 끝내도 브리핑은 그대로 둔다', () => {
    // Given
    const todos = [
      createBriefingTodo({
        id: 1,
        scheduledAt: toInstant('2026-11-02T07:30:00.000Z'),
        completed: true,
      }),
    ];

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(report, todos, CLOCK);

    // Then
    expect(briefing.kind).toBe('rainy');
  });

  it('할 일이 뇌우 시간에 걸리면 이어지는 뇌우 시간대와 함께 낙뢰를 알린다', () => {
    // Given
    // 16~18시 뇌우, 16:30 할 일
    const thunder = {
      condition: 'THUNDERSTORMS',
      precipitationChance: 90,
      precipitationType: 'RAIN',
    } as const;
    const stormReport = createWeatherReportWithHours([
      { precipitationChance: 10 },
      thunder,
      thunder,
      thunder,
      { precipitationChance: 10 },
    ]);

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(
      stormReport,
      [createBriefingTodo()],
      CLOCK,
    );

    // Then
    expect(briefing.kind).toBe('stormy');
    expect(briefing.kind === 'stormy' && briefing.range).toEqual({
      startsAt: toInstant('2026-11-02T07:00:00.000Z'),
      endsAt: toInstant('2026-11-02T10:00:00.000Z'),
    });
  });

  it('겹친 시간이 모두 눈이면 이동이 늦어진다고 알린다', () => {
    // Given
    const snowReport = createWeatherReportWithHours([
      { precipitationChance: 10 },
      { condition: 'SNOW', precipitationChance: 90, precipitationType: 'SNOW' },
    ]);

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(
      snowReport,
      [createBriefingTodo()],
      CLOCK,
    );

    // Then
    expect(briefing.kind).toBe('snowy');
  });

  it('할 일이 체감 33° 이상인 낮 시간에 걸리면 더위 시간대와 가장 높은 체감 온도를 알린다', () => {
    // Given
    // 16~17시 체감 35°·39°, 16:30 할 일
    const hotReport = createWeatherReportWithHours([
      { apparentTemperature: 31 },
      { apparentTemperature: 35 },
      { apparentTemperature: 39 },
      { apparentTemperature: 30 },
    ]);

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(
      hotReport,
      [createBriefingTodo()],
      CLOCK,
    );

    // Then
    expect(briefing).toEqual(
      expect.objectContaining({
        kind: 'hot',
        range: {
          startsAt: toInstant('2026-11-02T07:00:00.000Z'),
          endsAt: toInstant('2026-11-02T09:00:00.000Z'),
        },
        peakApparentTemperature: 39,
      }),
    );
  });

  it('지금은 비가 안 오고 내일 오후에 비가 시작되면 내일 오후부터 비가 온다고 알린다', () => {
    // Given
    // 오늘 남은 시간은 흐리고 비가 없고, 내일 13시(04:00Z)에 비가 온다
    const hours = [
      ...range(22).map(() => ({ condition: 'CLOUDY', precipitationChance: 10 }) as const),
      { precipitationChance: 80, precipitationType: 'RAIN' } as const,
    ];

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(
      createWeatherReportWithHours(hours),
      [],
      CLOCK,
    );

    // Then
    expect(briefing).toEqual(
      expect.objectContaining({
        kind: 'rainLater',
        startsAt: toInstant('2026-11-03T04:00:00.000Z'),
        day: 'tomorrow',
        dayPart: 'afternoon',
        isSnow: false,
        isOvercast: true,
      }),
    );
  });

  it('모레 비는 알리지 않고 남은 할 일을 날씨 걱정 없는 목록으로 보여 준다', () => {
    // Given
    // 오늘·내일은 비가 없고 모레부터 비가 온다
    const hours = [
      ...range(40).map(() => ({ precipitationChance: 10 })),
      { precipitationChance: 80, precipitationType: 'RAIN' } as const,
    ];
    const lateTodo = createBriefingTodo({ scheduledAt: toInstant('2026-11-02T13:30:00.000Z') });

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(
      createWeatherReportWithHours(hours),
      [lateTodo],
      CLOCK,
    );

    // Then
    expect(briefing.kind).toBe('dry');
    expect(briefing.kind === 'dry' && briefing.todos.map((todo) => todo.todoId)).toEqual([1]);
  });

  it('오늘 남은 낮이 맑으면 가장 따뜻한 시간대를 야외 할 일 하기 좋은 때로 알린다', () => {
    // Given
    // 15~17시 맑음 체감 16·17·17°, 18시부터 밤
    const clearReport = createWeatherReportWithHours([
      { condition: 'CLEAR', apparentTemperature: 16 },
      { condition: 'CLEAR', apparentTemperature: 17 },
      { condition: 'CLEAR', apparentTemperature: 17 },
      { condition: 'CLEAR', apparentTemperature: 14, isDaylight: false },
    ]);

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(clearReport, [], CLOCK);

    // Then
    expect(briefing).toEqual({
      kind: 'clear',
      todos: [],
      range: {
        startsAt: toInstant('2026-11-02T06:00:00.000Z'),
        endsAt: toInstant('2026-11-02T09:00:00.000Z'),
      },
    });
  });

  it('남은 낮 시간 중 흐린 시간이 있으면 맑은 날로 알리지 않는다', () => {
    // Given
    const mixedReport = createWeatherReportWithHours([
      { condition: 'CLEAR', apparentTemperature: 17 },
      { condition: 'CLOUDY', apparentTemperature: 15 },
      { condition: 'CLEAR', apparentTemperature: 14 },
      { condition: 'CLEAR', apparentTemperature: 12, isDaylight: false },
    ]);

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(mixedReport, [], CLOCK);

    // Then
    expect(briefing).toEqual({ kind: 'noScheduledTodos' });
  });

  it('저녁에 남은 할 일이 없으면 내일 아침 최저 기온을 알리고 10° 이하면 쌀쌀하다고 본다', () => {
    // Given
    // 서울 22시, 내일 최저 3°·최고 16°
    const [today] = createWeatherReportDto().daily;
    const nightReport = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T13:00:00.000Z', [0, 0]).map((hour) => ({
        ...hour,
        isDaylight: false,
      })),
      daily:
        today == null
          ? []
          : [today, { ...today, date: '2026-11-03', temperatureMin: 3, temperatureMax: 16 }],
    });
    const nightClock = { now: toInstant('2026-11-02T13:04:00.000Z'), timeZone: 'Asia/Seoul' };

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(nightReport, [], nightClock);

    // Then
    expect(briefing).toEqual({
      kind: 'tomorrowMorning',
      temperatureMin: 3,
      temperatureMax: 16,
      isChilly: true,
    });
  });
});

describe('toBriefingTodo', () => {
  const SEOUL = { date: '2026-11-02', timeZone: 'Asia/Seoul' };
  const BASE = {
    id: 1,
    title: '산책',
    completed: false,
    subTodoStats: { completed: 0, total: 0 },
  };

  it.each([
    { schedule: { localTime: '16:30', isAllDay: false }, expected: '2026-11-02T07:30:00.000Z' },
    { schedule: { localTime: '16:30', isAllDay: true }, expected: null },
    { schedule: { localTime: null, isAllDay: false }, expected: null },
  ])('$schedule는 브리핑 시각 $expected로 본다', ({ schedule, expected }) => {
    // When
    const todo = WeatherBriefingPolicy.toBriefingTodo({ ...BASE, ...schedule }, SEOUL);

    // Then
    expect(todo.scheduledAt).toEqual(expected);
  });

  it('어제 시작한 여러 날 할 일도 보고 있는 오늘의 벽시계로 본다', () => {
    // Given
    // 어제(11-01)부터 모레까지 이어지는 16:30 할 일을 오늘 목록에서 본다
    const input = { ...BASE, localTime: '16:30', isAllDay: false };

    // When
    const todo = WeatherBriefingPolicy.toBriefingTodo(input, SEOUL);
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(report, [todo], CLOCK);

    // Then
    // 시작일이 아니라 오늘 16:30이라 지난 시각으로 버려지지 않는다
    expect(todo.scheduledAt).toBe('2026-11-02T07:30:00.000Z');
    expect(briefing.kind === 'rainy').toBe(true);
  });

  it('같은 벽시계도 기기 시간대가 다르면 다른 순간으로 만든다', () => {
    // Given
    const input = { ...BASE, localTime: '16:30', isAllDay: false };

    // When
    const seoul = WeatherBriefingPolicy.toBriefingTodo(input, SEOUL);
    const losAngeles = WeatherBriefingPolicy.toBriefingTodo(input, {
      date: '2026-11-02',
      timeZone: 'America/Los_Angeles',
    });

    // Then
    // 11월은 로스앤젤레스가 UTC-8이다
    expect(seoul.scheduledAt).toBe('2026-11-02T07:30:00.000Z');
    expect(losAngeles.scheduledAt).toBe('2026-11-03T00:30:00.000Z');
  });

  it('서머타임이 끝나는 날에도 벽시계 그대로의 순간을 만든다', () => {
    // Given
    // 미국 서머타임이 끝나는 2026-11-01의 로스앤젤레스 오후 3시
    const input = { ...BASE, localTime: '15:00', isAllDay: false };

    // When
    const todo = WeatherBriefingPolicy.toBriefingTodo(input, {
      date: '2026-11-01',
      timeZone: 'America/Los_Angeles',
    });

    // Then
    // 표준시 UTC-8로 읽는다
    expect(todo.scheduledAt).toBe('2026-11-01T23:00:00.000Z');
  });

  it('하위 할 일이 있으면 진행을, 없으면 null을 담는다', () => {
    // Given
    const base = { ...BASE, title: '이사 준비', localTime: null, isAllDay: true };

    // When
    const withSubTodos = WeatherBriefingPolicy.toBriefingTodo(
      { ...base, subTodoStats: { completed: 1, total: 3 } },
      SEOUL,
    );
    const withoutSubTodos = WeatherBriefingPolicy.toBriefingTodo(
      { ...base, subTodoStats: { completed: 0, total: 0 } },
      SEOUL,
    );

    // Then
    expect(withSubTodos.subTodoProgress).toEqual({ completed: 1, total: 3 });
    expect(withoutSubTodos.subTodoProgress).toBeNull();
  });
});

describe('getSuggestedStartAt', () => {
  const RANGE = {
    startsAt: toInstant('2026-11-02T06:00:00.000Z'),
    endsAt: toInstant('2026-11-02T08:00:00.000Z'),
  };
  const { hourly: HOURLY } = createWeatherReport({
    hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 10, 10]),
  });

  it('추천 시간대가 이미 시작됐으면 다음 예보 시각을 제안한다', () => {
    // When
    const startAt = WeatherBriefingPolicy.getSuggestedStartAt(RANGE, HOURLY, NOW);

    // Then
    // 15~17시 추천을 15:26에 고르면 다음 정시는 16시다
    expect(startAt).toBe('2026-11-02T07:00:00.000Z');
  });

  it('추천 시간대의 예보 시각이 모두 지났으면 제안하지 않는다', () => {
    // Given
    const lateNow = toInstant('2026-11-02T07:10:00.000Z');

    // When
    const startAt = WeatherBriefingPolicy.getSuggestedStartAt(RANGE, HOURLY, lateNow);

    // Then
    expect(startAt).toBeNull();
  });

  it('30분 단위 시간대는 예보 칸의 시작 시각을 제안한다', () => {
    // Given
    // 인도처럼 예보 칸이 30분에 시작한다
    const { hourly: offsetHourly } = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T06:30:00.000Z', [10, 10, 10]),
    });
    const offsetRange = {
      startsAt: toInstant('2026-11-02T06:30:00.000Z'),
      endsAt: toInstant('2026-11-02T08:30:00.000Z'),
    };

    // When
    const startAt = WeatherBriefingPolicy.getSuggestedStartAt(offsetRange, offsetHourly, NOW);

    // Then
    expect(startAt).toBe('2026-11-02T06:30:00.000Z');
  });
});

function createHour(row: Parameters<typeof createWeatherReportWithHours>[0][number]) {
  const [hour] = createWeatherReportWithHours([row]).hourly;
  if (hour == null) {
    throw new Error('예보 한 시간을 만들지 못했다');
  }
  return hour;
}

describe('isHot', () => {
  it.each([
    {
      title: '낮 체감 33°C면 더운 시간이다',
      isDaylight: true,
      apparentTemperature: 33,
      expected: true,
    },
    {
      title: '낮 체감 32.9°C면 덥지 않다',
      isDaylight: true,
      apparentTemperature: 32.9,
      expected: false,
    },
    {
      title: '밤에는 체감 35°C여도 더위 안내를 하지 않는다',
      isDaylight: false,
      apparentTemperature: 35,
      expected: false,
    },
  ])('$title', ({ isDaylight, apparentTemperature, expected }) => {
    // Given
    const hour = createHour({ isDaylight, apparentTemperature });

    // When
    const result = WeatherBriefingPolicy.isHot(hour);

    // Then
    expect(result).toBe(expected);
  });
});

describe('getForecastTodos', () => {
  /** 06:00Z부터 4시간 예보 */
  const { hourly } = createWeatherReportWithHours(DRY_HOURS.slice(0, 4));

  it('시각이 정한 할 일을 그 시각이 속한 시간 예보와 묶는다', () => {
    // Given
    const todo = createBriefingTodo({ scheduledAt: toInstant('2026-11-02T07:30:00.000Z') });

    // When
    const [forecast] = WeatherBriefingPolicy.getForecastTodos(hourly, [todo], NOW);

    // Then
    expect(forecast?.todoId).toBe(todo.id);
    expect(forecast?.hour.startsAt).toBe('2026-11-02T07:00:00.000Z');
  });

  it('정각의 할 일은 그 정각에 시작하는 시간과 묶는다', () => {
    // Given
    const todo = createBriefingTodo({ scheduledAt: toInstant('2026-11-02T08:00:00.000Z') });

    // When
    const [forecast] = WeatherBriefingPolicy.getForecastTodos(hourly, [todo], NOW);

    // Then
    expect(forecast?.hour.startsAt).toBe('2026-11-02T08:00:00.000Z');
  });

  it('지금 시각의 할 일은 남기고 1ms라도 지난 할 일은 뺀다', () => {
    // Given
    const atNow = createBriefingTodo({ id: 1, scheduledAt: NOW });
    const justPassed = createBriefingTodo({
      id: 2,
      scheduledAt: fromEpochMs(Date.parse(NOW) - 1),
    });

    // When
    const forecasts = WeatherBriefingPolicy.getForecastTodos(hourly, [atNow, justPassed], NOW);

    // Then
    expect(forecasts.map(({ todoId }) => todoId)).toEqual([1]);
  });

  it('시각이 없거나 예보 범위 밖인 할 일은 뺀다', () => {
    // Given
    const unscheduled = createBriefingTodo({ id: 1, scheduledAt: null });
    // 예보 마지막 시간은 09:00Z~10:00Z다
    const beyond = createBriefingTodo({
      id: 2,
      scheduledAt: toInstant('2026-11-02T10:00:00.000Z'),
    });

    // When
    const forecasts = WeatherBriefingPolicy.getForecastTodos(hourly, [unscheduled, beyond], NOW);

    // Then
    expect(forecasts).toEqual([]);
  });

  it('끝낸 할 일도 완료 여부를 남겨 함께 보여 준다', () => {
    // Given
    const done = createBriefingTodo({ completed: true });

    // When
    const [forecast] = WeatherBriefingPolicy.getForecastTodos(hourly, [done], NOW);

    // Then
    expect(forecast?.completed).toBe(true);
  });
});
