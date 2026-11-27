import { useSuggestionApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { emitTodoCreated } from '@src/core/events/todo-created';
import { isLimitedFeatureError } from '@src/features/billing/subscription/domains/entitlement.error';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { settleTodoBatchWrite } from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { formatDaysOfWeek } from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { t } from '@src/shared/i18n';
import { toLanguageOfIntlLocale } from '@src/shared/i18n/app-locales';
import { useAppToast } from '@src/shared/ui';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { SuggestionActionSource } from '../constants/suggestion.events';
import type { AiSuggestionActionInput } from '../schemas/suggestion-action-request.schema';
import {
  cancelAiSuggestionList,
  invalidateAiSuggestions,
  setSuggestionAnalysisInCache,
} from './suggestion-cache';
import { SUGGESTION_MUTATION_KEYS } from './suggestion-mutation-keys';

interface ActOnSuggestionVariables {
  suggestionId: number;
  input: AiSuggestionActionInput;
  source: SuggestionActionSource;
}

/** 한도·요금제 거절의 결제 안내는 부르는 곳이 `usePromptSuggestionLimit`으로 띄운다 */
export function useActOnSuggestionMutationOptions() {
  const suggestionApi = useSuggestionApi();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const dateFormatContext = useDateFormatContext();

  return mutationOptions({
    mutationKey: SUGGESTION_MUTATION_KEYS.actOnSuggestion(),
    // 수락 시트와 거절 버튼이 응답까지 돈다. 오프라인에 멈춰 두면 연결되는 순간 몰래 보내므로 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async ({ suggestionId, input }: ActOnSuggestionVariables) =>
      unwrap(await suggestionApi.actOnSuggestion(suggestionId, input)),
    onSuccess: (suggestion, { input, source }) => {
      trackEvent('ai_suggestion_acted', { action: input.action, source });
      toast.success(
        input.action === 'accept'
          ? t('ai:suggestions.toasts.accepted', {
              days: formatDaysOfWeek(
                suggestion.daysOfWeek,
                toLanguageOfIntlLocale(dateFormatContext.locale),
              ),
            })
          : t('ai:suggestions.toasts.rejected'),
      );
      if (input.action === 'accept') {
        emitTodoCreated();
        const accountId = getCachedMe(queryClient)?.id;
        if (accountId != null) {
          trackAttributedFeatureSuccess({ accountId, feature: 'ai_suggestion' });
        }
      }
    },
    onSettled: async (_result, error, { input }) => {
      if (input.action === 'accept' && error == null) {
        settleTodoBatchWrite(queryClient);
      }
      // 수락은 시트를 닫고 피드로 떠나고, 실패는 오프라인이면 다시 받기가 연결될 때까지 멈춰 기다리지 않는다
      if (input.action === 'accept' || error != null) {
        invalidateAiSuggestions(queryClient);
        return;
      }
      // 거절은 화면에 머무는 목록 행이라 행이 사라질 때까지 버튼을 꺼 둔다. 다시 눌러 요청이 또 가지 않게 한다
      await invalidateAiSuggestions(queryClient);
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

export function useRequestSuggestionAnalysisMutationOptions() {
  const suggestionApi = useSuggestionApi();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 버튼이 응답까지 돈다. 오프라인에 멈춰 두면 끝나지 않고 연결되는 순간 몰래 보내므로 바로 실패해 안내한다
    networkMode: 'always',
    mutationKey: SUGGESTION_MUTATION_KEYS.requestAnalysis(),
    mutationFn: async () => unwrap(await suggestionApi.requestAnalysis()),
    onMutate: () => cancelAiSuggestionList(queryClient),
    // 응답이 분석 상태를 모두 담고, 결과는 분석 중 상태의 refetchInterval이 받아 다시 받지 않는다
    onSuccess: (analysis) => {
      setSuggestionAnalysisInCache(queryClient, analysis);
    },
    onSettled: (_analysis, error) => {
      // 서버에 닿지 않은 실패는 다시 받기도 재시도·연결 대기로 길어진다. 기다리지 않아야 버튼을 바로 다시 누른다
      if (error != null) {
        invalidateAiSuggestions(queryClient);
      }
    },
    meta: { errorFeedback: { feature: 'ai', fallbackKey: 'ai:suggestions.toasts.retryLater' } },
  });
}
