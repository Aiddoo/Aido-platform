export interface CaptionTextPart {
  text: string;
  isLowConfidence: boolean;
}

/** 문장을 잘못 들었을 수 있는 단어(밑줄용)와 나머지 조각으로 나눈다. */
export function toCaptionTextParts(text: string, words: readonly string[]): CaptionTextPart[] {
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
