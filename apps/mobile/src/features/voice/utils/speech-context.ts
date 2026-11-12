import type { SpeechStartOptions } from '@src/core/ports/speech-recognizer';
import { uniq } from 'es-toolkit';

import { COMMON_SPEECH_HINTS } from '../constants/speech-hints.constants';
import {
  SPEECH_CONTEXT_MAX_STRINGS,
  SPEECH_CONTEXT_RECENT_TODO_LIMIT,
} from '../constants/voice.constants';

interface SpeechContextSource {
  categoryNames: readonly string[];
  todoTitles: readonly string[];
}

/** 인식기가 한 구절로 받기에 너무 긴 제목은 고유명사 힌트로 쓸모가 없다 */
const MAX_PHRASE_LENGTH = 30;

export function getSpeechContextStrings({
  categoryNames,
  todoTitles,
}: SpeechContextSource): string[] {
  const toPhrases = (values: readonly string[]) =>
    values
      .map((value) => value.trim())
      .filter((value) => 0 < value.length && value.length <= MAX_PHRASE_LENGTH);

  return uniq([
    ...toPhrases(categoryNames),
    ...toPhrases(todoTitles).slice(0, SPEECH_CONTEXT_RECENT_TODO_LIMIT),
  ]).slice(0, SPEECH_CONTEXT_MAX_STRINGS);
}

// 네트워크 인식은 음성 인식 서비스로 나가므로 개인 단어(카테고리·할 일 이름)는 기기 안 인식일 때만 넣는다
export function getRecognizerStartOptions(options: SpeechStartOptions): SpeechStartOptions {
  const commonHints = COMMON_SPEECH_HINTS[options.locale];

  return {
    ...options,
    hintWords: options.isOnDevice ? uniq([...options.hintWords, ...commonHints]) : [...commonHints],
  };
}
