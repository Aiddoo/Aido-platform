import {
  diffCalendarWeeks,
  getCalendarMonthRanges,
  getMonthWeekStartKeys,
  getWeekStartKey,
  shiftCalendarDateKey,
} from './calendar-grid';

describe('getWeekStartKey', () => {
  it.each([
    ['2026-10-03', '2026-09-27'],
    ['2026-10-04', '2026-10-04'],
    ['2027-01-01', '2026-12-27'],
    ['2028-02-29', '2028-02-27'],
  ])('%s의 주는 일요일 %s부터 시작한다', (dateKey, expected) => {
    // When
    const weekStartKey = getWeekStartKey(dateKey);

    // Then
    expect(weekStartKey).toBe(expected);
  });
});

describe('getMonthWeekStartKeys', () => {
  it.each([
    ['2026-07-01', 5],
    ['2026-08-01', 6],
    ['2026-02-15', 4],
  ])('%s의 달은 걸친 주가 %i개다', (dateKey, expected) => {
    // When
    const weeks = getMonthWeekStartKeys(dateKey);

    // Then
    expect(weeks).toHaveLength(expected);
  });

  it('최소 주 수보다 적으면 뒤로 주를 붙여 쪽 높이를 맞춘다', () => {
    // When
    const weeks = getMonthWeekStartKeys('2026-02-15', 6);

    // Then
    expect(weeks).toEqual([
      '2026-02-01',
      '2026-02-08',
      '2026-02-15',
      '2026-02-22',
      '2026-03-01',
      '2026-03-08',
    ]);
  });
});

describe('getCalendarMonthRanges', () => {
  it('고른 날의 달·앞 달·다음 달을 일요일 시작 주까지 채운 범위로 준다', () => {
    // When
    const ranges = getCalendarMonthRanges('2026-10-26');

    // Then
    expect(ranges).toEqual({
      selected: { startDate: '2026-09-27', endDate: '2026-10-31' },
      neighbors: [
        { startDate: '2026-08-30', endDate: '2026-10-03' },
        { startDate: '2026-11-01', endDate: '2026-12-05' },
      ],
    });
  });

  it('같은 달의 어느 날을 골라도 같은 범위라 달 안에서 날짜를 옮겨도 키가 같다', () => {
    // When
    const first = getCalendarMonthRanges('2026-10-01');
    const last = getCalendarMonthRanges('2026-10-31');

    // Then
    expect(first).toEqual(last);
  });
});

describe('diffCalendarWeeks', () => {
  it.each([
    ['같은 주', '2026-04-13', '2026-04-16', 0],
    ['다음 주', '2026-04-13', '2026-04-20', 1],
    ['이전 주', '2026-04-13', '2026-04-06', -1],
    ['요일이 달라도 주로 센다', '2026-04-13', '2026-04-30', 2],
  ])('%s', (_title, from, to, expected) => {
    // When
    const weeks = diffCalendarWeeks(from, to);

    // Then
    expect(weeks).toBe(expected);
  });
});

describe('shiftCalendarDateKey', () => {
  it('주 보기는 고른 날이 속한 주의 일요일에서 한 주 옮긴다', () => {
    // When
    const next = shiftCalendarDateKey({ viewMode: 'week', dateKey: '2026-10-14', step: 1 });
    const previous = shiftCalendarDateKey({ viewMode: 'week', dateKey: '2026-10-14', step: -1 });

    // Then
    expect(next).toBe('2026-10-18');
    expect(previous).toBe('2026-10-04');
  });

  it('월 보기는 고른 날이 속한 달의 1일에서 한 달 옮긴다', () => {
    // When
    const next = shiftCalendarDateKey({ viewMode: 'month', dateKey: '2026-10-14', step: 1 });
    const previous = shiftCalendarDateKey({ viewMode: 'month', dateKey: '2026-10-14', step: -1 });

    // Then
    expect(next).toBe('2026-11-01');
    expect(previous).toBe('2026-09-01');
  });
});
