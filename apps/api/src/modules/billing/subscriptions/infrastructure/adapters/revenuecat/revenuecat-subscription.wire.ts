import { z } from "zod";

/**
 * RevenueCat REST v2 Subscription 중 대조에 쓰는 칸. 나머지 칸은 버린다.
 * @see https://www.revenuecat.com/docs/api-v2/subscription-data-model
 */
const revenueCatSubscriptionSchema = z.object({
  id: z.string().min(1),
  product_id: z.string().min(1).nullable(),
  current_period_ends_at: z.number().int().nullable(),
  gives_access: z.boolean(),
  // 새 값이 생겨도 대조를 막지 않도록 문자열로 받고 아는 값만 해석한다
  auto_renewal_status: z.string(),
  status: z.string(),
});

export type RevenueCatSubscription = z.infer<typeof revenueCatSubscriptionSchema>;

export const revenueCatSubscriptionListSchema = z.object({
  object: z.literal("list"),
  items: z.array(revenueCatSubscriptionSchema),
});

/** @see https://www.revenuecat.com/docs/api-v2/product */
export const revenueCatProductSchema = z.object({
  id: z.string().min(1),
  store_identifier: z.string().min(1),
});
