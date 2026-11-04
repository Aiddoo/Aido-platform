import type { VoicePlanAnalyticsSource } from '@src/shared/observability/telemetry-keys';

import {
  isDuplicateAction,
  isTodoAction,
  type VoicePlan,
  type VoicePlanSource,
} from '../../domains/voice-plan.model';

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
    todo_count: plan.actions.filter(isTodoAction).length,
    memo_count: plan.actions.filter((action) => !isTodoAction(action)).length,
    duplicate_count: plan.actions.filter(isDuplicateAction).length,
  };
}
