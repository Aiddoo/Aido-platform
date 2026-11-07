import type { WeatherHourlyForecast } from '@aido/api';
import { fromEpochMs, toInstant } from '@src/shared/date/instant';
import { range } from 'es-toolkit';

import {
  createHourlyForecastDto,
  createHourlySeries,
  createWeatherReport,
  createWeatherReportDto,
} from '../__tests__/weather-report.fixtures';
import { type BriefingTodo, WeatherBriefingPolicy } from './weather-briefing.model';

/** 서울 15:26. 16~18시(07:00Z~09:00Z) 비, 나머지는 맑다. */
const NOW = toInstant('2026-11-02T06:26:00.000Z');
const CLOCK = { now: NOW, timeZone: 'Asia/Seoul' };
const report = createWeatherReport({
  hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]),
});
const { hourly } = report;

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

const DRY_HOURS = range(9).map(() => ({ precipitationChance: 10 }));

describe('WeatherBriefingPolicy.toWeatherBriefing', () => {
  it('비 소식도 할 일도 없으면 브리핑할 할 일이 없다고 알린다', () => {
    // Given 남은 시간 내내 흐리고 비가 없다 When 할 일 없이 브리핑하면 Then 할 일이 없다고 알린다
    const briefing = WeatherBriefingPolicy.toWeatherBriefing(createReport(DRY_HOURS), [], CLOCK);

    expect(briefing).toEqual({ kind: 'noScheduledTodos' });
  });

  it('종일·시간 없는 할 일만 있으면 비와 겹치는지 판단하지 않는다', () => {
    // Given 시간 없는 할 일 When 브리핑하면 Then 할 일이 없는 것으로 본다
    const briefing = WeatherBriefingPolicy.toWeatherBriefing(
      createReport(DRY_HOURS),
      [createTodo({ scheduledAt: null })],
      CLOCK,
    );

    expect(briefing).toEqual({ kind: 'noScheduledTodos' });
  });

  it('할 일 하나가 비 오는 시간에 걸리면 그 할 일과 그 시간의 예보를 돌려준다', () => {
    // Given 16시 70% 비, 16:30 할 일 When 브리핑하면 Then 비와 겹친다고 알린다
    const briefing = WeatherBriefingPolicy.toWeatherBriefing(report, [createTodo()], CLOCK);

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
    // Given 14:30부터 1시간 간격 할 일 7개, 세 번째는 끝냄 When 브리핑하면 Then 비 시간 할 일만 완료 여부와 함께 남는다
    const todos = range(7).map((index) =>
      createTodo({
        id: index + 1,
        scheduledAt: fromEpochMs(Date.parse('2026-11-02T05:30:00.000Z') + index * 60 * 60_000),
        completed: index === 2,
      }),
    );

    const briefing = WeatherBriefingPolicy.toWeatherBriefing(report, todos, CLOCK);

    expect(
      briefing.kind === 'rainy' &&
        briefing.todos.map(({ todoId, completed }) => ({ todoId, completed })),
    ).toEqual([
      { todoId: 3, completed: true },
      { todoId: 4, completed: false },
    ]);
  });

  it('비와 겹친 할 일을 끝내도 브리핑은 그대로 두고, 옮길 할 일에서는 뺀다', () => {
    // Given 비 시간 할 일 하나를 끝냄 When 브리핑과 옮길 할 일을 구하면 Then 브리핑은 비, 옮길 할 일은 없다
    const todos = [
      createTodo({
        id: 1,
        scheduledAt: toInstant('2026-11-02T07:30:00.000Z'),
        completed: true,
      }),
    ];

    expect(WeatherBriefingPolicy.toWeatherBriefing(report, todos, CLOCK).kind).toBe('rainy');
    expect(
      WeatherBriefingPolicy.getAffectedTodos(report.hourly, todos, {
        now: CLOCK.now,
        reason: 'rain',
      }),
    ).toEqual([]);
  });

  it('할 일이 뇌우 시간에 걸리면 이어지는 뇌우 시간대와 함께 낙뢰를 알린다', () => {
    // Given 16~18시 뇌우, 16:30 할 일 When 브리핑하면 Then 16~19시 낙뢰 위험을 알린다
    const thunder = {
      condition: 'THUNDERSTORMS',
      precipitationChance: 90,
      precipitationType: 'RAIN',
    } as const;
    const briefing = WeatherBriefingPolicy.toWeatherBriefing(
      createReport([
        { precipitationChance: 10 },
        thunder,
        thunder,
        thunder,
        { precipitationChance: 10 },
      ]),
      [createTodo()],
      CLOCK,
    );

    expect(briefing.kind).toBe('stormy');
    expect(briefing.kind === 'stormy' && briefing.range).toEqual({
      startsAt: toInstant('2026-11-02T07:00:00.000Z'),
      endsAt: toInstant('2026-11-02T10:00:00.000Z'),
    });
  });

  it('겹친 시간이 모두 눈이면 이동이 늦어진다고 알린다', () => {
    // Given 16시 눈 90% When 16:30 할 일을 브리핑하면 Then 눈 브리핑이다
    const briefing = WeatherBriefingPolicy.toWeatherBriefing(
      createReport([
        { precipitationChance: 10 },
        { condition: 'SNOW', precipitationChance: 90, precipitationType: 'SNOW' },
      ]),
      [createTodo()],
      CLOCK,
    );

    expect(briefing.kind).toBe('snowy');
  });

  it('할 일이 체감 33° 이상인 낮 시간에 걸리면 더위 시간대와 가장 높은 체감 온도를 알린다', () => {
    // Given 16~17시 체감 35°·39° When 16:30 할 일을 브리핑하면 Then 16~18시 체감 39°를 알린다
    const briefing = WeatherBriefingPolicy.toWeatherBriefing(
      createReport([
        { apparentTemperature: 31 },
        { apparentTemperature: 35 },
        { apparentTemperature: 39 },
        { apparentTemperature: 30 },
      ]),
      [createTodo()],
      CLOCK,
    );

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
    // Given 오늘 남은 시간 흐리고 맑음, 내일 13시(04:00Z) 비 When 브리핑하면 Then 내일 오후 비를 알린다
    const hours = [
      ...range(22).map(() => ({ condition: 'CLOUDY', precipitationChance: 10 }) as const),
      { precipitationChance: 80, precipitationType: 'RAIN' } as const,
    ];
    const briefing = WeatherBriefingPolicy.toWeatherBriefing(createReport(hours), [], CLOCK);

    expect(briefing).toEqual(
      expect.objectContaining({
        kind: 'rainLater',
        startsAt: toInstant('2026-11-03T04:00:00.000Z'),
        day: 'tomorrow',
        dayPart: 'afternoon',
        isSnow: false,
        isGray: true,
      }),
    );
  });

  it('모레 비는 알리지 않고 남은 할 일을 날씨 걱정 없는 목록으로 보여 준다', () => {
    // Given 오늘·내일 흐림, 모레 비 When 22시 할 일을 브리핑하면 Then 비를 피했다고 알린다
    const hours = [
      ...range(40).map(() => ({ precipitationChance: 10 })),
      { precipitationChance: 80, precipitationType: 'RAIN' } as const,
    ];
    const briefing = WeatherBriefingPolicy.toWeatherBriefing(
      createReport(hours),
      [createTodo({ scheduledAt: toInstant('2026-11-02T13:30:00.000Z') })],
      CLOCK,
    );

    expect(briefing.kind).toBe('dry');
    expect(briefing.kind === 'dry' && briefing.todos.map((todo) => todo.todoId)).toEqual([1]);
  });

  it('오늘 남은 낮이 맑으면 가장 따뜻한 시간대를 야외 할 일 하기 좋은 때로 알린다', () => {
    // Given 15~17시 맑음 체감 16·17·17°, 18시부터 밤 When 브리핑하면 Then 15~18시를 추천한다
    const briefing = WeatherBriefingPolicy.toWeatherBriefing(
      createReport([
        { condition: 'CLEAR', apparentTemperature: 16 },
        { condition: 'CLEAR', apparentTemperature: 17 },
        { condition: 'CLEAR', apparentTemperature: 17 },
        { condition: 'CLEAR', apparentTemperature: 14, isDaylight: false },
      ]),
      [],
      CLOCK,
    );

    expect(briefing).toEqual({
      kind: 'clear',
      todos: [],
      range: {
        startsAt: toInstant('2026-11-02T06:00:00.000Z'),
        endsAt: toInstant('2026-11-02T09:00:00.000Z'),
      },
    });
  });

  it('저녁에 남은 할 일이 없으면 내일 아침 최저 기온을 알리고 10° 이하면 쌀쌀하다고 본다', () => {
    // Given 22시, 내일 최저 3°·최고 16° When 브리핑하면 Then 쌀쌀한 내일 아침을 알린다
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
    const briefing = WeatherBriefingPolicy.toWeatherBriefing(nightReport, [], {
      now: toInstant('2026-11-02T13:04:00.000Z'),
      timeZone: 'Asia/Seoul',
    });

    expect(briefing).toEqual({
      kind: 'tomorrowMorning',
      temperatureMin: 3,
      temperatureMax: 16,
      isChilly: true,
    });
  });
});

describe('WeatherBriefingPolicy.getRescheduleOptions', () => {
  it('같은 날 지금 이후의 맑은 정시를 강수 확률이 낮고 원래 시각에 가까운 순으로 고르고 첫 번째를 추천한다', () => {
    // When
    const options = WeatherBriefingPolicy.getRescheduleOptions(
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
    const options = WeatherBriefingPolicy.getRescheduleOptions(
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
    const options = WeatherBriefingPolicy.getRescheduleOptions(
      lateHours,
      { scheduledAt: toInstant('2026-11-02T13:30:00.000Z') },
      { now: toInstant('2026-11-02T13:10:00.000Z'), timeZone: 'Asia/Seoul' },
    );

    // Then
    expect(options.map((option) => option.startsAt)).toEqual(['2026-11-02T14:00:00.000Z']);
  });
});

describe('WeatherBriefingPolicy.getRescheduleOptions 더위', () => {
  it('더위를 피할 때는 덥지 않은 같은 날 시간을 원래 시각과 가까운 순으로 고른다', () => {
    // Given 16~17시 체감 36°, 나머지 28° When 16:30 할 일의 후보를 고르면 Then 18시·19시·20시 순이다
    const hotHours = createReport([
      { apparentTemperature: 34 },
      { apparentTemperature: 36 },
      { apparentTemperature: 36 },
      { apparentTemperature: 28 },
      { apparentTemperature: 28 },
      { apparentTemperature: 28, isDaylight: false },
    ]).hourly;

    const options = WeatherBriefingPolicy.getRescheduleOptions(
      hotHours,
      { scheduledAt: toInstant('2026-11-02T07:30:00.000Z') },
      { now: NOW, timeZone: 'Asia/Seoul', reason: 'heat' },
    );

    expect(options.map((option) => option.startsAt)).toEqual([
      '2026-11-02T09:00:00.000Z',
      '2026-11-02T10:00:00.000Z',
      '2026-11-02T11:00:00.000Z',
    ]);
  });
});

describe('WeatherBriefingPolicy.toBriefingTodo', () => {
  const SEOUL = { date: '2026-11-02', timeZone: 'Asia/Seoul' };
  const BASE = {
    id: 1,
    title: '산책',
    completed: false,
    subTodoStats: { completed: 0, total: 0 },
  };

  it.each([
    [{ localTime: '16:30', isAllDay: false }, '2026-11-02T07:30:00.000Z'],
    [{ localTime: '16:30', isAllDay: true }, null],
    [{ localTime: null, isAllDay: false }, null],
  ])('%o는 브리핑 시각 %s로 본다', (schedule, expected) => {
    // When
    const todo = WeatherBriefingPolicy.toBriefingTodo({ ...BASE, ...schedule }, SEOUL);

    // Then
    expect(todo.scheduledAt).toEqual(expected);
  });

  it('어제 시작한 여러 날 할 일도 보고 있는 오늘의 벽시계로 본다', () => {
    // Given 어제(11-01)부터 모레까지 이어지는 16:30 할 일을 오늘 목록에서 본다
    // When 오늘 날짜로 브리핑 입력을 만들면
    const todo = WeatherBriefingPolicy.toBriefingTodo(
      { ...BASE, localTime: '16:30', isAllDay: false },
      SEOUL,
    );

    // Then 시작일이 아니라 오늘 16:30이라 지난 시각으로 버려지지 않는다
    expect(todo.scheduledAt).toEqual('2026-11-02T07:30:00.000Z');
    expect(WeatherBriefingPolicy.toWeatherBriefing(report, [todo], CLOCK).kind === 'rainy').toBe(
      true,
    );
  });

  it('같은 벽시계도 기기 시간대가 다르면 다른 순간으로 만든다', () => {
    // Given 같은 날짜와 16:30 When 서울과 로스앤젤레스 기기에서 바꾸면
    const input = { ...BASE, localTime: '16:30', isAllDay: false };
    const seoul = WeatherBriefingPolicy.toBriefingTodo(input, SEOUL);
    const losAngeles = WeatherBriefingPolicy.toBriefingTodo(input, {
      date: '2026-11-02',
      timeZone: 'America/Los_Angeles',
    });

    // Then 11월은 로스앤젤레스가 UTC-8이다
    expect(seoul.scheduledAt).toEqual('2026-11-02T07:30:00.000Z');
    expect(losAngeles.scheduledAt).toEqual('2026-11-03T00:30:00.000Z');
  });

  it('서머타임이 끝나는 날에도 벽시계 그대로의 순간을 만든다', () => {
    // Given 미국 서머타임이 끝나는 2026-11-01 When 로스앤젤레스 기기의 오후 3시를 바꾸면
    const todo = WeatherBriefingPolicy.toBriefingTodo(
      { ...BASE, localTime: '15:00', isAllDay: false },
      { date: '2026-11-01', timeZone: 'America/Los_Angeles' },
    );

    // Then 표준시 UTC-8로 읽는다
    expect(todo.scheduledAt).toEqual('2026-11-01T23:00:00.000Z');
  });

  it('하위 할 일이 있으면 진행을, 없으면 null을 담는다', () => {
    // Given 하위 할 일 3개 중 1개 완료와 하위 할 일 없음 When 브리핑 입력으로 바꾸면 Then 진행은 1/3과 null이다
    const base = { ...BASE, title: '이사 준비', localTime: null, isAllDay: true };

    expect(
      WeatherBriefingPolicy.toBriefingTodo(
        { ...base, subTodoStats: { completed: 1, total: 3 } },
        SEOUL,
      ).subTodoProgress,
    ).toEqual({ completed: 1, total: 3 });
    expect(
      WeatherBriefingPolicy.toBriefingTodo(
        { ...base, subTodoStats: { completed: 0, total: 0 } },
        SEOUL,
      ).subTodoProgress,
    ).toBeNull();
  });
});

describe('WeatherBriefingPolicy.getSuggestedStartAt', () => {
  const RANGE = {
    startsAt: toInstant('2026-11-02T06:00:00.000Z'),
    endsAt: toInstant('2026-11-02T08:00:00.000Z'),
  };

  it('추천 시간대가 이미 시작됐으면 다음 정시를 제안한다', () => {
    // Given 15~17시 추천 When 15:26에 고르면 Then 16시다
    expect(WeatherBriefingPolicy.getSuggestedStartAt(RANGE, NOW)).toEqual(
      '2026-11-02T07:00:00.000Z',
    );
  });

  it('추천 시간대의 정시가 모두 지났으면 제안하지 않는다', () => {
    // Given 15~17시 추천 When 16:10에 고르면 Then 남은 정시가 없다
    expect(
      WeatherBriefingPolicy.getSuggestedStartAt(RANGE, toInstant('2026-11-02T07:10:00.000Z')),
    ).toBeNull();
  });
});
