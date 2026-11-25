import {
  createParentTodo,
  createSubTodo,
} from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import { toInstant } from '@src/shared/date/instant';
import { createDateKey } from '@src/testing/date-key';

import { createHourlySeries, createWeatherReport } from '../__tests__/weather-report.fixtures';
import { createWeatherForecastTodos } from '../domains/weather-briefing.model';
import { toWeatherBriefingTodo } from './weather-briefing.mapper';

/** 서울 15:26 */
const NOW = toInstant('2026-11-02T06:26:00.000Z');
const HOURLY_FORECAST = createWeatherReport({
  hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]),
}).hourly;

describe('toWeatherBriefingTodo', () => {
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
    const todo = toWeatherBriefingTodo(createParentTodo({ ...BASE, ...schedule }), SEOUL);

    // Then
    expect(todo.scheduledAt).toEqual(expected);
  });

  it('어제 시작한 여러 날 할 일도 보고 있는 오늘의 벽시계로 본다', () => {
    // Given
    // 어제(11-01)부터 모레까지 이어지는 16:30 할 일을 오늘 목록에서 본다
    const input = createParentTodo({ ...BASE, localTime: '16:30', isAllDay: false });

    // When
    const todo = toWeatherBriefingTodo(input, SEOUL);
    const forecastTodos = createWeatherForecastTodos([todo], HOURLY_FORECAST, NOW);

    // Then
    // 시작일이 아니라 오늘 16:30이라 지난 시각으로 버려지지 않는다
    expect(todo.scheduledAt).toBe('2026-11-02T07:30:00.000Z');
    expect(forecastTodos).toHaveLength(1);
  });

  it('같은 벽시계도 기기 시간대가 다르면 다른 순간으로 만든다', () => {
    // Given
    const input = createParentTodo({ ...BASE, localTime: '16:30', isAllDay: false });

    // When
    const seoul = toWeatherBriefingTodo(input, SEOUL);
    const losAngeles = toWeatherBriefingTodo(input, {
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
    const todo = toWeatherBriefingTodo(input, {
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
    const todo = toWeatherBriefingTodo(input, {
      date: createDateKey('2027-03-14'),
      timezone: 'America/New_York',
    });
    const [forecastTodo] = createWeatherForecastTodos(
      [todo],
      hourly,
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
    const withSubTodos = toWeatherBriefingTodo(
      createParentTodo({
        ...base,
        subTodos: [1, 2, 3].map((id) => createSubTodo({ id, completed: id === 1 })),
      }),
      SEOUL,
    );
    const withoutSubTodos = toWeatherBriefingTodo(
      createParentTodo({ ...base, subTodos: [] }),
      SEOUL,
    );

    // Then
    expect(withSubTodos.subTodoProgress).toEqual({ completed: 1, total: 3 });
    expect(withoutSubTodos.subTodoProgress).toBeNull();
  });
});
