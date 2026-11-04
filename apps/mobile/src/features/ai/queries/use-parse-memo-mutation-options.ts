import { useAiService, useHaptics } from '@src/bootstrap/providers/di-context';
import { markAiDataSharingConsentRequired } from '@src/features/auth/queries/auth-cache';
import { isNotChargedError } from '@src/features/subscription/apis/entitlement.mapper';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import {
  invalidateEntitlements,
  setFeatureQuota,
} from '@src/features/subscription/queries/entitlement-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys';
import { isAiDataSharingConsentRequiredError } from '../domains/ai.error';

interface ParseMemoParams {
  memoId: number;
  content: string;
  categoryId: number;
}

export const useParseMemoMutationOptions = () => {
  const haptics = useHaptics();
  const aiService = useAiService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const gate = useEntitlementGate('AI_PARSE', { surface: 'memo_detail' });
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ content, categoryId }: ParseMemoParams) => {
      const result = await aiService.parseMemo(content, categoryId);
      return unwrap(result);
    },
    onSuccess: (data, { memoId }) => {
      trackEvent('ai_parse_used', { success: true });
      queryClient.setQueryData(AI_QUERY_KEYS.parseMemo({ memoId }), data);
      // 1.15.0 이전 서버는 응답에 한도를 싣지 않아 다시 묻는다
      if (data.featureQuota == null) {
        invalidateEntitlements(queryClient);
        return;
      }
      setFeatureQuota(queryClient, data.featureQuota);
    },
    onError: (error) => {
      // 동의 안내는 AI를 요청한 화면이 띄우고, 동의하면 같은 요청을 다시 보낸다
      if (isAiDataSharingConsentRequiredError(error)) {
        markAiDataSharingConsentRequired(queryClient);
        return;
      }

      trackEvent('ai_parse_used', { success: false });
      haptics.notify('error');

      if (gate.handleError(error)) {
        return;
      }

      const description = isNotChargedError(error) ? t('subscription:gate.notCharged') : undefined;
      if (isApiError(error)) {
        toast.error(error.message, { description });
        return;
      }

      toast.error(undefined, { fallback: t('ai:suggestions.toasts.retryLater'), description });
    },
  });
};
