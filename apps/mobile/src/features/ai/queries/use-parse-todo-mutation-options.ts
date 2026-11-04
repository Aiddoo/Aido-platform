import { ErrorCode } from '@aido/api/errors';
import { useAiService, useHaptics } from '@src/bootstrap/providers/di-context';
import { markAiDataSharingConsentRequired } from '@src/features/auth/queries/auth-cache';
import { usePremiumGate } from '@src/features/subscription/hooks/use-premium-gate';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys';
import { isAiDataSharingConsentRequiredError } from '../domains/ai.error';

export const useParseTodoMutationOptions = () => {
  const haptics = useHaptics();
  const aiService = useAiService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const premiumGate = usePremiumGate('AI_PARSE');
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
      // 동의 안내는 AI를 요청한 화면이 띄우고, 동의하면 같은 요청을 다시 보낸다
      if (isAiDataSharingConsentRequiredError(error)) {
        markAiDataSharingConsentRequired(queryClient);
        return;
      }

      trackEvent('ai_parse_used', { success: false });
      haptics.notify('error');

      if (isApiError(error) && error.hasCode(ErrorCode.AI_1303)) {
        premiumGate.open({
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
