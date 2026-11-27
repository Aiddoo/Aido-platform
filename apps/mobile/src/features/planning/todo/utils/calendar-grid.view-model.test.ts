import { createDateKey } from '@src/testing/date-key';

import { getCalendarMonthRanges, shiftCalendarDateKey } from './calendar-grid.view-model';

describe('getCalendarMonthRanges', () => {
  it('고른 날의 달·앞 달·다음 달을 일요일 시작 주까지 채운 범위로 준다', () => {
    // When
    const ranges = getCalendarMonthRanges(createDateKey('2026-10-26'));

    // Then
    expect(ranges).toEqual({
      selected: { startDate: '2026-09-27', endDate: '2026-10-31' },
      previous: { startDate: '2026-08-30', endDate: '2026-10-03' },
      next: { startDate: '2026-11-01', endDate: '2026-12-05' },
    });
  });

  it('같은 달의 어느 날을 골라도 같은 범위라 달 안에서 날짜를 옮겨도 키가 같다', () => {
    // When
    const first = getCalendarMonthRanges(createDateKey('2026-10-01'));
    const last = getCalendarMonthRanges(createDateKey('2026-10-31'));

    // Then
    expect(first).toEqual(last);
  });
});

describe('shiftCalendarDateKey', () => {
  it('주 보기는 고른 날이 속한 주의 일요일에서 한 주 옮긴다', () => {
    // When
    const next = shiftCalendarDateKey({
      viewMode: 'week',
      dateKey: createDateKey('2026-10-14'),
      step: 1,
    });
    const previous = shiftCalendarDateKey({
      viewMode: 'week',
      dateKey: createDateKey('2026-10-14'),
      step: -1,
    });

    // Then
    expect(next).toBe('2026-10-18');
    expect(previous).toBe('2026-10-04');
  });

  it('월 보기는 고른 날이 속한 달의 1일에서 한 달 옮긴다', () => {
    // When
    const next = shiftCalendarDateKey({
      viewMode: 'month',
      dateKey: createDateKey('2026-10-14'),
      step: 1,
    });
    const previous = shiftCalendarDateKey({
      viewMode: 'month',
      dateKey: createDateKey('2026-10-14'),
      step: -1,
    });

    // Then
    expect(next).toBe('2026-11-01');
    expect(previous).toBe('2026-09-01');
  });
});
