import type { SpeechStartOptions } from '@src/core/ports/speech-recognizer';

import { SpeechHintPolicy } from '../domains/speech-hint.model';

// 시작 옵션의 `hintWords`는 내 단어다. 인식기에는 언어마다 흔한 단어를 더해 규칙대로 고른 단어를 준다
export function toSpeechStartOptions(
  options: SpeechStartOptions,
  commonWords: readonly string[],
): SpeechStartOptions {
  return {
    ...options,
    hintWords: SpeechHintPolicy.getHintWords({
      personalWords: options.hintWords,
      commonWords,
      isOnDevice: options.isOnDevice,
    }),
  };
}
