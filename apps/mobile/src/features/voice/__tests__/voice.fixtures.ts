import { voiceNoteDigestResponseSchema } from '@aido/api/contracts/voice/v1';
import { createDateKey } from '@src/testing/date-key';
import { defineFixture } from '@src/testing/fixture';

import type { PlannedMemo, PlannedTodo } from '../domains/planned-action.model';
import { voiceCaptureStateSchema, type VoiceCaptureState } from '../domains/voice-capture.model';
import { type VoicePlan, voicePlanIdSchema } from '../domains/voice-plan.model';
import { createVoiceTranscript, voiceTranscriptSchema } from '../domains/voice-transcript.model';

export const createTranscript = defineFixture(voiceTranscriptSchema, {
  sentences: [],
  interim: '',
});

type CaptureStateInput = Partial<
  Record<'transcript' | 'elapsedMs' | 'pauseCount' | 'listeningSince' | 'cause' | 'reason', unknown>
> & { status: VoiceCaptureState['status'] };

// 상태마다 필요한 칸이 달라 defineFixture의 얕은 덮어쓰기로는 빠진 칸을 못 잡는다. 호출마다 검증한다
export function createCaptureState(input: CaptureStateInput): VoiceCaptureState {
  return voiceCaptureStateSchema.parse({
    transcript: createVoiceTranscript(),
    elapsedMs: 0,
    pauseCount: 0,
    ...input,
  });
}

/** 말로 메모 정리 응답. 계획 카드가 없는 정리다 */
export const createVoiceNoteDigestDto = defineFixture(voiceNoteDigestResponseSchema, {
  title: '온보딩 회의',
  summary: '요약이에요',
  keyPoints: [{ text: '핵심', startMs: 12_000 }],
  plan: { actions: [], omittedTodoCount: 0 },
  featureQuota: null,
  charged: true,
});

export function createPlannedTodo(overrides: Partial<PlannedTodo> = {}): PlannedTodo {
  return {
    type: 'create-todo',
    actionId: 'a1',
    title: '영양제 먹기',
    startDate: createDateKey('2026-11-05'),
    endDate: null,
    scheduledTime: '08:00',
    repeat: null,
    visibility: null,
    items: [],
    categoryId: 1,
    duplicateOfTodoId: null,
    ...overrides,
  };
}

export function createPlannedMemo(): PlannedMemo {
  return { type: 'create-memo', actionId: 'm1', title: '', content: '내용' };
}

export function createVoicePlan(...actions: VoicePlan['actions']): VoicePlan {
  return {
    planId: voicePlanIdSchema.parse('plan-1'),
    source: 'quick-voice',
    sourceMemoId: null,
    actions,
    omittedTodoCount: 0,
  };
}
