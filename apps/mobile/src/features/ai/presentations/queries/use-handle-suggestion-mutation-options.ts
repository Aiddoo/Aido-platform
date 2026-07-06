import { ErrorCode } from '@aido/errors';
import { useAiService, useLogger } from '@src/bootstrap/providers/di-context';
import type { AiSuggestionActionInput } from '@src/features/ai/models/ai.model';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-category-query-keys.constant';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { usePremiumDialog } from '@src/shared/ui';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys.constant';

interface HandleSuggestionParams {
  suggestionId: number;
  input: AiSuggestionActionInput;
}

export const useHandleSuggestionMutationOptions = () => {
  const aiService = useAiService();
  const { trackEvent } = useTrack();
  const logger = useLogger();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const premiumDialog = usePremiumDialog();

  return mutationOptions({
    mutationFn: async ({ suggestionId, input }: HandleSuggestionParams) => {
      const result = await aiService.handleSuggestionAction(suggestionId, input);
      return unwrap(result);
    },
    onSuccess: (result, { input }) => {
      trackEvent('ai_suggestion_acted', { action: input.action });
      queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.suggestions() });

      if (input.action === 'accept') {
        queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all });
        queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      }

      toast.success(result.message);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.AI_1309)) {
        trackEvent('premium_gate_shown', { feature: 'ai_suggestion' });
        premiumDialog.open({
          description: 'AI 반복 제안은 프리미엄 구독자만 이용할 수 있어요',
        });
        return;
      }

      if (
        isApiError(error) &&
        (error.hasCode(ErrorCode.AI_1305) ||
          error.hasCode(ErrorCode.AI_1306) ||
          error.hasCode(ErrorCode.AI_1307))
      ) {
        queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.suggestions() });
        toast.error(error.message);
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }

      logger.error('[AiSuggestion] Unexpected error', error instanceof Error ? error : undefined);
      toast.error(undefined, { fallback: '잠시 후 다시 시도해 주세요' });
    },
  });
};
