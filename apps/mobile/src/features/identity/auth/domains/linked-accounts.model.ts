import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import { oauthProviderSchema, type OAuthProvider } from './oauth.model';

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

export const LinkedAccountsPolicy = {
  countLinkedAccounts({ accounts }: LinkedAccountsResult): number {
    return accounts.filter((account) => account.linked).length;
  },

  isProviderLinked({ accounts }: LinkedAccountsResult, provider: OAuthProvider): boolean {
    return accounts.some((account) => account.provider === provider && account.linked);
  },
};
