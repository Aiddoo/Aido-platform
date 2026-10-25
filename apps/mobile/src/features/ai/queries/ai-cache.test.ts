import { QueryClient } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys';
import { invalidateAiSuggestions } from './ai-cache';

describe('invalidateAiSuggestions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('추천 목록만 다시 불러오고 AI 사용량은 그대로 둔다', async () => {
    // Given
    queryClient.setQueryData(AI_QUERY_KEYS.suggestions(), []);
    queryClient.setQueryData(AI_QUERY_KEYS.usage(), { used: 1 });

    // When
    await invalidateAiSuggestions(queryClient);

    // Then
    expect(queryClient.getQueryState(AI_QUERY_KEYS.suggestions())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(AI_QUERY_KEYS.usage())?.isInvalidated).toBe(false);
  });
});
