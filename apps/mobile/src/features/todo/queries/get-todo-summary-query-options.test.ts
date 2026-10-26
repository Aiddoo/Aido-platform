import { createMockHttpClient } from '@src/shared/__tests__';
import { QueryClient, QueryObserver } from '@tanstack/react-query';

import { TodoService } from '../apis/todo.service';
import { getTodoSummaryQueryOptions } from './get-todo-summary-query-options';

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
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  async function fetchSummary(params: { date: string; todayDate: string }, responseDate: string) {
    const httpClient = createMockHttpClient();
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

  it('내일 요청에 오늘 요약이 오면 date를 모르는 이전 서버로 보고 다시 묻지 않는다', async () => {
    // Given
    const { query, refetchInterval } = await fetchSummary(
      { date: '2026-07-13', todayDate: '2026-07-12' },
      '2026-07-12',
    );

    // When
    const interval = refetchInterval(query);

    // Then
    expect(interval).toBe(false);
  });

  it('오늘 요청에 전날 요약이 오면 서버가 날짜를 따라잡을 때까지 짧게 다시 묻는다', async () => {
    // Given
    const { query, refetchInterval } = await fetchSummary(
      { date: '2026-07-13', todayDate: '2026-07-13' },
      '2026-07-12',
    );

    // When
    const interval = refetchInterval(query);

    // Then
    expect(interval).toBe(5_000);
  });

  it('요청한 날짜의 요약이 오면 다시 묻지 않는다', async () => {
    // Given
    const { query, refetchInterval } = await fetchSummary(
      { date: '2026-07-13', todayDate: '2026-07-12' },
      '2026-07-13',
    );

    // When
    const interval = refetchInterval(query);

    // Then
    expect(interval).toBe(false);
  });
});
