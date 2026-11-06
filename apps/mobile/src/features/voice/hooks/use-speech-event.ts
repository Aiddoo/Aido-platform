import { useSpeechRecognizer } from '@src/bootstrap/providers/di-context';
import type { SpeechEvent } from '@src/core/ports/speech-recognizer';
import { useEffect, useEffectEvent } from 'react';

/**
 * 공식 `useSpeechRecognitionEvent`의 포트 버전. 이 훅을 쓴 화면이 살아 있는 동안 듣는다.
 * 화면이 내려간 뒤에도 들어야 하면(늦은 녹음 파일) 포트의 `subscribe`를 직접 쓴다.
 */
export function useSpeechEvent(listener: (event: SpeechEvent) => void) {
  const speechRecognizer = useSpeechRecognizer();
  const handleEvent = useEffectEvent(listener);

  useEffect(() => speechRecognizer.subscribe((event) => handleEvent(event)), [speechRecognizer]);
}
