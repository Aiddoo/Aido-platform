import { z } from 'zod';
import { REVENUECAT_EVENT_TYPES, REVENUECAT_STORES } from './subscription.constants';

export const revenueCatEventSchema = z.object({
  type: z.enum(REVENUECAT_EVENT_TYPES),
  app_user_id: z.string().min(1),
  product_id: z.string().min(1),
  period_type: z.string().optional(),
  purchased_at_ms: z.number().optional(),
  expiration_at_ms: z.number().nullable().optional(),
  store: z.enum(REVENUECAT_STORES).optional(),
  environment: z.enum(['SANDBOX', 'PRODUCTION']).optional(),
  transaction_id: z.string().optional(),
  original_transaction_id: z.string().optional(),
  is_family_share: z.boolean().optional(),
  cancel_reason: z.string().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  price_in_purchased_currency: z.number().optional(),
  country_code: z.string().optional(),
});

export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>;

export const revenueCatWebhookPayloadSchema = z.object({
  api_version: z.string().optional(),
  event: revenueCatEventSchema,
});

export type RevenueCatWebhookPayload = z.infer<typeof revenueCatWebhookPayloadSchema>;
