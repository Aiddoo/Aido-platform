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
