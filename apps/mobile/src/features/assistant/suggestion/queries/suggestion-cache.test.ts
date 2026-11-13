import { REPORT_QUERY_KEYS } from '@src/features/insights/report/queries/report-query-keys';
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
    queryClient.setQueryData(SUGGESTION_QUERY_KEYS.list(), []);
    queryClient.setQueryData(REPORT_QUERY_KEYS.status(), {
      daysUntilWeekly: 1,
      daysUntilMonthly: 1,
    });

    // When
    await invalidateAiSuggestions(queryClient);

    // Then
    expect(queryClient.getQueryState(SUGGESTION_QUERY_KEYS.list())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(REPORT_QUERY_KEYS.status())?.isInvalidated).toBe(false);
  });
});
