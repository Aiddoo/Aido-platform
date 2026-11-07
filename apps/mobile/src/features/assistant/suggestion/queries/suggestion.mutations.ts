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
import { ApiError, getUserFacingMessage, toError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { SUGGESTION_LOG_EVENT } from '../constants/suggestion-log-events';
import { isSuggestionUnavailableError } from '../domains/suggestion.error';
import type { AiSuggestionActionInput } from '../schemas/suggestion.schema';
import { invalidateAiSuggestions } from './suggestion-cache';

interface ActOnSuggestionParams {
  suggestionId: number;
  input: AiSuggestionActionInput;
}

export function useActOnSuggestionMutationOptions() {
  const haptics = useHaptics();
  const suggestionService = useSuggestionService();
  const activationService = useActivationService();
  const { trackEvent } = useTrack();
  const logger = useLogger();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const gate = useEntitlementGate('AI_SUGGESTION', { surface: 'suggestions' });

  return mutationOptions({
    mutationFn: async ({ suggestionId, input }: ActOnSuggestionParams) =>
      unwrap(await suggestionService.actOnSuggestion(suggestionId, input)),
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
      if (gate.promptIfBlockedError(error)) {
        haptics.notify('error');
        return;
      }

      if (isSuggestionUnavailableError(error)) {
        invalidateAiSuggestions(queryClient);
      } else if (!(error instanceof ApiError)) {
        logger.error(SUGGESTION_LOG_EVENT.SUGGESTION_ACTION_FAILED, toError(error));
      }

      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('ai:suggestions.toasts.retryLater') });
    },
  });
}
