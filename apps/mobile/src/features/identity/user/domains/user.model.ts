import { ACCOUNT_PROVIDERS, SUBSCRIPTION_STATUS, USER_ROLE } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import { PremiumAccessPolicy, premiumAccessSchema } from './premium-access.model';

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  userTag: z.string(),
  role: z.enum([USER_ROLE.USER, USER_ROLE.ADMIN]),
  subscriptionStatus: z.enum(SUBSCRIPTION_STATUS),
  subscriptionExpiresAt: instantSchema.nullable(),
  providers: z.array(z.enum(ACCOUNT_PROVIDERS)),
  premiumAccess: premiumAccessSchema,
  isPremium: z.boolean(),
  createdAt: instantSchema,
});
export type User = z.infer<typeof userSchema>;

export const updateProfileResultSchema = z.object({
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
});
export type UpdateProfileResult = z.infer<typeof updateProfileResultSchema>;

function hasCredential(user: Pick<User, 'providers'>) {
  return user.providers.includes('CREDENTIAL');
}

function isAdmin(user: Pick<User, 'role'>) {
  return user.role === USER_ROLE.ADMIN;
}

function hasPremiumAccess(user: Pick<User, 'role' | 'isPremium'>) {
  return isAdmin(user) || user.isPremium;
}

function hasEntitlementChanged(
  previous: Pick<User, 'role' | 'isPremium' | 'premiumAccess'>,
  next: Pick<User, 'role' | 'isPremium' | 'premiumAccess'>,
) {
  return (
    previous.role !== next.role ||
    previous.isPremium !== next.isPremium ||
    PremiumAccessPolicy.hasChanged(previous.premiumAccess, next.premiumAccess)
  );
}

export const UserPolicy = {
  hasCredential,
  isAdmin,
  hasPremiumAccess,
  hasEntitlementChanged,
} as const;
