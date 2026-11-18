import { REPORT_QUERY_KEYS } from '@src/features/insights/report/queries/report-query-keys';
import { toInstant } from '@src/shared/date/instant';
import { createTestQueryClient } from '@src/testing/core';
import type { QueryClient } from '@tanstack/react-query';

import { invalidateAiSuggestions } from './suggestion-cache';
import { SUGGESTION_QUERY_KEYS } from './suggestion-query-keys';

describe('invalidateAiSuggestions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('추천 목록만 다시 불러오고 리포트 상태는 그대로 둔다', async () => {
    // Given
    queryClient.setQueryData(SUGGESTION_QUERY_KEYS.list(), { suggestions: [], analysis: null });
    queryClient.setQueryData(REPORT_QUERY_KEYS.status(), {
      nextWeeklyAt: toInstant('2026-03-09T02:30:00.000Z'),
      nextMonthlyAt: toInstant('2026-04-01T02:30:00.000Z'),
    });

    // When
    await invalidateAiSuggestions(queryClient);

    // Then
    expect(queryClient.getQueryState(SUGGESTION_QUERY_KEYS.list())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(REPORT_QUERY_KEYS.status())?.isInvalidated).toBe(false);
  });
});
