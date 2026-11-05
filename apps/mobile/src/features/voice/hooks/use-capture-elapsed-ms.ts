import { useEffect, useState } from 'react';

import { VOICE_CLOCK_TICK_MS } from '../constants/voice.constants';
import { VoiceCapturePolicy, type VoiceCaptureState } from '../domains/voice-capture.model';

/** 지금까지 들은 시간. 듣는 동안 1초마다 이 훅을 쓰는 컴포넌트만 다시 그린다 */
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
