import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import type { QueryClient } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys';
import { invalidateAiSuggestions } from './ai-cache';

describe('invalidateAiSuggestions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('추천 목록만 다시 불러오고 리포트 상태는 그대로 둔다', async () => {
    // Given
    queryClient.setQueryData(AI_QUERY_KEYS.suggestions(), []);
    queryClient.setQueryData(AI_QUERY_KEYS.status(), { status: 'READY' });

    // When
    await invalidateAiSuggestions(queryClient);

    // Then
    expect(queryClient.getQueryState(AI_QUERY_KEYS.suggestions())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(AI_QUERY_KEYS.status())?.isInvalidated).toBe(false);
  });
});
