import { useEffect, useState } from 'react';

import { VOICE_CLOCK_TICK_MS } from '../constants/voice.constants';
import { VoiceCapturePolicy } from '../domains/voice-capture.model';
import { type VoiceCaptureState } from '../schemas/voice-capture.schema';

export function useCaptureElapsedMs(state: VoiceCaptureState): number {
  const [now, setNow] = useState(() => Date.now());
  const isListening = state.status === 'listening';

  useEffect(() => {
    if (!isListening) {
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), VOICE_CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [isListening]);

  return VoiceCapturePolicy.getElapsedMs(state, now);
}
