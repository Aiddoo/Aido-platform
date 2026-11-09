import { RELEASE_1_15_0_STEPS } from '../constants/release-1-15-0.constants';

const RELEASE_1_15_0_CHAPTER_START = {
  voiceTodo: 'voiceTodoCapture',
  voiceNote: 'voiceNoteRecord',
} as const;

export type Release1150Step = (typeof RELEASE_1_15_0_STEPS)[number];
export type Release1150Chapter = keyof typeof RELEASE_1_15_0_CHAPTER_START;

/** 소개에서 한 기능으로 건너뛰어도 진행 점은 기록 길이가 아니라 흐름 안의 자리를 가리킨다 */
export function getStepPosition(step: Release1150Step): number {
  return RELEASE_1_15_0_STEPS.indexOf(step);
}

export function findNextStep(step: Release1150Step): Release1150Step | null {
  return RELEASE_1_15_0_STEPS[getStepPosition(step) + 1] ?? null;
}

export function getChapterStartStep(chapter: Release1150Chapter): Release1150Step {
  return RELEASE_1_15_0_CHAPTER_START[chapter];
}
