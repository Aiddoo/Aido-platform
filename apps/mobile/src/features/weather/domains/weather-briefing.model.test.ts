import { fromEpochMs, toInstant } from '@src/shared/date/instant';
import { range } from 'es-toolkit';

import {
  createBriefingTodo,
  createForecastTodo,
  createWeatherReportWithHours,
} from '../__tests__/weather-report.fixtures';
import {
  createWeatherForecastTodos,
  type WeatherAffectedTodo,
  type WeatherBriefing,
  WeatherBriefingPolicy,
} from './weather-briefing.model';

/** 서울 15:26 */
const NOW = toInstant('2026-11-02T06:26:00.000Z');
const DRY_HOURS = range(9).map(() => ({ precipitationChance: 10 }));

function createAffectedTodo(overrides: Partial<WeatherAffectedTodo> = {}): WeatherAffectedTodo {
  return { ...createForecastTodo(), rescheduleOptions: [], ...overrides };
}

function createOption(startsAt: string) {
  return {
    startsAt: toInstant(startsAt),
    precipitationChance: 10,
    apparentTemperature: 9.1,
    isRecommended: false,
  };
}

describe('createWeatherForecastTodos', () => {
  /** 06:00Z부터 4시간 예보 */
  const { hourly } = createWeatherReportWithHours(DRY_HOURS.slice(0, 4));

  it('시각이 정한 할 일을 그 시각이 속한 시간 예보와 묶는다', () => {
    // Given
    const todo = createBriefingTodo({ scheduledAt: toInstant('2026-11-02T07:30:00.000Z') });

    // When
    const [forecast] = createWeatherForecastTodos([todo], hourly, NOW);

    // Then
    expect(forecast?.todoId).toBe(todo.id);
    expect(forecast?.hour.startsAt).toBe('2026-11-02T07:00:00.000Z');
  });

  it('정각의 할 일은 그 정각에 시작하는 시간과 묶는다', () => {
    // Given
    const todo = createBriefingTodo({ scheduledAt: toInstant('2026-11-02T08:00:00.000Z') });

    // When
    const [forecast] = createWeatherForecastTodos([todo], hourly, NOW);

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
    const forecasts = createWeatherForecastTodos([atNow, justPassed], hourly, NOW);

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
    const forecasts = createWeatherForecastTodos([unscheduled, beyond], hourly, NOW);

    // Then
    expect(forecasts).toEqual([]);
  });

  it('끝낸 할 일도 완료 여부를 남겨 함께 보여 준다', () => {
    // Given
    const done = createBriefingTodo({ completed: true });

    // When
    const [forecast] = createWeatherForecastTodos([done], hourly, NOW);

    // Then
    expect(forecast?.completed).toBe(true);
  });
});

describe('WeatherBriefingPolicy', () => {
  describe('findRescheduleSuggestion', () => {
    it('완료한 할 일은 빼고 남은 할 일 ID만 순서대로 옮기기를 권한다', () => {
      // Given
      const briefing: WeatherBriefing = {
        kind: 'rainy',
        todos: [
          createAffectedTodo({ todoId: 1, completed: false }),
          createAffectedTodo({ todoId: 2, completed: true }),
          createAffectedTodo({ todoId: 3, completed: false }),
        ],
      };

      // When
      const suggestion = WeatherBriefingPolicy.findRescheduleSuggestion(briefing);

      // Then
      expect(suggestion).toEqual({ reason: 'rain', todoIds: [1, 3] });
    });

    it('더위와 겹친 할 일은 더위를 피해 옮기기를 권한다', () => {
      // Given
      const range = {
        startsAt: toInstant('2026-11-02T07:00:00.000Z'),
        endsAt: toInstant('2026-11-02T09:00:00.000Z'),
      };

      // When
      const suggestion = WeatherBriefingPolicy.findRescheduleSuggestion({
        kind: 'hot',
        todos: [createAffectedTodo({ todoId: 4 })],
        range,
        peakApparentTemperature: 36,
      });

      // Then
      expect(suggestion).toEqual({ reason: 'heat', todoIds: [4] });
    });

    it.each([
      {
        title: '겹친 할 일을 모두 끝냈으면',
        briefing: { kind: 'rainy', todos: [createAffectedTodo({ completed: true })] },
      },
      { title: '눈과 겹쳤으면', briefing: { kind: 'snowy', todos: [createAffectedTodo()] } },
      {
        title: '겹친 할 일이 없는 카드면',
        briefing: { kind: 'dry', todos: [createForecastTodo()] },
      },
    ] as const satisfies readonly { title: string; briefing: WeatherBriefing }[])(
      '$title 옮기기를 권하지 않는다',
      ({ briefing }) => {
        // When
        const suggestion = WeatherBriefingPolicy.findRescheduleSuggestion(briefing);

        // Then
        expect(suggestion).toBeNull();
      },
    );
  });

  describe('findNextOptionStart', () => {
    const briefing: WeatherBriefing = {
      kind: 'rainy',
      todos: [
        createAffectedTodo({
          todoId: 1,
          rescheduleOptions: [
            createOption('2026-11-02T10:00:00.000Z'),
            createOption('2026-11-02T12:00:00.000Z'),
          ],
        }),
        createAffectedTodo({ todoId: 2 }),
      ],
    };

    it.each([
      {
        title: '첫 후보가 남았으면 그 시각',
        todoId: 1,
        now: '2026-11-02T06:26:00.000Z',
        expected: '2026-11-02T10:00:00.000Z',
      },
      {
        title: '첫 후보가 지났으면 다음 후보',
        todoId: 1,
        now: '2026-11-02T10:00:00.000Z',
        expected: '2026-11-02T12:00:00.000Z',
      },
      {
        title: '후보가 모두 지났으면 없음',
        todoId: 1,
        now: '2026-11-02T12:00:00.000Z',
        expected: null,
      },
      {
        title: '서버 후보가 없는 할 일이면 없음',
        todoId: 2,
        now: '2026-11-02T06:26:00.000Z',
        expected: null,
      },
    ])('$title을 옮길 시각으로 고른다', ({ todoId, now, expected }) => {
      // When
      const startsAt = WeatherBriefingPolicy.findNextOptionStart(briefing, todoId, toInstant(now));

      // Then
      expect(startsAt).toBe(expected);
    });
  });

  describe('hasWetStarted', () => {
    it.each([
      { startsAt: '2026-11-02T06:26:00.000Z', expected: true },
      { startsAt: '2026-11-02T06:26:00.001Z', expected: false },
    ])(
      '오늘 $startsAt부터 온다는 비가 15:26에 이미 내리는지는 $expected다',
      ({ startsAt, expected }) => {
        // Given
        const briefing: WeatherBriefing = {
          kind: 'rainLater',
          todos: [],
          timing: { day: 'today', startsAt: toInstant(startsAt) },
          isSnow: false,
          isOvercast: true,
        };

        // When
        const hasStarted = WeatherBriefingPolicy.hasWetStarted(briefing, NOW);

        // Then
        expect(hasStarted).toBe(expected);
      },
    );

    it('내일 온다는 비는 아직 내리지 않는다', () => {
      // When
      const hasStarted = WeatherBriefingPolicy.hasWetStarted(
        {
          kind: 'rainLater',
          todos: [],
          timing: { day: 'tomorrow', dayPart: 'morning' },
          isSnow: false,
          isOvercast: false,
        },
        NOW,
      );

      // Then
      expect(hasStarted).toBe(false);
    });
  });

  describe('isTodoInClearWindow', () => {
    const clear = {
      kind: 'clear',
      todos: [],
      range: {
        startsAt: toInstant('2026-11-02T07:00:00.000Z'),
        endsAt: toInstant('2026-11-02T09:00:00.000Z'),
      },
      suggestedStartAt: null,
    } as const satisfies WeatherBriefing;

    it.each([
      ['2026-11-02T06:59:00.000Z', false],
      ['2026-11-02T07:00:00.000Z', true],
      ['2026-11-02T08:59:00.000Z', true],
      ['2026-11-02T09:00:00.000Z', false],
    ] as const)('할 일 시각이 %s이면 추천 시간대 안인지는 %s다', (scheduledAt, expected) => {
      // Given
      const todo = createForecastTodo({ scheduledAt: toInstant(scheduledAt) });

      // When
      const result = WeatherBriefingPolicy.isTodoInClearWindow(clear, todo);

      // Then
      expect(result).toBe(expected);
    });
  });
});
