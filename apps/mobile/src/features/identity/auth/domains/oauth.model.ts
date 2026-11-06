import type { OAuthProvider, OAuthProviderSlug } from '../schemas/oauth.schema';

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
