/** 부호가 없는 긴 말(문장부호를 못 넣는 인식기)은 `maxLength` 안의 마지막 띄어쓰기에서 끊고, 띄어쓰기도 없으면 `maxLength`에서 자른다 */
export function splitIntoSentences(text: string, maxLength: number): string[] {
  const parts = text
    .split(/(?<=[.!?。！？])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return parts.flatMap((part) => splitLongPart(part, maxLength));
}

function splitLongPart(part: string, maxLength: number): string[] {
  if (part.length <= maxLength) {
    return part.length > 0 ? [part] : [];
  }
  const lastSpace = part.lastIndexOf(' ', maxLength);
  const cut = lastSpace > 0 ? lastSpace : maxLength;
  return [part.slice(0, cut).trim(), ...splitLongPart(part.slice(cut).trim(), maxLength)];
}
