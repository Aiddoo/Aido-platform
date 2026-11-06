import { z } from 'zod';

const subscriptionStoreSchema = z.enum(['APP_STORE', 'PLAY_STORE', 'PROMOTIONAL', 'OTHER']);
export type SubscriptionStore = z.infer<typeof subscriptionStoreSchema>;

/** 스토어가 알려 준 내 구독. 프리미엄 여부의 원천은 서버(`/me`)이고 이것은 복원·구독 관리 판단에만 쓴다 */
export const customerInfoSchema = z.object({
  activeEntitlements: z.array(
    z.object({ store: subscriptionStoreSchema, productIdentifier: z.string() }),
  ),
});
export type CustomerInfo = z.infer<typeof customerInfoSchema>;
