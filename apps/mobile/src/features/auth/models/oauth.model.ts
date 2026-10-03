import { ACCOUNT_PROVIDERS, OAUTH_PROVIDERS } from '@aido/validators';
import { z } from 'zod';

const toSlugTuple = <T extends readonly string[]>(arr: T) =>
  arr.map((s) => s.toLowerCase()) as { [K in keyof T]: Lowercase<T[K] & string> };

export const accountProviderSchema = z.enum(ACCOUNT_PROVIDERS);
export type AccountProvider = z.infer<typeof accountProviderSchema>;

export const oauthProviderSchema = z.enum(OAUTH_PROVIDERS);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

export const authProviderSlugSchema = z.enum(toSlugTuple(ACCOUNT_PROVIDERS));
export type AuthProviderSlug = z.infer<typeof authProviderSlugSchema>;

export const oauthProviderSlugSchema = z.enum(toSlugTuple(OAUTH_PROVIDERS));
export type OAuthProviderSlug = z.infer<typeof oauthProviderSlugSchema>;

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
