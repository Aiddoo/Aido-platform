import { toInstant } from '@src/shared/date/instant';

import {
  createBriefingDto,
  createBriefingTodo,
  createHourlySeries,
  createRescheduleOptionDto,
  createWeatherReport,
} from '../__tests__/weather-report.fixtures';
import { filterByUpcomingOption } from './weather-report-briefing.model';
import { WeatherReportPolicy } from './weather-report.model';
import {
  getExpiredTargets,
  getRescheduleTargets,
  WeatherReschedulePolicy,
} from './weather-reschedule.model';

/** 서울 15:26. 16~18시(07:00Z~09:00Z) 비, 나머지는 맑다. */
const NOW = toInstant('2026-11-02T06:26:00.000Z');
const HOURLY = createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]);

describe('getRescheduleTargets', () => {
  const changes = [
    { todoId: 12, startsAt: toInstant('2026-11-02T10:00:00.000Z') },
    { todoId: 15, startsAt: toInstant('2026-11-02T12:00:00.000Z') },
  ];

  it('시트를 연 사이 지워진 할 일은 옮기지 않는다', () => {
    // Given
    // 15번은 목록에서 사라졌다
    const todos = [{ id: 12, completed: false }];

    // When
    const targets = getRescheduleTargets(changes, todos);

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
    const targets = getRescheduleTargets(changes, todos);

    // Then
    expect(targets.map(({ todo }) => todo.id)).toEqual([15]);
  });

  it('자정이 지나 오늘 목록에 없는 할 일만 남았으면 옮길 것이 없다', () => {
    // When
    const targets = getRescheduleTargets(changes, [{ id: 99, completed: false }]);

    // Then
    expect(targets).toEqual([]);
  });
});

describe('getExpiredTargets', () => {
  const todo = { id: 12, completed: false };

  it('시트를 연 채 정시를 넘겨 지난 시각이 된 선택만 가려낸다', () => {
    // Given
    const targets = [
      { todo, startsAt: toInstant('2026-11-02T07:00:00.000Z') },
      { todo: { id: 15, completed: false }, startsAt: toInstant('2026-11-02T09:00:00.000Z') },
    ];

    // When
    const expired = getExpiredTargets(targets, toInstant('2026-11-02T07:00:30.000Z'));

    // Then
    expect(expired.map(({ todo: expiredTodo }) => expiredTodo.id)).toEqual([12]);
  });

  it('아직 오지 않은 시각이면 아무것도 가려내지 않는다', () => {
    // When
    const expired = getExpiredTargets(
      [{ todo, startsAt: toInstant('2026-11-02T08:00:00.000Z') }],
      toInstant('2026-11-02T07:59:59.000Z'),
    );

    // Then
    expect(expired).toEqual([]);
  });
});

describe('getExpiredTargets·filterByUpcomingOption 정각 경계', () => {
  const STARTS_AT = '2026-11-02T08:00:00.000Z';
  const options =
    createWeatherReport({
      hourly: HOURLY,
      briefing: createBriefingDto({
        reason: 'rain',
        affectedTodoIds: [12],
        rescheduleOptions: [{ todoId: 12, options: [createRescheduleOptionDto(STARTS_AT)] }],
      }),
    }).briefing?.rescheduleOptions[0]?.options ?? [];
  const target = { todo: { id: 12, completed: false }, startsAt: toInstant(STARTS_AT) };

  it.each([
    { name: '1ms 전', now: '2026-11-02T07:59:59.999Z', isUpcoming: true, isExpired: false },
    { name: '정확히 그 시각', now: STARTS_AT, isUpcoming: false, isExpired: true },
    { name: '1ms 뒤', now: '2026-11-02T08:00:00.001Z', isUpcoming: false, isExpired: true },
  ])(
    '후보 시각의 $name이면 후보는 남는지 $isUpcoming, 선택은 지났는지 $isExpired',
    ({ now, isUpcoming, isExpired }) => {
      // When
      const upcoming = options.filter((option) => filterByUpcomingOption(option, toInstant(now)));
      const expired = getExpiredTargets([target], toInstant(now));

      // Then
      expect(upcoming.length === 1).toBe(isUpcoming);
      expect(expired.length === 1).toBe(isExpired);
    },
  );
});

describe('WeatherReschedulePolicy', () => {
  describe('getTodoIdsWithout', () => {
    /** 서버가 16:30 할 일 1과 17:30 할 일 2가 비와 겹친다고 본다 */
    const report = createWeatherReport({
      hourly: HOURLY,
      briefing: createBriefingDto({ reason: 'rain', affectedTodoIds: [1, 2] }),
    });
    const reschedule = WeatherReportPolicy.getReschedule(
      report,
      [
        createBriefingTodo({ id: 1, scheduledAt: toInstant('2026-11-02T07:30:00.000Z') }),
        createBriefingTodo({ id: 2, scheduledAt: toInstant('2026-11-02T08:30:00.000Z') }),
      ],
      { now: NOW, linkedTodoIds: [1, 2], linkedReason: 'rain' },
    );

    it('하나를 빼면 나머지 할 일만 서버 순서대로 남는다', () => {
      // When
      const remaining = WeatherReschedulePolicy.getTodoIdsWithout(reschedule, 1);

      // Then
      expect(remaining).toEqual([2]);
    });

    it('마지막 하나까지 빼면 옮길 할 일이 없다', () => {
      // Given
      const [onlyTodo] = reschedule.todos;
      const single = { ...reschedule, todos: onlyTodo == null ? [] : [onlyTodo] };

      // When
      const remaining = WeatherReschedulePolicy.getTodoIdsWithout(single, 1);

      // Then
      expect(remaining).toEqual([]);
    });
  });
});
