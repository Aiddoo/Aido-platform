/** 소개 단계 순서. 이름은 지표 값(whats_new_step_viewed.step)이라 바꾸지 않는다 */
export const RELEASE_1_17_0_STEPS = [
  'intro',
  'chooseCalendars',
  'mapCategories',
  'importing',
  'plans',
  'finish',
] as const;

export const DEMO_SCRIPT_MS = {
  calendarCheck: 600,
  categoryChange: 1_200,
  importStart: 1_400,
  importRow: 700,
} as const;
