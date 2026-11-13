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

const linkedAccountSchema = z.object({
  provider: oauthProviderSchema,
  linked: z.boolean(),
  providerAccountId: z.string().nullable(),
  linkedAt: instantSchema.nullable(),
});
export type LinkedAccount = z.infer<typeof linkedAccountSchema>;

const linkedAccountsResultSchema = z.object({
  accounts: z.array(linkedAccountSchema),
  canUnlink: z.boolean(),
});
export type LinkedAccountsResult = z.infer<typeof linkedAccountsResultSchema>;

function countLinkedAccounts({ accounts }: LinkedAccountsResult): number {
  return accounts.filter((account) => account.linked).length;
}

function isProviderLinked({ accounts }: LinkedAccountsResult, provider: OAuthProvider): boolean {
  return accounts.some((account) => account.provider === provider && account.linked);
}

export const LinkedAccountsPolicy = {
  countLinkedAccounts,
  isProviderLinked,
} as const;
