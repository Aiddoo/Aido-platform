import type { QueryClient } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys';

/** 구독 상태에 따라 한도·접근이 달라지는 AI 사용량과 추천을 다시 불러온다. */
export function invalidatePremiumAiQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.usage() }),
    queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.suggestions() }),
  ]);
}
