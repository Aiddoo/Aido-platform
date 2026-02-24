import { ACCOUNT_PROVIDERS, SUBSCRIPTION_STATUS, USER_ROLE } from '@aido/validators';
import { z } from 'zod';

const accountProviderSchema = z.enum(ACCOUNT_PROVIDERS);

export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUS);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

const userRoleSchema = z.enum([USER_ROLE.USER, USER_ROLE.ADMIN]);

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  userTag: z.string(),
  role: userRoleSchema,
  subscriptionStatus: subscriptionStatusSchema,
  providers: z.array(accountProviderSchema),
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

export const updateProfileResultSchema = userSchema.pick({ name: true, profileImage: true });
export type UpdateProfileResult = z.infer<typeof updateProfileResultSchema>;

export const updateNameInputSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100, '이름은 100자 이내여야 합니다').trim(),
});
export type UpdateNameInput = z.infer<typeof updateNameInputSchema>;

const isPremiumUser = (user: User) => {
  return user.role === 'ADMIN' || user.subscriptionStatus === 'ACTIVE';
};

const hasCredential = (user: User) => {
  return user.providers.includes('CREDENTIAL');
};

export const UserPolicy = {
  isPremiumUser,
  hasCredential,
} as const;
