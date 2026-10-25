import type { CustomerInfo } from 'react-native-purchases';

type EntitlementInfo = CustomerInfo['entitlements']['active'][string];

interface StoreEntitlements {
  active: Record<string, Pick<EntitlementInfo, 'store'>>;
}

interface StoreProductEntitlements {
  active: Record<string, Pick<EntitlementInfo, 'store' | 'productIdentifier'>>;
}

export const CustomerInfoPolicy = {
  /** 스토어에서 실제로 결제한 엔타이틀먼트가 있는지 본다. 보상(PROMOTIONAL)은 복원할 구매가 아니다. */
  hasStoreEntitlement(entitlements: StoreEntitlements) {
    return Object.values(entitlements.active).some(
      (entitlement) => entitlement.store !== 'PROMOTIONAL',
    );
  },

  /** 그 스토어에서 결제한 활성 구독의 상품 id. Google Play는 base plan을 뺀 구독 id다. */
  findStoreProductId(entitlements: StoreProductEntitlements, store: EntitlementInfo['store']) {
    return (
      Object.values(entitlements.active).find((entitlement) => entitlement.store === store)
        ?.productIdentifier ?? null
    );
  },
};
