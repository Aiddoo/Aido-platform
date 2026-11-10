import { toInstant } from '@src/shared/date/instant';

import {
  createBriefingDto,
  createBriefingTodo,
  createHourlySeries,
  createRescheduleOptionDto,
  createWeatherReport,
} from '../__tests__/weather-report.fixtures';
import { WeatherReschedulePolicy } from './weather-reschedule.model';

/** 서울 15:26. 16~18시(07:00Z~09:00Z) 비, 나머지는 맑다. */
const NOW = toInstant('2026-11-02T06:26:00.000Z');
const HOURLY = createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 30, 10, 10, 60]);
/** 서버가 16:30 할 일 1만 비와 겹친다고 보고 19시·21시를 후보로 고른다 */
const SERVER_BRIEFING = createBriefingDto({
  reason: 'rain',
  affectedTodoIds: [1],
  rescheduleOptions: [
    {
      todoId: 1,
      options: [
        createRescheduleOptionDto('2026-11-02T10:00:00.000Z', { isRecommended: true }),
        createRescheduleOptionDto('2026-11-02T12:00:00.000Z'),
      ],
    },
  ],
});
const report = createWeatherReport({ hourly: HOURLY, briefing: SERVER_BRIEFING });

describe('getRescheduleTodos', () => {
  const todos = [
    createBriefingTodo({ id: 1, scheduledAt: toInstant('2026-11-02T07:30:00.000Z') }),
    createBriefingTodo({ id: 2, scheduledAt: toInstant('2026-11-02T08:30:00.000Z') }),
  ];

  it('링크가 가리킨 할 일 중 서버가 고른 할 일만 서버 후보와 함께 돌려준다', () => {
    // When
    const affected = WeatherReschedulePolicy.getRescheduleTodos(report, todos, {
      now: NOW,
      linkedTodoIds: [1, 2],
    });

    // Then
    // 2도 예보상 비 시간이지만 서버가 고르지 않았다
    expect(affected.map((todo) => todo.todoId)).toEqual([1]);
    expect(affected[0]?.rescheduleOptions.map((option) => option.startsAt)).toEqual([
      '2026-11-02T10:00:00.000Z',
      '2026-11-02T12:00:00.000Z',
    ]);
  });

  it('링크의 이유나 할 일이 지금 브리핑과 달라도 지금 브리핑의 영향받는 할 일을 보여 준다', () => {
    // Given
    const heatReport = createWeatherReport({
      hourly: HOURLY,
      briefing: { ...SERVER_BRIEFING, reason: 'heat' },
    });

    // When
    const affected = WeatherReschedulePolicy.getRescheduleTodos(heatReport, todos, {
      now: NOW,
      linkedTodoIds: [2],
    });

    // Then
    expect(affected.map((todo) => todo.todoId)).toEqual([1]);
  });

  it('지금 브리핑에 영향받는 할 일이 없으면 비운다', () => {
    // Given
    const emptyReport = createWeatherReport({
      hourly: HOURLY,
      briefing: createBriefingDto({ reason: null, affectedTodoIds: [], rescheduleOptions: [] }),
    });

    // When
    const affected = WeatherReschedulePolicy.getRescheduleTodos(emptyReport, todos, {
      now: NOW,
      linkedTodoIds: [1],
    });

    // Then
    expect(affected).toEqual([]);
  });

  it('서버가 판단하지 못한 리포트로는 할 일을 다시 고르지 않는다', () => {
    // Given
    const noBriefing = createWeatherReport({ hourly: HOURLY, briefing: undefined });

    // When
    const affected = WeatherReschedulePolicy.getRescheduleTodos(noBriefing, todos, {
      now: NOW,
      linkedTodoIds: [1],
    });

    // Then
    expect(affected).toEqual([]);
  });

  it('시트를 연 사이 끝낸 할 일은 옮기지 않는다', () => {
    // Given
    const completed = [createBriefingTodo({ id: 1, completed: true })];

    // When
    const affected = WeatherReschedulePolicy.getRescheduleTodos(report, completed, {
      now: NOW,
      linkedTodoIds: [1],
    });

    // Then
    expect(affected).toEqual([]);
  });
});

describe('getUpcomingOptions', () => {
  it('리포트를 받은 뒤 정시를 넘겨 지난 후보는 빼고 서버 순서를 지킨다', () => {
    // Given
    const options = report.briefing?.rescheduleOptions[0]?.options ?? [];

    // When
    const upcoming = WeatherReschedulePolicy.getUpcomingOptions(
      options,
      toInstant('2026-11-02T10:00:00.000Z'),
    );

    // Then
    expect(upcoming.map((option) => option.startsAt)).toEqual(['2026-11-02T12:00:00.000Z']);
  });
});

describe('findNextRescheduleOption', () => {
  it('지난 선택을 바꿀 다음 후보는 그 할 일의 아직 지나지 않은 첫 서버 후보다', () => {
    // When
    const next = WeatherReschedulePolicy.findNextRescheduleOption(report.briefing, {
      todoId: 1,
      now: toInstant('2026-11-02T10:00:30.000Z'),
    });

    // Then
    expect(next?.startsAt).toBe('2026-11-02T12:00:00.000Z');
  });

  it.each([
    { title: '서버 후보가 모두 지났으면', todoId: 1, now: '2026-11-02T12:00:30.000Z' },
    { title: '서버 후보가 없는 할 일이면', todoId: 2, now: '2026-11-02T06:26:00.000Z' },
  ])('$title 바꿀 후보가 없다', ({ todoId, now }) => {
    // When
    const next = WeatherReschedulePolicy.findNextRescheduleOption(report.briefing, {
      todoId,
      now: toInstant(now),
    });

    // Then
    expect(next).toBeNull();
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
    // Given
    // 15번은 목록에서 사라졌다
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

describe('getExpiredTargets', () => {
  const todo = { id: 12, completed: false };

  it('시트를 연 채 정시를 넘겨 지난 시각이 된 선택만 가려낸다', () => {
    // Given
    const targets = [
      { todo, startsAt: toInstant('2026-11-02T07:00:00.000Z') },
      { todo: { id: 15, completed: false }, startsAt: toInstant('2026-11-02T09:00:00.000Z') },
    ];

    // When
    const expired = WeatherReschedulePolicy.getExpiredTargets(
      targets,
      toInstant('2026-11-02T07:00:30.000Z'),
    );

    // Then
    expect(expired.map(({ todo: expiredTodo }) => expiredTodo.id)).toEqual([12]);
  });

  it('아직 오지 않은 시각이면 아무것도 가려내지 않는다', () => {
    // When
    const expired = WeatherReschedulePolicy.getExpiredTargets(
      [{ todo, startsAt: toInstant('2026-11-02T08:00:00.000Z') }],
      toInstant('2026-11-02T07:59:59.000Z'),
    );

    // Then
    expect(expired).toEqual([]);
  });
});
