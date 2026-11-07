import type {
  VoiceDurationBucket,
  VoicePlanAnalyticsSource,
} from '@src/features/voice/constants/voice.events';

import { VoicePlanPolicy } from '../domains/voice-plan.model';
import { type VoicePlan, type VoicePlanSource } from '../schemas/voice-plan.schema';

const SECONDS = { half: 30, threeMinutes: 180, tenMinutes: 600 } as const;

/** 말한 길이는 정확한 값 대신 구간으로만 남긴다 */
export function getDurationBucket(elapsedMs: number): VoiceDurationBucket {
  const seconds = elapsedMs / 1_000;
  if (seconds < SECONDS.half) {
    return 'lt_30s';
  }
  if (seconds < SECONDS.threeMinutes) {
    return '30s_3m';
  }
  return seconds < SECONDS.tenMinutes ? '3m_10m' : '10m_30m';
}

const ANALYTICS_SOURCE = {
  'quick-voice': 'quick_voice',
  'quick-text': 'quick_text',
  'voice-note': 'voice_note',
  memo: 'memo',
} as const satisfies Record<VoicePlanSource, VoicePlanAnalyticsSource>;

export const toAnalyticsSource = (source: VoicePlanSource) => ANALYTICS_SOURCE[source];

/** 제목·내용 없이 개수만 센다 */
export function summarizePlanForAnalytics(plan: VoicePlan) {
  return {
    todo_count: plan.actions.filter(VoicePlanPolicy.isTodoAction).length,
    memo_count: plan.actions.filter((action) => !VoicePlanPolicy.isTodoAction(action)).length,
    duplicate_count: plan.actions.filter(VoicePlanPolicy.isDuplicateAction).length,
  };
}
