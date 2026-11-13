import { maskEmail } from './email.view-model';

describe('maskEmail', () => {
  it('앞 두 글자와 도메인만 남긴다', () => {
    // Given
    const email = 'matthew@aido.app';

    // When
    const masked = maskEmail(email);

    // Then
    expect(masked).toBe('ma****@aido.app');
  });

  it('앞부분이 한 글자여도 가린다', () => {
    // Given
    const email = 'a@aido.app';

    // When
    const masked = maskEmail(email);

    // Then
    expect(masked).toBe('a****@aido.app');
  });

  it('이메일 형식이 아니면 그대로 둔다', () => {
    // Given
    const value = 'a@b';

    // When
    const masked = maskEmail(value);

    // Then
    expect(masked).toBe('a@b');
  });
});
