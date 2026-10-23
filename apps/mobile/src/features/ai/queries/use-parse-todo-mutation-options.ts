import { ErrorCode } from '@aido/api/errors';
import { useAiService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { usePremiumDialog } from '@src/shared/ui';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys';

export const useParseTodoMutationOptions = () => {
  const aiService = useAiService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const premiumDialog = usePremiumDialog();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (params: { text: string; categoryId?: number }) => {
      const result = await aiService.parseTodo(params.text, params.categoryId);
      return unwrap(result);
    },
    onSuccess: () => {
      trackEvent('ai_parse_used', { success: true });
      queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.usage() });
    },
    onError: (error) => {
      trackEvent('ai_parse_used', { success: false });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.AI_1303)) {
        trackEvent('premium_gate_shown', { feature: 'ai_parse' });
        premiumDialog.open({
          description: t('todo:premium.unlimitedParse'),
        });
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }

      toast.error(undefined, { fallback: t('todo:toast.parseFailed') });
    },
  });
};
