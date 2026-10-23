import type { QueryClient } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys';
import type { ParsedMemoResult } from '../domains/ai.model';

/** 구독 상태에 따라 한도·접근이 달라지는 AI 사용량과 추천을 다시 불러온다. */
export function invalidatePremiumAiQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.usage() }),
    queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.suggestions() }),
  ]);
}

/** AI 검토 화면으로 넘길 메모 파싱 결과. 메모가 바뀌면 지운다. */
export function getParsedMemo(queryClient: QueryClient, { memoId }: { memoId: number }) {
  return queryClient.getQueryData<ParsedMemoResult>(AI_QUERY_KEYS.parseMemo({ memoId }));
}

export function clearParsedMemo(queryClient: QueryClient, { memoId }: { memoId: number }) {
  queryClient.removeQueries({ queryKey: AI_QUERY_KEYS.parseMemo({ memoId }) });
}

export function invalidateAiReports(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.status() }),
    queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.lists() }),
  ]);
}
