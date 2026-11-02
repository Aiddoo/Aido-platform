import { times } from 'es-toolkit/compat';

import { createHourlySeries, createWeatherReport } from '../__tests__/weather-report.factories';
import { type BriefingTodo, WeatherBriefingPolicy } from './weather-briefing.model';

/** 서울 15:26. 16~18시(07:00Z~09:00Z) 비, 나머지는 맑다. */
const NOW = new Date('2026-11-02T06:26:00.000Z');
const { hourly } = createWeatherReport({
  hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]),
});

function createTodo(overrides: Partial<BriefingTodo> = {}): BriefingTodo {
  return {
    id: 1,
    title: '산책',
    scheduledAt: new Date('2026-11-02T07:30:00.000Z'),
    completed: false,
    ...overrides,
  };
}

describe('WeatherBriefingPolicy.briefing', () => {
  it('시간이 정해진 할 일이 없으면 브리핑할 할 일이 없다고 알린다', () => {
    // When
    const briefing = WeatherBriefingPolicy.briefing(hourly, [], NOW);

    // Then
    expect(briefing).toEqual({ kind: 'noScheduledTodos' });
  });

  it('종일·시간 없는 할 일만 있으면 비와 겹치는지 판단하지 않는다', () => {
    // When
    const briefing = WeatherBriefingPolicy.briefing(
      hourly,
      [createTodo({ scheduledAt: null })],
      NOW,
    );

    // Then
    expect(briefing).toEqual({ kind: 'noScheduledTodos' });
  });

  it('할 일 하나가 비 오는 시간에 걸리면 그 할 일과 그 시간의 강수 확률을 돌려준다', () => {
    // When
    const briefing = WeatherBriefingPolicy.briefing(hourly, [createTodo()], NOW);

    // Then
    expect(briefing).toEqual({
      kind: 'rainy',
      rainyTodos: [
        {
          todoId: 1,
          title: '산책',
          scheduledAt: new Date('2026-11-02T07:30:00.000Z'),
          precipitationChance: 70,
          precipitationType: 'RAIN',
        },
      ],
    });
  });

  it('할 일 7개 중 비 오는 시간에 걸린 것만 고르고, 끝냈거나 지난 할 일은 뺀다', () => {
    // Given
    const todos = times(7, (index) =>
      createTodo({
        id: index + 1,
        scheduledAt: new Date(Date.parse('2026-11-02T05:30:00.000Z') + index * 60 * 60_000),
        completed: index === 2,
      }),
    );

    // When
    const briefing = WeatherBriefingPolicy.briefing(hourly, todos, NOW);

    // Then
    expect(briefing.kind).toBe('rainy');
    expect(briefing.kind === 'rainy' && briefing.rainyTodos.map((todo) => todo.todoId)).toEqual([
      4,
    ]);
  });

  it('시간이 정해진 할 일이 모두 맑은 시간이면 비를 피했다고 알린다', () => {
    // When
    const briefing = WeatherBriefingPolicy.briefing(
      hourly,
      [createTodo({ scheduledAt: new Date('2026-11-02T10:30:00.000Z') })],
      NOW,
    );

    // Then
    expect(briefing).toEqual({ kind: 'dry', scheduledCount: 1 });
  });
});

describe('WeatherBriefingPolicy.rescheduleOptions', () => {
  it('같은 날 지금 이후의 맑은 정시를 강수 확률이 낮고 원래 시각에 가까운 순으로 고르고 첫 번째를 추천한다', () => {
    // When
    const options = WeatherBriefingPolicy.rescheduleOptions(
      hourly,
      { scheduledAt: new Date('2026-11-02T07:30:00.000Z') },
      { now: NOW, timeZone: 'Asia/Seoul' },
    );

    // Then
    expect(options.map((option) => option.startsAt.toISOString())).toEqual([
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
    const options = WeatherBriefingPolicy.rescheduleOptions(
      rainyHours,
      { scheduledAt: new Date('2026-11-02T07:30:00.000Z') },
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
    const options = WeatherBriefingPolicy.rescheduleOptions(
      lateHours,
      { scheduledAt: new Date('2026-11-02T13:30:00.000Z') },
      { now: new Date('2026-11-02T13:10:00.000Z'), timeZone: 'Asia/Seoul' },
    );

    // Then
    expect(options.map((option) => option.startsAt.toISOString())).toEqual([
      '2026-11-02T14:00:00.000Z',
    ]);
  });
});

describe('WeatherBriefingPolicy.briefingTodo', () => {
  it.each([
    [
      { scheduledAtMs: Date.parse('2026-11-02T07:30:00.000Z'), isAllDay: false },
      new Date('2026-11-02T07:30:00.000Z'),
    ],
    [{ scheduledAtMs: Date.parse('2026-11-02T07:30:00.000Z'), isAllDay: true }, null],
    [{ scheduledAtMs: null, isAllDay: false }, null],
  ])('%o는 브리핑 시각 %s로 본다', (schedule, expected) => {
    // When
    const todo = WeatherBriefingPolicy.briefingTodo({
      id: 1,
      title: '산책',
      completed: false,
      ...schedule,
    });

    // Then
    expect(todo.scheduledAt).toEqual(expected);
  });
});
