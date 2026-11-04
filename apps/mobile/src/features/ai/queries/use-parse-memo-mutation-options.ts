import { useAiService, useDraftService, useHaptics } from '@src/bootstrap/providers/di-context';
import { markAiDataSharingConsentRequired } from '@src/features/auth/queries/auth-cache';
import { createMemoPlanDraftKey } from '@src/features/memo/utils/memo-plan-draft';
import { isNotChargedError } from '@src/features/subscription/apis/entitlement.mapper';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { createPlanReviewDraft } from '@src/features/voice/domains/plan-review-form.schema';
import { getVoicePlanFailureCause } from '@src/features/voice/domains/voice.error';
import { reflectFeatureQuota } from '@src/features/voice/queries/voice-plan-cache';
import {
  summarizePlanForAnalytics,
  toAnalyticsSource,
} from '@src/features/voice/utils/analytics/voice-plan-analytics';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';

import { isAiDataSharingConsentRequiredError } from '../domains/ai.error';

interface ParseMemoParams {
  memoId: number;
  content: string;
  categoryId: number;
  /** 메모의 수정 시각(epoch ms). 메모가 바뀌면 이 결과는 버려진다 */
  sourceUpdatedAt: number;
}

export const useParseMemoMutationOptions = () => {
  const haptics = useHaptics();
  const aiService = useAiService();
  const draftService = useDraftService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const gate = useEntitlementGate('AI_PARSE', { surface: 'memo_detail' });
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ content, categoryId }: ParseMemoParams) => {
      const result = await aiService.parseMemo(content, categoryId, randomUUID());
      return unwrap(result);
    },
    onSuccess: ({ plan, featureQuota }, { memoId, sourceUpdatedAt }) => {
      trackEvent('ai_parse_used', { success: true });
      trackEvent('voice_plan_generated', {
        source: toAnalyticsSource(plan.source),
        ...summarizePlanForAnalytics(plan),
        charged: true,
      });
      // 결과는 기기에 남겨 화면을 벗어나거나 앱을 다시 켜도 잃지 않는다
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId != null) {
        draftService.save(
          createMemoPlanDraftKey({ userId: accountId, memoId }),
          createPlanReviewDraft(plan),
          { sourceUpdatedAt },
        );
      }
      // 1.15.0 이전 서버는 응답에 한도를 싣지 않아 다시 묻는다
      reflectFeatureQuota(queryClient, featureQuota);
    },
    onError: (error) => {
      // 동의 안내는 AI를 요청한 화면이 띄우고, 동의하면 같은 요청을 다시 보낸다
      if (isAiDataSharingConsentRequiredError(error)) {
        markAiDataSharingConsentRequired(queryClient);
        return;
      }

      trackEvent('ai_parse_used', { success: false });
      trackEvent('voice_plan_failed', { source: 'memo', cause: getVoicePlanFailureCause(error) });
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
