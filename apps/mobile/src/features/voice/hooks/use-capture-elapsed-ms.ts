import { toEpochMs } from '@src/shared/date/instant';
import { useNow } from '@src/shared/hooks/use-now';

import { VOICE_CLOCK_TICK_MS } from '../constants/voice.constants';
import { VoiceCapturePolicy, type VoiceCaptureState } from '../domains/voice-capture.model';

export function useCaptureElapsedMs(state: VoiceCaptureState): number {
  const now = useNow({ tickMs: VOICE_CLOCK_TICK_MS, isEnabled: state.status === 'listening' });

  return VoiceCapturePolicy.getElapsedMs(state, toEpochMs(now));
}
