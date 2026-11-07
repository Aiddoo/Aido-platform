import { z } from 'zod';

export const subscriptionViewSchema = z.enum(['status', 'plans']).catch('status');

export type SubscriptionView = z.output<typeof subscriptionViewSchema>;
