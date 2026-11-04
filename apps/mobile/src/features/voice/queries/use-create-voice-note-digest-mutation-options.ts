import type { VoiceNoteDigestRequest } from '@aido/api';
import { useVoiceService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { PreparedPlanRequest } from '../domains/plan-request.model';
import {
  summarizePlanForAnalytics,
  toAnalyticsSource,
} from '../utils/analytics/voice-plan-analytics';
import { usePlanFailureHandler } from './use-plan-failure-handler';
import { reflectFeatureQuota } from './voice-plan-cache';

/** 긴 녹음의 글을 요약·핵심 포인트·계획으로 정리한다. 자동으로 다시 보내지 않는다(차감 중복 방지) */
export const useCreateVoiceNoteDigestMutationOptions = () => {
  const voiceService = useVoiceService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const handleFailure = usePlanFailureHandler('VOICE_NOTE', { surface: 'voice_note' });

  return mutationOptions({
    mutationFn: async ({ input, idempotencyKey }: PreparedPlanRequest<VoiceNoteDigestRequest>) =>
      unwrap(await voiceService.createVoiceNoteDigest(input, idempotencyKey)),
    onSuccess: ({ plan, featureQuota, charged }) => {
      reflectFeatureQuota(queryClient, featureQuota);
      trackEvent('voice_plan_generated', {
        source: toAnalyticsSource(plan.source),
        ...summarizePlanForAnalytics(plan),
        charged,
      });
    },
    onError: (error) => handleFailure(error, 'voice-note'),
  });
};
