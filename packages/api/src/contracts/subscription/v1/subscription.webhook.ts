import { z } from "zod";

import { SUBSCRIPTION_ENVIRONMENTS } from "../../../vocabulary/subscription.constants.js";

/**
 * RevenueCat Webhook Event 스키마
 *
 * z.string()으로 type/store를 수용하여 RevenueCat이 새 이벤트/스토어를
 * 추가하더라도 Zod 검증 실패 없이 처리합니다.
 * z.looseObject()로 미지정 필드도 통과시킵니다.
 *
 * @see https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export const revenueCatEventSchema = z.looseObject({
  id: z.string().optional(),
  type: z.string().min(1),
  app_user_id: z.string().min(1),
  product_id: z.string().min(1),
  event_timestamp_ms: z.number().optional(),
  period_type: z.string().optional(),
  purchased_at_ms: z.number().optional(),
  expiration_at_ms: z.number().nullable().optional(),
  /** BILLING_ISSUE에만 오는 스토어 결제 유예(billing grace)의 끝. 유예를 쓰지 않으면 null이다. */
  grace_period_expiration_at_ms: z.number().nullable().optional(),
  store: z.string().optional(),
  environment: z.enum(SUBSCRIPTION_ENVIRONMENTS).optional(),
  transaction_id: z.string().optional(),
  original_transaction_id: z.string().optional(),
  is_family_share: z.boolean().optional(),
  cancel_reason: z.string().optional(),
  /** EXPIRATION의 만료 사유 (UNSUBSCRIBE·BILLING_ERROR 등). 형식이 달라도 이벤트 처리는 막지 않는다 */
  expiration_reason: z.string().optional().catch(undefined),
  /** 무료 체험이 끝나 첫 결제로 넘어간 RENEWAL이면 true. 형식이 다르면 전환이 아닌 것으로 본다 */
  is_trial_conversion: z.boolean().optional().catch(undefined),
  price: z.number().optional(),
  currency: z.string().optional(),
  price_in_purchased_currency: z.number().optional(),
  country_code: z.string().optional(),
  /** TRANSFER에서 구매를 넘겨준·넘겨받은 app_user_id 목록 */
  transferred_from: z.array(z.string()).optional(),
  transferred_to: z.array(z.string()).optional(),
});

export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>;

export const revenueCatWebhookPayloadSchema = z.looseObject({
  api_version: z.string().optional(),
  event: revenueCatEventSchema,
});

export type RevenueCatWebhookPayload = z.infer<typeof revenueCatWebhookPayloadSchema>;

/**
 * RevenueCat TRANSFER 이벤트. 구독자·구독 필드(app_user_id·product_id 등) 없이 구매를 넘겨준·넘겨받은
 * app_user_id 목록만 온다. 다른 이벤트 스키마는 그대로 엄격하게 검증한다.
 *
 * @see https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export const revenueCatTransferEventSchema = z.looseObject({
  id: z.string().optional(),
  type: z.literal("TRANSFER"),
  event_timestamp_ms: z.number().optional(),
  store: z.string().optional(),
  environment: z.enum(SUBSCRIPTION_ENVIRONMENTS).optional(),
  transferred_from: z.array(z.string().min(1)),
  transferred_to: z.array(z.string().min(1)).min(1),
});

export type RevenueCatTransferEvent = z.infer<typeof revenueCatTransferEventSchema>;

export const revenueCatTransferWebhookPayloadSchema = z.looseObject({
  api_version: z.string().optional(),
  event: revenueCatTransferEventSchema,
});

export type RevenueCatTransferWebhookPayload = z.infer<
  typeof revenueCatTransferWebhookPayloadSchema
>;
