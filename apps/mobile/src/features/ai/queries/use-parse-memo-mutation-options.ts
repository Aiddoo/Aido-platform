import { ErrorCode } from '@aido/api/errors';
import { useAiService } from '@src/bootstrap/providers/di-context';
import { markAiDataSharingConsentRequired } from '@src/features/auth/queries/auth-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { usePremiumDialog } from '@src/shared/ui';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys';
import { isAiDataSharingConsentRequiredError } from '../domains/ai.error';

interface ParseMemoParams {
  memoId: number;
  content: string;
  categoryId: number;
}

export const useParseMemoMutationOptions = () => {
  const aiService = useAiService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const premiumDialog = usePremiumDialog();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ content, categoryId }: ParseMemoParams) => {
      const result = await aiService.parseMemo(content, categoryId);
      return unwrap(result);
    },
    onSuccess: (data, { memoId }) => {
      trackEvent('ai_parse_used', { success: true });
      queryClient.setQueryData(AI_QUERY_KEYS.parseMemo({ memoId }), data);
      queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.usage() });
    },
    onError: (error) => {
      // 동의 안내는 AI를 요청한 화면이 띄우고, 동의하면 같은 요청을 다시 보낸다
      if (isAiDataSharingConsentRequiredError(error)) {
        markAiDataSharingConsentRequired(queryClient);
        return;
      }

      trackEvent('ai_parse_used', { success: false });
      notifyError();

      if (isApiError(error) && error.hasCode(ErrorCode.AI_1303)) {
        trackEvent('premium_gate_shown', { feature: 'ai_parse' });
        // 할 일 파싱과 같은 한도 소진 안내로 구독 경로를 보여준다.
        premiumDialog.open({
          description: t('todo:premium.unlimitedParse'),
        });
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
