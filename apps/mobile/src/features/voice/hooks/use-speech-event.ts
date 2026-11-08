import { useSpeechRecognizer } from '@src/bootstrap/providers/di-context';
import type { SpeechEvent } from '@src/core/ports/speech-recognizer';
import { useEffect, useEffectEvent } from 'react';

/** 이 훅을 쓴 화면이 살아 있는 동안만 듣는다. 내려간 뒤에도 들어야 하면 포트의 subscribe를 쓴다 */
export function useSpeechEvent(listener: (event: SpeechEvent) => void) {
  const speechRecognizer = useSpeechRecognizer();
  const handleEvent = useEffectEvent(listener);

  useEffect(() => speechRecognizer.subscribe((event) => handleEvent(event)), [speechRecognizer]);
}
