export const RELEASE_1_15_0_STEPS = [
  'intro',
  'voiceTodoCapture',
  'voiceTodoReview',
  'voiceTodoList',
  'voiceNoteRecord',
  'voiceNoteResult',
  'freeQuota',
  'finish',
] as const;

/** 시각이 없으면 종일이다 */
export const DEMO_PLANNED_TODOS = [
  { id: 'dentist', time: { hour: 15, minute: 0 } },
  { id: 'groceries', time: { hour: 18, minute: 30 } },
  { id: 'report', time: null },
] as const;

export const DEMO_WAVEFORM_LEVELS = [
  0.2, 0.5, 0.8, 0.6, 0.9, 0.4, 0.15, 0.3, 0.7, 1, 0.75, 0.5, 0.25, 0.1, 0.45, 0.85, 0.6, 0.35, 0.7,
  0.55, 0.2, 0.4, 0.9, 0.65, 0.3, 0.15, 0.5, 0.8,
] as const;

/** 글자는 실제 말보다 빠르게 보여 주고 시계는 말 속도로 센다 */
export const DEMO_SCRIPT = {
  startDelayMs: 400,
  wordMs: 140,
  spokenMsPerWord: 450,
  rowMs: 320,
  sentenceMs: 900,
  digestStepMs: 700,
} as const;
