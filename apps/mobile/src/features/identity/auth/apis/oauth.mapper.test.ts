import { findOAuthCode, toOAuthProvider, toOAuthProviderSlug } from './oauth.mapper';

describe('toOAuthProvider', () => {
  it.each([
    ['apple', 'APPLE'],
    ['google', 'GOOGLE'],
    ['kakao', 'KAKAO'],
    ['naver', 'NAVER'],
  ] as const)('경로 이름 %s는 서버 업체 %s다', (slug, expected) => {
    // When
    const provider = toOAuthProvider(slug);

    // Then
    expect(provider).toBe(expected);
  });
});

describe('toOAuthProviderSlug', () => {
  it.each(['APPLE', 'GOOGLE', 'KAKAO', 'NAVER'] as const)(
    '서버 업체 %s를 경로 이름으로 바꾸면 다시 같은 업체로 돌아온다',
    (provider) => {
      // When
      const slug = toOAuthProviderSlug(provider);

      // Then
      expect(toOAuthProvider(slug)).toBe(provider);
    },
  );
});

describe('findOAuthCode', () => {
  it('쿼리로 받은 코드가 있으면 주소보다 먼저 쓴다', () => {
    // Given
    const url = 'aido://oauth/callback?code=from-url';
    const queryParams = { code: 'from-query' };

    // When
    const code = findOAuthCode(url, queryParams);

    // Then
    expect(code).toBe('from-query');
  });

  it('쿼리에 없으면 주소의 검색 부분에서 찾는다', () => {
    // Given
    const url = 'aido://oauth/callback?state=s&code=from-search';

    // When
    const code = findOAuthCode(url, {});

    // Then
    expect(code).toBe('from-search');
  });

  it('검색 부분에도 없으면 해시에서 찾는다', () => {
    // Given
    const url = 'aido://oauth/callback#state=s&code=from-hash';

    // When
    const code = findOAuthCode(url, {});

    // Then
    expect(code).toBe('from-hash');
  });

  it('어디에도 코드가 없으면 null을 반환한다', () => {
    // Given
    const url = 'aido://oauth/callback?state=s#error=access_denied';

    // When
    const code = findOAuthCode(url, {});

    // Then
    expect(code).toBeNull();
  });

  it('주소를 읽을 수 없으면 null을 반환한다', () => {
    // Given
    const url = 'not a url';

    // When
    const code = findOAuthCode(url, {});

    // Then
    expect(code).toBeNull();
  });

  it('쿼리의 코드가 빈 문자열이면 주소에서 찾는다', () => {
    // Given
    const url = 'aido://oauth/callback?code=from-url';

    // When
    const code = findOAuthCode(url, { code: '' });

    // Then
    expect(code).toBe('from-url');
  });
});
