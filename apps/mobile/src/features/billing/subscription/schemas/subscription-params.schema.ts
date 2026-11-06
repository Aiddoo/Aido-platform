import { z } from 'zod';

const subscriptionViewSchema = z.enum(['status', 'plans']);

export type SubscriptionView = z.output<typeof subscriptionViewSchema>;

export const subscriptionParamsSchema = z.object({
  view: subscriptionViewSchema.catch('status'),
});
