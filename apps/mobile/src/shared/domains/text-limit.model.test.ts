import { truncateGraphemes } from './text-limit.model';

describe('truncateGraphemes', () => {
  it.each([
    ['빈 글은 빈 글이다', '', ''],
    ['한도 안의 글은 그대로다', '산책', '산책'],
    ['딱 한도인 글은 그대로다', '가'.repeat(10), '가'.repeat(10)],
    ['한도보다 한 글자 길면 한도까지만 남긴다', '가'.repeat(11), '가'.repeat(10)],
  ])('%s', (_case, text, expected) => {
    // When
    const truncated = truncateGraphemes(text, 10);

    // Then
    expect(truncated).toBe(expected);
  });

  it.each([
    // 가족 이모지는 여러 코드 포인트가 이어진 한 글자다
    ['이어 붙인 이모지', '👩‍👩‍👧'],
    // 풀어 쓴 한글은 초성·중성·종성 세 칸이 한 글자다
    ['자모로 풀어 쓴 한글', '한'.normalize('NFD')],
  ])('한도에 걸친 글자(%s)는 반으로 자르지 않고 뺀다', (_case, grapheme) => {
    // Given
    const text = `${'가'.repeat(9)}${grapheme}끝`;

    // When
    const truncated = truncateGraphemes(text, 10);

    // Then
    expect(truncated).toBe('가'.repeat(9));
    expect(truncated.length).toBeLessThanOrEqual(10);
  });

  it('첫 글자 하나가 한도보다 길면 반쪽을 남기지 않고 빈 글을 돌려준다', () => {
    // Given
    // 가족 이모지 하나가 UTF-16 여덟 칸이다
    const text = '👩‍👩‍👧 가족';

    // When
    const truncated = truncateGraphemes(text, 4);

    // Then
    expect(truncated).toBe('');
  });
});
