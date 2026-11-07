import { createVoiceTranscript } from '../domains/voice-transcript.model';
import { voiceCaptureStateSchema, type VoiceCaptureState } from '../schemas/voice-capture.schema';
import { type VoiceTranscript } from '../schemas/voice-transcript.schema';

export function createTranscript(overrides: Partial<VoiceTranscript> = {}): VoiceTranscript {
  return createVoiceTranscript(overrides);
}

type CaptureStateInput = Partial<
  Record<'transcript' | 'elapsedMs' | 'pauseCount' | 'listeningSince' | 'cause' | 'reason', unknown>
> & { status: VoiceCaptureState['status'] };

/** 상태 종류마다 필요한 필드를 스키마로 검증해 만든다 */
export function createCaptureState(input: CaptureStateInput): VoiceCaptureState {
  return voiceCaptureStateSchema.parse({
    transcript: createVoiceTranscript(),
    elapsedMs: 0,
    pauseCount: 0,
    ...input,
  });
}

/** 말로 메모 정리 응답. 핵심 포인트와 계획 카드는 테스트가 정한다 */
export function createVoiceNoteDigestDto({
  actions = [],
  keyPoints = [{ text: '핵심', startMs: 12_000 }],
}: { actions?: unknown[]; keyPoints?: unknown[] } = {}) {
  return {
    title: '온보딩 회의',
    summary: '요약이에요',
    keyPoints,
    plan: { actions, omittedTodoCount: 0 },
    featureQuota: null,
    charged: true,
  };
}
