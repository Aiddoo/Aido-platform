const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * UTF-16 길이 상한 안에서 문자(grapheme) 경계로 자른다.
 * 계약의 길이 검증은 UTF-16 단위이므로 같은 단위로 재되, 이모지·결합 문자를 반으로 자르지 않는다.
 */
export function truncateGraphemes(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  let truncated = "";
  for (const { segment } of graphemeSegmenter.segment(value)) {
    if (truncated.length + segment.length > maxLength) break;
    truncated += segment;
  }
  return truncated;
}
