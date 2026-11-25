// Hermes에 Segmenter가 없으면 코드 포인트로 나눈다
function splitGraphemes(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)).map(
      ({ segment }) => segment,
    );
  }
  return Array.from(text);
}

// 서버 한도는 UTF-16 길이라 글자를 앞에서부터 한도 안까지만 담는다. `slice`는 이모지를 반으로 잘라 깨진 글자를 남긴다
export function truncateGraphemes(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  let truncated = '';
  for (const grapheme of splitGraphemes(text)) {
    if (maxLength < truncated.length + grapheme.length) {
      break;
    }
    truncated += grapheme;
  }
  return truncated;
}
