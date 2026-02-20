import { z } from 'zod';

export const subscriptionStatusSchema = z.enum(['FREE', 'ACTIVE', 'EXPIRED', 'CANCELLED']);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  userTag: z.string(),
  subscriptionStatus: subscriptionStatusSchema,
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

export const updateProfileResultSchema = userSchema.pick({ name: true, profileImage: true });
export type UpdateProfileResult = z.infer<typeof updateProfileResultSchema>;

export const updateNameInputSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100, '이름은 100자 이내여야 합니다').trim(),
});
export type UpdateNameInput = z.infer<typeof updateNameInputSchema>;

export const UserPolicy = {
  isPremiumUser: (user: User): boolean => {
    return user.subscriptionStatus === 'ACTIVE';
  },
} as const;
