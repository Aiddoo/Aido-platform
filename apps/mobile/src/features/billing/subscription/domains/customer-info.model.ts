import { z } from 'zod';

export const subscriptionStoreSchema = z.enum(['APP_STORE', 'PLAY_STORE', 'PROMOTIONAL', 'OTHER']);
export type SubscriptionStore = z.infer<typeof subscriptionStoreSchema>;

export const customerInfoSchema = z.object({
  activeEntitlements: z.array(
    z.object({ store: subscriptionStoreSchema, productIdentifier: z.string() }),
  ),
});
export type CustomerInfo = z.infer<typeof customerInfoSchema>;

function hasStoreEntitlement(customerInfo: CustomerInfo) {
  return customerInfo.activeEntitlements.some((entitlement) => entitlement.store !== 'PROMOTIONAL');
}

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
