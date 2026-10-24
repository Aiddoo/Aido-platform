import { ErrorCode } from '@aido/api/errors';
import { useActivationService, useAiService, useLogger } from '@src/bootstrap/providers/di-context';
import { recordTodoCreatedForActivation } from '@src/features/activation/queries/activation-cache';
import type { AiSuggestionActionInput } from '@src/features/ai/domains/ai.model';
import { invalidateTodos } from '@src/features/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError, toError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { usePremiumDialog } from '@src/shared/ui';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { AI_LOG_EVENT } from '../constants/ai-log-events';
import { AI_QUERY_KEYS } from '../constants/ai-query-keys';

interface HandleSuggestionParams {
  suggestionId: number;
  input: AiSuggestionActionInput;
}

export const useHandleSuggestionMutationOptions = () => {
  const aiService = useAiService();
  const activationService = useActivationService();
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
    onSuccess: (_result, { input }) => {
      trackEvent('ai_suggestion_acted', { action: input.action });
      queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.suggestions() });

      if (input.action === 'accept') {
        recordTodoCreatedForActivation({ queryClient, service: activationService });
        invalidateTodos(queryClient);
      }

      toast.success(
        input.action === 'accept'
          ? t('ai:suggestions.toasts.accepted')
          : t('ai:suggestions.toasts.rejected'),
      );
    },
    onError: (error) => {
      notifyError();

      if (isApiError(error) && error.hasCode(ErrorCode.AI_1309)) {
        trackEvent('premium_gate_shown', { feature: 'ai_suggestion' });
        premiumDialog.open({
          description: t('ai:suggestions.toasts.premiumOnly'),
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

      logger.error(AI_LOG_EVENT.SUGGESTION_ACTION_FAILED, toError(error));
      toast.error(undefined, { fallback: t('ai:suggestions.toasts.retryLater') });
    },
  });
};
