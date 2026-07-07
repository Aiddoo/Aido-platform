import { ErrorCode } from '@aido/errors';
import { useTodoService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { usePremiumDialog } from '@src/shared/ui';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const useParseTodoMutationOptions = () => {
  const todoService = useTodoService();
  const { trackEvent } = useTrack();
  const premiumDialog = usePremiumDialog();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (params: { text: string; categoryId?: number }) => {
      const result = await todoService.parseTodo(params.text, params.categoryId);
      return unwrap(result);
    },
    onSuccess: () => {
      trackEvent('ai_parse_used', { success: true });
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
