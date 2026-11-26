/** 소개 단계 순서. 이름은 지표 값(whats_new_step_viewed.step)이라 바꾸지 않는다 */
export const RELEASE_1_16_0_STEPS = [
  'intro',
  'suggestionRequest',
  'suggestionList',
  'reportSummary',
  'reportHours',
  'freeRecord',
  'finish',
] as const;

export const DEMO_SCRIPT_MS = {
  suggestionRow: 320,
  analyzingCard: 1_500,
  peakHourSelectDelay: 900,
} as const;
