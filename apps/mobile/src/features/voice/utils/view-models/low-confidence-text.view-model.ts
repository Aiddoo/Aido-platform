export interface CaptionTextPart {
  text: string;
  isLowConfidence: boolean;
}

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
