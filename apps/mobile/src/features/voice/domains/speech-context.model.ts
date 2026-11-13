import type { SpeechStartOptions } from '@src/core/ports/speech-recognizer';
import { uniq } from 'es-toolkit';

/** 인식기가 한 구절로 받기에 너무 긴 제목은 고유명사 힌트로 쓸모가 없다 */
const MAX_PHRASE_LENGTH = 30;
/** 인식기가 고유명사를 맞히도록 알려 주는 단어의 최대 개수(SDK 권장 상한) */
const MAX_CONTEXT_STRINGS = 100;
const RECENT_TODO_LIMIT = 60;

interface SpeechContextSource {
  categoryNames: readonly string[];
  todoTitles: readonly string[];
}

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
    ...toPhrases(todoTitles).slice(0, RECENT_TODO_LIMIT),
  ]).slice(0, MAX_CONTEXT_STRINGS);
}

// 네트워크 인식은 음성 인식 서비스로 나가므로 개인 단어(카테고리·할 일 이름)는 기기 안 인식일 때만 넣는다
export function getRecognizerStartOptions(
  options: SpeechStartOptions,
  commonHints: readonly string[],
): SpeechStartOptions {
  return {
    ...options,
    hintWords: options.isOnDevice ? uniq([...options.hintWords, ...commonHints]) : [...commonHints],
  };
}
