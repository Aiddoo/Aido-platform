import { uniq } from 'es-toolkit';

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
      .filter((value) => value.length > 0 && value.length <= MAX_PHRASE_LENGTH);

  return uniq([
    ...toPhrases(categoryNames),
    ...toPhrases(todoTitles).slice(0, SPEECH_CONTEXT_RECENT_TODO_LIMIT),
  ]).slice(0, SPEECH_CONTEXT_MAX_STRINGS);
}
