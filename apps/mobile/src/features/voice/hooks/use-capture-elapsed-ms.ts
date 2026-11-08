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
    // oxlint-disable-next-line react/set-state-in-effect -- 듣기를 시작한 순간의 시각으로 바로 맞춰 첫 tick 전까지 지난 시간이 틀리지 않게 한다
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), VOICE_CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [isListening]);

  return VoiceCapturePolicy.getElapsedMs(state, now);
}
