import { useVoiceService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { PreparedPlanRequest } from '../domains/plan-request.model';
import type { VoiceNoteDigestInput } from '../domains/voice-note.model';
import {
  summarizePlanForAnalytics,
  toAnalyticsSource,
} from '../utils/analytics/voice-plan-analytics';
import { planInProgressRetryOptions } from './plan-in-progress-retry';
import { usePlanFailureHandler } from './use-plan-failure-handler';
import { reflectFeatureQuota } from './voice-plan-cache';

interface CreateVoiceNoteDigestVariables extends PreparedPlanRequest<VoiceNoteDigestInput> {
  /** 화면을 떠나면 끊는다. 키가 기기에 남아 있어 다시 눌러도 두 번 차감되지 않는다 */
  signal?: AbortSignal;
}

/** 긴 녹음의 글을 요약·핵심 포인트·계획으로 정리한다. 실패 안내는 글자 옆에 화면이 직접 보여 준다 */
export const useCreateVoiceNoteDigestMutationOptions = () => {
  const voiceService = useVoiceService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const handleFailure = usePlanFailureHandler('VOICE_NOTE', {
    surface: 'voice_note',
    showsFailureInline: true,
  });

  return mutationOptions({
    ...planInProgressRetryOptions,
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다
    networkMode: 'always',
    mutationFn: async ({ input, idempotencyKey, signal }: CreateVoiceNoteDigestVariables) =>
      unwrap(await voiceService.createVoiceNoteDigest(input, idempotencyKey, signal)),
    onSuccess: ({ plan, featureQuota, charged }) => {
      reflectFeatureQuota(queryClient, featureQuota);
      trackEvent('voice_plan_generated', {
        source: toAnalyticsSource(plan.source),
        ...summarizePlanForAnalytics(plan),
        charged,
      });
    },
    onError: (error, { signal }) => {
      if (signal?.aborted === true) {
        return;
      }
      handleFailure(error, 'voice-note');
    },
  });
};
