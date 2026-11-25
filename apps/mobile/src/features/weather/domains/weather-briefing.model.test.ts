import {
  createParentTodo,
  createSubTodo,
} from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import { fromEpochMs, toEpochMs, toInstant } from '@src/shared/date/instant';
import { createDateKey } from '@src/testing/date-key';
import { range } from 'es-toolkit';

import {
  createBriefingDto,
  createBriefingTodo,
  createForecastTodo,
  createHourlySeries,
  createRescheduleOptionDto,
  createWeatherReport,
  createWeatherReportWithHours,
} from '../__tests__/weather-report.fixtures';
import {
  getBriefingState,
  findWeatherBriefing,
  WeatherBriefingPolicy,
} from './weather-briefing.model';

/** 서울 15:26. 16~18시(07:00Z~09:00Z) 비, 나머지는 맑다. */
const NOW = toInstant('2026-11-02T06:26:00.000Z');
const CLOCK = { now: NOW };
const HOURLY = createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]);
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
/** 서버가 고른 16~17시(07:00Z~09:00Z) 날씨 시간 */
const TODO_WINDOW = { startsAt: '2026-11-02T07:00:00.000Z', endsAt: '2026-11-02T09:00:00.000Z' };
const RAINY_HEADLINE = {
  kind: 'todoWet',
  hazard: 'rain',
  precipitationChance: 70,
  window: TODO_WINDOW,
} as const;
const rainyReport = createWeatherReport({
  hourly: HOURLY,
  briefing: RAIN_ON_TODO_1,
  headline: RAINY_HEADLINE,
});

const HOURLY_FORECAST = rainyReport.hourly;
const DRY_HOURS = range(9).map(() => ({ precipitationChance: 10 }));

describe('findWeatherBriefing', () => {
  it('서버가 머리글을 판단하지 못했으면(할 일 읽기 실패) 앱이 다시 판단하지 않고 브리핑하지 않는다', () => {
    // Given
    const undecided = createWeatherReport({ hourly: HOURLY, headline: null });

    // When
    const briefing = findWeatherBriefing(undecided, [createBriefingTodo()], CLOCK);

    // Then
    expect(briefing).toBeNull();
  });

  it('알릴 날씨가 없으면 남은 시각 할 일이 있을 때만 날씨 걱정 없는 목록을 보인다', () => {
    // Given
    // 예보상 비 시간에 할 일이 있어도 서버가 알릴 날씨가 없다고 하면 다시 판단하지 않는다
    const calmReport = createWeatherReport({ hourly: HOURLY });
    const unscheduledTodo = createBriefingTodo({ id: 2, scheduledAt: null });

    // When
    const withTodo = findWeatherBriefing(calmReport, [createBriefingTodo()], CLOCK);
    const withoutTodo = findWeatherBriefing(calmReport, [unscheduledTodo], CLOCK);

    // Then
    expect(withTodo?.kind === 'dry' && withTodo.todos.map(({ todoId }) => todoId)).toEqual([1]);
    expect(withoutTodo).toEqual({ kind: 'noScheduledTodos' });
  });

  it('서버가 비와 겹친다고 고른 할 일을 그 시간의 예보·서버가 고른 옮길 시각 후보와 함께 돌려준다', () => {
    // When
    const briefing = findWeatherBriefing(rainyReport, [createBriefingTodo()], CLOCK);

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
      headline: RAINY_HEADLINE,
    });
    const todos = [
      createBriefingTodo({ id: 1, scheduledAt: toInstant('2026-11-02T08:30:00.000Z') }),
      createBriefingTodo({ id: 2, scheduledAt: toInstant('2026-11-02T05:30:00.000Z') }),
      createBriefingTodo({ id: 3, scheduledAt: toInstant('2026-11-02T07:30:00.000Z') }),
    ];

    // When
    const briefing = findWeatherBriefing(serverReport, todos, CLOCK);

    // Then
    expect(briefing?.kind === 'rainy' && briefing.todos.map(({ todoId }) => todoId)).toEqual([
      3, 1,
    ]);
  });

  it('서버가 짚은 할 일이 오늘 목록에 하나도 없으면 위험 대신 남은 할 일 목록을 보인다', () => {
    // Given
    const otherTodo = createBriefingTodo({ id: 5 });

    // When
    const briefing = findWeatherBriefing(rainyReport, [otherTodo], CLOCK);

    // Then
    expect(briefing?.kind === 'dry' && briefing.todos.map(({ todoId }) => todoId)).toEqual([5]);
  });

  it('비와 겹친 할 일을 브리핑에서 끝내도 리포트를 다시 받기 전까지 카드는 그대로 두고 완료로 보인다', () => {
    // Given
    const todos = [createBriefingTodo({ id: 1, completed: true })];

    // When
    const briefing = findWeatherBriefing(rainyReport, todos, CLOCK);

    // Then
    expect(briefing?.kind === 'rainy' && briefing.todos.map(({ completed }) => completed)).toEqual([
      true,
    ]);
  });

  it.each([
    { hazard: 'storm', kind: 'stormy' },
    { hazard: 'snow', kind: 'snowy' },
    { hazard: 'rain', kind: 'rainy' },
  ] as const)('서버가 할 일과 겹친 $hazard를 알리면 $kind 카드다', ({ hazard, kind }) => {
    // Given
    const report = createWeatherReport({
      hourly: HOURLY,
      briefing: RAIN_ON_TODO_1,
      headline: { ...RAINY_HEADLINE, hazard },
    });

    // When
    const briefing = findWeatherBriefing(report, [createBriefingTodo()], CLOCK);

    // Then
    expect(briefing?.kind).toBe(kind);
  });

  it('뇌우·더위는 서버가 준 날씨 시간과 최고 체감 온도를 그대로 쓴다', () => {
    // Given
    const stormReport = createWeatherReport({
      hourly: HOURLY,
      briefing: RAIN_ON_TODO_1,
      headline: { ...RAINY_HEADLINE, hazard: 'storm' },
    });
    const hotReport = createWeatherReport({
      hourly: HOURLY,
      briefing: createBriefingDto({ reason: 'heat', affectedTodoIds: [1] }),
      headline: { kind: 'todoHot', peakApparentTemperature: 39, window: TODO_WINDOW },
    });
    const serverWindow = {
      startsAt: toInstant(TODO_WINDOW.startsAt),
      endsAt: toInstant(TODO_WINDOW.endsAt),
    };

    // When
    const stormy = findWeatherBriefing(stormReport, [createBriefingTodo()], CLOCK);
    const hot = findWeatherBriefing(hotReport, [createBriefingTodo()], CLOCK);

    // Then
    expect(stormy).toMatchObject({ kind: 'stormy', range: serverWindow });
    expect(hot).toMatchObject({ kind: 'hot', range: serverWindow, peakApparentTemperature: 39 });
  });

  it('서버가 오늘 비가 지금부터 온다고 하면 지금 비 시간에 할 일이 없어도 그 시각으로 알린다', () => {
    // Given
    // 지금 시간(15시)이 흐리고 비가 온다
    const wetNowReport = createWeatherReportWithHours([{ precipitationChance: 80 }], {
      headline: { kind: 'wetLater', startsAt: '2026-11-02T06:26:00.000Z', isSnow: false },
    });

    // When
    const briefing = findWeatherBriefing(wetNowReport, [], CLOCK);

    // Then
    expect(briefing).toEqual({
      kind: 'rainLater',
      todos: [],
      timing: { day: 'today', startsAt: NOW },
      isSnow: false,
      isOvercast: true,
    });
  });

  it('서버가 내일 비를 알리면 서버가 고른 하루 구분으로 알린다', () => {
    // Given
    const tomorrowRainReport = createWeatherReportWithHours(DRY_HOURS, {
      headline: { kind: 'wetTomorrow', dayPart: 'afternoon', isSnow: true },
    });

    // When
    const briefing = findWeatherBriefing(tomorrowRainReport, [], CLOCK);

    // Then
    expect(briefing).toMatchObject({
      kind: 'rainLater',
      timing: { day: 'tomorrow', dayPart: 'afternoon' },
      isSnow: true,
    });
  });

  it('맑은 날은 서버가 고른 가장 좋은 시간대를 그대로 알린다', () => {
    // Given
    const clearReport = createWeatherReportWithHours(DRY_HOURS, {
      headline: { kind: 'clear', window: TODO_WINDOW },
    });

    // When
    const briefing = findWeatherBriefing(clearReport, [], CLOCK);

    // Then
    expect(briefing).toEqual({
      kind: 'clear',
      todos: [],
      range: { startsAt: toInstant(TODO_WINDOW.startsAt), endsAt: toInstant(TODO_WINDOW.endsAt) },
    });
  });

  it('저녁 내일 기온은 오늘 줄이 없을 때만 보이고 끝낸 할 일 줄이 남아 있으면 그 목록을 보인다', () => {
    // Given
    const tomorrowReport = createWeatherReportWithHours(DRY_HOURS, {
      headline: { kind: 'tomorrow', temperatureMin: 3, temperatureMax: 16, isChilly: true },
    });
    const completedTodo = createBriefingTodo({ completed: true });

    // When
    const withoutRows = findWeatherBriefing(tomorrowReport, [], CLOCK);
    const withRows = findWeatherBriefing(tomorrowReport, [completedTodo], CLOCK);

    // Then
    expect(withoutRows).toEqual({
      kind: 'tomorrowMorning',
      temperatureMin: 3,
      temperatureMax: 16,
      isChilly: true,
    });
    expect(withRows?.kind).toBe('dry');
  });
});

const STATE_REPORT = createWeatherReport({
  fetchedAt: '2026-11-02T06:20:00.000Z',
  hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]),
});

describe('getBriefingState', () => {
  it('리포트를 받기 전이거나 받지 못했으면 자리만 잡고 실패는 리포트 경계에 맡긴다', () => {
    // When
    const state = getBriefingState(undefined, {
      now: NOW,
      deviceTimezone: 'Asia/Seoul',
    });

    // Then
    expect(state).toBe('loading');
  });

  it('6시간 넘게 갱신되지 않은 리포트로는 브리핑하지 않는다', () => {
    // Given
    const later = fromEpochMs(toEpochMs(NOW) + 7 * 60 * 60_000);

    // When
    const state = getBriefingState(STATE_REPORT, {
      now: later,
      deviceTimezone: 'Asia/Seoul',
    });

    // Then
    expect(state).toBe('hidden');
  });

  it.each([
    ['Asia/Tokyo', 'visible'],
    ['America/Los_Angeles', 'hidden'],
  ] as const)('기기 시간대가 %s이면 서울 리포트 브리핑은 %s이다', (deviceTimezone, expected) => {
    // When
    const state = getBriefingState(STATE_REPORT, {
      now: NOW,
      deviceTimezone,
    });

    // Then
    expect(state).toBe(expected);
  });
});

describe('WeatherBriefingPolicy', () => {
  describe('toBriefingTodo', () => {
    const SEOUL = { date: createDateKey('2026-11-02'), timezone: 'Asia/Seoul' };
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
      const todo = WeatherBriefingPolicy.toBriefingTodo(
        createParentTodo({ ...BASE, ...schedule }),
        SEOUL,
      );

      // Then
      expect(todo.scheduledAt).toEqual(expected);
    });

    it('어제 시작한 여러 날 할 일도 보고 있는 오늘의 벽시계로 본다', () => {
      // Given
      // 어제(11-01)부터 모레까지 이어지는 16:30 할 일을 오늘 목록에서 본다
      const input = createParentTodo({ ...BASE, localTime: '16:30', isAllDay: false });

      // When
      const todo = WeatherBriefingPolicy.toBriefingTodo(input, SEOUL);
      const forecastTodos = WeatherBriefingPolicy.getForecastTodos(HOURLY_FORECAST, [todo], NOW);

      // Then
      // 시작일이 아니라 오늘 16:30이라 지난 시각으로 버려지지 않는다
      expect(todo.scheduledAt).toBe('2026-11-02T07:30:00.000Z');
      expect(forecastTodos).toHaveLength(1);
    });

    it('같은 벽시계도 기기 시간대가 다르면 다른 순간으로 만든다', () => {
      // Given
      const input = createParentTodo({ ...BASE, localTime: '16:30', isAllDay: false });

      // When
      const seoul = WeatherBriefingPolicy.toBriefingTodo(input, SEOUL);
      const losAngeles = WeatherBriefingPolicy.toBriefingTodo(input, {
        date: createDateKey('2026-11-02'),
        timezone: 'America/Los_Angeles',
      });

      // Then
      // 11월은 로스앤젤레스가 UTC-8이다
      expect(seoul.scheduledAt).toBe('2026-11-02T07:30:00.000Z');
      expect(losAngeles.scheduledAt).toBe('2026-11-03T00:30:00.000Z');
    });

    it('서머타임이 끝나는 날에도 벽시계 그대로의 순간을 만든다', () => {
      // Given
      // 미국 서머타임이 끝나는 2026-11-01의 로스앤젤레스 오후 3시
      const input = createParentTodo({ ...BASE, localTime: '15:00', isAllDay: false });

      // When
      const todo = WeatherBriefingPolicy.toBriefingTodo(input, {
        date: createDateKey('2026-11-01'),
        timezone: 'America/Los_Angeles',
      });

      // Then
      // 표준시 UTC-8로 읽는다
      expect(todo.scheduledAt).toBe('2026-11-01T23:00:00.000Z');
    });

    it('서머타임이 시작하는 날 뉴욕 02:30 할 일은 예보 칸을 전환 뒤 순간으로 찾고 보이는 시각은 02:30 그대로다', () => {
      // Given
      // 2027-03-14 뉴욕은 02:00 EST에서 03:00 EDT로 넘어가 02:30이 없다
      const input = createParentTodo({ ...BASE, localTime: '02:30', isAllDay: false });
      const { hourly } = createWeatherReport({
        hourly: createHourlySeries('2027-03-14T07:00:00.000Z', [10, 10]),
      });

      // When
      const todo = WeatherBriefingPolicy.toBriefingTodo(input, {
        date: createDateKey('2027-03-14'),
        timezone: 'America/New_York',
      });
      const [forecastTodo] = WeatherBriefingPolicy.getForecastTodos(
        hourly,
        [todo],
        toInstant('2027-03-14T05:00:00.000Z'),
      );

      // Then
      // 순간은 03:30 EDT라 03시(07:00Z) 칸의 예보를 쓰지만 줄에는 "오전 2:30"이 보인다
      expect(todo.scheduledAt).toBe('2027-03-14T07:30:00.000Z');
      expect(forecastTodo?.hour.startsAt).toBe('2027-03-14T07:00:00.000Z');
      expect(forecastTodo?.localTime).toBe('02:30');
    });

    it('하위 할 일이 있으면 진행을, 없으면 null을 담는다', () => {
      // Given
      const base = { ...BASE, title: '이사 준비', localTime: null, isAllDay: true };

      // When
      const withSubTodos = WeatherBriefingPolicy.toBriefingTodo(
        createParentTodo({
          ...base,
          subTodos: [1, 2, 3].map((id) => createSubTodo({ id, completed: id === 1 })),
        }),
        SEOUL,
      );
      const withoutSubTodos = WeatherBriefingPolicy.toBriefingTodo(
        createParentTodo({ ...base, subTodos: [] }),
        SEOUL,
      );

      // Then
      expect(withSubTodos.subTodoProgress).toEqual({ completed: 1, total: 3 });
      expect(withoutSubTodos.subTodoProgress).toBeNull();
    });
  });

  describe('findSuggestedStartAt', () => {
    const RANGE = {
      startsAt: toInstant('2026-11-02T06:00:00.000Z'),
      endsAt: toInstant('2026-11-02T08:00:00.000Z'),
    };
    const { hourly: HOURLY } = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 10, 10]),
    });

    it('추천 시간대가 이미 시작됐으면 다음 예보 시각을 제안한다', () => {
      // When
      const startAt = WeatherBriefingPolicy.findSuggestedStartAt(RANGE, HOURLY, NOW);

      // Then
      // 15~17시 추천을 15:26에 고르면 다음 정시는 16시다
      expect(startAt).toBe('2026-11-02T07:00:00.000Z');
    });

    it('추천 시간대의 예보 시각이 모두 지났으면 제안하지 않는다', () => {
      // Given
      const lateNow = toInstant('2026-11-02T07:10:00.000Z');

      // When
      const startAt = WeatherBriefingPolicy.findSuggestedStartAt(RANGE, HOURLY, lateNow);

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
      const startAt = WeatherBriefingPolicy.findSuggestedStartAt(offsetRange, offsetHourly, NOW);

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
      const todo = createForecastTodo({ scheduledAt: toInstant(scheduledAt) });

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
        createForecastTodo({ todoId: 1, completed: false }),
        createForecastTodo({ todoId: 2, completed: true }),
        createForecastTodo({ todoId: 3, completed: false }),
      ];

      // When
      const ids = WeatherBriefingPolicy.getUncompletedTodoIds(todos);

      // Then
      expect(ids).toEqual([1, 3]);
    });
  });
});
