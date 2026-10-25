import { ACCOUNT_PROVIDERS, OAUTH_PROVIDERS } from '@aido/api';
import { z } from 'zod';

export const accountProviderSchema = z.enum(ACCOUNT_PROVIDERS);
export type AccountProvider = z.infer<typeof accountProviderSchema>;

export const oauthProviderSchema = z.enum(OAUTH_PROVIDERS);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

const ACCOUNT_PROVIDER_SLUG = {
  credential: 'credential',
  apple: 'apple',
  google: 'google',
  kakao: 'kakao',
  naver: 'naver',
} as const satisfies { [Provider in AccountProvider as Lowercase<Provider>]: Lowercase<Provider> };

export const authProviderSlugSchema = z.enum(ACCOUNT_PROVIDER_SLUG);
export type AuthProviderSlug = z.infer<typeof authProviderSlugSchema>;

export const oauthProviderSlugSchema = authProviderSlugSchema.exclude(['credential']);
export type OAuthProviderSlug = z.infer<typeof oauthProviderSlugSchema>;

const OAUTH_PROVIDER_BY_SLUG = {
  apple: 'APPLE',
  google: 'GOOGLE',
  kakao: 'KAKAO',
  naver: 'NAVER',
} as const satisfies { [Slug in OAuthProviderSlug]: Uppercase<Slug> & OAuthProvider };

export function toOAuthProvider(slug: OAuthProviderSlug): OAuthProvider {
  return OAUTH_PROVIDER_BY_SLUG[slug];
}

const oauthStartProviderSchema = oauthProviderSlugSchema.exclude(['apple']);
export type OAuthStartProvider = z.infer<typeof oauthStartProviderSchema>;
const oauthStartModeSchema = z.enum(['login', 'link']);
export type OAuthStartMode = z.infer<typeof oauthStartModeSchema>;

export const linkedAccountSchema = z.object({
  provider: oauthProviderSchema,
  linked: z.boolean(),
  providerAccountId: z.string().nullable(),
  linkedAt: z.date().nullable(),
});
export type LinkedAccount = z.infer<typeof linkedAccountSchema>;

export const linkedAccountsResultSchema = z.object({
  accounts: z.array(linkedAccountSchema),
  canUnlink: z.boolean(),
});
export type LinkedAccountsResult = z.infer<typeof linkedAccountsResultSchema>;
