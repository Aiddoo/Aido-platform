import { getTodoSummaryRefetchInterval, shouldPersistTodosByDate } from './todo.queries';

describe('shouldPersistTodosByDate', () => {
  const todayKey = '2026-11-03';

  it.each(['2026-11-02', '2026-11-03', '2026-11-04'])('%s 목록은 기기에 남긴다', (date) => {
    // When
    const result = shouldPersistTodosByDate({ date, todayKey });

    // Then
    expect(result).toBe(true);
  });

  it.each(['2026-11-01', '2026-11-05', '2026-10-03'])('%s 목록은 남기지 않는다', (date) => {
    // When
    const result = shouldPersistTodosByDate({ date, todayKey });

    // Then
    expect(result).toBe(false);
  });

  it('달이 바뀌는 날에도 앞뒤 하루를 남긴다', () => {
    // When
    const monthEnd = shouldPersistTodosByDate({ date: '2026-10-31', todayKey: '2026-11-01' });
    const yearEnd = shouldPersistTodosByDate({ date: '2027-01-01', todayKey: '2026-12-31' });

    // Then
    expect(monthEnd).toBe(true);
    expect(yearEnd).toBe(true);
  });
});

describe('getTodoSummaryRefetchInterval', () => {
  const success = (responseDate: string, dataUpdateCount = 1) =>
    ({
      data: { date: responseDate },
      status: 'success',
      dataUpdateCount,
      errorUpdateCount: 0,
    }) as const;

  it('오늘 요청에 전날 요약이 오면 서버가 날짜를 따라잡을 때까지 짧게 다시 묻는다', () => {
    // Given
    const state = success('2026-07-12');

    // When
    const interval = getTodoSummaryRefetchInterval(state, '2026-07-13');

    // Then
    expect(interval).toBe(5_000);
  });

  it('요청한 날짜의 요약이 오면 다시 묻지 않는다', () => {
    // Given
    const state = success('2026-07-13');

    // When
    const interval = getTodoSummaryRefetchInterval(state, '2026-07-13');

    // Then
    expect(interval).toBe(false);
  });

  it('따라잡지 못한 채 네 번 물었으면 더 묻지 않는다', () => {
    // Given
    const state = success('2026-07-12', 5);

    // When
    const interval = getTodoSummaryRefetchInterval(state, '2026-07-13');

    // Then
    expect(interval).toBe(false);
  });
});
