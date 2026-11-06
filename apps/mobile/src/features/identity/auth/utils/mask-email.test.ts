import { maskEmail } from './mask-email';

describe('maskEmail', () => {
  test('앞 두 글자와 도메인만 남긴다', () => {
    // Given
    const email = 'matthew@aido.app';

    // When
    const masked = maskEmail(email);

    // Then
    expect(masked).toBe('ma****@aido.app');
  });

  test('이메일 형식이 아니면 그대로 둔다', () => {
    // Given
    const value = 'a@b';

    // When
    const masked = maskEmail(value);

    // Then
    expect(masked).toBe('a@b');
  });
});
