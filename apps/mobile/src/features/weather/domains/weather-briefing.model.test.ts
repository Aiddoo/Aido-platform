import { createSubTodo } from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import { fromEpochMs, toEpochMs, toInstant } from '@src/shared/date/instant';
import { range } from 'es-toolkit';

import {
  createBriefingDto,
  createBriefingTodo,
  createHourlySeries,
  createRescheduleOptionDto,
  createWeatherReport,
  createWeatherReportDto,
  createWeatherReportWithHours,
} from '../__tests__/weather-report.fixtures';
import { WeatherBriefingPolicy } from './weather-briefing.model';

/** 서울 15:26. 16~18시(07:00Z~09:00Z) 비, 나머지는 맑다. */
const NOW = toInstant('2026-11-02T06:26:00.000Z');
const CLOCK = { now: NOW, timeZone: 'Asia/Seoul' };
const HOURLY = createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]);
const report = createWeatherReport({ hourly: HOURLY });
/** 서버가 16:30(07:30Z) 할 일 1이 비와 겹친다고 보고 19시를 추천한다 */
const RAIN_ON_TODO_1 = createBriefingDto({
  reason: 'rain',
  affectedTodoIds: [1],
  rescheduleOptions: [
    {
      todoId: 1,
      options: [createRescheduleOptionDto('2026-11-02T10:00:00.000Z', { isRecommended: true })],
    },
  ],
});
const rainyReport = createWeatherReport({ hourly: HOURLY, briefing: RAIN_ON_TODO_1 });

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

  it('서버가 판단하지 못한 리포트(옛 서버·할 일 읽기 실패)면 앱이 다시 판단하지 않고 브리핑하지 않는다', () => {
    // Given
    const reportWithoutBriefing = createWeatherReport({ hourly: HOURLY, briefing: undefined });

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(
      reportWithoutBriefing,
      [createBriefingTodo()],
      CLOCK,
    );

    // Then
    expect(briefing).toBeNull();
  });

  it('서버가 비와 겹친 할 일이 없다고 하면 예보상 비 시간에 할 일이 있어도 위험을 알리지 않는다', () => {
    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(
      report,
      [createBriefingTodo()],
      CLOCK,
    );

    // Then
    expect(briefing?.kind).toBe('rainLater');
  });

  it('서버가 비와 겹친다고 고른 할 일을 그 시간의 예보·서버가 고른 옮길 시각 후보와 함께 돌려준다', () => {
    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(
      rainyReport,
      [createBriefingTodo()],
      CLOCK,
    );

    // Then
    expect(briefing?.kind).toBe('rainy');
    expect(briefing?.kind === 'rainy' && briefing.todos).toEqual([
      expect.objectContaining({
        todoId: 1,
        title: '산책',
        scheduledAt: toInstant('2026-11-02T07:30:00.000Z'),
        hour: expect.objectContaining({ precipitationChance: 70, precipitationType: 'RAIN' }),
        rescheduleOptions: [
          expect.objectContaining({ startsAt: '2026-11-02T10:00:00.000Z', isRecommended: true }),
        ],
      }),
    ]);
  });

  it('서버가 고른 할 일 중 오늘 목록에서 사라졌거나 이미 지난 할 일은 빼고 서버 순서를 지킨다', () => {
    // Given
    // 3·1은 남았고, 2는 14:30이라 지났고, 9는 목록에 없다
    const serverReport = createWeatherReport({
      hourly: HOURLY,
      briefing: createBriefingDto({ reason: 'rain', affectedTodoIds: [3, 2, 1, 9] }),
    });
    const todos = [
      createBriefingTodo({ id: 1, scheduledAt: toInstant('2026-11-02T08:30:00.000Z') }),
      createBriefingTodo({ id: 2, scheduledAt: toInstant('2026-11-02T05:30:00.000Z') }),
      createBriefingTodo({ id: 3, scheduledAt: toInstant('2026-11-02T07:30:00.000Z') }),
    ];

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(serverReport, todos, CLOCK);

    // Then
    expect(briefing?.kind === 'rainy' && briefing.todos.map(({ todoId }) => todoId)).toEqual([
      3, 1,
    ]);
  });

  it('비와 겹친 할 일을 브리핑에서 끝내도 리포트를 다시 받기 전까지 카드는 그대로 두고 완료로 보인다', () => {
    // Given
    const todos = [createBriefingTodo({ id: 1, completed: true })];

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(rainyReport, todos, CLOCK);

    // Then
    expect(briefing?.kind === 'rainy' && briefing.todos.map(({ completed }) => completed)).toEqual([
      true,
    ]);
  });

  it('할 일이 뇌우 시간에 걸리면 이어지는 뇌우 시간대와 함께 낙뢰를 알린다', () => {
    // Given
    // 16~18시 뇌우, 16:30 할 일
    const thunder = {
      condition: 'THUNDERSTORMS',
      precipitationChance: 90,
      precipitationType: 'RAIN',
    } as const;
    const stormReport = createWeatherReportWithHours(
      [{ precipitationChance: 10 }, thunder, thunder, thunder, { precipitationChance: 10 }],
      { briefing: RAIN_ON_TODO_1 },
    );

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(
      stormReport,
      [createBriefingTodo()],
      CLOCK,
    );

    // Then
    expect(briefing?.kind).toBe('stormy');
    expect(briefing?.kind === 'stormy' && briefing.range).toEqual({
      startsAt: toInstant('2026-11-02T07:00:00.000Z'),
      endsAt: toInstant('2026-11-02T10:00:00.000Z'),
    });
  });

  it('겹친 시간이 모두 눈이면 이동이 늦어진다고 알린다', () => {
    // Given
    const snowReport = createWeatherReportWithHours(
      [
        { precipitationChance: 10 },
        { condition: 'SNOW', precipitationChance: 90, precipitationType: 'SNOW' },
      ],
      { briefing: RAIN_ON_TODO_1 },
    );

    // When
    const briefing = WeatherBriefingPolicy.getWeatherBriefing(
      snowReport,
      [createBriefingTodo()],
      CLOCK,
    );

    // Then
    expect(briefing?.kind).toBe('snowy');
  });

  it('서버가 더위와 겹친다고 고른 할 일이 있으면 더위 시간대와 가장 높은 체감 온도를 알린다', () => {
    // Given
    // 16~17시 체감 35°·39°, 16:30 할 일
    const hotReport = createWeatherReportWithHours(
      [
        { apparentTemperature: 31 },
        { apparentTemperature: 35 },
        { apparentTemperature: 39 },
        { apparentTemperature: 30 },
      ],
      { briefing: createBriefingDto({ reason: 'heat', affectedTodoIds: [1] }) },
    );

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
    expect(briefing?.kind).toBe('dry');
    expect(briefing?.kind === 'dry' && briefing.todos.map((todo) => todo.todoId)).toEqual([1]);
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
    subTodos: [],
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
    const forecastTodos = WeatherBriefingPolicy.getForecastTodos(report.hourly, [todo], NOW);

    // Then
    // 시작일이 아니라 오늘 16:30이라 지난 시각으로 버려지지 않는다
    expect(todo.scheduledAt).toBe('2026-11-02T07:30:00.000Z');
    expect(forecastTodos).toHaveLength(1);
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
      {
        ...base,
        subTodos: [1, 2, 3].map((id) => createSubTodo({ id, completed: id === 1 })),
      },
      SEOUL,
    );
    const withoutSubTodos = WeatherBriefingPolicy.toBriefingTodo({ ...base, subTodos: [] }, SEOUL);

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

const STATE_REPORT = createWeatherReport({
  fetchedAt: '2026-11-02T06:20:00.000Z',
  hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]),
});

describe('getBriefingState', () => {
  it('리포트를 받기 전이거나 받지 못했으면 자리만 잡고 실패는 리포트 경계에 맡긴다', () => {
    // When
    const state = WeatherBriefingPolicy.getBriefingState(undefined, {
      now: NOW,
      deviceTimeZone: 'Asia/Seoul',
    });

    // Then
    expect(state).toBe('loading');
  });

  it('6시간 넘게 갱신되지 않은 리포트로는 브리핑하지 않는다', () => {
    // Given
    const later = fromEpochMs(toEpochMs(NOW) + 7 * 60 * 60_000);

    // When
    const state = WeatherBriefingPolicy.getBriefingState(STATE_REPORT, {
      now: later,
      deviceTimeZone: 'Asia/Seoul',
    });

    // Then
    expect(state).toBe('hidden');
  });

  it.each([
    ['Asia/Tokyo', 'visible'],
    ['America/Los_Angeles', 'hidden'],
  ] as const)('기기 시간대가 %s이면 서울 리포트 브리핑은 %s이다', (deviceTimeZone, expected) => {
    // When
    const state = WeatherBriefingPolicy.getBriefingState(STATE_REPORT, {
      now: NOW,
      deviceTimeZone,
    });

    // Then
    expect(state).toBe(expected);
  });
});

describe('isTodoWithinRange', () => {
  const hours = {
    startsAt: toInstant('2026-11-02T07:00:00.000Z'),
    endsAt: toInstant('2026-11-02T09:00:00.000Z'),
  };

  it.each([
    ['2026-11-02T06:59:00.000Z', false],
    ['2026-11-02T07:00:00.000Z', true],
    ['2026-11-02T08:59:00.000Z', true],
    ['2026-11-02T09:00:00.000Z', false],
  ] as const)('할 일 시각이 %s이면 추천 시간대 안인지는 %s다', (scheduledAt, expected) => {
    // Given
    const todo = { scheduledAt: toInstant(scheduledAt) };

    // When
    const result = WeatherBriefingPolicy.isTodoWithinRange(todo, hours);

    // Then
    expect(result).toBe(expected);
  });
});

describe('getUncompletedTodoIds', () => {
  it('완료한 할 일은 빼고 남은 할 일 ID만 순서대로 반환한다', () => {
    // Given
    const todos = [
      { todoId: 1, completed: false },
      { todoId: 2, completed: true },
      { todoId: 3, completed: false },
    ];

    // When
    const ids = WeatherBriefingPolicy.getUncompletedTodoIds(todos);

    // Then
    expect(ids).toEqual([1, 3]);
  });
});
