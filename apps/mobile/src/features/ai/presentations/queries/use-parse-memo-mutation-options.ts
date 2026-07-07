import { ErrorCode } from '@aido/errors';
import { useAiService } from '@src/bootstrap/providers/di-context';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys.constant';

interface ParseMemoParams {
  memoId: number;
  content: string;
  categoryId: number;
}

export const useParseMemoMutationOptions = () => {
  const aiService = useAiService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ content, categoryId }: ParseMemoParams) => {
      const result = await aiService.parseMemo(content, categoryId);
      return unwrap(result);
    },
    onSuccess: (data, { memoId }) => {
      trackEvent('ai_parse_used', { success: true });
      queryClient.setQueryData(AI_QUERY_KEYS.parseMemo(memoId), data);
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.aiUsage() });
    },
    onError: (error) => {
      trackEvent('ai_parse_used', { success: false });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.AI_1303)) {
        trackEvent('premium_gate_shown', { feature: 'ai_parse' });
        toast.error(t('ai:suggestions.toasts.quotaExceeded'));
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }

      toast.error(undefined, { fallback: t('ai:suggestions.toasts.retryLater') });
    },
  });
};
