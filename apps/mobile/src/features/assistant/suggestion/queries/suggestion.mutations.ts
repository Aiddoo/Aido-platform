import {
  useActivationService,
  useHaptics,
  useLogger,
  useSuggestionService,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { recordTodoCreatedForActivation } from '@src/features/device/activation/queries/activation-cache';
import { invalidateTodos } from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError, toError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { SUGGESTION_LOG_EVENT } from '../constants/suggestion-log-events';
import { isSuggestionUnavailable } from '../domains/suggestion.error';
import type { AiSuggestionActionInput } from '../schemas/suggestion.schema';
import { invalidateAiSuggestions } from './suggestion-cache';

interface HandleSuggestionParams {
  suggestionId: number;
  input: AiSuggestionActionInput;
}

export function useHandleSuggestionMutationOptions() {
  const haptics = useHaptics();
  const suggestionService = useSuggestionService();
  const activationService = useActivationService();
  const { trackEvent } = useTrack();
  const logger = useLogger();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const gate = useEntitlementGate('AI_SUGGESTION', { surface: 'suggestions' });
  const showFailure = useMutationFailure(t('ai:suggestions.toasts.retryLater'));

  return mutationOptions({
    mutationFn: async ({ suggestionId, input }: HandleSuggestionParams) =>
      unwrap(await suggestionService.handleSuggestionAction(suggestionId, input)),
    onSuccess: (_result, { input }) => {
      trackEvent('ai_suggestion_acted', { action: input.action });
      invalidateAiSuggestions(queryClient);

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
      if (gate.handleError(error)) {
        haptics.notify('error');
        return;
      }

      if (isSuggestionUnavailable(error)) {
        invalidateAiSuggestions(queryClient);
      } else if (!isApiError(error)) {
        logger.error(SUGGESTION_LOG_EVENT.SUGGESTION_ACTION_FAILED, toError(error));
      }

      showFailure(error);
    },
  });
}
