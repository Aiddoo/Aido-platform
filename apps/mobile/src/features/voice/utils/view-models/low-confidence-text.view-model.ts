export interface CaptionTextPart {
  text: string;
  isLowConfidence: boolean;
}

/** 문장을 밑줄 칠 조각과 그냥 둘 조각으로 나눈다. 단어는 문장 안 순서대로 찾고, 못 찾은 단어는 건너뛴다 */
export function splitLowConfidenceText(text: string, words: readonly string[]): CaptionTextPart[] {
  const parts: CaptionTextPart[] = [];
  let cursor = 0;

  for (const word of words) {
    const index = text.indexOf(word, cursor);
    if (index === -1) {
      continue;
    }
    if (index > cursor) {
      parts.push({ text: text.slice(cursor, index), isLowConfidence: false });
    }
    parts.push({ text: word, isLowConfidence: true });
    cursor = index + word.length;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), isLowConfidence: false });
  }

  return parts;
}
