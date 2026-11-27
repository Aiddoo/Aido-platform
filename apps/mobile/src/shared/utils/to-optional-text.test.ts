import { toOptionalText } from './to-optional-text';

describe('toOptionalText', () => {
  it('글 칸이 없으면 undefined를 반환한다', () => {
    // When
    const result = toOptionalText(undefined);

    // Then
    expect(result).toBeUndefined();
  });

  it.each(['', '   '])('공백뿐인 글 "%s"면 undefined를 반환한다', (text) => {
    // When
    const result = toOptionalText(text);

    // Then
    expect(result).toBeUndefined();
  });

  it('앞뒤 공백을 제거한 문자열을 반환한다', () => {
    // When
    const result = toOptionalText('  화이팅!  ');

    // Then
    expect(result).toBe('화이팅!');
  });
});
