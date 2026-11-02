import type { QueryClient } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys';
import type { ParsedMemoResult } from '../domains/ai.model';

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

export function invalidateAiSuggestions(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.suggestions() });
}
