import { z } from 'zod';

const planTypeSchema = z.enum(['monthly', 'annual']);
export type PlanType = z.infer<typeof planTypeSchema>;

const subscriptionPlanSchema = z.object({
  identifier: z.string(),
  planType: planTypeSchema,
  priceString: z.string(),
  price: z.number(),
  currencyCode: z.string(),
  title: z.string(),
  description: z.string().nullable(),
});
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

const subscriptionOfferingSchema = z.object({
  identifier: z.string(),
  plans: z.array(subscriptionPlanSchema),
});
export type SubscriptionOffering = z.infer<typeof subscriptionOfferingSchema>;
