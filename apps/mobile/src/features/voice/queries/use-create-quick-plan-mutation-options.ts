import { useVoiceService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { PreparedPlanRequest } from '../domains/plan-request.model';
import type { CreateQuickPlanInput } from '../domains/voice-plan.model';
import {
  summarizePlanForAnalytics,
  toAnalyticsSource,
} from '../utils/analytics/voice-plan-analytics';
import { planInProgressRetryOptions } from './plan-in-progress-retry';
import { usePlanFailureHandler } from './use-plan-failure-handler';
import { reflectFeatureQuota } from './voice-plan-cache';

interface CreateQuickPlanVariables extends PreparedPlanRequest<CreateQuickPlanInput> {
  /** 시트를 닫으면 끊는다. 끊어도 키가 같으면 다시 보낼 때 두 번 차감되지 않는다 */
  signal?: AbortSignal;
}

interface UseCreateQuickPlanMutationOptionsParams {
  onSubscribe?: () => void;
}

export function useCreateQuickPlanMutationOptions({
  onSubscribe,
}: UseCreateQuickPlanMutationOptionsParams = {}) {
  const voiceService = useVoiceService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const handleFailure = usePlanFailureHandler('AI_PARSE', {
    surface: 'add_todo_sheet',
    onSubscribe,
  });

  return mutationOptions({
    ...planInProgressRetryOptions,
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다
    networkMode: 'always',
    mutationFn: async ({ input, idempotencyKey, signal }: CreateQuickPlanVariables) =>
      unwrap(await voiceService.createQuickPlan(input, idempotencyKey, signal)),
    onSuccess: ({ plan, featureQuota, charged }) => {
      reflectFeatureQuota(queryClient, featureQuota);
      trackEvent('voice_plan_generated', {
        source: toAnalyticsSource(plan.source),
        ...summarizePlanForAnalytics(plan),
        charged,
      });
    },
    onError: (error, { input, signal }) => {
      if (signal?.aborted === true) {
        return;
      }
      handleFailure(error, input.source === 'voice' ? 'quick-voice' : 'quick-text');
    },
  });
}
