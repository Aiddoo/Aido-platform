import { ACCOUNT_PROVIDERS, OAUTH_MODES, OAUTH_PROVIDERS } from '@aido/api/vocabulary';
import { z } from 'zod';

const accountProviderSchema = z.enum(ACCOUNT_PROVIDERS);
type AccountProvider = z.infer<typeof accountProviderSchema>;

export const oauthProviderSchema = z.enum(OAUTH_PROVIDERS);
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
const oauthStartModeSchema = z.enum(OAUTH_MODES);
export type OAuthStartMode = z.infer<typeof oauthStartModeSchema>;
