import { z } from 'zod';

const subscriptionStoreSchema = z.enum(['APP_STORE', 'PLAY_STORE', 'PROMOTIONAL', 'OTHER']);
export type SubscriptionStore = z.infer<typeof subscriptionStoreSchema>;

/** 스토어가 알려 준 내 구독. 프리미엄 여부의 원천은 서버(`/me`)이고 이것은 복원·구독 관리 판단에만 쓴다 */
export const customerInfoSchema = z.object({
  activeEntitlements: z.array(
    z.object({ store: subscriptionStoreSchema, productIdentifier: z.string() }),
  ),
  managementUrl: z.string().nullable(),
});
export type CustomerInfo = z.infer<typeof customerInfoSchema>;

/** 스토어에서 실제로 결제한 엔타이틀먼트가 있는지 본다. 보상(PROMOTIONAL)은 복원할 구매가 아니다. */
function hasStoreEntitlement(customerInfo: CustomerInfo) {
  return customerInfo.activeEntitlements.some((entitlement) => entitlement.store !== 'PROMOTIONAL');
}

/** 그 스토어에서 결제한 활성 구독의 상품 id. Google Play는 base plan을 뺀 구독 id다. */
function findStoreProductId(customerInfo: CustomerInfo, store: SubscriptionStore) {
  return (
    customerInfo.activeEntitlements.find((entitlement) => entitlement.store === store)
      ?.productIdentifier ?? null
  );
}

export const CustomerInfoPolicy = {
  hasStoreEntitlement,
  findStoreProductId,
} as const;
