import { getProfileIconSource } from './profile-icon.util';

describe('프로필 아이콘 이미지 선택', () => {
  test.each(['russian_blue', 'cream_cat', 'tuxedo_cat'])(
    '신규 키 %s는 로컬 이미지로 표시한다',
    (key) => {
      // Given
      const profileImage = key;

      // When
      const source = getProfileIconSource(profileImage);

      // Then
      expect(source).not.toEqual({ uri: profileImage });
      expect(source).toBeDefined();
    },
  );

  test('모르는 키를 이미지 URL로 요청하지 않고 기본 아이콘으로 표시한다', () => {
    // Given
    const unknownKey = 'future_cat';

    // When
    const source = getProfileIconSource(unknownKey);

    // Then
    expect(source).toBe(getProfileIconSource(null));
  });

  test('기존 HTTP 프로필 이미지 URL은 그대로 표시한다', () => {
    // Given
    const profileImage = 'https://example.com/profile.png';

    // When
    const source = getProfileIconSource(profileImage);

    // Then
    expect(source).toEqual({ uri: profileImage });
  });
});
