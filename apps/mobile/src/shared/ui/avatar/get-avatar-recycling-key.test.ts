import { getAvatarRecyclingKey } from './get-avatar-recycling-key';

describe('getAvatarRecyclingKey', () => {
  it('uri 소스는 uri 문자열을 키로 쓴다', () => {
    // Given
    const source = { uri: 'https://cdn.aido.app/profile/1.webp' };

    // When
    const key = getAvatarRecyclingKey(source);

    // Then
    expect(key).toBe('https://cdn.aido.app/profile/1.webp');
  });

  it('require() 모듈 번호는 문자열로 바꿔 키로 쓴다', () => {
    // Given
    const source = 42;

    // When
    const key = getAvatarRecyclingKey(source);

    // Then
    expect(key).toBe('42');
  });

  it('uri 배열 소스는 첫 번째 uri를 키로 쓴다', () => {
    // Given
    const source = [{ uri: 'https://cdn.aido.app/a.webp' }, { uri: 'https://cdn.aido.app/b.webp' }];

    // When
    const key = getAvatarRecyclingKey(source);

    // Then
    expect(key).toBe('https://cdn.aido.app/a.webp');
  });

  it('uri가 없으면 키를 만들지 않는다', () => {
    // Given
    const source = { width: 10, height: 10 };

    // When
    const key = getAvatarRecyclingKey(source);

    // Then
    expect(key).toBeUndefined();
  });
});
