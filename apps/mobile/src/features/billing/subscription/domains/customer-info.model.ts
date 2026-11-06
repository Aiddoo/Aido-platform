import type { CustomerInfo, SubscriptionStore } from '../schemas/customer-info.schema';

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
