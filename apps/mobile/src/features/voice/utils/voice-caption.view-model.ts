export interface CaptionTextPart {
  text: string;
  isLowConfidence: boolean;
}

/** 문장을 잘못 들었을 수 있는 단어(밑줄용)와 나머지 조각으로 나눈다. */
export function toCaptionTextParts(text: string, words: readonly string[]): CaptionTextPart[] {
  const { parts, cursor } = words.reduce<{ parts: CaptionTextPart[]; cursor: number }>(
    (current, word) => {
      const index = text.indexOf(word, current.cursor);
      if (index === -1) {
        return current;
      }
      const before =
        index > current.cursor
          ? [{ text: text.slice(current.cursor, index), isLowConfidence: false }]
          : [];
      return {
        parts: [...current.parts, ...before, { text: word, isLowConfidence: true }],
        cursor: index + word.length,
      };
    },
    { parts: [], cursor: 0 },
  );

  return cursor < text.length
    ? [...parts, { text: text.slice(cursor), isLowConfidence: false }]
    : parts;
}
