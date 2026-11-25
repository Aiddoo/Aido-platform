import { createDateKey } from '@src/testing/date-key';

import type { TodoRepeat } from './todo-repeat.model';
import {
  createTodoDateSpan,
  findPeriodEndDate,
  findScheduledTime,
  findShiftedEndDate,
  hasScheduledTimeChanged,
  type TodoSchedule,
  TodoSchedulePolicy,
} from './todo-schedule.model';

describe('createTodoDateSpan', () => {
  it('하루짜리는 시작일이 끝날이고 여러 날은 끝날을 그대로 쓴다', () => {
    // Given
    const startDate = createDateKey('2026-11-05');

    // When
    const oneDay = createTodoDateSpan(startDate, null);
    const multiDay = createTodoDateSpan(startDate, createDateKey('2026-11-07'));

    // Then
    expect(oneDay).toEqual({ startDate: '2026-11-05', endDate: '2026-11-05' });
    expect(multiDay).toEqual({ startDate: '2026-11-05', endDate: '2026-11-07' });
  });
});

describe('findScheduledTime', () => {
  it.each([
    ['시각이 있는 할 일은 그 시각이다', false, '10:00', '10:00'],
    ['종일이면 남아 있는 시각을 버린다', true, '10:00', null],
    ['시각을 고르지 않았으면 없다', false, null, null],
  ])('%s', (_case, isAllDay, scheduledTime, expected) => {
    // When
    const time = findScheduledTime(isAllDay, scheduledTime);

    // Then
    expect(time).toBe(expected);
  });
});

describe('findPeriodEndDate', () => {
  const endDate = createDateKey('2026-11-07');

  it.each([
    ['반복이 아니면 끝 날짜를 지킨다', endDate, false, endDate],
    ['반복이면 끝 날짜를 지운다', endDate, true, null],
    ['하루짜리는 반복이 아니어도 끝 날짜가 없다', null, false, null],
  ])('%s', (_case, periodEndDate, isRepeating, expected) => {
    // When
    const result = findPeriodEndDate(periodEndDate, isRepeating);

    // Then
    expect(result).toBe(expected);
  });
});

describe('findShiftedEndDate', () => {
  it('날짜를 옮겨도 기간 길이를 유지하고 하루짜리는 null이다', () => {
    // Given
    const multiDay = {
      startDate: createDateKey('2026-11-05'),
      endDate: createDateKey('2026-11-07'),
    };
    const oneDay = { startDate: createDateKey('2026-11-05'), endDate: null };

    // When
    const shifted = findShiftedEndDate(
      multiDay.startDate,
      multiDay.endDate,
      createDateKey('2026-11-29'),
    );
    const unchanged = findShiftedEndDate(
      oneDay.startDate,
      oneDay.endDate,
      createDateKey('2026-11-29'),
    );

    // Then
    expect(shifted).toBe('2026-12-01');
    expect(unchanged).toBeNull();
  });
});

describe('hasScheduledTimeChanged', () => {
  it.each([
    {
      title: '시각이 같으면 바뀐 것이 아니다',
      next: ['10:00', false],
      previous: ['10:00', false],
      expected: false,
    },
    {
      title: '시각이 다르면 바뀐 것이다',
      next: ['11:00', false],
      previous: ['10:00', false],
      expected: true,
    },
    {
      title: '종일에서 시각으로 바꾸면 바뀐 것이다',
      next: ['10:00', false],
      previous: [null, true],
      expected: true,
    },
    {
      title: '시각에서 종일로 바꾸면 남은 시각이 같아도 바뀐 것이다',
      next: ['10:00', true],
      previous: ['10:00', false],
      expected: true,
    },
    {
      title: '종일끼리는 남은 시각 값이 달라도 바뀐 것이 아니다',
      next: ['11:00', true],
      previous: [null, true],
      expected: false,
    },
  ] as const)('$title', ({ next, previous, expected }) => {
    // Given
    const [nextTime, nextIsAllDay] = next;
    const [previousTime, previousIsAllDay] = previous;

    // When
    const result = hasScheduledTimeChanged(
      { scheduledTime: nextTime, isAllDay: nextIsAllDay },
      { scheduledTime: previousTime, isAllDay: previousIsAllDay },
    );

    // Then
    expect(result).toBe(expected);
  });
});

describe('TodoSchedulePolicy', () => {
  describe('withStartDate', () => {
    const schedule = (overrides: Partial<TodoSchedule> = {}): TodoSchedule => ({
      startDate: createDateKey('2026-11-05'),
      endDate: null,
      scheduledTime: null,
      isAllDay: true,
      repeat: null,
      ...overrides,
    });

    it.each([
      {
        label: '평일',
        startDate: '2026-11-05',
        endDate: '2026-11-07',
        movedTo: '2026-11-10',
        expected: '2026-11-12',
      },
      {
        label: 'LA 서머타임이 끝나는 날(25시간)을 낀 기간',
        startDate: '2026-10-31',
        endDate: '2026-11-02',
        movedTo: '2026-11-01',
        expected: '2026-11-03',
      },
      {
        label: 'LA 서머타임이 시작하는 날(23시간)을 낀 기간',
        startDate: '2026-03-07',
        endDate: '2026-03-09',
        movedTo: '2026-03-08',
        expected: '2026-03-10',
      },
      {
        label: '연말을 넘는 기간',
        startDate: '2026-12-30',
        endDate: '2027-01-02',
        movedTo: '2027-02-27',
        expected: '2027-03-02',
      },
    ])(
      '시작일을 옮기면 기간 일수를 유지한다: $label',
      ({ startDate, endDate, movedTo, expected }) => {
        // When
        const result = TodoSchedulePolicy.withStartDate(
          schedule({ startDate: createDateKey(startDate), endDate: createDateKey(endDate) }),
          createDateKey(movedTo),
          {
            isSeriesOccurrence: false,
          },
        );

        // Then
        expect(result).toMatchObject({ startDate: movedTo, endDate: expected });
      },
    );

    it('반복 회차의 날짜를 옮기면 반복 규칙은 그대로 둔다', () => {
      // Given
      const repeat: TodoRepeat = { frequency: 'MONTHLY', monthDay: 5, end: { type: 'NEVER' } };

      // When
      const result = TodoSchedulePolicy.withStartDate(
        schedule({ repeat }),
        createDateKey('2026-11-09'),
        {
          isSeriesOccurrence: true,
        },
      );

      // Then
      expect(result.repeat).toBe(repeat);
    });
  });

  describe('withRepeat', () => {
    it('반복으로 바꾸면 기간(끝 날짜)을 지운다', () => {
      // When
      const result = TodoSchedulePolicy.withRepeat(
        {
          startDate: createDateKey('2026-11-05'),
          endDate: createDateKey('2026-11-07'),
          scheduledTime: null,
          isAllDay: true,
          repeat: null,
        },
        {
          startDate: createDateKey('2026-11-05'),
          repeat: { frequency: 'DAILY', end: { type: 'NEVER' } },
        },
      );

      // Then
      expect(result.endDate).toBeNull();
    });
  });
});
