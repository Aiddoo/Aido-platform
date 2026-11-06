import { createHttpClientStub } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { QueryObserver, type QueryClient } from '@tanstack/react-query';

import { TodoService } from '../apis/todo.service';
import { shouldPersistTodosByDate } from './todo.queries';
import { getTodoSummaryQueryOptions } from './todo.queries';

describe('shouldPersistTodosByDate', () => {
  const todayKey = '2026-11-03';

  it.each(['2026-11-02', '2026-11-03', '2026-11-04'])('%s 목록은 기기에 남긴다', (date) => {
    // Given · When · Then
    expect(shouldPersistTodosByDate({ date, todayKey })).toBe(true);
  });

  it.each(['2026-11-01', '2026-11-05', '2026-10-03'])('%s 목록은 남기지 않는다', (date) => {
    // Given · When · Then
    expect(shouldPersistTodosByDate({ date, todayKey })).toBe(false);
  });

  it('달이 바뀌는 날에도 앞뒤 하루를 남긴다', () => {
    // Given · When · Then
    expect(shouldPersistTodosByDate({ date: '2026-10-31', todayKey: '2026-11-01' })).toBe(true);
    expect(shouldPersistTodosByDate({ date: '2027-01-01', todayKey: '2026-12-31' })).toBe(true);
  });
});

function createSummaryDto(date: string) {
  return {
    date,
    totalTodos: 0,
    completedTodos: 0,
    completionRate: 0,
    isComplete: false,
    currentStreak: 0,
    topTodos: [],
  };
}

describe('getTodoSummaryQueryOptions refetchInterval', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  async function fetchSummary(params: { date: string }, responseDate: string) {
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue({ ok: true, value: createSummaryDto(responseDate) });
    const options = getTodoSummaryQueryOptions(new TodoService(httpClient), params);
    await queryClient.fetchQuery(options);
    const query = new QueryObserver(queryClient, options).getCurrentQuery();
    const { refetchInterval } = options;
    if (typeof refetchInterval !== 'function') {
      throw new Error('refetchInterval이 함수가 아니다');
    }
    return { query, refetchInterval };
  }

  it('오늘 요청에 전날 요약이 오면 서버가 날짜를 따라잡을 때까지 짧게 다시 묻는다', async () => {
    // Given
    const { query, refetchInterval } = await fetchSummary({ date: '2026-07-13' }, '2026-07-12');

    // When
    const interval = refetchInterval(query);

    // Then
    expect(interval).toBe(5_000);
  });

  it('요청한 날짜의 요약이 오면 다시 묻지 않는다', async () => {
    // Given
    const { query, refetchInterval } = await fetchSummary({ date: '2026-07-13' }, '2026-07-13');

    // When
    const interval = refetchInterval(query);

    // Then
    expect(interval).toBe(false);
  });
});
