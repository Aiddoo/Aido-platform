import type { OAuthProvider, OAuthProviderSlug } from '../domains/oauth.model';

const OAUTH_PROVIDER_BY_SLUG = {
  apple: 'APPLE',
  google: 'GOOGLE',
  kakao: 'KAKAO',
  naver: 'NAVER',
} as const satisfies { [Slug in OAuthProviderSlug]: Uppercase<Slug> & OAuthProvider };

export function toOAuthProvider(slug: OAuthProviderSlug): OAuthProvider {
  return OAUTH_PROVIDER_BY_SLUG[slug];
}

const OAUTH_PROVIDER_SLUG = {
  APPLE: 'apple',
  GOOGLE: 'google',
  KAKAO: 'kakao',
  NAVER: 'naver',
} as const satisfies { [Provider in OAuthProvider]: Lowercase<Provider> & OAuthProviderSlug };

export function toOAuthProviderSlug(provider: OAuthProvider): OAuthProviderSlug {
  return OAUTH_PROVIDER_SLUG[provider];
}

/** 돌아온 주소의 쿼리에 없으면 해시까지 본다. 서버와 업체마다 코드를 두는 자리가 다르다 */
export function findOAuthCode(url: string, queryParams: Record<string, string>): string | null {
  if (queryParams.code) {
    return queryParams.code;
  }
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.searchParams.get('code') ||
      new URLSearchParams(parsedUrl.hash.replace(/^#/, '')).get('code') ||
      null
    );
  } catch {
    return null;
  }
}
