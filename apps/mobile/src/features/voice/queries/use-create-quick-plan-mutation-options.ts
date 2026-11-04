import { useVoiceService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { CreateQuickPlanInput } from '../apis/voice.service';
import type { PreparedPlanRequest } from '../domains/plan-request.model';
import {
  summarizePlanForAnalytics,
  toAnalyticsSource,
} from '../utils/analytics/voice-plan-analytics';
import { usePlanFailureHandler } from './use-plan-failure-handler';
import { reflectFeatureQuota } from './voice-plan-cache';

/**
 * 말하거나 적은 글을 계획으로 나눈다. 요청마다 `preparePlanRequest`로 만든 멱등 키를 함께 보낸다.
 * AI_1317(결과 캐시 만료)은 새 키로 다시 보내면 한 번 더 차감되므로 자동으로 다시 보내지 않는다.
 */
export const useCreateQuickPlanMutationOptions = () => {
  const voiceService = useVoiceService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const handleFailure = usePlanFailureHandler('AI_PARSE', { surface: 'add_todo_sheet' });

  return mutationOptions({
    mutationFn: async ({ input, idempotencyKey }: PreparedPlanRequest<CreateQuickPlanInput>) =>
      unwrap(await voiceService.createQuickPlan(input, idempotencyKey)),
    onSuccess: ({ plan, featureQuota, charged }) => {
      reflectFeatureQuota(queryClient, featureQuota);
      trackEvent('voice_plan_generated', {
        source: toAnalyticsSource(plan.source),
        ...summarizePlanForAnalytics(plan),
        charged,
      });
    },
    onError: (error, { input }) =>
      handleFailure(error, input.source === 'voice' ? 'quick-voice' : 'quick-text'),
  });
};
