import { useHaptics, useSuggestionService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { emitTodoCreated } from '@src/core/events/todo-created';
import { isLimitedFeatureError } from '@src/features/billing/subscription/domains/entitlement.error';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { invalidateTodos } from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { isSuggestionUnavailableError } from '../domains/suggestion.error';
import type { AiSuggestionActionInput } from '../schemas/suggestion-action-request.schema';
import { invalidateAiSuggestions } from './suggestion-cache';

interface ActOnSuggestionVariables {
  suggestionId: number;
  input: AiSuggestionActionInput;
}

export function useActOnSuggestionMutationOptions() {
  const haptics = useHaptics();
  const suggestionService = useSuggestionService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const gate = useEntitlementGate('AI_SUGGESTION', { surface: 'suggestions' });

  return mutationOptions({
    // 수락 시트와 거절 버튼이 응답까지 돈다. 오프라인에 멈춰 두면 연결되는 순간 몰래 보내므로 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async ({ suggestionId, input }: ActOnSuggestionVariables) =>
      unwrap(await suggestionService.actOnSuggestion(suggestionId, input)),
    onSuccess: async (_result, { input }) => {
      trackEvent('ai_suggestion_acted', { action: input.action });
      toast.success(
        input.action === 'accept'
          ? t('ai:suggestions.toasts.accepted')
          : t('ai:suggestions.toasts.rejected'),
      );

      if (input.action === 'accept') {
        emitTodoCreated();
        invalidateTodos(queryClient);
        // 수락하면 시트를 닫고 피드로 떠나므로 다시 받기를 기다리지 않는다
        invalidateAiSuggestions(queryClient);
        return;
      }

      // 거절은 화면에 머무는 목록 행이라 행이 사라질 때까지 버튼을 꺼 둔다. 다시 눌러 요청이 또 가지 않게 한다
      await invalidateAiSuggestions(queryClient);
    },
    onError: (error) => {
      if (gate.promptIfBlockedError(error)) {
        haptics.notify('error');
        return;
      }
      if (isSuggestionUnavailableError(error)) {
        invalidateAiSuggestions(queryClient);
      }
    },
    meta: {
      errorFeedback: {
        feature: 'ai',
        fallbackKey: 'ai:suggestions.toasts.retryLater',
        isHandledByFeature: isLimitedFeatureError,
      },
    },
  });
}
