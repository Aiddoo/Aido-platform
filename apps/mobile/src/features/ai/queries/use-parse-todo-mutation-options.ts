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

import { isAiDataSharingConsentRequiredError } from '../domains/ai.error';

export const useParseTodoMutationOptions = () => {
  const haptics = useHaptics();
  const aiService = useAiService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const gate = useEntitlementGate('AI_PARSE', { surface: 'add_todo_sheet' });
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (params: { text: string; categoryId?: number }) => {
      const result = await aiService.parseTodo(params.text, params.categoryId);
      return unwrap(result);
    },
    onSuccess: ({ featureQuota }) => {
      trackEvent('ai_parse_used', { success: true });
      // 1.15.0 이전 서버는 응답에 한도를 싣지 않아 다시 묻는다
      if (featureQuota == null) {
        invalidateEntitlements(queryClient);
        return;
      }
      setFeatureQuota(queryClient, featureQuota);
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

      toast.error(undefined, { fallback: t('todo:toast.parseFailed'), description });
    },
  });
};
