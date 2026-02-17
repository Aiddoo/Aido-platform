import { z } from 'zod';

export const subscriptionStatusSchema = z.enum(['FREE', 'ACTIVE', 'EXPIRED', 'CANCELLED']);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  profileImage: z.string().nullable(),
  userTag: z.string(),
  subscriptionStatus: subscriptionStatusSchema,
  /** mapper에서 UserPolicy.isPremiumUser(subscriptionStatus)로 파생 계산 */
  isSubscribed: z.boolean(),
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

export const updateProfileResultSchema = userSchema.pick({ name: true, profileImage: true });
export type UpdateProfileResult = z.infer<typeof updateProfileResultSchema>;

export const UserPolicy = {
  isPremiumUser: (status: SubscriptionStatus): boolean => {
    return status === 'ACTIVE';
  },
} as const;
