import { ErrorCode } from '@aido/api/errors';
import { useAiService } from '@src/bootstrap/providers/di-context';
import type { AiService } from '@src/features/ai/apis/ai.service';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys';
import { isAiDataSharingConsentRequiredError } from '../domains/ai.error';

export function getSuggestionsQueryOptions(aiService: AiService) {
  return queryOptions({
    queryKey: AI_QUERY_KEYS.suggestions(),
    queryFn: async ({ signal }) => {
      const result = await aiService.getSuggestions(signal);
      return unwrap(result);
    },
    // 프리미엄 전용·동의 없음은 장애가 아니라 진입 카드가 안내로 바꿔 보인다
    throwOnError: (error, query) =>
      query.state.data == null &&
      !isSuggestionsPremiumRequiredError(error) &&
      !isAiDataSharingConsentRequiredError(error),
  });
}

export function useGetSuggestionsQueryOptions() {
  return getSuggestionsQueryOptions(useAiService());
}

export const isSuggestionsPremiumRequiredError = (error: unknown): boolean =>
  isApiError(error) && error.hasCode(ErrorCode.AI_1309);
