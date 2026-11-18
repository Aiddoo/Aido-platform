import { voiceNoteDigestResponseSchema } from '@aido/api/contracts/voice/v1';
import type { LocalFileEntry } from '@src/core/ports/local-file-system';
import { defineFixture } from '@src/testing/fixture';

import { voiceCaptureStateSchema, type VoiceCaptureState } from '../domains/voice-capture.model';
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

export function createLocalFileEntry(overrides: Partial<LocalFileEntry> = {}): LocalFileEntry {
  return {
    name: 'recording.m4a',
    uri: 'file:///voice/recording.m4a',
    sizeBytes: 1024,
    modifiedAtMs: null,
    ...overrides,
  };
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
