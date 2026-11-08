import { ACCOUNT_PROVIDERS, OAUTH_PROVIDERS } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

const accountProviderSchema = z.enum(ACCOUNT_PROVIDERS);
type AccountProvider = z.infer<typeof accountProviderSchema>;

const oauthProviderSchema = z.enum(OAUTH_PROVIDERS);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

const ACCOUNT_PROVIDER_SLUG = {
  credential: 'credential',
  apple: 'apple',
  google: 'google',
  kakao: 'kakao',
  naver: 'naver',
} as const satisfies { [Provider in AccountProvider as Lowercase<Provider>]: Lowercase<Provider> };

const authProviderSlugSchema = z.enum(ACCOUNT_PROVIDER_SLUG);
const oauthProviderSlugSchema = authProviderSlugSchema.exclude(['credential']);
export type OAuthProviderSlug = z.infer<typeof oauthProviderSlugSchema>;

const oauthStartProviderSchema = oauthProviderSlugSchema.exclude(['apple']);
export type OAuthStartProvider = z.infer<typeof oauthStartProviderSchema>;
const oauthStartModeSchema = z.enum(['login', 'link']);
export type OAuthStartMode = z.infer<typeof oauthStartModeSchema>;

export const linkedAccountSchema = z.object({
  provider: oauthProviderSchema,
  linked: z.boolean(),
  providerAccountId: z.string().nullable(),
  linkedAt: instantSchema.nullable(),
});
export type LinkedAccount = z.infer<typeof linkedAccountSchema>;

export const linkedAccountsResultSchema = z.object({
  accounts: z.array(linkedAccountSchema),
  canUnlink: z.boolean(),
});
export type LinkedAccountsResult = z.infer<typeof linkedAccountsResultSchema>;

const OAUTH_PROVIDER_BY_SLUG = {
  apple: 'APPLE',
  google: 'GOOGLE',
  kakao: 'KAKAO',
  naver: 'NAVER',
} as const satisfies { [Slug in OAuthProviderSlug]: Uppercase<Slug> & OAuthProvider };

function toOAuthProvider(slug: OAuthProviderSlug): OAuthProvider {
  return OAUTH_PROVIDER_BY_SLUG[slug];
}

const OAUTH_PROVIDER_SLUG = {
  APPLE: 'apple',
  GOOGLE: 'google',
  KAKAO: 'kakao',
  NAVER: 'naver',
} as const satisfies { [Provider in OAuthProvider]: Lowercase<Provider> & OAuthProviderSlug };

function toOAuthProviderSlug(provider: OAuthProvider): OAuthProviderSlug {
  return OAUTH_PROVIDER_SLUG[provider];
}

/** 돌아온 주소의 쿼리에 없으면 해시까지 본다. 서버와 업체마다 코드를 두는 자리가 다르다 */
function findOAuthCode(url: string, queryParams: Record<string, string>): string | null {
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

export const OAuthPolicy = {
  toOAuthProvider,
  toOAuthProviderSlug,
  findOAuthCode,
} as const;
