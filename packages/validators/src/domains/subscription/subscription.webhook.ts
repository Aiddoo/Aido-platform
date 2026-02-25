import { z } from 'zod';

/**
 * RevenueCat Webhook Event 스키마
 *
 * z.string()으로 type/store를 수용하여 RevenueCat이 새 이벤트/스토어를
 * 추가하더라도 Zod 검증 실패 없이 처리합니다.
 * .passthrough()로 미지정 필드도 통과시킵니다.
 *
 * @see https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export const revenueCatEventSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().min(1),
    app_user_id: z.string().min(1),
    product_id: z.string().min(1),
    event_timestamp_ms: z.number().optional(),
    period_type: z.string().optional(),
    purchased_at_ms: z.number().optional(),
    expiration_at_ms: z.number().nullable().optional(),
    store: z.string().optional(),
    environment: z.enum(['SANDBOX', 'PRODUCTION']).optional(),
    transaction_id: z.string().optional(),
    original_transaction_id: z.string().optional(),
    is_family_share: z.boolean().optional(),
    cancel_reason: z.string().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    price_in_purchased_currency: z.number().optional(),
    country_code: z.string().optional(),
  })
  .passthrough();

export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>;

export const revenueCatWebhookPayloadSchema = z
  .object({
    api_version: z.string().optional(),
    event: revenueCatEventSchema,
  })
  .passthrough();

export type RevenueCatWebhookPayload = z.infer<typeof revenueCatWebhookPayloadSchema>;
